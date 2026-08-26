'use strict'

/**
 * 工作流供给管道（纯数据，无 IO，可 Node 单测）
 *
 * 把仓库、Daemon 目录、个人存储、垂直切片四路来源汇聚为货架数据：
 *   收集 → 择优 → 排除 → 判定可运行性
 *
 * 文件读取在主进程完成，本模块只接收已解析的定义对象。
 */

const workflowPackage = require('./workflow-package')
const workbenchModel = require('./workbench-model')
const { enrichExternalWorkflowPackage } = require('./external-workflow-recipes')

const MAX_REPO_WORKFLOWS = 32

/** 历史别名 → 实际存在的 Agent 标识。新增条目意味着某处曾写错引用，应逐步清理源头。 */
const AGENT_ALIASES = Object.freeze({
  'office-assistant': 'office-partner',
})

/** 同 id 冲突时的兜底优先级，仅在可执行内容同样完整时生效。 */
const ORIGIN_PRIORITY = Object.freeze({
  official: 5,
  personal: 4,
  repo: 3,
  daemon: 2,
  seed: 1,
})

const HIDDEN_VISIBILITY = new Set(['deprecated', 'internal'])

function text(value) {
  return String(value == null ? '' : value).trim()
}

function list(value) {
  return Array.isArray(value) ? value : []
}

function resolveAgentId(id) {
  const raw = text(id)
  return AGENT_ALIASES[raw] || raw
}

function normalizeAgentRefs(refs) {
  const seen = new Set()
  const result = []
  for (const ref of list(refs)) {
    const id = resolveAgentId(typeof ref === 'string' ? ref : ref?.id)
    if (!id || seen.has(id)) continue
    seen.add(id)
    result.push({ id })
  }
  return result
}

function visibilityOf(source) {
  return text(source?.catalog?.visibility).toLowerCase()
}

/**
 * 把仓库工作流 JSON 定义转成 Workflow Package 的 graph 结构。
 * 这是「投影丢 graph」缺陷的修复点：此前只取 index 元数据，正文从未被读取。
 */
function graphFromDefinition(definition, entry = {}) {
  const parsed = workbenchModel.parseWorkflow(definition, {
    id: entry.id,
    name: entry.name,
    path: entry.path,
  })
  const built = workbenchModel.buildWorkflowGraph(parsed)
  const nodes = parsed.nodes
    .filter(node => node.id)
    .map(node => ({
      id: node.id,
      type: node.type,
      agentPackageId: resolveAgentId(node.agent),
      name: node.nodeKey || node.id,
      intent: node.intent,
      role: node.script || node.gateId || '',
    }))
  const agentRefs = normalizeAgentRefs(parsed.nodes.map(node => node.agent).filter(Boolean))
  return { nodes, edges: built.edges, agentRefs, entryNode: parsed.entryNode }
}

function candidateFrom(raw, origin, meta = {}) {
  const normalized = workflowPackage.normalizeWorkflowPackage(enrichExternalWorkflowPackage(raw))
  if (!normalized.ok) return null
  return {
    origin,
    visibility: meta.visibility || '',
    package: normalized.package,
  }
}

function collectRepo(entries, diagnostics) {
  const candidates = []
  const all = list(entries)
  const usable = all.slice(0, MAX_REPO_WORKFLOWS)
  if (all.length > usable.length) {
    diagnostics.push({
      origin: 'repo',
      code: 'truncated',
      count: all.length - usable.length,
      reason: `仓库工作流条目超过 ${MAX_REPO_WORKFLOWS} 个，超出部分未载入`,
    })
  }
  for (const entry of usable) {
    const id = text(entry?.id)
    if (!id) continue
    const graph = entry?.definition
      ? graphFromDefinition(entry.definition, entry)
      : { nodes: [], edges: [], agentRefs: [] }
    const candidate = candidateFrom({
      id,
      name: entry.name || id,
      description: entry.description || entry.summary || '',
      source: 'team',
      status: 'published',
      goalTypes: entry.tags || [],
      executionBackends: ['daemon', 'local-team'],
      agentRefs: graph.agentRefs,
      graph: {
        nodes: graph.nodes,
        edges: graph.edges,
        goal: entry.description || entry.summary || '',
      },
      provenance: { path: entry.path || '', kind: 'professional' },
    }, 'repo', { visibility: visibilityOf(entry) })
    if (candidate) candidates.push(candidate)
  }
  return candidates
}

