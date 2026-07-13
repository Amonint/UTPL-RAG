import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    // Explicit alias: vite-tsconfig-paths can fail when the repo path contains spaces.
    alias: {
      '@': path.resolve(rootDir, 'src'),
    },
  },
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
})
