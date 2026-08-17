'use strict'

/**
 * Test-seam fixture stream IPC (KNOWME_AGENT_OUTPUT_FIXTURE=1 only).
 */
function registerAgentOutputFixtureIpc(ipcMain) {
  if (process.env.KNOWME_AGENT_OUTPUT_FIXTURE !== '1') return
  const { validateFixtureRunPayload } = require('../lib/agent-output-fixture-handler')

  ipcMain.handle('agent-output-fixture-run', async (e, payload = {}) => {
    const parsed = validateFixtureRunPayload(payload)
    if (!parsed.ok) return { ok: false, error: parsed.error }
    const webContents = e.sender
    if (webContents.isDestroyed()) return { ok: false, error: 'web_contents_destroyed' }
    const sessionId = payload.sessionId != null ? String(payload.sessionId) : null
    for (const event of parsed.events) {
      if (webContents.isDestroyed()) return { ok: false, error: 'web_contents_destroyed' }
      webContents.send('ai-stream-event', { runId: parsed.runId, sessionId, ...event })
    }
    return { ok: true, runId: parsed.runId, sent: parsed.events.length }
  })
}

module.exports = { registerAgentOutputFixtureIpc }
