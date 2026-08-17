'use strict'

const agentLoop = require('./agent-loop')
const agentRecovery = require('./agent-recovery')
const agentVerify = require('./agent-verify')
const agentRun = require('./agent-run')
const agentTools = require('./agent-tools')
const llmUsage = require('./llm-usage')
const llmRuntime = require('./llm-runtime')
const { normalizeAssistantOutput } = require('./assistant-output-style')
const { buildToolFailureHint } = require('./agent-tool-failure-hint')
const { RunPhase, validateRunPorts, resolveGroundingRuntimeMode } = require('./agent-run-ports')
const groundingRuntime = require('./agent-grounding-runtime')
const feishuAdapter = require('./agent-grounding-feishu-adapter')
const { VERSION: OUTPUT_PROTOCOL_VERSION, EventType, TERMINAL_TYPES, createRunEmitter, mapLegacyType, mapLegacyPayload } = require('./agent-output-protocol')
const {
  createAssembler,
  ingestSnapshot,
  clearRoundDraft,
  setCandidate,
  clearCandidate,
  canonicalize,
} = require('./agent-output-assembler')
const {
  sanitizeDiagnosticEntry,
  sanitizeOutputDiagnostics,
  buildCommitMetrics,
} = require('./agent-output-metrics')
const { buildToolDisplaySummary } = require('./agent-tool-display')
const logger = require('./logger')

const MAX_RECOVERY_ROUNDS = 2
const TOOL_EXEC_TIMEOUT_MS = 45000
const ORCHESTRATION_TOOL_PATTERN = /^(delegate_to_expert|spawn_sub_run|await_sub_run|get_sub_run_status|cancel_sub_run|send_run_message|handoff_artifact)$/

function mergeArtifactRefs(...lists) {
  const merged = new Map()
  for (const item of lists.flat().filter(Boolean)) {
    const ref = typeof item === 'string' ? { id: item } : item
    const id = String(ref?.id || ref?.artifactId || ref?.path || ref?.url || '').trim()
    if (!id) continue
    merged.set(id, { ...(merged.get(id) || {}), ...ref, id })
    if (merged.size >= 32) break
  }
  return [...merged.values()]
}

function isMissingResourceText(text = '') {
  const raw = String(text || '').trim()
  if (!raw) return false
  return /(enoent|no such file|not found|does not exist|404|找不到|未找到|不存在|路径无效|缺少资源)/i.test(raw)
}

