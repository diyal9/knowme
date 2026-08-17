'use strict'

const DOMAIN_META = Object.freeze({
  all: { id: 'all', name: '全部' },
  office: { id: 'office', name: '日常办公' },
  engineering: { id: 'engineering', name: '软件研发' },
  visual: { id: 'visual', name: '视觉创作' },
})

const VERTICAL_PIPELINE_SEEDS = Object.freeze([
  // Legacy id 解析兼容（历史自动化 / 启动请求）；货架不再注入这些演示卡。
  {
    id: 'office-meeting-to-actions',
    name: '会议资料 → 纪要与待办',
    description: '整理会议资料，提取决策、负责人、截止时间并生成可追踪产物。',
    source: 'official',
    goalTypes: ['office', 'meeting', 'minutes'],
    inputs: [{ id: 'meeting-materials', label: '会议资料', required: true }],
    outputs: [{ id: 'minutes', label: '会议纪要' }, { id: 'actions', label: '决策与待办' }],
    agentRefs: [{ id: 'office-assistant' }],
    executionBackends: ['local-team'],
    qualityGates: [{ id: 'owner-and-deadline', label: '待办必须包含负责人和截止时间' }],
    provenance: { kind: 'vertical-slice', domain: 'office', blockedBy: 'office-agent-or-connector' },
  },
  {
    id: 'engineering-delivery',
    name: '需求 → 实现 → 测试 → 交付',
    description: '通过产品、开发和测试 Agent 完成可验证的软件交付。',
    source: 'official',
    goalTypes: ['engineering', 'delivery'],
    inputs: [{ id: 'requirement', label: '需求与仓库', required: true }],
    outputs: [{ id: 'change', label: '代码变更' }, { id: 'evidence', label: '测试与交付证据' }],
    agentRefs: [{ id: 'producer' }, { id: 'developer' }, { id: 'tester' }],
    executionBackends: ['local-team', 'daemon'],
    qualityGates: [{ id: 'test-and-lint', label: '测试与 lint 门禁' }],
    provenance: { kind: 'vertical-slice', domain: 'engineering', blockedBy: 'engineering-runtime' },
  },
  {
    id: 'visual-brief-to-export',
    name: 'Brief → 生成 → 审阅 → 导出',
    description: '把视觉 Brief 转为文案与提示词，生成图像并经人工审阅后导出。',
    source: 'official',
    goalTypes: ['visual', 'image', 'campaign'],
    inputs: [{ id: 'brief', label: '视觉 Brief', required: true }],
    outputs: [{ id: 'prompt', label: '文案与提示词' }, { id: 'image', label: '审阅后的图像' }],
    agentRefs: [{ id: 'copywriter' }, { id: 'designer' }],
    executionBackends: ['local-team'],
    qualityGates: [{ id: 'human-review', label: '导出前人工审阅' }],
    provenance: { kind: 'vertical-slice', domain: 'visual', blockedBy: 'image-provider' },
  },
])

const OFFICE_EXPERT_IDS = Object.freeze(['office-assistant', 'office-partner'])
const ENGINEERING_EXPERT_IDS = Object.freeze(['producer', 'developer', 'tester'])
const VISUAL_EXPERT_IDS = Object.freeze(['designer', 'copywriter'])
const OFFICE_CONNECTOR_IDS = Object.freeze(['feishu'])
const OFFICE_CONNECTOR_KINDS = Object.freeze(['connector', 'feishu', 'meeting', 'document'])

const READY = new Set(['ready', 'available', 'online', 'enabled'])
const ACTIVE = new Set(['running', 'queued', 'pending', 'preparing', 'created', 'starting'])
const WAITING = new Set(['waiting', 'blocked', 'gate', 'clarification', 'approval_required', 'paused'])
const SUCCESS = new Set(['done', 'completed', 'finished', 'success', 'succeeded'])
const FAILURE = new Set(['failed', 'error', 'rejected'])
const CANCELLED = new Set(['cancelled', 'canceled'])

