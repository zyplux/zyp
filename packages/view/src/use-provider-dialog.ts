import { DEFAULT_PROVIDER, type ProviderInfo, PROVIDERS } from '@totvibe/protocol';
import { useAtomValue, useSetAtom } from 'jotai';
import { useState } from 'react';

import { useController } from './controller';
import {
  connectedProvidersAtom,
  connectionStatusAtom,
  modelIdAtom,
  noticeAtom,
  providerNameAtom,
} from './state/providers';
import { providerDialogOpenAtom } from './state/ui';

export const useProviderDialog = () => {
  const controller = useController();
  const activeProviderName = useAtomValue(providerNameAtom);
  const activeModelId = useAtomValue(modelIdAtom);
  const connectionStatus = useAtomValue(connectionStatusAtom);
  const connectedProviders = useAtomValue(connectedProvidersAtom);
  const notice = useAtomValue(noticeAtom);
  const setNotice = useSetAtom(noticeAtom);
  const setProviderDialogOpen = useSetAtom(providerDialogOpenAtom);
  const [highlightedIndex, setHighlightedIndex] = useState(() =>
    Math.max(
      0,
      PROVIDERS.findIndex(provider => provider.name === activeProviderName),
    ),
  );
  const highlightedProvider = PROVIDERS[highlightedIndex] ?? DEFAULT_PROVIDER;
  const isConnected = ({ name }: ProviderInfo) => connectedProviders.has(name);
  const resolveModelId = ({ defaultModel, name }: ProviderInfo) =>
    name === activeProviderName ? activeModelId : defaultModel;
  const activateProvider = (modelId: string) => {
    if (!isConnected(highlightedProvider)) {
      setNotice(`Add a ${highlightedProvider.apiKeyEnv} to use ${highlightedProvider.label}.`);
      return;
    }
    controller.selectProvider(highlightedProvider.name, modelId.trim() || highlightedProvider.defaultModel);
  };
  return {
    activateProvider,
    canClose: connectionStatus !== 'no-key',
    controller,
    highlightedIndex,
    highlightedProvider,
    isConnected,
    notice,
    resolveModelId,
    setHighlightedIndex,
    setNotice,
    setProviderDialogOpen,
  };
};