function collectDaemon(daemon) {
  const candidates = []
  for (const item of list(daemon?.workflows)) {
    const id = text(item?.id || item?.workflow)
    if (!id) continue
    const candidate = candidateFrom({
      id,
      name: item.name || item.title || id,
      description: item.description || item.summary || '',
      source: 'official',
      status: 'published',
      goalTypes: item.tags || [],
      executionBackends: ['daemon'],
      agentRefs: normalizeAgentRefs(item.agentIds || item.agents),
      provenance: { kind: 'daemon-professional' },
    }, 'daemon', { visibility: visibilityOf(item) })
    if (candidate) candidates.push(candidate)
  }
  return candidates
}

function collectPersonal(personal) {
  const candidates = []
  for (const item of list(personal)) {
    if (!text(item?.id)) continue
    const candidate = candidateFrom({
      ...item,
      agentRefs: normalizeAgentRefs(item.agentRefs),
    }, 'personal')
    if (candidate) candidates.push(candidate)
  }
  return candidates
}

function collectSeeds(verticals) {
  const candidates = []
  for (const item of list(verticals)) {
    const seed = item?.package || item
    if (!text(seed?.id)) continue
    const origin = text(seed.source).toLowerCase() === 'official' ? 'official' : 'seed'
    const candidate = candidateFrom({
      ...seed,
      agentRefs: normalizeAgentRefs(seed.agentRefs),
    }, origin)
    if (candidate) candidates.push(candidate)
  }
  return candidates
}

function executableWeight(candidate) {
  const pkg = candidate.package
  return [
    list(pkg.graph?.nodes).length,
    list(pkg.agentRefs).length,
    ORIGIN_PRIORITY[candidate.origin] || 0,
  ]
}

/**
 * 同 id 择优：保留可执行内容最完整的一份。
 * 修正此前「先到先得」导致空壳压过完整定义的缺陷。
 */
function prefer(candidates, diagnostics) {
  const byId = new Map()
  for (const candidate of candidates) {
    const id = candidate.package.id
    const current = byId.get(id)
    if (!current) {
      byId.set(id, candidate)
      continue
    }
    const [an, aa, ap] = executableWeight(candidate)
    const [bn, ba, bp] = executableWeight(current)
    const wins = an !== bn ? an > bn : (aa !== ba ? aa > ba : ap > bp)
    const loser = wins ? current : candidate
    if (wins) byId.set(id, candidate)
    diagnostics.push({
      origin: loser.origin,
      id,
      code: 'superseded',
      reason: `同名工作流由 ${wins ? candidate.origin : current.origin} 来源提供了更完整的定义`,
    })
  }
  return [...byId.values()]
}

function exclude(candidates, diagnostics) {
  const kept = []
  for (const candidate of candidates) {
    const pkg = candidate.package
    if (HIDDEN_VISIBILITY.has(candidate.visibility)) {
      diagnostics.push({
        origin: candidate.origin,
        id: pkg.id,
        name: pkg.name,
        code: 'hidden',
        reason: `目录可见性为 ${candidate.visibility}`,
      })
      continue
    }
    if (pkg.status === 'archived') {
      diagnostics.push({
        origin: candidate.origin,
        id: pkg.id,
        name: pkg.name,
        code: 'archived',
        reason: '工作流已归档',
      })
      continue
    }
    if (!list(pkg.graph?.nodes).length && !list(pkg.agentRefs).length) {
      diagnostics.push({
        origin: candidate.origin,
        id: pkg.id,
        name: pkg.name,
        code: 'empty-shell',
        reason: '既无执行节点也无参与 Agent，无法执行',
      })
      continue
    }
    kept.push(candidate)
  }
  return kept
}

