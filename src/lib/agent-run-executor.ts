'use strict'

/**
 * Agent Run 执行器入口：编排 PREPARE/CONTEXT、MODEL↔TOOL、GROUND/PERSIST 三阶段。
 * 阶段实现位于 ./agent-run-executor/ 子模块；本文件仅保留 run 编排与对外导出。
 * 输出规范化（fullText = normalizeAssistantOutput(fullText)）在 phases-ground-persist.ts。
 */

const { RunPhase, validateRunPorts } = require('./agent-run-ports')
const { VERSION: OUTPUT_PROTOCOL_VERSION, EventType, TERMINAL_TYPES, createRunEmitter, mapLegacyType, mapLegacyPayload } = require('./agent-output-protocol')
const {
  createAssembler,
  ingestSnapshot,
  clearRoundDraft,
  canonicalize,
} = require('./agent-output-assembler')
const {
  sanitizeDiagnosticEntry,
  sanitizeOutputDiagnostics,
  buildCommitMetrics,
} = require('./agent-output-metrics')
const logger = require('./logger')
const { buildResult } = require('./agent-run-executor/result')
const { buildMissingResourceHint } = require('./agent-run-executor/hints')
const { runPrepareContext } = require('./agent-run-executor/phases-prepare-context')
const { runModelToolLoop } = require('./agent-run-executor/phases-model-tool')
const { runGroundAndPersist } = require('./agent-run-executor/phases-ground-persist')

/**
 * @param {object} input — ai-generate payload
 * @param {import('./agent-run-ports')} ports
 * @param {(event: object) => void} emit
 */
