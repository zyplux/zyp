import type { InitialConfig } from '@totvibe/runtime';

import { ControllerContext, useSessionController } from '@totvibe/view';
import { Provider } from 'jotai';

import { createLocalController } from './agent/create-local-controller';
import { App } from './app';

type RootProps = {
  config: InitialConfig;
};

export const Root = ({ config }: RootProps) => {
  const { controller, store } = useSessionController(store => createLocalController(config, store));

  return (
    <Provider store={store}>
      <ControllerContext value={controller}>
        <App />
      </ControllerContext>
    </Provider>
  );
};
