'use strict'

/**
 * 生成前半段：校验 API、路由模型、组上下文与 apiMessages。
 * 不装配工具面、不跑 AgentRunExecutor。
 */

const L = require('./agent-generate-libs')

/** 成功返回 prepared；失败返回 `{ early }`（已走 env.fail）。 */
async function prepareAgentGenerate(env) {
  const { app, path, promptRouter, buildSystemContent, buildChatMessages, productKnowledge, productMemory, conversationGrounding, agentSessions, agentRun, groundingRuntime, feishuGroundingAdapter, llmRuntime, llmModelCatalog, llmUsage, knowledgeOs, fabricRetrieval, chatIntent, contextCache, contextOrchestrator, contextPacketLib, writingWorkflow, buildTemporalAnchorContext, logger, resolveGroundingRuntimeMode } = L
  const { loadSettings, ensureAgentSession, saveAgentSessions, buildFabricCtx, ensureFabricSeeded, ensureCapabilityHub, readNote, buildEmbedFn, normalizeChatEndpoint, resolveActiveProvider, KNOWLEDGE_DIR, MEMORY_DIR, loadSourcesStore, activeAgentRuns } = env.deps
  const { payload, runId, stage, emit, metrics, signal } = env
  const fail = (error) => ({ early: env.fail(error) })
  const cancelled = () => fail('请求已取消')
  const {
    prompt, displayPrompt, context, history, noteId, category, skillRefs, taskId: rawTaskId,
    sessionId, agentId, contentGrounding, memoryToggles, role: payloadRole, expertId, surface, taskRef,
  } = payload

  stage('stage_prepare', '正在准备上下文…'); await new Promise((resolve) => setImmediate(resolve))
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
  const ensured = ensureAgentSession(sessionId, agentId, {
    role: payloadRole,
    expertId,
    surface,
    taskRef,
    ephemeral: surface === 'workbench',
  })
  let session = ensured.session
  const prepared = agentSessions.compactSession(session)
  session = prepared.session
  if (prepared.compacted) {
    saveAgentSessions(ensured.sessions.map(item => item.id === session.id ? session : item))
  }

  const ctxRole = (surface !== 'workbench' && (session?.run?.role === 'steward' || session?.agentId === 'steward'))
    ? 'steward'
    : promptRouter.normalizeMode(payloadRole || session?.run?.role || session?.agentId || agentId || 'general')
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

  const { queryKnowledge, kbQueryTool, kbGetTool } = L.createKnowledgeTools({
    app, fabricRetrieval, retrievalScope, embedFn, ensureFabricSeeded, buildFabricCtx,
  })

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
  if (signal?.aborted) return cancelled()

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
      return { early: { text: resolved.clarification, runId, sessionId: session.id, toolCalls: 0 } }
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

  return {
    session, s, url, slashRefs, ctxRole, grounding, writingTask, tier, embedFn, queryKnowledge,
    kbQueryTool, kbGetTool, effectivePersonalization, tokenCalKey, tokenCalBefore, routedModel,
    modelProfile, policy, promptCachePolicy, groundingTaskFrame, apiMessages, contextInfo, prompt,
  }
}

module.exports = { prepareAgentGenerate }
