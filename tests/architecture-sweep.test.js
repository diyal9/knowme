'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')

test('ai-generate no longer contains the legacy executor loop', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'ipc', 'ai-generate.ts'), 'utf8')
  const exec = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'agent-generate-execute.ts'), 'utf8')
  assert.equal(src.includes('legacy-ai-generate-loop'), false)
  assert.equal(exec.includes("legacy agent executor is no longer supported"), true)
  assert.equal(src.includes("ipcMain.handle('ai-generate'"), true)
})

test('file budget treats 1200 as advisory and 2000 as huge', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'check-architecture.js'), 'utf8')
  assert.equal(src.includes('ADVISORY_TS_LINES = 1200'), true)
  assert.equal(src.includes('HUGE_TS_LINES = 2000'), true)
})

test('main index does not use vm chunk loader', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'main', 'index.ts'), 'utf8')
  assert.equal(src.includes('vm.runInContext'), false)
  assert.equal(src.includes("require('./ipc-deps')"), true)
  assert.equal(src.includes("require('./scope')"), false)
})
