'use strict'

require('./register-ts')
const fs = require('fs')
const path = require('path')
const handoff = require('../src/lib/game-workbench-handoff')
const gameReq = require('../src/lib/game-requirement')
const gameScenes = require('../src/lib/game-studio-scenes')
const workbenchDaemon = require('../src/lib/workbench-daemon-client')
const bootstrap = require('../src/lib/workbench-bootstrap')
const { resolveWorkbenchToken } = require('./resolve-workbench-token')

const ROOT = path.join(__dirname, '..')
const OUT = process.env.GAME_STUDIO_EVIDENCE
  ? path.resolve(process.env.GAME_STUDIO_EVIDENCE)
  : path.join(ROOT, 'openspec/changes/archive/2026-08-04-game-studio-work-partner-daemon/evidence')
const REPORT = path.join(OUT, 'daemon-live-e2e.json')

function resolveWorkbenchRoot() {
  return bootstrap.resolveWorkbenchInstallPath({})
    || bootstrap.discoverWorkbenchInstall()
    || ''
}

const SUCCESS_STATES = new Set(['finished', 'completed', 'done'])
const FAIL_STATES = new Set(['failed', 'cancelled'])

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function approvedRequirement() {
  const doc = gameReq.emptyDoc('七日登录奖励')
  doc.sections.background = '提升新用户 7 日留存，通过每日登录奖励建立习惯。'
  doc.sections.goals = '7 日内每日登录可领取递增奖励；断签不清零累计天数展示。'
  doc.sections.gameplay = '主界面入口 + 奖励弹窗；每日 0 点刷新可领状态。'
  doc.sections.acceptance = '连续登录 7 日奖励正确发放；断签后再次登录提示清晰；奖励幂等。'
  doc.status = 'approved'
  return doc
}

async function pollTask(client, slug, { timeoutMs = 120000, intervalMs = 2000 } = {}) {
  const started = Date.now()
  let last = null
  while (Date.now() - started < timeoutMs) {
    last = await client.task(slug)
    if (!last.ok) return last
    const state = String(last.state || '').toLowerCase()
    if (SUCCESS_STATES.has(state) || FAIL_STATES.has(state) || last.terminal) {
      return last
    }
    await sleep(intervalMs)
  }
  return { ok: false, code: 'timeout', error: '等待任务终态超时', slug, last }
}

async function fetchLogs(client, slug, token) {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), client.timeoutMs || 4000)
    const response = await fetch(`${client.endpoint}/api/tasks/${encodeURIComponent(slug)}/logs`, {
      headers: workbenchDaemon.buildAuthHeaders(token),
      signal: controller.signal,
    })
    clearTimeout(timer)
    const text = await response.text()
    return { ok: response.ok, text: text.slice(-4000) }
  } catch (error) {
    return { ok: false, text: String(error.message || error) }
  }
}

function readTaskArtifact(workbenchRoot, taskSlug, relPath) {
  const file = path.join(workbenchRoot, 'workflow-spec', taskSlug, relPath)
  if (!fs.existsSync(file)) return ''
  return fs.readFileSync(file, 'utf8').slice(0, 4000)
}

