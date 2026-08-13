'use strict'

const { app } = require('electron')
const path = require('path')
const https = require('https')
const http = require('http')
const promptRouter = require('../lib/assistant-prompt-router')
const { buildSystemContent, buildChatMessages } = require('../lib/ai-assistant-context')
const { normalizeAssistantOutput } = require('../lib/assistant-output-style')
const productKnowledge = require('../lib/product-knowledge')
const productMemory = require('../lib/product-memory')
const conversationGrounding = require('../lib/conversation-grounding')
const agentSessions = require('../lib/agent-sessions')
const agentRun = require('../lib/agent-run')
const agentStream = require('../lib/agent-stream')
const agentTools = require('../lib/agent-tools')
const agentLoop = require('../lib/agent-loop')
const agentRecovery = require('../lib/agent-recovery')
const agentVerify = require('../lib/agent-verify')
const { buildToolFailureHint } = require('../lib/agent-tool-failure-hint')
const { buildToolDisplaySummary } = require('../lib/agent-tool-display')
const agentSandbox = require('../lib/agent-sandbox')
const agentPlanTools = require('../lib/agent-plan-tools')
const agentWebTools = require('../lib/agent-web-tools')
const { resolveAgentExecutorMode, resolveGroundingRuntimeMode } = require('../lib/agent-run-ports')
const groundingRuntime = require('../lib/agent-grounding-runtime')
const feishuGroundingAdapter = require('../lib/agent-grounding-feishu-adapter')
const { AgentRunExecutor } = require('../lib/agent-run-executor')
const { buildProductionRunPorts } = require('../lib/agent-run-kernel-adapter')
const llmRuntime = require('../lib/llm-runtime')
const llmModelCatalog = require('../lib/llm-model-catalog')
const llmUsage = require('../lib/llm-usage')
const knowledgeOs = require('../lib/knowledge-os')
const fabricRetrieval = require('../lib/fabric-retrieval')
const chatIntent = require('../lib/chat-intent')
const researchRouting = require('../lib/research-routing')
const contextCache = require('../lib/context-cache')
const contextOrchestrator = require('../lib/agent-context-orchestrator')
const contextPacketLib = require('../lib/context-packet')
const feishuGrounding = require('../lib/feishu-grounding')
const writingWorkflow = require('../lib/writing-workflow')
const connectorToolRuntime = require('../lib/connectors/tool-runtime')
const agentProcessTools = require('../lib/agent-process-tools')
const agentArtifactTools = require('../lib/agent-artifact-tools')
const agentOrchestration = require('../lib/agent-orchestration')
const knowledgeStewardTools = require('../lib/knowledge-steward-tools')
const { isToolSurfaceV1 } = require('../lib/tool-contract-registry')
const { resolveToolSurfaceForRun } = require('../lib/tool-surface-builder')
const { getSessionCapabilityBindings } = require('../lib/agent-context-assembly')
const { buildTemporalAnchorContext } = require('../lib/temporal-anchor')
const { mergeExtraTools } = require('../lib/merge-extra-tools')
const { humanizeAgentError } = require('../lib/agent-error-humanize')
const { assertRequiredDeps } = require('../lib/ipc-assert-deps')
const logger = require('../lib/logger')

const AI_GENERATE_REQUIRED_DEPS = [
  'activeAgentRuns',
  'loadSettings',
  'saveSettings_',
  'ensureAgentSession',
  'saveAgentSessions',
  'loadAgentSessions',
  'buildFabricCtx',
  'ensureFabricSeeded',
  'ensureCapabilityHub',
  'ensureAgentTeamRuntime',
  'readNote',
  'buildEmbedFn',
  'normalizeChatEndpoint',
  'requestAgentCompletion',
  'buildMissingResourceHint',
  'getFeishuGroundingContext',
  'hasPriorFeishuFacts',
  'resolveActiveProvider',
  'KNOWLEDGE_DIR',
  'MEMORY_DIR',
  'agentRuntimePortFactories',
  'loadSourcesStore',
  'getActiveSourceRoot',
  'kosSourcesCtx',
  'workbenchDaemon',
  'buildActiveSourceFileTools',
  'agentRuntimeOutputBridges',
]

