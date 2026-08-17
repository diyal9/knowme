'use strict'

;(function initWorkbenchDaemonSurface(root, factory) {
  const surfaceApi = factory()
  if (typeof module === 'object' && module.exports) module.exports = surfaceApi
  if (root) root.WorkbenchDaemonSurface = surfaceApi
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null), function createWorkbenchDaemonSurface() {
const PRIMARY_LIMIT = 4

/** Optional presentation overrides keyed by workflow id. */
const PATH_PRESENTATION = {
  'doc-to-impl-plan': {
    outcome: '把需求文档整理成可执行的实施计划',
    stages: ['需求澄清', '门禁', '前后端计划', '测试计划'],
    outcomes: ['实施计划', '测试计划'],
  },
  'docs-to-implementation-plan': {
    outcome: '把需求文档整理成可执行的实施计划',
    stages: ['需求澄清', '门禁', '前后端计划', '测试计划'],
    outcomes: ['实施计划', '测试计划'],
  },
  'doc-to-plan': {
    outcome: '把需求文档整理成可执行的实施计划',
    stages: ['需求澄清', '门禁', '前后端计划', '测试计划'],
    outcomes: ['实施计划', '测试计划'],
  },
}

const WAITING_STATES = new Set([
  'waiting', 'blocked', 'gate', 'clarification', 'needs_input', 'needs-input', 'paused',
])
const ACTIVE_STATES = new Set([
  'running', 'queued', 'pending', 'preparing', 'created', 'starting', 'active',
])
const DONE_STATES = new Set([
  'done', 'completed', 'success', 'finished',
])
const FAIL_STATES = new Set([
  'failed', 'error', 'rejected', 'cancelled', 'canceled',
])

function catalogOf(workflow) {
  const catalog = workflow && workflow.catalog && typeof workflow.catalog === 'object'
    ? workflow.catalog
    : {}
  const visibility = String(catalog.visibility || 'primary').trim().toLowerCase() || 'primary'
  const order = Number.isInteger(Number(catalog.order)) ? Number(catalog.order) : 1000
  return { visibility, order, category: String(catalog.category || 'general') }
}

function curateDaemonPaths(workflows, options = {}) {
  const limit = Number.isInteger(options.primaryLimit) ? options.primaryLimit : PRIMARY_LIMIT
  const list = Array.isArray(workflows) ? workflows.filter(item => item && item.id) : []
  const sorted = list
    .map((workflow, index) => ({ workflow, index, catalog: catalogOf(workflow) }))
    .sort((a, b) => (a.catalog.order - b.catalog.order) || (a.index - b.index))
  const primary = []
  const more = []
  for (const item of sorted) {
    if (item.catalog.visibility === 'primary' && primary.length < limit) {
      primary.push(item.workflow)
    } else {
      more.push(item.workflow)
    }
  }
  // 若目录未标记 primary，仍保证首屏有可用路径，避免空壳。
  while (primary.length < limit && more.length) {
    primary.push(more.shift())
  }
  return { primary, more, primaryLimit: limit }
}

/** Drop technical catalog prose (pipeline arrows, selection notes) from UI surface. */
function humanOneLiner(text, max = 32) {
  const s = String(text || '').replace(/\s+/g, ' ').trim()
  if (!s) return ''
  if (/->|→|选型|时选此|并行|Gate\b|gate\b/i.test(s)) return ''
  if (s.length <= max) return s
  return `${s.slice(0, Math.max(0, max - 1)).trim()}…`
}

function daemonPathPresentation(workflow = {}) {
  const id = String(workflow.id || '').trim()
  const override = PATH_PRESENTATION[id] || null
  const name = String(workflow.name || id || '未命名路径').trim()
  const summary = String(workflow.summary || workflow.description || '').trim()
  const stages = Array.isArray(override?.stages) && override.stages.length
    ? override.stages.map(String)
    : ['准备', '执行', '审阅']
  const outcomes = Array.isArray(override?.outcomes) && override.outcomes.length
    ? override.outcomes.map(String)
    : []
  const outcome = String(
    override?.outcome
    || humanOneLiner(summary)
    || (outcomes.length ? outcomes.join(' · ') : ''),
  ).trim()
  return {
    id,
    name,
    summary,
    outcome,
    stages,
    outcomes,
    locked: !!workflow.locked,
  }
}

function contextHasPrd(context) {
  const source = context && typeof context === 'object' ? context : {}
  const inputs = source.inputs && typeof source.inputs === 'object' ? source.inputs : source
  return Boolean(String(inputs.prd || source.prd || source.prdPath || '').trim())
}

function contextHasResources(context) {
  const source = context && typeof context === 'object' ? context : {}
  const inputs = source.inputs && typeof source.inputs === 'object' ? source.inputs : source
  const resources = inputs.resources || source.resources || source.assets
  if (Array.isArray(resources)) return resources.some(item => String(item || '').trim())
  return Boolean(String(resources || '').trim())
}

function daemonMaterialChecklist(options = {}) {
  const daemon = options.daemon && typeof options.daemon === 'object' ? options.daemon : {}
  const workflow = options.workflow && typeof options.workflow === 'object' ? options.workflow : null
  const context = options.context && typeof options.context === 'object' ? options.context : {}
  const online = daemon.online === true
  const locked = !!(workflow && workflow.locked)
  const hasPrd = contextHasPrd(context)
  const hasResources = contextHasResources(context)

  const items = [
    {
      id: 'connection',
      label: '连接',
      shortLabel: '连接',
      status: online ? 'ok' : 'blocked',
      detail: online
        ? (daemon.endpoint || '已连接')
        : (daemon.hint || '请先连接管线服务'),
      hard: true,
    },
    {
      id: 'path',
      label: '路径',
      shortLabel: '路径',
      status: !workflow ? 'warn' : (locked ? 'blocked' : 'ok'),
      detail: !workflow
        ? '尚未选择路径'
        : (locked ? '该路径已锁定，暂不可启动' : (workflow.name || workflow.id)),
      hard: locked || !workflow,
    },
    {
      id: 'prd',
      label: '需求',
      shortLabel: '需求',
      status: hasPrd ? 'ok' : 'warn',
      detail: hasPrd ? '已填写或已保存路径' : '启动时可补需求说明',
      hard: false,
    },
    {
      id: 'resources',
      label: '材料',
      shortLabel: '材料',
      status: hasResources ? 'ok' : 'warn',
      detail: hasResources ? '已关联资源路径' : '可选：原型 / 配置 / 资源包',
      hard: false,
    },
  ]

  const hardBlockers = items.filter(item => item.hard && item.status === 'blocked')
  const warnings = items.filter(item => !item.hard && item.status === 'warn')
  return {
    items,
    canStart: online && !!workflow && !locked && hardBlockers.length === 0,
    hardBlockers,
    warnings,
  }
}

function normalizeRunState(task = {}) {
  const raw = task.status || task.state || task.phase || ''
  if (raw && typeof raw === 'object') {
    return String(raw.state || raw.status || raw.phase || '').trim().toLowerCase()
  }
  return String(raw || '').trim().toLowerCase()
}

function daemonRunBucket(task = {}) {
  const state = normalizeRunState(task)
  const hitl = !!(
    task.waiting
    || task.gate
    || task.clarification
    || (Array.isArray(task.pending_gates) && task.pending_gates.length)
    || (Array.isArray(task.pendingGates) && task.pendingGates.length)
    || (Array.isArray(task.pending_clarifications) && task.pending_clarifications.length)
    || (Array.isArray(task.pendingClarifications) && task.pendingClarifications.length)
  )
  if (FAIL_STATES.has(state)) return 'needs_you'
  // 对齐 WebUI：有澄清/门禁时不得进 done（即使 job/state 像 completed）
  if (hitl || WAITING_STATES.has(state)) return 'needs_you'
  if (DONE_STATES.has(state)) return 'done'
  if (ACTIVE_STATES.has(state)) return 'active'
  return 'active'
}

function daemonRunStatusLabel(task = {}) {
  const lifecycle = typeof window !== 'undefined' && window.WorkbenchTaskLifecycle
    ? window.WorkbenchTaskLifecycle
    : (typeof require === 'function' ? require('./workbench-task-lifecycle') : null)
  if (lifecycle && lifecycle.projectRunLifecycle) {
    return lifecycle.projectRunLifecycle({ backend: 'daemon', task }).compactLabel
  }
  const bucket = daemonRunBucket(task)
  if (bucket === 'needs_you') {
    const state = normalizeRunState(task)
    if (FAIL_STATES.has(state)) return '失败'
    if (state.includes('clarif')) return '澄清'
    if (state.includes('gate') || state === 'waiting' || state === 'blocked') return '待确认'
    return '待处理'
  }
  if (bucket === 'done') return '完成'
  if (bucket === 'active') return '进行中'
  return '进行中'
}

function daemonRunNextAction(task = {}) {
  const bucket = daemonRunBucket(task)
  const state = normalizeRunState(task)
  if (bucket === 'done') return '产物'
  if (FAIL_STATES.has(state)) {
    const hint = String(task.error || task.hint || task.reason || '').trim()
    if (/api[_ ]?key|cursor/i.test(hint)) return '查授权'
    if (/offline|连接|connect/i.test(hint)) return '查连接'
    return '原因'
  }
  if (state.includes('clarif')) return '澄清'
  if (state.includes('gate') || state === 'waiting' || state === 'blocked') return '门禁'
  return ''
}

function daemonRunRecordView(task = {}, workflows = []) {
  const list = Array.isArray(workflows) ? workflows : []
  const workflowId = String(task.workflow || task.workflowId || task.pipeline || '').trim()
  const matched = list.find(item => String(item.id || '') === workflowId)
  const pathName = matched
    ? daemonPathPresentation(matched).name
    : (workflowId || '管线服务路径')
  const slug = String(task.slug || task.id || '').trim()
  const intent = String(task.intent || task.title || task.goal || '').trim()
  const title = intent || pathName || slug || '管线记录'
  const bucket = daemonRunBucket(task)
  const statusLabel = daemonRunStatusLabel(task)
  const nextAction = daemonRunNextAction(task)
  return {
    slug,
    title,
    secondary: slug && intent ? slug : '',
    pathName,
    statusLabel,
    nextAction,
    /** Compact list row: badge only; long next copy lives in title tooltip. */
    badge: statusLabel,
    bucket,
    updatedAt: String(task.updatedAt || task.updated_at || task.createdAt || '').trim(),
    rawStatus: normalizeRunState(task),
  }
}

function filterDaemonRunRecords(records, filter = 'all') {
  const list = Array.isArray(records) ? records : []
  const key = String(filter || 'all').trim().toLowerCase()
  if (key === 'all' || !key) return list
  if (key === 'failed' || key === 'fail' || key === 'error') {
    return list.filter(item => {
      const state = String(item.rawStatus || normalizeRunState(item) || '').toLowerCase()
      return FAIL_STATES.has(state) || item.bucket === 'needs_you' && /失败|fail|error/i.test(String(item.statusLabel || ''))
    })
  }
  if (key === 'needs_you' || key === 'needs-you' || key === 'waiting') {
    return list.filter(item => (item.bucket || daemonRunBucket(item)) === 'needs_you')
  }
  if (key === 'active' || key === 'running') {
    return list.filter(item => (item.bucket || daemonRunBucket(item)) === 'active')
  }
  if (key === 'done' || key === 'completed') {
    return list.filter(item => (item.bucket || daemonRunBucket(item)) === 'done')
  }
  return list
}

function searchDaemonRunRecords(records, query = '') {
  const list = Array.isArray(records) ? records : []
  const q = String(query || '').trim().toLowerCase()
  if (!q) return list
  return list.filter(item => {
    const hay = [
      item.title,
      item.slug,
      item.secondary,
      item.pathName,
      item.statusLabel,
      item.intent,
      item.workflow,
    ].map(v => String(v || '').toLowerCase()).join(' ')
    return hay.includes(q)
  })
}

const CARD_TITLE_MAX = 40
const CARD_SUMMARY_MAX = 64
const INTENT_LABEL_RE = /^(需求文档|需求说明|需求|目标|标题|Title|PRD|Goal|Brief)\s*[:：]?\s*$/i
const INTENT_PREFIX_RE = /^(需求文档|需求说明|需求|目标|标题|Title|PRD|Goal|Brief)\s*[:：]\s*/i
const URL_IN_TEXT_RE = /https?:\/\/[^\s<>"'）】\]]+/gi

function isUrlLikeLine(line = '') {
  return /^(https?:\/\/|www\.)/i.test(String(line || '').trim())
}

function stripIntentLabelPrefix(line = '') {
  return String(line || '').replace(INTENT_PREFIX_RE, '').trim()
}

function shortenUrlForCard(url = '') {
  try {
    const parsed = new URL(String(url || '').trim())
    const host = parsed.host.replace(/^www\./i, '')
    const path = `${parsed.pathname || ''}${parsed.search || ''}`.replace(/\/+$/, '')
    const shortPath = path && path !== '/' ? path : ''
    const combined = shortPath ? `${host}${shortPath}` : host
    if (combined.length <= 40) return combined
    return `${combined.slice(0, 39)}…`
  } catch {
    const raw = String(url || '').replace(/^https?:\/\//i, '')
    return raw.length > 40 ? `${raw.slice(0, 39)}…` : raw
  }
}

function extractIntentLabel(line = '') {
  const text = String(line || '').trim()
  if (!text) return ''
  if (INTENT_LABEL_RE.test(text)) return text.replace(/[:：]\s*$/, '').trim()
  const m = text.match(INTENT_PREFIX_RE)
  return m ? String(m[1] || '').trim() : ''
}

function truncateCardText(text = '', max = CARD_TITLE_MAX) {
  const value = String(text || '').replace(/\s+/g, ' ').trim()
  if (!value) return ''
  if (value.length <= max) return value
  return `${value.slice(0, max - 1).trimEnd()}…`
}

function parseIntentCardParts(intent = '') {
  const raw = String(intent || '').trim()
  const lines = raw.split(/[\r\n]+/).map(line => String(line || '').trim()).filter(Boolean)
  const labels = []
  const prose = []
  const urls = []

  for (const line of lines) {
    const label = extractIntentLabel(line)
    if (label && !labels.includes(label)) labels.push(label)

    if (INTENT_LABEL_RE.test(line)) continue

    const stripped = stripIntentLabelPrefix(line)
    if (!stripped) continue

    if (isUrlLikeLine(stripped)) {
      urls.push(shortenUrlForCard(stripped))
      continue
    }

    const withoutUrls = stripped.replace(URL_IN_TEXT_RE, (url) => {
      urls.push(shortenUrlForCard(url))
      return ' '
    }).replace(/\s+/g, ' ').trim()
    if (withoutUrls) prose.push(withoutUrls)
  }

  if (!lines.length && raw) {
    const withoutUrls = raw.replace(URL_IN_TEXT_RE, (url) => {
      urls.push(shortenUrlForCard(url))
      return ' '
    }).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim()
    if (withoutUrls) prose.push(withoutUrls)
  }

  return {
    raw,
    labels,
    prose,
    urls: [...new Set(urls)],
  }
}

/**
 * Card title slot: human theme only (no URL wall, no workflow id when intent exists).
 */
function compactDaemonCardTitle(intent = '', options = {}) {
  const pathName = String(options.pathName || '').trim()
  const slug = String(options.slug || '').trim()
  const emptyFallback = pathName || slug || '管线任务'
  const parts = parseIntentCardParts(intent)
  if (!parts.raw) return emptyFallback

  if (parts.prose[0]) return truncateCardText(parts.prose[0], CARD_TITLE_MAX)
  if (parts.labels[0]) return parts.labels[0]
  if (parts.urls.length) {
    if (/feishu\.cn|larksuite\.com/i.test(parts.raw)) return '飞书文档'
    return '链接材料'
  }
  return emptyFallback
}

/**
 * Card summary slot: supporting detail under title (short URL / remaining prose).
 * MUST differ from title; empty when nothing useful remains.
 */
function compactDaemonCardSummary(intent = '', cardTitle = '') {
  const title = String(cardTitle || '').trim()
  const parts = parseIntentCardParts(intent)
  if (!parts.raw) return ''

  const urlSummary = parts.urls[0] || ''
  const proseRest = parts.prose
    .map(line => truncateCardText(line, CARD_SUMMARY_MAX))
    .filter(line => line && line !== title)
  const proseSummary = proseRest[0] || ''

  // Label-as-title + URL material → summary is the shortened link only.
  if (title && parts.labels.includes(title) && urlSummary) {
    return truncateCardText(urlSummary, CARD_SUMMARY_MAX)
  }

  if (urlSummary && !proseSummary) return truncateCardText(urlSummary, CARD_SUMMARY_MAX)

  if (proseSummary) {
    // Avoid near-duplicate: title is prefix of the only prose line.
    if (title && proseSummary === title) return urlSummary ? truncateCardText(urlSummary, CARD_SUMMARY_MAX) : ''
    if (title && proseSummary.startsWith(title)) {
      const rest = proseSummary.slice(title.length).replace(/^[:：\s]+/, '').trim()
      if (rest) return truncateCardText(rest, CARD_SUMMARY_MAX)
      return urlSummary ? truncateCardText(urlSummary, CARD_SUMMARY_MAX) : ''
    }
    return proseSummary
  }

  if (urlSummary && urlSummary !== title) return truncateCardText(urlSummary, CARD_SUMMARY_MAX)
  return ''
}

/** @deprecated use compactDaemonCardSummary */
function compactDaemonCardBrief(intent = '', cardTitle = '') {
  return compactDaemonCardSummary(intent, cardTitle)
}

const DAEMON_PURPOSE_PREFIX = 'Daemon 阶段 ·'
const PURPOSE_TITLE_MAX = 24

/**
 * Local fallback for Daemon run identity title (no LLM).
 * Prefer compact intent skim, then workflow name / slug.
 */
function resolveDaemonPurposeTitleLocal(intent = '', options = {}) {
  const workflowName = String(options.workflowName || options.pathName || '').trim()
  const slug = String(options.slug || '').trim()
  const cached = String(options.purposeTitle || options.cachedTitle || '').trim()
  if (cached) {
    const stripped = cached.replace(/^Daemon\s*阶段\s*[·•]\s*/i, '').trim()
    if (stripped) return stripped.slice(0, PURPOSE_TITLE_MAX)
  }
  const compact = compactDaemonCardTitle(intent, {
    pathName: workflowName,
    slug,
  })
  const candidate = String(compact || workflowName || slug || '管线任务').trim()
  return candidate.slice(0, PURPOSE_TITLE_MAX) || '管线任务'
}

/**
 * Display title for Daemon run identity: `Daemon 阶段 · {purpose}`.
 */
function formatDaemonPurposeTitle(purposeTitle = '', options = {}) {
  const body = resolveDaemonPurposeTitleLocal(options.intent || '', {
    ...options,
    purposeTitle,
  })
  return `${DAEMON_PURPOSE_PREFIX} ${body}`
}

function daemonTaskCardView(task = {}, workflows = [], options = {}) {
  const base = daemonRunRecordView(task, workflows)
  const now = Number.isFinite(options.now) ? options.now : Date.now()
  const updatedAt = base.updatedAt
  const ts = Date.parse(updatedAt || '')
  let relativeTime = ''
  if (Number.isFinite(ts)) {
    const diff = Math.max(0, now - ts)
    const min = Math.floor(diff / 60000)
    if (min < 1) relativeTime = '刚刚'
    else if (min < 60) relativeTime = `${min} 分钟前`
    else {
      const hr = Math.floor(min / 60)
      if (hr < 24) relativeTime = `${hr} 小时前`
      else {
        const day = Math.floor(hr / 24)
        if (day < 30) relativeTime = `${day} 天前`
        else {
          const mon = Math.floor(day / 30)
          relativeTime = mon < 12 ? `${mon} 个月前` : `${Math.floor(mon / 12)} 年前`
        }
      }
    }
  }
  const state = base.rawStatus
  const tone = FAIL_STATES.has(state)
    ? 'failed'
    : (base.bucket === 'done' ? 'done' : (base.bucket === 'needs_you' ? 'waiting' : 'active'))
  const intent = String(task.intent || task.title || task.goal || '').trim()
  // Card layers: 标题 / 概要 / 其它信息；完整 intent → tooltip/search.
  const cardTitle = compactDaemonCardTitle(intent, {
    pathName: base.pathName,
    slug: base.slug,
  })
  const cardSummary = compactDaemonCardSummary(intent, cardTitle)
  const cardMeta = [base.slug, base.pathName, base.statusLabel].filter(Boolean).join(' · ')
  return {
    ...base,
    cardTitle,
    cardSummary,
    cardBrief: cardSummary,
    cardMeta,
    relativeTime,
    tone,
    intentTitle: base.title,
  }
}

const MIN_INTENT_CHARS = 20

function formMeetsMinMaterialGate(formState = {}) {
  const intent = String(formState.intent || formState.goal || '').trim()
  const materials = Array.isArray(formState.materials)
    ? formState.materials
    : Array.isArray(formState.files) ? formState.files : []
  const materialCount = materials.filter(item => {
    if (!item) return false
    if (typeof item === 'string') return !!item.trim()
    return !!(item.path || item.name || item.url)
  }).length
  const hasIntent = intent.length >= MIN_INTENT_CHARS
  const hasMaterial = materialCount >= 1
  return {
    ok: hasIntent || hasMaterial,
    hasIntent,
    hasMaterial,
    intentLength: intent.length,
    materialCount,
    minIntentChars: MIN_INTENT_CHARS,
    message: hasIntent || hasMaterial
      ? ''
      : `请填写不少于 ${MIN_INTENT_CHARS} 字的需求说明，或上传至少 1 个附件后再创建任务。`,
  }
}

function workflowNeedsCli(workflow = {}) {
  if (!workflow || typeof workflow !== 'object') return true
  if (workflow.cliRequired === false) return false
  const tags = Array.isArray(workflow.tags) ? workflow.tags.map(String) : []
  if (tags.some(t => /script-only|no-cli/i.test(t))) return false
  const blob = `${workflow.id || ''} ${workflow.name || ''} ${workflow.description || ''}`
  if (/game-dev-delivery|script-only|交付包/i.test(blob)) return false
  return true
}

function assessComposePreflight(daemon = {}, workflow = null) {
  const overview = daemon && typeof daemon === 'object' ? daemon : {}
  if (overview.online !== true) {
    return {
      ok: false,
      code: 'offline',
      message: overview.hint || '管线服务离线，请先连接',
    }
  }
  if (!workflow || !workflow.id) {
    return { ok: false, code: 'no_workflow', message: '请选择交付路径' }
  }
  if (workflow.locked) {
    return { ok: false, code: 'path_locked', message: '该交付路径已锁定，暂不可启动' }
  }
  if (!workflowNeedsCli(workflow)) {
    return { ok: true, code: 'ready', message: '可启动' }
  }
  if (overview.cursorApiKeyReady === false) {
    return {
      ok: false,
      code: 'cursor_api_key',
      message: '需要 CURSOR_API_KEY：请在管线服务 .nine/.env.local 配置后重启服务',
    }
  }
  if (overview.executorReady === false) {
    return {
      ok: false,
      code: 'executor_not_ready',
      message: (overview.executor && overview.executor.message)
        || '管线执行器未就绪，请确认 executor 在线后再启动',
    }
  }
  return { ok: true, code: 'ready', message: '可启动' }
}

function normalizeRequiredInputSpec(raw, index = 0) {
  if (!raw) return null
  if (typeof raw === 'string') {
    const id = raw.trim()
    if (!id) return null
    return {
      id,
      label: id,
      kind: id,
      hard: false,
      keys: [id],
    }
  }
  if (typeof raw !== 'object') return null
  const id = String(raw.id || raw.key || raw.name || `input-${index + 1}`).trim()
  if (!id) return null
  const keys = []
    .concat(raw.keys || raw.aliases || [], [id, raw.key, raw.name, raw.field])
    .map(item => String(item || '').trim())
    .filter(Boolean)
  const hard = raw.hard === true || raw.required === true || String(raw.level || '').toLowerCase() === 'hard'
  return {
    id,
    label: String(raw.label || raw.title || id).trim(),
    kind: String(raw.kind || raw.type || id).trim().toLowerCase(),
    hard,
    keys: [...new Set(keys)],
    hint: String(raw.hint || raw.description || '').trim(),
  }
}

function fallbackIngestRequirements(workflow = {}) {
  const id = String(workflow.id || '').toLowerCase()
  const name = String(workflow.name || '').toLowerCase()
  const artHeavy = /art|美术|原型|ui|设计|asset|资源/.test(`${id} ${name}`)
  const items = [
    {
      id: 'prd',
      label: '需求说明',
      kind: 'prd',
      hard: false,
      keys: ['prd', 'requirement', 'spec', 'brief', 'intent'],
      hint: '业务目标、范围、验收标准',
    },
    {
      id: 'resources',
      label: artHeavy ? '原型或 UI 稿' : '补充材料',
      kind: artHeavy ? 'assets' : 'resources',
      hard: false,
      keys: ['resources', 'assets', 'materials', 'files', 'prototype', 'mock'],
      hint: artHeavy ? '原型图 / Figma 导出 / 美术资源' : 'PRD、原型、配置表等',
    },
  ]
  return items
}

function resolveIngestRequirements(workflow = {}, launchContext = null) {
  const catalog = workflow && workflow.catalog && typeof workflow.catalog === 'object'
    ? workflow.catalog
    : {}
  const ctx = launchContext && typeof launchContext === 'object' ? launchContext : {}
  const nested = ctx.context && typeof ctx.context === 'object' ? ctx.context : ctx
  const rawList = []
    .concat(
      catalog.requiredInputs || catalog.required_inputs || [],
      nested.requiredInputs || nested.required_inputs || [],
      ctx.requiredInputs || ctx.required_inputs || [],
      workflow.requiredInputs || workflow.required_inputs || [],
    )
  const parsed = rawList.map(normalizeRequiredInputSpec).filter(Boolean)
  const byId = new Map()
  for (const item of parsed) {
    if (!byId.has(item.id)) byId.set(item.id, item)
  }
  if (!byId.size) {
    for (const item of fallbackIngestRequirements(workflow)) byId.set(item.id, item)
  }
  // Always surface connection/path as system gates (hard).
  const system = [
    {
      id: 'connection',
      label: '管线服务连接',
      kind: 'connection',
      hard: true,
      keys: ['connection'],
      system: true,
    },
    {
      id: 'path',
      label: '交付路径',
      kind: 'path',
      hard: true,
      keys: ['path', 'workflow'],
      system: true,
    },
  ]
  return [...system, ...byId.values()]
}

function formValueByKeys(formState = {}, keys = [], options = {}) {
  const source = formState && typeof formState === 'object' ? formState : {}
  const inputs = source.inputs && typeof source.inputs === 'object' ? source.inputs : source
  for (const key of keys) {
    const value = inputs[key] != null ? inputs[key] : source[key]
    if (Array.isArray(value) && value.some(item => String(item || '').trim())) return value
    if (value != null && String(value).trim()) return value
  }
  const allowIntentText = options.allowIntentText !== false
  if (allowIntentText && keys.some(k => /prd|intent|requirement|spec|brief|goal/i.test(k))) {
    const intent = String(source.intent || source.goal || '').trim()
    if (intent.length >= MIN_INTENT_CHARS) return intent
  }
  if (keys.some(k => /resource|asset|material|file|proto/i.test(k))) {
    const materials = source.materials || source.files || source.resources
    if (Array.isArray(materials) && materials.length) return materials
  }
  return null
}

function evaluateIngest(formState = {}, requirements = [], options = {}) {
  const daemon = options.daemon && typeof options.daemon === 'object' ? options.daemon : {}
  const workflow = options.workflow && typeof options.workflow === 'object' ? options.workflow : null
  const online = daemon.online === true
  const locked = !!(workflow && workflow.locked)
  const minGate = formMeetsMinMaterialGate(formState)
  const preflight = options.preflight && typeof options.preflight === 'object'
    ? options.preflight
    : null
  const items = (Array.isArray(requirements) ? requirements : []).map(req => {
    if (req.id === 'connection' || req.kind === 'connection') {
      return {
        ...req,
        status: online ? 'ok' : 'blocked',
        detail: online
          ? (daemon.endpoint || '已连接')
          : (daemon.hint || '请先连接管线服务'),
      }
    }
    if (req.id === 'path' || req.kind === 'path') {
      return {
        ...req,
        status: !workflow ? 'blocked' : (locked ? 'blocked' : 'ok'),
        detail: !workflow
          ? '尚未选择交付路径'
          : (locked ? '该路径已锁定，暂不可启动' : (workflow.name || workflow.id)),
      }
    }
    const allowIntentText = !req.hard || /intent|goal|brief/i.test(`${req.kind || ''} ${req.id || ''}`)
    const value = formValueByKeys(formState, req.keys || [req.id], { allowIntentText })
    const ready = Array.isArray(value)
      ? value.some(item => String(item?.path || item?.name || item || '').trim())
      : Boolean(String(value || '').trim())
    return {
      ...req,
      status: ready ? 'ok' : (req.hard ? 'blocked' : 'warn'),
      detail: ready
        ? (Array.isArray(value) ? `${value.length} 项已关联` : '已提供')
        : (req.hint || '待补充'),
    }
  })
  if (preflight && preflight.ok === false) {
    items.push({
      id: 'executor',
      label: '执行器预检',
      kind: 'executor',
      hard: true,
      system: true,
      status: 'blocked',
      detail: preflight.message || '执行器未就绪',
    })
  }
  const hardBlockers = items.filter(item => item.hard && item.status === 'blocked')
  const warnings = items.filter(item => !item.hard && item.status === 'warn')
  const canSubmit = online
    && !!workflow
    && !locked
    && minGate.ok
    && hardBlockers.length === 0
    && !(preflight && preflight.ok === false)
  return {
    items,
    hardBlockers,
    warnings,
    minGate,
    preflight,
    canSubmit,
    canStart: canSubmit,
  }
}

function buildDaemonLaunchContextFromForm(formState = {}) {
  const intent = String(formState.intent || formState.goal || '').trim()
  const materials = Array.isArray(formState.materials)
    ? formState.materials
    : (Array.isArray(formState.files) ? formState.files : [])
  const paths = materials.map(item => {
    if (!item) return ''
    if (typeof item === 'string') return item.trim()
    return String(item.path || item.name || '').trim()
  }).filter(Boolean)
  const prd = String(formState.prd || '').trim()
    || paths.find(p => /\.(md|docx?|txt)$/i.test(p))
    || (intent.length >= MIN_INTENT_CHARS ? intent : '')
  const resources = paths.filter(p => p !== prd)
  const inputs = {}
  if (prd) inputs.prd = prd
  if (resources.length) inputs.resources = resources
  if (paths.length) inputs.materials = paths
  if (intent) inputs.intent = intent
  return {
    intent,
    inputs,
    materials: paths,
  }
}

  return {
  PRIMARY_LIMIT,
  PATH_PRESENTATION,
  MIN_INTENT_CHARS,
  humanOneLiner,
  curateDaemonPaths,
  daemonPathPresentation,
  daemonMaterialChecklist,
  daemonRunBucket,
  daemonRunStatusLabel,
  daemonRunNextAction,
  daemonRunRecordView,
  compactDaemonCardTitle,
  compactDaemonCardSummary,
  compactDaemonCardBrief,
  DAEMON_PURPOSE_PREFIX,
  PURPOSE_TITLE_MAX,
  resolveDaemonPurposeTitleLocal,
  formatDaemonPurposeTitle,
  daemonTaskCardView,
  filterDaemonRunRecords,
  searchDaemonRunRecords,
  formMeetsMinMaterialGate,
  workflowNeedsCli,
  assessComposePreflight,
  resolveIngestRequirements,
  evaluateIngest,
  buildDaemonLaunchContextFromForm,
}
})
