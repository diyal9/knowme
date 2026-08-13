import path from 'node:path'
import fs from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const repoRoot = path.resolve(__dirname)
const srcDir = path.join(repoRoot, 'src')
const rendererRoot = path.join(srcDir, 'renderer')

function legacySrcPlugin() {
  return {
    name: 'knowme-legacy-src',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: () => void) => {
        const url = req.url || ''
        if (!url.startsWith('/@legacy/')) return next()
        const rel = decodeURIComponent(url.slice('/@legacy/'.length).split('?')[0])
        const file = path.normalize(path.join(srcDir, rel))
        if (!file.startsWith(srcDir) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
          res.statusCode = 404
          res.end('Not found')
          return
        }
        const ext = path.extname(file).toLowerCase()
        const types: Record<string, string> = {
          '.html': 'text/html; charset=utf-8',
          '.js': 'text/javascript; charset=utf-8',
          '.css': 'text/css; charset=utf-8',
          '.svg': 'image/svg+xml',
          '.png': 'image/png',
          '.json': 'application/json',
          '.ico': 'image/x-icon',
        }
        res.setHeader('Content-Type', types[ext] || 'application/octet-stream')
        fs.createReadStream(file).pipe(res)
      })
    },
  }
}

function copyLegacyOnBuild() {
  return {
    name: 'knowme-copy-legacy-on-build',
    closeBundle() {
      const dest = path.join(repoRoot, 'dist', 'renderer', 'legacy')
      fs.mkdirSync(dest, { recursive: true })
      const skip = new Set(['renderer', 'ipc', 'main.js', 'preload.js'])
      for (const name of fs.readdirSync(srcDir)) {
        if (skip.has(name)) continue
        const from = path.join(srcDir, name)
        const to = path.join(dest, name)
        fs.cpSync(from, to, { recursive: true })
      }
      console.log('vite: copied legacy renderer assets -> dist/renderer/legacy')
    },
  }
}

export default defineConfig({
  root: rendererRoot,
  base: './',
  plugins: [react(), legacySrcPlugin(), copyLegacyOnBuild()],
  resolve: {
    alias: {
      '@shared': path.join(srcDir, 'shared'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: path.join(repoRoot, 'dist', 'renderer'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        workspace: path.join(rendererRoot, 'workspace', 'index.html'),
        settings: path.join(rendererRoot, 'settings', 'index.html'),
        list: path.join(rendererRoot, 'list', 'index.html'),
        memory: path.join(rendererRoot, 'memory', 'index.html'),
        note: path.join(rendererRoot, 'note', 'index.html'),
        'log-viewer': path.join(rendererRoot, 'log-viewer', 'index.html'),
      },
    },
  },
})
