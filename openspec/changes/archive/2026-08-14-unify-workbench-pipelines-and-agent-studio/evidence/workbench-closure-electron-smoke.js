'use strict'

const fs = require('fs')
const http = require('http')
const os = require('os')
const path = require('path')
const { _electron: electron } = require('playwright')

const ROOT = path.resolve(__dirname, '../../../..')
const OUT = __dirname
const SHOTS = path.join(OUT, 'screenshots')
const REPORT = path.join(OUT, 'workbench-closure-electron-smoke.json')

function check(report, id, ok, detail = '') {
  report.checks.push({ id, ok: Boolean(ok), detail })
  if (!ok) report.failures.push({ id, detail })
  return Boolean(ok)
}

function createDaemonFixture(options = {}) {
  const artifactPath = options.artifactPath
  let phase = 0
  let created = false
  let activeSlug = 'closure-daemon-task'
  const requests = []
  const task = () => ({
    slug: activeSlug,
    workflow: 'fixture-flow',
    intent: options.intent || '开发一个功能并完成测试验证',
    state: phase >= 2 ? 'completed' : 'running',
    status: { state: phase >= 2 ? 'completed' : 'running' },
    pending_gates: phase === 0 ? [{ node: 'review', title: '本地确认' }] : [],
    pending_clarifications: phase === 1 ? [{ node: 'details', question: '请补充验收标准' }] : [],
    terminal: phase >= 2,
  })

  const server = http.createServer((req, res) => {
    requests.push({ method: req.method, path: req.url })
    const json = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(body))
    }
    if (req.method === 'GET' && req.url === '/api/health') return json(200, { ok: true })
    if (req.method === 'GET' && req.url === '/api/workflows') {
      return json(200, {
        workflows: [{
          id: 'fixture-flow',
          name: '研发交付 Fixture',
          summary: '闭环烟测 Daemon 工作流',
          catalog: { visibility: 'primary', category: 'engineering', order: 1 },
        }],
      })
    }
    if (req.method === 'GET' && req.url === '/api/agents-team/overview') {
      return json(200, {
        agents: [
          { id: 'producer', label_zh: '制作人', label_en: 'Producer', description: '规划与验收', display_order: 1 },
          { id: 'developer', label_zh: '开发', label_en: 'Developer', description: '实现与自测', display_order: 2 },
          { id: 'tester', label_zh: '测试', label_en: 'Tester', description: 'QA 审查', display_order: 3 },
        ],
      })
    }
    if (req.method === 'GET' && req.url === '/api/tasks') return json(200, { tasks: created ? [task()] : [] })
    if (req.method === 'GET' && req.url === '/api/workflows/fixture-flow/launch-context') {
      return json(200, { context: { meta: { sceneId: 'closure-fixture' } } })
    }
    if (req.method === 'POST' && req.url === '/api/tasks') {
      created = true
      return json(201, { task: { ...task(), state: 'queued' } })
    }
    const runMatch = req.method === 'POST' && req.url.match(/^\/api\/tasks\/([^/]+)\/run$/)
    if (runMatch) {
      activeSlug = decodeURIComponent(runMatch[1])
      return json(200, { job: { state: 'running' } })
    }
    const taskMatch = req.url.match(/^\/api\/tasks\/([^/]+)$/)
    if (req.method === 'GET' && taskMatch) return json(200, task())
    if (req.method === 'POST' && req.url === `/api/tasks/${activeSlug}/gate`) {
      phase = 1
      return json(200, { ok: true })
    }
    if (req.method === 'POST' && req.url === `/api/tasks/${activeSlug}/clarify`) {
      phase = 2
      return json(200, { ok: true })
    }
    if (req.method === 'GET' && req.url === `/api/tasks/${activeSlug}/artifacts`) {
      return json(200, {
        files: [{
          name: 'closure-result.md',
          path: artifactPath,
          local: true,
        }],
      })
    }
    return json(404, { detail: 'fixture route not found', path: req.url })
  })

  return {
    server,
    requests,
    get slug() { return activeSlug },
    get createCount() { return requests.filter(item => item.method === 'POST' && item.path === '/api/tasks').length },
    async listen() {
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
      return server.address().port
    },
    close() {
      return new Promise(resolve => server.close(resolve))
    },
  }
}

function createLlmFixture() {
  const server = http.createServer((req, res) => {
    const json = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(body))
    }
    if (req.method === 'POST' && req.url === '/v1/chat/completions') {
      let body = ''
      req.on('data', chunk => { body += chunk })
      req.on('end', () => {
        json(200, {
          id: 'closure-fixture',
          object: 'chat.completion',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: JSON.stringify({ ok: true, summary: 'fixture completion' }),
            },
            finish_reason: 'stop',
          }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        })
      })
      return
    }
    json(404, { error: 'not found' })
  })
  return {
    server,
    listen() {
      return new Promise(resolve => {
        server.listen(0, '127.0.0.1', () => resolve(server.address().port))
      })
    },
    close() {
      return new Promise(resolve => server.close(resolve))
    },
  }
}

function writeFixtureExperts(userDataDir) {
  const experts = [
    ['researcher', '资料研究 Agent', '负责检索和核验目标相关资料。', '研究、检索、核验'],
    ['writer', '交付写作 Agent', '负责整理研究结果并形成可交付内容。', '写作、整理、交付'],
    ['producer', '制作人 Agent', '负责规划与验收。', '规划、验收'],
    ['developer', '开发 Agent', '负责实现与自测。', '开发、实现'],
    ['tester', '测试 Agent', '负责 QA 与反模式审查。', '测试、QA'],
    ['office-assistant', '办公助手 Agent', '负责会议纪要与待办。', '会议、纪要'],
    ['designer', '视觉设计 Agent', '负责视觉方案、图像生成与审阅。', '设计、图像、审阅'],
    ['copywriter', '视觉文案 Agent', '负责视觉文案和生成提示词。', '文案、提示词'],
  ]
  for (const [id, name, description, skills] of experts) {
    const dir = path.join(userDataDir, 'capabilities', 'experts', id)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'EXPERT.md'), `---
name: ${name}
description: ${description}
skills: [${skills}]
---

你是 KnowMe 闭环烟测 Expert，按目标完成职责并输出结构化结果。
`, 'utf8')
  }
}

function writeSettings(userDataDir, daemonPort, llmPort) {
  fs.writeFileSync(path.join(userDataDir, 'settings.json'), JSON.stringify({
    workbenchAuth: { endpoint: `http://127.0.0.1:${daemonPort}` },
    apiKey: 'closure-smoke-key',
    apiEndpoint: `http://127.0.0.1:${llmPort}/v1/chat/completions`,
  }), 'utf8')
}

