import type { ToolRisk } from '@totvibe/core/index';

export type ApprovalDecision = 'allow' | 'approved' | 'denied' | 'deny' | 'timeout';

export type ApprovalRequest = {
  command?: string;
  input: unknown;
  name: string;
  risk: ToolRisk;
};

export type PolicyDecisionRecord = {
  absolute: boolean;
  decision: ApprovalDecision;
  input: unknown;
  reason: string;
  risk: ToolRisk;
  time: string;
  tool: string;
};