function buildAgentIndex(agents) {
  const index = new Set()
  for (const agent of list(agents)) {
    const id = text(typeof agent === 'string' ? agent : agent?.id)
    if (id) index.add(id)
  }
  return index
}

/**
 * 单条工作流的可运行性判定。
 * 刻意不使用所属领域的整体 readiness —— 那是「明明能跑却显示需要准备」的根因。
 */
function readinessOf(candidate, context) {
  const pkg = candidate.package
  const blockers = []
  const backends = list(pkg.executionBackends)
  const canUseDaemon = backends.includes('daemon') && context.daemonOnline
  const canUseLocal = backends.some(item => item === 'local-team' || item === 'legacy-local')
    && context.localTeamEnabled

  if (!canUseDaemon && !canUseLocal) {
    blockers.push(backends.includes('daemon') && !context.daemonOnline
      ? { code: 'daemon-offline', label: '需要连接管线服务', fixAction: { kind: 'connect-daemon' } }
      : { code: 'no-backend', label: '当前环境没有可用的执行方式', fixAction: { kind: 'open-backends' } })
  }

  if (candidate.origin === 'repo' && !context.repoActive) {
    blockers.push({
      code: 'repo-required',
      label: '需要激活对应的内容源',
      fixAction: { kind: 'activate-repo' },
    })
  }

  for (const ref of list(pkg.agentRefs)) {
    if (context.agentIndex.has(ref.id)) continue
    blockers.push({
      code: 'missing-agent',
      label: `缺少专家：${ref.id}`,
      agentId: ref.id,
      fixAction: { kind: 'install-agent', agentId: ref.id },
    })
  }

  if (pkg.status === 'unavailable' && !blockers.length) {
    blockers.push({
      code: 'unavailable',
      label: '该工作流当前不可用',
      fixAction: { kind: 'open-backends' },
    })
  }

  return {
    runnable: blockers.length === 0,
    backend: canUseLocal ? 'local-team' : (canUseDaemon ? 'daemon' : ''),
    blockers,
  }
}

function buildWorkflowSupply(input = {}) {
  const diagnostics = []
  const daemonOnline = input.daemon?.online === true
  const context = {
    daemonOnline,
    repoActive: input.repoActive === true,
    localTeamEnabled: input.localTeamEnabled !== false,
    agentIndex: buildAgentIndex(input.agents),
  }

  const candidates = [
    ...collectRepo(input.repoWorkflows, diagnostics),
    ...collectDaemon(input.daemon),
    ...collectPersonal(input.personal),
    ...collectSeeds(input.verticals),
  ]

  const kept = exclude(prefer(candidates, diagnostics), diagnostics)

  const packages = kept.map(candidate => ({
    ...candidate.package,
    origin: candidate.origin,
    readiness: readinessOf(candidate, context),
  }))

  if (!daemonOnline) {
    diagnostics.push({
      origin: 'daemon',
      code: 'offline',
      reason: '管线服务未连接，其目录中的工作流未载入',
      fixAction: { kind: 'connect-daemon' },
    })
  }
  if (!context.repoActive) {
    diagnostics.push({
      origin: 'repo',
      code: 'inactive',
      reason: '没有激活的内容源，仓库工作流未载入',
      fixAction: { kind: 'activate-repo' },
    })
  }

  const runnable = packages.filter(item => item.readiness.runnable)
  const byOrigin = packages.reduce((acc, item) => {
    acc[item.origin] = (acc[item.origin] || 0) + 1
    return acc
  }, {})

  return {
    packages,
    diagnostics,
    stats: {
      total: packages.length,
      runnable: runnable.length,
      blocked: packages.length - runnable.length,
      daemonOnline,
      repoActive: context.repoActive,
      byOrigin,
    },
  }
}

module.exports = {
  MAX_REPO_WORKFLOWS,
  AGENT_ALIASES,
  resolveAgentId,
  graphFromDefinition,
  buildWorkflowSupply,
}
