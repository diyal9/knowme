/**
 * Agent message reducer for v2 output protocol.
 * Node tests: require('./lib/agent-message-state')
 * Browser: <script src="lib/agent-message-state.js"> → window.AgentMessageState
 */
;(function (root, factory) {
  const api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  if (root) root.AgentMessageState = api
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict'

  const PROTOCOL_VERSION = 2
  const MAX_DIAGNOSTICS = 16
  const MAX_TIMELINE = 48
  const MAX_SUBRUN_PHASES = 12

  const TERMINAL_TYPES = new Set([
    'run.completed',
    'run.cancelled',
    'run.failed',
  ])

  const SUBRUN_TYPES = new Set([
    'subrun.started',
    'subrun.progress',
    'subrun.waiting',
    'subrun.completed',
    'subrun.failed',
    'subrun.cancelled',
    'subrun.terminal',
  ])

  const SUBRUN_TERMINAL_TYPES = new Set([
    'subrun.completed',
    'subrun.failed',
    'subrun.cancelled',
    'subrun.terminal',
  ])

  const REDACT_KEY_PATTERN = /token|authorization|password|secret|apikey|api_key|credential/i

  function cloneUi(ui) {
    return (Array.isArray(ui) ? ui : []).map(item => ({
      kind: item.kind || 'choice',
      title: item.title || '',
      items: Array.isArray(item.items) ? item.items.map(it => ({ ...it })) : [],
    }))
  }

  function redactSensitiveValue(key, value) {
    if (REDACT_KEY_PATTERN.test(String(key || ''))) return '[REDACTED]'
    if (typeof value === 'string') {
      if (/Bearer\s+[A-Za-z0-9\-._~+/]+=*/i.test(value)) return '[REDACTED]'
      if (/^t-[A-Za-z0-9]{10,}/.test(value)) return '[REDACTED]'
    }
    return value
  }

  function redactSensitiveFields(obj, depth = 0) {
    if (depth > 6 || obj == null) return obj
    if (Array.isArray(obj)) return obj.map((v) => redactSensitiveFields(v, depth + 1))
    if (typeof obj !== 'object') return obj
    const out = {}
    for (const [k, v] of Object.entries(obj)) {
      if (REDACT_KEY_PATTERN.test(k)) {
        out[k] = '[REDACTED]'
      } else if (v && typeof v === 'object') {
        out[k] = redactSensitiveFields(v, depth + 1)
      } else {
        out[k] = redactSensitiveValue(k, v)
      }
    }
    return out
  }

  function stopReasonLabel(stopReason, code) {
    const key = String(stopReason || code || '').toLowerCase()
    const labels = {
      cancelled: '已取消',
      canceled: '已取消',
      error: '执行失败',
      failed: '执行失败',
      completed: '已完成',
      protocol_unsupported: '协议不兼容',
      scope_denied: '权限不足',
      timeout: '执行超时',
      interrupted: '执行中断，可恢复',
      recovering: '等待恢复',
    }
    return labels[key] || (key ? key : '已终止')
  }

  function builderLabel(builderId) {
    const id = String(builderId || '').toLowerCase()
    const labels = {
      'knowme-local': '本地',
      'local-executor': '本地',
      local: '本地',
      cursor: 'Cursor',
      'cursor-package': 'Cursor',
      claude: 'Claude',
      'claude-package': 'Claude',
      'daemon-agent': '管线服务',
      daemon: '管线服务',
      remote: '远程',
    }
    return labels[id] || (builderId ? String(builderId) : '本地')
  }

  function normalizeSubRunTerminal(payload = {}, type = '') {
    const explicit = String(payload.terminal || payload.status || '').toLowerCase()
    if (explicit === 'completed' || explicit === 'done' || explicit === 'success') return 'completed'
    if (explicit === 'cancelled' || explicit === 'canceled') return 'cancelled'
    if (explicit === 'error' || explicit === 'failed') return 'failed'
    if (type === 'subrun.completed') return 'completed'
    if (type === 'subrun.cancelled') return 'cancelled'
    if (type === 'subrun.failed') return 'failed'
    if (type === 'subrun.terminal') return explicit || 'completed'
    return explicit || 'completed'
  }

  function createRunTree(runId) {
    return {
      rootRunId: String(runId || 'run'),
      nodes: {},
    }
  }

  function createSubRunNode(subRunId, seed = {}) {
    return {
      subRunId: String(subRunId),
      parentRunId: seed.parentRunId || null,
      expertId: seed.expertId || null,
      builderId: seed.builderId || 'knowme-local',
      phase: seed.phase || null,
      status: seed.status || 'running',
      terminal: null,
      stopReason: null,
      lastSeq: 0,
      frozen: false,
      retriable: false,
      attempt: seed.attempt || 1,
      summary: seed.summary || '',
      phases: [],
      handoffs: [],
      approvals: [],
      artifacts: [],
      evidence: [],
      budget: seed.budget ? { ...seed.budget } : {},
      diagnostics: [],
      recommendedAction: null,
      alternativeActions: [],
      estimatedWait: null,
      waitingFor: null,
      failureCategory: null,
    }
  }

  function createMessageState(runId) {
    return {
      runId: String(runId || 'run'),
      protocolVersion: PROTOCOL_VERSION,
      status: 'preparing',
      lastSeq: 0,
      terminalType: null,
      frozen: false,
      timeline: [],
      answer: { text: '', hash: '', committed: false },
      ui: [],
      activity: '正在准备上下文…',
      plan: null,
      groundingStatus: null,
      diagnostics: [],
      counters: { duplicate: 0, late: 0, gap: 0, subrunLate: 0 },
      runTree: createRunTree(runId),
      resumeAvailable: false,
    }
  }

  function pushDiagnostic(state, code, detail) {
    state.diagnostics.push({
      at: Date.now(),
      code,
      detail: detail || null,
    })
    if (state.diagnostics.length > MAX_DIAGNOSTICS) {
      state.diagnostics = state.diagnostics.slice(-MAX_DIAGNOSTICS)
    }
  }

  function upsertTimeline(state, item) {
    const id = String(item.id || item.toolCallId || item.subRunId || '')
    if (!id) return
    const index = state.timeline.findIndex(row => row.id === id)
    const next = {
      id,
      kind: item.kind === 'tool' ? 'tool' : item.kind === 'subrun' ? 'subrun' : 'stage',
      title: item.title || '',
      status: item.status || 'done',
      summary: item.summary || '',
      toolCallId: item.toolCallId || null,
      toolName: item.toolName || null,
      durationMs: item.durationMs,
      requiresApproval: Boolean(item.requiresApproval),
      draftId: item.draftId || null,
      draftStatus: item.draftStatus || null,
      evidenceStatus: item.evidenceStatus || null,
      artifactRefs: Array.isArray(item.artifactRefs) ? item.artifactRefs.slice(0, 8) : [],
      sources: Array.isArray(item.sources) ? item.sources.slice(0, 8) : [],
      subRunId: item.subRunId || null,
      expertId: item.expertId || null,
      builderId: item.builderId || null,
      timelineTitle: item.timelineTitle || null,
      delegation: Boolean(item.delegation),
      stopReason: item.stopReason || null,
      retriable: Boolean(item.retriable),
    }
    if (index >= 0) state.timeline[index] = { ...state.timeline[index], ...next }
    else state.timeline.push(next)
    if (state.timeline.length > MAX_TIMELINE) {
      state.timeline = state.timeline.slice(-MAX_TIMELINE)
    }
  }

  function traceFromPayload(payload = {}, kind = 'stage') {
    return {
      id: payload.id || payload.toolCallId || payload.subRunId || `stage_${Date.now()}`,
      kind,
      title: payload.title || '',
      status: payload.status || 'pending',
      summary: payload.summary || '',
      toolCallId: payload.toolCallId,
      toolName: payload.toolName,
      durationMs: payload.durationMs,
      requiresApproval: payload.requiresApproval,
      draftId: payload.draftId,
      draftStatus: payload.draftStatus,
      evidenceStatus: payload.evidenceStatus,
      artifactRefs: payload.artifactRefs,
      sources: payload.sources,
      subRunId: payload.subRunId,
      expertId: payload.expertId,
      builderId: payload.builderId,
      delegation: payload.delegation,
      stopReason: payload.stopReason,
      retriable: payload.retriable,
    }
  }

  function subRunTimelineTitle(node, status) {
    const expert = node.expertId ? String(node.expertId) : 'Expert'
    const builder = builderLabel(node.builderId)
    const base = `委派 · ${expert} · ${builder}`
    if (status === 'pending' || status === 'running') return `${base} · 进行中`
    if (status === 'waiting') return `${base} · 等待中`
    if (status === 'error' || status === 'failed') return `${base} · ${stopReasonLabel(node.stopReason, node.terminal)}`
    if (status === 'cancelled') return `${base} · 已取消`
    return `${base} · 已完成`
  }

  function ensureSubRunNode(state, subRunId, seed = {}) {
    if (!subRunId) return null
    if (!state.runTree) state.runTree = createRunTree(state.runId)
    if (!state.runTree.nodes[subRunId]) {
      state.runTree.nodes[subRunId] = createSubRunNode(subRunId, {
        parentRunId: seed.parentRunId || state.runId,
        ...seed,
      })
    }
    return state.runTree.nodes[subRunId]
  }

  function mergeUniqueById(list, item, idKey = 'id') {
    const id = String(item?.[idKey] || item?.draftId || item?.artifactId || item?.digest || '')
    if (!id) {
      list.push(item)
      return list
    }
    const idx = list.findIndex(row => String(row?.[idKey] || row?.draftId || row?.artifactId || row?.digest || '') === id)
    if (idx >= 0) list[idx] = { ...list[idx], ...item }
    else list.push(item)
    return list
  }

  function validateIncoming(state, event) {
    if (!event || typeof event !== 'object') {
      return { ok: false, code: 'invalid_event' }
    }
    if (event.version !== PROTOCOL_VERSION) {
      return { ok: false, code: 'unsupported_version', version: event.version }
    }
    if (String(event.runId || '') !== state.runId) {
      return { ok: false, code: 'run_mismatch' }
    }
    if (!Number.isInteger(event.seq) || event.seq < 1) {
      return { ok: false, code: 'invalid_seq' }
    }
    return { ok: true }
  }

  function validateSubRunSeq(node, payload = {}, type) {
    const subRunSeq = Number(payload.subRunSeq)
    if (!Number.isInteger(subRunSeq) || subRunSeq < 1) return { ok: true, advisory: true }
    if (subRunSeq <= node.lastSeq) {
      return {
        ok: false,
        code: subRunSeq === node.lastSeq ? 'duplicate_subrun_seq' : 'late_subrun_seq',
        subRunSeq,
        lastSeq: node.lastSeq,
      }
    }
    if (node.frozen && !SUBRUN_TERMINAL_TYPES.has(type)) {
      return { ok: false, code: 'subrun_frozen', subRunSeq, lastSeq: node.lastSeq }
    }
    return { ok: true, subRunSeq }
  }

  function applySubRunCollections(node, payload = {}) {
    const safe = redactSensitiveFields(payload)
    if (safe.kind === 'handoff' || safe.handoffType || safe.handoffContext) {
      mergeUniqueById(node.handoffs, {
        id: safe.messageId || safe.requirementId || `${safe.handoffType || 'handoff'}_${node.handoffs.length + 1}`,
        type: safe.handoffType || safe.kind || 'handoff',
        sourceExpertId: safe.sourceExpertId || safe.expertId,
        targetExpertId: safe.targetExpertId || safe.targetAgentPackageId,
        summary: safe.summary || '',
        requirementId: safe.requirementId || null,
      })
    }
    if (safe.kind === 'approval' || safe.requiresApproval || safe.draftId) {
      mergeUniqueById(node.approvals, {
        id: safe.draftId || safe.toolCallId || safe.messageId,
        draftId: safe.draftId || null,
        toolCallId: safe.toolCallId || null,
        approved: safe.approved,
        pending: safe.requiresApproval || safe.draftStatus === 'pending_review',
        risk: safe.risk || null,
        summary: safe.summary || '',
      }, 'draftId')
    }
    if (Array.isArray(safe.artifactRefs)) {
      for (const ref of safe.artifactRefs.slice(0, 8)) {
        const normalizedRef = typeof ref === 'string' ? { id: ref } : ref
        if (!normalizedRef?.id) continue
        mergeUniqueById(node.artifacts, {
          id: normalizedRef.id,
          kind: normalizedRef.kind || 'artifact',
          title: normalizedRef.title || normalizedRef.id,
          status: normalizedRef.status || null,
          inputPath: Boolean(normalizedRef.inputPath),
        })
      }
    }
    const evidenceItems = Array.isArray(safe.evidence)
      ? safe.evidence
      : (Array.isArray(safe.evidenceRefs) ? safe.evidenceRefs : [])
    if (evidenceItems.length) {
      for (const rawItem of evidenceItems.slice(0, 8)) {
        const item = typeof rawItem === 'string' ? { digest: rawItem } : rawItem
        mergeUniqueById(node.evidence, {
          digest: item.digest || item.id || item.refId,
          summary: item.summary || '',
          provenance: item.provenance || null,
        }, 'digest')
      }
    }
    if (safe.budget && typeof safe.budget === 'object') {
      node.budget = { ...node.budget, ...redactSensitiveFields(safe.budget) }
    }
    if (safe.recommendedAction) node.recommendedAction = String(safe.recommendedAction)
    if (Array.isArray(safe.alternativeActions)) {
      node.alternativeActions = safe.alternativeActions.map(item => String(item)).slice(0, 6)
    }
    if (safe.estimatedWait) node.estimatedWait = String(safe.estimatedWait)
    if (safe.waitingFor) node.waitingFor = String(safe.waitingFor)
    if (safe.failureCategory) node.failureCategory = String(safe.failureCategory)
    if (safe.security?.promptInjectionSuspected === true) {
      node.diagnostics = [...(node.diagnostics || []), {
        at: Date.now(),
        code: 'prompt_injection_suspected',
        detail: { trust: safe.security.trust || 'untrusted-child-output' },
      }].slice(-MAX_DIAGNOSTICS)
    }
  }

  function reduceSubRunEvent(state, event, payload, type) {
    const subRunId = String(payload.subRunId || '')
    if (!subRunId) {
      pushDiagnostic(state, 'subrun_missing_id', { type })
      return false
    }

    const node = ensureSubRunNode(state, subRunId, {
      parentRunId: payload.parentRunId || state.runId,
      expertId: payload.expertId,
      builderId: payload.builderId,
    })
    const seqCheck = validateSubRunSeq(node, payload, type)
    if (!seqCheck.ok) {
      if (seqCheck.code === 'duplicate_subrun_seq') state.counters.duplicate += 1
      else state.counters.subrunLate += 1
      pushDiagnostic(state, seqCheck.code, seqCheck)
      if (state.frozen && seqCheck.code !== 'duplicate_subrun_seq') {
        node.diagnostics = [...(node.diagnostics || []), { at: Date.now(), code: seqCheck.code, detail: seqCheck }]
      }
      return false
    }
    if (seqCheck.subRunSeq) node.lastSeq = seqCheck.subRunSeq

    const safePayload = redactSensitiveFields(payload)
    applySubRunCollections(node, safePayload)

    if (type === 'subrun.started') {
      node.status = 'running'
      node.expertId = safePayload.expertId || node.expertId
      node.builderId = safePayload.builderId || node.builderId
      node.phase = safePayload.phase || node.phase
      node.summary = safePayload.summary || node.summary
      upsertTimeline(state, {
        id: `subrun_${subRunId}`,
        kind: 'subrun',
        subRunId,
        expertId: node.expertId,
        builderId: node.builderId,
        status: 'pending',
        delegation: true,
        timelineTitle: subRunTimelineTitle(node, 'running'),
        summary: safePayload.summary || '',
      })
      state.activity = subRunTimelineTitle(node, 'running')
      return true
    }

    if (type === 'subrun.progress' || type === 'subrun.waiting') {
      if (safePayload.phase) {
        node.phase = safePayload.phase
        node.phases = [...(node.phases || []), {
          phase: safePayload.phase,
          durationMs: safePayload.durationMs,
          summary: safePayload.summary || '',
        }].slice(-MAX_SUBRUN_PHASES)
      }
      node.status = type === 'subrun.waiting' ? 'waiting' : 'running'
      if (safePayload.summary) node.summary = safePayload.summary
      if (type === 'subrun.waiting' && !node.recommendedAction) {
        node.recommendedAction = node.waitingFor === 'approval' ? 'review_draft' : 'provide_input'
      }
      upsertTimeline(state, {
        id: `subrun_${subRunId}`,
        kind: 'subrun',
        subRunId,
        expertId: node.expertId,
        builderId: node.builderId,
        status: node.status === 'waiting' ? 'pending' : 'pending',
        delegation: true,
        timelineTitle: subRunTimelineTitle(node, node.status),
        summary: node.summary,
        durationMs: safePayload.durationMs,
        stopReason: safePayload.waitingFor || null,
      })
      state.activity = subRunTimelineTitle(node, node.status)
      return true
    }

    if (SUBRUN_TERMINAL_TYPES.has(type)) {
      const terminal = normalizeSubRunTerminal(safePayload, type)
      node.terminal = terminal
      node.stopReason = safePayload.stopReason || safePayload.code || terminal
      node.retriable = Boolean(safePayload.retriable)
      node.status = terminal === 'completed' ? 'completed' : terminal
      node.frozen = true
      if (safePayload.summary) node.summary = safePayload.summary
      if (!node.recommendedAction) node.recommendedAction = terminal === 'cancelled' ? 'resume' : 'retry'
      const rowStatus = terminal === 'completed' ? 'done' : terminal === 'cancelled' ? 'cancelled' : 'error'
      upsertTimeline(state, {
        id: `subrun_${subRunId}`,
        kind: 'subrun',
        subRunId,
        expertId: node.expertId,
        builderId: node.builderId,
        status: rowStatus,
        delegation: true,
        timelineTitle: subRunTimelineTitle(node, rowStatus),
        summary: node.summary || stopReasonLabel(node.stopReason, terminal),
        stopReason: node.stopReason,
        retriable: node.retriable,
      })
      if (!state.frozen) {
        state.activity = subRunTimelineTitle(node, rowStatus)
      }
      return true
    }

    return false
  }

  function cascadeCancelSubRuns(state) {
    if (!state.runTree?.nodes) return
    for (const node of Object.values(state.runTree.nodes)) {
      if (!node || node.frozen) continue
      if (node.status === 'running' || node.status === 'waiting' || node.status === 'preparing') {
        node.status = 'cancelled'
        node.terminal = 'cancelled'
        node.stopReason = node.stopReason || 'cancelled'
        node.frozen = true
        upsertTimeline(state, {
          id: `subrun_${node.subRunId}`,
          kind: 'subrun',
          subRunId: node.subRunId,
          expertId: node.expertId,
          builderId: node.builderId,
          status: 'cancelled',
          delegation: true,
          timelineTitle: subRunTimelineTitle(node, 'cancelled'),
          summary: stopReasonLabel('cancelled'),
          stopReason: 'cancelled',
        })
      }
    }
  }

  function reduceMessageEvent(state, event) {
    const base = state || createMessageState(event?.runId || 'run')
    const type = String(event?.type || '')
    const isSubRun = SUBRUN_TYPES.has(type)

    if (base.frozen && !isSubRun) {
      pushDiagnostic(base, 'ignored_after_terminal', { type: event?.type, seq: event?.seq })
      return { state: base, changed: false, ignored: 'frozen' }
    }

    const valid = validateIncoming(base, event)
    if (!valid.ok) {
      pushDiagnostic(base, valid.code, valid)
      if (valid.code === 'unsupported_version') {
        base.status = 'failed'
        base.frozen = true
        base.activity = '输出协议不受支持'
        return { state: base, changed: true, ignored: valid.code }
      }
      return { state: base, changed: false, ignored: valid.code }
    }

    if (event.seq <= base.lastSeq) {
      if (event.seq === base.lastSeq) base.counters.duplicate += 1
      else base.counters.late += 1
      pushDiagnostic(base, event.seq === base.lastSeq ? 'duplicate_seq' : 'late_seq', { seq: event.seq, lastSeq: base.lastSeq })
      return { state: base, changed: false, ignored: 'seq' }
    }

    if (event.seq > base.lastSeq + 1) {
      base.counters.gap += 1
      pushDiagnostic(base, 'seq_gap', { seq: event.seq, lastSeq: base.lastSeq })
    }

    const next = {
      ...base,
      timeline: base.timeline.map(item => ({ ...item })),
      answer: { ...base.answer },
      ui: cloneUi(base.ui),
      diagnostics: [...base.diagnostics],
      counters: { ...base.counters },
      runTree: {
        rootRunId: base.runTree?.rootRunId || base.runId,
        nodes: Object.fromEntries(
          Object.entries(base.runTree?.nodes || {}).map(([id, node]) => [id, {
            ...node,
            handoffs: [...(node.handoffs || [])],
            approvals: [...(node.approvals || [])],
            artifacts: [...(node.artifacts || [])],
            evidence: [...(node.evidence || [])],
            phases: [...(node.phases || [])],
            budget: { ...(node.budget || {}) },
            diagnostics: [...(node.diagnostics || [])],
          }]),
        ),
      },
    }
    next.lastSeq = event.seq
    if (next.status === 'preparing') next.status = 'running'

    const payload = redactSensitiveFields(event.payload || {})

    if (isSubRun) {
      const changed = reduceSubRunEvent(next, event, payload, type)
      return { state: next, changed, eventType: type, subRun: true }
    }

    if (type === 'stage' || type === 'grounding-status' || type === 'plan.updated') {
      if (type === 'plan.updated' && payload.plan) {
        next.plan = {
          version: payload.plan.version,
          updatedAt: payload.plan.updatedAt,
          remaining: payload.plan.remaining,
          items: Array.isArray(payload.plan.items) ? payload.plan.items.slice(0, 12) : [],
        }
        next.activity = '正在按计划执行…'
      } else if (type === 'grounding-status') {
        next.groundingStatus = {
          status: payload.status || 'pending',
          claims: Array.isArray(payload.claims) ? payload.claims : [],
          sources: Array.isArray(payload.sources) ? payload.sources : [],
          violations: Array.isArray(payload.violations) ? payload.violations : [],
        }
        if (payload.status === 'blocked') next.activity = '输出已阻断：证据不足'
        else if (payload.status === 'verified') next.activity = '输出已验证'
      } else {
        next.activity = payload.title || payload.summary || '正在处理…'
        upsertTimeline(next, traceFromPayload(payload, payload.kind === 'tool' ? 'tool' : 'stage'))
      }
    } else if (type === 'tool.started' || type === 'tool.completed' || type === 'tool.failed') {
      const pending = type === 'tool.started'
      const failed = type === 'tool.failed'
      const draftPending = payload.requiresApproval && payload.draftStatus === 'pending_review'
      upsertTimeline(next, traceFromPayload({
        ...payload,
        id: payload.id || payload.toolCallId,
        kind: 'tool',
        status: pending ? 'pending' : failed ? 'error' : 'done',
        summary: draftPending ? (payload.summary || '等待批准') : payload.summary,
      }, 'tool'))
      if (pending) next.activity = payload.title || payload.toolName || '正在处理相关操作'
    } else if (type === 'answer.committed') {
      if (!next.answer.committed) {
        next.answer.text = String(payload.text || '')
        next.answer.hash = String(payload.hash || '')
        next.answer.committed = true
        next.activity = next.activity || '回答已就绪'
      }
    } else if (type === 'choice.ready') {
      next.ui = cloneUi(payload.ui)
      if (payload.subRunId) {
        const node = ensureSubRunNode(next, String(payload.subRunId), {
          parentRunId: payload.parentRunId || next.runId,
          expertId: payload.expertId,
          builderId: payload.builderId,
        })
        applySubRunCollections(node, { ...payload, kind: payload.kind || 'approval' })
      }
    } else if (TERMINAL_TYPES.has(type)) {
      next.terminalType = type
      next.frozen = true
      if (type === 'run.completed') next.status = 'completed'
      else if (type === 'run.cancelled') {
        next.status = 'cancelled'
        next.activity = payload.summary || '已停止生成'
        if (!next.answer.committed && !next.answer.text) {
          next.answer.text = payload.summary || '已停止生成'
        }
        cascadeCancelSubRuns(next)
      } else {
        next.status = 'failed'
        next.activity = payload.summary || payload.message || '生成失败'
      }
      for (const item of next.timeline) {
        if (item.status === 'pending' && !item.requiresApproval && item.kind !== 'subrun') {
          item.status = type === 'run.failed' ? 'error' : 'done'
        }
      }
    } else {
      pushDiagnostic(next, 'unknown_type', { type })
    }

    return { state: next, changed: true, eventType: type }
  }

  function applyStateToMessage(message, state) {
    if (!message || !state) return message
    message.messageState = state
    message.protocolVersion = state.protocolVersion
    message.activity = state.activity
    message.trace = state.timeline.map(item => ({ ...item }))
    message.runTree = state.runTree
      ? {
        rootRunId: state.runTree.rootRunId,
        nodes: Object.fromEntries(
          Object.entries(state.runTree.nodes || {}).map(([id, node]) => [id, { ...node }]),
        ),
      }
      : null
    message.resumeAvailable = Boolean(state.resumeAvailable)
    if (state.plan) message.plan = { ...state.plan, items: [...(state.plan.items || [])] }
    if (state.groundingStatus) message.groundingStatus = { ...state.groundingStatus }
    if (state.answer.committed) {
      message.text = state.answer.text
      message.answerHash = state.answer.hash
      message.v2AnswerCommitted = true
    }
    if (state.ui.length) message.ui = cloneUi(state.ui)
    if (state.frozen) {
      message.streaming = false
      message.terminalStatus = state.status
      if (state.status === 'failed' && !state.answer.committed) {
        message.text = message.text || state.activity || '生成失败'
      }
    }
    return message
  }

  function mergeRunTreeSnapshot(state, snapshot = {}) {
    if (!state || !snapshot || typeof snapshot !== 'object') return state
    if (!state.runTree) state.runTree = createRunTree(state.runId)
    const nodes = snapshot.nodes || snapshot.children || {}
    for (const [subRunId, node] of Object.entries(nodes)) {
      if (String(subRunId) === String(snapshot.rootRunId || state.runId)) continue
      const existing = ensureSubRunNode(state, subRunId, node || {})
      Object.assign(existing, {
        ...redactSensitiveFields(node || {}),
        subRunId,
        handoffs: Array.isArray(node?.handoffs) ? node.handoffs.map(item => ({ ...item })) : existing.handoffs,
        approvals: Array.isArray(node?.approvals) ? node.approvals.map(item => ({ ...item })) : existing.approvals,
        artifacts: Array.isArray(node?.artifacts) ? node.artifacts.map(item => ({ ...item })) : existing.artifacts,
        evidence: Array.isArray(node?.evidence) ? node.evidence.map(item => ({ ...item })) : existing.evidence,
      })
      const rowStatus = existing.terminal === 'completed'
        ? 'done'
        : existing.terminal === 'cancelled'
          ? 'cancelled'
          : existing.status === 'failed' || existing.terminal === 'failed'
            ? 'error'
            : existing.status === 'waiting' || existing.status === 'running'
              ? 'pending'
              : 'done'
      upsertTimeline(state, {
        id: `subrun_${subRunId}`,
        kind: 'subrun',
        subRunId,
        expertId: existing.expertId,
        builderId: existing.builderId,
        status: rowStatus,
        delegation: true,
        timelineTitle: subRunTimelineTitle(existing, rowStatus),
        summary: existing.summary || stopReasonLabel(existing.stopReason, existing.terminal),
        stopReason: existing.stopReason,
        retriable: existing.retriable,
      })
    }
    if (snapshot.resumeAvailable) state.resumeAvailable = true
    return state
  }

  return {
    PROTOCOL_VERSION,
    SUBRUN_TYPES,
    SUBRUN_TERMINAL_TYPES,
    createMessageState,
    createSubRunNode,
    createRunTree,
    reduceMessageEvent,
    applyStateToMessage,
    mergeRunTreeSnapshot,
    redactSensitiveFields,
    stopReasonLabel,
    builderLabel,
    subRunTimelineTitle,
  }
})
