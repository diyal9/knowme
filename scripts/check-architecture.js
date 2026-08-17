'use strict'

/**
 * Runtime architecture gate: layering bans, plus file size.
 * Single responsibility first. 1200 lines is a size hint (warn); 2000 is "too large" (fail).
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const SRC = path.join(ROOT, 'src')
const ADVISORY_TS_LINES = 1200
const HUGE_TS_LINES = 2000
const ALLOW_HTML = new Set(['attention-toast.html'])
const OVERSIZE = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'architecture-lib-oversize.json'), 'utf8'),
)
let errors = 0

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    if (name === 'node_modules' || name === 'dist') continue
    if (fs.statSync(p).isDirectory()) walk(p, acc)
    else acc.push(p)
  }
  return acc
}

for (const file of walk(path.join(SRC, 'lib'))) {
  if (file.endsWith('.js')) {
    console.error(`ERROR: src/lib must be TypeScript: ${path.relative(ROOT, file).replace(/\\/g, '/')}`)
    errors++
  }
}

for (const file of walk(SRC)) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/')
  const base = path.basename(file)
  if (rel.startsWith('src/') && file.endsWith('.html') && !ALLOW_HTML.has(base) && path.dirname(file) === SRC) {
    console.error(`ERROR: page html not allowed: ${rel}`)
    errors++
  }
  if (/\.(ts|tsx)$/.test(file) && rel.startsWith('src/')) {
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).length
    const grandfathered = Object.prototype.hasOwnProperty.call(OVERSIZE, rel)
    if (grandfathered) {
      const allowed = OVERSIZE[rel]
      if (lines > allowed) {
        console.error(`ERROR: ${rel} has ${lines} lines (grandfathered max ${allowed}; shrink, then drop from architecture-lib-oversize.json when ≤${HUGE_TS_LINES})`)
        errors++
      } else if (lines <= HUGE_TS_LINES) {
        console.error(`ERROR: ${rel} is ≤${HUGE_TS_LINES} lines; remove it from architecture-lib-oversize.json`)
        errors++
      } else if (lines > ADVISORY_TS_LINES) {
        console.warn(`WARN: ${rel} has ${lines} lines (advisory ${ADVISORY_TS_LINES}; huge cap ${allowed})`)
      }
    } else if (lines > HUGE_TS_LINES) {
      console.error(`ERROR: ${rel} has ${lines} lines (max ${HUGE_TS_LINES} without a shrinking whitelist entry)`)
      errors++
    } else if (lines > ADVISORY_TS_LINES) {
        console.warn(`WARN: ${rel} has ${lines} lines (advisory ${ADVISORY_TS_LINES}; still one responsibility?)`)
    }
  }
}

const fixtures = path.join(ROOT, 'tests', 'fixtures', 'legacy-pages')
if (fs.existsSync(fixtures)) {
  console.error('ERROR: tests/fixtures/legacy-pages must be removed')
  errors++
}

const testsDir = path.join(ROOT, 'tests')
if (fs.existsSync(testsDir)) {
  for (const name of fs.readdirSync(testsDir)) {
    if (!name.endsWith('.test.js')) continue
    const text = fs.readFileSync(path.join(testsDir, name), 'utf8')
    if (text.includes('fixtures/legacy-pages') || text.includes('fixtures\\\\legacy-pages')) {
      console.error(`ERROR: ${name} still reads tests/fixtures/legacy-pages`)
      errors++
    }
  }
}

const domainDir = path.join(SRC, 'domain')
if (fs.existsSync(domainDir)) {
  for (const file of walk(domainDir)) {
    if (!/\.(ts|js)$/.test(file)) continue
    const text = fs.readFileSync(file, 'utf8')
    if (/\b(window|document)\./.test(text) || /require\(['"]electron['"]\)/.test(text)) {
      console.error(`ERROR: domain must stay pure: ${path.relative(ROOT, file)}`)
      errors++
    }
  }
}

for (const file of walk(path.join(SRC, 'main'))) {
  if (!/\.(ts|js)$/.test(file)) continue
  const text = fs.readFileSync(file, 'utf8')
  if (text.includes('vm.runInContext') || text.includes('runMainChunks')) {
    console.error(`ERROR: main process must not use vm chunk loader: ${path.relative(ROOT, file)}`)
    errors++
  }
}

if (errors) {
  console.error(`architecture check failed: ${errors} error(s)`)
  process.exit(1)
}
console.log('architecture ok')
