'use strict'
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')
const SRC = path.join(ROOT, 'src')
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

for (const dir of ['lib', 'main', 'ipc']) {
  for (const file of walk(path.join(SRC, dir))) {
    if (!/\.(ts|tsx|js)$/.test(file)) continue
    const text = fs.readFileSync(file, 'utf8')
    if (/@ts-nocheck/.test(text)) {
      console.error(`ERROR: @ts-nocheck forbidden: ${path.relative(ROOT, file).replace(/\\/g, '/')}`)
      errors++
    }
  }
}

if (errors) {
  console.error(`nocheck check failed: ${errors}`)
  process.exit(1)
}
console.log('nocheck check ok')
