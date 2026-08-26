'use strict'

/**
 * 生成前半段：校验 API、路由模型、组上下文与 apiMessages。
 * 不装配工具面、不跑 AgentRunExecutor。
 */

const L = require('./agent-generate-libs')
const { resolvePersonalAgentSettings } = require('./personal-agent-runtime-profile')
const { commonExpertIds, projectCommonExperts, buildCommonExpertContext } = require('./personal-expert-roster')
const {
  reconcileConversationLog,
  resolveTurnIdentity,
  upsertConversationMessage,
  withConversationIdentity,
} = require('./agent-conversation-log')

const DYNAMIC_BLOCK_CONFIG = Object.freeze({
  role: { kind: 'scene_instruction', authority: 'scene', trust: 'trusted', optional: false, sensitive: false },
  time_anchor: { kind: 'task_fact', authority: 'data', trust: 'trusted', optional: false, sensitive: false },
  grounding: { kind: 'task_fact', authority: 'data', trust: 'untrusted', optional: false, sensitive: true },
  plan: { kind: 'task_fact', authority: 'data', trust: 'trusted', optional: false, sensitive: true },
  personalization: { kind: 'user_preference', authority: 'data', trust: 'trusted', optional: false, sensitive: true },
  session: { kind: 'memory', authority: 'data', trust: 'untrusted', optional: true, sensitive: true },
  retrieval: { kind: 'retrieval', authority: 'data', trust: 'untrusted', optional: true, sensitive: true },
  memory: { kind: 'memory', authority: 'data', trust: 'untrusted', optional: true, sensitive: true },
})

/** 将旧 orchestrator 的动态段投影为可独立裁剪、审计的 ContextBlock。 */
function projectDynamicContextBlocks(pack = {}) {
  const sections = Array.isArray(pack.candidateSections)
    ? pack.candidateSections
    : (Array.isArray(pack.sections) ? pack.sections : [])
  return sections.map(section => {
    const config = DYNAMIC_BLOCK_CONFIG[section.key] || DYNAMIC_BLOCK_CONFIG.retrieval
    return {
      id: `data.dynamic.${section.key}`,
      ...config,
      priority: section.priority,
      maxTokens: section.maxTokens,
      content: section.text,
      meta: {
        description: section.key,
        confidence: ['role', 'time_anchor', 'plan', 'personalization'].includes(section.key) ? 'confirmed' : 'medium',
      },
      source: { type: 'context-orchestrator', id: section.key, version: '2' },
    }
  })
}

