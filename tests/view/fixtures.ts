import type { ServerEvent } from '@totvibe/protocol';
export type SessionInfo = Extract<ServerEvent, { type: 'init' }>['session'];
import type { SandboxStatus } from '@totvibe/sandbox/interfaces';

import { renderHook } from '@testing-library/react';
import { DEFAULT_PROVIDER } from '@totvibe/protocol';
import {
  agentStatusAtom,
  applyServerEvent,
  connectedProvidersAtom,
  connectionStatusAtom,
  cwdAtom,
  formatConnectionSuffix,
  formatSandboxLabel,
  formatToolInput,
  messagesAtom,
  modelIdAtom,
  noticeAtom,
  pendingApprovalAtom,
  pickConnectionColor,
  pickConnectionSymbol,
  pickSandboxColor,
  providerAtom,
  providerDialogOpenAtom,
  providerNameAtom,
  sandboxStatusAtom,
  streamingAtom,
  theme,
} from '@totvibe/view';
import { type AgentController, ControllerContext, useController } from '@totvibe/view';
import { createStore } from 'jotai';
import { createElement, type ReactNode } from 'react';
import { test as base } from 'vitest';

const makeStore = () => createStore();

const makeSandboxStatus = (overrides: Partial<SandboxStatus> = {}) =>
  ({
    available: true,
    degraded: false,
    enabled: true,
    hasLandlock: true,
    net: 'none',
    ...overrides,
  }) satisfies SandboxStatus;

const stubController: AgentController = {
  cancel: () => void 0,
  openKeyPage: () => void 0,
  resolveApproval: () => void 0,
  saveApiKey: () => void 0,
  selectProvider: () => void 0,
  submit: () => void 0,
  testConnection: () => void 0,
};

type WrapperProps = {
  children: ReactNode;
};

const renderUseController = (controller?: AgentController) =>
  renderHook(() => useController(), {
    wrapper: controller
      ? ({ children }: WrapperProps) => createElement(ControllerContext, { value: controller }, children)
      : undefined,
  });

const view = {
  agentStatusAtom,
  applyServerEvent,
  connectedProvidersAtom,
  connectionStatusAtom,
  cwdAtom,
  DEFAULT_PROVIDER,
  formatConnectionSuffix,
  formatSandboxLabel,
  formatToolInput,
  makeSandboxStatus,
  makeStore,
  messagesAtom,
  modelIdAtom,
  noticeAtom,
  pendingApprovalAtom,
  pickConnectionColor,
  pickConnectionSymbol,
  pickSandboxColor,
  providerAtom,
  providerDialogOpenAtom,
  providerNameAtom,
  renderUseController,
  sandboxStatusAtom,
  streamingAtom,
  stubController,
  theme,
};
export const test = base.extend<{ view: typeof view }>({
  view: async ({}, provide) => {
    await provide(view);
  },
});