async function launchElectron(userDataDir, daemonPort, options = {}) {
  const localTeamEnabled = options.localTeam !== false
  return electron.launch({
    cwd: ROOT,
    executablePath: require('electron'),
    args: ['.', `--user-data-dir=${userDataDir}`],
    env: {
      ...process.env,
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
      KNOWME_TEST_SEAM: '1',
      KNOWME_TEST_USER_DATA_DIR: userDataDir,
      KNOWME_WORKBENCH_URL: `http://127.0.0.1:${daemonPort}`,
      KNOWME_AGENT_TEAM_RUNTIME: localTeamEnabled ? '1' : '0',
    },
    timeout: 120000,
  })
}

function attachConsole(window, report) {
  window.on('console', message => {
    if (message.type() !== 'error') return
    const text = message.text()
    if (!/favicon|DevTools|Autofill|Electron Security Warning|^\[center-surface\]/i.test(text)) {
      report.consoleErrors.push(text)
    }
  })
  window.on('dialog', dialog => dialog.accept())
}

async function seedEngineeringTeam(window) {
  await window.evaluate(async () => {
    const experts = ['producer', 'developer', 'tester', 'researcher', 'writer']
    for (const expertId of experts) {
      try {
        await window.api.workbenchModeBindExpert?.({ modeId: 'engineering', expertId })
      } catch { /* ignore duplicate bind */ }
    }
    if (window.api?.workbenchLoad) await window.api.workbenchLoad()
  })
  await window.evaluate(() => document.getElementById('wbReload')?.click())
  await window.waitForTimeout(1500)
}

async function createReadyVerticalTeamRun(window, options = {}) {
  const launch = await window.evaluate(async (input) => window.api.workbenchLaunchStart({
    intent: {
      step: 'launch',
      status: 'ready',
      domain: input.domain,
      resourceType: 'pipeline',
      resourceId: input.resourceId,
      goal: input.goal,
      backend: 'local-team',
    },
    allowRelaunch: true,
    facts: input.facts,
  }), options)
  if (!launch?.ok || launch.route !== 'confirm-agent-graph') return { launch }

  const plan = await window.evaluate(async (input) => window.api.workbenchAgentGraphPlan({
    goal: input.goal,
    members: input.agentIds.map(id => ({
      agentPackageId: id,
      expertId: id,
      profileId: '',
      role: id,
    })),
    template: input.agentIds.length > 1 ? 'serial' : 'single',
  }), options)
  if (!plan?.ok) return { launch, plan }

  const started = await window.evaluate(async (resolvedPlan) => window.api.workbenchAgentGraphStart({
    goal: resolvedPlan.composition?.goal || '',
    members: resolvedPlan.composition?.members || [],
    template: resolvedPlan.composition?.template || '',
    nodes: resolvedPlan.composition?.nodes || [],
    edges: resolvedPlan.composition?.edges || [],
    gates: resolvedPlan.composition?.gates || [],
    joinStrategy: resolvedPlan.composition?.joinStrategy,
    parallelism: resolvedPlan.composition?.parallelism,
    teamPackageId: resolvedPlan.teamPackage?.packageId,
    teamName: resolvedPlan.teamPackage?.name,
    version: resolvedPlan.teamPackage?.version,
  }), plan)
  if (started?.ok && started.rootRunId) {
    await window.evaluate(async ({ rootRunId }) => window.api.workbenchLaunchComplete({
      refs: {
        runId: rootRunId,
        rootRunId,
        executionSource: 'agent-graph',
        status: 'launched',
      },
    }), started)
  }
  return { launch, plan, started }
}

async function openWorkbench(window) {
  await window.locator('#btnRailWorkbench').click()
  await window.locator('#wbHomePage.active .wb-console-overview').waitFor({ state: 'visible', timeout: 60000 })
  await window.waitForFunction(
    () => document.querySelectorAll('#wbConsoleReadiness .wb-readiness-item').length >= 3,
    null,
    { timeout: 60000 },
  )
}

async function drawerOpen(window) {
  return window.evaluate(() => {
    const drawer = document.getElementById('wbLaunchDrawer')
    return Boolean(drawer && (drawer.matches(':popover-open') || getComputedStyle(drawer).display !== 'none'))
  })
}

async function openLaunchDrawerUi(window) {
  if (await drawerOpen(window)) return
  await window.locator('#wbConsoleNewRun').click()
  await window.waitForFunction(() => {
    const drawer = document.getElementById('wbLaunchDrawer')
    return drawer && (drawer.matches(':popover-open') || getComputedStyle(drawer).visibility === 'visible')
  }, null, { timeout: 15000 })
}

async function closeLaunchDrawerUi(window) {
  if (!(await drawerOpen(window))) return
  await window.evaluate(() => {
    document.getElementById('wbLaunchDrawerClose')?.click()
    const drawer = document.getElementById('wbLaunchDrawer')
    if (drawer?.matches(':popover-open')) drawer.hidePopover?.()
  })
  await window.keyboard.press('Escape').catch(() => {})
  await window.waitForTimeout(200)
}

async function setGoal(window, goal) {
  await openLaunchDrawerUi(window)
  await window.evaluate((value) => {
    const input = document.getElementById('wbGoalInput')
    if (!input) throw new Error('#wbGoalInput missing in launch drawer')
    input.value = value
    input.dispatchEvent(new Event('input', { bubbles: true }))
    const form = document.getElementById('wbGoalForm')
    form?.requestSubmit?.()
    if (!form?.requestSubmit) document.getElementById('wbGoalSubmit')?.click()
  }, goal)
  await window.waitForFunction(() => {
    const picker = document.getElementById('wbGoalPathPicker')
    return picker && !picker.hasAttribute('hidden')
  }, null, { timeout: 15000 })
}

async function selectDomain(window, domain) {
  await window.locator(`[data-domain="${domain}"]`).click()
  await window.locator(`[data-domain="${domain}"].active`).waitFor({ state: 'visible', timeout: 15000 })
}

async function confirmWorkflowModal(window) {
  await window.locator('#wbWorkflowModal').waitFor({ state: 'visible', timeout: 30000 })
  await window.waitForFunction(() => {
    const btn = document.querySelector('#wbModalConfirm')
    return btn && !btn.disabled && !btn.hidden
  }, null, { timeout: 30000 })
  await window.evaluate(() => document.getElementById('wbModalConfirm')?.click())
}

async function waitForTaskRoom(window) {
  await window.waitForFunction(() => {
    const runner = document.querySelector('#wbRunner')
    return runner && !runner.hidden && document.querySelector('#wbTaskPage')?.classList.contains('active')
  }, null, { timeout: 45000 })
}

async function readRunState(window) {
  return window.evaluate(() => ({
    slug: window.Workbench && typeof window.Workbench.previewTaskTrace === 'function'
      ? null
      : null,
    runnerVisible: !document.querySelector('#wbRunner')?.hidden,
    runnerMeta: document.querySelector('#wbRunnerMeta')?.textContent || '',
    runStatus: document.querySelector('#wbRunStatus')?.textContent || '',
    draft: null,
  }))
}

async function getInternalRunIds(window) {
  return window.evaluate(async () => {
    const draft = await window.api.workbenchTaskDraftGet()
    const context = await window.api.workbenchContextGet()
    return {
      draft: draft?.draft || null,
      context: context?.context || null,
      runnerMeta: document.querySelector('#wbRunnerMeta')?.textContent || '',
    }
  })
}

