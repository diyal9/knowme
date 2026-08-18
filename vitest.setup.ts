import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
require(path.join(path.dirname(fileURLToPath(import.meta.url)), 'scripts/register-ts.js'))

/** react-virtuoso 依赖 ResizeObserver；jsdom 默认无此 API */
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as typeof ResizeObserver
}
