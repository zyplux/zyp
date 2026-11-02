import nodePath from 'node:path';

import type { NetPolicy } from './interfaces';

const DEFAULT_READONLY = ['/usr', '/bin', '/sbin', '/lib', '/lib64', '/etc', '/opt', '/proc', '/sys'];
const DEFAULT_READWRITE = ['/dev', '/tmp'];

export class SandboxState {
  private readOnlyPaths: Set<string>;

  private readWritePaths: Set<string>;

  constructor(cwd: string) {
    this.readWritePaths = new Set([nodePath.resolve(cwd), ...DEFAULT_READWRITE]);
    this.readOnlyPaths = new Set(DEFAULT_READONLY);
  }

  allowsWrite(path: string) {
    const target = nodePath.resolve(path);
    return this.readWriteDirs().some(dir => target === dir || target.startsWith(`${dir}/`));
  }

  grantReadWrite(path: string) {
    this.readWritePaths.add(nodePath.resolve(path));
  }

  readOnlyDirs() {
    return [...this.readOnlyPaths];
  }

  readWriteDirs() {
    return [...this.readWritePaths];
  }

  toEnv(net: NetPolicy) {
    return {
      SANDBOX_NET: net,
      SANDBOX_RO_PATHS: this.readOnlyDirs().join(':'),
      SANDBOX_RW_PATHS: this.readWriteDirs().join(':'),
    };
  }
}

const helperPath = () =>
  process.env.TOTVIBE_SANDBOX_BIN ?? nodePath.resolve(import.meta.dirname, '..', 'bin', 'totvibe-sandbox');

export const probeSandbox = async (net: NetPolicy, isEnabled = true) => {
  if (!isEnabled) {
    return { available: false, degraded: false, enabled: false, hasLandlock: false, net };
  }
  const binary = helperPath();
  if (!(await Bun.file(binary).exists())) {
    return { available: false, degraded: true, enabled: true, hasLandlock: false, net };
  }
  const probe = Bun.spawn([binary, '--probe'], { stderr: 'ignore', stdout: 'pipe' });
  const output = await new Response(probe.stdout).text();
  await probe.exited;
  const hasLandlock = output.includes('landlock=ok');
  return { available: true, degraded: !hasLandlock, enabled: true, hasLandlock, net };
};

export const runSandboxedBash = async (
  command: string,
  state: SandboxState,
  cwd: string,
  net: NetPolicy,
  signal?: AbortSignal,
  isEnabled = true,
) => {
  const binary = helperPath();
  const isSandboxed = isEnabled && (await Bun.file(binary).exists());
  const child = isSandboxed
    ? Bun.spawn([binary, command], {
        cwd,
        env: { ...process.env, ...state.toEnv(net) },
        signal,
        stderr: 'pipe',
        stdout: 'pipe',
      })
    : Bun.spawn(['bash', '-c', command], { cwd, signal, stderr: 'pipe', stdout: 'pipe' });

  const [stdout, stderr] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text()]);
  const exitCode = await child.exited;
  return { exitCode, sandboxed: isSandboxed, stderr, stdout };
};
