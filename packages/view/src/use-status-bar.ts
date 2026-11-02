import { useAtomValue } from 'jotai';

import {
  formatConnectionSuffix,
  formatSandboxLabel,
  pickConnectionColor,
  pickConnectionSymbol,
  pickSandboxColor,
} from './format';
import { connectionStatusAtom, modelIdAtom, providerAtom } from './state/providers';
import { agentStatusAtom, cwdAtom, sandboxStatusAtom } from './state/session';

export const useStatusBar = () => {
  const provider = useAtomValue(providerAtom);
  const modelId = useAtomValue(modelIdAtom);
  const connectionStatus = useAtomValue(connectionStatusAtom);
  const sandboxStatus = useAtomValue(sandboxStatusAtom);
  return {
    agentStatus: useAtomValue(agentStatusAtom),
    connectionColor: pickConnectionColor(connectionStatus),
    connectionLabel: `${pickConnectionSymbol(connectionStatus)} ${provider.name}:${modelId}${formatConnectionSuffix(connectionStatus)}`,
    cwd: useAtomValue(cwdAtom),
    sandboxColor: pickSandboxColor(sandboxStatus),
    sandboxLabel: formatSandboxLabel(sandboxStatus),
  };
};
