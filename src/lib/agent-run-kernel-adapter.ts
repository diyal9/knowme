'use strict'

/**
 * 生产环境 RunPorts adapter — 将 main.js 已准备好的上下文/state 绑定到 AgentRunExecutor。
 */

const llmRuntime = require('./llm-runtime')
const llmUsage = require('./llm-usage')
const agentRun = require('./agent-run')
const agentSessions = require('./agent-sessions')
const groundingRuntime = require('./agent-grounding-runtime')
const { providedMaterialsFromInput } = require('./provided-materials')
const { buildMediaObservation } = require('./agent-media-resources')
const { resolveProfile } = require('./llm-model-catalog')
const { upsertConversationMessage, withConversationIdentity } = require('./agent-conversation-log')
const { bindRunRuntimeContext, unbindRunRuntimeContext } = require('./tool-contract-registry')
const logger = require('./logger')

const DEFAULT_CANCEL_BUDGET_MS = 3000

/**
 * @param {object} state — main.js 在 CONTEXT 阶段完成后传入的运行时状态
 */
function buildProductionRunPorts(state) {
  const {
    settings,
    signal,
    url,
    routedModel,
    policy,
    promptCachePolicy,
    tokenCalKey,
    toolSurface,
    toolExecutor,
    tier,
    apiMessages: initialMessages,
    session: initialSession,
    requestAgentCompletion,
    onStreamChunk,
    runStartedAt,
    effectivePersonalization,
    ctxBundle = {},
    loadAgentSessions,
    saveAgentSessions,
    saveAgentSessionsAsync,
    productMemoryCapture,
    memoryDir,
    normalizeAssistantOutput,
    postProcessHooks,
    runId,
    parentRunId,
    subRunId,
    wallTimeoutMs,
    budget,
    orchestration,
    persistRunCheckpoint,
    cancelProcessesForRun,
    governancePolicy,
    recordReceipt,
  } = state

  let session = initialSession
  const providedMaterials = providedMaterialsFromInput({
    taskRef: state.taskRef, workbenchTaskId: state.workbenchTaskId,
    providedMaterials: ctxBundle.providedMaterials,
  }, runId)
  let apiMessages = initialMessages
  let referenceState = groundingRuntime.deserializeReferenceState(session?.referenceState || {})
  let evidenceLedger = groundingRuntime.createEvidenceLedger({ runId: runId || state.runId || 'run' })
  let toolLedger = groundingRuntime.createToolLedger()
  const startedAt = runStartedAt || Date.now()
  const effectiveWallTimeoutMs = Number.isFinite(Number(wallTimeoutMs))
    ? Number(wallTimeoutMs)
    : (Number.isFinite(Number(budget?.maxWallMs)) ? Number(budget.maxWallMs) : null)

  const remainingMs = () => {
    if (!Number.isFinite(effectiveWallTimeoutMs)) return null
    return Math.max(0, effectiveWallTimeoutMs - (Date.now() - startedAt))
  }

  const mergeWithLatestSession = (incomingSession, options = {}) => {
    const latestSessions = loadAgentSessions()
    const latest = latestSessions.find(item => item.id === incomingSession.id)
    const replaceKnownMessageIds = options.replaceKnownMessageIds instanceof Set
      ? options.replaceKnownMessageIds
      : null
    // Both sides here are trusted persisted/runtime records, not a renderer
    // recovery snapshot. The latter intentionally drops tools and structured
    // metadata and must not be used to save an execution transcript.
    const canonical = replaceKnownMessageIds ? incomingSession.messages : latest?.messages || []
    const additions = replaceKnownMessageIds
      ? (latest?.messages || []).filter(item => !replaceKnownMessageIds.has(String(item?.id || '')))
      : incomingSession.messages
    let mergedMessages = (canonical || []).map((item, index) => withConversationIdentity(item, { sessionId: incomingSession.id, index })).filter(Boolean)
    for (const [index, item] of (additions || []).entries()) {
      const message = withConversationIdentity(item, { sessionId: incomingSession.id, index })
      if (!message) continue
      const exists = mergedMessages.some(existing => existing.id === message.id)
      if (!exists || (!replaceKnownMessageIds && message.runId === runId)) {
        mergedMessages = upsertConversationMessage(mergedMessages, message)
      }
    }
    const merged = latest
      ? {
          ...latest,
          ...incomingSession,
          messages: mergedMessages,
        }
      : incomingSession
    return { latestSessions, merged }
  }

  const saveMergedSession = async (incomingSession, options = {}) => {
    const saveStartedAt = Date.now()
    const { latestSessions, merged } = mergeWithLatestSession(incomingSession, options)
    const next = latestSessions.some(item => item.id === merged.id)
      ? latestSessions.map(item => item.id === merged.id ? merged : item)
      : [...latestSessions, merged]
    if (typeof saveAgentSessionsAsync === 'function') {
      await saveAgentSessionsAsync(next)
    } else {
      saveAgentSessions(next)
    }
    const saveDurationMs = Date.now() - saveStartedAt
    if (saveDurationMs >= 250) {
      try {
        logger.warn('system', 'session-save-slow', '会话检查点保存耗时过长', {
          durationMs: saveDurationMs,
          sessionCount: next.length,
          messageCount: Array.isArray(merged.messages) ? merged.messages.length : 0,
        })
      } catch { /* diagnostics must never affect generation */ }
    }
    return merged
  }

  const runtimeRef = {
    signal,
    getRemainingTimeoutMs: remainingMs,
    recordReceipt,
    parentRunId: parentRunId || null,
    subRunId: subRunId || null,
    governancePolicy: governancePolicy || null,
  }
  if (runId) bindRunRuntimeContext(runId, runtimeRef)

  const persistLedgersCheckpoint = async (payload = {}) => {
    const checkpointPayload = {
      runId: runId || state.runId || '',
      parentRunId: parentRunId || null,
      subRunId: subRunId || null,
      sessionId: session?.id || null,
      referenceState: groundingRuntime.serializeReferenceState(referenceState),
      evidenceLedger,
      toolLedger,
      runtime: {
        runStartedAt: startedAt,
        remainingMs: remainingMs(),
        wallTimeoutMs: effectiveWallTimeoutMs,
        budget: budget || session?.run?.budget || null,
        phase: payload.phase || null,
        updatedAt: new Date().toISOString(),
      },
      ...payload,
    }
    const hook = persistRunCheckpoint || state.checkpoint?.persist
    if (typeof hook === 'function') {
      await hook(checkpointPayload)
    }
    return checkpointPayload
  }

  const orchestrationPort = orchestration && typeof orchestration === 'object'
    ? {
      ...orchestration,
      cancelCascade: async (reason = 'cancelled') => {
        const started = Date.now()
        let cancelledCount = 0
        if (typeof orchestration.cancelAllSubRuns === 'function') {
          const result = orchestration.cancelAllSubRuns({
            reason,
            cancelSubRun: orchestration.cancelSubRun,
          })
          cancelledCount = Array.isArray(result?.cancelled) ? result.cancelled.length : 0
        } else if (typeof orchestration.cancelAllChildren === 'function' && runId) {
          await orchestration.cancelAllChildren(runId, reason)
          cancelledCount = 1
        } else if (process.env.KNOWME_ALLOW_ACTIVE_SUBRUNS === '1' && typeof orchestration.cancelSubRun === 'function') {
          for (const sub of orchestration.activeSubRuns || []) {
            orchestration.cancelSubRun(sub?.id || sub)
            cancelledCount += 1
          }
        }
        if (typeof cancelProcessesForRun === 'function' && runId) {
          cancelProcessesForRun(runId)
        } else if (typeof orchestration.cancelProcessesForRun === 'function' && runId) {
          orchestration.cancelProcessesForRun(runId)
        }
        return {
          cancelledCount,
          withinBudgetMs: (Date.now() - started) <= DEFAULT_CANCEL_BUDGET_MS,
          budgetMs: DEFAULT_CANCEL_BUDGET_MS,
        }
      },
    }
    : null

  return {
    signal,
    clock: { now: () => Date.now() },
    settings: {
      load: () => settings,
    },
    context: {
      build: async (input = {}) => ({
        tier,
        messages: apiMessages,
        session,
        toolsEnabled: state.toolsEnabled,
        policy,
        tokenCalKey,
        promptCachePolicy,
        effectivePersonalization,
        contextInfo: ctxBundle.contextInfo,
        taskFrame: ctxBundle.taskFrame || null,
        providedMaterials: providedMaterialsFromInput({ ...input, providedMaterials }, runId),
        alreadyPrepared: true,
      }),
    },
    llm: {
      complete: async ({ messages, tools, toolsEnabled, forceToolCall, forceToolName, policy: reqPolicy, round, onSnapshot, finalize }) => {
        const msgs = messages || apiMessages
        // The executor owns each request's allowance (including length repair).
        // Preserve legacy defaults only when no per-request allowance exists;
        // neither a finalizer nor a request policy may widen the model cap.
        const outputTokens = reqPolicy?.outputTokens || (finalize ? 2400 : policy.outputTokens)
        const maxOutput = Math.min(reqPolicy?.maxOutput || Infinity, policy.maxOutput || Infinity)
        const body = {
          model: routedModel.model || 'gpt-4o-mini',
          messages: msgs,
          [reqPolicy?.parameter || policy.parameter]: Math.min(outputTokens, maxOutput),
          temperature: reqPolicy?.temperature || policy.temperature,
          stream: true,
          ...(toolsEnabled && tools?.length ? {
            tools,
            tool_choice: forceToolCall
              ? (forceToolName
                  ? { type: 'function', function: { name: forceToolName } }
                  : 'required')
              : 'auto',
          } : {}),
        }
        const wrappedSnapshot = (snapshot) => {
          onSnapshot?.(snapshot)
        }
        const completion = await requestAgentCompletion({
          url,
          settings,
          body,
          onSnapshot: wrappedSnapshot,
          signal,
        })
        if (completion.error && toolsEnabled && !finalize && [400, 404, 422].includes(completion.status)) {
          return { ...completion, status: completion.status }
        }
        return completion
      },
    },
    tools: {
      surface: toolSurface,
      execute: async (toolCall = {}) => {
        const remaining = remainingMs()
        const execArgs = {
          name: toolCall.name,
          arguments: toolCall.arguments,
          id: toolCall.id,
          signal: toolCall.signal || signal,
          timeoutMs: toolCall.timeoutMs,
          remainingTimeoutMs: remaining,
        }
        if (toolExecutor?.executeToolCall) {
          return toolExecutor.executeToolCall(execArgs)
        }
        return toolExecutor({
          ...toolCall,
          signal: execArgs.signal,
          timeoutMs: execArgs.timeoutMs,
          remainingTimeoutMs: remaining,
        })
      },
    },
    media: {
      observeArtifacts: artifacts => buildMediaObservation(artifacts, {
        supportsVision: resolveProfile({ ...settings, model: routedModel?.model || settings?.model }).supportsVision,
      }),
    },
    orchestration: orchestrationPort || undefined,
    runtime: {
      runId: runId || state.runId || '',
      parentRunId: parentRunId || null,
      subRunId: subRunId || null,
      runStartedAt: startedAt,
      wallTimeoutMs: effectiveWallTimeoutMs,
      remainingMs,
      budget: budget || session?.run?.budget || null,
      governancePolicy: governancePolicy || null,
    },
    checkpoint: {
      persist: persistLedgersCheckpoint,
    },
    session: {
      get: () => session,
      set: (next) => { session = next },
      checkpoint: async ({ emit: emitFn, session: incomingSession, ...rest } = {}) => {
        if (incomingSession) session = incomingSession
        try {
          await persistLedgersCheckpoint({ phase: 'session', emit: emitFn, ...rest })
          session = await saveMergedSession(session)
          const plan = session?.run?.plan
          if (plan?.items?.length) {
            emitFn?.({
              type: 'plan.updated',
              plan: {
                version: plan.version,
                updatedAt: plan.updatedAt,
                items: plan.items,
                remaining: agentRun.countPlanRemaining(plan),
              },
            })
          }
        } catch { /* ignore */ }
      },
      persist: async ({
        session: incomingSession,
        fullText,
        trace,
        toolMessages,
        metrics,
        emit: emitFn,
        answerHash,
        protocolVersion,
        ui,
      }) => {
        session = incomingSession || session
        if (state.writingArtifactHook && fullText) {
          session = state.writingArtifactHook(session, fullText) || session
        }
        session.updatedAt = new Date().toISOString()
        session = mergeWithLatestSession(session).merged
        const preCompactMessageIds = new Set(
          (session.messages || []).map(item => String(item?.id || '')).filter(Boolean),
        )
        const compacted = agentSessions.compactSession(session).session
        session = await saveMergedSession(compacted, { replaceKnownMessageIds: preCompactMessageIds })
        try {
          await persistLedgersCheckpoint({ phase: 'persist', metrics, answerHash, protocolVersion })
          const plan = compacted?.run?.plan
          if (plan?.items?.length) {
            emitFn({
              type: 'plan.updated',
              plan: {
                version: plan.version,
                updatedAt: plan.updatedAt,
                items: plan.items,
                remaining: agentRun.countPlanRemaining(plan),
              },
            })
          }
        } catch { /* ignore */ }
        if (productMemoryCapture && memoryDir) {
          productMemoryCapture(memoryDir, {
            kind: 'telemetry',
            summary: '完成一次 AI 对话',
            meta: {
              action: 'ai-generate',
              toolCalls: metrics.toolCalls,
              answerHash: answerHash || null,
              protocolVersion: protocolVersion || null,
              uiCount: Array.isArray(ui) ? ui.length : 0,
            },
          })
        }
        const estimatedContextTokens = llmUsage.applyCalibration(
          llmRuntime.estimateTokens(JSON.stringify(apiMessages)),
          tokenCalKey,
        )
        metrics.usage = llmUsage.reconcileUsage(
          estimatedContextTokens,
          metrics.usage?.source === 'provider' ? metrics.usage : null,
        )
        metrics.contextTokens = metrics.usage.source === 'provider'
          ? metrics.usage.promptTokens
          : estimatedContextTokens
        metrics.totalMs = Date.now() - startedAt
        if (state.persistTokenCalibration) state.persistTokenCalibration(metrics, tokenCalKey)
        if (runId) unbindRunRuntimeContext(runId)
      },
    },
    hooks: {
      postProcess: postProcessHooks,
    },
    grounding: {
      getReferenceState: () => referenceState,
      setReferenceState: (next) => {
        referenceState = groundingRuntime.deserializeReferenceState(next)
        session.referenceState = groundingRuntime.serializeReferenceState(referenceState)
      },
      getEvidenceLedger: () => evidenceLedger,
      getToolLedger: () => toolLedger,
      setLedgers: ({ evidenceLedger: el, toolLedger: tl }) => {
        if (el) evidenceLedger = groundingRuntime.createEvidenceLedger(el)
        if (tl) toolLedger = groundingRuntime.createToolLedger(tl)
      },
    },
    _state: { get session() { return session }, setApiMessages: (m) => { apiMessages = m } },
  }
}

module.exports = {
  buildProductionRunPorts,
}