const { text, list, normalizeRunStatus, domainOf, executionSourceOf, timestampOf, artifactCountOf, projectRun, isReadyStatus, expertSet, modeByDomain, buildVerticalPipelineFacts, officeConnectorReady, officeAgentReady, engineeringRuntimeReady, visualCapabilityReady, resolveOfficeReadiness, resolveEngineeringReadiness, resolveVisualReadiness, resolveVerticalPipeline, resolveVerticalPipelines, resolveVerticalPipelineById } = require('./workbench-console-readiness')


function buildAutomationLaunchRequest(job = {}, facts = {}) {
  const workflowId = text(job.workflowId)
  const domain = text(job.domain) || domainOf(job)
  const backend = text(job.backend)
  if (!workflowId || !domain || !backend) {
    return { ok: false, code: 'scheduler_unavailable', error: '该自动化尚未绑定可执行 Workflow Package，不能立即执行' }
  }
  const resolved = resolveVerticalPipelineById(workflowId, facts)
  if (!resolved) {
    return { ok: false, code: 'pipeline_unknown', error: '绑定的 Workflow Package 不存在或不可用' }
  }
  if (!resolved.readiness.ready) {
    return {
      ok: false,
      code: 'pipeline_blocked',
      error: '绑定的 Workflow Package 当前不可运行',
      blockers: resolved.readiness.blockers,
      repairAction: resolved.readiness.repairAction,
    }
  }
  const launchBackend = backend || resolved.readiness.backend
  if (!launchBackend || !list(resolved.package.executionBackends).includes(launchBackend)) {
    return { ok: false, code: 'backend_unavailable', error: '所选执行后端当前不可用' }
  }
  return {
    ok: true,
    launchRequest: {
      domain,
      resourceType: 'workflow',
      resourceId: workflowId,
      goal: text(job.prompt),
      backend: launchBackend,
      inputRefs: [],
      returnState: { automationJobId: text(job.id) },
    },
  }
}

function projectAutomation(job = {}) {
  const workflowId = text(job.workflowId)
  const domain = text(job.domain) || domainOf(job)
  const backend = text(job.backend)
  const runCapable = Boolean(workflowId && domain && backend)
  return {
    id: text(job.id),
    name: text(job.name) || '未命名自动化',
    domain,
    enabled: job.enabled !== false,
    lastStatus: normalizeRunStatus(job.lastStatus),
    lastRunAt: text(job.lastRunAt),
    nextRunAt: text(job.nextRunAt),
    runCapable,
    workflowId,
    backend,
    blockedReason: runCapable ? '' : '尚未绑定可执行管线',
  }
}

function workflowDomainCounts(workflows) {
  const counts = { office: 0, engineering: 0, visual: 0 }
  for (const workflow of list(workflows)) {
    if (['unavailable', 'archived'].includes(text(workflow?.status).toLowerCase())) continue
    counts[domainOf(workflow)] += 1
  }
  return counts
}

function modeMap(modes) {
  const state = modes && typeof modes === 'object' ? modes : {}
  return new Map(list(state.modes).map(mode => [text(mode.id), mode]))
}

