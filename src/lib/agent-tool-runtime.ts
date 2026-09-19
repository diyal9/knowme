'use strict'

/**
 * Agent Tool Runtime
 *
 * Function Calling 只负责产生 tool call；本模块负责把 Agent、Skill 和
 * 工作流的调用统一投影到现有 tool surface / registry / executor。
 * 旧工具名仍然受支持，toolRef 是新的稳定引用格式。
 */

const { resolveToolSurfaceForRun } = require('./tool-surface-builder')
const { DISCOVERY_NAME, DISCOVERY_TOOL, discoverAuthorizedTools, validateDiscovery } = require('./agent-tool-discovery')

const TOOL_RUNTIME_PROTOCOL_VERSION = '1'
const DEFAULT_TOOL_WINDOW = 8
const MAX_TOOL_WINDOW = 16
const BOOTSTRAP_TOOLS = new Set(['discover_capabilities', 'request_capability_access', 'list_skills', 'load_skill'])

function toolDefinition(record: any = {}) {
  if (record?.definition?.function?.name) return record.definition
  if (record?.function?.name) return record
  return null
}

function toolName(record: any = {}) {
  return String(toolDefinition(record)?.function?.name || record?.name || '').trim()
}

function normalizeContract(record: any = {}) {
  record = record?._knowme ? record : (record.definition || record)
  const contract = record?._knowme && typeof record._knowme === 'object'
    ? record._knowme
    : {}
  return {
    source: String(contract.source || 'unknown'),
    capability: String(contract.capability || 'general'),
    risk: String(contract.risk || (contract.sideEffects ? 'write' : 'read')),
    sideEffects: contract.sideEffects === true,
    requiresApproval: contract.requiresApproval === true,
    scope: String(contract.scope || 'run'),
    timeoutMs: Number.isFinite(Number(contract.timeoutMs)) ? Number(contract.timeoutMs) : null,
    idempotencySupported: contract.idempotencySupported === true,
  }
}

function buildToolCapabilityManifest(records: any[] = []) {
  return (Array.isArray(records) ? records : [])
    .map((record) => {
      const definition = toolDefinition(record)
      const name = toolName(record)
      if (!name) return null
      return {
        name,
        description: String(definition?.function?.description || '').replace(/\s+/g, ' ').trim().slice(0, 180),
        contract: normalizeContract(record),
      }
    })
    .filter(Boolean)
}

function capabilityFamily(item = {}) {
  const contract = item.contract || normalizeContract(item)
  return String(contract.capability || contract.source || 'general').trim().toLowerCase() || 'general'
}

function buildToolCapabilityIndex(records: any[] = []) {
  const manifest = buildToolCapabilityManifest(records)
  const grouped = new Map()
  for (const item of manifest) {
    const family = capabilityFamily(item)
    const current = grouped.get(family) || { id: family, count: 0 }
    current.count += 1
    grouped.set(family, current)
  }
  return {
    totalTools: manifest.length,
    families: [...grouped.values()],
  }
}

function compactText(value, max = 180) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max)
}

function textTokens(value) {
  const text = String(value || '').toLowerCase()
  const tokens = new Set(text.match(/[a-z0-9][a-z0-9_.-]*/g) || [])
  // Chinese does not have whitespace boundaries. Bounded character bigrams are
  // enough for intent matching without adding a tokenizer dependency.
  const han = text.match(/[\u4e00-\u9fff]+/g) || []
  for (const part of han) {
    if (part.length <= 4) tokens.add(part)
    for (let i = 0; i < part.length - 1; i++) tokens.add(part.slice(i, i + 2))
  }
  return new Set([...tokens].filter(token => !['the', 'a', 'an', 'this', 'that', 'and', 'or', 'to', 'for', 'with',
    'please', 'help', 'me', 'you', 'task', 'tool', 'tools', '任务', '帮我', '请帮', '完成', '工具'].includes(token)))
}

function matchesToolTerm(text, term) {
  if (!text.includes(term)) return false
  if (/^[a-z0-9_.-]+$/i.test(term)) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, 'i').test(text)
  }
  return text.includes(term)
}

// Follow the existing KNOWME_TOOL_SURFACE environment-gate convention. This
// flag changes ranking only; it cannot restore a full-schema/ungoverned mode.
function toolSelectionStrategy(options = {}) {
  return String(options.strategy || process.env.KNOWME_TOOL_SELECTION || '').trim().toLowerCase() === 'bounded-baseline'
    ? 'bounded-baseline' : 'dynamic'
}

