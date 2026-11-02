import { CONNECTED_PROVIDER_KEYS, isolateProviderEnv, stubFetchOk } from '#fixtures/config';
import { resetModelReply, setModelReply } from '#model-mock';

export type Harness = {
  connected(): Promise<Scene>;
  connectedWithReply(reply: string): Promise<Scene>;
  unconnected(): Promise<Scene>;
};

export type RenderOptions = { connectedProviderKeys?: Record<string, string> };

export type Scene = {
  act: Act;
  assert: Assert;
  dispose(): Promise<void>;
};

type Act = {
  type(text: string): Promise<void>;
  typeAndSubmit(text: string): Promise<void>;
};

type Assert = {
  eventuallyShows(text: string): Promise<void>;
  hides(text: string): void;
  shows(text: string): void;
};

export const isolateScene = (connectedProviderKeys: Record<string, string> = {}) => {
  const restoreEnv = isolateProviderEnv(connectedProviderKeys);
  const restoreFetch = stubFetchOk();
  return () => {
    restoreFetch();
    restoreEnv();
  };
};

export const createHarness = <RenderedScene extends Scene>(
  renderScene: (options: RenderOptions) => Promise<RenderedScene>,
) => ({
  connected: () => {
    resetModelReply();
    return renderScene({ connectedProviderKeys: CONNECTED_PROVIDER_KEYS });
  },
  connectedWithReply: (reply: string) => {
    setModelReply(reply);
    return renderScene({ connectedProviderKeys: CONNECTED_PROVIDER_KEYS });
  },
  unconnected: () => {
    resetModelReply();
    return renderScene({});
  },
});