function readinessForDomain(domain, mode, context, pipelineCount) {
  const providers = list(mode?.providers)
  const capabilities = list(mode?.professionalCapabilities)
  const providerReady = providers.some(provider => READY.has(text(provider.status).toLowerCase()))
  const capabilityReady = capabilities.some(capability => READY.has(text(capability.status).toLowerCase()))
  const blockers = providers
    .filter(provider => !READY.has(text(provider.status).toLowerCase()))
    .map(provider => ({
      id: text(provider.id),
      label: text(provider.label) || '未配置服务',
      kind: text(provider.kind) || 'provider',
      status: text(provider.status) || 'setup_required',
    }))

  let ready = (providerReady || capabilityReady) && pipelineCount > 0
  if (domain === 'engineering') {
    const localTeamReady = context.agentCount > 0 && context.localTeamEnabled !== false
    ready = pipelineCount > 0 && (context.daemonOnline || localTeamReady)
    if (!context.daemonOnline && !localTeamReady) {
      blockers.push({ id: 'engineering-runtime', label: '管线服务或本地 Agent Team', kind: 'runtime', status: 'offline' })
    }
  }
  if (domain === 'visual') {
    const imageProvider = providers.find(provider => text(provider.kind) === 'image' || /image/.test(text(provider.id)))
    const imageReady = imageProvider && READY.has(text(imageProvider.status).toLowerCase())
    ready = Boolean(imageReady && pipelineCount > 0)
  }
  if (!pipelineCount) {
    blockers.push({ id: `${domain}-pipeline`, label: '可执行专业管线', kind: 'pipeline', status: 'missing' })
  }
  return {
    id: domain,
    name: mode?.name || DOMAIN_META[domain].name,
    ready,
    status: ready ? 'ready' : (blockers.length ? 'blocked' : 'degraded'),
    blockers: blockers.slice(0, 6),
    pipelineCount,
    agentCount: domain === 'engineering'
      ? context.agentCount
      : list(mode?.bindings).length + list(mode?.suggestedRoles).length,
  }
}

function buildConsoleProjection(input = {}) {
  const workflows = [...list(input.workflows), ...list(input.workflowPackages)]
  const counts = workflowDomainCounts(workflows)
  const modes = modeMap(input.modes)
  const context = {
    daemonOnline: input.daemon?.online === true,
    agentCount: list(input.agents).length,
    localTeamEnabled: input.localTeamEnabled,
  }
  const domains = ['office', 'engineering', 'visual'].map(domain =>
    readinessForDomain(domain, modes.get(domain), context, counts[domain]))

  const runs = []
  for (const task of list(input.daemon?.tasks)) {
    const projected = projectRun(task, { executionSource: 'daemon' })
    if (projected) runs.push(projected)
  }
  for (const agentRun of list(input.agentRuns)) {
    const projected = projectRun(agentRun, { executionSource: 'local-team' })
    if (projected) runs.push(projected)
  }
  const draft = input.taskDraft && typeof input.taskDraft === 'object'
    ? projectRun(input.taskDraft, { fallbackSource: executionSourceOf(input.taskDraft, 'legacy-local') })
    : null
  if (draft && !runs.some(run => run.id === draft.id)) runs.push(draft)
  runs.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))

  const attention = runs
    .filter(run => run.attention)
    .map(run => ({
      runId: run.id,
      domain: run.domain,
      kind: run.status,
      title: run.title,
      detail: run.reason || (run.status === 'waiting' ? '等待处理后继续' : '运行失败，需要检查'),
    }))

  const automation = list(input.automation?.jobs).map(projectAutomation).filter(item => item.id)
  return {
    generatedAt: new Date().toISOString(),
    activeDomainId: text(input.activeDomainId || input.modes?.activeModeId || 'office'),
    domains,
    runs: runs.slice(0, 100),
    attention: attention.slice(0, 24),
    automation: automation.slice(0, 50),
    counts: {
      pipelines: workflows.length,
      activeRuns: runs.filter(run => run.status === 'active' || run.status === 'waiting').length,
      attention: attention.length,
      artifacts: runs.reduce((total, run) => total + run.artifactCount, 0),
    },
  }
}

function filterByDomain(items, domain) {
  const id = text(domain || 'all')
  return id === 'all' ? list(items) : list(items).filter(item => item.domain === id)
}

const api = {
  DOMAIN_META,
  VERTICAL_PIPELINE_SEEDS,
  normalizeRunStatus,
  domainOf,
  executionSourceOf,
  projectRun,
  projectAutomation,
  buildVerticalPipelineFacts,
  resolveVerticalPipeline,
  resolveVerticalPipelines,
  resolveVerticalPipelineById,
  buildAutomationLaunchRequest,
  buildConsoleProjection,
  filterByDomain,
}

if (typeof module === 'object' && module.exports) module.exports = api
if (typeof window !== 'undefined') window.WorkbenchConsoleModel = api