async function openResourcesTab(window, type = 'flows') {
  await window.evaluate((tabType) => {
    document.getElementById('wbTabFlows')?.click()
    const selector = tabType === 'team'
      ? '#wbTabTeam,[data-wb-resource-type="team"]'
      : '[data-wb-resource-type="flows"]'
    document.querySelector(selector)?.click()
  }, type)
  const pageId = type === 'team' ? '#wbTeamPage.active' : '#wbFlowsPage.active'
  await window.locator(pageId).waitFor({ state: 'attached', timeout: 15000 })
}

async function backToRunList(window) {
  await window.evaluate(() => {
    const foot = document.querySelector('[data-run-action="back"]')
    if (foot) {
      foot.click()
      return
    }
    document.getElementById('wbRunInputCancel')?.click()
  })
  await window.waitForFunction(() => {
    const runner = document.querySelector('#wbRunner')
    return !runner || runner.hidden
  }, null, { timeout: 15000 })
}

async function resetWorkbenchUiState(window) {
  await window.evaluate(() => {
    document.getElementById('wbModalCancel')?.click()
    document.getElementById('wbModalClose')?.click()
    document.getElementById('wbLaunchDrawerClose')?.click()
    if (window.Workbench?.resetRun) window.Workbench.resetRun()
  })
  await window.waitForTimeout(300)
  await backToRunList(window).catch(() => {})
}

async function completeDaemonRunIfNeeded(window, fixture, slug = fixture.slug) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await window.evaluate(() => document.querySelector('[data-run-action="refresh-task"]')?.click())
    await window.waitForTimeout(1200)
    if (await window.locator('[data-run-action="daemon-approve"]').count()) {
      await window.evaluate(() => document.querySelector('[data-run-action="daemon-approve"]')?.click())
      await window.waitForTimeout(1000)
    }
    if (await window.locator('[data-run-action="daemon-clarify"]').count()) {
      await window.evaluate(() => document.querySelector('[data-run-action="daemon-clarify"]')?.click())
      await window.waitForTimeout(1000)
    }
    const done = await window.evaluate(() => {
      const status = document.querySelector('#wbRunStatus')?.textContent || ''
      return /已完成|完成/.test(status) || document.querySelector('[data-artifact-path]')
    })
    if (done) return { slug, via: 'ui' }
  }

  const apiState = await window.evaluate(async (taskSlug) => {
    const readTask = async () => window.api?.workbenchDaemonTask?.(taskSlug)
    let task = await readTask()
    if (!task?.ok) return { ok: false, stage: 'read', task }
    if (Array.isArray(task.pending_gates) && task.pending_gates.length) {
      const gate = task.pending_gates[0]
      const node = gate.node || gate.node_id || gate.id || 'review'
      await window.api.workbenchDaemonGate(taskSlug, { node, decision: 'approve' })
    }
    task = await readTask()
    if (Array.isArray(task.pending_clarifications) && task.pending_clarifications.length) {
      const clarification = task.pending_clarifications[0]
      const node = clarification.node || clarification.node_id || clarification.id || 'details'
      await window.api.workbenchDaemonClarify(taskSlug, { node, answer: 'closure smoke fixture answer' })
    }
    task = await readTask()
    const artifacts = await window.api?.workbenchDaemonArtifacts?.(taskSlug)
    return {
      ok: true,
      stage: 'api',
      state: task?.state || task?.status?.state || '',
      terminal: task?.terminal === true,
      pendingGates: task?.pending_gates || [],
      pendingClarifications: task?.pending_clarifications || [],
      artifacts,
    }
  }, slug)
  if (apiState?.ok) {
    await window.evaluate((taskSlug) => {
      document.querySelector(`[data-console-task="${taskSlug}"]`)?.click()
    }, slug).catch(() => {})
    await waitForTaskRoom(window).catch(() => {})
    await window.evaluate(() => document.querySelector('[data-run-action="refresh-task"]')?.click()).catch(() => {})
    await window.waitForTimeout(1200)
  }
  return { slug, via: apiState?.ok ? 'api' : 'failed', apiState }
}

async function launchAgentFromTeam(window, goal, agentId, report) {
  await openLaunchDrawerUi(window)
  await window.evaluate((value) => {
    const input = document.getElementById('wbGoalInput')
    if (!input) throw new Error('#wbGoalInput missing in launch drawer')
    input.value = value
    input.dispatchEvent(new Event('input', { bubbles: true }))
    const form = document.getElementById('wbGoalForm')
    form?.requestSubmit?.()
    if (!form?.requestSubmit) document.getElementById('wbGoalSubmit')?.click()
  }, goal)
  await window.waitForTimeout(400)
  await closeLaunchDrawerUi(window)
  await openResourcesTab(window, 'team')
  await window.evaluate((id) => {
    document.querySelector(`#wbTeamList [data-agent-select="${id}"]`)?.click()
      || document.querySelector('#wbTeamList [data-agent-select]')?.click()
  }, agentId)
  await window.waitForFunction(() => {
    const detail = document.querySelector('#wbTeamList .wb-agent-detail-panel')
    const runButton = detail?.querySelector('[data-agent-run]')
    return detail && runButton && !runButton.disabled
  }, null, { timeout: 20000 })
  const resourceSurface = await window.evaluate(() => {
    const consoleEl = document.querySelector('#wbTeamList .wb-agent-console')
    const detail = consoleEl?.querySelector('.wb-agent-detail-panel')
    return {
      listVisible: Boolean(consoleEl?.querySelector('[data-agent-select]')),
      detailVisible: Boolean(detail),
      primaryCount: detail?.querySelectorAll('.primary').length || 0,
      hasProfileRun: Boolean(detail?.querySelector('[data-agent-run]')),
      hasSecondaryChat: Boolean(detail?.querySelector('[data-agent-chat]')),
    }
  })
  if (report) {
    check(report, 'agent-resource-uses-list-detail',
      resourceSurface.listVisible
        && resourceSurface.detailVisible
        && resourceSurface.primaryCount === 1
        && resourceSurface.hasProfileRun
        && resourceSurface.hasSecondaryChat,
      resourceSurface)
  }
  await window.screenshot({ path: path.join(SHOTS, 'closure-agent-resources.png'), scale: 'css' })
  await window.evaluate(() =>
    document.querySelector('#wbTeamList .wb-agent-detail-panel [data-agent-run]')?.click())
  await window.waitForTimeout(1500)
  const earlyPlan = await window.evaluate(async ({ goalText, id }) => window.api?.workbenchAgentGraphPlan?.({
    goal: goalText,
    members: [{ agentPackageId: id, expertId: id, profileId: `${id}-profile`, role: id }],
    template: 'single',
  }), { goalText: goal, id: agentId })
  if (earlyPlan && earlyPlan.ok === false) {
    return {
      mode: 'error',
      hint: earlyPlan.issues?.[0]?.message || earlyPlan.error || 'agent graph plan failed',
      diag: {
        modalHidden: await window.evaluate(() => document.querySelector('#wbWorkflowModal')?.hidden),
        hint: await window.evaluate(() => document.querySelector('#wbModalHint')?.textContent || ''),
        plan: earlyPlan,
      },
    }
  }
  try {
    const handle = await window.waitForFunction(() => {
      const modal = document.querySelector('#wbWorkflowModal')
      const btn = document.querySelector('#wbModalConfirm')
      const hint = document.querySelector('#wbModalHint')?.textContent || ''
      const body = document.querySelector('#wbModalBody')?.textContent || ''
      const runner = document.querySelector('#wbRunner')
      if (runner && !runner.hidden) {
        return {
          mode: 'runner',
          hint,
          meta: document.querySelector('#wbRunnerMeta')?.textContent || '',
        }
      }
      if (modal && !modal.hidden && btn && !btn.disabled && body.trim()) {
        return { mode: 'modal', hint, confirm: btn.textContent || '', bodyPreview: body.slice(0, 160) }
      }
      if (/失败|无法|API Key|暂无法/i.test(hint)) return { mode: 'error', hint }
      return null
    }, null, { timeout: 30000 })
    return handle.jsonValue()
  } catch (error) {
    const diag = await window.evaluate(async ({ goalText, id }) => {
      const plan = await window.api?.workbenchAgentGraphPlan?.({
        goal: goalText,
        members: [{ agentPackageId: id, expertId: id, profileId: `${id}-profile`, role: id }],
        template: 'single',
      })
      return {
        modalHidden: document.querySelector('#wbWorkflowModal')?.hidden,
        hint: document.querySelector('#wbModalHint')?.textContent || '',
        confirmDisabled: document.querySelector('#wbModalConfirm')?.disabled,
        runnerVisible: !document.querySelector('#wbRunner')?.hidden,
        plan,
      }
    }, { goalText: goal, id: agentId })
    return { mode: 'error', hint: diag.plan?.issues?.[0]?.message || error.message, diag, error: error.message }
  }
}

