'use strict'

const agentLoop = require('../agent-loop')
const agentRecovery = require('../agent-recovery')
const agentVerify = require('../agent-verify')
const agentRun = require('../agent-run')
const agentTools = require('../agent-tools')
const llmUsage = require('../llm-usage')
const llmRuntime = require('../llm-runtime')
const { buildToolFailureHint } = require('../agent-tool-failure-hint')
const { resolveGroundingRuntimeMode } = require('../agent-run-ports')
const groundingRuntime = require('../agent-grounding-runtime')
const feishuAdapter = require('../agent-grounding-feishu-adapter')
const { buildToolDisplaySummary } = require('../agent-tool-display')
const {
  ingestSnapshot,
  clearRoundDraft,
  setCandidate,
  clearCandidate,
} = require('../agent-output-assembler')
const { MAX_RECOVERY_ROUNDS, TOOL_EXEC_TIMEOUT_MS, ORCHESTRATION_TOOL_PATTERN } = require('./constants')
const { mergeArtifactRefs, buildMissingResourceHint } = require('./hints')

/**
 * MODEL↔TOOL 主循环：预算扩展、工具执行、恢复与 finalizeResponse。
 * 不负责 grounding 校验与会话持久化。
 */

async function runModelToolLoop(deps) {
  const {
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
    toolsEnabled: initialToolsEnabled,
    policy,
    tokenCalKey,
    promptCachePolicy,
    toolSurface,
    toolExecutor,
    session: initialSession,
    apiMessages: initialApiMessages,
    setModelRound,
    getModelRound,
    setLastModelText,
    getLastModelText,
    setFullText,
    getFullText,
    setStreamed,
    getStreamed,
    setPlanEval,
    getPlanEval,
    setArtifactRefs,
    getArtifactRefs,
  } = deps

  let session = initialSession
  let apiMessages = initialApiMessages
  let toolsEnabled = initialToolsEnabled
  let fullText = getFullText()
  let lastModelText = getLastModelText()
  let streamed = getStreamed()
  let planEval = getPlanEval()
  let artifactRefs = getArtifactRefs()

  let budget = llmUsage.adaptiveBudget(tier)
  let maxRounds = ctxBundle.budget?.maxRounds ?? budget.maxRounds
  let maxToolCalls = ctxBundle.budget?.maxToolCalls ?? budget.maxToolCalls
  let budgetExpansions = 0
  const loopState = agentLoop.createLoopState()
  let toolCallCount = 0
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
    let aborted = checkAbort()
    if (aborted) return aborted

    enterPhase(RunPhase.MODEL)
    metrics.rounds++
    setModelRound(round)
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
          setLastModelText(lastModelText)
          if (metrics.firstTokenMs == null) markFirstToken()
          streamed = true
          setStreamed(streamed)
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
    setStreamed(streamed)
    metrics.usage = llmUsage.accumulateUsage(metrics.usage, snapshot.usage)
    const calls = Array.isArray(snapshot.toolCalls) ? snapshot.toolCalls : []

    if (!calls.length) {
      fullText = snapshot.content || lastModelText || assembler.roundDraft || fullText
      const evalResult = agentVerify.evaluatePlanCompletion(session?.run?.plan, {
        canExpand: false,
        budgetExhausted: false,
      })
      planEval = evalResult
      setPlanEval(planEval)
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
      setLastModelText(lastModelText)
      if (metrics.firstTokenMs == null) markFirstToken()
    }
    discardRoundDraft('tool_round')
    clearCandidate(assembler)
    fullText = ''

    if (toolCallCount + calls.length > maxToolCalls) {
      if (!(tryExpandBudget('tool_call_cap') && toolCallCount + calls.length <= maxToolCalls)) {
        enterPhase(RunPhase.VERIFY)
        planEval = agentVerify.evaluatePlanCompletion(session?.run?.plan, { canExpand: false, budgetExhausted: true })
        setPlanEval(planEval)
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
      setArtifactRefs(artifactRefs)

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
      setPlanEval(planEval)
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

  setFullText(fullText)
  setPlanEval(planEval)
  setArtifactRefs(artifactRefs)

  return {
    done: true,
    fullText,
    session,
    apiMessages,
    toolCallCount,
    streamed,
    planEval,
    artifactRefs,
    referenceState,
    evidenceLedger,
    toolLedger,
    metrics,
    toolMessages,
    finalizeResponse,
    loopState,
    modelRound: getModelRound(),
  }
}

module.exports = {
  runModelToolLoop,
}
