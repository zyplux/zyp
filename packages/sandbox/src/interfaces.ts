export type NetPolicy = 'inherit' | 'none';

export type SandboxStatus = {
  available: boolean;
  degraded: boolean;
  enabled: boolean;
  hasLandlock: boolean;
  net: NetPolicy;
};