function buildMissingResourceHint(entries = []) {
  const list = Array.isArray(entries) ? entries : []
  const failed = [...list].reverse().find(item =>
    item?.status === 'error' && isMissingResourceText(item?.text),
  )
  if (!failed) return ''
  return '我尝试读取目标内容，但未找到对应资源。\n请先确认路径是否正确、文件是否已生成，再让我继续读取。'
}

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

  // ── PREPARE ──────────────────────────────────────────────────────────────
  enterPhase(RunPhase.PREPARE)
  stage('stage_prepare', '正在准备上下文…', 'pending', { runPhase: RunPhase.PREPARE })

  const settings = ports.settings.load()
  if (settings.error) return fail(settings.error)
  if (!settings.apiKey) return fail('未填写 API Key，请托盘右键 → API 设置')
  if (!settings.apiEndpoint) return fail('未填写 API Endpoint，请托盘右键 → API 设置')

  let aborted = checkAbort()
  if (aborted) return aborted

  // ── CONTEXT ──────────────────────────────────────────────────────────────
  try {
  enterPhase(RunPhase.CONTEXT)
  const ctxBundle = await ports.context.build(input, { settings, emit, stage, upsertTrace, runPhase: RunPhase.CONTEXT })
  if (ctxBundle?.error) return fail(ctxBundle.error)
  if (ctxBundle?.aborted || signal.aborted) return cancelled()

  let session = ctxBundle.session || ports.session.get?.() || { messages: [] }
  let apiMessages = ctxBundle.messages || []
  if (ctxBundle.groundingBlocked && ctxBundle.blockedText) {
    const blockedText = String(ctxBundle.blockedText || '')
    enterPhase(RunPhase.VERIFY_CLAIMS)
    emitV2({
      type: 'grounding-status',
      status: 'blocked',
      claims: [],
      sources: [],
      violations: [{ code: 'unbound_selection', message: '候选未绑定' }],
      runPhase: RunPhase.VERIFY_CLAIMS,
    })
    enterPhase(RunPhase.PERSIST)
    const blockedCanonical = commitCanonicalAnswer(blockedText)
    session.messages = session.messages || []
    session.messages.push({
      role: 'assistant',
      text: blockedCanonical.text.slice(0, 12000),
      trace: [],
      protocolVersion: OUTPUT_PROTOCOL_VERSION,
      answerHash: blockedCanonical.hash,
      ui: blockedCanonical.ui,
    })
    ports.session.set?.(session)
    await ports.session.persist?.({
      session,
      fullText: blockedCanonical.text,
      trace: [],
      toolMessages: [],
      metrics,
      input,
      emit: emitV2,
      answerHash: blockedCanonical.hash,
      protocolVersion: OUTPUT_PROTOCOL_VERSION,
      ui: blockedCanonical.ui,
    })
    enterPhase(RunPhase.DONE)
    emitTerminal(EventType.RUN_COMPLETED, {
      title: '执行完成',
      toolCalls: 0,
      metrics,
    }, RunPhase.DONE)
    return buildResult({
      text: blockedCanonical.text,
      streamed: false,
      terminal: RunPhase.DONE,
      runPhases,
      metrics,
      planEval,
      session,
      toolCallCount: 0,
      runStartedAt,
      ports,
      answerHash: blockedCanonical.hash,
      protocolVersion: OUTPUT_PROTOCOL_VERSION,
      ui: blockedCanonical.ui,
    })
  }
  const tier = ctxBundle.tier || 'chat'
  let toolsEnabled = ctxBundle.toolsEnabled !== false && tier !== 'chat'
  const policy = ctxBundle.policy || llmRuntime.getRequestPolicy({ model: 'gpt-4o-mini', tier })
  const tokenCalKey = ctxBundle.tokenCalKey || 'mock:gpt-4o-mini'
  const promptCachePolicy = ctxBundle.promptCachePolicy || { enabled: false }
  const toolSurface = ports.tools.surface
  const toolExecutor = ports.tools.execute

  if (ctxBundle.contextInfo) {
    stage('stage_prepare', '上下文准备完成', 'done', { contextInfo: ctxBundle.contextInfo, runPhase: RunPhase.CONTEXT })
  }

  aborted = checkAbort()
  if (aborted) return aborted

  // ── MODEL ↔ TOOL loop ────────────────────────────────────────────────────
  let budget = llmUsage.adaptiveBudget(tier)
  let maxRounds = ctxBundle.budget?.maxRounds ?? budget.maxRounds
  let maxToolCalls = ctxBundle.budget?.maxToolCalls ?? budget.maxToolCalls
  let budgetExpansions = 0
  const loopState = agentLoop.createLoopState()
  let toolCallCount = 0
  let streamed = false
  let repeatedToolCall = false
  let recoveryUsed = 0
  const toolMessages = []
  const groundingMode = resolveGroundingRuntimeMode()
  let referenceState = groundingRuntime.deserializeReferenceState(
    ports.grounding?.getReferenceState?.() || session.referenceState || {},
  )
  let evidenceLedger = groundingRuntime.createEvidenceLedger(
    ports.grounding?.getEvidenceLedger?.() || { runId: input.runId || 'run' },
  )
  let toolLedger = groundingRuntime.createToolLedger(ports.grounding?.getToolLedger?.() || {})
  if (ctxBundle.taskFrame) {
    referenceState = groundingRuntime.setTaskFrame(referenceState, ctxBundle.taskFrame)
  }

  const tryExpandBudget = (reason) => {
    const remaining = agentRun.countPlanRemaining(session?.run?.plan)
    const expanded = llmUsage.expandBudget(
      { maxRounds, maxToolCalls },
      {
        tier,
        planRemaining: remaining,
        repeatedCall: repeatedToolCall,
        expansionsUsed: budgetExpansions,
        reason,
      },
    )
    if (!expanded.expanded) return false
    maxRounds = expanded.maxRounds
    maxToolCalls = expanded.maxToolCalls
    budgetExpansions = expanded.expansionsUsed
    metrics.budgetExpansions = budgetExpansions
    stage('stage_generate', `计划未完成，扩展执行预算（第 ${budgetExpansions} 次）…`, 'pending', {
      summary: `rounds≤${maxRounds} · tools≤${maxToolCalls}`,
      runPhase: RunPhase.VERIFY,
    })
    return true
  }

  const finalizeResponse = async (reason) => {
    if (loopState.finalizationUsed) return { error: '最终答复收敛请求已使用' }
    loopState.finalizationUsed = true
    enterPhase(RunPhase.FINALIZE)
    const title = reason === 'repeated' ? '正在整理已有结果…' : '正在整理最终答复…'
    stage('stage_generate', title, 'pending', { runPhase: RunPhase.FINALIZE })
    const finalMessages = apiMessages.concat({
      role: 'user',
      content: '请基于当前对话和已经返回的工具结果，直接给出最终答复。不要再调用工具，不要解释执行预算或内部流程；如果信息不足，请明确说明缺少什么。',
    })
    const completion = await ports.llm.complete({
      messages: llmRuntime.applyCacheControlMessages(finalMessages, promptCachePolicy),
      tools: undefined,
      policy: { ...policy, outputTokens: Math.min(policy.maxOutput || 2400, 2400) },
      stream: true,
      finalize: true,
    })
    if (completion.cancelled || signal.aborted) return cancelled()
    if (completion.error) return completion
    const snapshot = completion.snapshot || {}
    if (snapshot.content?.trim()) {
      fullText = snapshot.content
      streamed = streamed || completion.streamed
    } else if (lastModelText.trim()) {
      fullText = lastModelText
    }
    return { ...completion, snapshot }
  }

  for (let round = 1; round <= maxRounds; round++) {
    aborted = checkAbort()
    if (aborted) return aborted

    enterPhase(RunPhase.MODEL)
    metrics.rounds++
    modelRound = round
    discardRoundDraft('model_round_start')
    const roundTitle = round === 1 ? '正在等待模型响应…' : `正在继续生成（第 ${round} 轮）…`
    stage('stage_generate', roundTitle, 'pending', { runPhase: RunPhase.MODEL })

    const completion = await ports.llm.complete({
      messages: llmRuntime.applyCacheControlMessages(apiMessages, promptCachePolicy),
      tools: toolsEnabled && toolSurface?.getToolDefinitions ? toolSurface.getToolDefinitions() : undefined,
      toolsEnabled,
      policy,
      round,
      onSnapshot: (snapshot) => {
        if (snapshot.content) {
          ingestSnapshot(assembler, snapshot.content)
          lastModelText = snapshot.content
          if (metrics.firstTokenMs == null) markFirstToken()
          streamed = true
        }
      },
    })

    if (completion.cancelled || signal.aborted) return cancelled()
    if (completion.error) {
      if (toolsEnabled && completion.status && [400, 404, 422].includes(completion.status)) {
        toolsEnabled = false
        stage('stage_compatibility', '当前模型不支持工具，已切换普通对话', 'done', {
          fallback: true,
          summary: String(completion.error).slice(0, 300),
          runPhase: RunPhase.MODEL,
        })
        round -= 1
        continue
      }
      return fail(completion.error)
    }

    const snapshot = completion.snapshot || {}
    streamed = streamed || completion.streamed
    metrics.usage = llmUsage.accumulateUsage(metrics.usage, snapshot.usage)
    const calls = Array.isArray(snapshot.toolCalls) ? snapshot.toolCalls : []

    if (!calls.length) {
      fullText = snapshot.content || lastModelText || assembler.roundDraft || fullText
      const evalResult = agentVerify.evaluatePlanCompletion(session?.run?.plan, {
        canExpand: false,
        budgetExhausted: false,
      })
      planEval = evalResult
      if (evalResult.action === 'continue' && toolsEnabled && !repeatedToolCall) {
        const expanded = tryExpandBudget('plan_continue_no_tools')
        const stillWithin = !agentLoop.shouldFinalize({
          round,
          maxRounds,
          toolCallCount,
          maxToolCalls,
          repeatedCall: repeatedToolCall,
        })
        if (expanded || stillWithin) {
          const checklist = agentRun.formatPlanChecklist(session?.run?.plan) || ''
          apiMessages.push({
            role: 'user',
            content: [
              '计划仍有未完成项。请继续用工具推进，并用 update_plan 更新状态；不要提前宣称完成。',
              checklist,
            ].filter(Boolean).join('\n'),
          })
          stage('stage_generate', `计划未完成，继续执行（剩余 ${evalResult.remaining} 项）…`, 'pending', { runPhase: RunPhase.MODEL })
          fullText = ''
          clearCandidate(assembler)
          discardRoundDraft('plan_continue')
          continue
        }
      }
      if (!fullText.trim()) return fail('模型返回空响应')
      const exhaustedNote = agentVerify.buildPartialFinalizeNote(
        agentVerify.evaluatePlanCompletion(session?.run?.plan, { canExpand: false, budgetExhausted: true }),
      )
      if (exhaustedNote) fullText = `${fullText.trim()}\n\n---\n${exhaustedNote}`
      setCandidate(assembler, fullText)
      stage('stage_generate', '回答生成完成', 'done', { runPhase: RunPhase.MODEL })
      break
    }

    if (snapshot.content) {
      ingestSnapshot(assembler, snapshot.content)
      lastModelText = snapshot.content
      if (metrics.firstTokenMs == null) markFirstToken()
    }
    discardRoundDraft('tool_round')
    clearCandidate(assembler)
    fullText = ''

    if (toolCallCount + calls.length > maxToolCalls) {
      if (!(tryExpandBudget('tool_call_cap') && toolCallCount + calls.length <= maxToolCalls)) {
        enterPhase(RunPhase.VERIFY)
        planEval = agentVerify.evaluatePlanCompletion(session?.run?.plan, { canExpand: false, budgetExhausted: true })
        const finalized = await finalizeResponse('budget')
        if (finalized.error && !lastModelText.trim()) return fail(finalized.error)
        if (!fullText.trim()) fullText = lastModelText
        const partialNote = agentVerify.buildPartialFinalizeNote(planEval)
        if (partialNote) fullText = `${String(fullText || '').trim()}\n\n---\n${partialNote}`.trim()
        setCandidate(assembler, fullText)
        break
      }
    }

    apiMessages.push({
      role: 'assistant',
      content: snapshot.content || null,
      tool_calls: calls.map((call, idx) => ({
        id: call.id || `call_${round}_${idx + 1}`,
        type: 'function',
        function: { name: call.name, arguments: call.arguments || '{}' },
      })),
    })

    const roundToolMessages = []
    enterPhase(RunPhase.TOOL)

    for (const [index, call] of calls.entries()) {
      aborted = checkAbort()
      if (aborted) return aborted

      toolCallCount++
      metrics.toolCalls = toolCallCount
      const callId = call.id || `call_${round}_${index + 1}`
      const toolName = call.name || 'unknown_tool'
      const startedAt = ports.clock?.now?.() || Date.now()
      const cacheKey = agentLoop.toolCallKey(toolName, call.arguments)
      const validation = toolSurface?.validateToolCall
        ? toolSurface.validateToolCall(toolName, call.arguments)
        : { ok: true, args: {} }
      const argsSummary = validation.ok ? agentTools.summarizeToolArgs(toolName, validation.args) : ''
      const title = toolName === 'search_knowledge' ? '搜索知识库'
        : toolName === 'search_web' ? '搜索网络'
        : toolName === 'fetch_web_page' ? '读取网页'
        : toolName.startsWith('feishu.') ? `飞书：${toolName.replace(/^feishu\./, '')}`
        : `调用工具：${toolName}`

      const isOrchestration = ORCHESTRATION_TOOL_PATTERN.test(toolName)
      const toolPhase = isOrchestration ? RunPhase.ORCHESTRATE : RunPhase.TOOL
      const runningEvent = {
        id: `tool_${callId}`,
        type: 'tool.started',
        kind: 'tool',
        title,
        status: 'pending',
        summary: argsSummary,
        toolCallId: callId,
        toolName,
        runPhase: toolPhase,
      }
      upsertTrace(runningEvent)
      emitV2(runningEvent)

      const cached = loopState.callCache.get(cacheKey)
      if (cached) repeatedToolCall = true

      let result
      if (cached) {
        result = cached
      } else {
        let attempt = 0
        const TOOL_TIMEOUT_SEC = Math.round(TOOL_EXEC_TIMEOUT_MS / 1000)
        const makeToolTimeoutResult = () => ({
          ok: false,
          code: 'tool_timeout',
          message: `工具执行超时（${TOOL_TIMEOUT_SEC}s）`,
          text: `工具执行超时（${TOOL_TIMEOUT_SEC}s），请缩小查询范围或检查连接器状态后重试。`,
          preview: agentRecovery.formatToolTimeoutSummary({
            argsSummary,
            timeoutSec: TOOL_TIMEOUT_SEC,
          }),
        })
        const emitToolProgress = (patch = {}) => {
          const event = {
            id: `tool_${callId}`,
            type: patch.type || 'tool.started',
            kind: 'tool',
            title,
            status: patch.status || 'pending',
            summary: patch.summary || argsSummary,
            toolCallId: callId,
            toolName,
            runPhase: toolPhase,
            ...(Number.isFinite(patch.durationMs) ? { durationMs: patch.durationMs } : {}),
          }
          upsertTrace(event)
          emitV2(event)
        }
        const executeToolOnce = async (attemptLabel = '') => {
          if (attemptLabel) {
            emitToolProgress({
              type: 'tool.started',
              status: 'pending',
              summary: argsSummary ? `${argsSummary} · ${attemptLabel}` : attemptLabel,
            })
          }
          let timeoutTimer = 0
          let abortListener = null
          const clearGuards = () => {
            if (timeoutTimer) clearTimeout(timeoutTimer)
            if (abortListener && signal?.removeEventListener) {
              signal.removeEventListener('abort', abortListener)
            }
          }
          try {
            return await Promise.race([
              toolExecutor({
                name: toolName,
                arguments: call.arguments,
                id: callId,
                timeoutMs: TOOL_EXEC_TIMEOUT_MS,
                signal,
              }),
              new Promise((resolve) => {
                timeoutTimer = setTimeout(() => {
                  try { ports.orchestration?.cancelProcessesForRun?.(runId) } catch { /* ignore */ }
                  const timedOut = makeToolTimeoutResult()
                  emitToolProgress({
                    type: 'tool.failed',
                    status: 'error',
                    summary: timedOut.preview,
                    durationMs: TOOL_EXEC_TIMEOUT_MS,
                  })
                  resolve(timedOut)
                }, TOOL_EXEC_TIMEOUT_MS)
              }),
              new Promise((resolve) => {
                if (!signal) return
                const onAbort = () => {
                  try { ports.orchestration?.cancelProcessesForRun?.(runId) } catch { /* ignore */ }
                  resolve({
                    ok: false,
                    code: 'cancelled',
                    text: '工具执行已取消',
                    preview: '工具执行已取消',
                  })
                }
                if (signal.aborted) { onAbort(); return }
                abortListener = onAbort
                signal.addEventListener('abort', abortListener, { once: true })
              }),
            ])
          } finally {
            clearGuards()
          }
        }
        // eslint-disable-next-line no-constant-condition
        while (true) {
          result = await executeToolOnce(attempt ? `第 ${attempt} 次重试` : '')
          if (signal.aborted) break
          const category = agentRecovery.classifyToolError(result)
          const plan = agentRecovery.planRetry({ category, attempt, maxRetries: 2 })
          if (!plan.retry) break
          attempt += 1
          metrics.toolRetries = (metrics.toolRetries || 0) + 1
          emitToolProgress({
            type: 'tool.started',
            status: 'pending',
            summary: agentRecovery.formatToolRetrySummary({
              argsSummary,
              attempt,
              delayMs: plan.delayMs,
              reason: category,
            }),
          })
          await new Promise(resolve => setTimeout(resolve, plan.delayMs))
          if (signal.aborted) break
        }
      }

      if (signal.aborted) return cancelled()
      if (!cached) loopState.callCache.set(cacheKey, result)

      const durationMs = (ports.clock?.now?.() || Date.now()) - startedAt
      const resultEvent = {
        id: `tool_${callId}`,
        type: result.ok !== false ? 'tool.completed' : 'tool.failed',
        kind: 'tool',
        title,
        status: result.ok !== false ? 'done' : 'error',
        summary: buildToolDisplaySummary(result, { ok: result.ok !== false }),
        toolCallId: callId,
        toolName,
        durationMs,
        runPhase: toolPhase,
        draftId: result.draftId || result.draft?.id || null,
        requiresApproval: Boolean(result.requiresApproval),
        artifactRefs: Array.isArray(result.artifactRefs) ? result.artifactRefs : [],
        sources: Array.isArray(result.sources) ? result.sources : [],
      }
      upsertTrace(resultEvent)
      emitV2(resultEvent)
      artifactRefs = mergeArtifactRefs(artifactRefs, resultEvent.artifactRefs)

      toolMessages.push({
        role: 'tool',
        text: result.text,
        toolCallId: callId,
        toolName,
        status: result.ok !== false ? 'done' : 'error',
        durationMs,
      })
      if (isOrchestration && result?.meta?.subRunId) {
        const childMetric = {
          runId: String(result.meta.subRunId),
          expertId: String(result.meta.expertId || ''),
          builderId: String(result.meta.builderId || 'knowme-local'),
          terminal: String(result.meta.terminal || (result.ok === false ? 'FAILED' : 'COMPLETED')),
          durationMs: Number(result.meta.durationMs) || durationMs,
          stopReason: String(result.meta.stopReason || result.code || ''),
        }
        metrics.subRuns = Array.isArray(metrics.subRuns) ? metrics.subRuns : []
        const childIndex = metrics.subRuns.findIndex(item => item.runId === childMetric.runId)
        if (childIndex >= 0) metrics.subRuns[childIndex] = childMetric
        else metrics.subRuns.push(childMetric)
        if (Array.isArray(result.meta.evidenceRefs)) {
          for (const evidence of result.meta.evidenceRefs.slice(0, 32)) {
            evidenceLedger = groundingRuntime.appendEvidence(evidenceLedger, {
              source: 'subrun',
              refId: evidence?.id || evidence?.refId || null,
              status: evidence?.status === 'ok' ? 'ok' : 'fail',
              digest: evidence?.digest || evidence?.summary || '',
              provenance: {
                source: 'subrun',
                subRunId: childMetric.runId,
                expertId: childMetric.expertId,
                builderId: childMetric.builderId,
                ...(evidence?.provenance && typeof evidence.provenance === 'object' ? evidence.provenance : {}),
              },
            })
          }
          ports.grounding?.setLedgers?.({ evidenceLedger, toolLedger })
        }
      }
      if (groundingMode === 'runtime' && toolName === 'feishu.meeting_candidates' && result.ok !== false) {
        referenceState = feishuAdapter.applyMeetingCandidatesToReferenceState(referenceState, result.text)
        ports.grounding?.setReferenceState?.(referenceState)
      }
      roundToolMessages.push({
        text: result.text,
        toolName,
        code: result.code,
        status: result.ok !== false ? 'done' : 'error',
      })

      const modelToolText = llmRuntime.fitText(result.text || '', 6000, '\n…（工具结果已压缩）…\n')
      apiMessages.push({ role: 'tool', tool_call_id: callId, content: modelToolText })
      session = agentRun.upsertStep(session, resultEvent)
      if (result.ok !== false) session = agentRun.recordTool(session, toolName)
      ports.session.set?.(session)
    }

    const allRoundToolsErrored = roundToolMessages.length > 0 &&
      roundToolMessages.every(item => item.status === 'error')

    if (
      allRoundToolsErrored &&
      round < maxRounds &&
      toolCallCount < maxToolCalls &&
      agentRecovery.shouldAttemptRecovery({
        failures: roundToolMessages,
        recoveryUsed,
        maxRecovery: MAX_RECOVERY_ROUNDS,
        repeatedCall: repeatedToolCall,
      })
    ) {
      enterPhase(RunPhase.RECOVER)
      recoveryUsed += 1
      metrics.recoveryRounds = recoveryUsed
      const reflectionNote = agentRecovery.buildReflectionNote(roundToolMessages)
      if (reflectionNote) apiMessages.push({ role: 'user', content: reflectionNote })
      stage('stage_generate', '正在反思工具失败并尝试自我修正…', 'pending', {
        summary: `第 ${recoveryUsed} 次自我修正`,
        runPhase: RunPhase.RECOVER,
      })
      fullText = ''
      clearCandidate(assembler)
      clearRoundDraft(assembler)
      continue
    }

    const roundMissingHint = buildMissingResourceHint(roundToolMessages)
    if (roundMissingHint && allRoundToolsErrored) {
      fullText = roundMissingHint
      setCandidate(assembler, fullText)
      stage('stage_generate', '已返回缺失资源提示', 'done', { fallback: true, runPhase: RunPhase.MODEL })
      break
    }

    const roundToolFailureHint = buildToolFailureHint(roundToolMessages)
    if (roundToolFailureHint && allRoundToolsErrored) {
      fullText = roundToolFailureHint
      setCandidate(assembler, fullText)
      stage('stage_generate', '已返回工具失败提示', 'done', { fallback: true, runPhase: RunPhase.MODEL })
      break
    }

    await ports.session.checkpoint?.({ session, emit: emitV2 })

    const tokensNow = llmUsage.applyCalibration(
      llmRuntime.estimateTokens(JSON.stringify(apiMessages)),
      tokenCalKey,
    )
    if (tokensNow > policy.inputBudget) {
      apiMessages = llmRuntime.fitConversation(apiMessages, policy.inputBudget).messages
      metrics.contextCompactions = (metrics.contextCompactions || 0) + 1
    }

    if (agentLoop.shouldFinalize({
      round,
      maxRounds,
      toolCallCount,
      maxToolCalls,
      repeatedCall: repeatedToolCall,
    })) {
      enterPhase(RunPhase.VERIFY)
      planEval = agentVerify.evaluatePlanCompletion(session?.run?.plan, {
        canExpand: true,
        budgetExhausted: true,
      })
      if (planEval.action === 'expand' && tryExpandBudget('plan_incomplete')) {
        fullText = ''
        clearCandidate(assembler)
        clearRoundDraft(assembler)
        continue
      }
      const finalized = await finalizeResponse(repeatedToolCall ? 'repeated' : 'budget')
      if (finalized.error && !lastModelText.trim()) return fail(finalized.error)
      if (!fullText.trim()) fullText = lastModelText
      const partialNote = agentVerify.buildPartialFinalizeNote(planEval)
      if (partialNote) fullText = `${String(fullText || '').trim()}\n\n---\n${partialNote}`.trim()
      setCandidate(assembler, fullText)
      break
    }
    fullText = ''
    clearCandidate(assembler)
    discardRoundDraft('tool_loop_end')
  }

  if (!fullText.trim()) {
    const missingHint = buildMissingResourceHint(toolMessages)
    if (missingHint) {
      fullText = missingHint
      setCandidate(assembler, fullText)
      stage('stage_generate', '已返回缺失资源提示', 'done', { fallback: true, runPhase: RunPhase.MODEL })
    } else {
      const toolFailureHint = buildToolFailureHint(toolMessages)
      if (toolFailureHint) {
        fullText = toolFailureHint
        setCandidate(assembler, fullText)
        stage('stage_generate', '已返回工具失败提示', 'done', { fallback: true, runPhase: RunPhase.MODEL })
      } else {
        return fail('模型未能生成可交付答复，请重试')
      }
    }
  }

  if (ports.hooks?.postProcess) {
    fullText = await ports.hooks.postProcess({ fullText, toolMessages, session, input }) || fullText
  }

  if (groundingMode === 'runtime') {
    enterPhase(RunPhase.GROUND)
    stage('stage_ground', '正在核对依据…', 'pending', { runPhase: RunPhase.GROUND })
    const merged = groundingRuntime.mergeToolResultsIntoLedgers({
      toolLedger: groundingRuntime.createToolLedger(),
      evidenceLedger: groundingRuntime.createEvidenceLedger({ runId: input.runId || 'run' }),
      toolMessages,
    })
    toolLedger = merged.toolLedger
    evidenceLedger = merged.evidenceLedger
    ports.grounding?.setLedgers?.({ evidenceLedger, toolLedger })
    session.referenceState = groundingRuntime.serializeReferenceState(referenceState)
    stage('stage_ground', '依据核对完成', 'done', { runPhase: RunPhase.GROUND })

    enterPhase(RunPhase.VERIFY_CLAIMS)
    stage('stage_verify_claims', '正在验证输出依据…', 'pending', { runPhase: RunPhase.VERIFY_CLAIMS })
    const taskFrame = referenceState.taskFrame || ctxBundle.taskFrame || null
    if (taskFrame?.requiredTools?.length) {
      referenceState = groundingRuntime.setTaskFrame(referenceState, taskFrame)
    }
    let verification = groundingRuntime.verifyClaims({
      text: fullText,
      evidenceLedger,
      toolLedger,
      referenceState,
      taskFrame,
    })
    let gate = groundingRuntime.applyOutputGate({ text: fullText, verification, taskFrame, regenUsed: false })
    if (!gate.allowed && gate.regenSuggested && loopState.finalizationUsed !== true) {
      const regen = await finalizeResponse('grounding')
      if (regen?.snapshot?.content) fullText = regen.snapshot.content
      verification = groundingRuntime.verifyClaims({
        text: fullText,
        evidenceLedger,
        toolLedger,
        referenceState,
        taskFrame,
      })
      gate = groundingRuntime.applyOutputGate({ text: fullText, verification, taskFrame, regenUsed: true })
    }
    if (!gate.allowed) fullText = gate.refusal || gate.text
    const groundingStatus = groundingRuntime.buildGroundingStatus(verification, { evidenceLedger, toolLedger })
    emitV2({ type: 'grounding-status', ...groundingStatus, runPhase: RunPhase.VERIFY_CLAIMS })
    stage('stage_verify_claims', gate.blocked ? '输出已阻断未验证声明' : '输出验证通过', gate.blocked ? 'error' : 'done', {
      runPhase: RunPhase.VERIFY_CLAIMS,
      summary: gate.blocked ? (gate.refusal || '').slice(0, 200) : '',
    })
  }

  fullText = normalizeAssistantOutput(fullText)

  const committed = commitCanonicalAnswer(fullText)
  fullText = committed.text

  // ── PERSIST ──────────────────────────────────────────────────────────────
  enterPhase(RunPhase.PERSIST)
  for (const item of trace) session = agentRun.upsertStep(session, item)
  session.messages = session.messages || []
  session.messages.push(...toolMessages, {
    role: 'assistant',
    text: fullText.slice(0, 12000),
    trace,
    protocolVersion: OUTPUT_PROTOCOL_VERSION,
    answerHash: committed.hash,
    ui: committed.ui,
  })
  session.updatedAt = new Date().toISOString()
  ports.session.set?.(session)

  const persistedArtifactRefs = mergeArtifactRefs(
    Array.isArray(session?.run?.artifacts)
      ? session.run.artifacts.map(artifact => ({
          id: artifact.id,
          kind: artifact.type || artifact.kind || 'artifact',
          title: artifact.title || artifact.id,
          status: artifact.status || null,
        }))
      : [],
    artifactRefs,
  )

  await ports.session.persist?.({
    session,
    fullText,
    trace,
    toolMessages,
    metrics,
    input,
    emit: emitV2,
    answerHash: committed.hash,
    protocolVersion: OUTPUT_PROTOCOL_VERSION,
    ui: committed.ui,
    artifactRefs: persistedArtifactRefs,
    evidenceRefs: Array.isArray(evidenceLedger?.entries)
      ? evidenceLedger.entries.slice(-32).map(entry => ({
        id: entry.id,
        refId: entry.refId,
        status: entry.status,
        digest: entry.digest,
        provenance: entry.provenance,
      }))
      : [],
  })

  enterPhase(RunPhase.DONE)
  terminal = RunPhase.DONE
  if (!runPhases.includes(RunPhase.DONE)) runPhases.push(RunPhase.DONE)

  metrics.totalMs = (ports.clock?.now?.() || Date.now()) - runStartedAt
  emitTerminal(EventType.RUN_COMPLETED, {
    title: '执行完成',
    toolCalls: toolCallCount,
    metrics,
    answerHash: committed.hash,
  }, RunPhase.DONE)

  return buildResult({
    text: fullText,
    streamed,
    terminal,
    runPhases,
    metrics,
    planEval,
    session,
    toolCallCount,
    runStartedAt,
    ports,
    answerHash: committed.hash,
    protocolVersion: OUTPUT_PROTOCOL_VERSION,
    ui: committed.ui,
    artifactRefs: persistedArtifactRefs,
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

function buildResult(partial) {
  const durationMs = (partial.ports?.clock?.now?.() || Date.now()) - (partial.runStartedAt || Date.now())
  const result = { ...partial }
  delete result.ports
  delete result.runStartedAt
  const report = {
    terminal: partial.terminal || RunPhase.ERROR,
    runPhases: partial.runPhases || [],
    rounds: partial.metrics?.rounds || 0,
    toolCalls: partial.metrics?.toolCalls || partial.toolCallCount || 0,
    planEval: partial.planEval || null,
    durationMs,
    error: partial.errorInfo || (partial.error ? { message: String(partial.error) } : null),
    cancelled: partial.cancelled === true,
  }
  if (partial.answerHash) report.answerHash = partial.answerHash
  if (partial.protocolVersion) report.protocolVersion = partial.protocolVersion
  return {
    ...result,
    report,
  }
}

module.exports = {
  RunPhase,
  run,
  AgentRunExecutor: { run },
  buildMissingResourceHint,
}
