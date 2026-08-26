'use strict'

const llmRuntime = require('../llm-runtime')
const { EventType } = require('../agent-output-protocol')
const {
  resolveTurnIdentity,
  upsertConversationMessage,
  withConversationIdentity,
} = require('../agent-conversation-log')

/**
 * PREPARE + CONTEXT 阶段：加载设置、构建上下文，处理 grounding 阻断早退。
 * 不负责 MODEL↔TOOL 循环与持久化。
 */

async function runPrepareContext(deps) {
  const {
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
  } = deps

  enterPhase(RunPhase.PREPARE)
  stage('stage_prepare', '正在准备上下文…', 'pending', { runPhase: RunPhase.PREPARE })

  const settings = ports.settings.load()
  if (settings.error) return fail(settings.error)
  if (!settings.apiKey) return fail('未填写 API Key，请托盘右键 → API 设置')
  if (!settings.apiEndpoint) return fail('未填写 API Endpoint，请托盘右键 → API 设置')

  let aborted = checkAbort()
  if (aborted) return aborted

  enterPhase(RunPhase.CONTEXT)
  const ctxBundle = await ports.context.build(input, { settings, emit: deps.emit, stage, upsertTrace: deps.upsertTrace, runPhase: RunPhase.CONTEXT })
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
    const turnIdentity = resolveTurnIdentity(input, runId)
    const assistantMessage = withConversationIdentity({
      id: turnIdentity.assistantMessageId,
      role: 'assistant',
      text: blockedCanonical.text.slice(0, 12000),
      runId,
      createdAt: new Date().toISOString(),
      trace: [],
      protocolVersion: OUTPUT_PROTOCOL_VERSION,
      answerHash: blockedCanonical.hash,
      ui: blockedCanonical.ui,
    }, { sessionId: session.id })
    session.messages = upsertConversationMessage(session.messages || [], assistantMessage)
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

  return {
    session,
    apiMessages,
    ctxBundle,
    tier,
    toolsEnabled,
    policy,
    tokenCalKey,
    promptCachePolicy,
    toolSurface,
    toolExecutor,
  }
}

module.exports = {
  runPrepareContext,
}
