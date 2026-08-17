import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
require(path.join(path.dirname(fileURLToPath(import.meta.url)), 'scripts/register-ts.js'))
