'use strict'

/**
 * 生产环境 RunPorts adapter — 将 main.js 已准备好的上下文/state 绑定到 AgentRunExecutor。
 */

const llmRuntime = require('./llm-runtime')
const llmUsage = require('./llm-usage')
const agentRun = require('./agent-run')
const agentSessions = require('./agent-sessions')
const groundingRuntime = require('./agent-grounding-runtime')
const { bindRunRuntimeContext, unbindRunRuntimeContext } = require('./tool-contract-registry')

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
        } else if (typeof orchestration.cancelSubRun === 'function') {
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
      build: async () => ({
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
        alreadyPrepared: true,
      }),
    },
    llm: {
      complete: async ({ messages, tools, toolsEnabled, policy: reqPolicy, round, onSnapshot, finalize }) => {
        const msgs = messages || apiMessages
        const body = {
          model: routedModel.model || 'gpt-4o-mini',
          messages: msgs,
          [reqPolicy?.parameter || policy.parameter]: finalize
            ? Math.min(reqPolicy?.maxOutput || policy.maxOutput, 2400)
            : reqPolicy?.outputTokens || policy.outputTokens,
          temperature: reqPolicy?.temperature || policy.temperature,
          stream: true,
          ...(toolsEnabled && tools?.length ? { tools, tool_choice: 'auto' } : {}),
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
          saveAgentSessions(loadAgentSessions().map(item => item.id === session.id ? session : item))
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
        const compacted = agentSessions.compactSession(session).session
        saveAgentSessions(loadAgentSessions().map(item => item.id === session.id ? compacted : item))
        session = compacted
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
