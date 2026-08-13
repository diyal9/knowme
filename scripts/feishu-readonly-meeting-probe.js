'use strict'

/**
 * 飞书会议只读探针：production feishu-cli meeting_candidates + meeting_read（候选 #2）。
 * 仅统计 token 哈希/正文长度，不落盘敏感正文。writeBlocked=true。
 */

const fs = require('fs')
const os = require('os')
const path = require('path')
const crypto = require('crypto')
const { executeMeetingCandidates, executeMeetingRead } = require('../src/lib/connectors/feishu-cli')
const { probeFeishuStatus } = require('../src/lib/connectors/feishu-status')

const OUT = process.env.GROUNDING_EVIDENCE_DIR
  ? path.resolve(process.env.GROUNDING_EVIDENCE_DIR)
  : path.join(__dirname, '..', 'openspec/changes/establish-grounded-agent-runtime-evals/evidence')
const REPORT = path.join(OUT, 'feishu-readonly-meeting-probe.json')

function hash(value) {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex').slice(0, 16)
}

function userDataDir() {
  if (process.env.KNOWME_USER_DATA) return process.env.KNOWME_USER_DATA
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'KnowMe')
  }
  return path.join(os.homedir(), '.config', 'KnowMe')
}

async function main() {
  const report = {
    at: new Date().toISOString(),
    writeBlocked: true,
    mode: 'read-only-probe',
    auth: { userReady: false },
    candidates: { ok: false, candidateCount: 0, tokens: [] },
    readAttempts: [],
    ok: false,
  }

  const status = await probeFeishuStatus()
  report.auth = {
    source: 'feishu-status',
    userReady: status.userReady === true,
    state: status.state,
  }

  const opts = { getUserData: () => userDataDir() }

  if (!status.userReady) {
    report.note = '飞书用户未就绪，跳过 API 探针（executor/eval 层仍可用 fixture）'
    fs.mkdirSync(OUT, { recursive: true })
    fs.writeFileSync(REPORT, JSON.stringify(report, null, 2))
    console.log(JSON.stringify(report, null, 2))
    process.exit(0)
  }

  const days = 14
  const candRes = await executeMeetingCandidates({ days }, opts)
  const list = candRes?.meta?.candidates || []
  report.candidates = {
    ok: Boolean(candRes.ok && list.length),
    days,
    candidateCount: list.length,
    withMinuteToken: list.filter(c => c.minuteToken || c.minute_token).length,
    tokens: list.slice(0, 3).map(c => ({
      titleHash: hash(c.title || c.label || ''),
      minuteTokenHash: hash(c.minuteToken || c.minute_token || ''),
    })),
    code: candRes.ok ? null : candRes.code,
  }

  const pick = list[1] || list[0]
  const token = pick?.minuteToken || pick?.minute_token
  if (token) {
    const readRes = await executeMeetingRead({ minute_token: token }, opts)
    const body = String(readRes?.text || '')
    report.readAttempts.push({
      minuteTokenHash: hash(token),
      titleHash: hash(pick?.title || pick?.label || ''),
      ok: Boolean(readRes?.ok && body.length > 100),
      code: readRes?.ok ? null : (readRes?.code || 'cli_error'),
      bodyLen: body.length,
      hasMeetingKeywords: /议题|待办|会议|结论/.test(body.slice(0, 500)),
      metaWorkflow: readRes?.meta?.workflow || 'meeting_read',
      note: readRes?.ok ? '只读成功；正文未落盘' : '错误路径；未保存错误正文',
    })
  }

  report.ok = report.candidates.ok && report.readAttempts.some(a => a.ok)
  fs.mkdirSync(OUT, { recursive: true })
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  process.exit(0)
}

main().catch(err => {
  const report = {
    at: new Date().toISOString(),
    writeBlocked: true,
    ok: false,
    error: String(err.message || err).slice(0, 300),
  }
  fs.mkdirSync(OUT, { recursive: true })
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2))
  console.error(err)
  process.exit(0)
})
