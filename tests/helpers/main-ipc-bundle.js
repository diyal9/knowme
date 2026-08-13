'use strict'

const fs = require('fs')
const path = require('path')

/** Main composition root + migrated inline IPC host modules for static contract tests. */
const IPC_HOST_FILES = [
  'src/main.js',
  'src/ipc/ai-generate.js',
  'src/ipc/ai-assist.js',
  'src/ipc/agent-output-fixture.js',
]

function readMainIpcBundle(extraRelPaths = []) {
  const root = path.join(__dirname, '..', '..')
  return [...IPC_HOST_FILES, ...extraRelPaths]
    .map(rel => fs.readFileSync(path.join(root, rel), 'utf8'))
    .join('\n\n')
}

module.exports = {
  readMainIpcBundle,
  IPC_HOST_FILES,
}
