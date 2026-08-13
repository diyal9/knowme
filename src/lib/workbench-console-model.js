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

function text(value) {
  return String(value == null ? '' : value).trim()
}

function list(value) {
  return Array.isArray(value) ? value : []
}

function normalizeRunStatus(value) {
  const status = text(value).toLowerCase()
  if (SUCCESS.has(status)) return 'success'
  if (FAILURE.has(status)) return 'failure'
  if (CANCELLED.has(status)) return 'cancelled'
  if (WAITING.has(status)) return 'waiting'
  if (ACTIVE.has(status)) return 'active'
  return 'idle'
}

function domainOf(item = {}) {
  const explicit = [
    item.domain,
    item.modeId,
    item.workMode,
    ...list(item.workModes),
    ...list(item.goalTypes),
    item.meta?.domain,
    item.meta?.modeId,
  ].map(value => text(value).toLowerCase())
  for (const id of ['office', 'engineering', 'visual']) {
    if (explicit.includes(id)) return id
  }
  const haystack = [
    item.id,
    item.name,
    item.title,
    item.intent,
    item.goal,
    item.workflow,
    item.description,
    ...list(item.tags),
  ].map(text).join(' ').toLowerCase()
  if (/(视觉|海报|图片|图像|设计|文案|image|visual|poster|design)/.test(haystack)) return 'visual'
  if (/(研发|开发|代码|测试|需求|工程|软件|code|dev|test|engineering|release|deploy)/.test(haystack)) return 'engineering'
  return 'office'
}

function executionSourceOf(item = {}, fallback = 'legacy-local') {
  const direct = text(item.executionSource || item.backend || item.source)
  if (['daemon', 'local-team', 'legacy-local', 'automation'].includes(direct)) return direct
  const backends = list(item.executionBackends)
  if (backends.includes('daemon')) return 'daemon'
  if (backends.includes('local-team')) return 'local-team'
  if (backends.includes('legacy-local')) return 'legacy-local'
  return fallback
}

function timestampOf(item = {}) {
  return text(item.updatedAt || item.endedAt || item.startedAt || item.createdAt || item.lastRunAt)
}

function artifactCountOf(item = {}) {
  if (Number.isFinite(Number(item.artifactCount))) return Math.max(0, Number(item.artifactCount))
  return list(item.artifacts || item.artifactRefs || item.outputs).length
}

function projectRun(item = {}, options = {}) {
  const executionSource = options.executionSource || executionSourceOf(item, options.fallbackSource)
  const id = text(item.slug || item.runId || item.rootRunId || item.id)
  if (!id) return null
  const status = normalizeRunStatus(item.status || item.state || item.phase)
  return {
    id,
    title: text(item.intent || item.goal || item.title || item.name || item.workflow) || '未命名运行',
    workflowId: text(item.workflowId || item.workflow),
    domain: domainOf(item),
    status,
    rawStatus: text(item.status || item.state || item.phase || 'idle'),
    executionSource,
    updatedAt: timestampOf(item),
    artifactCount: artifactCountOf(item),
    recoverable: executionSource !== 'legacy-local' || status === 'active',
    attention: status === 'waiting' || status === 'failure',
    reason: text(item.error || item.reason || item.message || item.stopReason),
  }
}

function isReadyStatus(value) {
  return READY.has(text(value).toLowerCase())
}

function expertSet(values) {
  return new Set(list(values).map(item => text(item).toLowerCase()).filter(Boolean))
}

function modeByDomain(facts, domain) {
  const modes = facts?.modes && typeof facts.modes === 'object' ? facts.modes : {}
  return modes[domain] || null
}

