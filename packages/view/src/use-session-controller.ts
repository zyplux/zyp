import { createStore } from 'jotai';
import { useEffect, useState } from 'react';

import type { AgentController } from './controller';
import type { Store } from './state/store';

type ControllerFactory = (store: Store) => { controller: AgentController; start: () => void };

export const useSessionController = (create: ControllerFactory) => {
  const [session] = useState(() => {
    const store = createStore();
    return { ...create(store), store };
  });
  useEffect(() => {
    session.start();
  }, [session]);
  return session;
};