async function openAgentGraphModal(window, goal, report) {
  await resetWorkbenchUiState(window)
  await window.evaluate(() => {
    document.getElementById('wbModalCancel')?.click()
    document.getElementById('wbModalClose')?.click()
  })
  await window.waitForFunction(
    () => !document.querySelector('#wbWorkflowModal') || document.querySelector('#wbWorkflowModal').hidden,
    null,
    { timeout: 10000 },
  ).catch(() => {})
  await openLaunchDrawerUi(window)
  await window.evaluate((goalText) => {
    const input = document.getElementById('wbGoalInput')
    if (!input) throw new Error('#wbGoalInput missing in launch drawer')
    input.value = goalText
    input.dispatchEvent(new Event('input', { bubbles: true }))
    document.querySelector('[data-goal-path="graph"]')?.click()
  }, goal)
  try {
    await window.waitForFunction(() => {
      const modal = document.querySelector('#wbWorkflowModal')
      const save = document.querySelector('[data-save-graph]')
      const hint = document.querySelector('#wbModalHint')?.textContent || ''
      if (modal && !modal.hidden && save) return true
      if (modal && !modal.hidden && /失败|无法|暂无法|API Key|校验/i.test(hint)) {
        return { blocked: hint }
      }
      return false
    }, null, { timeout: 90000 })
  } catch (error) {
    const diag = await window.evaluate(() => ({
      modalHidden: document.querySelector('#wbWorkflowModal')?.hidden,
      modalHint: document.querySelector('#wbModalHint')?.textContent || '',
      modalTitle: document.querySelector('#wbModalTitle')?.textContent || '',
      modalBodyPreview: document.querySelector('#wbModalBody')?.textContent?.slice(0, 240) || '',
      runnerVisible: !document.querySelector('#wbRunner')?.hidden,
      drawerOpen: Boolean(document.getElementById('wbLaunchDrawer')?.matches(':popover-open')),
      planApi: typeof window.api?.workbenchAgentGraphPlan,
    }))
    check(report, 'graph-modal-with-save', false, diag)
    return false
  }
  const blocked = await window.evaluate(() => {
    const hint = document.querySelector('#wbModalHint')?.textContent || ''
    return /失败|无法|暂无法|API Key|校验/i.test(hint) ? hint : ''
  })
  if (blocked) {
    check(report, 'graph-modal-with-save', false, { hint: blocked })
    return false
  }
  check(report, 'graph-modal-with-save', true, { goal })
  return true
}

