import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import fs from 'node:fs'

const repoRoot = fs.realpathSync(path.resolve(__dirname))

export default defineConfig({
  root: repoRoot,
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': path.join(repoRoot, 'src/shared'),
      '@knowme-lib': path.join(repoRoot, 'src/lib'),
    },
  },
  server: {
    fs: { allow: [repoRoot] },
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/, /src[\\/]lib[\\/]/],
      transformMixedEsModules: true,
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/renderer/**/*.spec.tsx', 'src/domain/**/*.spec.ts'],
  },
})
