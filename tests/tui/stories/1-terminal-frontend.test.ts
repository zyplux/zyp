import { describe } from 'vitest';

import { test } from '#tui';

describe('1.1 connecting a provider', () => {
  test('1.1.1 opens the provider dialog when no provider is connected', ({ tui: fixture }) =>
    fixture.expectProviderDialogWhenUnconnected(fixture.tuiHarness));

  test('1.1.2 arrowing down moves the highlight to the next provider', async ({ tui: fixture }) => {
    const scene = await fixture.tuiHarness.unconnected();
    const expectShows = scene.assert.shows;
    expectShows('▶ ○ Alibaba Qwen');
    await scene.pressArrow('down');
    expectShows('▶ ○ Moonshot Kimi');
    await scene.dispose();
  });

  test('1.1.4 arrowing up moves the highlight to the previous provider', async ({ tui: fixture }) => {
    const scene = await fixture.tuiHarness.unconnected();
    await scene.pressArrow('up');
    scene.assert.shows('▶ ○ Zhipu GLM Coding Plan (China)');
    await scene.dispose();
  });
  test('1.1.5 keeps the dialog open until a provider is connected', async ({ tui: fixture }) => {
    const scene = await fixture.tuiHarness.unconnected();
    await scene.pressEscape();
    scene.assert.shows('Connect a provider');
    await scene.pressEnter();
    scene.assert.shows('Add a DASHSCOPE_API_KEY');
    await scene.dispose();
  });
  test('1.1.3 shows the input prompt when a provider is connected', ({ tui: fixture }) =>
    fixture.expectInputPromptWhenConnected(fixture.tuiHarness));
});

describe('1.2 driving the session with slash commands', () => {
  test('1.2.1 the /grant command prints a confirmation in the conversation', ({ tui: fixture }) =>
    fixture.expectGrantCommandConfirmation(fixture.tuiHarness));

  test('1.2.3 tests a connected provider and closes the dialog with Escape', async ({ tui: fixture }) => {
    const scene = await fixture.tuiHarness.connected();
    await scene.act.typeAndSubmit('/provider');
    await scene.pressKey('t');
    await scene.assert.eventuallyShows('Alibaba Qwen: connection OK');
    await scene.pressEscape();
    await scene.assert.eventuallyShows('Ask totvibe to do something');
    await scene.dispose();
  });
  test('1.2.2 the /provider command opens the provider dialog', ({ tui: fixture }) =>
    fixture.expectProviderCommandOpensDialog(fixture.tuiHarness));
});

describe('1.3 talking to the model', () => {
  test("1.3.1 sends a message and renders the model's streamed reply", ({ tui: fixture }) =>
    fixture.expectStreamedModelReply(fixture.tuiHarness));
});
