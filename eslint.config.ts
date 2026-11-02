import { zyplux } from '@zyplux/eslint-config';
import { defineConfig } from 'eslint/config';

export default defineConfig(
  ...zyplux({
    ignores: ['reference_clones/**', '**/.tsbuild/**', 'packages/sandbox/**/target/**'],
    react: {
      dom: [
        'apps/web/src/**/*.{ts,tsx}',
        'packages/view/src/**/*.{ts,tsx}',
        'tests/view/**/*.{ts,tsx}',
        'tests/web/**/*.{ts,tsx}',
      ],
      opentui: ['apps/tui/src/**/*.{ts,tsx}', 'tests/tui/**/*.{ts,tsx}'],
    },
    reactVersion: '19.0',
    testApis: {
      'tests/core/stories/**/*.test.{ts,tsx}': 'tests/core/fixtures.ts',
      'tests/protocol/stories/**/*.test.{ts,tsx}': 'tests/protocol/fixtures.ts',
      'tests/runtime/stories/**/*.test.{ts,tsx}': 'tests/runtime/fixtures.ts',
      'tests/safety/stories/**/*.test.{ts,tsx}': 'tests/safety/fixtures.ts',
      'tests/sandbox/stories/**/*.test.{ts,tsx}': 'tests/sandbox/fixtures.ts',
      'tests/tools/stories/**/*.test.{ts,tsx}': 'tests/tools/fixtures.ts',
      'tests/tui/stories/**/*.test.{ts,tsx}': 'tests/tui/fixtures.ts',
      'tests/view/stories/**/*.test.{ts,tsx}': 'tests/view/fixtures.ts',
      'tests/web/stories/**/*.test.{ts,tsx}': 'tests/web/fixtures.ts',
    },
    tsconfigRootDir: import.meta.dirname,
  }),
  {
    files: ['tests/{tui,web}/stories/**/*.test.ts'],
    rules: {
      'vitest/expect-expect': [
        'error',
        { assertFunctionNames: ['expect', 'expect*', 'fixture.expect*', 'scene.assert.*'] },
      ],
    },
  },
  {
    settings: {
      vitest: { vitestImports: ['vitest', /^#(?:core|protocol|runtime|safety|sandbox|tools|view|tui|web)$/] },
    },
  },
);
