import { type AgentController, ControllerContext, type Store, useSessionController } from '@totvibe/view';
import { Provider } from 'jotai';

import { App } from './app';
import { createSocketController } from './create-socket-controller';

type RootProps = {
  create?: (store: Store) => { controller: AgentController; start: () => void };
};

export const Root = ({ create = createSocketController }: RootProps) => {
  const { controller, store } = useSessionController(create);

  return (
    <Provider store={store}>
      <ControllerContext value={controller}>
        <App />
      </ControllerContext>
    </Provider>
  );
};
