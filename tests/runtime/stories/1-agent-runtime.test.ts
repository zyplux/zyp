import { describe, expect, vi } from 'vitest';

import { test } from '#runtime';

describe('1.1 starting a session', () => {
  test('1.1.1 announces the session, connected providers, and connection status', async ({ runtime: fixture }) => {
    fixture.isolateEnv(fixture.CONNECTED_PROVIDER_KEYS);
    fixture.stubFetch(fixture.HTTP_OK);
    const { config, expectEvent, runtime } = await fixture.makeRuntime();
    vi.stubEnv('HOME', config.cwd);
    runtime.start();
    const init = await expectEvent('announces the session', event => event.type === 'init');
    expect(init).toEqual({
      session: { cwd: '~', isProviderDialogOpen: false, modelId: 'qwen3.7-max', providerName: 'qwen' },
      type: 'init',
    });
    const connected = await expectEvent('lists connected providers', event => event.type === 'connected-providers');
    expect(connected).toEqual({ names: ['qwen'], type: 'connected-providers' });
    await expectEvent('verifies the key', event => event.type === 'connection-status' && event.status === 'ok');
  });

  test('1.1.2 opens the provider dialog when no provider is connected', async ({ runtime: fixture }) => {
    fixture.isolateEnv();
    const { expectEvent, runtime } = await fixture.makeRuntime();
    runtime.start();
    const init = await expectEvent('announces the session', event => event.type === 'init');
    expect(init).toMatchObject({ session: { isProviderDialogOpen: true } });
    await expectEvent('reports no key', event => event.type === 'connection-status' && event.status === 'no-key');
  });

  test('1.1.3 falls over to the first connected provider when the configured one has no key', async ({
    runtime: fixture,
  }) => {
    fixture.isolateEnv({ MOONSHOT_API_KEY: 'fixture-key-kimi' });
    fixture.stubFetch(fixture.HTTP_OK);
    const { expectEvent, runtime } = await fixture.makeRuntime();
    runtime.start();
    const init = await expectEvent('announces the session', event => event.type === 'init');
    expect(init).toMatchObject({ session: { modelId: 'kimi-k2.6', providerName: 'kimi' } });
  });

  test('1.1.4 announces a resumed session and reports the sandbox state', async ({ runtime: fixture }) => {
    fixture.isolateEnv(fixture.CONNECTED_PROVIDER_KEYS);
    fixture.stubFetch(fixture.HTTP_OK);
    vi.stubEnv('TOTVIBE_SANDBOX_BIN', '/nonexistent/totvibe-sandbox');
    const { expectEvent, runtime } = await fixture.makeRuntime({
      initialMessages: [{ content: 'earlier', role: 'user' }],
    });
    runtime.start();
    const resumed = await expectEvent(
      'mentions the resumed session',
      event => event.type === 'message' && event.text.includes('resumed session'),
    );
    expect(resumed).toMatchObject({ text: 'resumed session fixture-session (1 messages)' });
    const sandbox = await expectEvent('reports the sandbox', event => event.type === 'sandbox-status');
    expect(sandbox).toEqual({
      status: { available: false, degraded: true, enabled: true, hasLandlock: false, net: 'none' },
      type: 'sandbox-status',
    });
  });
});

describe('1.2 steering the session with slash commands', () => {
  test('1.2.1 /provider opens the provider dialog', async ({ runtime: fixture }) => {
    fixture.isolateEnv(fixture.CONNECTED_PROVIDER_KEYS);
    const { expectEvent, runtime } = await fixture.makeRuntime();
    await fixture.dispatchClientCommand(runtime, { text: '/provider', type: 'submit' });
    await expectEvent('opens the dialog', event => event.type === 'provider-dialog' && event.open);
  });

  test('1.2.2 /grant widens the sandbox and confirms it in the conversation', async ({ runtime: fixture }) => {
    fixture.isolateEnv(fixture.CONNECTED_PROVIDER_KEYS);
    const { expectEvent, runtime } = await fixture.makeRuntime();
    await fixture.dispatchClientCommand(runtime, { text: '/grant /tmp/demo', type: 'submit' });
    const confirmation = await expectEvent('confirms the grant', event => event.type === 'message');
    expect(confirmation).toEqual({ role: 'tool', text: 'granted read/write: /tmp/demo', type: 'message' });
  });
});

