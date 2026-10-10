import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { tamaguiAliases, tamaguiPlugin } from '@tamagui/vite-plugin'
import { mergeConfig, type Plugin } from 'vite'

import type { StorybookConfig } from '@storybook/react-vite'

const dirname = path.dirname(fileURLToPath(import.meta.url))

// vite 8 injects react-refresh wrappers into modules but storybook 8's iframe
// html never gets the matching preamble (fixed in storybook 9+).
const reactRefreshPreamblePlugin = (): Plugin => ({
  name: 'storybook-react-refresh-preamble',
  apply: 'serve',
  transformIndexHtml: {
    order: 'pre',
    handler() {
      return [
        {
          tag: 'script',
          attrs: { type: 'module' },
          children: `
import RefreshRuntime from '/@react-refresh'
RefreshRuntime.injectIntoGlobalHook(window)
window.$RefreshReg$ = () => {}
window.$RefreshSig$ = () => (type) => type
`,
          injectTo: 'head-prepend',
        },
      ]
    },
  },
})

const config: StorybookConfig = {
  stories: ['../src/interface/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-essentials', '@storybook/addon-links'],
  framework: '@storybook/react-vite',
  async viteFinal(viteConfig) {
    return mergeConfig(viteConfig, {
      resolve: {
        alias: [
          { find: '~', replacement: path.resolve(dirname, '../src') },
          ...tamaguiAliases({
            rnwLite: 'without-animated',
            svg: true,
          }),
        ],
      },
      plugins: [reactRefreshPreamblePlugin(), tamaguiPlugin({ disable: true })],
      define: {
        'process.env.TAMAGUI_TARGET': JSON.stringify('web'),
      },
      optimizeDeps: {
        exclude: ['oxc-parser'],
      },
    })
  },
}

export default config
