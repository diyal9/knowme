'use strict'

const gameReq = require('./game-requirement')

function slugify(title) {
  const base = String(title || 'game-req')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  const ascii = base.replace(/[^\x00-\x7f]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '')
  const slug = ascii || 'game-req'
  const suffix = Date.now().toString(36).slice(-4)
  return `${slug}-${suffix}`.slice(0, 80)
}

function workflowNeedsCli(workflow = {}) {
  if (workflow.cliRequired === false) return false
  const tags = Array.isArray(workflow.tags) ? workflow.tags.map(String) : []
  if (tags.some(t => /script-only|no-cli/i.test(t))) return false
  const blob = `${workflow.id || ''} ${workflow.name || ''} ${workflow.description || ''}`
  if (/game-dev-delivery|script-only|交付包/i.test(blob)) return false
  return true
}

function assessDaemonReadiness(daemonOverview = {}, options = {}) {
  if (!daemonOverview || typeof daemonOverview !== 'object') {
    return {
      ready: false,
      code: 'offline',
      message: '无法读取 Workbench 服务状态，请确认管线服务已启动',
      recovery: ['打开设置 → Workbench 连接', '确认本机 127.0.0.1:8010 或配置的 HTTPS 端点可达', '检查 Bearer Token 是否有效'],
    }
  }
  const auth = daemonOverview.auth || {}
  if (daemonOverview.authRequired === true || auth.state === 'required') {
    const workflows = Array.isArray(daemonOverview.workflows) ? daemonOverview.workflows : []
    if (!daemonOverview.online || workflows.length === 0) {
      return {
        ready: false,
        code: 'auth_required',
        message: 'Workbench 需要登录后才能启动工作流',
        recovery: ['在工作台点击「连接管线服务」完成认证'],
      }
    }
  }
  if (!daemonOverview.online) {
    return {
      ready: false,
      code: daemonOverview.code || 'offline',
      message: daemonOverview.error || 'Workbench 服务未就绪',
      recovery: ['启动本机 Workbench 管线服务', '检查防火墙与端口占用', '验证 endpoint 配置'],
    }
  }
  return { ready: true, code: 'ready', message: 'Workbench 已就绪', recovery: [] }
}

/**
 * Launch-time preflight for Daemon compose / handoff.
 * CLI workflows require cursor API key + executor heartbeat.
 */
function assessLaunchPreflight({ daemon = {}, workflow = null, executorReady, cursorApiKeyReady } = {}) {
  const overview = daemon && typeof daemon === 'object' ? daemon : {}
  const readiness = assessDaemonReadiness(overview)
  if (!readiness.ready) {
    return {
      ok: false,
      code: readiness.code,
      message: readiness.message,
      recovery: readiness.recovery || [],
    }
  }
  if (!workflow || !workflow.id) {
    return {
      ok: false,
      code: 'no_workflow',
      message: '请选择交付路径',
      recovery: ['在创建表单选择一条可用交付路径'],
    }
  }
  if (workflow.locked) {
    return {
      ok: false,
      code: 'path_locked',
      message: '该交付路径已锁定，暂不可启动',
      recovery: ['选择其他未锁定的交付路径'],
    }
  }
  if (!workflowNeedsCli(workflow)) {
    return { ok: true, code: 'ready', message: '可启动（脚本工作流无需 CLI）', recovery: [] }
  }

  const keyReady = cursorApiKeyReady !== undefined
    ? cursorApiKeyReady !== false
    : overview.cursorApiKeyReady !== false
  const execReady = executorReady !== undefined
    ? executorReady !== false
    : overview.executorReady !== false

  if (keyReady === false) {
    return {
      ok: false,
      code: 'cursor_api_key',
      message: '当前工作流需要 Cursor Agent CLI，但未检测到 CURSOR_API_KEY',
      recovery: [
        '在管线服务仓库 .nine/.env.local 配置 CURSOR_API_KEY（或 CURSOR_API）',
        '重启管线服务后再试',
      ],
    }
  }
  if (execReady === false) {
    const detail = overview.executor?.message || '管线执行器未就绪'
    return {
      ok: false,
      code: 'executor_not_ready',
      message: detail,
      recovery: [
        '确认 Daemon executor 进程在线',
        '检查 .nine/.env.local 中的 CURSOR_API_KEY',
        '运行 python -m tools.workflow_runner.daemon doctor 自检',
      ],
    }
  }
  return { ok: true, code: 'ready', message: '可启动', recovery: [] }
}

function resolveRepoContext(repo = null) {
  if (!repo || typeof repo !== 'object') return null
  const projectId = String(
    repo.projectId || repo.projectPath || repo.ownerRepo || '',
  ).trim()
  if (!projectId) return null
  return {
    projectId,
    ref: String(repo.ref || repo.branch || 'main').trim() || 'main',
  }
}