async function run(input, ports, emit) {
  validateRunPorts(ports)
  const signal = ports.signal || { aborted: false }
  const runStartedAt = ports.clock?.now?.() || Date.now()
  const runId = String(input.runId || `run_${runStartedAt}`)
  const outputEmitter = createRunEmitter(runId, { round: 0, phase: RunPhase.PREPARE })
  const assembler = createAssembler()
  let answerCommitted = false
  const runPhases = []
  const metrics = {
    rounds: 0,
    toolCalls: 0,
    firstTokenMs: null,
    bufferedDraftsDiscarded: 0,
    answerCommitMs: null,
    bufferMs: null,
    outputDiagnostics: [],
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, source: 'estimate' },
  }
  const markFirstToken = () => {
    if (metrics.firstTokenMs != null) return
    metrics.firstTokenMs = (ports.clock?.now?.() || Date.now()) - runStartedAt
    try {
      logger.info('llm', 'first-token', `firstTokenMs=${metrics.firstTokenMs}`, {
        runId,
        firstTokenMs: metrics.firstTokenMs,
      })
    } catch { /* 排查日志不得打断生成 */ }
  }
  const trace = []
  let artifactRefs = []
  let currentPhase = RunPhase.PREPARE
  let terminal = RunPhase.DONE
  let planEval = null
  let errorInfo = null
  let canonicalMeta = null
  let modelRound = 0
  let fullText = ''
  let lastModelText = ''
  let streamed = false
  let cancelCascadeStarted = false

  const enterPhase = (phase) => {
    currentPhase = phase
    if (!runPhases.includes(phase)) runPhases.push(phase)
  }

  const upsertTrace = (event) => {
    const index = trace.findIndex(item => item.id === event.id)
    const next = {
      id: event.id,
      kind: event.kind === 'tool' ? 'tool' : 'stage',
      title: event.title,
      status: event.status || 'done',
      summary: event.summary || '',
      toolCallId: event.toolCallId,
      toolName: event.toolName,
      durationMs: event.durationMs,
    }
    if (index >= 0) trace[index] = { ...trace[index], ...next }
    else trace.push(next)
  }

  const emitTerminal = (type, payload, phase) => {
    outputEmitter.emit(type, payload, { phase, round: modelRound }, emit)
  }

  const pushOutputDiagnostic = (entry) => {
    metrics.outputDiagnostics.push(sanitizeDiagnosticEntry({
      runId,
      round: modelRound,
      phase: currentPhase,
      ...entry,
    }))
    if (metrics.outputDiagnostics.length > 24) {
      metrics.outputDiagnostics = metrics.outputDiagnostics.slice(-24)
    }
  }

  const discardRoundDraft = (reason) => {
    const draft = String(assembler.roundDraft || '')
    if (!draft.trim()) {
      clearRoundDraft(assembler)
      return
    }
    metrics.bufferedDraftsDiscarded += 1
    pushOutputDiagnostic({
      code: 'buffered_draft_discarded',
      reason: String(reason || 'tool_round').slice(0, 40),
      length: draft.length,
      count: 1,
    })
    clearRoundDraft(assembler)
  }

  const emitV2 = (legacyEvent) => {
    const mappedType = mapLegacyType(legacyEvent)
    if (!mappedType) return null
    if (TERMINAL_TYPES.has(mappedType) && outputEmitter.terminalEmitted) return null
    return outputEmitter.emit(
      mappedType,
      mapLegacyPayload(legacyEvent, mappedType),
      { phase: legacyEvent.runPhase || currentPhase, round: modelRound },
      emit,
    )
  }

  ports.orchestration?.bindOutputEmitter?.((type, payload = {}, meta = {}) => (
    outputEmitter.emit(
      type,
      payload,
      { phase: meta.phase || RunPhase.ORCHESTRATE, round: meta.round ?? modelRound },
      emit,
    )
  ))

  const stage = (id, title, status = 'pending', extra = {}) => {
    const event = {
      id,
      type: extra.fallback ? 'fallback' : 'stage',
      kind: 'stage',
      title,
      status,
      runPhase: currentPhase,
      ...extra,
    }
    upsertTrace(event)
    emitV2(event)
  }

  const commitCanonicalAnswer = (text) => {
    if (answerCommitted) return canonicalMeta
    canonicalMeta = canonicalize(text, assembler)
    fullText = canonicalMeta.text
    const commitAt = ports.clock?.now?.() || Date.now()
    const commitMetrics = buildCommitMetrics({
      runStartedAt,
      commitAt,
      firstTokenMs: metrics.firstTokenMs,
      assemblerDiagnostics: canonicalMeta.diagnostics,
    })
    metrics.answerCommitMs = commitMetrics.answerCommitMs
    metrics.bufferMs = commitMetrics.bufferMs
    metrics.outputDiagnostics = sanitizeOutputDiagnostics([
      ...metrics.outputDiagnostics,
      ...commitMetrics.outputDiagnostics,
    ])
    pushOutputDiagnostic({
      code: 'answer_committed',
      hash: canonicalMeta.hash,
      length: canonicalMeta.text.length,
      timingMs: metrics.answerCommitMs,
      count: metrics.outputDiagnostics.length,
    })
    outputEmitter.emit(EventType.ANSWER_COMMITTED, {
      text: canonicalMeta.text,
      hash: canonicalMeta.hash,
    }, { phase: RunPhase.PERSIST, round: modelRound }, emit)
    if (canonicalMeta.ui?.length) {
      outputEmitter.emit(EventType.CHOICE_READY, {
        ui: canonicalMeta.ui,
        hash: canonicalMeta.hash,
      }, { phase: RunPhase.PERSIST, round: modelRound }, emit)
    }
    answerCommitted = true
    return canonicalMeta
  }

  const fail = (error) => {
    enterPhase(RunPhase.ERROR)
    terminal = RunPhase.ERROR
    errorInfo = { message: String(error || '未知错误').slice(0, 500) }
    stage('stage_generate', '生成失败', 'error', { summary: errorInfo.message, runPhase: RunPhase.ERROR })
    emitTerminal(EventType.RUN_FAILED, {
      title: '生成失败',
      summary: errorInfo.message,
      message: errorInfo.message,
    }, RunPhase.ERROR)
    return buildResult({ error, terminal, runPhases, metrics, planEval, errorInfo, runStartedAt, ports })
  }

  const cancelled = () => {
    if (!cancelCascadeStarted) {
      cancelCascadeStarted = true
      const cancelPromise = ports.orchestration?.cancelAll
        ? ports.orchestration.cancelAll({ runId, reason: 'parent_cancelled', timeoutMs: 3000 })
        : ports.orchestration?.cancelCascade?.('parent_cancelled')
      Promise.resolve(cancelPromise).catch(() => {})
    }
    enterPhase(RunPhase.CANCELLED)
    terminal = RunPhase.CANCELLED
    stage('stage_generate', '已停止生成', 'done', { runPhase: RunPhase.CANCELLED })
    emitTerminal(EventType.RUN_CANCELLED, {
      title: '已停止生成',
      summary: '本次 Agent Run 已取消',
    }, RunPhase.CANCELLED)
    return buildResult({ error: '请求已取消', cancelled: true, terminal, runPhases, metrics, planEval, runStartedAt, ports })
  }

  const checkAbort = () => {
    if (signal.aborted) return cancelled()
    return null
  }

  const isEarlyExit = (result) => result?.report && result.done !== true

  try {
    const prepareResult = await runPrepareContext({
      input,
      ports,
      signal,
      runId,
      runStartedAt,
      RunPhase,
      OUTPUT_PROTOCOL_VERSION,
      enterPhase,
      stage,
      emitV2,
      fail,
      cancelled,
      checkAbort,
      commitCanonicalAnswer,
      buildResult,
      runPhases,
      metrics,
      planEval,
      emitTerminal,
      emit,
      upsertTrace,
    })
    if (isEarlyExit(prepareResult)) return prepareResult

    const {
      session: initialSession,
      apiMessages: initialApiMessages,
      ctxBundle,
      tier,
      toolsEnabled,
      policy,
      tokenCalKey,
      promptCachePolicy,
      toolSurface,
      toolExecutor,
    } = prepareResult

    const loopResult = await runModelToolLoop({
      input,
      ports,
      signal,
      runId,
      RunPhase,
      enterPhase,
      stage,
      emitV2,
      fail,
      cancelled,
      checkAbort,
      upsertTrace,
      assembler,
      metrics,
      markFirstToken,
      discardRoundDraft,
      ctxBundle,
      tier,
      toolsEnabled,
      policy,
      tokenCalKey,
      promptCachePolicy,
      toolSurface,
      toolExecutor,
      session: initialSession,
      apiMessages: initialApiMessages,
      setModelRound: (round) => { modelRound = round },
      getModelRound: () => modelRound,
      setLastModelText: (text) => { lastModelText = text },
      getLastModelText: () => lastModelText,
      setFullText: (text) => { fullText = text },
      getFullText: () => fullText,
      setStreamed: (value) => { streamed = value },
      getStreamed: () => streamed,
      setPlanEval: (value) => { planEval = value },
      getPlanEval: () => planEval,
      setArtifactRefs: (refs) => { artifactRefs = refs },
      getArtifactRefs: () => artifactRefs,
    })
    if (isEarlyExit(loopResult)) return loopResult

    return await runGroundAndPersist({
      input,
      ports,
      runStartedAt,
      RunPhase,
      OUTPUT_PROTOCOL_VERSION,
      enterPhase,
      stage,
      emitV2,
      commitCanonicalAnswer,
      buildResult,
      emitTerminal,
      runPhases,
      metrics,
      planEval: loopResult.planEval,
      setTerminal: (phase) => { terminal = phase },
      trace,
      ctxBundle,
      fullText: loopResult.fullText,
      session: loopResult.session,
      toolMessages: loopResult.toolMessages,
      toolCallCount: loopResult.toolCallCount,
      streamed: loopResult.streamed,
      artifactRefs: loopResult.artifactRefs,
      referenceState: loopResult.referenceState,
      evidenceLedger: loopResult.evidenceLedger,
      toolLedger: loopResult.toolLedger,
      finalizeResponse: loopResult.finalizeResponse,
      loopState: loopResult.loopState,
      modelRound: loopResult.modelRound,
    })
  } catch (err) {
    if (outputEmitter.terminalEmitted) {
      return buildResult({
        error: err?.message || String(err),
        terminal: terminal || RunPhase.ERROR,
        runPhases,
        metrics,
        planEval,
        errorInfo: { message: String(err?.message || err).slice(0, 500) },
        runStartedAt,
        ports,
        answerHash: canonicalMeta?.hash || null,
        protocolVersion: answerCommitted ? OUTPUT_PROTOCOL_VERSION : null,
        ui: canonicalMeta?.ui,
      })
    }
    return fail(err?.message || String(err))
  }
}

module.exports = {
  RunPhase,
  run,
  AgentRunExecutor: { run },
  buildMissingResourceHint,
}
