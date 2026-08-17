'use strict'

/**
 * Load src/lib TypeScript from Electron (CJS) and Node tests.
 * Resolves extensionless and `.js` specifiers to sibling `.ts` files.
 */
const fs = require('fs')
const path = require('path')
const Module = require('module')

if (global.__KNOWME_TS_REGISTERED) {
  module.exports = {}
} else {
  global.__KNOWME_TS_REGISTERED = true

  const ts = require('typescript')
  const crypto = require('crypto')
  const os = require('os')
  const cacheDir = path.join(os.tmpdir(), 'knowme-ts-cache')
  try { fs.mkdirSync(cacheDir, { recursive: true }) } catch { /* ignore */ }

  function transpile(filename) {
    const source = fs.readFileSync(filename, 'utf8')
    const stat = fs.statSync(filename)
    const key = crypto.createHash('sha1').update(`${filename}|${stat.mtimeMs}|${stat.size}`).digest('hex')
    const cached = path.join(cacheDir, key + '.js')
    try {
      if (fs.existsSync(cached)) return fs.readFileSync(cached, 'utf8')
    } catch { /* miss */ }
    const { outputText } = ts.transpileModule(source, {
      fileName: filename,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
        skipLibCheck: true,
        isolatedModules: true,
      },
    })
    try { fs.writeFileSync(cached, outputText) } catch { /* ignore cache write */ }
    return outputText
  }

  Module._extensions['.ts'] = function registerTs(mod, filename) {
    mod._compile(transpile(filename), filename)
  }

  function existingFile(candidate) {
    try {
      return fs.existsSync(candidate) && fs.statSync(candidate).isFile() ? candidate : ''
    } catch {
      return ''
    }
  }

  const origResolve = Module._resolveFilename
  Module._resolveFilename = function resolveTs(request, parent, isMain, options) {
    try {
      const resolved = origResolve.call(this, request, parent, isMain, options)
      if (resolved.endsWith('.js')) {
        const asTs = existingFile(resolved.slice(0, -3) + '.ts')
        if (asTs) return asTs
        if (!fs.existsSync(resolved)) {
          const mapped = existingFile(resolved.slice(0, -3) + '.ts')
          if (mapped) return mapped
        }
      }
      return resolved
    } catch (err) {
      const fromDir = parent && parent.filename ? path.dirname(parent.filename) : process.cwd()
      const abs = path.isAbsolute(request) ? request : path.resolve(fromDir, request)
      const candidates = []
      if (request.endsWith('.js')) candidates.push(abs.slice(0, -3) + '.ts')
      if (!path.extname(request) || request.endsWith('.js')) {
        candidates.push(abs + '.ts')
        candidates.push(path.join(abs, 'index.ts'))
      }
      for (const candidate of candidates) {
        const hit = existingFile(candidate)
        if (hit) return hit
      }
      throw err
    }
  }

  module.exports = {}
}
