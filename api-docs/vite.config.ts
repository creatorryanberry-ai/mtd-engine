import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vite'

const root = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  root,
  base: '/docs/',
  server: {
    port: Number(process.env.VITE_PORT_API_DOCS ?? 6007),
    strictPort: true,
  },
  build: {
    outDir: resolve(root, '../dist/api-docs'),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '~': resolve(root, '../src'),
    },
  },
  optimizeDeps: {
    include: ['@scalar/api-reference', '@scalar/workspace-store/navigation'],
  },
})
