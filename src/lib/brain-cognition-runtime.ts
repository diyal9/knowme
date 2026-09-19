'use strict'

const brainCognition = require('./brain-cognition')

function createCognitionRuntime({ store, productMemory, propose }) {
  function syncMemoryProposals(userData, ctx = {}) {
    const memoryDir = ctx.memoryDir
    if (!memoryDir || typeof productMemory.getVisiblePatterns !== 'function') return { ok: true, created: [], updated: [] }
    let patterns = []
    try { patterns = productMemory.getVisiblePatterns(memoryDir) || [] } catch { return { ok: true, created: [], updated: [] } }
    const proposals = store.readCollection(userData, 'proposals')
    const created = []
    const updated = []
    const now = Date.now()
    for (const pattern of patterns) {
      const id = `memory-pattern:${pattern.id}`
      const existing = proposals.find(item => item.id === id)
      if (pattern.prompt_state === 'dismissed' || pattern.prompt_state === 'accepted') {
        if (existing?.status === 'pending' || existing?.status === 'snoozed') {
          updated.push(store.upsertProposal(userData, {
            ...existing,
            status: pattern.prompt_state === 'accepted' ? 'confirmed' : 'rejected',
            updatedAt: new Date().toISOString(),
          }))
        }
        continue
      }
      const ready = typeof productMemory.isPatternReviewReady === 'function'
        ? productMemory.isPatternReviewReady(pattern)
        : Number(pattern.count || 0) >= Number(productMemory.PROMPT_THRESHOLD || 3)
      if (!ready || pattern.prompt_state !== 'pending') continue
      if (existing?.status === 'rejected' || existing?.status === 'confirmed') continue
      if (existing?.status === 'snoozed' && existing.snoozedUntil && Date.parse(existing.snoozedUntil) > now) continue
      const proposal = brainCognition.buildProposal(store, {
        kind: brainCognition.isCollaborationPreference(pattern.summary) ? 'behavior' : 'preference',
        text: pattern.summary,
        memoryPatternId: pattern.id,
        proposalId: id,
        observationCount: pattern.count,
        createdAt: pattern.first_seen,
      }, {
        documentRef: `memory-pattern:${pattern.id}`,
        title: '近期协作中的重复观察',
        capturedAt: pattern.last_seen,
      })
      if (proposal._evidence) store.upsertEvidence(userData, proposal._evidence)
      if (existing) {
        store.upsertProposal(userData, { ...proposal, status: 'pending', createdAt: existing.createdAt })
        updated.push(proposal)
      } else {
        store.upsertProposal(userData, proposal)
        created.push(proposal)
      }
    }
    return { ok: true, created, updated }
  }

  function observeConversation(userData, input = {}, ctx = {}) {
    const text = String(input.text || input.prompt || '').trim()
    if (!text) return { ok: true, skipped: true, reason: 'empty', proposals: [] }
    if (input.ephemeral === true || brainCognition.isEphemeral(text)) return { ok: true, skipped: true, reason: 'ephemeral', proposals: [] }
    if (input.allowLearning === false || input.allowPromotionProposal === false) return { ok: true, skipped: true, reason: 'learning-disabled', proposals: [] }
    if (input.agentId && input.agentId !== 'personal' && input.allowPromotionProposal !== true) return { ok: true, skipped: true, reason: 'agent-policy', proposals: [] }
    if (brainCognition.isSensitive(text)) return { ok: true, skipped: true, reason: 'sensitive', proposals: [] }
    if (ctx.memoryDir && typeof productMemory.loadConfig === 'function') {
      try {
        if (productMemory.loadConfig(ctx.memoryDir).learningEnabled === false) return { ok: true, skipped: true, reason: 'learning-disabled', proposals: [] }
      } catch { /* default to the explicit request path */ }
    }

    const created = []
    const duplicate = []
    const timestamp = input.capturedAt || new Date().toISOString()
    for (const candidate of brainCognition.extractCandidates(text)) {
      const proposal = brainCognition.buildProposal(store, candidate, {
        sessionId: input.sessionId,
        runId: input.runId,
        taskId: input.taskId,
        projectId: input.projectId,
        documentRef: input.documentRef,
        title: input.sourceLabel,
        capturedAt: timestamp,
      })
      const result = propose(userData, proposal)
      if (result.suppressed || result.duplicate) duplicate.push(result.proposal)
      else {
        if (proposal._evidence) store.upsertEvidence(userData, proposal._evidence)
        created.push(result.proposal)
      }
    }

    let weakCaptured = 0
    if (ctx.memoryDir && typeof productMemory.capture === 'function') {
      for (const signal of brainCognition.extractWeakPreferenceSignals(text)) {
        const record = productMemory.capture(ctx.memoryDir, {
          kind: 'preference',
          summary: signal.text,
          meta: { source: 'brain-conversation', category: signal.category },
        })
        if (!record?.skipped) weakCaptured += 1
      }
      syncMemoryProposals(userData, ctx)
    }
    return { ok: true, proposals: created, duplicates: duplicate, weakCaptured }
  }

  return Object.freeze({ syncMemoryProposals, observeConversation })
}

module.exports = { createCognitionRuntime }