function buildVerticalPipelineFacts(input = {}) {
  const modes = modeMap(input.modes)
  const normalizedModes = input.modes && !Array.isArray(input.modes)
    && ['office', 'engineering', 'visual'].some(id => Object.hasOwn(input.modes, id))
    ? input.modes
    : {
        office: modes.get('office') || null,
        engineering: modes.get('engineering') || null,
        visual: modes.get('visual') || null,
      }
  const connectors = list(input.connectors).map(item => ({
    id: text(item.id),
    kind: text(item.kind || item.type),
    enabled: item.enabled === true,
    ready: item.ready === true,
    summary: text(item.summary || item.label),
  }))
  return {
    modes: normalizedModes,
    daemonOnline: input.daemonOnline != null ? input.daemonOnline === true : input.daemon?.online === true,
    daemonWorkflowCount: input.daemonWorkflowCount != null
      ? Math.max(0, Number(input.daemonWorkflowCount) || 0)
      : list(input.daemon?.workflows).length,
    daemonWorkflows: list(input.daemonWorkflows || input.daemon?.workflows).map(item => ({
      id: text(item.id || item.workflow),
      name: text(item.name || item.title || item.id),
      tags: list(item.tags).map(text),
    })).filter(item => item.id),
    localTeamEnabled: input.localTeamEnabled !== false,
    agentCount: input.agentCount != null ? Math.max(0, Number(input.agentCount) || 0) : list(input.agents).length,
    availableExperts: input.availableExperts instanceof Set
      ? new Set(input.availableExperts)
      : expertSet(input.availableExperts || input.availableExpertIds),
    connectors,
  }
}

function officeConnectorReady(facts) {
  return facts.connectors.some(item => {
    if (!item.enabled || !item.ready) return false
    if (OFFICE_CONNECTOR_IDS.includes(item.id)) return true
    return OFFICE_CONNECTOR_KINDS.some(kind => item.kind.includes(kind) || item.id.includes(kind))
  })
}

function officeAgentReady(facts) {
  const mode = modeByDomain(facts, 'office')
  if (OFFICE_EXPERT_IDS.some(id => facts.availableExperts.has(id))) return true
  return list(mode?.bindings).some(binding => isReadyStatus(binding.status))
}

function engineeringRuntimeReady(facts) {
  const daemonReady = facts.daemonOnline && facts.daemonWorkflowCount > 0
  const localTeamReady = facts.localTeamEnabled !== false
    && facts.agentCount >= 3
    && (
      ENGINEERING_EXPERT_IDS.every(id => facts.availableExperts.has(id))
      || facts.agentCount >= 3
    )
  let backend = null
  if (localTeamReady) backend = 'local-team'
  else if (daemonReady) backend = 'daemon'
  return { ready: Boolean(daemonReady || localTeamReady), daemonReady, localTeamReady, backend }
}

function visualCapabilityReady(facts) {
  const mode = modeByDomain(facts, 'visual')
  const providers = list(mode?.providers)
  const capabilities = list(mode?.professionalCapabilities)
  const imageProvider = providers.find(provider =>
    text(provider.kind) === 'image' || /image/.test(text(provider.id)))
  const imageReady = Boolean(imageProvider && isReadyStatus(imageProvider.status))
  const visualAgentReady = VISUAL_EXPERT_IDS.some(id => facts.availableExperts.has(id))
    || list(mode?.bindings).some(binding => isReadyStatus(binding.status))
  const copyReady = capabilities.some(item =>
    item.id === 'copywriting' && isReadyStatus(item.status))
  const ready = imageReady && (visualAgentReady || copyReady)
  return { ready, imageReady, visualAgentReady, copyReady, backend: ready ? 'local-team' : null }
}

function resolveOfficeReadiness(facts) {
  const blockers = []
  const agentReady = officeAgentReady(facts)
  const connectorReady = officeConnectorReady(facts)
  const ready = facts.localTeamEnabled && agentReady && connectorReady
  if (!agentReady) {
    blockers.push({ id: 'office-agent', label: '办公或会议 Agent', kind: 'agent', status: 'missing' })
  }
  if (!connectorReady) {
    blockers.push({ id: 'office-connector', label: '会议/文档连接器', kind: 'connector', status: 'setup_required' })
  }
  const repairAction = !ready
    ? (connectorReady
      ? { id: 'install-office-agent', label: '安装并启用办公 Agent', target: 'capability-hub:expert' }
      : { id: 'configure-feishu', label: '配置飞书连接器', target: 'settings:connectors:feishu' })
    : null
  return {
    ready,
    backend: ready ? 'local-team' : null,
    blockers: ready ? [] : blockers,
    repairAction,
  }
}

