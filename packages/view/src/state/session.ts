import type { ApprovalRequest } from '@totvibe/safety/interfaces';
import type { SandboxStatus } from '@totvibe/sandbox/interfaces';

import { atom } from 'jotai';

export const streamingAtom = atom(false);
export const agentStatusAtom = atom('ready');
export const pendingApprovalAtom = atom<ApprovalRequest | undefined>();
export const sandboxStatusAtom = atom<SandboxStatus | undefined>();
export const cwdAtom = atom('');
