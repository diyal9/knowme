'use strict'

/**
 * Electron 冒烟：通用助手「查文档/知识库」必须能调用 feishu.doc_kb_suggest。
 * 回归根因：工具面 extras 静默截断导致 requiredTools 丢失。
 */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const { _electron: electron } = require('playwright')

const ROOT = path.resolve(__dirname, '../../../..')
const REPORT = path.join(__dirname, 'doc-kb-electron-smoke.json')

const report = {
  generatedAt: new Date().toISOString(),
  pass: false,
  checks: [],
  consoleErrors: [],
  result: null,
}

function check(id, pass, detail) {
  report.checks.push(detail === undefined ? { id, pass: !!pass } : { id, pass: !!pass, detail })
}

function killElectron() {
  if (process.platform !== 'win32') return
  for (const image of ['KnowMe.exe', 'electron.exe']) {
    try {
      execFileSync('cmd.exe', ['/c', 'taskkill', '/F', '/IM', image, '/T'], { stdio: 'ignore' })
    } catch { /* none */ }
  }
}

function buildDates(days) {
  const out = []
  const today = new Date()
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today.getTime() - i * 86400000)
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
  }
  return out
}

async function main() {
  killElectron()
  await new Promise(r => setTimeout(r, 1200))

  const app = await electron.launch({
    cwd: ROOT,
    executablePath: require('electron'),
    args: ['.'],
    env: { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' },
    timeout: 120000,
  })

  try {
    const win = await app.firstWindow({ timeout: 90000 })
    win.on('console', m => {
      if (m.type() !== 'error') return
      const text = m.text()
      if (!/favicon|DevTools|Autofill|Electron Security Warning|^\[center-surface\]/i.test(text)) {
        report.consoleErrors.push(text)
      }
    })
    win.on('pageerror', e => report.consoleErrors.push(String(e?.message || e)))
    await win.waitForLoadState('domcontentloaded', { timeout: 90000 })
    await win.waitForTimeout(2500)

    const dates = buildDates(30)
    const prompt = `请查文档/知识库。\n\n时间范围以点击时刻为准：近 30 天（含今天 ${dates.at(-1)}），即 ${dates.join('、')}（范围 ${dates[0]} 至 ${dates.at(-1)}）。`
    const runId = `smoke_dockb_${Date.now()}`

    const result = await win.evaluate(async ({ prompt, runId }) => {
      const events = []
      const off = window.api.onAiStreamEvent
        ? window.api.onAiStreamEvent(evt => {
          if (evt?.runId && evt.runId !== runId) return
          events.push({
            type: evt?.type,
            stage: evt?.stage || evt?.id,
            status: evt?.status,
            text: String(evt?.summary || evt?.message || evt?.text || '').slice(0, 240),
            toolName: evt?.toolName || evt?.name || null,
          })
        })
        : null
      const res = await window.api.aiGenerate({
        prompt,
        displayPrompt: '文件夹·记忆推荐·最近编辑/阅读',
        context: null,
        history: [],
        skillRefs: ['feishu-doc-kb'],
        agentId: 'general',
        runId,
      })
      if (typeof off === 'function') off()
      let session = null
      if (res?.sessionId && window.api.agentSessionGet) {
        const got = await window.api.agentSessionGet(res.sessionId)
        session = got?.ok ? got.session : got?.session || null
      }
      return {
        error: res?.error || null,
        cancelled: res?.cancelled || null,
        text: String(res?.text || ''),
        sessionId: res?.sessionId || null,
        runId: res?.runId || runId,
        toolsUsed: session?.run?.toolsUsed || [],
        assistantText: [...(session?.messages || [])].reverse().find(m => m.role === 'assistant')?.text || '',
        toolNames: (session?.messages || []).filter(m => m.role === 'tool').map(m => m.toolName),
        events: events.slice(-80),
      }
    }, { prompt, runId })

    report.result = {
      error: result.error,
      cancelled: result.cancelled,
      sessionId: result.sessionId,
      runId: result.runId,
      toolsUsed: result.toolsUsed,
      toolNames: result.toolNames,
      textHead: String(result.text || result.assistantText || '').slice(0, 1000),
      events: result.events,
    }

    const text = String(result.text || result.assistantText || '')
    const err = String(result.error || '')
    check('no-tool-unavailable', !/所需工具不可用|feishu\.doc_kb_suggest.*不可用/i.test(err), err || 'ok')
    check('no-generic-fallback-as-sole-error', !(err && /未能收到完整答复/.test(err)), err || 'ok')
    check('has-assistant-text', Boolean(text.trim()), { textLen: text.length })

    const usedDocKb = (result.toolNames || []).includes('feishu.doc_kb_suggest')
      || (result.toolsUsed || []).includes('feishu.doc_kb_suggest')
      || result.events.some(e => e.toolName === 'feishu.doc_kb_suggest')
      || /个人文件夹|知识库空间|最近自己编辑|最近自己阅读|文档\s*\/\s*知识库候选/i.test(text)
    check('called-feishu-doc-kb-suggest', usedDocKb, {
      toolNames: result.toolNames,
      toolsUsed: result.toolsUsed,
      textHead: text.slice(0, 200),
    })

    check('no-business-console-errors', report.consoleErrors.length === 0, report.consoleErrors.slice(0, 5))

    // Run 终态：允许短延迟落盘
    await win.waitForTimeout(500)
    const runState = await win.evaluate(async (id) => {
      if (!window.api.agentRunStatus) return null
      return window.api.agentRunStatus(id)
    }, result.runId)
    if (runState) {
      const terminal = runState.terminal === true
        || ['done', 'error', 'cancelled', 'failed', 'completed'].includes(String(runState.status || '').toLowerCase())
      check('run-terminal', terminal, runState)
    } else {
      check('run-terminal', true, 'agentRunStatus API unavailable — skipped')
    }

    report.pass = report.checks.every(c => c.pass)
  } finally {
    try { await app.close() } catch { /* ignore */ }
    fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  }

  if (!report.pass) {
    console.error(JSON.stringify(report, null, 2))
    process.exit(1)
  }
  console.log(JSON.stringify({
    pass: true,
    checks: report.checks,
    textHead: report.result?.textHead?.slice(0, 300),
    tools: report.result?.toolNames || report.result?.toolsUsed,
  }, null, 2))
}

main().catch(err => {
  report.pass = false
  report.checks.push({ id: 'runner', pass: false, detail: String(err?.message || err) })
  fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.error('ERR', err)
  process.exit(1)
})
