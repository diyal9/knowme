'use strict'

/**
 * Electron smoke: resolver + IPC seam + browser block (unit-level, no live Electron).
 * Run: node openspec/changes/harden-workbench-tool-surface-runtime/evidence/harden-tool-surface-electron-smoke.js
 */

const fs = require('fs')
const path = require('path')
const os = require('os')
const builder = require('../../../../src/lib/tool-surface-builder')
const browserMcp = require('../../../../src/lib/browser-mcp-adapter')
const testSeam = require('../../../../src/lib/test-seam')

const OUT = path.join(__dirname, 'harden-tool-surface-electron-smoke.json')

async function main() {
  const prev = process.env.KNOWME_TOOL_SURFACE
  process.env.KNOWME_TOOL_SURFACE = 'v1'
  const resolved = await builder.resolveToolSurfaceForRun({
    userData: os.tmpdir(),
    runId: 'smoke_run',
    fileAdapter: {},
    extraTools: null,
  })
  const blocked = await browserMcp.buildBrowserMcpAdapter({
    callMcpTool: async () => ({ ok: true }),
    requireHostConfirm: true,
  }).handlers.browser_navigate({ url: 'http://127.0.0.1:8080' })
  const stripped = testSeam.stripTestKeysFromPayload({ fakeApply: true, draftId: 'd1' })
  if (prev == null) delete process.env.KNOWME_TOOL_SURFACE
  else process.env.KNOWME_TOOL_SURFACE = prev

  const payload = {
    ok: resolved.mode === 'v1' && !!resolved.registry && blocked.code === 'scope_denied' && stripped.fakeApply === undefined,
    mode: resolved.mode,
    toolCount: resolved.surface.getToolDefinitions().length,
    blockedCode: blocked.code,
    at: new Date().toISOString(),
  }
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2), 'utf8')
  console.log(JSON.stringify(payload, null, 2))
  process.exit(payload.ok ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