function registerAiGenerateIpc(ipcMain, deps) {
  assertRequiredDeps(deps, AI_GENERATE_REQUIRED_DEPS, 'ai-generate')
  const {
    activeAgentRuns,
    loadSettings,
    saveSettings_,
    ensureAgentSession,
    saveAgentSessions,
    loadAgentSessions,
    buildFabricCtx,
    ensureFabricSeeded,
    ensureCapabilityHub,
    ensureAgentTeamRuntime,
    readNote,
    buildEmbedFn,
    normalizeChatEndpoint,
    requestAgentCompletion,
    buildMissingResourceHint,
    getFeishuGroundingContext,
    hasPriorFeishuFacts,
    resolveActiveProvider,
    KNOWLEDGE_DIR,
    MEMORY_DIR,
    agentRuntimePortFactories,
    loadSourcesStore,
    getActiveSourceRoot,
    kosSourcesCtx,
    workbenchDaemon,
    buildActiveSourceFileTools,
    agentRuntimeOutputBridges,
  } = deps
  ipcMain.handle('ai-generate', async (e, payload = {}) => {

  const {
    prompt, displayPrompt, context, history, noteId, category, skillRefs, taskId: rawTaskId,
    sessionId, agentId, contentGrounding,
    memoryToggles,
  } = payload
  const webContents = e.sender
  const runId = String(payload.runId || `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`)
  const controller = new AbortController()
  const signal = controller.signal
  activeAgentRuns.set(runId, controller)
  const runStartedAt = Date.now()
  const metrics = { rounds: 0, toolCalls: 0, firstTokenMs: null }
  const trace = []
  const toolMessages = []
  const emit = event => {
    if (webContents.isDestroyed()) return
    webContents.send('ai-stream-event', { runId, sessionId, ...event })
  }
  const upsertTrace = event => {
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
  const stage = (id, title, status = 'pending', extra = {}) => {
    const event = { id, type: extra.fallback ? 'fallback' : 'stage', kind: 'stage', title, status, ...extra }
    upsertTrace(event)
    emit(event)
  }
  // Run 被 adopt 之后的任何前置失败都必须收敛终态，否则 RunStore 会留下 running 僵尸。
  let settleAdoptedRun = null
  const fail = error => {
    const message = humanizeAgentError(error, { fallback: '暂时无法完成回复，请重试' })
    activeAgentRuns.delete(runId)
    if (settleAdoptedRun) {
      const settle = settleAdoptedRun
      settleAdoptedRun = null
      try { settle(message) } catch { /* 终态收敛不阻断错误返回 */ }
    }
    stage('stage_generate', '生成失败', 'error', { summary: message.slice(0, 500) })
    emit({ type: 'error', title: '生成失败', summary: message.slice(0, 500) })
    return { error: message, runId }
  }
  const cancelled = () => {
    activeAgentRuns.delete(runId)
    stage('stage_generate', '已停止生成', 'done')
    emit({ type: 'cancelled', title: '已停止生成', summary: '本次 Agent Run 已取消' })
    return { error: '请求已取消', cancelled: true, runId }
  }

  try {

  stage('stage_prepare', '正在准备上下文…')
  const s = loadSettings()
  llmUsage.importCalibrations(s.tokenCalibrations || {})
  if (!s.apiKey) return fail('未填写 API Key，请托盘右键 → API 设置')
  if (!s.apiEndpoint) return fail('未填写 API Endpoint，请托盘右键 → API 设置')

  let url
  const endpoint = normalizeChatEndpoint(s.apiEndpoint)
  try { url = new URL(endpoint) } catch { return fail(`Endpoint 格式错误: ${s.apiEndpoint}`) }

  let theme = String(category || '').trim()
  if (!theme && noteId) {
    const n = readNote(noteId)
    if (n) theme = String(n.category || '').trim()
  }
  const fromPrompt = productKnowledge.parseSlashTokens(prompt)
  const slashRefs = [
    ...new Set([
      ...(Array.isArray(skillRefs) ? skillRefs.map(productKnowledge.normalizeSlash) : []),
      ...fromPrompt,
    ].filter(Boolean)),
  ]
  const requestedTaskId = String(rawTaskId || '').trim()
  if (requestedTaskId) {
    const taskCatalog = ensureCapabilityHub().listSkillTasks()
    const trustedTask = (taskCatalog.tasks || []).find(task => task.id === requestedTaskId)
    const trustedSkillId = productKnowledge.normalizeSlash(trustedTask?.skillId || '')
    if (!trustedTask || !trustedSkillId || !slashRefs.includes(trustedSkillId)) {
      return fail('任务入口已失效或与 Skill 不匹配，请刷新后重试。')
    }
  }
  const ensured = ensureAgentSession(sessionId, agentId)
  let session = ensured.session
  const prepared = agentSessions.compactSession(session)
  session = prepared.session
  if (prepared.compacted) {
    saveAgentSessions(ensured.sessions.map(item => item.id === session.id ? session : item))
  }

  const ctxRole = (session?.run?.role === 'steward' || session?.agentId === 'steward')
    ? 'steward'
    : String(session?.run?.role || session?.agentId || 'general')
  const grounding = contentGrounding && typeof contentGrounding === 'object'
    ? contentGrounding
    : conversationGrounding.buildGrounding({ prompt, displayPrompt, context })
  const writingTask = ctxRole === 'writing'
    ? writingWorkflow.classifyWritingTask(prompt, displayPrompt, grounding)
    : null
  const forceFullCtx = process.env.KNOWME_CTX_FULL === '1' || s.chatContextTier === 'full'
  const tier = (forceFullCtx || (ctxRole === 'writing' && !!writingTask)) ? 'retrieval' : chatIntent.classifyIntent({
    prompt,
    hasNoteContext: !!String(context || '').trim(),
    slashRefs,
    role: ctxRole,
  })
  const todayPriorityFactsOnly = /(今日优先级|今天优先级|今日优先|优先级助手|feishu\.today_priority)/i.test(String(prompt || ''))
  const heavyCtx = tier !== 'chat' && !todayPriorityFactsOnly
  const retrievalScope = ensureCapabilityHub().resolveSessionRetrievalScope(session)
  const localKnowledgeEnabled = !retrievalScope.degraded
    && retrievalScope.providers.some(provider => ['local', 'qmd-local'].includes(String(provider?.kind || '')))
  const kbSnippet = heavyCtx && localKnowledgeEnabled
    ? contextCache.cached(
        `kb:${KNOWLEDGE_DIR}`,
        contextCache.statMtimeMs(path.join(KNOWLEDGE_DIR, 'index.md')),
        () => productKnowledge.getContextSnippet(KNOWLEDGE_DIR)
      )
    : ''
  const skillCtx = heavyCtx && localKnowledgeEnabled
    ? contextCache.cached(
        `skill:${KNOWLEDGE_DIR}:${theme}:${slashRefs.join(',')}`,
        contextCache.statMtimeMs(KNOWLEDGE_DIR),
        () => productKnowledge.getSkillContext(KNOWLEDGE_DIR, { category: theme, slashRefs })
      )
    : ''
  const baseMemCtx = heavyCtx
    ? contextCache.cached(
        `mem:${MEMORY_DIR}:${theme}:${slashRefs.join(',')}`,
        contextCache.statMtimeMs(path.join(MEMORY_DIR, 'working', 'recent.jsonl')) ||
          contextCache.statMtimeMs(MEMORY_DIR),
        () => productMemory.getContextForAI(MEMORY_DIR, [kbSnippet, skillCtx].filter(Boolean).join('\n\n'))
      )
    : ''
  const embedFn = buildEmbedFn(s)

  const queryKnowledge = async (query, querySignal) => {
    if (retrievalScope.degraded) {
      return {
        ok: true,
        hits: [],
        message: retrievalScope.message || '知识范围不可用',
        degraded: true,
        scope: retrievalScope.mode,
      }
    }
    const userData = app.getPath('userData')
    ensureFabricSeeded(userData)
    return fabricRetrieval.fabricSearch(userData, query, {
      ...buildFabricCtx(),
      providers: retrievalScope.providers,
      embed: embedFn,
      signal: querySignal,
    })
  }

  const kbQueryTool = async (collection, query, querySignal) => fabricRetrieval.kbQuery(
    app.getPath('userData'),
    collection,
    query,
    { ...buildFabricCtx(), signal: querySignal }
  )

  const kbGetTool = async (ref) => fabricRetrieval.kbGet(app.getPath('userData'), ref, buildFabricCtx())

  let wikiCtx = ''
  if (tier === 'retrieval' && !todayPriorityFactsOnly && String(prompt || '').trim()) {
    const startedAt = Date.now()
    stage('stage_retrieval', '正在检索知识库…')
    try {
      const q = await queryKnowledge(prompt)
      metrics.retrievalMs = Date.now() - startedAt
      metrics.retrievalHitCount = Array.isArray(q.hits) ? q.hits.length : 0
      metrics.retrievalReranked = !!q.reranked
      if (q.degraded) {
        stage('stage_retrieval', '知识范围不可用', 'done', {
          summary: q.message || retrievalScope.message || '所选知识库均不可用',
          durationMs: Date.now() - startedAt,
        })
      } else if (q.hits?.length) {
        wikiCtx = knowledgeOs.formatQueryContext(q.hits)
        const provider = retrievalScope.providers?.[0] || resolveActiveProvider()
        session = agentRun.recordTool(session, provider.kind === 'remote-rag' ? 'rag.query' : 'wiki.query')
        stage('stage_retrieval', '知识检索完成', 'done', {
          summary: `命中 ${q.hits.length} 条`,
          durationMs: Date.now() - startedAt,
        })
      } else {
        stage('stage_retrieval', '知识检索完成', 'done', {
          summary: q.message || '未命中',
          durationMs: Date.now() - startedAt,
        })
      }
    } catch (err) {
      metrics.retrievalMs = Date.now() - startedAt
      stage('stage_retrieval', '知识检索失败', 'error', {
        summary: String(err?.message || '检索失败').slice(0, 300),
        durationMs: Date.now() - startedAt,
      })
    }
  }
  if (signal.aborted) return cancelled()

  const sessionHistory = agentSessions.contextMessages(session)
  const sessionSummary = session.summary ? `## 当前 Session 历史摘要\n${session.summary}` : ''
  const userProfile = {
    userProfile: s.userProfile,
    userPrompt: s.userPrompt,
    industry: s.industry,
  }
  const workContext = {
    topic: [
      grounding.goal,
      session?.title,
      prompt,
    ].filter(Boolean).join(' ').slice(0, 240),
    label: session?.title || ctxRole,
    project: theme,
  }
  const contextItems = productMemory.buildContextItems(MEMORY_DIR, {
    userProfile,
    workContext,
    sessionSummary,
  })
  const effectivePersonalization = productMemory.buildEffectivePersonalization(MEMORY_DIR, userProfile, {
    limit: 4,
    includeUserPrompt: memoryToggles?.collaborationPrefs !== false,
  })
  const lightPacket = contextPacketLib.buildContextPacket({
    items: [
      ...contextItems.filter(item => (
        item.type === 'preference' && item.confidence === 'confirmed'
      )),
      // 手填协作偏好也进入 light 包，避免只靠 system 段、dynamic 段空着
      ...(effectivePersonalization.applied
        .filter(item => item.kind === 'user_prompt')
        .map(item => ({
          id: item.id,
          type: 'preference',
          text: item.text,
          confidence: 'explicit',
          scope: 'global',
          source: item.source,
          reason: 'user_prompt',
        }))),
    ],
    mode: 'light',
    maxItems: 4,
  })
  const workPacket = contextPacketLib.buildContextPacket({
    items: contextItems.filter(item => item.type === 'work_memory'),
    mode: 'work',
    maxItems: 8,
  })
  // 统一短摘要优先；若为空再回落到 light packet 格式化结果
  const personalizationContext = effectivePersonalization.promptBlock
    || contextPacketLib.formatForPrompt(lightPacket)
  const workMemoryContext = contextPacketLib.formatForPrompt(workPacket)
  const memCtx = [baseMemCtx, workMemoryContext].filter(Boolean).join('\n\n')
  const routedModel = llmModelCatalog.resolveRuntimeModel(s, {
    tier,
    prompt,
    history: sessionHistory.length ? sessionHistory : history,
  })
  const modelProfile = routedModel.profile
  const tokenCalKey = llmUsage.calibrationKey(routedModel.provider, routedModel.model || 'gpt-4o-mini')
  const tokenCalBefore = llmUsage.getCalibration(tokenCalKey)
  if (routedModel.autoRouted) {
    stage('stage_prepare', `Auto 已选择模型：${routedModel.profile.label}`, 'done', {
      summary: `路由规则：${routedModel.autoReason || 'default'}`,
    })
  }
  const policy = llmRuntime.getRequestPolicy({
    model: routedModel.model || 'gpt-4o-mini',
    tier,
    temperature: s.temperature,
    requestedOutput: 2000,
    profile: modelProfile,
  })
  const promptCachePolicy = llmRuntime.getCacheControlPolicy({
    enabled: s.promptCacheControl === true || process.env.KNOWME_PROMPT_CACHE === '1',
    provider: routedModel.provider,
    model: routedModel.model,
    endpoint: s.apiEndpoint,
  })
  const memoryPolicy = contextOrchestrator.buildMemoryPolicy({
    tier,
    memoryContext: memCtx,
    disableMemory: process.env.KNOWME_DISABLE_MEMORY_CONTEXT === '1' || s.disableMemoryContext === true,
  })
  // dynamic sections are still budgeted by priority via llmRuntime.fitSections (inside orchestrator)
  const dynamicContextPack = contextOrchestrator.buildDynamicContext({
    policy: { inputBudget: policy.inputBudget, tier },
    roleGuidance: conversationGrounding.roleGuidance(ctxRole),
    timeAnchor: buildTemporalAnchorContext(),
    groundingText: grounding.text,
    sessionSummary,
    retrievalContext: wikiCtx,
    memoryContext: memCtx,
    personalizationContext,
    planContext: agentRun.formatPlanChecklist(session?.run?.plan),
    memoryPolicy,
  })
  const srcStoreForWriting = loadSourcesStore()
  const activeSourceRecord = srcStoreForWriting.sources.find(
    (s) => s.id === srcStoreForWriting.activeSourceId,
  ) || null
  const writingPromptContext = writingTask
    ? writingWorkflow.buildWritingPromptContext({
      prompt,
      displayPrompt,
      context,
      grounding,
      activeSource: activeSourceRecord,
    })
    : ''
  const capAssembly = ensureCapabilityHub().assembleContextForSession(
    session,
    prompt,
    slashRefs,
    tier,
    skillCtx,
    { taskId: requestedTaskId },
  )
  const capAssemblyGrounding = capAssembly?.groundingContract || null
  let effectivePrompt = String(prompt || '')
  let groundingTaskFrame = null
  if (resolveGroundingRuntimeMode() === 'runtime') {
    let refState = groundingRuntime.deserializeReferenceState(session.referenceState || {})
    if (capAssemblyGrounding?.requiredTools?.length) {
      refState = groundingRuntime.setTaskFrame(refState, capAssemblyGrounding)
      groundingTaskFrame = capAssemblyGrounding
    }
    const resolved = feishuGroundingAdapter.resolveUserPromptWithReferenceState(refState, effectivePrompt, {
      bindRefId: payload.bindRef,
    })
    refState = resolved.referenceState
    session.referenceState = groundingRuntime.serializeReferenceState(refState)
    if (resolved.needsClarification) {
      session.messages.push({ role: 'user', text: String(prompt || '').slice(0, 12000) })
      session.updatedAt = new Date().toISOString()
      saveAgentSessions(ensured.sessions.map(item => item.id === session.id ? session : item))
      emit({
        type: 'grounding-status',
        status: 'blocked',
        claims: [],
        sources: [],
        violations: [{ code: 'unbound_selection', message: '候选未绑定' }],
      })
      emit({ type: 'done', title: '需要澄清' })
      activeAgentRuns.delete(runId)
      return { text: resolved.clarification, runId, sessionId: session.id, toolCalls: 0 }
    }
    if (resolved.prompt) effectivePrompt = resolved.prompt
    groundingTaskFrame = refState.taskFrame || groundingTaskFrame
  }
  const dynamicContext = [
    dynamicContextPack.dynamicContext,
    writingPromptContext,
    capAssembly.dynamicCapabilityContext,
  ].filter(Boolean).join('\n\n')
  const sceneId = promptRouter.resolveScene({
    mode: ctxRole,
    tier,
    role: ctxRole,
    hasNoteContext: !!String(context || '').trim(),
    industry: s.industry,
    prompt,
  })
  const systemContent = buildSystemContent({
    scenePrompt: promptRouter.buildScenePrompt({ scene: sceneId, mode: ctxRole }),
    userPrompt: promptRouter.buildUserPrompt(s, ctxRole, {
      includeUserPrompt: memoryToggles?.collaborationPrefs !== false,
    }),
    skillPrompt: promptRouter.buildSkillPrompt(slashRefs),
    dynamicContext: '',
  })
  const rawMessages = buildChatMessages({
    systemContent,
    contextMessage: dynamicContext,
    history: sessionHistory.length ? sessionHistory : history,
    prompt: effectivePrompt,
    noteContext: context,
  })
  const fittedConversation = llmRuntime.fitConversation(rawMessages, policy.inputBudget)
  let apiMessages = fittedConversation.messages
  try {
    logger.systemPrompt('llm-system-prompt', '构建系统提示词', {
      model: modelProfile.model,
      agentId: session?.agentId || agentId || 'general',
      sessionId: session?.id || sessionId || '',
      skillRefs: slashRefs,
      systemContent,
      dynamicContext: String(dynamicContext || '').slice(0, 8000),
    }, { runId, scope: 'ai-generate' })
  } catch { /* ignore */ }
  const contextInfo = {
    usedTokens: fittedConversation.usedTokens,
    contextWindow: modelProfile.contextWindow,
    inputBudget: policy.inputBudget,
    omittedTurns: fittedConversation.omittedTurns,
    omittedMessages: fittedConversation.omittedMessages,
    model: modelProfile.model,
    label: modelProfile.label,
    requestedModel: routedModel.requestedModel,
    autoRouted: routedModel.autoRouted,
    autoReason: routedModel.autoReason,
    promptCache: promptCachePolicy.enabled,
    sectionUsage: dynamicContextPack.sectionUsage,
    sectionOmitted: dynamicContextPack.sectionOmitted,
    memoryPolicy: dynamicContextPack.memoryPolicy,
    contextPacket: {
      version: 1,
      mode: dynamicContextPack.memoryPolicy.mode || 'off',
      itemCount: contextItems.length,
      includedTypes: [...new Set(
        [
          ...lightPacket.items,
          ...workPacket.items,
        ].map(item => item.type)
      )],
      omitted: lightPacket.omitted + workPacket.omitted,
    },
  }
  session.messages.push({ role: 'user', text: String(prompt || '').slice(0, 12000) })
  if (grounding.active) {
    session.displayTitle = String(grounding.title || '').slice(0, 80)
    session.labels = Array.isArray(grounding.labels) ? grounding.labels.slice(0, 3) : []
    session.grounding = String(grounding.text || '').slice(0, 3000)
  }
  session.updatedAt = new Date().toISOString()
  saveAgentSessions(ensured.sessions.map(item => item.id === session.id ? session : item))
  stage('stage_prepare', '上下文准备完成', 'done', { contextInfo })

  const needsConnectorTools = tier !== 'chat' || slashRefs.length > 0
  const fileTools = needsConnectorTools
    ? buildActiveSourceFileTools(embedFn, {
      workspaceState: s.workspaceState || null,
      runMetrics: metrics,
      runId,
    })
    : null
  const sourceRoot = fileTools?.sourceRoot || getActiveSourceRoot()
  const processTools = needsConnectorTools && isToolSurfaceV1()
    ? agentProcessTools.buildProcessTools({
      runId,
      resolveCwd: () => sourceRoot,
    })
    : null
  const artifactTools = needsConnectorTools && isToolSurfaceV1()
    ? agentArtifactTools.buildArtifactTools({ runId })
    : null
  const teamRuntime = ensureAgentTeamRuntime()
  teamRuntime.manager.adoptRunningRun({
    runId,
    sessionId: session?.id || sessionId,
    abortController: controller,
    budget: session?.run?.budget || payload.budget || {},
    governanceEnvelope: {
      permissions: payload.permissions || session?.run?.permissions || {},
      orchestration: (payload.permissions || session?.run?.permissions || {}).orchestration || {},
    },
    meta: {
      expertId: session?.expertId || null,
      builderId: 'knowme-local',
    },
  })
  settleAdoptedRun = reason => teamRuntime.manager.completeAdoptedRun(runId, {
    terminal: 'failed',
    status: 'failed',
    ok: false,
    summary: String(reason || '').slice(0, 500),
    stopReason: String(reason || 'run_failed').slice(0, 200),
  })
  const orchestrationTools = needsConnectorTools && isToolSurfaceV1() && teamRuntime.enabled
    ? agentOrchestration.buildOrchestrationTools({
      runId,
      runManager: teamRuntime.manager,
      syncHandoff: async (payload) => {
        try {
          if (workbenchDaemon && typeof workbenchDaemon.syncHandoffArtifacts === 'function') {
            await workbenchDaemon.syncHandoffArtifacts(payload)
          }
        } catch { /* optional */ }
      },
    })
    : null
  // 临时工作区脚本沙箱（run_python / run_shell）：默认开启，破坏性/外联命令拦截并要求确认。
  const sandboxEnabled = needsConnectorTools && s.agentScriptsEnabled !== false
  const sandboxWorkdir = path.join(app.getPath('userData'), 'agent-sandbox', runId)
  const declaredRunPermissions = payload.permissions || session?.run?.permissions || {}
  const sandboxPermissions = agentSandbox.normalizeSandboxPermissions(
    declaredRunPermissions,
    { allowNetwork: s.agentScriptsAllowNetwork === true },
  )
  if (!session.run || typeof session.run !== 'object') session.run = {}
  const runPermissions = {
    ...declaredRunPermissions,
    ...sandboxPermissions,
    sandbox: sandboxPermissions,
  }
  session.run.permissions = runPermissions
  const sandboxTools = sandboxEnabled
    ? agentSandbox.buildSandboxTools({
      workdir: sandboxWorkdir,
      permissions: runPermissions,
    })
    : null
  const planTools = needsConnectorTools
    ? agentPlanTools.buildPlanTools({
      getSession: () => session,
      setSession: (next) => { session = next },
    })
    : null
  const webTools = needsConnectorTools ? agentWebTools.buildWebTools({ signal }) : null
  const skillTools = needsConnectorTools
    ? ensureCapabilityHub().buildSkillToolsForSession(session, sandboxPermissions)
    : null
  const stewardTools = session?.run?.role === 'steward'
    ? knowledgeStewardTools.buildKnowledgeStewardTools({
      userData: app.getPath('userData'),
      sources: kosSourcesCtx().sources || [],
    })
    : null
  const extraTools = mergeExtraTools(
    fileTools,
    processTools,
    artifactTools,
    orchestrationTools,
    sandboxTools,
    planTools,
    webTools,
    skillTools,
    stewardTools,
  )
  const sessionConnectorBindings = getSessionCapabilityBindings(session, ensureCapabilityHub().expertRuntime())
  const sessionExpertSnapshot = session?.expertId
    ? ensureCapabilityHub().expertRuntime().getSessionPersona(session.id, session.expertId)
    : null
  const userDataPath = app.getPath('userData')
  const resolvedSurface = needsConnectorTools
    ? await resolveToolSurfaceForRun({
      userData: userDataPath,
      runId,
      sessionId: session?.id || sessionId,
      fileAdapter: fileTools?.fileAdapter,
      processTools,
      artifactTools,
      orchestrationTools,
      extraTools,
      permissions: runPermissions,
      expertSnapshot: sessionExpertSnapshot?.ok ? sessionExpertSnapshot : null,
      allowedConnectorIds: sessionConnectorBindings.allowedConnectorIds,
      requiredTools: groundingTaskFrame?.requiredTools || [],
      signal,
      budget: session?.run?.budget || payload.budget || null,
      recordReceipt: receipt => teamRuntime.store.writeReceipt(
        runId,
        receipt.idempotencyKey || receipt.auditId || `receipt_${Date.now()}`,
        { result: receipt.envelope || receipt },
      ),
      connectorBuild: (cOpts) => connectorToolRuntime.buildConnectorToolSurface(userDataPath, {
        extraTools: cOpts.extraTools,
        allowedConnectorIds: sessionConnectorBindings.allowedConnectorIds,
        registry: cOpts.registry,
      }),
    })
    : {
      surface: agentTools.createToolSurface({
        extraDefinitions: extraTools?.definitions || [],
        handlers: extraTools?.handlers || {},
      }),
      close: async () => {},
      mode: 'minimal',
    }
  const toolSurface = resolvedSurface.surface
  const connectorRuntime = { close: resolvedSurface.close, mcpProjectionError: resolvedSurface.mcpProjectionError }
  const researchRoute = researchRouting.buildResearchRoute({
    prompt,
    toolRecords: typeof toolSurface.getToolRecords === 'function'
      ? toolSurface.getToolRecords()
      : toolSurface.getToolDefinitions(),
  })
  if (researchRoute.active) {
    apiMessages = llmRuntime.fitConversation(
      researchRouting.injectResearchContext(apiMessages, researchRoute.context),
      policy.inputBudget,
    ).messages
    const frames = [groundingTaskFrame, researchRoute.taskFrame].filter(Boolean)
    groundingTaskFrame = frames.length > 1
      ? groundingRuntime.mergeGroundingContracts(frames)
      : (frames[0] || null)
    if (groundingTaskFrame && resolveGroundingRuntimeMode() === 'runtime') {
      const refState = groundingRuntime.setTaskFrame(
        groundingRuntime.deserializeReferenceState(session.referenceState || {}),
        groundingTaskFrame,
      )
      session.referenceState = groundingRuntime.serializeReferenceState(refState)
    }
    contextInfo.research = {
      scope: researchRoute.intent.scope,
      mode: researchRoute.intent.mode,
      recencyDays: researchRoute.intent.recencyDays,
      sources: researchRoute.sources.map(source => source.toolName),
    }
  }
  const unavailableRequiredTools = [...new Set(groundingTaskFrame?.requiredTools || [])]
    .filter(toolName => !toolSurface.isAllowedTool(toolName))
  if (unavailableRequiredTools.length) {
    await connectorRuntime.close().catch(() => {})
    return fail(`所需工具不可用：${unavailableRequiredTools.join(', ')}。请启用对应连接器或安装能力后重试。`)
  }
  const toolExecutor = toolSurface.createToolExecutor({
    searchKnowledge: queryKnowledge,
    fabricSearch: queryKnowledge,
    kbQuery: kbQueryTool,
    kbGet: kbGetTool,
    signal,
  })
  const feishuIntent = feishuGrounding.detectFeishuIntent(prompt)

  if (resolveAgentExecutorMode() === 'kernel') {
    const suppressStreamForFeishuGuard = !!(
      feishuIntent &&
      feishuIntent.mentioned &&
      (feishuIntent.needsSearch || feishuIntent.needsContentRead || feishuIntent.asksMinutes)
    )
    const makeOrchestrationPort = currentRunId => ({
      bindOutputEmitter: (bridge) => {
        if (currentRunId === runId) agentRuntimeOutputBridges.set(runId, bridge)
      },
      cancelAll: ({ reason = 'parent_cancelled' } = {}) => (
        teamRuntime.manager.cancelAllChildren(currentRunId, reason)
      ),
      cancelCascade: reason => teamRuntime.manager.cancelAllChildren(currentRunId, reason),
      cancelAllSubRuns: ({ reason = 'parent_cancelled' } = {}) => (
        teamRuntime.manager.cancelAllChildren(currentRunId, reason)
      ),
      cancelSubRun: subRunId => teamRuntime.manager.cancelRun(subRunId, 'parent_cancelled'),
      cancelProcessesForRun: agentProcessTools.cancelProcessesForRun,
    })

    agentRuntimePortFactories.set(runId, async childCtx => {
      const childRunId = String(childCtx.runId)
      const childSession = agentSessions.createSession(session.agentId || 'general', 1, {
        expertId: childCtx.expertId,
        ephemeral: true,
        role: 'general',
        goal: String(childCtx.prompt || '').slice(0, 2000),
      })
      childSession.run.permissions = runPermissions
      const handoffText = JSON.stringify({
        task: String(childCtx.prompt || ''),
        handoff: childCtx.handoff || null,
        parentRunId: childCtx.parentRunId,
        expertId: childCtx.expertId || null,
      })
      const childApiMessages = [
        ...apiMessages.filter(message => message?.role === 'system').slice(0, 1),
        {
          role: 'system',
          content: `你是隔离执行的子 Agent（expert=${childCtx.expertId || 'general'}）。只处理结构化交接任务，不得假设可访问父会话历史；输出必须附可核验的 Artifact/Evidence 引用。`,
        },
        { role: 'user', content: handoffText },
      ]
      const childProcessTools = agentProcessTools.buildProcessTools({
        runId: childRunId,
        resolveCwd: () => sourceRoot,
      })
      const childArtifactTools = agentArtifactTools.buildArtifactTools({ runId: childRunId })
      const childOrchestrationTools = agentOrchestration.buildOrchestrationTools({
        runId: childRunId,
        runManager: teamRuntime.manager,
        syncHandoff: orchestrationTools?.syncHandoff,
      })
      const childSandboxTools = sandboxEnabled
        ? agentSandbox.buildSandboxTools({
          workdir: path.join(app.getPath('userData'), 'agent-sandbox', childRunId),
          permissions: sandboxPermissions,
        })
        : null
      const childPlanTools = agentPlanTools.buildPlanTools({
        getSession: () => childSession,
        setSession: next => Object.assign(childSession, next),
      })
      const childWebTools = agentWebTools.buildWebTools({ signal: childCtx.signal })
      const childSkillTools = ensureCapabilityHub().buildSkillToolsForSession(childSession, sandboxPermissions)
      const childExtraTools = mergeExtraTools(
        fileTools,
        childProcessTools,
        childArtifactTools,
        childOrchestrationTools,
        childSandboxTools,
        childPlanTools,
        childWebTools,
        childSkillTools,
      )
      const childBindings = getSessionCapabilityBindings(childSession, ensureCapabilityHub().expertRuntime())
      const childExpertSnapshot = childCtx.expertId
        ? ensureCapabilityHub().expertRuntime().loadExpert(childCtx.expertId)
        : null
      const childResolvedSurface = await resolveToolSurfaceForRun({
        userData: userDataPath,
        runId: childRunId,
        parentRunId: childCtx.parentRunId,
        subRunId: childRunId,
        sessionId: childSession.id,
        fileAdapter: fileTools?.fileAdapter,
        processTools: childProcessTools,
        artifactTools: childArtifactTools,
        orchestrationTools: childOrchestrationTools,
        extraTools: childExtraTools,
        permissions: runPermissions,
        expertSnapshot: childExpertSnapshot?.ok ? childExpertSnapshot : null,
        allowedConnectorIds: childBindings.allowedConnectorIds,
        signal: childCtx.signal,
        recordReceipt: receipt => teamRuntime.store.writeReceipt(
          childRunId,
          receipt.idempotencyKey || receipt.auditId || `receipt_${Date.now()}`,
          { result: receipt.envelope || receipt },
        ),
        connectorBuild: cOpts => connectorToolRuntime.buildConnectorToolSurface(userDataPath, {
          extraTools: cOpts.extraTools,
          allowedConnectorIds: childBindings.allowedConnectorIds,
          registry: cOpts.registry,
        }),
      })
      const childPorts = buildProductionRunPorts({
        settings: s,
        signal: childCtx.signal,
        url,
        runId: childRunId,
        parentRunId: childCtx.parentRunId,
        subRunId: childRunId,
        routedModel,
        policy,
        promptCachePolicy,
        tokenCalKey,
        toolSurface: childResolvedSurface.surface,
        toolExecutor: childResolvedSurface.surface.createToolExecutor({
          searchKnowledge: queryKnowledge,
          fabricSearch: queryKnowledge,
          kbQuery: kbQueryTool,
          kbGet: kbGetTool,
          signal: childCtx.signal,
        }),
        tier: childCtx.tier || 'agent',
        apiMessages: childApiMessages,
        session: childSession,
        toolsEnabled: modelProfile.supportsTools !== false,
        requestAgentCompletion,
        onStreamChunk: null,
        runStartedAt: Date.now(),
        effectivePersonalization: { applied: [], omitted: [] },
        ctxBundle: { contextInfo: { isolatedSubRun: true }, taskFrame: null },
        loadAgentSessions,
        saveAgentSessions,
        productMemoryCapture: () => {},
        memoryDir: MEMORY_DIR,
        normalizeAssistantOutput,
        orchestration: makeOrchestrationPort(childRunId),
        governancePolicy: childResolvedSurface.governancePolicy,
        budget: teamRuntime.manager.getRun(childRunId).run?.budget || null,
        persistRunCheckpoint: checkpoint => teamRuntime.manager.saveCheckpoint(childRunId, 'latest', checkpoint),
        cancelProcessesForRun: agentProcessTools.cancelProcessesForRun,
        recordReceipt: receipt => teamRuntime.store.writeReceipt(
          childRunId,
          receipt.idempotencyKey || receipt.auditId || `receipt_${Date.now()}`,
          { result: receipt.envelope || receipt },
        ),
      })
      childPorts._dispose = childResolvedSurface.close
      return childPorts
    })

    const ports = buildProductionRunPorts({
      settings: s,
      signal,
      url,
      runId,
      routedModel,
      policy,
      promptCachePolicy,
      tokenCalKey,
      toolSurface,
      toolExecutor,
      tier,
      apiMessages,
      session,
      toolsEnabled: tier !== 'chat' && modelProfile.supportsTools !== false,
      requestAgentCompletion,
      onStreamChunk: null,
      runStartedAt,
      effectivePersonalization,
      ctxBundle: { contextInfo, taskFrame: groundingTaskFrame },
      loadAgentSessions,
      saveAgentSessions,
      productMemoryCapture: productMemory.capture,
      memoryDir: MEMORY_DIR,
      normalizeAssistantOutput,
      orchestration: makeOrchestrationPort(runId),
      governancePolicy: resolvedSurface.governancePolicy,
      budget: session?.run?.budget || payload.budget || null,
      persistRunCheckpoint: checkpoint => teamRuntime.manager.saveCheckpoint(runId, 'latest', checkpoint),
      cancelProcessesForRun: agentProcessTools.cancelProcessesForRun,
      recordReceipt: receipt => teamRuntime.store.writeReceipt(
        runId,
        receipt.idempotencyKey || receipt.auditId || `receipt_${Date.now()}`,
        { result: receipt.envelope || receipt },
      ),
      writingArtifactHook: (sess, fullText) => {
        if (ctxRole === 'writing' && writingWorkflow.shouldCreateWritingArtifact(fullText, writingTask)) {
          return agentRun.addArtifact(sess, writingWorkflow.buildWritingArtifact(fullText, writingTask))
        }
        return sess
      },
      persistTokenCalibration: (runMetrics, calKey) => {
        const calNow = llmUsage.getCalibration(calKey)
        if (calNow.samples > tokenCalBefore.samples) {
          try {
            const latest = loadSettings()
            saveSettings_({
              ...latest,
              tokenCalibrations: llmUsage.exportCalibrations(),
            })
          } catch { /* ignore */ }
        }
      },
      postProcessHooks: async ({ fullText, toolMessages: toolMsgs, session: sess }) => {
        if (resolveGroundingRuntimeMode() === 'legacy') {
          const feishuGroundingContext = await getFeishuGroundingContext()
          const feishuHint = feishuGrounding.buildFeishuGroundingHint(prompt, toolMsgs, fullText, {
            ...feishuGroundingContext,
            priorFeishuFacts: hasPriorFeishuFacts(sess),
          })
          if (feishuHint) return feishuHint
        } else {
          const feishuGroundingContext = await getFeishuGroundingContext()
          const feishuHint = feishuGroundingAdapter.buildLegacyPostProcessHint(prompt, toolMsgs, fullText, {
            ...feishuGroundingContext,
            priorFeishuFacts: hasPriorFeishuFacts(sess),
          })
          if (feishuHint) return feishuHint
        }
        const planPartial = agentVerify.buildPartialFinalizeNote(
          agentVerify.evaluatePlanCompletion(sess?.run?.plan, {
            canExpand: false,
            budgetExhausted: true,
          }),
        )
        if (planPartial && !String(fullText).includes('计划尚未全部完成')) {
          return `${String(fullText || '').trim()}\n\n---\n${planPartial}`.trim()
        }
        return fullText
      },
    })
    try {
      const kernelResult = await AgentRunExecutor.run(payload, ports, emit)
      const failed = Boolean(kernelResult.error && (kernelResult.terminal === 'ERROR' || kernelResult.terminal === 'FAILED'))
      settleAdoptedRun = null
      teamRuntime.manager.completeAdoptedRun(runId, {
        terminal: kernelResult.cancelled ? 'cancelled' : (failed ? 'failed' : 'completed'),
        status: kernelResult.cancelled ? 'cancelled' : (failed ? 'failed' : 'completed'),
        ok: !failed && !kernelResult.cancelled,
        cancelled: kernelResult.cancelled === true,
        summary: kernelResult.text || String(kernelResult.error || ''),
        report: kernelResult.report,
        metrics: kernelResult.metrics,
        stopReason: (failed || kernelResult.cancelled)
          ? String(kernelResult.error || kernelResult.terminal || '')
          : null,
      })
      if (kernelResult.cancelled) {
        return {
          error: String(kernelResult.error || '请求已取消'),
          cancelled: true,
          runId,
        }
      }
      if (failed) {
        return { error: String(kernelResult.error), runId }
      }
      const finalSession = ports._state?.session || session
      return {
        streamed: kernelResult.streamed,
        runId,
        sessionId: finalSession.id,
        artifacts: finalSession?.run?.artifacts || [],
        toolCalls: kernelResult.metrics?.toolCalls || 0,
        compacted: false,
        metrics: kernelResult.metrics,
        protocolVersion: kernelResult.protocolVersion || null,
        answerHash: kernelResult.answerHash || null,
        terminal: kernelResult.terminal || null,
        personalization: {
          applied: effectivePersonalization.applied.map(item => ({
            id: item.id,
            kind: item.kind,
            text: item.text,
          })),
          omitted: effectivePersonalization.omitted,
        },
      }
    } catch (err) {
      settleAdoptedRun = null
      teamRuntime.manager.completeAdoptedRun(runId, {
        terminal: 'failed',
        status: 'failed',
        ok: false,
        error: String(err?.message || err),
        summary: String(err?.message || err),
        stopReason: String(err?.message || err || 'run_failed').slice(0, 200),
      })
      return {
        error: String(err?.message || err || '生成失败'),
        runId,
        protocolVersion: 2,
      }
    } finally {
      await teamRuntime.manager.cancelAllChildren(runId, 'parent_terminal').catch(() => {})
      agentRuntimePortFactories.delete(runId)
      agentRuntimeOutputBridges.delete(runId)
      activeAgentRuns.delete(runId)
      try { await connectorRuntime.close() } catch { /* ignore */ }
    }
  }

  // @deprecated legacy-ai-generate-loop — 回滚：KNOWME_AGENT_EXECUTOR=legacy
  let budget = llmUsage.adaptiveBudget(tier)
  let maxRounds = budget.maxRounds
  let maxToolCalls = budget.maxToolCalls
  let budgetExpansions = 0
  let lastPlanCheckpointAt = 0
  const checkpointSession = (force = false) => {
    const now = Date.now()
    if (!force && now - lastPlanCheckpointAt < 800) return
    lastPlanCheckpointAt = now
    try {
      saveAgentSessions(loadAgentSessions().map(item => item.id === session.id ? session : item))
      const plan = session?.run?.plan
      if (plan?.items?.length) {
        emit({
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
    })
    return true
  }
  let toolCallCount = 0
  metrics.usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0, source: 'estimate' }
  let toolsEnabled = tier !== 'chat' && modelProfile.supportsTools !== false
  let fullText = ''
  let lastModelText = ''
  let streamed = false
  const suppressStreamForFeishuGuard = !!(
    feishuIntent &&
    feishuIntent.mentioned &&
    (feishuIntent.needsSearch || feishuIntent.needsContentRead || feishuIntent.asksMinutes)
  )
  const loopState = agentLoop.createLoopState()
  let repeatedToolCall = false
  let recoveryUsed = 0
  const MAX_RECOVERY_ROUNDS = 2
  let onSnapshot = () => {}

  try {
  const finalizeResponse = async reason => {
    if (loopState.finalizationUsed) return { error: '最终答复收敛请求已使用' }
    loopState.finalizationUsed = true
    const title = reason === 'repeated'
      ? '正在整理已有结果…'
      : '正在整理最终答复…'
    stage('stage_generate', title)
    const finalMessages = apiMessages.concat({
      role: 'user',
      content: '请基于当前对话和已经返回的工具结果，直接给出最终答复。不要再调用工具，不要解释执行预算或内部流程；如果信息不足，请明确说明缺少什么。',
    })
    const finalOutboundMessages = llmRuntime.applyCacheControlMessages(finalMessages, promptCachePolicy)
    const completion = await requestAgentCompletion({
      url,
      settings: s,
      signal,
      body: {
        model: routedModel.model || 'gpt-4o-mini',
        messages: finalOutboundMessages,
        [policy.parameter]: Math.min(policy.maxOutput, 2400),
        temperature: policy.temperature,
        stream: true,
      },
      onSnapshot,
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
    if (signal.aborted) return cancelled()
    metrics.rounds++
    const roundTitle = round === 1 ? '正在等待模型响应…' : `正在继续生成（第 ${round} 轮）…`
    stage('stage_generate', roundTitle)
    const roundStartedAt = Date.now()
    const waitTicker = setInterval(() => {
      const elapsedSec = Math.max(1, Math.floor((Date.now() - roundStartedAt) / 1000))
      stage('stage_generate', roundTitle, 'pending', { summary: `已等待 ${elapsedSec}s` })
    }, 1000)
    const requestBody = {
      model: routedModel.model || 'gpt-4o-mini',
      messages: llmRuntime.applyCacheControlMessages(apiMessages, promptCachePolicy),
      [policy.parameter]: policy.outputTokens,
      temperature: policy.temperature,
      stream: true,
      ...(toolsEnabled ? { tools: toolSurface.getToolDefinitions(), tool_choice: 'auto' } : {}),
    }
    let reasoningSeen = false
    let previousVisibleText = ''
    onSnapshot = snapshot => {
      if (snapshot.reasoningStarted && !reasoningSeen) {
        reasoningSeen = true
        stage('stage_generate', '正在分析并规划回答…')
      }
      if (snapshot.content) {
        fullText = snapshot.content
        lastModelText = snapshot.content
        const visibleText = normalizeAssistantOutput(snapshot.content)
        const delta = visibleText.startsWith(previousVisibleText)
          ? visibleText.slice(previousVisibleText.length)
          : visibleText
        previousVisibleText = visibleText
        if (metrics.firstTokenMs == null) metrics.firstTokenMs = Date.now() - runStartedAt
        if (!suppressStreamForFeishuGuard) {
          streamed = true
          if (!webContents.isDestroyed()) webContents.send('ai-stream-chunk', { text: visibleText, delta, runId })
          emit({ type: 'content', text: visibleText, delta })
        }
      }
    }
    try {
      logger.llm('llm-request', `请求模型（第 ${round} 轮）`, {
        model: requestBody.model,
        endpoint: url.host + url.pathname,
        round,
        tier,
        messages: apiMessages.length,
        toolsEnabled,
        outputTokens: policy.outputTokens,
        temperature: policy.temperature,
      }, { runId, scope: 'ai-generate' })
    } catch { /* ignore */ }
    let completion
    try {
      completion = await requestAgentCompletion({ url, settings: s, body: requestBody, onSnapshot, signal })
      if (completion.error && toolsEnabled && [400, 404, 422].includes(completion.status)) {
        toolsEnabled = false
        stage('stage_compatibility', '当前模型不支持工具，已切换普通对话', 'done', {
          fallback: true,
          summary: String(completion.error).slice(0, 300),
        })
        completion = await requestAgentCompletion({
          url,
          settings: s,
          body: { ...requestBody, tools: undefined, tool_choice: undefined },
          onSnapshot,
          signal,
        })
      }
    } finally {
      clearInterval(waitTicker)
    }
    if (completion.cancelled || signal.aborted) return cancelled()
    if (completion.error) {
      try {
        logger.llm('llm-error', `模型请求失败（第 ${round} 轮）`, {
          model: requestBody.model,
          status: completion.status,
          error: String(completion.error).slice(0, 800),
        }, { runId, scope: 'ai-generate', level: 'error', durationMs: Date.now() - roundStartedAt })
      } catch { /* ignore */ }
      return fail(completion.error)
    }

    const snapshot = completion.snapshot
    streamed = streamed || completion.streamed
    metrics.usage = llmUsage.accumulateUsage(metrics.usage, snapshot?.usage)
    try {
      const toolCallsThisRound = Array.isArray(snapshot?.toolCalls) ? snapshot.toolCalls.length : 0
      logger.llm('llm-response', `模型响应（第 ${round} 轮）`, {
        model: requestBody.model,
        usage: snapshot?.usage || null,
        toolCalls: toolCallsThisRound,
        contentChars: (snapshot?.content || '').length,
        streamed: !!completion.streamed,
      }, { runId, scope: 'ai-generate', durationMs: Date.now() - roundStartedAt })
    } catch { /* ignore */ }
    const providerPromptTokens = Number(snapshot?.usage?.prompt_tokens ?? snapshot?.usage?.promptTokens)
    if (Number.isFinite(providerPromptTokens) && providerPromptTokens > 0) {
      const estimatedPrompt = llmRuntime.estimateTokens(JSON.stringify(requestBody.messages))
      const cal = llmUsage.learnCalibration(tokenCalKey, estimatedPrompt, providerPromptTokens)
      metrics.tokenCalibFactor = cal.factor
      metrics.tokenCalibSamples = cal.samples
    }
    const calls = Array.isArray(snapshot?.toolCalls) ? snapshot.toolCalls : []
    if (!calls.length) {
      fullText = snapshot?.content || fullText
      const planEval = agentVerify.evaluatePlanCompletion(session?.run?.plan, {
        canExpand: false,
        budgetExhausted: false,
      })
      if (planEval.action === 'continue' && toolsEnabled && !repeatedToolCall) {
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
              '写入文件仍须走 artifact 审批，不可声称已落盘。',
              checklist,
            ].filter(Boolean).join('\n'),
          })
          stage('stage_generate', `计划未完成，继续执行（剩余 ${planEval.remaining} 项）…`, 'pending')
          fullText = ''
          continue
        }
      }
      if (!fullText.trim()) return fail('模型返回空响应')
      const exhaustedNote = agentVerify.buildPartialFinalizeNote(
        agentVerify.evaluatePlanCompletion(session?.run?.plan, {
          canExpand: false,
          budgetExhausted: true,
        }),
      )
      if (exhaustedNote) {
        fullText = `${fullText.trim()}\n\n---\n${exhaustedNote}`
      }
      stage('stage_generate', '回答生成完成', 'done')
      checkpointSession(true)
      break
    }

    if (toolCallCount + calls.length > maxToolCalls) {
      if (tryExpandBudget('tool_call_cap') && toolCallCount + calls.length <= maxToolCalls) {
        // expanded enough to execute this batch — fall through
      } else {
        const finalized = await finalizeResponse('budget')
        if (finalized.error && !lastModelText.trim()) return fail(finalized.error)
        if (!fullText.trim()) fullText = lastModelText
        const partialNote = agentVerify.buildPartialFinalizeNote(
          agentVerify.evaluatePlanCompletion(session?.run?.plan, {
            canExpand: false,
            budgetExhausted: true,
          }),
        )
        if (partialNote) {
          fullText = `${String(fullText || '').trim()}\n\n---\n${partialNote}`.trim()
        }
        checkpointSession(true)
        break
      }
    }
    apiMessages.push({
      role: 'assistant',
      content: snapshot.content || null,
      tool_calls: calls.map(call => ({
        id: call.id || `call_${round}_${toolCallCount + 1}`,
        type: 'function',
        function: { name: call.name, arguments: call.arguments || '{}' },
      })),
    })
    const roundToolMessages = []

    for (const [index, call] of calls.entries()) {
      if (signal.aborted) return cancelled()
      toolCallCount++
      metrics.toolCalls = toolCallCount
      const callId = call.id || `call_${round}_${index + 1}`
      const toolName = call.name || 'unknown_tool'
      const startedAt = Date.now()
      const cacheKey = agentLoop.toolCallKey(toolName, call.arguments)
      const validation = toolSurface.validateToolCall(toolName, call.arguments)
      const argsSummary = validation.ok ? agentTools.summarizeToolArgs(toolName, validation.args) : ''
      const title = toolName === 'search_knowledge' ? '搜索知识库'
        : toolName === 'search_web' ? '搜索网络'
        : toolName === 'fetch_web_page' ? '读取网页'
        : toolName.startsWith('feishu.') ? `飞书：${toolName.replace(/^feishu\./, '')}`
        : `调用工具：${toolName}`
      const runningEvent = {
        id: `tool_${callId}`,
        type: 'tool.started',
        kind: 'tool',
        title,
        status: 'pending',
        summary: argsSummary,
        toolCallId: callId,
        toolName,
      }
      upsertTrace(runningEvent)
      emit(runningEvent)
      const cached = loopState.callCache.get(cacheKey)
      if (cached) repeatedToolCall = true
      const TOOL_EXEC_TIMEOUT_MS = 45000
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
          ...(Number.isFinite(patch.durationMs) ? { durationMs: patch.durationMs } : {}),
        }
        upsertTrace(event)
        emit(event)
      }
      // 单次执行：带等待心跳、超时杀进程与取消守卫。可被 planRetry 多次调用（网络/超时类）。
      const executeToolOnce = (attemptLabel = '') => {
        let waitTicker = 0
        let timeoutTimer = 0
        let abortListener = null
        let settled = false
        const clearToolGuards = () => {
          if (waitTicker) clearInterval(waitTicker)
          if (timeoutTimer) clearTimeout(timeoutTimer)
          if (abortListener) signal.removeEventListener('abort', abortListener)
        }
        waitTicker = setInterval(() => {
          if (settled || signal.aborted) return
          const elapsedSec = Math.max(1, Math.floor((Date.now() - startedAt) / 1000))
          const base = argsSummary ? `${argsSummary} · 已等待 ${elapsedSec}s` : `已等待 ${elapsedSec}s`
          const summary = attemptLabel ? `${base} · ${attemptLabel}` : base
          emitToolProgress({ type: 'tool.started', status: 'pending', summary })
        }, 1000)
        return Promise.race([
          toolExecutor.executeToolCall({ name: toolName, arguments: call.arguments }),
          new Promise(resolve => {
            timeoutTimer = setTimeout(() => {
              settled = true
              try { agentProcessTools.cancelProcessesForRun(runId) } catch { /* ignore */ }
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
          new Promise(resolve => {
            if (!signal) return
            const onAbort = () => {
              settled = true
              try { agentProcessTools.cancelProcessesForRun(runId) } catch { /* ignore */ }
              resolve({
                ok: false,
                code: 'cancelled',
                message: '工具执行已取消',
                text: '工具执行已取消',
                preview: '工具执行已取消',
              })
            }
            if (signal.aborted) { onAbort(); return }
            abortListener = onAbort
            signal.addEventListener('abort', abortListener, { once: true })
          }),
        ]).then(r => { settled = true; clearToolGuards(); return r })
      }
      let result
      if (cached) {
        result = cached
      } else {
        // 可恢复错误（网络/超时）有限次指数退避重试；其余错误交给反思轮。
        let attempt = 0
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
      const durationMs = Date.now() - startedAt
      const needsPermission = agentSandbox.parseSandboxPermissionNeed(result)
      const resultEvent = {
        id: `tool_${callId}`,
        type: result.ok ? 'tool.completed' : 'tool.failed',
        kind: 'tool',
        title,
        status: result.ok ? 'done' : 'error',
        summary: buildToolDisplaySummary(result, { ok: result.ok !== false }),
        sources: Array.isArray(result.sources) ? result.sources : [],
        toolCallId: callId,
        toolName,
        durationMs,
        needsPermission: needsPermission || undefined,
        draftId: result.draftId || result.draft?.id || null,
        requiresApproval: Boolean(result.requiresApproval),
        artifactRefs: Array.isArray(result.artifactRefs) ? result.artifactRefs : [],
      }
      if (toolName === 'semantic_search' && result?.meta && typeof result.meta === 'object') {
        metrics.semanticCandidateCount = Number(result.meta.candidateCount || 0)
        metrics.semanticClusterCount = Number(result.meta.clusterCount || 0)
        metrics.semanticDedupeDropped = Number(result.meta.droppedDedup || 0)
        metrics.semanticPerFileDropped = Number(result.meta.droppedPerFile || 0)
      }
      upsertTrace(resultEvent)
      emit(resultEvent)
      try {
        const isMcp = toolName.includes('.') && !toolName.startsWith('feishu.')
          ? true
          : (call && call._source === 'mcp')
        const isFeishu = toolName.startsWith('feishu.')
        const cat = isMcp ? 'mcp' : (isFeishu ? 'api' : 'operation')
        logger[isMcp ? 'mcp' : (isFeishu ? 'api' : 'operation')](
          `tool-${result.ok ? 'ok' : 'fail'}`,
          `${result.ok ? '工具完成' : '工具失败'}：${toolName}`,
          {
            tool: toolName,
            category: cat,
            code: result.code || '',
            args: validation.ok ? validation.args : null,
            preview: String(result.preview || result.text || '').slice(0, 600),
          },
          { runId, scope: 'ai-tool', level: result.ok ? 'info' : 'warn', durationMs },
        )
      } catch { /* ignore */ }
      toolMessages.push({
        role: 'tool',
        text: result.text,
        toolCallId: callId,
        toolName,
        status: result.ok ? 'done' : 'error',
        durationMs,
        args: validation.ok ? validation.args : null,
        // Preserve the authoritative missing-scope signal for just-in-time auth grounding.
        code: result.code,
        missingScopes: Array.isArray(result.missingScopes) ? result.missingScopes : undefined,
      })
      roundToolMessages.push({
        text: result.text,
        toolName,
        code: result.code,
        status: result.ok ? 'done' : 'error',
        args: validation.ok ? validation.args : null,
      })
      const modelToolText = llmRuntime.fitText(result.text, 6000, '\n…（工具结果已压缩）…\n')
      apiMessages.push({ role: 'tool', tool_call_id: callId, content: modelToolText })
      session = agentRun.upsertStep(session, resultEvent)
      if (result.ok) session = agentRun.recordTool(session, toolName)
    }

    const allRoundToolsErrored = roundToolMessages.length > 0 &&
      roundToolMessages.every(item => item.status === 'error')

    // 反思轮：本轮工具全败但错误可恢复时，注入反思提示并继续循环，
    // 让模型 Reason→Act→Observe→Reflect（修正参数 / 换工具 / 如实说明），
    // 而不是一失败就结束。预算受 MAX_RECOVERY_ROUNDS 与重复调用收敛双重保护。
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
      recoveryUsed += 1
      metrics.recoveryRounds = recoveryUsed
      const reflectionNote = agentRecovery.buildReflectionNote(roundToolMessages)
      if (reflectionNote) {
        apiMessages.push({ role: 'user', content: reflectionNote })
      }
      stage('stage_generate', '正在反思工具失败并尝试自我修正…', 'pending', {
        summary: `第 ${recoveryUsed} 次自我修正`,
      })
      fullText = ''
      continue
    }

    const roundMissingHint = buildMissingResourceHint(roundToolMessages)
    if (roundMissingHint && allRoundToolsErrored) {
      fullText = roundMissingHint
      stage('stage_generate', '已返回缺失资源提示', 'done', {
        fallback: true,
        summary: '工具未找到目标资源，已提示用户检查路径与产物',
      })
      break
    }
    const roundToolFailureHint = buildToolFailureHint(roundToolMessages)
    if (
      roundToolFailureHint &&
      roundToolMessages.length > 0 &&
      roundToolMessages.every(item => item.status === 'error')
    ) {
      fullText = roundToolFailureHint
      stage('stage_generate', '已返回工具失败提示', 'done', {
        fallback: true,
        summary: '工具全部失败，已直接返回纠错指引',
      })
      break
    }

    checkpointSession()
    // 仅在超预算时再压缩，尽量保持前缀稳定，提高 provider 端提示缓存命中。
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
      const planEval = agentVerify.evaluatePlanCompletion(session?.run?.plan, {
        canExpand: true,
        budgetExhausted: true,
      })
      if (planEval.action === 'expand' && tryExpandBudget('plan_incomplete')) {
        fullText = ''
        continue
      }
      const finalized = await finalizeResponse(repeatedToolCall ? 'repeated' : 'budget')
      if (finalized.error && !lastModelText.trim()) return fail(finalized.error)
      if (!fullText.trim()) fullText = lastModelText
      const partialNote = agentVerify.buildPartialFinalizeNote(
        agentVerify.evaluatePlanCompletion(session?.run?.plan, {
          canExpand: false,
          budgetExhausted: true,
        }),
      )
      if (partialNote) {
        fullText = `${String(fullText || '').trim()}\n\n---\n${partialNote}`.trim()
      }
      checkpointSession(true)
      break
    }
    fullText = ''
  }

  if (!fullText.trim()) {
    const missingHint = buildMissingResourceHint(toolMessages)
    if (missingHint) {
      fullText = missingHint
      stage('stage_generate', '已返回缺失资源提示', 'done', {
        fallback: true,
        summary: '工具未找到目标资源，已提示用户检查路径与产物',
      })
    } else {
      const toolFailureHint = buildToolFailureHint(toolMessages)
      if (toolFailureHint) {
        fullText = toolFailureHint
        stage('stage_generate', '已返回工具失败提示', 'done', {
          fallback: true,
          summary: '工具失败，已提示用户修正授权或参数',
        })
      } else {
        return fail('模型未能生成可交付答复，请重试')
      }
    }
  }
  const feishuGroundingContext = await getFeishuGroundingContext()
  const feishuHint = feishuGrounding.buildFeishuGroundingHint(prompt, toolMessages, fullText, {
    ...feishuGroundingContext,
    priorFeishuFacts: hasPriorFeishuFacts(session),
  })
  if (feishuHint) {
    fullText = feishuHint
    stage('stage_generate', '已返回飞书证据校验提示', 'done', {
      fallback: true,
      summary: '缺少飞书读取证据，已阻止无依据结论',
    })
  }
  const planPartial = agentVerify.buildPartialFinalizeNote(
    agentVerify.evaluatePlanCompletion(session?.run?.plan, {
      canExpand: false,
      budgetExhausted: true,
    }),
  )
  if (planPartial && !String(fullText).includes('计划尚未全部完成')) {
    fullText = `${String(fullText || '').trim()}\n\n---\n${planPartial}`.trim()
  }
  fullText = normalizeAssistantOutput(fullText)
  if (ctxRole === 'writing' && writingWorkflow.shouldCreateWritingArtifact(fullText, writingTask)) {
    session = agentRun.addArtifact(session, writingWorkflow.buildWritingArtifact(fullText, writingTask))
  }
  for (const item of trace) session = agentRun.upsertStep(session, item)
  session.messages.push(...toolMessages, {
    role: 'assistant',
    text: fullText.slice(0, 12000),
    trace,
  })
  session.updatedAt = new Date().toISOString()
  const compacted = agentSessions.compactSession(session).session
  saveAgentSessions(loadAgentSessions().map(item => item.id === session.id ? compacted : item))
  try {
    const plan = compacted?.run?.plan
    if (plan?.items?.length) {
      emit({
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
  productMemory.capture(MEMORY_DIR, {
    kind: 'telemetry',
    summary: '完成一次 AI 对话',
    meta: { action: 'ai-generate', toolCalls: toolCallCount },
  })
  metrics.toolCalls = toolCallCount
  const estimatedContextTokens = llmUsage.applyCalibration(
    llmRuntime.estimateTokens(JSON.stringify(apiMessages)),
    tokenCalKey,
  )
  const calNow = llmUsage.getCalibration(tokenCalKey)
  metrics.tokenCalibFactor = calNow.factor
  metrics.tokenCalibSamples = calNow.samples
  if (calNow.samples > tokenCalBefore.samples) {
    try {
      const latest = loadSettings()
      saveSettings_({
        ...latest,
        tokenCalibrations: llmUsage.exportCalibrations(),
      })
    } catch { /* ignore calibration persistence errors */ }
  }
  metrics.usage = llmUsage.reconcileUsage(estimatedContextTokens, metrics.usage?.source === 'provider' ? metrics.usage : null)
  metrics.contextTokens = metrics.usage.source === 'provider' ? metrics.usage.promptTokens : estimatedContextTokens
  metrics.totalMs = Date.now() - runStartedAt
  emit({ type: 'done', title: '执行完成', toolCalls: toolCallCount, metrics })
  return {
    text: fullText,
    streamed,
    runId,
    sessionId: session.id,
    artifacts: compacted?.run?.artifacts || [],
    toolCalls: toolCallCount,
    compacted: compacted.summary !== session.summary,
    metrics,
    personalization: {
      applied: effectivePersonalization.applied.map(item => ({
        id: item.id,
        kind: item.kind,
        text: item.text,
      })),
      omitted: effectivePersonalization.omitted,
    },
  }
  } finally {
    activeAgentRuns.delete(runId)
    try { await connectorRuntime.close() } catch { /* ignore */ }
  }
  } catch (err) {
    try {
      logger.error(
        'system',
        'ai-generate-unhandled',
        String(err?.message || err || '').slice(0, 300),
        { runId, stack: String(err?.stack || '').slice(0, 1500) },
      )
    } catch { /* logging must not mask original failure */ }
    return fail(err)
  }
  })
}

module.exports = { registerAiGenerateIpc }