function snapshotEvidence(workbenchRoot, taskSlug, files) {
  const dir = path.join(OUT, 'daemon-artifacts', taskSlug)
  fs.mkdirSync(dir, { recursive: true })
  for (const rel of files) {
    const src = path.join(workbenchRoot, 'workflow-spec', taskSlug, rel)
    if (!fs.existsSync(src)) continue
    const dest = path.join(dir, rel.replace(/\//g, '__'))
    fs.copyFileSync(src, dest)
  }
}

async function main() {
  const workbenchRoot = resolveWorkbenchRoot()
  const settings = { workbenchInstall: { path: workbenchRoot } }
  const bootstrapResult = workbenchRoot
    ? bootstrap.runBootstrap(settings, {
      installPath: workbenchRoot,
      deploy: true,
      applyCompat: true,
    })
    : { ok: false, code: 'no_install_path' }

  const token = resolveWorkbenchToken({ workbenchRoot, settings })
  if (!token) {
    console.error('缺少 Workbench token：设置 KNOWME_WORKBENCH_TOKEN 或在 KnowMe 设置中配置授权码')
    process.exit(1)
  }

  const client = workbenchDaemon.createClient({
    endpoint: process.env.KNOWME_WORKBENCH_URL || 'http://127.0.0.1:8010',
    token,
    timeoutMs: 8000,
  })

  const report = {
    at: new Date().toISOString(),
    endpoint: client.endpoint,
    workbenchRoot: workbenchRoot || null,
    bootstrap: bootstrapResult,
    rootCause: {
      original: 'demo-experience agent workflow failed CLI preflight (missing CURSOR_API_KEY)',
      fixed: 'game-dev-delivery script workflow + KnowMe bootstrap compat patch (versioned)',
    },
    steps: [],
    ok: false,
  }

  const overview = await client.overview()
  report.steps.push({
    step: 'health+workflows',
    ok: !!overview.online,
    workflowCount: (overview.workflows || []).length,
    hasGameDevDelivery: (overview.workflows || []).some(w => w.id === 'game-dev-delivery'),
  })
  if (!overview.online) {
    fs.mkdirSync(OUT, { recursive: true })
    fs.writeFileSync(REPORT, JSON.stringify(report, null, 2))
    console.error('Daemon offline')
    process.exit(1)
  }

  const scene = gameScenes.getScene('game-dev')
  const requirement = approvedRequirement()
  const built = handoff.buildHandoff({
    requirementDoc: requirement,
    daemonOverview: overview,
    scene,
  })
  report.steps.push({
    step: 'buildHandoff',
    ok: !!built.ok,
    workflow: built.workflow || null,
    slug: built.slug || null,
    code: built.code || null,
    contextKeys: built.context ? Object.keys(built.context) : [],
  })
  if (!built.ok) {
    fs.mkdirSync(OUT, { recursive: true })
    fs.writeFileSync(REPORT, JSON.stringify(report, null, 2))
    process.exit(1)
  }

  const invalid = await client.createAndRun({
    workflow: built.workflow,
    slug: `fail-intent-${Date.now().toString(36).slice(-6)}`,
    intent: '',
    context: built.context,
  })
  report.steps.push({
    step: 'failurePath.clientValidation',
    ok: !invalid.ok && (invalid.code === 'invalid_intent' || /intent|目标/.test(invalid.error || '')),
    code: invalid.code || null,
    error: invalid.error || null,
  })

  const failSlug = `fail-brief-${Date.now().toString(36).slice(-6)}`
  const failStarted = await client.createAndRun({
    workflow: 'game-dev-delivery',
    slug: failSlug,
    intent: '短',
  })
  report.steps.push({
    step: 'failurePath.createShortBrief',
    ok: !!failStarted.ok,
    slug: failSlug,
  })

  let failTerminal = null
  if (failStarted.ok) {
    failTerminal = await pollTask(client, failSlug, { timeoutMs: 90000 })
    const logs = await fetchLogs(client, failSlug, token)
    const failReport = readTaskArtifact(workbenchRoot, failSlug, 'artifacts/delivery-pack-report.md')
    const scriptExit1 = /exit_code:\s*1/i.test(failReport)
    const briefTooShort = /需求案内容过短|至少需要 40/i.test(`${logs.text}\n${failReport}`)
    const parkedRecoverable = /暂停待人工|resume|script_failed/i.test(logs.text)
    report.steps.push({
      step: 'failurePath.executorFail',
      ok: failTerminal.terminal === true
        && Number(failTerminal.job && failTerminal.job.returncode) !== 0
        && briefTooShort
        && scriptExit1
        && parkedRecoverable,
      state: failTerminal.state,
      returncode: failTerminal.job && failTerminal.job.returncode,
      reason: failTerminal.job && failTerminal.job.reason,
      scriptExitCode: scriptExit1 ? 1 : null,
      logTail: logs.text,
      reportTail: failReport.slice(-800),
    })
    snapshotEvidence(workbenchRoot, failSlug, ['artifacts/delivery-pack-report.md', 'ingest/brief.md'])
  } else {
    report.steps.push({ step: 'failurePath.executorFail', ok: false, error: failStarted.error })
  }

  const successSlug = built.slug
  const started = await client.createAndRun({
    workflow: built.workflow,
    slug: successSlug,
    intent: built.intent,
    context: built.context,
  })
  report.steps.push({
    step: 'successPath.createAndRun',
    ok: !!started.ok,
    slug: successSlug,
    workflow: built.workflow,
    error: started.error || null,
  })
  if (!started.ok) {
    fs.mkdirSync(OUT, { recursive: true })
    fs.writeFileSync(REPORT, JSON.stringify(report, null, 2))
    process.exit(1)
  }

  const terminal = await pollTask(client, successSlug, { timeoutMs: 120000 })
  const logs = await fetchLogs(client, successSlug, token)
  const returncode = terminal.job && terminal.job.returncode
  const success = terminal.ok
    && SUCCESS_STATES.has(String(terminal.state || '').toLowerCase())
    && returncode === 0

  report.steps.push({
    step: 'successPath.terminal',
    ok: success,
    state: terminal.state,
    returncode,
    reason: terminal.job && terminal.job.reason,
    logTail: logs.text,
  })

  const artifacts = await client.artifacts(successSlug)
  const names = (artifacts.files || []).map(f => f.name || f.path).join(' ')
  const hasDelivery = /delivery-pack|implementation-checklist|acceptance-matrix|manifest\.json/i.test(names)
  report.steps.push({
    step: 'successPath.artifacts',
    ok: artifacts.ok && hasDelivery,
    fileCount: (artifacts.files || []).length,
    sample: names.slice(0, 300),
  })

  if (success) {
    snapshotEvidence(workbenchRoot, successSlug, [
      'artifacts/delivery-pack.md',
      'artifacts/implementation-checklist.md',
      'artifacts/acceptance-matrix.md',
      'artifacts/manifest.json',
    ])
  }

  report.ok = report.steps.every(step => step.ok)
  report.summary = {
    workflow: built.workflow,
    successSlug,
    failSlug: failStarted.ok ? failSlug : null,
    exitCode: returncode,
    artifactFiles: (artifacts.files || []).length,
  }

  fs.mkdirSync(OUT, { recursive: true })
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  if (!report.ok) process.exit(1)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