describe('1.3 running a model turn', () => {
  test('1.3.1 streams the reply and toggles the streaming flag', async ({ runtime: fixture }) => {
    fixture.isolateEnv({ ...fixture.CONNECTED_PROVIDER_KEYS, MOONSHOT_API_KEY: 'fixture-key-kimi' });
    fixture.stubFetch(fixture.HTTP_OK);
    fixture.setModelReply('pong from the model');
    const { expectEvent, runtime } = await fixture.makeRuntime();
    await fixture.dispatchClientCommand(runtime, { text: 'ping', type: 'submit' });
    await expectEvent('echoes the user', event => event.type === 'message' && event.text === 'ping');
    await expectEvent('starts streaming', event => event.type === 'streaming' && event.streaming);
    await expectEvent(
      'streams the reply',
      event => event.type === 'agent' && event.event.type === 'text' && event.event.text === 'pong from the model',
    );
    await expectEvent('ends the turn', event => event.type === 'agent' && event.event.type === 'turn_end');
  });
});

describe('1.4 approving mutating tool calls', () => {
  const writeFileCall = { input: { content: 'x', path: 'out.txt' }, toolCallId: 'w1', toolName: 'write_file' };

  test('1.4.1 asks for approval and runs the tool once granted', async ({ runtime: fixture }) => {
    fixture.isolateEnv(fixture.CONNECTED_PROVIDER_KEYS);
    fixture.stubFetch(fixture.HTTP_OK);
    fixture.scriptModelTurns(fixture.toolCallTurn([writeFileCall]), fixture.textTurn('written'));
    const { config, expectEvent, runtime } = await fixture.makeRuntime({ sandbox: false });
    await fixture.dispatchClientCommand(runtime, { text: 'write it', type: 'submit' });
    const approval = await expectEvent(
      'asks for approval',
      event => event.type === 'approval-request' && event.request !== undefined,
    );
    expect(approval).toMatchObject({ request: { name: 'write_file', risk: 'mutate' } });
    await fixture.dispatchClientCommand(runtime, { granted: true, type: 'approve' });
    await expectEvent('runs the tool', event => event.type === 'agent' && event.event.type === 'tool_result');
    expect(await Bun.file(`${config.cwd}/out.txt`).text()).toBe('x');
  });

  test('1.4.2 replaces the tool output with denial feedback when refused', async ({ runtime: fixture }) => {
    fixture.isolateEnv(fixture.CONNECTED_PROVIDER_KEYS);
    fixture.stubFetch(fixture.HTTP_OK);
    fixture.scriptModelTurns(fixture.toolCallTurn([writeFileCall]), fixture.textTurn('understood'));
    const { expectEvent, runtime } = await fixture.makeRuntime({ sandbox: false });
    await fixture.dispatchClientCommand(runtime, { text: 'write it', type: 'submit' });
    await expectEvent('asks for approval', event => event.type === 'approval-request' && event.request !== undefined);
    await fixture.dispatchClientCommand(runtime, { granted: false, type: 'approve' });
    const result = await expectEvent(
      'reports the denial',
      event => event.type === 'agent' && event.event.type === 'tool_result',
    );
    if (result.type !== 'agent' || result.event.type !== 'tool_result') {
      throw new Error('expected a tool_result agent event');
    }
    expect(result.event.output).toContain('Denied: "write_file"');
  });

  test('1.4.3 skips approval entirely in auto-approve mode', async ({ runtime: fixture }) => {
    fixture.isolateEnv(fixture.CONNECTED_PROVIDER_KEYS);
    fixture.stubFetch(fixture.HTTP_OK);
    fixture.scriptModelTurns(fixture.toolCallTurn([writeFileCall]), fixture.textTurn('written'));
    const { events, expectEvent, runtime } = await fixture.makeRuntime({ autoApprove: true, sandbox: false });
    await fixture.dispatchClientCommand(runtime, { text: 'write it', type: 'submit' });
    await expectEvent('runs the tool', event => event.type === 'agent' && event.event.type === 'tool_result');
    expect(events.filter(event => event.type === 'approval-request')).toEqual([]);
  });

  test('1.4.4 ignores a stray approval when nothing is pending', async ({ runtime: fixture }) => {
    fixture.isolateEnv(fixture.CONNECTED_PROVIDER_KEYS);
    const { expectEvent, runtime } = await fixture.makeRuntime();
    await fixture.dispatchClientCommand(runtime, { granted: true, type: 'approve' });
    const cleared = await expectEvent('clears the approval', event => event.type === 'approval-request');
    expect(cleared).toEqual({ type: 'approval-request' });
  });
});