function resolveEngineeringReadiness(facts) {
  const runtime = engineeringRuntimeReady(facts)
  const blockers = []
  if (!runtime.daemonReady) {
    blockers.push({ id: 'engineering-daemon', label: '管线服务与工作流', kind: 'runtime', status: 'offline' })
  }
  if (!runtime.localTeamReady) {
    blockers.push({ id: 'engineering-local-team', label: '本地 Agent Team', kind: 'runtime', status: 'offline' })
  }
  const repairAction = !runtime.ready
    ? { id: 'start-engineering-runtime', label: '启动管线服务或启用本地 Agent Team', target: 'settings:daemon' }
    : null
  return {
    ready: runtime.ready,
    backend: runtime.backend,
    blockers: runtime.ready ? [] : blockers,
    repairAction,
  }
}

function resolveVisualReadiness(facts) {
  const visual = visualCapabilityReady(facts)
  const blockers = []
  if (!visual.imageReady) {
    blockers.push({ id: 'image-provider', label: '图像执行服务', kind: 'provider', status: 'setup_required' })
  }
  if (!visual.visualAgentReady && !visual.copyReady) {
    blockers.push({ id: 'visual-agent', label: '视觉或文案 Agent', kind: 'agent', status: 'missing' })
  }
  const repairAction = !visual.ready
    ? (!visual.imageReady
      ? { id: 'configure-image-provider', label: '配置图像执行服务', target: 'capability-hub:image' }
      : { id: 'install-visual-agent', label: '安装视觉或文案 Agent', target: 'capability-hub:expert' })
    : null
  return {
    ready: visual.ready,
    backend: visual.backend,
    blockers: visual.ready ? [] : blockers,
    repairAction,
  }
}

function resolveVerticalPipeline(seed, facts = {}) {
  const domain = text(seed?.provenance?.domain) || domainOf(seed)
  const readiness = domain === 'engineering'
    ? resolveEngineeringReadiness(facts)
    : domain === 'visual'
      ? resolveVisualReadiness(facts)
      : resolveOfficeReadiness(facts)
  const backends = list(seed.executionBackends)
  const backend = readiness.backend && backends.includes(readiness.backend)
    ? readiness.backend
    : (readiness.ready ? (backends[0] || readiness.backend) : null)
  const workflowSummary = {
    backend: backend || null,
    ready: readiness.ready,
    blockers: readiness.blockers.slice(0, 6),
    repairAction: readiness.repairAction,
  }
  return {
    package: {
      ...seed,
      status: readiness.ready ? 'published' : 'unavailable',
      executionBackends: backend ? [backend] : backends,
      provenance: {
        ...(seed.provenance || {}),
        readiness: readiness.ready ? 'ready' : 'blocked',
        backend: backend || null,
        blockers: workflowSummary.blockers,
        repairAction: readiness.repairAction,
        executionWorkflowId: domain === 'engineering' && backend === 'daemon'
          ? (facts.daemonWorkflows?.[0]?.id || null)
          : null,
      },
    },
    readiness: {
      ...readiness,
      backend,
      workflowSummary,
    },
  }
}

function resolveVerticalPipelines(facts = {}) {
  return VERTICAL_PIPELINE_SEEDS.map(seed => resolveVerticalPipeline(seed, facts))
}

function resolveVerticalPipelineById(pipelineId, facts = {}) {
  const seed = VERTICAL_PIPELINE_SEEDS.find(item => item.id === text(pipelineId))
  if (!seed) return null
  return resolveVerticalPipeline(seed, facts)
}

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