/** 成功返回 prepared；失败返回 `{ early }`（已走 env.fail）。 */
async function prepareAgentGenerate(env) {
  const { app, path, promptRouter, buildChatMessages, contextEngine, buildCoreContextBlocks, productKnowledge, productMemory, conversationGrounding, agentSessions, agentRun, groundingRuntime, feishuGrounding, feishuGroundingAdapter, researchRouting, llmRuntime, llmModelCatalog, llmUsage, knowledgeOs, fabricRetrieval, chatIntent, contextCache, contextOrchestrator, contextPacketLib, writingWorkflow, buildTemporalAnchorContext, logger, resolveGroundingRuntimeMode } = L
  const { loadSettings, ensureAgentSession, loadAgentSessions, saveAgentSessions, buildFabricCtx, ensureFabricSeeded, ensureCapabilityHub, getAgentProfileStore, getWorkbenchModeStore, readNote, buildEmbedFn, normalizeChatEndpoint, resolveActiveProvider, KNOWLEDGE_DIR, MEMORY_DIR, loadSourcesStore, activeAgentRuns } = env.deps
  const workflowReact = require('./workflow-react-prompt')
  const { payload, runId, stage, emit, metrics, signal } = env
  const fail = (error) => ({ early: env.fail(error) })
  const cancelled = () => fail('请求已取消')
  const {
    prompt, displayPrompt, context, history, noteId, category, skillRefs, taskId: rawTaskId,
    sessionId, agentId, contentGrounding, memoryToggles, role: payloadRole, expertId, surface, taskRef,
    hasImage, conversationMode, expertDiscussionContext,
  } = payload
  const collaborationOnly = conversationMode === 'expert-planning'
    || conversationMode === 'expert-discussion'

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
    personaExpertId: collaborationOnly ? expertId : '',
    surface,
    taskRef,
    ephemeral: surface === 'workbench',
    conversationMode,
  })
  let session = ensured.session
  const turnIdentity = resolveTurnIdentity(payload, runId)
  const initialMessageIds = new Set((session.messages || []).map(item => String(item?.id || '')).filter(Boolean))
  let compactedThisRun = false
  const persistSession = () => {
    const latestSessions = loadAgentSessions()
    const latest = latestSessions.find(item => item.id === session.id)
    if (latest) {
      const messages = compactedThisRun
        ? reconcileConversationLog(
            session.messages,
            (latest.messages || []).filter(item => !initialMessageIds.has(String(item?.id || ''))),
            { sessionId: session.id },
          )
        : reconcileConversationLog(latest.messages, session.messages, { sessionId: session.id })
      session = {
        ...latest,
        ...session,
        messages,
      }
    }
    const next = latestSessions.some(item => item.id === session.id)
      ? latestSessions.map(item => item.id === session.id ? session : item)
      : [...latestSessions, session]
    saveAgentSessions(next)
  }
  const personalizationSettings = resolvePersonalAgentSettings(s, session, getAgentProfileStore)
  if (workflowReact.shouldForceWorkflowReact(session)) {
    session = workflowReact.ensureWorkflowPlanSeed(session, agentRun)
  }
  const prepared = agentSessions.compactSession(session)
  session = prepared.session
  compactedThisRun = prepared.compacted
  if (prepared.compacted) {
    persistSession()
  }
  session.messages = reconcileConversationLog(session.messages, history, { sessionId: session.id })
  const currentTurnIds = [turnIdentity.userMessageId, turnIdentity.assistantMessageId]
  const conversationHistory = agentSessions.contextMessages(session, {
    excludeMessageIds: currentTurnIds,
  })
  const existingCommittedAnswer = session.messages.find(item => (
    item?.id === turnIdentity.assistantMessageId
      && item?.role === 'assistant'
      && String(item?.text || '').trim()
  ))
  if (existingCommittedAnswer) {
    persistSession()
    stage('stage_prepare', '已恢复本轮已完成答复', 'done')
    activeAgentRuns.delete(runId)
    return {
      early: {
        text: String(existingCommittedAnswer.text),
        runId,
        sessionId: session.id,
        toolCalls: 0,
        idempotentReplay: true,
      },
    }
  }
  const upsertCurrentUser = () => {
    const userMessage = withConversationIdentity({
      id: turnIdentity.userMessageId,
      role: 'user',
      text: String(prompt || '').slice(0, 12000),
      runId,
      createdAt: turnIdentity.userCreatedAt,
    }, { sessionId: session.id })
    session.messages = upsertConversationMessage(session.messages, userMessage)
  }
  const upsertImmediateAssistant = (text) => {
    const assistantMessage = withConversationIdentity({
      id: turnIdentity.assistantMessageId,
      role: 'assistant',
      text: String(text || '').slice(0, 12000),
      runId,
      createdAt: new Date().toISOString(),
    }, { sessionId: session.id })
    session.messages = upsertConversationMessage(session.messages, assistantMessage)
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
  const declaredToolExecution = Array.isArray(payload.executionContract?.requiredTools)
    && payload.executionContract.requiredTools.length > 0
  // Built-in meeting shortcuts (for example “会议总结”) intentionally use a
  // short user-facing label and therefore do not contain “飞书”. Route them
  // through the connector/tool tier before chat classification, otherwise the
  // normal chat surface omits meeting_candidates and the run can only refuse.
  const feishuIntent = feishuGrounding.detectFeishuIntent(prompt)
  const needsFeishuWorkflow = feishuIntent.mentioned
    && (feishuIntent.needsSearch || feishuIntent.needsContentRead || feishuIntent.asksMinutes)
  const tier = collaborationOnly
    ? 'chat'
    : declaredToolExecution
    ? 'assist'
    : needsFeishuWorkflow ? 'retrieval'
    : (forceFullCtx || (ctxRole === 'writing' && !!writingTask)) ? 'retrieval' : chatIntent.classifyIntent({
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

  const sessionSummary = session.summary ? `## 当前 Session 历史摘要\n${session.summary}` : ''
  const userProfile = {
    userProfile: personalizationSettings.userProfile,
    userPrompt: personalizationSettings.userPrompt,
    industry: personalizationSettings.industry,
    occupationId: personalizationSettings.occupationId,
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
  // 显式 userPrompt 已由 user-preference block 承载；这里只保留已确认习惯，避免重复注入。
  const learnedPreferences = effectivePersonalization.applied
    .filter(item => item.kind !== 'user_prompt')
  const personalizationContext = learnedPreferences.length
    ? [
        '【本轮已确认协作习惯】',
        ...learnedPreferences.map(item => `- ${item.text}`),
      ].join('\n')
    : ''
  const workMemoryContext = contextPacketLib.formatForPrompt(workPacket)
  const memCtx = [baseMemCtx, workMemoryContext].filter(Boolean).join('\n\n')
  const routedModel = llmModelCatalog.resolveRuntimeModel(s, {
    tier,
    prompt,
    history: conversationHistory,
    hasImage: hasImage === true,
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
  const declaredExecutionContract = payload.executionContract && typeof payload.executionContract === 'object'
    ? groundingRuntime.mergeGroundingContracts([payload.executionContract])
    : null
  const capAssemblyGrounding = groundingRuntime.mergeGroundingContracts([
    capAssembly?.groundingContract,
    declaredExecutionContract,
  ].filter(Boolean))
  // An explicit Feishu Docx/Wiki URL is already an authoritative locator. In
  // runtime mode make the read contract deterministic so the model cannot
  // replace it with a broad meeting search (or answer from title metadata).
  const directDocGrounding = feishuIntent.directDocRead && !capAssemblyGrounding?.requiredTools?.length
    ? {
        requiredTools: ['feishu.read_doc'],
        requiredEvidence: [{ kind: 'tool_result', tool: 'feishu.read_doc', minChars: 40, forbidTruncated: true }],
      }
    : null
  const effectiveGrounding = collaborationOnly
    ? null
    : groundingRuntime.mergeGroundingContracts([
        capAssemblyGrounding,
        directDocGrounding,
      ].filter(Boolean))
  let effectivePrompt = String(prompt || '')
  const researchPrompt = researchRouting.selectResearchPrompt({ prompt, displayPrompt })
  let groundingTaskFrame = null
  if (resolveGroundingRuntimeMode() === 'runtime' && !collaborationOnly) {
    let refState = groundingRuntime.deserializeReferenceState(session.referenceState || {})
    refState.taskFrame = researchRouting.reconcileResearchTaskFrame(refState.taskFrame, researchPrompt)
    // Recover a lost candidate binding from the last rendered assistant card.
    // This is intentionally deterministic: a numeric reply must never fall
    // back to free-form model interpretation when the card already contains
    // a Feishu minutes/docx URL.
    if (groundingRuntime.parseNumericSelection(effectivePrompt) && !refState.pendingSelection) {
      try {
        const meetingSelection = require('./feishu-meeting-selection')
        const previous = [...(Array.isArray(session.messages) ? session.messages : [])]
          .reverse()
          .find(item => item?.role === 'assistant' && /(?:回复序号|会议候选|飞书妙记|会议记录)/i.test(String(item.text || '')))
        const candidates = previous
          ? meetingSelection.extractFeishuSearchCandidatesFromText(previous.text)
          : []
        if (candidates.length) {
          const pending = groundingRuntime.meetingCandidatesToPendingSelection(candidates)
          refState = groundingRuntime.setPendingSelection(refState, pending.options, pending.refSetId)
        }
      } catch { /* recovery is best-effort; normal clarification remains fail-closed */ }
    }
    if (effectiveGrounding?.requiredTools?.length) {
      refState = groundingRuntime.setTaskFrame(refState, effectiveGrounding)
      groundingTaskFrame = effectiveGrounding
    }
    const resolved = feishuGroundingAdapter.resolveUserPromptWithReferenceState(refState, effectivePrompt, {
      bindRefId: payload.bindRef,
      allowMeetingRecovery: session.run?.toolsUsed?.includes('feishu.meeting_candidates') === true,
    })
    refState = resolved.referenceState
    session.referenceState = groundingRuntime.serializeReferenceState(refState)
    if (resolved.needsClarification) {
      upsertCurrentUser()
      upsertImmediateAssistant(resolved.clarification)
      session.updatedAt = new Date().toISOString()
      persistSession()
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
  let commonExpertContext = ''
  const personalSession = session?.agentId === 'personal' || session?.sessionKind === 'personal-topic'
  if (personalSession && typeof getWorkbenchModeStore === 'function') {
    try {
      const modeState = getWorkbenchModeStore().load()
      const ids = commonExpertIds(modeState)
      if (ids.length) {
        const catalog = await ensureCapabilityHub().listCapabilities({ kind: 'expert' })
        commonExpertContext = buildCommonExpertContext(projectCommonExperts(modeState, catalog?.items || []))
      }
    } catch { /* roster is optional context; never block conversation */ }
  }
  const sceneId = promptRouter.resolveScene({
    mode: ctxRole,
    tier,
    role: ctxRole,
    hasNoteContext: !!String(context || '').trim(),
    industry: personalizationSettings.industry,
    prompt,
  })
  const toolsEnabled = !collaborationOnly && tier !== 'chat' && modelProfile.supportsTools !== false
  const capabilityIds = toolsEnabled
    ? ['web', 'suggestion', ...(feishuIntent.mentioned ? ['feishu'] : [])]
    : []
  const executionPolicy = contextEngine.resolveExecutionPolicy({ conversationMode, toolsEnabled })
  session.executionPolicy = executionPolicy
  const contextPolicy = contextEngine.resolveContextPolicy({
    tier,
    scene: sceneId,
    conversationMode,
    locale: s.locale || 'zh-CN',
    toolsEnabled,
    executionPolicy,
    capabilityIds,
    identity: capAssembly.personaName,
    inputBudget: policy.inputBudget,
  })
  const sceneBlocks = collaborationOnly
    ? contextEngine.buildExpertCollaborationBlocks({
        mode: conversationMode,
        expertName: capAssembly.personaName || expertId || '当前专家',
        discussionContext: expertDiscussionContext,
      })
    : [{
        id: `scene.${sceneId}`,
        kind: 'scene_instruction',
        content: promptRouter.buildScenePrompt({
          scene: sceneId,
          mode: ctxRole,
          locale: contextPolicy.locale,
          hasHistory: conversationHistory.length > 0,
        }),
        source: { type: 'assistant-prompt-router', id: sceneId, version: '1' },
      }]
  const userPreferencePrompt = promptRouter.buildUserPrompt(personalizationSettings, ctxRole, {
    includeUserPrompt: memoryToggles?.collaborationPrefs !== false,
    includeAgentPersona: !collaborationOnly,
    includeIdentityName: /你叫什么|你的名字|你是谁|自我介绍|怎么称呼|称呼你/i.test(String(prompt || '')),
  })
  const skillPrompt = promptRouter.buildSkillPrompt(slashRefs)
  const contextBlocks = [
    ...buildCoreContextBlocks({
      tier,
      toolsEnabled,
      capabilityIds,
      locale: contextPolicy.locale,
    }),
    ...sceneBlocks,
    ...(workflowReact.shouldForceWorkflowReact(session) ? [{
      id: 'scene.workflow-react',
      kind: 'scene_instruction',
      priority: 94,
      maxTokens: 520,
      cachePolicy: 'session',
      content: workflowReact.REACT_INSTRUCTIONS,
      source: { type: 'workflow-runtime', id: 'react-v1' },
    }] : []),
    ...(userPreferencePrompt ? [{
      id: 'preference.user',
      kind: 'user_preference',
      content: `【用户偏好】\n${userPreferencePrompt}`,
      maxTokens: 1200,
      sensitive: true,
      source: { type: 'settings', id: 'user-prompt' },
    }] : []),
    ...(skillPrompt ? [{
      id: 'skill.explicit',
      kind: 'skill',
      optional: true,
      explicit: true,
      content: `【技能策略】\n${skillPrompt}`,
      maxTokens: 2400,
      source: { type: 'skill-router', id: slashRefs.join(',') },
    }] : []),
    ...(!collaborationOnly && capAssembly.personaName ? [{
      id: 'scene.active-identity',
      kind: 'scene_instruction',
      priority: 97,
      maxTokens: 120,
      cachePolicy: 'session',
      content: `【当前身份】\n当前负责本轮协作的身份是“${String(capAssembly.personaName).slice(0, 120)}”；需要自称时使用该身份，不得被通用伙伴身份覆盖。`,
      meta: { claims: { identity: capAssembly.personaName }, suppressOnConflict: false },
      source: { type: 'expert-runtime', id: session.personaExpertId || session.expertId },
    }] : []),
    ...(capAssembly.dynamicCapabilityContext ? [{
      id: 'persona.active-expert',
      kind: 'persona',
      content: capAssembly.dynamicCapabilityContext,
      maxTokens: 5200,
      source: { type: 'expert-runtime', id: session.personaExpertId || session.expertId },
      meta: capAssembly.personaName
        ? { claims: { identity: capAssembly.personaName }, suppressOnConflict: false }
        : {},
    }] : []),
    ...(writingPromptContext ? [{
      id: 'skill.writing-context',
      kind: 'skill',
      content: writingPromptContext,
      maxTokens: 2400,
      source: { type: 'writing-workflow', id: 'active' },
    }] : []),
    ...(commonExpertContext ? [{
      id: 'task.common-experts',
      kind: 'task_fact',
      optional: true,
      content: commonExpertContext,
      maxTokens: 1600,
        meta: { description: '常用专家候选', confidence: 'confirmed' },
      source: { type: 'personal-expert-roster', id: 'active' },
    }] : []),
    ...projectDynamicContextBlocks(dynamicContextPack),
  ]
  const optionalTopK = tier === 'chat' ? 2 : tier === 'assist' ? 3 : 4
  const contextEmbedFn = buildEmbedFn(s, { scope: 'context' })
  const semanticSelection = await contextEngine.prepareContextSemanticSelection({
    mode: s.contextSemanticMode,
    embed: contextEmbedFn,
    blocks: contextBlocks,
    policy: contextPolicy,
    query: prompt,
    topK: optionalTopK,
    allowSensitive: s.embeddingAllowSensitive === true,
    signal,
  })
  metrics.contextSemanticMs = semanticSelection.telemetry.latencyMs
  metrics.contextSemanticStatus = semanticSelection.telemetry.status
  metrics.contextSemanticReason = semanticSelection.telemetry.reason
  contextEngine.recordContextSemanticTelemetry(
    semanticSelection.telemetry,
    contextEngine.semanticRuntimeStats(),
  )
  if (signal?.aborted) return cancelled()
  const contextAssemblyStartedAt = Date.now()
  let contextAssembly
  try {
    contextAssembly = contextEngine.assembleContext({
      policy: contextPolicy,
      blocks: contextBlocks,
      query: prompt,
      optionalTopK,
      budget: Math.min(16000, Math.max(1800, Math.floor(policy.inputBudget * 0.55))),
      vectorScores: semanticSelection.vectorScores,
      semanticSelection: semanticSelection.telemetry,
    })
  } catch (error) {
    if (error?.code === 'critical_context_budget_exceeded') {
      contextEngine.recordCriticalBudgetFailure()
      return fail(error.message)
    }
    throw error
  }
  contextEngine.recordContextAssembly(contextAssembly.manifest, Date.now() - contextAssemblyStartedAt)
  const rawMessages = buildChatMessages({
    systemMessages: contextAssembly.messages.filter(message => message.role === 'system'),
    dataMessages: contextAssembly.messages.filter(message => message.role === 'user'),
    history: conversationHistory,
    prompt: effectivePrompt,
    noteContext: context,
    imageAttachments: Array.isArray(payload.attachments) ? payload.attachments : [],
  })
  let fittedConversation
  try {
    fittedConversation = llmRuntime.fitConversation(rawMessages, policy.inputBudget)
  } catch (error) {
    if (error?.code === 'critical_context_budget_exceeded') return fail(error.message)
    throw error
  }
  const apiMessages = fittedConversation.messages
  try {
    logger.systemPrompt('llm-system-prompt', '构建系统提示词', {
      model: modelProfile.model,
      agentId: session?.agentId || agentId || 'general',
      sessionId: session?.id || sessionId || '',
      skillRefs: slashRefs,
      contextManifest: contextAssembly.manifest,
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
    contextManifest: contextAssembly.manifest,
    contextEngineMetrics: contextEngine.contextEngineMetricsSnapshot(contextEngine.semanticRuntimeStats()),
  }
  upsertCurrentUser()
  if (grounding.active) {
    session.displayTitle = String(grounding.title || '').slice(0, 80)
    session.labels = Array.isArray(grounding.labels) ? grounding.labels.slice(0, 3) : []
    session.grounding = String(grounding.text || '').slice(0, 3000)
  }
  session.updatedAt = new Date().toISOString()
  persistSession()
  stage('stage_prepare', '上下文准备完成', 'done', { contextInfo })

  return {
    session, s, url, slashRefs, ctxRole, grounding, writingTask, tier, embedFn, queryKnowledge,
    kbQueryTool, kbGetTool, effectivePersonalization, tokenCalKey, tokenCalBefore, routedModel,
    modelProfile, policy, promptCachePolicy, groundingTaskFrame, apiMessages, contextInfo, prompt, researchPrompt,
    executionPolicy,
  }
}

module.exports = { prepareAgentGenerate }
