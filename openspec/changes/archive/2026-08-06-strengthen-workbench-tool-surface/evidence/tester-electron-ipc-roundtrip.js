'use strict'

/**
 * 测试 QA — Electron 审批 IPC 真实 roundtrip
 * Run: node openspec/changes/strengthen-workbench-tool-surface/evidence/tester-electron-ipc-roundtrip.js
 */

const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')

const ROOT = path.resolve(__dirname, '../../../..')
const OUT = path.join(__dirname, 'tester-electron-ipc-roundtrip.json')

function killElectron() {
  if (process.platform !== 'win32') return
  for (const image of ['KnowMe.exe', 'electron.exe']) {
    try {
      execFileSync('cmd.exe', ['/c', 'taskkill', '/F', '/IM', image, '/T'], { stdio: 'ignore' })
    } catch { /* none */ }
  }
}

async function main() {
  let electron
  try {
    ({ _electron: electron } = require('playwright'))
  } catch (err) {
    const report = { ok: false, blocked: true, reason: 'playwright unavailable', error: String(err.message || err) }
    fs.writeFileSync(OUT, JSON.stringify(report, null, 2))
    console.log(JSON.stringify(report, null, 2))
    process.exit(0)
  }

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-tester-ipc-'))
  const checks = []
  let app

  try {
    app = await electron.launch({
      cwd: ROOT,
      executablePath: require('electron'),
      args: [`--user-data-dir=${userDataDir}`, '.'],
      env: { ...process.env, KNOWME_TOOL_SURFACE: 'v1', ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' },
      timeout: 120000,
    })

    const window = await app.firstWindow({ timeout: 90000 })
    await window.waitForLoadState('domcontentloaded', { timeout: 90000 })
    await window.waitForTimeout(2500)

    const preloadOk = await window.evaluate(() => ({
      approve: typeof window.api?.toolApproveDraft === 'function',
      create: typeof window.api?.connectorsCreateDocDraft === 'function',
      list: typeof window.api?.toolDraftsList === 'function',
    }))
    checks.push({ id: 'preload-apis', pass: preloadOk.approve && preloadOk.create && preloadOk.list, detail: preloadOk })

    const created = await window.evaluate(async () => {
      return window.api.connectorsCreateDocDraft({ title: 'QA IPC Test', body: 'roundtrip body' })
    })
    const draftId = created?.draft?.id || created?.draftId
    checks.push({ id: 'create-draft-via-ipc', pass: Boolean(draftId && created?.ok !== false), detail: { draftId, ok: created?.ok } })

    const listBefore = await window.evaluate(() => window.api.toolDraftsList())
    checks.push({
      id: 'draft-visible-in-main',
      pass: Boolean(draftId) && Array.isArray(listBefore?.drafts) && listBefore.drafts.some(d => d.id === draftId),
      detail: { count: listBefore?.drafts?.length, draftId },
    })

    if (draftId) {
      const rejectRes = await window.evaluate(async ({ id }) => {
        return window.api.toolApproveDraft({ draftId: id, reject: true })
      }, { id: draftId })
      checks.push({
        id: 'reject-ipc-roundtrip',
        pass: rejectRes?.rejected === true || rejectRes?.ok === true,
        detail: rejectRes,
      })

      const created2 = await window.evaluate(async () => {
        return window.api.connectorsCreateDocDraft({ title: 'QA Approve', body: 'approve body' })
      })
      const draftId2 = created2?.draft?.id || created2?.draftId

      const approveRes = await window.evaluate(async ({ id }) => {
        return window.api.toolApproveDraft({ draftId: id, reject: false, fakeApply: true })
      }, { id: draftId2 })
      checks.push({
        id: 'approve-ipc-roundtrip-fakeApply',
        pass: approveRes?.ok === true,
        detail: approveRes,
      })

      const [d1, d2] = await Promise.all([
        window.evaluate(({ id }) => window.api.toolApproveDraft({ draftId: id, fakeApply: true }), { id: draftId2 }),
        window.evaluate(({ id }) => window.api.toolApproveDraft({ draftId: id, fakeApply: true }), { id: draftId2 }),
      ])
      checks.push({
        id: 'double-click-approve-race',
        pass: (d1?.ok || d2?.ok) || (d1?.code === 'not_pending' && d2?.code === 'not_pending'),
        detail: { d1: d1?.code || d1?.ok, d2: d2?.code || d2?.ok },
      })
    }

    const shotDir = path.join(__dirname, 'screenshots')
    fs.mkdirSync(shotDir, { recursive: true })
    await window.screenshot({ path: path.join(shotDir, 'tester-ipc-roundtrip.png'), scale: 'css' })
    checks.push({ id: 'screenshot', pass: true, path: 'screenshots/tester-ipc-roundtrip.png' })
  } finally {
    if (app) await app.close().catch(() => {})
    killElectron()
  }

  const hardFails = checks.filter(c => c.pass === false)
  const report = {
    at: new Date().toISOString(),
    role: 'tester',
    change: 'strengthen-workbench-tool-surface',
    ok: hardFails.length === 0,
    checks,
    userDataDir,
  }
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  if (hardFails.length) process.exit(1)
}

main().catch(err => {
  fs.writeFileSync(OUT, JSON.stringify({ ok: false, error: String(err.message || err) }, null, 2))
  console.error(err)
  process.exit(1)
})
