'use strict'

/**
 * 日志中心分组：把同一次 AI 运行（相同 runId）的多轮日志聚合成一组。
 *
 * 纯函数，无 DOM 依赖，供渲染层与单测共用。
 */

const LEVEL_RANK = { debug: 10, info: 20, warn: 30, error: 40 }
const SCOPE_TITLES = {
  'ai-generate': 'AI 对话',
  'agent-run': 'Agent 运行',
}
const MIN_GROUP_SIZE = 2

function tsValue(entry) {
  const t = Date.parse((entry && entry.ts) || '')
  return Number.isFinite(t) ? t : 0
}

function levelRank(level) {
  return LEVEL_RANK[String(level || '').toLowerCase()] || 0
}

function roundOf(entry) {
  const raw = entry && entry.meta && entry.meta.round
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

function shortRunId(runId) {
  const s = String(runId || '')
  return s.length > 10 ? `…${s.slice(-8)}` : s
}

/** 汇总一组日志：轮次、模型、耗时跨度、最高级别。 */
function summarizeRun(entries) {
  const list = Array.isArray(entries) ? entries : []
  const sorted = [...list].sort((a, b) => tsValue(a) - tsValue(b))
  const first = sorted[0] || {}
  const last = sorted[sorted.length - 1] || {}

  let model = ''
  let level = 'debug'
  let warnCount = 0
  let errorCount = 0
  const categories = []
  // 轮次取组内出现过的不同轮号数量，这样筛选后的卡片不会声称包含未展示的轮次
  const roundNos = new Set()

  for (const e of sorted) {
    const r = roundOf(e)
    if (r) roundNos.add(r)
    if (!model && e.meta && typeof e.meta.model === 'string') model = e.meta.model
    if (levelRank(e.level) > levelRank(level)) level = String(e.level || 'info')
    if (e.level === 'warn') warnCount += 1
    if (e.level === 'error') errorCount += 1
    if (e.category && !categories.includes(e.category)) categories.push(e.category)
  }
  const rounds = roundNos.size || sorted.filter(e => e.event === 'llm-request').length

  const scope = first.scope || sorted.find(e => e.scope)?.scope || ''
  return {
    runId: first.runId || '',
    runIdShort: shortRunId(first.runId),
    scope,
    title: SCOPE_TITLES[scope] || (scope ? scope : '关联日志'),
    count: sorted.length,
    rounds,
    model,
    level,
    warnCount,
    errorCount,
    categories,
    startTs: first.ts || '',
    endTs: last.ts || '',
    spanMs: Math.max(0, tsValue(last) - tsValue(first)),
  }
}

/**
 * 把日志列表转换为渲染项：同 runId 且条数 >= minGroupSize 的合并为 group。
 * 入参顺序（通常按时间倒序）决定输出顺序，组的位置取该组首次出现的位置。
 *
 * @returns {Array<{ type: 'entry', entry: object } | { type: 'group', runId: string, entries: object[], summary: object }>}
 */
function groupLogEntries(entries, opts = {}) {
  const list = Array.isArray(entries) ? entries : []
  if (opts.enabled === false) return list.map(entry => ({ type: 'entry', entry }))
  const minSize = Number.isFinite(opts.minGroupSize) ? opts.minGroupSize : MIN_GROUP_SIZE

  const buckets = new Map()
  for (const e of list) {
    const runId = e && e.runId ? String(e.runId) : ''
    if (!runId) continue
    if (!buckets.has(runId)) buckets.set(runId, [])
    buckets.get(runId).push(e)
  }

  const emitted = new Set()
  const items = []
  for (const e of list) {
    const runId = e && e.runId ? String(e.runId) : ''
    const bucket = runId ? buckets.get(runId) : null
    if (!bucket || bucket.length < minSize) {
      items.push({ type: 'entry', entry: e })
      continue
    }
    if (emitted.has(runId)) continue
    emitted.add(runId)
    const ordered = [...bucket].sort((a, b) => tsValue(a) - tsValue(b))
    items.push({ type: 'group', runId, entries: ordered, summary: summarizeRun(ordered) })
  }
  return items
}

const logGrouping = {
  groupLogEntries,
  summarizeRun,
  roundOf,
  MIN_GROUP_SIZE,
}

if (typeof module === 'object' && module.exports) module.exports = logGrouping
if (typeof window !== 'undefined') window.LogGrouping = logGrouping