function hintedFamilies(prompt = '') {
  const text = String(prompt || '').toLowerCase()
  const hints = new Set()
  const add = (value) => String(value).split('|').forEach(item => hints.add(item))
  if (/(图片|图像|生图|icon|logo|psd|photoshop|视觉|设计)/i.test(text)) add('image|artifact|design|photoshop')
  if (/(飞书|\blark\b|\bfeishu\b)/i.test(text)) add('feishu|lark')
  if (/(文档|\bdocuments?\b)/i.test(text)) add('document')
  if (/(会议|\bmeetings?\b)/i.test(text)) add('meeting')
  if (/(消息|\bmessages?\b)/i.test(text)) add('message')
  if (/(日历|\bcalendar\b)/i.test(text)) add('calendar')
  if (/(多维表|多维表格|电子表格|数据表格|\bbitable\b|\bspreadsheet\b)/i.test(text)) add('bitable|spreadsheet|table')
  if (/(知识库|知识|wiki|检索|搜索|资料)/i.test(text)) add('knowledge|search|retrieval|file-read')
  if (/(文件|附件|目录|文件夹|读取|内容)/i.test(text)) add('file|read|content')
  if (/(网页|网络|互联网|新闻|url|链接)/i.test(text)) add('web|network')
  if (/(生成|创建|写入|修改|编辑|导出|保存|发送)/i.test(text)) add('artifact|write|file-write|image')
  return hints
}

function scoreTool(item, promptTokens, promptText, familyHints, required, previous, failed) {
  const name = item.name.toLowerCase()
  const description = item.description.toLowerCase()
  const family = capabilityFamily(item)
  let score = 0
  if (required.has(item.name) || failed.has(item.name)) score += 10_000
  if (previous.has(item.name)) score += 1_000
  if ([...familyHints].some(hint => matchesToolTerm(family, hint))) score += 300
  for (const hint of familyHints) {
    if (matchesToolTerm(family, hint) || matchesToolTerm(description, hint) || matchesToolTerm(name, hint)) score += 20
  }
  if (matchesToolTerm(promptText, name)) score += 500
  for (const token of promptTokens) {
    if (token.length < 2) continue
    if (matchesToolTerm(name, token)) score += 24
    if (matchesToolTerm(description, token)) score += 8
    if (matchesToolTerm(family, token)) score += 12
  }
  return score
}

/**
 * Select only the schemas relevant to the current intent. The complete record
 * set remains in the runtime for authorization/execution; this is only the
 * model-facing projection.
 */
function selectToolDefinitions(records: any[] = [], options: any = {}) {
  const strategy = toolSelectionStrategy(options)
  if (!records.length || options.toolsEnabled === false) return { definitions: [], selectedNames: [], families: [], expanded: false, totalTools: 0, omittedCount: 0 }
  records = [...records.filter(record => toolName(record) !== DISCOVERY_NAME), DISCOVERY_TOOL]
  const manifest = buildToolCapabilityManifest(records)
  if (!manifest.length) return { definitions: [], selectedNames: [], families: [], expanded: false }
  const prompt = compactText(options.prompt, 4000).toLowerCase()
  const promptTokens = textTokens(prompt)
  const familyHints = hintedFamilies(prompt)
  const required = new Set((options.requiredTools || []).map(String).filter(Boolean))
  const previous = new Set((options.previousToolNames || []).map(String).filter(Boolean))
  const failed = new Set((options.failedToolNames || []).map(String).filter(Boolean))
  const discovered = new Set((options.discoveredToolNames || []).map(String).filter(Boolean))
  const expansion = Math.max(0, Math.min(2, Number(options.expansion) || 0))
  const requestedWindow = Number(options.maxTools) || DEFAULT_TOOL_WINDOW
  const maxTools = Math.max(1, Math.min(MAX_TOOL_WINDOW, requestedWindow + expansion * 4))
  const indexed = manifest.map((item, index) => ({
    ...item,
    index,
    score: item.name === DISCOVERY_NAME ? 1_000_000
      : BOOTSTRAP_TOOLS.has(item.name) ? 100_000
      : (strategy === 'bounded-baseline'
        ? (required.has(item.name) || failed.has(item.name) ? 10_000 : previous.has(item.name) ? 1_000
          : scoreTool(item, promptTokens, prompt, new Set(), new Set(), new Set(), new Set()) > 0 ? 1 : 0)
        : scoreTool(item, promptTokens, prompt, familyHints, required, previous, failed)) + (discovered.has(item.name) ? 5_000 : 0),
  }))
  const ranked = [...indexed].sort((a, b) => b.score - a.score || a.index - b.index)
  const selected = []
  const seen = new Set()
  const add = (item) => {
    if (!item || seen.has(item.name)) return
    seen.add(item.name)
    selected.push(item)
  }
  ranked.forEach(item => {
    if (selected.length < maxTools && item.score > 0) add(item)
  })
  const selectedNames = selected.map(item => item.name)
  const definitions = selectedNames.map(name => toolDefinition(records.find(record => toolName(record) === name)))
    .filter(Boolean).map(definition => ({ type: definition.type || 'function', function: definition.function }))
  return {
    definitions,
    strategy,
    selectedNames,
    families: [...new Set(selected.map(capabilityFamily))],
    expanded: expansion > 0,
    totalTools: manifest.length,
    omittedCount: Math.max(0, manifest.length - definitions.length),
  }
}

