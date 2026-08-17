'use strict'

require('./register-ts')
const fs = require('fs')
const path = require('path')
const os = require('os')
const { execFileSync } = require('child_process')
const { createConnectorsApi } = require('../src/lib/connectors')
const { probeFeishuStatus } = require('../src/lib/connectors/feishu-status')

const OUT = process.env.GAME_STUDIO_EVIDENCE
  ? path.resolve(process.env.GAME_STUDIO_EVIDENCE)
  : path.join(__dirname, '..', 'openspec/changes/archive/2026-08-04-game-studio-work-partner-daemon/evidence')
const REPORT = path.join(OUT, 'feishu-auth-probe.json')

function userDataDir() {
  if (process.env.KNOWME_USER_DATA) return process.env.KNOWME_USER_DATA
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'KnowMe')
  }
  return path.join(os.homedir(), '.config', 'KnowMe')
}

function redact(value) {
  const text = String(value || '')
  if (!text) return ''
  if (text.length <= 8) return '[redacted]'
  return `${text.slice(0, 4)}…${text.slice(-2)}`
}

async function probeFeishuReadApi() {
  try {
    const stdout = process.platform === 'win32'
      ? execFileSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'lark-cli drive +search --query knowme --page-size 1'], {
        encoding: 'utf8',
        windowsHide: true,
        env: process.env,
      })
      : execFileSync('lark-cli', ['drive', '+search', '--query', 'knowme', '--page-size', '1'], {
        encoding: 'utf8',
        windowsHide: true,
        env: process.env,
      })
    const parsed = JSON.parse(stdout)
    const hit = parsed?.data?.results?.[0]
    return {
      ok: Boolean(parsed?.ok && hit),
      command: 'lark-cli drive +search --query knowme --page-size 1',
      resultCount: Array.isArray(parsed?.data?.results) ? parsed.data.results.length : 0,
      sampleTitle: hit?.title_highlighted ? String(hit.title_highlighted).slice(0, 80) : '',
    }
  } catch (err) {
    return { ok: false, command: 'lark-cli drive +search', message: String(err.message || err).slice(0, 200) }
  }
}

async function main() {
  const probe = await probeFeishuStatus()
  const readApi = probe.userReady
    ? await probeFeishuReadApi()
    : { ok: false, skipped: true, reason: 'auth_not_ready' }
  const api = createConnectorsApi({ getUserData: () => userDataDir() })
  const status = await api.getConnectorStatus('feishu')
  const report = {
    at: new Date().toISOString(),
    probe: {
      ok: probe.ok,
      state: probe.state,
      message: probe.message,
      userReady: probe.userReady,
      appReady: probe.botReady,
      user: redact(probe.userName),
    },
    readApi,
    connector: status.ok ? {
      enabled: status.connector.enabled,
      state: status.connector.status && status.connector.status.state,
      message: status.connector.status && status.connector.status.message,
      userReady: status.connector.status && status.connector.status.userReady,
    } : { ok: false, code: status.code, message: status.message },
    writeBlocked: true,
    note: '只读探测；未执行任何飞书写入或业务发送。',
  }
  fs.mkdirSync(OUT, { recursive: true })
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
