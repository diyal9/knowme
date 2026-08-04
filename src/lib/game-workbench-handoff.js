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

function assessDaemonReadiness(daemonOverview = {}) {
  if (!daemonOverview || typeof daemonOverview !== 'object') {
    return {
      ready: false,
      code: 'offline',
      message: '无法读取 Workbench 服务状态，请确认 Daemon 已启动',
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
        recovery: ['在工作台点击「连接工作服务」完成认证'],
      }
    }
  }
  if (!daemonOverview.online) {
    return {
      ready: false,
      code: daemonOverview.code || 'offline',
      message: daemonOverview.error || 'Workbench 服务未就绪',
      recovery: ['启动本机 Workbench Daemon', '检查防火墙与端口占用', '验证 endpoint 配置'],
    }
  }
  return { ready: true, code: 'ready', message: 'Workbench 已就绪', recovery: [] }
}

function pickWorkflow(daemonOverview = {}, scene = {}, preferredId = '') {
  const workflows = Array.isArray(daemonOverview.workflows) ? daemonOverview.workflows : []
  const want = String(preferredId || scene.defaultWorkflow || 'team-run').trim()
  const hit = workflows.find(w => w.id === want)
  if (hit) return hit
  const devTagged = workflows.find(w => /dev|team|run|game/i.test(`${w.id} ${w.name}`))
  if (devTagged) return devTagged
  return workflows[0] || null
}

function buildHandoff({
  requirementDoc,
  daemonOverview = {},
  scene = {},
  workflowId = '',
  repo = null,
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
      error: 'Daemon 未返回可用工作流，无法交接研发任务',
      recovery: ['确认激活内容源包含 .cursor/workflows/', '在 Daemon 侧注册 team-run 等工作流'],
      requirement: { id: doc.id, title: doc.title, validation },
      blocked: true,
    }
  }

  const slug = slugify(doc.title)
  const intent = [
    `游戏需求研发：${doc.title}`,
    gameReq.buildPromptContext(doc).slice(0, 2000),
  ].join('\n\n')

  const context = {
    inputs: {
      prd: `requirements/${slug}.md`,
      requirementId: doc.id,
      requirementTitle: doc.title,
    },
    workspace: repo?.id ? { projectId: repo.id, ref: 'main' } : undefined,
    meta: {
      sceneId: scene.id || 'game-dev',
      skillId: scene.skillId || 'game-dev-delivery',
      sources: doc.sources || [],
      handoffFrom: 'game-requirement',
    },
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
  pickWorkflow,
  buildHandoff,
  formatTaskTrace,
}