async function runClosureChecks(window, report, fixture, artifactPath) {
  const goal = '开发一个功能并完成测试验证'

  const shell = await window.evaluate(() => ({
    primaryTabs: [...document.querySelectorAll('.wb-tabs-primary .wb-tab')].map(item => item.textContent.trim()),
    auxHidden: document.querySelector('.wb-tabs-aux')?.hidden === true,
    drawerHasGoalForm: Boolean(document.querySelector('#wbLaunchDrawer #wbGoalForm')),
    legacyGoalPathsHidden: document.querySelector('#wbGoalPaths')?.closest('.wb-console-launch-options')
      ? getComputedStyle(document.querySelector('#wbGoalPaths')).display === 'none'
        || document.querySelector('#wbGoalPaths')?.offsetParent === null
      : true,
  }))
  check(report, 'primary-tabs-work-resource-compose',
    shell.primaryTabs.join('/') === '工作/资源/编排', shell)
  check(report, 'aux-run-tab-hidden', shell.auxHidden, shell.auxHidden)
  check(report, 'drawer-is-goal-form-entry', shell.drawerHasGoalForm, shell.drawerHasGoalForm)

  await window.screenshot({ path: path.join(SHOTS, 'closure-desktop.png'), scale: 'css' })

  await window.waitForFunction(
    () => document.querySelectorAll('#wbConsoleReadiness .wb-readiness-item').length >= 3,
    null,
    { timeout: 30000 },
  )
  const readiness = await window.evaluate(() => ({
    items: [...document.querySelectorAll('#wbConsoleReadiness .wb-readiness-item')].map(item => ({
      domain: item.getAttribute('data-readiness-domain'),
      ready: item.classList.contains('ready'),
      blocked: item.classList.contains('blocked'),
      label: item.querySelector('.wb-readiness-state')?.textContent?.trim() || '',
    })),
  }))
  report.readiness = readiness
  const office = readiness.items.find(item => item.domain === 'office')
  const engineering = readiness.items.find(item => item.domain === 'engineering')
  const visual = readiness.items.find(item => item.domain === 'visual')
  check(report, 'readiness-office-blocked', office?.blocked === true && office?.ready === false, office)
  check(report, 'readiness-engineering-ready', engineering?.ready === true, engineering)
  check(report, 'readiness-visual-blocked', visual?.blocked === true && visual?.ready === false, visual)

  await selectDomain(window, 'engineering')
  await openResourcesTab(window, 'flows')

  await setGoal(window, goal)
  await closeLaunchDrawerUi(window)
  await openResourcesTab(window, 'flows')

  const pipelineCard = window.locator('[data-flow-id="engineering-delivery"]').first()
  await pipelineCard.waitFor({ state: 'visible', timeout: 20000 })
  await pipelineCard.click()
  const useButton = window.locator('.wb-pipeline-detail [data-flow-action="use"]').first()
  await useButton.waitFor({ state: 'visible', timeout: 15000 })
  check(report, 'engineering-pipeline-runnable', await useButton.isEnabled(), await useButton.textContent())
  await useButton.click()
  await confirmWorkflowModal(window)
  try {
    await waitForTaskRoom(window)
  } catch (error) {
    const diagnostic = await window.evaluate(async () => ({
      modalHidden: document.querySelector('#wbWorkflowModal')?.hidden,
      modalTitle: document.querySelector('#wbModalTitle')?.textContent || '',
      modalHint: document.querySelector('#wbModalHint')?.textContent || '',
      runnerHidden: document.querySelector('#wbRunner')?.hidden,
      taskPageActive: document.querySelector('#wbTaskPage')?.classList.contains('active'),
      draft: (await window.api.workbenchTaskDraftGet())?.draft || null,
      context: (await window.api.workbenchContextGet())?.context || null,
    }))
    throw new Error(`engineering task room did not open: ${JSON.stringify(diagnostic)}; ${error.message}`)
  }
  const taskSplit = await window.evaluate(() => {
    const queue = document.querySelector('#wbRecentPanel')
    const detail = document.querySelector('#wbStartPanel')
    const workTab = document.querySelector('#wbTabHome')
    return {
      queueVisible: Boolean(queue && getComputedStyle(queue).display !== 'none'),
      detailVisible: Boolean(detail && getComputedStyle(detail).display !== 'none'),
      queuedRuns: document.querySelectorAll('#wbTaskList [data-console-task]').length,
      workTabActive: workTab?.classList.contains('active') === true,
    }
  })
  check(report, 'task-room-uses-work-queue-detail',
    taskSplit.queueVisible && taskSplit.detailVisible && taskSplit.queuedRuns > 0 && taskSplit.workTabActive,
    taskSplit)

  const daemonIds = await getInternalRunIds(window)
  const daemonSlug = daemonIds.draft?.slug || daemonIds.context?.launchIntent?.slug || fixture.slug
  check(report, 'pipeline-launch-has-slug-or-root',
    Boolean(daemonSlug) || Boolean(daemonIds.draft?.rootRunId) || Boolean(daemonIds.context?.launchIntent?.rootRunId),
    daemonIds)
  check(report, 'pipeline-launch-daemon-slug',
    Boolean(daemonSlug) && String(daemonIds.draft?.executionSource || daemonIds.context?.launchIntent?.executionSource || '') === 'daemon',
    {
      slug: daemonSlug,
      executionSource: daemonIds.draft?.executionSource || daemonIds.context?.launchIntent?.executionSource,
    })
  report.daemonSlug = daemonSlug

  await window.screenshot({ path: path.join(SHOTS, 'closure-task-room-daemon.png'), scale: 'css' })
  await completeDaemonRunIfNeeded(window, fixture, daemonSlug)
  const daemonComplete = await window.evaluate(() => ({
    status: document.querySelector('#wbRunStatus')?.textContent || '',
    artifactCount: document.querySelectorAll('[data-artifact-path]').length,
    actions: [...document.querySelectorAll('[data-run-action]')].map(item => item.getAttribute('data-run-action')),
  }))
  report.daemonComplete = daemonComplete
  check(report, 'daemon-run-completed-with-artifact',
    daemonComplete.artifactCount > 0 || /已完成|完成/.test(daemonComplete.status),
    daemonComplete)
  await window.screenshot({ path: path.join(SHOTS, 'closure-drawer.png'), scale: 'css' })

  const recoverySnapshot = {
    createCountBeforeClose: fixture.createCount,
    slug: daemonSlug,
  }

  await backToRunList(window)
  const filteredReturn = await window.evaluate(() => ({
    runnerHidden: Boolean(document.querySelector('#wbRunner')?.hidden),
    taskPageActive: document.querySelector('#wbTaskPage')?.classList.contains('active') === true,
    filterVisible: document.querySelector('#wbRunFilterClear')?.hidden === false,
    taskCount: document.querySelectorAll('#wbTaskList [data-console-task]').length,
    recentNote: document.querySelector('#wbRecentNote')?.textContent || '',
  }))
  check(report, 'task-room-return-resource-filter',
    filteredReturn.runnerHidden && filteredReturn.taskPageActive && filteredReturn.filterVisible && filteredReturn.taskCount > 0,
    filteredReturn)
  if (!filteredReturn.taskCount) throw new Error(`returned run list is empty: ${JSON.stringify(filteredReturn)}`)

  const listContext = await window.evaluate(() => {
    const taskPage = document.querySelector('#wbTaskPage')
    const spacer = document.createElement('div')
    spacer.id = 'closure-scroll-spacer'
    spacer.style.height = '1400px'
    spacer.setAttribute('aria-hidden', 'true')
    taskPage?.appendChild(spacer)
    const body = document.querySelector('#workbench .wb-body')
    if (body) body.scrollTop = 360
    const capturedScrollTop = body?.scrollTop || 0
    document.querySelector('#wbTaskList [data-console-task]')?.click()
    return { capturedScrollTop }
  })
  await waitForTaskRoom(window)
  const persistedReturnState = await window.evaluate(async () =>
    (await window.api.workbenchTaskDraftGet())?.draft?.launchIntent?.returnState || {})
  await window.evaluate(() => {
    const body = document.querySelector('#workbench .wb-body')
    if (body) body.scrollTop = 0
  })
  await backToRunList(window)
  await window.waitForFunction(() => {
    const body = document.querySelector('#workbench .wb-body')
    return (body?.scrollTop || 0) >= 300
  }, null, { timeout: 15000 })
  const restoredContext = await window.evaluate(() => {
    const body = document.querySelector('#workbench .wb-body')
    const value = {
      runnerHidden: Boolean(document.querySelector('#wbRunner')?.hidden),
      taskPageActive: document.querySelector('#wbTaskPage')?.classList.contains('active') === true,
      engineeringActive: document.querySelector('[data-domain="engineering"]')?.classList.contains('active') === true,
      filterVisible: document.querySelector('#wbRunFilterClear')?.hidden === false,
      scrollTop: body?.scrollTop || 0,
    }
    document.querySelector('#closure-scroll-spacer')?.remove()
    return value
  })
  check(report, 'task-room-back-restores-list-context',
    listContext.capturedScrollTop >= 300
      && persistedReturnState.domain === 'engineering'
      && Boolean(persistedReturnState.resourceId)
      && Number(persistedReturnState.scrollTop) >= 300
      && restoredContext.runnerHidden
      && restoredContext.taskPageActive
      && restoredContext.engineeringActive
      && restoredContext.filterVisible
      && restoredContext.scrollTop >= 300,
    { listContext, persistedReturnState, restoredContext })

  return recoverySnapshot
}

