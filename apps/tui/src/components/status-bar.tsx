import { theme, useStatusBar } from '@totvibe/view';

export const StatusBar = () => {
  const { agentStatus, connectionColor, connectionLabel, cwd, sandboxColor, sandboxLabel } = useStatusBar();

  return (
    <box style={{ flexDirection: 'row', gap: 2, padding: 1 }}>
      <text fg={theme.brand}>totvibe</text>
      <text fg={connectionColor}>{connectionLabel}</text>
      <text fg={sandboxColor}>{sandboxLabel}</text>
      <text fg={theme.muted}>{cwd}</text>
      <text fg={theme.highlight}>{agentStatus}</text>
      <text fg={theme.muted}>/provider to connect</text>
    </box>
  );
};
