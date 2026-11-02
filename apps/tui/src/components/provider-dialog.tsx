import { decodePasteBytes, type InputRenderable } from '@opentui/core';
import { useKeyboard, usePaste } from '@opentui/react';
import { PROVIDERS } from '@totvibe/protocol';
import { theme, useProviderDialog } from '@totvibe/view';
import { useRef, useState } from 'react';

export const ProviderDialog = () => {
  type DialogMode = 'key' | 'model' | 'select';
  const {
    activateProvider,
    canClose,
    controller,
    highlightedIndex,
    highlightedProvider,
    isConnected,
    notice,
    resolveModelId,
    setHighlightedIndex,
    setNotice,
    setProviderDialogOpen,
  } = useProviderDialog();
  const [mode, setMode] = useState<DialogMode>('select');
  const keyInputRef = useRef<InputRenderable>(null);
  const modelInputRef = useRef<InputRenderable>(null);

  const submitApiKey = () => {
    const apiKey = keyInputRef.current?.value.trim() ?? '';
    if (!apiKey) return;
    controller.saveApiKey(highlightedProvider.name, apiKey);
  };

  usePaste(event => {
    if (mode === 'model') return;
    const pasted = decodePasteBytes(event.bytes)
      .replaceAll(/[\r\n]/g, '')
      .trim();
    if (!pasted) return;
    event.preventDefault();
    const keyInput = keyInputRef.current;
    if (keyInput) keyInput.value = `${keyInput.value}${pasted}`;
    if (mode !== 'key') setMode('key');
  });

  const selectActions: Partial<Record<string, () => void>> = {
    down: () => {
      setHighlightedIndex(current => (current === PROVIDERS.length - 1 ? 0 : current + 1));
    },
    escape: () => {
      if (canClose) setProviderDialogOpen(false);
    },
    k: () => {
      setMode('key');
    },
    m: () => {
      setMode('model');
    },
    o: () => {
      controller.openKeyPage(highlightedProvider.keyUrl);
      setNotice(`Opening ${highlightedProvider.keyUrl}`);
    },
    return: () => {
      if (!isConnected(highlightedProvider)) setMode('key');
      activateProvider(resolveModelId(highlightedProvider));
    },
    t: () => {
      controller.testConnection(highlightedProvider.name);
    },
    up: () => {
      setHighlightedIndex(current => (current === 0 ? PROVIDERS.length : current) - 1);
    },
  };

  useKeyboard(key => {
    if (mode !== 'select') {
      if (key.name === 'escape') setMode('select');
      return;
    }
    selectActions[key.name]?.();
  });

  return (
    <box
      style={{
        border: true,
        borderColor: theme.brand,
        borderStyle: 'rounded',
        flexDirection: 'column',
        flexShrink: 0,
        gap: 1,
        padding: 1,
      }}
    >
      <text fg={theme.brand}>Connect a provider · switch model</text>

      <box style={{ flexDirection: 'column', flexShrink: 0 }}>
        {PROVIDERS.map((provider, providerIndex) => (
          <text
            fg={providerIndex === highlightedIndex ? theme.text : theme.muted}
            key={provider.name}
            style={{ flexShrink: 0 }}
          >
            {providerIndex === highlightedIndex ? '▶ ' : '  '}
            {isConnected(provider) ? '●' : '○'} {provider.label} · {resolveModelId(provider)}
          </text>
        ))}
      </box>

      <box style={{ flexDirection: 'column', flexShrink: 0 }}>
        <text fg={isConnected(highlightedProvider) ? theme.ok : theme.warn}>
          {isConnected(highlightedProvider)
            ? `Connected via ${highlightedProvider.apiKeyEnv}`
            : `Not connected — needs ${highlightedProvider.apiKeyEnv}. ${highlightedProvider.keyHint}`}
        </text>
        {!isConnected(highlightedProvider) && <text fg={theme.muted}>Get a key: {highlightedProvider.keyUrl}</text>}

        <box style={{ flexDirection: 'row', gap: 1 }}>
          <text fg={theme.muted}>API key</text>
          <input
            focused={mode === 'key'}
            key={`key-${highlightedProvider.name}`}
            onSubmit={submitApiKey}
            placeholder={`paste ${highlightedProvider.apiKeyEnv}, Enter to save`}
            ref={keyInputRef}
          />
        </box>

        <box style={{ flexDirection: 'row', gap: 1 }}>
          <text fg={theme.muted}>Model </text>
          <input
            focused={mode === 'model'}
            key={`model-${highlightedProvider.name}`}
            onSubmit={() => {
              if (!isConnected(highlightedProvider)) setMode('key');
              activateProvider(modelInputRef.current?.value ?? highlightedProvider.defaultModel);
            }}
            placeholder="model id, Enter to use"
            ref={modelInputRef}
            value={resolveModelId(highlightedProvider)}
          />
        </box>
      </box>

      {notice ? <text fg={theme.highlight}>{notice}</text> : undefined}

      <text fg={theme.muted}>
        [↑↓] provider [k] paste key [t] test [o] open key page [m] model [Enter] use
        {canClose ? '  [Esc] close' : ''}
      </text>
    </box>
  );
};