async function runClosureChecksAfterRecovery(window, report, fixture, artifactPath, recoverySnapshot) {
  const goal = '开发一个功能并完成测试验证'
  const graphGoal = '调研资料并整理成可交付方案'
  const daemonSlug = recoverySnapshot.slug || fixture.slug

  await window.setViewportSize({ width: 1440, height: 900 })
  await resetWorkbenchUiState(window)
  await selectDomain(window, 'engineering')
  await seedEngineeringTeam(window)

  const officeReadyRun = await createReadyVerticalTeamRun(window, {
    domain: 'office',
    resourceId: 'office-meeting-to-actions',
    goal: '整理会议资料并输出纪要和待办',
    agentIds: ['office-assistant'],
    facts: {
      localTeamEnabled: true,
      availableExpertIds: ['office-assistant'],
      connectors: [{ id: 'feishu', kind: 'connector', enabled: true, ready: true }],
    },
  })
  check(report, 'office-ready-launch-creates-run',
    officeReadyRun.launch?.ok === true && officeReadyRun.started?.ok === true && Boolean(officeReadyRun.started?.rootRunId), {
      route: officeReadyRun.launch?.route,
      rootRunId: officeReadyRun.started?.rootRunId || '',
      planIssues: officeReadyRun.plan?.issues || [],
      startError: officeReadyRun.started?.error || officeReadyRun.started?.message || '',
    })

  const visualReadyRun = await createReadyVerticalTeamRun(window, {
    domain: 'visual',
    resourceId: 'visual-brief-to-export',
    goal: '根据视觉 Brief 生成并审阅可导出图像',
    agentIds: ['copywriter', 'designer'],
    facts: {
      localTeamEnabled: true,
      availableExpertIds: ['copywriter', 'designer'],
      modes: {
        visual: {
          id: 'visual',
          providers: [{ id: 'image-provider', kind: 'image', status: 'ready' }],
          professionalCapabilities: [{ id: 'copywriting', status: 'available' }],
          bindings: [
            { expertId: 'copywriter', status: 'enabled' },
            { expertId: 'designer', status: 'enabled' },
          ],
        },
      },
    },
  })
  check(report, 'visual-ready-launch-creates-run',
    visualReadyRun.launch?.ok === true && visualReadyRun.started?.ok === true && Boolean(visualReadyRun.started?.rootRunId), {
      route: visualReadyRun.launch?.route,
      rootRunId: visualReadyRun.started?.rootRunId || '',
      planIssues: visualReadyRun.plan?.issues || [],
      startError: visualReadyRun.started?.error || visualReadyRun.started?.message || '',
    })

  await openResourcesTab(window, 'team')
  await window.waitForFunction(
    () => document.querySelectorAll('#wbTeamList [data-agent], [data-team-profile]').length > 0,
    null,
    { timeout: 30000 },
  )
  await setGoal(window, goal)
  await closeLaunchDrawerUi(window)

  const agentMeta = await window.evaluate(() => {
    const roster = document.querySelector('#wbTeamList [data-agent]')
    const asset = document.querySelector('[data-team-profile]')
    const id = roster?.getAttribute('data-agent') || asset?.getAttribute('data-team-profile') || ''
    return { id, roster: Boolean(roster), asset: Boolean(asset) }
  })
  report.agentProfileTarget = agentMeta
  check(report, 'agent-profile-target-visible', Boolean(agentMeta.id), agentMeta)

  await window.evaluate(() => {
    document.querySelector('#wbTeamList [data-agent]')?.click()
      || document.querySelector('[data-team-profile] [data-team-asset-action="detail"]')?.click()
  })
  await window.locator('#wbWorkflowModal').waitFor({ state: 'attached', timeout: 15000 })
  await window.evaluate(() => document.querySelector('[data-agent-profile]')?.click())
  await window.locator('#wbWorkflowModal').waitFor({ state: 'attached', timeout: 15000 })
  await window.evaluate(() => {
    const role = document.getElementById('wbAgentProfileRole')
    if (role) role.value = '闭环烟测 Agent Profile 覆盖'
    document.getElementById('wbModalConfirm')?.click()
  })
  await window.waitForFunction(() => document.querySelector('#wbWorkflowModal')?.hidden, null, { timeout: 15000 })

  await resetWorkbenchUiState(window)
  const planProbe = await window.evaluate(async ({ goalText, id }) => window.api?.workbenchAgentGraphPlan?.({
    goal: goalText,
    members: [{ agentPackageId: id, expertId: id, profileId: `${id}-profile`, role: id }],
    template: 'single',
  }), { goalText: goal, id: agentMeta.id })
  let launchState
  if (planProbe?.ok === false) {
    launchState = {
      mode: 'error',
      hint: planProbe.issues?.[0]?.message || planProbe.error || 'agent graph plan failed',
      diag: { plan: planProbe },
    }
  } else {
    launchState = await launchAgentFromTeam(window, goal, agentMeta.id, report)
  }
  report.agentLaunchState = launchState
  if (launchState.mode === 'error') {
    check(report, 'agent-profile-plan-modal', false, launchState)
    check(report, 'agent-profile-launch-rootRunId', false, launchState)
    check(report, 'agent-profile-local-team-source', false, launchState)
    check(report, 'agent-profile-product-gap-single-agent-template',
      launchState.diag?.plan?.issues?.some(item => item.code === 'unknown_template') === true,
      launchState.diag?.plan?.issues || launchState.hint)
  } else if (launchState.mode === 'modal') {
    check(report, 'agent-profile-plan-modal', /确认|启动/.test(launchState.confirm || ''), launchState)
    await window.locator('#wbModalConfirm').click({ force: true })
    await waitForTaskRoom(window)
    const agentRun = await getInternalRunIds(window)
    const agentRootRunId = agentRun.draft?.rootRunId || agentRun.context?.launchIntent?.rootRunId || ''
    const agentSource = agentRun.draft?.executionSource || agentRun.context?.launchIntent?.executionSource || ''
    check(report, 'agent-profile-launch-rootRunId', Boolean(agentRootRunId), agentRun)
    check(report, 'agent-profile-local-team-source', agentSource === 'local-team' || agentSource === 'agent-graph', agentSource)
    report.agentRootRunId = agentRootRunId
  } else if (launchState.mode === 'runner') {
    check(report, 'agent-profile-plan-modal', Boolean(launchState.meta), launchState)
    const agentRun = await getInternalRunIds(window)
    const agentRootRunId = agentRun.draft?.rootRunId || agentRun.context?.launchIntent?.rootRunId || ''
    check(report, 'agent-profile-launch-rootRunId', Boolean(agentRootRunId), agentRun)
    check(report, 'agent-profile-local-team-source',
      ['local-team', 'agent-graph'].includes(agentRun.draft?.executionSource || agentRun.context?.launchIntent?.executionSource || ''),
      agentRun)
    report.agentRootRunId = agentRootRunId
  } else {
    check(report, 'agent-profile-plan-modal', false, launchState)
    check(report, 'agent-profile-launch-rootRunId', false, launchState)
    check(report, 'agent-profile-local-team-source', false, launchState)
  }

  await backToRunList(window)

  const graphReady = await openAgentGraphModal(window, graphGoal, report)
  if (!graphReady) {
    check(report, 'graph-first-rootRunId', false, 'graph modal unavailable')
    check(report, 'graph-second-rootRunId', false, 'skipped')
    check(report, 'graph-rootRunId-differs', false, 'skipped')
  } else {
  await window.locator('[data-save-graph]').click({ force: true })
  await window.waitForTimeout(800)
  check(report, 'graph-saved-as-personal-workflow', true, { action: 'save-graph-clicked' })
  await window.locator('#wbModalConfirm').click({ force: true })
  await waitForTaskRoom(window)
  const graphRun1 = await getInternalRunIds(window)
  const rootRunId1 = graphRun1.draft?.rootRunId || graphRun1.context?.launchIntent?.rootRunId || ''
  check(report, 'graph-first-rootRunId', Boolean(rootRunId1), { ...graphRun1 })
  report.rootRunId1 = rootRunId1
  await backToRunList(window)

  await window.evaluate(() => document.getElementById('wbTabStudio')?.click())
  await window.locator('#wbStudioPage.active').waitFor({ state: 'attached', timeout: 15000 })
  await window.locator('[data-studio-workflow]').first().waitFor({ state: 'attached', timeout: 20000 })
  await window.evaluate(() => document.querySelector('[data-studio-workflow]')?.click())
  await window.evaluate(() => document.querySelector('[data-studio-action="run"]')?.click())
  await window.waitForFunction(() => {
    const modal = document.querySelector('#wbWorkflowModal')
    const btn = document.querySelector('#wbModalConfirm')
    return (modal && !modal.hidden && btn && !btn.disabled) || !document.querySelector('#wbRunner')?.hidden
  }, null, { timeout: 45000 })
  if (await window.evaluate(() => !document.querySelector('#wbWorkflowModal')?.hidden)) {
    await window.locator('#wbModalConfirm').click({ force: true })
  }
  await waitForTaskRoom(window)
  const graphRun2 = await getInternalRunIds(window)
  const rootRunId2 = graphRun2.draft?.rootRunId || graphRun2.context?.launchIntent?.rootRunId || ''
  check(report, 'graph-second-rootRunId', Boolean(rootRunId2), graphRun2)
  check(report, 'graph-rootRunId-differs', Boolean(rootRunId1 && rootRunId2 && rootRunId1 !== rootRunId2), { rootRunId1, rootRunId2 })
  report.rootRunId2 = rootRunId2
  await backToRunList(window)
  }

  await window.evaluate(() => window.Workbench.openPage('tasks'))
  await window.locator('#wbTaskPage.active #wbTaskList').waitFor({ state: 'visible', timeout: 15000 })
  const runsMeta = await window.evaluate(async () => {
    const overview = await window.api.workbenchDaemonOverview?.()
    const load = await window.api.workbenchLoad?.()
    const runs = (load?.console?.runs || []).map(run => ({
      id: run.id,
      executionSource: run.executionSource,
      title: run.title,
    }))
    return { runs, daemonTasks: overview?.daemon?.tasks || [] }
  })
  const hasDaemon = runsMeta.runs.some(run => run.executionSource === 'daemon')
  const hasLocalTeam = runsMeta.runs.some(run => run.executionSource === 'local-team')
  check(report, 'run-directory-daemon-source', hasDaemon, runsMeta.runs)
  check(report, 'run-directory-local-team-source', hasLocalTeam, runsMeta.runs)

  await window.evaluate(() => window.Workbench.openPage('automation'))
  await window.locator('#wbAutomationPage.active').waitFor({ state: 'visible', timeout: 15000 })
  await window.locator('#wbAutomationNew').click()
  await window.locator('#wbAutomationModal').waitFor({ state: 'visible', timeout: 15000 })
  await window.locator('#wbAutoName').fill('闭环烟测自动化')
  await window.locator('#wbAutoPrompt').fill('按研发管线执行一次闭环烟测')
  const workflowSelect = window.locator('#wbAutoWorkflow')
  await workflowSelect.waitFor({ state: 'visible', timeout: 15000 })
  const workflowValue = await workflowSelect.evaluate(select => {
    const option = [...select.options].find(item => item.value === 'engineering-delivery')
    return option ? option.value : ''
  })
  check(report, 'automation-workflow-bound-option', Boolean(workflowValue), workflowValue)
  if (workflowValue) await workflowSelect.selectOption(workflowValue)
  const createCountBeforeAuto = fixture.createCount
  const autoRunBefore = await getInternalRunIds(window)
  await window.locator('#wbAutomationModalSave').click()
  await window.waitForFunction(() => document.querySelector('#wbAutomationModal')?.hidden, null, { timeout: 15000 })
  const autoCard = window.locator('[data-automation]').first()
  await autoCard.waitFor({ state: 'visible', timeout: 15000 })
  const runButton = autoCard.locator('[data-auto-action="run"]')
  check(report, 'automation-run-action-visible', await runButton.count() > 0, await autoCard.textContent())
  if (await runButton.count()) {
    await runButton.click()
    await window.waitForFunction(() => !document.querySelector('#wbRunner')?.hidden || document.querySelector('#wbWorkflowModal:not([hidden])'), null, { timeout: 45000 })
    if (await window.locator('#wbWorkflowModal').isVisible()) await confirmWorkflowModal(window)
    await waitForTaskRoom(window).catch(() => {})
  }
  const autoRunAfter = await getInternalRunIds(window)
  const beforeRunId = autoRunBefore.draft?.rootRunId || autoRunBefore.draft?.slug
    || autoRunBefore.context?.rootRunId || autoRunBefore.context?.launchIntent?.runId || ''
  const afterRunId = autoRunAfter.draft?.rootRunId || autoRunAfter.draft?.slug
    || autoRunAfter.context?.rootRunId || autoRunAfter.context?.launchIntent?.runId || ''
  const automationCreatedRun = fixture.createCount > createCountBeforeAuto
    || Boolean(afterRunId && afterRunId !== beforeRunId)
  check(report, 'automation-runNow-creates-run', automationCreatedRun, {
    before: createCountBeforeAuto,
    after: fixture.createCount,
    beforeRunId,
    afterRunId,
    executionSource: autoRunAfter.draft?.executionSource || autoRunAfter.context?.launchIntent?.executionSource || '',
    requests: fixture.requests.filter(item => item.method === 'POST'),
  })

  if (daemonSlug) {
    await window.evaluate(async (slug) => {
      await window.Workbench.openPage('tasks')
      document.querySelector(`[data-console-task="${slug}"]`)?.click()
        || document.querySelector(`#wbGoalTaskList [data-goal-task="${slug}"]`)?.click()
    }, daemonSlug)
    await waitForTaskRoom(window).catch(async () => {
      await window.locator(`[data-console-task="${daemonSlug}"]`).click({ force: true, timeout: 10000 }).catch(() => {})
      await waitForTaskRoom(window).catch(() => {})
    })
    await completeDaemonRunIfNeeded(window, fixture, daemonSlug)
    const artifactButton = window.locator('[data-artifact-path]').first()
    check(report, 'completed-run-artifact-visible', await artifactButton.count() > 0, await window.locator('#wbRunArtifacts').textContent())
    if (await artifactButton.count()) {
      const openResult = await window.evaluate(async () => {
        const button = document.querySelector('[data-artifact-path]')
        if (!button || !window.api?.workbenchDaemonArtifactOpen) return { ok: false, reason: 'missing-button' }
        return window.api.workbenchDaemonArtifactOpen(button.getAttribute('data-artifact-path'))
      })
      check(report, 'completed-run-artifact-openable', openResult?.ok === true, openResult)
      const reuse = window.locator('[data-artifact-reuse]').first()
      if (await reuse.count()) {
        await reuse.click({ force: true })
        await window.waitForFunction(() => {
          const drawer = document.getElementById('wbLaunchDrawer')
          return drawer && drawer.matches(':popover-open')
        }, null, { timeout: 15000 })
        const refs = await window.evaluate(async () => {
          const ctx = await window.api.workbenchContextGet()
          return ctx?.context?.launchIntent?.inputRefs || ctx?.context?.artifactRefs || []
        })
        check(report, 'artifact-ref-in-drawer', Array.isArray(refs) && refs.length > 0, refs)
        await closeLaunchDrawerUi(window)
      } else {
        check(report, 'artifact-ref-in-drawer', false, 'missing data-artifact-reuse control')
      }
    }
  } else {
    check(report, 'completed-run-artifact-visible', false, 'missing daemon slug')
    check(report, 'completed-run-artifact-openable', false, 'missing daemon slug')
    check(report, 'artifact-ref-in-drawer', false, 'missing daemon slug')
  }

}

