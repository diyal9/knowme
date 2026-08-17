import path from 'node:path'
import fs from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const repoRoot = fs.realpathSync(path.resolve(__dirname))
if (fs.realpathSync(process.cwd()) !== repoRoot) process.chdir(repoRoot)
const srcDir = path.join(repoRoot, 'src')
const rendererRoot = path.join(srcDir, 'renderer')

export default defineConfig({
  root: rendererRoot,
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': path.join(srcDir, 'shared'),
      '@knowme-lib': path.join(srcDir, 'lib'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    fs: { allow: [repoRoot] },
  },
  build: {
    outDir: path.join(repoRoot, 'dist', 'renderer'),
    emptyOutDir: true,
    commonjsOptions: {
      include: [/node_modules/, /src[\\/]lib[\\/]/],
      transformMixedEsModules: true,
    },
    rollupOptions: {
      treeshake: {
        // ui-icons.js registers window.KnowMeIcons via IIFE side effect only.
        moduleSideEffects: (id) => /ui-icons\.js/.test(id),
      },
      input: {
        workspace: path.join(rendererRoot, 'workspace', 'index.html'),
        settings: path.join(rendererRoot, 'settings', 'index.html'),
        memory: path.join(rendererRoot, 'memory', 'index.html'),
        'log-viewer': path.join(rendererRoot, 'log-viewer', 'index.html'),
      },
    },
  },
})