function buildToolRuntimeInstruction(records: any[] = [], { locale = 'zh-CN', selectedNames = [], mode = 'index' } = {}) {
  const index = buildToolCapabilityIndex(records)
  if (!index.totalTools) return null
  const isChinese = String(locale || '').toLowerCase().startsWith('zh')
  const lines = isChinese
    ? [
        '【KnowMe 工具运行时】',
        `运行时已注册 ${index.totalTools} 个工具，当前采用渐进式装载；模型侧只会看到与当前任务相关的最小工具窗口。`,
        '调用决策：先判断目标是否需要外部事实、当前文件/项目内容、连接器数据或真实产物；需要时主动调用最小且相关的工具集合，按依赖顺序调用，并等待真实结果后再下结论。不要因为用户没有点选按钮就放弃调用。',
        '结果规则：工具成功结果才是执行证据；工具失败、空结果或仅返回草稿不能被表述为已完成。多步骤任务要根据上一步结果决定下一步，而不是预先假设结果。',
        '恢复规则：先按错误类别处理——参数错误可安全修正后重试；网络/超时仅对声明为无副作用的工具退避重试；授权/权限问题不要机械重试，应切换到授权流程或明确告知用户；工具不存在/能力未加载时尝试本轮已注册的替代工具；仍不能完成时输出具体缺口、修复动作和下一步。',
      ]
    : [
        '[KnowMe tool runtime]',
        `${index.totalTools} Function Calling tools are registered, but only the smallest task-relevant schema window is exposed to the model.`,
        'Decision: determine whether the goal requires external facts, current files/project data, connector data, or a real artifact. If so, proactively call the smallest relevant tool set in dependency order and wait for real results. Do not wait for a UI button when the task itself requires a tool.',
        'Evidence: only successful tool results prove an operation. Do not claim completion from a failed call, empty result, or draft preview. Use each step result to choose the next step.',
        'Recovery: safely repair invalid arguments; retry network/timeout only for side-effect-free tools; do not repeat authorization failures; use a registered alternative when available; otherwise state the concrete gap, fix, and next action.',
      ]
  lines.push(isChinese ? '能力族索引（详情按需装载）：' : 'Capability index (details load on demand):')
  lines.push('discover_tools(query, cursor, limit): search the authorized catalog or page with an empty query. Results select next-round schemas; discovery does not authorize execution.')
  for (const family of index.families) {
    // Imported capability metadata is not trusted instruction prose.
    if (!/^[a-z0-9][a-z0-9_.:-]{0,79}$/i.test(family.id)) continue
    lines.push(`- ${family.id} (${family.count})`)
  }
  const safeSelectedNames = selectedNames.filter(name => /^[a-z0-9][a-z0-9_.:-]{0,79}$/i.test(name))
  if (safeSelectedNames.length) lines.push(`${isChinese ? '本轮已装载：' : 'Loaded this round:'} ${safeSelectedNames.join(', ')}`)
  return {
    id: mode === 'index' ? 'tool.runtime-index' : 'tool.runtime-manifest',
    kind: 'tool_contract',
    authority: 'platform',
    priority: 97,
    maxTokens: mode === 'index' ? 480 : 900,
    cachePolicy: 'turn',
    content: lines.join('\n'),
    source: { type: 'tool-runtime', id: 'function-calling-manifest', version: TOOL_RUNTIME_PROTOCOL_VERSION },
    manifest: mode === 'index' ? undefined : buildToolCapabilityManifest(records),
    index,
  }
}

function asToolRef(ref: any) {
  if (typeof ref === 'string') return { id: ref, version: '*', name: ref }
  if (!ref || typeof ref !== 'object') return { id: '', version: '*', name: '' }
  return {
    id: String(ref.id || ref.name || '').trim(),
    version: String(ref.version || '*').trim(),
    name: String(ref.name || '').trim(),
  }
}

