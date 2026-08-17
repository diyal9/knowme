'use strict'
const fs = require('fs')
const path = require('path')
const dir = path.join('src/main/modules')
const dest = path.join('src/main')

function scanDepth(line) {
  let depth = 0
  let inSingle = false
  let inDouble = false
  let inTemplate = false
  let inLine = false
  let inBlock = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    const next = line[i + 1]
    if (inLine) continue
    if (inBlock) {
      if (ch === '*' && next === '/') {
        inBlock = false
        i++
      }
      continue
    }
    if (inSingle) {
      if (ch === '\\') { i++; continue }
      if (ch === "'") inSingle = false
      continue
    }
    if (inDouble) {
      if (ch === '\\') { i++; continue }
      if (ch === '"') inDouble = false
      continue
    }
    if (inTemplate) {
      if (ch === '\\') { i++; continue }
      if (ch === '`') inTemplate = false
      continue
    }
    if (ch === '/' && next === '/') { inLine = true; continue }
    if (ch === '/' && next === '*') { inBlock = true; i++; continue }
    if (ch === "'") { inSingle = true; continue }
    if (ch === '"') { inDouble = true; continue }
    if (ch === '`') { inTemplate = true; continue }
    if (ch === '{') depth++
    if (ch === '}') depth--
  }
  return depth
}

function splitFile(text, max) {
  const lines = text.split(/\r?\n/)
  const chunks = []
  let buf = []
  let depth = 0
  for (const line of lines) {
    buf.push(line)
    depth += scanDepth(line)
    if (depth < 0) depth = 0
    if (depth === 0 && buf.length >= max) {
      chunks.push(buf.join('\n'))
      buf = []
    }
  }
  if (buf.length) chunks.push(buf.join('\n'))
  return chunks
}

let n = 0
const files = fs.readdirSync(dir).filter(f => f.startsWith('part-') && f.endsWith('.ts')).sort()
const written = []
for (const f of files) {
  let text = fs.readFileSync(path.join(dir, f), 'utf8')
  if (text.trim().split(/\n/).length <= 4) continue
  text = text.replace("const scope = require('../scope')", "const scope = require('./scope')")
  const parts = splitFile(text, 360)
  for (const part of parts) {
    n++
    const name = `part-${String(n).padStart(2, '0')}.ts`
    const body = part.includes("require('./scope')")
      ? part
      : "'use strict'\nconst scope = require('./scope')\n" + part
    fs.writeFileSync(path.join(dest, name), body.endsWith('\n') ? body : body + '\n')
    written.push(name)
    console.log(name, body.split(/\n/).length)
  }
}

let ipc = fs.readFileSync('src/main/ipc-bind.ts', 'utf8')
ipc = ipc.replace(/^\s+scope\.(\w+):/gm, '    $1:')
fs.writeFileSync('src/main/ipc-bind.ts', ipc)
fs.writeFileSync('src/main/module-list.json', JSON.stringify(written, null, 2))
console.log('done', written.length)
