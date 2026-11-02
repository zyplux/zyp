import { theme, useStatusBar } from '@totvibe/view';

export const StatusBar = () => {
  const { agentStatus, connectionColor, connectionLabel, cwd, sandboxColor, sandboxLabel } = useStatusBar();

  return (
    <div className="status-bar">
      <span style={{ color: theme.brand }}>totvibe</span>
      <span style={{ color: connectionColor }}>{connectionLabel}</span>
      <span style={{ color: sandboxColor }}>{sandboxLabel}</span>
      <span style={{ color: theme.muted }}>{cwd}</span>
      <span style={{ color: theme.highlight }}>{agentStatus}</span>
      <span style={{ color: theme.muted }}>/provider to connect</span>
    </div>
  );
};
