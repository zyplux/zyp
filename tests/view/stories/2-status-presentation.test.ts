import { describe, expect } from 'vitest';

import { test } from '#view';

describe('2.1 presenting the connection status', () => {
  test('2.1.1 suffixes the provider label with transient connection states', ({ view: fixture }) => {
    expect(fixture.formatConnectionSuffix('checking')).toBe(' (checking…)');
    expect(fixture.formatConnectionSuffix('rejected')).toBe(' (key rejected)');
    expect(fixture.formatConnectionSuffix('unreachable')).toBe(' (unreachable)');
    expect(fixture.formatConnectionSuffix('ok')).toBe('');
    expect(fixture.formatConnectionSuffix('no-key')).toBe('');
  });

  test('2.1.2 colors and symbolizes each connection state', ({ view: fixture }) => {
    expect(fixture.pickConnectionColor('checking')).toBe(fixture.theme.checking);
    expect(fixture.pickConnectionColor('ok')).toBe(fixture.theme.ok);
    expect(fixture.pickConnectionColor('rejected')).toBe(fixture.theme.error);
    expect(fixture.pickConnectionColor('no-key')).toBe(fixture.theme.warn);
    expect(fixture.pickConnectionSymbol('checking')).toBe('◌');
    expect(fixture.pickConnectionSymbol('ok')).toBe('●');
    expect(fixture.pickConnectionSymbol('rejected')).toBe('✗');
    expect(fixture.pickConnectionSymbol('unreachable')).toBe('●');
    expect(fixture.pickConnectionSymbol('no-key')).toBe('○');
  });
});

describe('2.2 presenting the sandbox status', () => {
  test('2.2.1 labels every sandbox state', ({ view: fixture }) => {
    expect(fixture.formatSandboxLabel(undefined)).toBe('sandbox: …');
    expect(fixture.formatSandboxLabel(fixture.makeSandboxStatus({ enabled: false }))).toBe(
      'sandbox: off (--no-sandbox)',
    );
    expect(fixture.formatSandboxLabel(fixture.makeSandboxStatus({ available: false }))).toBe(
      'sandbox: off (run build:sandbox)',
    );
    expect(fixture.formatSandboxLabel(fixture.makeSandboxStatus({ hasLandlock: false }))).toBe(
      'sandbox: net-only (no landlock)',
    );
    expect(fixture.formatSandboxLabel(fixture.makeSandboxStatus({ net: 'none' }))).toBe('sandbox: fs+net');
    expect(fixture.formatSandboxLabel(fixture.makeSandboxStatus({ net: 'inherit' }))).toBe('sandbox: fs');
  });

  test('2.2.2 colors the sandbox by health', ({ view: fixture }) => {
    expect(fixture.pickSandboxColor(undefined)).toBe(fixture.theme.muted);
    expect(fixture.pickSandboxColor(fixture.makeSandboxStatus({ degraded: true }))).toBe(fixture.theme.warn);
    expect(fixture.pickSandboxColor(fixture.makeSandboxStatus({}))).toBe(fixture.theme.ok);
  });
});

describe('2.3 previewing tool input', () => {
  test('2.3.1 shows strings as-is and serializes objects', ({ view: fixture }) => {
    expect(fixture.formatToolInput('ls -la')).toBe('ls -la');
    expect(fixture.formatToolInput({ path: 'a.txt' })).toBe('{"path":"a.txt"}');
  });

  test('2.3.2 truncates long previews with an ellipsis', ({ view: fixture }) => {
    const TOOL_INPUT_PREVIEW_MAX_CHARS = 96;
    const LONG_INPUT_CHARS = 200;
    const preview = fixture.formatToolInput('x'.repeat(LONG_INPUT_CHARS));
    expect(preview.length).toBe(TOOL_INPUT_PREVIEW_MAX_CHARS);
    expect(preview.endsWith('…')).toBe(true);
  });

  test('2.3.3 falls back to a plain string for unserializable input', ({ view: fixture }) => {
    const circular: { self?: unknown } = {};
    circular.self = circular;
    expect(fixture.formatToolInput(circular)).toBe('[object Object]');
  });
});

describe('2.4 exposing the agent controller to components', () => {
  test('2.4.1 returns the controller provided by the frontend root', ({ view: fixture }) => {
    const { result } = fixture.renderUseController(fixture.stubController);
    expect(result.current).toBe(fixture.stubController);
  });

  test('2.4.2 refuses to render outside a controller provider', ({ view: fixture }) => {
    expect(() => fixture.renderUseController()).toThrow(
      'useController must be used within a ControllerContext provider',
    );
  });
});
