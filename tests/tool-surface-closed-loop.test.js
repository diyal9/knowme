'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const fileTools = require('../src/lib/agent-file-tools')
const processTools = require('../src/lib/agent-process-tools')
const artifactTools = require('../src/lib/agent-artifact-tools')
const feishuCli = require('../src/lib/connectors/feishu-cli')
const toolDrafts = require('../src/lib/tool-drafts-store')
const os = require('os')

describe('tool-surface-closed-loop eval', () => {
  it('passes fake closed-loop scenario with 0 external writes', async () => {
    const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/agent-eval/tool-surface-closed-loop.json'), 'utf8'))
    const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-'))
    let externalWrites = 0
    const origRun = feishuCli.runLarkCli
    feishuCli.runLarkCli = async () => { externalWrites += 1; return { ok: true } }

    const fileAdapter = {
      readFile: async () => ({ ok: true, content: 'readme' }),
      rememberDraft: (d) => toolDrafts.rememberDraft(userData, d),
    }
    const { handlers: fileHandlers } = fileTools.buildFileTools(fileAdapter, { includeWrite: true })

    const spawnImpl = (cmd, args) => {
      const { EventEmitter } = require('events')
      const child = new EventEmitter()
      child.stdout = new EventEmitter()
      child.stderr = new EventEmitter()
      child.kill = () => {}
      process.nextTick(() => { child.stdout.emit('data', 'pass\n'); child.emit('close', 0) })
      return child
    }
    const { handlers: procHandlers } = processTools.buildProcessTools({ spawnImpl, resolveCwd: () => process.cwd() })
    const { handlers: artHandlers } = artifactTools.buildArtifactTools({ runId: 'eval' })

    const results = []
    try {
      for (const step of fixture.steps) {
        let r
        if (step.tool.startsWith('feishu.')) {
          const builder = step.tool === 'feishu.draft_send_message'
            ? feishuCli.buildDraftSendMessage
            : feishuCli.buildDraftWrite
          const built = builder(step.args)
          const draft = toolDrafts.rememberDraft(userData, built.draft)
          r = { ok: true, requiresApproval: true, draftId: draft.id }
        } else if (fileHandlers[step.tool]) {
          r = await fileHandlers[step.tool](step.args)
        } else if (procHandlers[step.tool]) {
          r = await procHandlers[step.tool]({ ...step.args, cwd: process.cwd() })
        } else if (artHandlers[step.tool]) {
          r = await artHandlers[step.tool](step.args)
        } else {
          r = { ok: false, code: 'missing_tool' }
        }
        results.push(r)
        if (step.expect.ok != null) assert.equal(r.ok, step.expect.ok, step.tool)
        if (step.expect.requiresApproval) assert.equal(r.requiresApproval, true, step.tool)
        if (step.expect.artifactRefs) assert.ok((r.artifactRefs || []).length >= 1, step.tool)
      }
      assert.equal(externalWrites, 0)
      assert.equal(results.length, fixture.steps.length)
    } finally {
      feishuCli.runLarkCli = origRun
    }
  })
})