describe('1.5 managing providers and keys', () => {
  test('1.5.1 selecting a provider falls back to its default model', async ({ runtime: fixture }) => {
    fixture.isolateEnv(fixture.CONNECTED_PROVIDER_KEYS);
    fixture.stubFetch(fixture.HTTP_OK);
    const { expectEvent, runtime } = await fixture.makeRuntime();
    await fixture.dispatchClientCommand(runtime, { modelId: '  ', providerName: 'kimi', type: 'select-provider' });
    const changed = await expectEvent('switches the provider', event => event.type === 'provider-changed');
    expect(changed).toEqual({ modelId: 'kimi-k2.6', providerName: 'kimi', type: 'provider-changed' });
    await expectEvent('closes the dialog', event => event.type === 'provider-dialog' && !event.open);
  });

  test('1.5.2 saves a verified key through the host and connects the provider', async ({ runtime: fixture }) => {
    fixture.isolateEnv();
    fixture.stubFetch(fixture.HTTP_OK);
    const { host, saved } = fixture.captureHost();
    const { expectEvent, runtime } = await fixture.makeRuntime({}, host);
    await fixture.dispatchClientCommand(runtime, { apiKey: 'fresh-key', providerName: 'qwen', type: 'save-api-key' });
    await expectEvent(
      'confirms the save',
      event => event.type === 'notice' && event.text === 'Saved DASHSCOPE_API_KEY to .env · key verified',
    );
    expect(saved).toEqual([{ DASHSCOPE_API_KEY: 'fresh-key' }]);
    const connected = await expectEvent('lists connected providers', event => event.type === 'connected-providers');
    expect(connected).toMatchObject({ names: ['qwen'] });
  });

  test('1.5.3 refuses to save a rejected key', async ({ runtime: fixture }) => {
    fixture.isolateEnv();
    fixture.stubFetch(fixture.HTTP_UNAUTHORIZED);
    const { host, saved } = fixture.captureHost();
    const { expectEvent, runtime } = await fixture.makeRuntime({}, host);
    await fixture.dispatchClientCommand(runtime, { apiKey: 'bad-key', providerName: 'qwen', type: 'save-api-key' });
    await expectEvent(
      'warns about the key',
      event => event.type === 'notice' && event.text.includes('Check the key and try again.'),
    );
    expect(saved).toEqual([]);
  });

  test('1.5.4 saves an unverifiable key with a caveat', async ({ runtime: fixture }) => {
    fixture.isolateEnv();
    fixture.stubFetch(new Error('connect timeout'));
    const { host, saved } = fixture.captureHost();
    const { expectEvent, runtime } = await fixture.makeRuntime({}, host);
    await fixture.dispatchClientCommand(runtime, { apiKey: 'maybe-key', providerName: 'qwen', type: 'save-api-key' });
    await expectEvent('caveats the save', event => event.type === 'notice' && event.text.includes("couldn't verify"));
    expect(saved).toEqual([{ DASHSCOPE_API_KEY: 'maybe-key' }]);
  });

  test('1.5.5 reports connection tests for missing, valid, rejected, and unreachable keys', async ({
    runtime: fixture,
  }) => {
    fixture.isolateEnv();
    const { expectEvent, runtime } = await fixture.makeRuntime();
    await fixture.dispatchClientCommand(runtime, { providerName: 'qwen', type: 'test-connection' });
    await expectEvent(
      'reports the missing key',
      event => event.type === 'notice' && event.text.includes('DASHSCOPE_API_KEY is not set'),
    );

    fixture.isolateEnv(fixture.CONNECTED_PROVIDER_KEYS);
    fixture.stubFetch(fixture.HTTP_OK);
    await fixture.dispatchClientCommand(runtime, { providerName: 'qwen', type: 'test-connection' });
    await expectEvent(
      'reports success',
      event => event.type === 'notice' && event.text === 'Alibaba Qwen: connection OK',
    );

    fixture.stubFetch(fixture.HTTP_FORBIDDEN);
    await fixture.dispatchClientCommand(runtime, { providerName: 'qwen', type: 'test-connection' });
    await expectEvent('reports rejection', event => event.type === 'notice' && event.text.includes('key rejected'));

    fixture.stubFetch(fixture.HTTP_INTERNAL_SERVER_ERROR);
    await fixture.dispatchClientCommand(runtime, { providerName: 'qwen', type: 'test-connection' });
    await expectEvent(
      'reports the server error',
      event => event.type === 'notice' && event.text.includes('unreachable (HTTP 500)'),
    );

    fixture.stubFetch(new Error('no route to host'));
    await fixture.dispatchClientCommand(runtime, { providerName: 'qwen', type: 'test-connection' });
    await expectEvent(
      'reports unreachability',
      event => event.type === 'notice' && event.text.includes('unreachable (no route to host)'),
    );
  });

  test('1.5.6 builds an OpenAI-compatible model for a provider', ({ runtime: fixture }) => {
    fixture.isolateEnv(fixture.CONNECTED_PROVIDER_KEYS);
    const model = fixture.buildModel(fixture.DEFAULT_PROVIDER, 'glm-5.1');
    expect(model.modelId).toBe('glm-5.1');
    expect(fixture.isConnected(fixture.DEFAULT_PROVIDER)).toBe(false);
  });

  test('1.5.7 keeps an unknown provider selection but checks the default provider key', async ({
    runtime: fixture,
  }) => {
    fixture.isolateEnv();
    const { expectEvent, runtime } = await fixture.makeRuntime();
    await fixture.dispatchClientCommand(runtime, { modelId: '', providerName: 'warp-drive', type: 'select-provider' });
    const changed = await expectEvent('keeps the selection', event => event.type === 'provider-changed');
    expect(changed).toEqual({ modelId: '', providerName: 'warp-drive', type: 'provider-changed' });
    await expectEvent('reports no key', event => event.type === 'connection-status' && event.status === 'no-key');
  });
});

describe('1.6 persisting keys to the .env file', () => {
  test('1.6.1 rewrites existing entries and appends new ones', async ({ runtime: fixture }) => {
    const dir = await fixture.makeScratchDir();
    vi.spyOn(process, 'cwd').mockReturnValue(dir);
    await Bun.write(`${dir}/.env`, 'DASHSCOPE_API_KEY=old\nOTHER=keep\n');
    await fixture.bunHost.saveEnvVars({ DASHSCOPE_API_KEY: 'new', MOONSHOT_API_KEY: 'added' });
    expect(await Bun.file(`${dir}/.env`).text()).toBe('DASHSCOPE_API_KEY=new\nOTHER=keep\nMOONSHOT_API_KEY=added\n');
    expect(process.env.MOONSHOT_API_KEY).toBe('added');
  });

  test('1.6.2 creates the .env file when none exists', async ({ runtime: fixture }) => {
    const dir = await fixture.makeScratchDir();
    vi.spyOn(process, 'cwd').mockReturnValue(dir);
    await fixture.bunHost.saveEnvVars({ ZAI_API_KEY: 'first' });
    expect(await Bun.file(`${dir}/.env`).text()).toBe('ZAI_API_KEY=first\n');
  });
});
