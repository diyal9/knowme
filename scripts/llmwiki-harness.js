'use strict'

const path = require('path')
const harness = require('../src/lib/llmwiki-harness')

function argValue(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : ''
}

function defaultRoot() {
  const appData = process.env.APPDATA || process.env.XDG_CONFIG_HOME || process.cwd()
  return path.join(appData, 'KnowMe', 'knowledge-os', 'wiki')
}

const command = process.argv[2] && !process.argv[2].startsWith('-')
  ? process.argv[2]
  : 'check'
const root = path.resolve(argValue('--root') || process.env.KNOWME_LLMWIKI_ROOT || defaultRoot())
const json = process.argv.includes('--json')

let result
if (command === 'ensure') {
  const initialized = harness.ensureRoot(root)
  result = initialized.ok ? harness.inspectRoot(root) : initialized
} else if (command === 'check') {
  result = harness.inspectRoot(root)
} else {
  result = {
    ok: false,
    code: 'unknown_command',
    error: `未知命令：${command}`,
    usage: 'node scripts/llmwiki-harness.js <check|ensure> [--root <path>] [--json]',
  }
}

if (json) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
} else if (result.ok) {
  process.stdout.write(`LLM Wiki Harness PASS\nRoot: ${root}\n`)
} else {
  process.stderr.write(`LLM Wiki Harness FAIL\n${result.error || `${result.issues?.length || 0} issue(s)`}\n`)
}

process.exitCode = result.ok ? 0 : 1
