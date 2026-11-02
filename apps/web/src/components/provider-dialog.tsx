import { PROVIDERS } from '@totvibe/protocol';
import { theme, useProviderDialog } from '@totvibe/view';
import { useState } from 'react';

export const ProviderDialog = () => {
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
  const [keyValue, setKeyValue] = useState('');
  const [modelValue, setModelValue] = useState('');

  const saveApiKey = () => {
    const apiKey = keyValue.trim();
    if (!apiKey) return;
    controller.saveApiKey(highlightedProvider.name, apiKey);
    setKeyValue('');
  };

  return (
    <div className="dialog" style={{ borderColor: theme.brand }}>
      <div style={{ color: theme.brand }}>Connect a provider · switch model</div>

      <div className="provider-list">
        {PROVIDERS.map((provider, providerIndex) => (
          <button
            className={`provider-row${providerIndex === highlightedIndex ? ' highlighted' : ''}`}
            key={provider.name}
            onClick={() => {
              setHighlightedIndex(providerIndex);
            }}
            style={{ color: providerIndex === highlightedIndex ? theme.text : theme.muted }}
            type="button"
          >
            {isConnected(provider) ? '●' : '○'} {provider.label} · {resolveModelId(provider)}
          </button>
        ))}
      </div>

      <div style={{ color: isConnected(highlightedProvider) ? theme.ok : theme.warn }}>
        {isConnected(highlightedProvider)
          ? `Connected via ${highlightedProvider.apiKeyEnv}`
          : `Not connected — needs ${highlightedProvider.apiKeyEnv}. ${highlightedProvider.keyHint}`}
      </div>

      <div className="field">
        <span style={{ color: theme.muted }}>API key</span>
        <input
          onChange={event => {
            setKeyValue(event.target.value);
          }}
          onKeyDown={event => {
            if (event.key === 'Enter') saveApiKey();
          }}
          placeholder={`paste ${highlightedProvider.apiKeyEnv}`}
          type="password"
          value={keyValue}
        />
        <button onClick={saveApiKey} type="button">
          Save
        </button>
      </div>

      <div className="field">
        <span style={{ color: theme.muted }}>Model</span>
        <input
          onChange={event => {
            setModelValue(event.target.value);
          }}
          onKeyDown={event => {
            if (event.key === 'Enter') activateProvider(modelValue.trim() || resolveModelId(highlightedProvider));
          }}
          placeholder={resolveModelId(highlightedProvider)}
          value={modelValue}
        />
        <button
          onClick={() => {
            activateProvider(modelValue.trim() || resolveModelId(highlightedProvider));
          }}
          type="button"
        >
          Use
        </button>
      </div>

      <div className="field">
        <button
          onClick={() => {
            controller.testConnection(highlightedProvider.name);
          }}
          type="button"
        >
          Test
        </button>
        <button
          onClick={() => {
            controller.openKeyPage(highlightedProvider.keyUrl);
            setNotice(`Opening ${highlightedProvider.keyUrl}`);
          }}
          type="button"
        >
          Open key page
        </button>
        {canClose && (
          <button
            onClick={() => {
              setProviderDialogOpen(false);
            }}
            type="button"
          >
            Close
          </button>
        )}
      </div>

      {notice ? <div style={{ color: theme.highlight }}>{notice}</div> : undefined}
    </div>
  );
};