function candidatesForRef(ref: any) {
  const normalized = asToolRef(ref)
  const id = normalized.id
  const short = id.split('.').filter(Boolean).at(-1) || id
  return [...new Set([normalized.name, id, short].filter(Boolean))]
}

function findToolName(surface: any, ref: any) {
  const candidates = candidatesForRef(ref)
  for (const name of candidates) {
    if (name === DISCOVERY_NAME || surface?.isAllowedTool?.(name) === true) return name
    const validation = surface?.validateToolCall?.(name, '{}')
    if (!surface?.isAllowedTool && (validation?.ok === true || validation?.code === 'invalid_args')) return name
  }
  return candidates[0] || ''
}

function makeReceipt({ runId, toolName, toolRef, result, startedAt }: any) {
  const finishedAt = new Date().toISOString()
  return {
    runId: String(runId || ''),
    toolName,
    toolRef: asToolRef(toolRef),
    status: !result || result.ok === false ? 'failed' : result.requiresApproval ? 'pending' : 'succeeded',
    startedAt,
    finishedAt,
    durationMs: Math.max(0, Date.parse(finishedAt) - Date.parse(startedAt)),
    auditId: result?.auditId || null,
    evidenceRefs: Array.isArray(result?.evidenceRefs) ? result.evidenceRefs : [],
    // Keep adapter execution evidence when adding runtime timing/identity.
    effects: result?.ok !== false && Array.isArray(result?.receipt?.effects) ? result.receipt.effects : [],
  }
}

async function createAgentToolRuntime(options: any = {}) {
  const resolver = options.resolveToolSurfaceForRun || resolveToolSurfaceForRun
  const resolved = await resolver(options)
  const surface = resolved?.surface
  if (!surface) throw new Error('Tool Runtime 未获得工具面')
  const executor = surface.createToolExecutor({
    ...(options.executorDeps || {}),
    signal: options.signal || options.executorDeps?.signal,
  })

  const execute = async (call: any = {}) => {
    const ref = call.toolRef || call.ref || call.name || ''
    const toolName = findToolName(surface, ref)
    const startedAt = new Date().toISOString()
    if (!toolName) {
      const result = { ok: false, code: 'missing_tool_ref', text: '工具引用为空' }
      return { ...result, receipt: makeReceipt({ runId: options.runId, toolName, toolRef: ref, result, startedAt }) }
    }
    const validation = toolName === DISCOVERY_NAME ? validateDiscovery(call.arguments ?? call.args)
      : surface.validateToolCall?.(toolName, call.arguments ?? call.args)
    if (!validation?.ok || (toolName === DISCOVERY_NAME && !surface.getToolDefinitions().length)
      || (toolName !== DISCOVERY_NAME && surface.isAllowedTool?.(toolName) === false)) {
      const result = { ok: false, code: validation?.code || 'scope_denied', text: validation?.message || '工具未授权', executionStarted: false }
      return { ...result, receipt: makeReceipt({ runId: options.runId, toolName, toolRef: ref, result, startedAt }) }
    }
    const result = toolName === DISCOVERY_NAME ? discoverAuthorizedTools(surface, validation.args) : await executor.executeToolCall({
      id: call.id,
      name: toolName,
      arguments: call.arguments ?? call.args ?? {},
    })
    return {
      ...result,
      toolName: result?.toolName || toolName,
      toolRef: asToolRef(ref),
      receipt: makeReceipt({ runId: options.runId, toolName, toolRef: ref, result, startedAt }),
    }
  }

  return {
    mode: resolved.mode || 'v1',
    snapshot: {
      runId: options.runId || null,
      mode: resolved.mode || 'v1',
      tools: typeof surface.getToolRecords === 'function' ? surface.getToolRecords() : surface.getToolDefinitions(),
    },
    surface,
    registry: resolved.registry || null,
    get definitions() {
      const definitions = surface.getToolDefinitions().filter(def => def.function?.name !== DISCOVERY_NAME)
      return definitions.length ? [...definitions, DISCOVERY_TOOL] : []
    },
    validate: (name, raw) => name === DISCOVERY_NAME
      ? (surface.getToolDefinitions().length ? validateDiscovery(raw) : { ok: false, code: 'scope_denied', message: '当前运行没有可发现工具。' })
      : surface.validateToolCall(name, raw),
    execute,
    close: resolved.close || (async () => {}),
  }
}

module.exports = {
  TOOL_RUNTIME_PROTOCOL_VERSION,
  asToolRef,
  candidatesForRef,
  findToolName,
  normalizeContract,
  buildToolCapabilityManifest,
  buildToolCapabilityIndex,
  selectToolDefinitions,
  buildToolRuntimeInstruction,
  createAgentToolRuntime,
}
