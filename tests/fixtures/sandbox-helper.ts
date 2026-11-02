import path from 'node:path';

export const writeStubHelper = async (dir: string, script: string) => {
  const binaryPath = path.join(dir, 'totvibe-sandbox');
  await Bun.write(binaryPath, `#!/bin/sh\n${script}\n`);
  const chmod = Bun.spawn(['chmod', '+x', binaryPath]);
  await chmod.exited;
  return binaryPath;
};
