import type { UserConfig } from 'tsdown'

const CLIENT_ID = '@dsh-external/dsh-side-chat'

const sharedExternals = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  '@deepseek-ai/dsh-client-runtime',
  '@deepseek-ai/dsh-client-runtime/client',
  '@deepseek-ai/dsh-client-connection',
  '@deepseek-ai/dsh-client-connection/client',
  '@deepseek-ai/dsh-client-ui-primitives',
  'dsh-better-sidebar',
]

const hostConfig: UserConfig = {
  entry: { index: 'src/index.ts' },
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2023',
  fixedExtension: false,
  dts: false,
  clean: true,
}

const clientConfig: UserConfig = {
  entry: { client: 'src/client/index.tsx' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  target: 'es2020',
  external: sharedExternals,
  dts: false,
  clean: false,
  outputOptions: {
    entryFileNames: 'client.js',
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(CLIENT_ID)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
    codeSplitting: false,
  },
}

export default [hostConfig, clientConfig] satisfies UserConfig[]
