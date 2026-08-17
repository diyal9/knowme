'use strict'

const crypto = require('crypto')

const TASK_STATUSES = new Set([
  'idle',
  'scanning',
  'analyzing',
  'review',
  'committing',
  'completed',
  'failed',
  'cancelled',
])

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled'])

const ALLOWED_TRANSITIONS = {
  idle: new Set(['scanning', 'cancelled']),
  scanning: new Set(['analyzing', 'failed', 'cancelled']),
  analyzing: new Set(['review', 'failed', 'cancelled']),
  review: new Set(['committing', 'completed', 'failed', 'cancelled']),
  committing: new Set(['completed', 'failed', 'cancelled']),
  completed: new Set([]),
  failed: new Set(['scanning', 'analyzing', 'cancelled']),
  cancelled: new Set(['scanning', 'analyzing']),
}

function now() {
  return new Date().toISOString()
}

function id(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`
}

function hashContent(content) {
  return crypto.createHash('sha256').update(String(content || ''), 'utf8').digest('hex')
}

function normalizeScope(scope = {}) {
  const mode = ['all', 'changed', 'topic', 'selected'].includes(scope.mode)
    ? scope.mode
    : 'changed'
  return {
    mode,
    topic: String(scope.topic || '').trim().slice(0, 160),
    paths: Array.isArray(scope.paths)
      ? [...new Set(scope.paths.map(item => String(item || '').replace(/\\/g, '/')).filter(Boolean))]
      : [],
  }
}

function createTask(input = {}) {
  const createdAt = input.createdAt || now()
  return {
    id: String(input.id || id('kst')),
    kind: 'knowledge-organization',
    status: TASK_STATUSES.has(input.status) ? input.status : 'idle',
    scope: normalizeScope(input.scope),
    total: Math.max(0, Number(input.total) || 0),
    scanned: Math.max(0, Number(input.scanned) || 0),
    analyzed: Math.max(0, Number(input.analyzed) || 0),
    proposalCount: Math.max(0, Number(input.proposalCount) || 0),
    failedCount: Math.max(0, Number(input.failedCount) || 0),
    currentPath: String(input.currentPath || ''),
    error: String(input.error || ''),
    createdAt,
    updatedAt: input.updatedAt || createdAt,
    completedAt: input.completedAt || null,
  }
}

function transitionTask(task, nextStatus, patch = {}) {
  const current = createTask(task)
  const next = String(nextStatus || '')
  if (!TASK_STATUSES.has(next)) {
    return { ok: false, error: `未知任务状态：${next}` }
  }
  if (next !== current.status && !ALLOWED_TRANSITIONS[current.status]?.has(next)) {
    return { ok: false, error: `任务不能从 ${current.status} 进入 ${next}` }
  }
  const updated = createTask({
    ...current,
    ...patch,
    status: next,
    updatedAt: now(),
    completedAt: TERMINAL_STATUSES.has(next) ? (current.completedAt || now()) : null,
  })
  return { ok: true, task: updated }
}

function proposalDiffSummary(sourceContent, proposedContent) {
  const before = String(sourceContent || '').split(/\r?\n/).length
  const after = String(proposedContent || '').split(/\r?\n/).length
  return {
    beforeLines: before,
    afterLines: after,
    lineDelta: after - before,
  }
}

function createProposal(input = {}) {
  const sourceContent = String(input.sourceContent || '')
  const proposedContent = String(input.proposedContent || input.body || '')
  const sourcePath = String(input.sourcePath || input.sourceWikiPath || '').replace(/\\/g, '/')
  const title = String(input.title || sourcePath.split('/').pop() || '未命名知识').slice(0, 120)
  return {
    id: String(input.id || id('ksp')),
    type: 'knowledge_proposal',
    status: input.status === 'accepted' || input.status === 'rejected' ? input.status : 'draft',
    title,
    sourcePath,
    sourceHash: String(input.sourceHash || hashContent(sourceContent)),
    targetPath: String(input.targetPath || `concepts/${title.replace(/[^\w\u4e00-\u9fff-]+/g, '-').slice(0, 80)}.md`)
      .replace(/\\/g, '/'),
    proposedContent,
    rationale: String(input.rationale || '由 AI 根据来源资料生成整理提案').slice(0, 1000),
    confidence: Math.max(0, Math.min(1, Number.isFinite(input.confidence) ? input.confidence : 0.5)),
    diff: input.diff || proposalDiffSummary(sourceContent, proposedContent),
    createdAt: input.createdAt || now(),
    updatedAt: input.updatedAt || now(),
    taskId: String(input.taskId || ''),
  }
}

function proposalKey(proposal) {
  return `${String(proposal?.sourcePath || '')}|${String(proposal?.sourceHash || '')}|${String(proposal?.targetPath || '')}`
}

function dedupeProposals(proposals = []) {
  const byKey = new Map()
  for (const item of proposals) {
    const key = proposalKey(item)
    if (!key) continue
    const previous = byKey.get(key)
    if (!previous || (previous.status === 'draft' && item.status !== 'draft')) {
      byKey.set(key, item)
    }
  }
  return [...byKey.values()]
}

function isTerminal(status) {
  return TERMINAL_STATUSES.has(status)
}

module.exports = {
  TASK_STATUSES,
  TERMINAL_STATUSES,
  createTask,
  transitionTask,
  hashContent,
  createProposal,
  proposalDiffSummary,
  proposalKey,
  dedupeProposals,
  isTerminal,
}