function pickWorkflow(daemonOverview = {}, scene = {}, preferredId = '') {
  const workflows = Array.isArray(daemonOverview.workflows) ? daemonOverview.workflows : []
  const want = String(preferredId || scene.defaultWorkflow || 'game-dev-delivery').trim()
  const hit = workflows.find(w => w.id === want)
  if (hit) return hit
  const gameDelivery = workflows.find(w => w.id === 'game-dev-delivery')
  if (gameDelivery) return gameDelivery
  const devTagged = workflows.find(w => /game-dev-delivery|dev|team|run|game/i.test(`${w.id} ${w.name}`))
  if (devTagged) return devTagged
  return workflows[0] || null
}

function buildHandoff({
  requirementDoc,
  daemonOverview = {},
  scene = {},
  workflowId = '',
  repo = null,
  executorReady = undefined,
} = {}) {
  const readiness = assessDaemonReadiness(daemonOverview)
  if (!requirementDoc) {
    return { ok: false, code: 'missing_requirement', error: '缺少需求案' }
  }

  const approval = requirementDoc.status === 'approved'
    ? { ok: true }
    : gameReq.approve(requirementDoc)
  const doc = approval.ok ? (approval.doc || requirementDoc) : requirementDoc
  const validation = gameReq.validate(doc)

  if (!readiness.ready) {
    return {
      ok: false,
      code: readiness.code,
      error: readiness.message,
      recovery: readiness.recovery,
      requirement: { id: doc.id, title: doc.title, validation },
      blocked: true,
    }
  }

  const workflow = pickWorkflow(daemonOverview, scene, workflowId)
  if (!workflow || !workflow.id) {
    return {
      ok: false,
      code: 'no_workflow',
      error: '管线服务未返回可用工作流，无法交接研发任务',
      recovery: ['确认激活内容源包含 .cursor/workflows/', '运行 npm run workbench:sync 注册 game-dev-delivery'],
      requirement: { id: doc.id, title: doc.title, validation },
      blocked: true,
    }
  }

  if (workflowNeedsCli(workflow) && executorReady === false) {
    return {
      ok: false,
      code: 'executor_not_ready',
      error: '当前工作流需要 Cursor Agent CLI，但管线服务执行器未就绪（缺少 CURSOR_API_KEY）',
      recovery: [
        '在 Workbench 仓库 .nine/.env.local 配置 CURSOR_API_KEY',
        '或改用「手机游戏研发交付」(game-dev-delivery) 脚本工作流',
        '运行 python -m tools.workflow_runner.daemon doctor 自检',
      ],
      requirement: { id: doc.id, title: doc.title, validation },
      workflow: workflow.id,
      blocked: true,
    }
  }

  const launchPreflight = assessLaunchPreflight({
    daemon: daemonOverview,
    workflow,
    executorReady,
    cursorApiKeyReady: daemonOverview.cursorApiKeyReady,
  })
  if (!launchPreflight.ok) {
    return {
      ok: false,
      code: launchPreflight.code,
      error: launchPreflight.message,
      recovery: launchPreflight.recovery,
      requirement: { id: doc.id, title: doc.title, validation },
      workflow: workflow.id,
      blocked: true,
    }
  }

  const slug = slugify(doc.title)
  const intent = [
    `游戏需求研发：${doc.title}`,
    gameReq.buildPromptContext(doc).slice(0, 2000),
  ].join('\n\n')

  const meta = {
    sceneId: scene.id || 'game-dev',
    skillId: scene.skillId || 'game-dev-delivery',
    sources: doc.sources || [],
    handoffFrom: 'game-requirement',
  }

  const context = { meta }
  const repoCtx = resolveRepoContext(repo)
  if (repoCtx) {
    context.workspace = { projectId: repoCtx.projectId, ref: repoCtx.ref }
    context.inputs = {
      prd: `requirements/${slug}.md`,
      requirementId: doc.id,
      requirementTitle: doc.title,
    }
  }

  return {
    ok: true,
    blocked: false,
    workflow: workflow.id,
    workflowName: workflow.name,
    slug,
    intent,
    context,
    requirement: {
      id: doc.id,
      title: doc.title,
      status: doc.status,
      validation,
      markdown: gameReq.toMarkdown(doc),
    },
    trace: {
      sceneId: scene.id || 'game-dev',
      skillId: scene.skillId || 'game-dev-delivery',
      connectors: scene.connectors || ['feishu'],
      sessionCompatMode: 'coding',
    },
  }
}

function formatTaskTrace(handoff = {}, session = {}) {
  return {
    sceneId: handoff.trace?.sceneId || '',
    sceneLabel: handoff.trace?.sceneLabel || '',
    skillId: handoff.trace?.skillId || '',
    connectors: handoff.trace?.connectors || [],
    knowledgeSources: handoff.requirement?.sources || [],
    sessionId: session.id || '',
    runId: session.run?.id || '',
    workflow: handoff.workflow || '',
    slug: handoff.slug || '',
  }
}

module.exports = {
  slugify,
  assessDaemonReadiness,
  assessLaunchPreflight,
  workflowNeedsCli,
  resolveRepoContext,
  pickWorkflow,
  buildHandoff,
  formatTaskTrace,
}
