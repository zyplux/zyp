import { describe } from 'vitest';

import { test } from '#web';

describe('1.1 connecting a provider', () => {
  test('1.1.1 opens the provider dialog when no provider is connected', ({ web: fixture }) =>
    fixture.expectProviderDialogWhenUnconnected(fixture.webHarness));

  test('1.1.2 shows the input prompt when a provider is connected', ({ web: fixture }) =>
    fixture.expectInputPromptWhenConnected(fixture.webHarness));
});

describe('1.2 driving the session with slash commands', () => {
  test('1.2.1 the /grant command prints a confirmation in the conversation', ({ web: fixture }) =>
    fixture.expectGrantCommandConfirmation(fixture.webHarness));

  test('1.2.2 the /provider command opens the provider dialog', ({ web: fixture }) =>
    fixture.expectProviderCommandOpensDialog(fixture.webHarness));
});

describe('1.3 talking to the model', () => {
  test("1.3.1 sends a message and renders the model's streamed reply", ({ web: fixture }) =>
    fixture.expectStreamedModelReply(fixture.webHarness));
});
