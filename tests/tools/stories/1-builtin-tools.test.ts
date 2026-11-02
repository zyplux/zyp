import { describe, expect, vi } from 'vitest';

import { test } from '#tools';

describe('1.1 reading files inside the sandbox', () => {
  test('1.1.1 reads a UTF-8 file relative to the working directory', async ({ tools: fixture }) => {
    const { cwd, run } = await fixture.makeToolbox();
    await fixture.writeFile(fixture.path.join(cwd, 'notes.txt'), 'remember the milk');
    expect(await run('read_file', { path: 'notes.txt' })).toBe('remember the milk');
  });

  test('1.1.2 reports a missing file by its requested path', async ({ tools: fixture }) => {
    const { run } = await fixture.makeToolbox();
    await expect(run('read_file', { path: 'ghost.txt' })).rejects.toThrow('No such file: ghost.txt');
  });

  test('1.1.3 refuses paths outside the writable directories', async ({ tools: fixture }) => {
    const { run } = await fixture.makeToolbox();
    await expect(run('read_file', { path: '/etc/hostname' })).rejects.toThrow(
      "Path outside the sandbox's writable dirs",
    );
  });

  test('1.1.4 refuses paths that escape the sandbox through a symlink', async ({ tools: fixture }) => {
    const { cwd, run } = await fixture.makeToolbox();
    await fixture.symlink('/etc', fixture.path.join(cwd, 'escape'));
    await expect(run('read_file', { path: 'escape/hostname' })).rejects.toThrow('escapes the sandbox via a symlink');
  });

  test('1.1.5 truncates oversized output to a spill file', async ({ tools: fixture }) => {
    const { cwd, run } = await fixture.makeToolbox();
    await fixture.writeFile(fixture.path.join(cwd, 'big.txt'), 'x'.repeat(fixture.OUTPUT_CHAR_CAP + 1));
    const TRUNCATION_NOTICE_MAX_CHARS = 500;
    const output = await run('read_file', { path: 'big.txt' });
    expect(output).toContain('[output truncated');
    expect(output.length).toBeLessThan(fixture.OUTPUT_CHAR_CAP + TRUNCATION_NOTICE_MAX_CHARS);
  });
});

describe('1.2 listing directories', () => {
  test('1.2.1 lists entries sorted with a trailing slash on directories', async ({ tools: fixture }) => {
    const { cwd, run } = await fixture.makeToolbox();
    await fixture.mkdir(fixture.path.join(cwd, 'src'));
    await fixture.writeFile(fixture.path.join(cwd, 'README.md'), '# hi');
    expect(await run('list_dir', { path: '.' })).toBe('README.md\nsrc/');
  });

  test('1.2.2 describes an empty directory as empty', async ({ tools: fixture }) => {
    const { run } = await fixture.makeToolbox();
    expect(await run('list_dir', { path: '.' })).toBe('(empty)');
  });
});

describe('1.3 writing files', () => {
  test('1.3.1 creates a file and reports the bytes written', async ({ tools: fixture }) => {
    const { cwd, run } = await fixture.makeToolbox();
    expect(await run('write_file', { content: 'hello', path: 'out.txt' })).toBe('Wrote 5 bytes to out.txt');
    expect(await Bun.file(fixture.path.join(cwd, 'out.txt')).text()).toBe('hello');
  });

  test('1.3.2 refuses to write outside the sandbox unless sandboxing is off', async ({ tools: fixture }) => {
    const confined = await fixture.makeToolbox();
    await expect(confined.run('write_file', { content: 'x', path: '/home/other/out.txt' })).rejects.toThrow(
      "Path outside the sandbox's writable dirs",
    );
    const unconfined = await fixture.makeToolbox({ sandbox: false });
    const target = fixture.path.join(unconfined.cwd, 'anywhere.txt');
    expect(await unconfined.run('write_file', { content: 'x', path: target })).toContain('Wrote 1 bytes');
  });
});

describe('1.4 running shell commands', () => {
  test('1.4.1 reports the exit code and combined output of a command', async ({ tools: fixture }) => {
    const { run } = await fixture.makeToolbox({ sandbox: false });
    expect(await run('run_bash', { command: 'echo hi && echo err >&2' })).toBe('exit 0 (unsandboxed)\nhi\n\nerr');
  });

  test('1.4.2 reports a nonzero exit code without throwing', async ({ tools: fixture }) => {
    const { run } = await fixture.makeToolbox({ sandbox: false });
    expect(await run('run_bash', { command: 'exit 7' })).toBe('exit 7 (unsandboxed)');
  });

  test('1.4.3 runs through the sandbox helper without the unsandboxed tag', async ({ tools: fixture }) => {
    const { cwd, run } = await fixture.makeToolbox();
    vi.stubEnv('TOTVIBE_SANDBOX_BIN', await fixture.writeStubHelper(cwd, 'exec bash -c "$1"'));
    expect(await run('run_bash', { command: 'echo confined' })).toBe('exit 0\nconfined');
  });
});
