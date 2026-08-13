'use strict'

/**
 * Electron smoke helper (headless checks).
 * Run: node openspec/changes/strengthen-workbench-tool-surface/evidence/tool-surface-electron-smoke.js
 */
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '../../../..')
const checks = []

function check(name, ok, detail = '') {
  checks.push({ name, ok, detail })
}

const agentJs = fs.readFileSync(path.join(root, 'src/workspace-agent.js'), 'utf8')
check('approval card markup', /agent-tool-approval/.test(agentJs) && /data-draft-approve/.test(agentJs))
check('artifact cards markup', /agent-artifact-card/.test(agentJs))
check('timeline pending-review class', /pending-review/.test(agentJs))

const preload = fs.readFileSync(path.join(root, 'src/preload.js'), 'utf8')
check('preload toolApproveDraft IPC', /toolApproveDraft/.test(preload))

const main = fs.readFileSync(path.join(root, 'src/main.js'), 'utf8')
check('main tool-approve-draft handler', /tool-approve-draft/.test(main))

const failed = checks.filter(c => !c.ok)
console.log(JSON.stringify({ ok: failed.length === 0, checks }, null, 2))
process.exit(failed.length ? 1 : 0)