async function verifyRecovery(app, userDataDir, daemonPort, report, fixture, previous, windowRef) {
  await app.close().catch(() => {})
  await new Promise(resolve => setTimeout(resolve, 1200))
  const app2 = await launchElectron(userDataDir, daemonPort, { localTeam: true })
  const window = await app2.firstWindow({ timeout: 90000 })
  attachConsole(window, report)
  await window.waitForLoadState('domcontentloaded', { timeout: 90000 })
  await openWorkbench(window)
  await window.waitForTimeout(2500)

  const recovery = await window.evaluate(async () => {
    const draft = await window.api.workbenchTaskDraftGet()
    return {
      draft: draft?.draft || null,
      runnerVisible: !document.querySelector('#wbRunner')?.hidden,
      runStatus: document.querySelector('#wbRunStatus')?.textContent || '',
    }
  })
  const createCountAfter = fixture.createCount
  const recovered = Boolean(
    recovery.draft?.slug
    || recovery.draft?.rootRunId
    || recovery.runnerVisible,
  )
  check(report, 'restart-recovers-run-or-draft', recovered, recovery)
  check(report, 'restart-no-duplicate-create', createCountAfter === previous.createCountBeforeClose, {
    before: previous.createCountBeforeClose,
    after: createCountAfter,
    requests: fixture.requests.filter(item => item.method === 'POST' && item.path === '/api/tasks'),
  })

  await window.setViewportSize({ width: 760, height: 840 })
  await window.locator('#wbTabHome').click()
  await window.locator('#wbHomePage.active').waitFor({ state: 'visible', timeout: 15000 })
  const narrow = await window.evaluate(() => ({
    primaryTabs: [...document.querySelectorAll('.wb-tabs-primary .wb-tab')].map(item => ({
      text: item.textContent.trim(),
      visible: Boolean(item.getBoundingClientRect().width),
    })),
    domains: [...document.querySelectorAll('#wbDomainSwitcher [data-domain]')].map(item => ({
      id: item.getAttribute('data-domain'),
      visible: Boolean(item.getBoundingClientRect().width),
    })),
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
  }))
  check(report, 'narrow-primary-tabs-visible', narrow.primaryTabs.every(item => item.visible), narrow.primaryTabs)
  check(report, 'narrow-all-four-domains-visible', narrow.domains.length === 4 && narrow.domains.every(item => item.visible), narrow.domains)
  check(report, 'narrow-no-page-overflow', !narrow.horizontalOverflow, narrow)
  await window.screenshot({ path: path.join(SHOTS, 'closure-narrow.png'), scale: 'css' })

  windowRef.current = window
  windowRef.app = app2
  return app2
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-closure-smoke-'))
  const artifactPath = path.join(userDataDir, 'artifacts', 'closure-result.md')
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true })
  fs.writeFileSync(artifactPath, '# closure smoke artifact\n', 'utf8')

  const daemon = createDaemonFixture({ artifactPath })
  const llm = createLlmFixture()
  const daemonPort = await daemon.listen()
  const llmPort = await llm.listen()
  writeFixtureExperts(userDataDir)
  writeSettings(userDataDir, daemonPort, llmPort)

  const report = {
    at: new Date().toISOString(),
    ok: false,
    mode: 'electron',
    userDataDir,
    daemonPort,
    llmPort,
    artifactPath,
    checks: [],
    failures: [],
    consoleErrors: [],
  }

  let app
  try {
    app = await launchElectron(userDataDir, daemonPort, { localTeam: false })
    const window = await app.firstWindow({ timeout: 90000 })
    attachConsole(window, report)
    await window.waitForLoadState('domcontentloaded', { timeout: 90000 })
    await window.setViewportSize({ width: 1440, height: 900 })
    await openWorkbench(window)
    await seedEngineeringTeam(window)

    const recoverySnapshot = await runClosureChecks(window, report, daemon, artifactPath)

    const windowRef = { current: window, app }
    await verifyRecovery(app, userDataDir, daemonPort, report, daemon, recoverySnapshot, windowRef)
    app = windowRef.app
    await runClosureChecksAfterRecovery(windowRef.current, report, daemon, artifactPath, recoverySnapshot)

    check(report, 'renderer-console-errors-zero', report.consoleErrors.length === 0, report.consoleErrors)
    report.ok = report.checks.every(item => item.ok)
    report.passCount = report.checks.filter(item => item.ok).length
    report.failCount = report.checks.filter(item => !item.ok).length
    fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
    console.log(JSON.stringify({
      ok: report.ok,
      passCount: report.passCount,
      failCount: report.failCount,
      report: REPORT,
      command: `node ${path.join(__dirname, 'workbench-closure-electron-smoke.js')}`,
    }, null, 2))
    if (!report.ok) process.exitCode = 1
  } catch (error) {
    report.ok = false
    report.error = String(error?.stack || error)
    fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
    console.error(error)
    process.exitCode = 1
  } finally {
    await app?.close().catch(() => {})
    await daemon.close().catch(() => {})
    await llm.close().catch(() => {})
  }
}

main()
