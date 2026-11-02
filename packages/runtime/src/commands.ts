import type { ClientCommand } from '@totvibe/protocol';

import type { AgentRuntime } from './runtime';

export const dispatchClientCommand = (runtime: AgentRuntime, command: ClientCommand) => {
  switch (command.type) {
    case 'approve': {
      runtime.resolveApproval(command.granted);
      return;
    }
    case 'cancel': {
      runtime.cancel();
      return;
    }
    case 'save-api-key': {
      return runtime.saveApiKey(command.providerName, command.apiKey);
    }
    case 'select-provider': {
      runtime.selectProvider(command.providerName, command.modelId);
      return;
    }
    case 'submit': {
      runtime.submit(command.text);
      return;
    }
    case 'test-connection': {
      return runtime.testConnection(command.providerName);
    }
  }
};
