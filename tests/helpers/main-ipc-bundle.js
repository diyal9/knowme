'use strict'

const fs = require('fs')
const path = require('path')

const IPC_HOST_FILES = [
  'src/main/index.ts',
  'src/ipc/ai-generate.ts',
  'src/ipc/ai-assist.ts',
  'src/ipc/agent-output-fixture.ts',
  'src/lib/agent-generate-prepare.ts',
  'src/lib/agent-generate-tool-surface.ts',
  'src/lib/agent-generate-execute.ts',
  'src/lib/agent-generate-libs.ts',
  'src/lib/agent-generate-child-ports.ts',
]

function readMainParts() {
  const root = path.join(__dirname, '..', '..')
  const mainDir = path.join(root, 'src', 'main')
  const listPath = path.join(mainDir, 'module-list.json')
  const names = JSON.parse(fs.readFileSync(listPath, 'utf8'))
  const parts = names.map(f => fs.readFileSync(path.join(mainDir, f), 'utf8'))
  const extras = ['ipc-deps.ts'].map(f => {
    const p = path.join(mainDir, f)
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : ''
  })
  return [...parts, ...extras].join('\n\n')
}

function readMainIpcBundle(extraRelPaths = []) {
  const root = path.join(__dirname, '..', '..')
  const parts = [
    readMainParts(),
    fs.readFileSync(path.join(root, 'src', 'main', 'index.ts'), 'utf8'),
    ...IPC_HOST_FILES.slice(1).map(rel => fs.readFileSync(path.join(root, rel), 'utf8')),
    ...extraRelPaths.map(rel => fs.readFileSync(path.join(root, rel), 'utf8')),
  ]
  return parts.join('\n\n')
}

function readMainEntryBundle() {
  const root = path.join(__dirname, '..', '..')
  return [
    fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8'),
    readMainParts(),
    fs.readFileSync(path.join(root, 'src', 'main', 'index.ts'), 'utf8'),
  ].join('\n\n')
}

module.exports = {
  readMainIpcBundle,
  readMainEntryBundle,
  readMainChunks: readMainParts,
  IPC_HOST_FILES,
}
