import { describe, expect, vi } from 'vitest';

import { test } from '#sandbox';

describe('1.1 tracking writable and readable directories', () => {
  test('1.1.1 allows writes inside the working directory and default writable paths', async ({ sandbox: fixture }) => {
    const cwd = await fixture.makeScratchDir();
    const state = new fixture.SandboxState(cwd);
    expect(state.allowsWrite(`${cwd}/notes.txt`)).toBe(true);
    expect(state.allowsWrite('/tmp/scratch.txt')).toBe(true);
    expect(state.allowsWrite('/home/someone-else/secret.txt')).toBe(false);
  });

  test('1.1.2 grants additional read-write directories on request', async ({ sandbox: fixture }) => {
    const cwd = await fixture.makeScratchDir();
    const state = new fixture.SandboxState(cwd);
    state.grantReadWrite('/var/shared');
    expect(state.allowsWrite('/var/shared/report.txt')).toBe(true);
    expect(state.readWriteDirs()).toContain('/var/shared');
  });

  test('1.1.3 serializes the grants into helper environment variables', async ({ sandbox: fixture }) => {
    const cwd = await fixture.makeScratchDir();
    const state = new fixture.SandboxState(cwd);
    const env = state.toEnv('none');
    expect(env.SANDBOX_NET).toBe('none');
    expect(env.SANDBOX_RW_PATHS.split(':')).toContain(cwd);
    expect(env.SANDBOX_RO_PATHS.split(':')).toContain('/etc');
  });
});

describe('1.2 locating and probing the sandbox helper', () => {
  test('1.2.1 uses the configured helper binary', async ({ sandbox: fixture }) => {
    const dir = await fixture.makeScratchDir();
    const binary = await fixture.writeStubHelper(dir, 'echo landlock=ok');
    vi.stubEnv('TOTVIBE_SANDBOX_BIN', binary);
    expect(await fixture.probeSandbox('none')).toMatchObject({ available: true, hasLandlock: true });
  });

  test('1.2.2 reports the sandbox disabled when the user opted out', async ({ sandbox: fixture }) => {
    expect(await fixture.probeSandbox('none', false)).toEqual({
      available: false,
      degraded: false,
      enabled: false,
      hasLandlock: false,
      net: 'none',
    });
  });

  test('1.2.3 reports a degraded sandbox when the helper binary is missing', async ({ sandbox: fixture }) => {
    vi.stubEnv('TOTVIBE_SANDBOX_BIN', '/nonexistent/totvibe-sandbox');
    expect(await fixture.probeSandbox('none')).toEqual({
      available: false,
      degraded: true,
      enabled: true,
      hasLandlock: false,
      net: 'none',
    });
  });

  test('1.2.4 detects landlock support from the helper probe output', async ({ sandbox: fixture }) => {
    const dir = await fixture.makeScratchDir();
    vi.stubEnv('TOTVIBE_SANDBOX_BIN', await fixture.writeStubHelper(dir, 'echo landlock=ok'));
    expect(await fixture.probeSandbox('inherit')).toEqual({
      available: true,
      degraded: false,
      enabled: true,
      hasLandlock: true,
      net: 'inherit',
    });
  });
});

describe('1.3 running shell commands through the sandbox', () => {
  test('1.3.1 runs the command through the helper when it is available', async ({ sandbox: fixture }) => {
    const cwd = await fixture.makeScratchDir();
    vi.stubEnv('TOTVIBE_SANDBOX_BIN', await fixture.writeStubHelper(cwd, 'exec bash -c "$1"'));
    const run = await fixture.runSandboxedBash(
      'echo confined && echo oops >&2',
      new fixture.SandboxState(cwd),
      cwd,
      'none',
    );
    expect(run).toEqual({ exitCode: 0, sandboxed: true, stderr: 'oops\n', stdout: 'confined\n' });
  });

  test('1.3.2 falls back to plain bash when sandboxing is disabled', async ({ sandbox: fixture }) => {
    const cwd = await fixture.makeScratchDir();
    const run = await fixture.runSandboxedBash(
      'echo unconfined',
      new fixture.SandboxState(cwd),
      cwd,
      'none',
      undefined,
      false,
    );
    expect(run).toEqual({ exitCode: 0, sandboxed: false, stderr: '', stdout: 'unconfined\n' });
  });

  const FAILING_EXIT_CODE = 3;

  test('1.3.3 reports the exit code of a failing command', async ({ sandbox: fixture }) => {
    const cwd = await fixture.makeScratchDir();
    const run = await fixture.runSandboxedBash(
      `exit ${String(FAILING_EXIT_CODE)}`,
      new fixture.SandboxState(cwd),
      cwd,
      'none',
      undefined,
      false,
    );
    expect(run.exitCode).toBe(FAILING_EXIT_CODE);
    expect(run.sandboxed).toBe(false);
  });
});
