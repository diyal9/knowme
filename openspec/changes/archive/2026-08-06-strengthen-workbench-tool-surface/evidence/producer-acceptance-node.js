'use strict'

/**
 * 制作人验收 — 主进程/契约层闭环（无需 Electron UI）。
 */

const fs = require('fs')
const os = require('os')
const path = require('path')
const assert = require('assert')

const { buildFullToolSurface, isToolSurfaceV1 } = require('../../../../src/lib/tool-surface-builder')
const agentFileTools = require('../../../../src/lib/agent-file-tools')
const toolDrafts = require('../../../../src/lib/tool-drafts-store')

const OUT = __dirname
const REPORT = path.join(OUT, 'producer-acceptance-node.json')

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-producer-node-'))
}

async function main() {
  const checks = []

  // legacy flag
  const prev = process.env.KNOWME_TOOL_SURFACE
  process.env.KNOWME_TOOL_SURFACE = 'legacy'
  checks.push({ id: 'legacy-flag-off', pass: !isToolSurfaceV1() })
  const legacySurface = buildFullToolSurface({ includeWrite: true })
  const legacyNames = legacySurface.surface?.getToolDefinitions?.().map(d => d.function.name) || []
  checks.push({
    id: 'legacy-no-write-tools',
    pass: !legacyNames.includes('write_file') && !legacyNames.includes('run_task'),
    detail: legacyNames.slice(0, 20),
  })
  process.env.KNOWME_TOOL_SURFACE = 'v1'
  checks.push({ id: 'v1-flag-on', pass: isToolSurfaceV1() })
  const v1 = buildFullToolSurface({ includeWrite: true })
  const v1Names = v1.surface?.getToolDefinitions?.().map(d => d.function.name) || []
  checks.push({
    id: 'v1-has-file-write-tools',
    pass: v1Names.includes('write_file') && v1Names.includes('apply_patch'),
    detail: v1Names,
  })
  const agentProcessTools = require('../../../../src/lib/agent-process-tools')
  const proc = agentProcessTools.buildProcessTools({ spawn: () => ({ pid: 1, kill: () => {} }) })
  checks.push({
    id: 'process-tools-exported',
    pass: proc.definitions.some(d => d.function.name === 'run_task'),
  })
  if (prev === undefined) delete process.env.KNOWME_TOOL_SURFACE
  else process.env.KNOWME_TOOL_SURFACE = prev

  // file draft reject → no write
  const root = tmpDir()
  const target = path.join(root, 'sample.txt')
  fs.writeFileSync(target, 'before\n', 'utf8')
  const beforeHash = fs.readFileSync(target, 'utf8')
  const userData = tmpDir()
  const { handlers } = agentFileTools.buildFileTools({
    readFile: async (rel) => {
      const p = path.join(root, rel)
      if (!fs.existsSync(p)) return { ok: false, error: 'missing' }
      return { ok: true, content: fs.readFileSync(p, 'utf8') }
    },
    writeFile: async (rel, c) => { fs.writeFileSync(path.join(root, rel), c, 'utf8'); return { ok: true } },
    listDir: async () => ({ ok: true, nodes: [] }),
    grep: async () => ({ ok: true, matches: [] }),
    rememberDraft: (d) => toolDrafts.rememberDraft(userData, d),
  }, { includeWrite: true })
  const writeRes = await handlers.write_file({ path: 'sample.txt', content: 'after\n' }, { runId: 'producer-run' })
  checks.push({ id: 'write-creates-draft', pass: Boolean(writeRes.ok && writeRes.code === 'approval_required' && writeRes.draftId) })
  const afterDraftHash = fs.readFileSync(target, 'utf8')
  checks.push({ id: 'reject-no-side-effect', pass: afterDraftHash === beforeHash })

  const rejectRes = toolDrafts.rejectDraft(userData, writeRes.draftId)
  checks.push({ id: 'reject-draft-ok', pass: rejectRes?.status === 'rejected' })

  // traversal readable error
  const trav = await handlers.write_file({ path: '../escape.txt', content: 'x' }, { runId: 'producer-run' })
  checks.push({
    id: 'traversal-user-error',
    pass: !trav.ok && /scope_denied|traversal|范围|路径/i.test(String(trav.text || trav.code || '')),
    detail: trav,
  })

  const report = {
    at: new Date().toISOString(),
    role: 'producer',
    ok: checks.every(c => c.pass),
    checks,
  }
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  assert.ok(report.ok, 'producer node acceptance failed')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
