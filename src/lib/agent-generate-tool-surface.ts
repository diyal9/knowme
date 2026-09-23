'use strict'

/**
 * 为本轮 run 装配工具面、沙箱权限与 teamRuntime.adopt。
 * chat 且无 slash 时不挂连接器/进程工具。
 */

const L = require('./agent-generate-libs')
const { resolveFeishuExecutionIntent } = require('./agent-execution-intent')
const { finalizeAgentContext } = require('./agent-context-finalize')
const { createMediaResourceResolver } = require('./agent-media-resources')
const { buildHostBuiltinBundles } = require('./agent-host-builtin-tools')
const { buildRunGovernancePolicy } = require('./tool-surface-builder')
const { buildCapabilityAccessTools, listHostCapabilityCatalog } = require('./agent-capability-access')
const { guardCapabilityToolSurface } = require('./agent-capability-surface-guard')
const { createCapabilityExecutionCheck } = require('./agent-capability-execution-check')
const { taskCapabilityIdentity, sameTaskCapabilityIdentity } = require('./agent-task-capability-grants')
const { IMAGE_PROVIDER_ADAPTER, requiresCapabilityImportTools, requiresAgentRegistryTools } = require('./agent-provider-tool-contracts')
const {
  persistSessionProjectBinding,
  guardFileAdapterForProjectBinding,
  guardToolBundleForProjectBinding,
} = require('./project-session-binding')

function yieldToEventLoop() {
  if (typeof setImmediate !== 'function') return Promise.resolve()
  return new Promise(resolve => setImmediate(resolve))
}

function shouldProjectProviderAdapter(input, adapter) {
  const requiredTools = new Set(Array.isArray(input?.requiredTools) ? input.requiredTools : [])
  const allowedConnectorIds = new Set(Array.isArray(input?.allowedConnectorIds) ? input.allowedConnectorIds : [])
  return requiredTools.has(String(adapter?.requiredTool || '').trim())
    && allowedConnectorIds.has(String(adapter?.connectorId || '').trim())
}

/** 成功返回 surface 字段；缺必需工具时 `{ early }`。 */
async function buildRunToolSurface(env, prepared) {
  const {
    app, path, agentTools, agentSandbox, agentPlanTools, agentProcessTools,
    agentArtifactTools, agentImageTools, agentOrchestration, knowledgeStewardTools, agentCapabilityImportTools, agentRegistryTools, isToolSurfaceV1,
    resolveToolSurfaceForRun, getSessionCapabilityBindings, mergeExtraTools, researchRouting,
    groundingRuntime, feishuGrounding, resolveGroundingRuntimeMode, connectorToolRuntime, contextEngine, logger,
  } = L
  const {
    ensureCapabilityHub, ensureAgentTeamRuntime, getActiveSourceRoot, kosSourcesCtx,
    workbenchDaemon, buildActiveSourceFileTools, getConnectorsApi, getActiveProjectId,
    resolveProjectContext, loadAgentSessions, saveAgentSessions,
  } = env.deps
  const { payload, runId, signal, metrics, controller, stage } = env
  const fail = (error) => ({ early: env.fail(error) })
  const sessionId = payload.sessionId
  const userDataPath = app.getPath('userData')
  let { session } = prepared
  const {
    s, slashRefs, tier, embedFn, queryKnowledge, kbQueryTool, kbGetTool,
    groundingTaskFrame: initialFrame, prompt, researchPrompt,
  } = prepared
  // research 路由可能改写对话消息，须 let（原先 const 会在注入时抛 Assignment to constant variable）
  let apiMessages = prepared.apiMessages
  let contextInfo = prepared.contextInfo || {}
  let groundingTaskFrame = initialFrame
  let settleAdoptedRun = env.settleAdoptedRun

  const effectiveExecutionPolicy = session?.executionPolicy === 'no-tools'
    ? 'no-tools'
    : prepared.executionPolicy
  const noTools = !contextEngine.isToolExecutionAllowed(effectiveExecutionPolicy)
  const needsConnectorTools = contextEngine.shouldProjectToolSurface({
    executionPolicy: effectiveExecutionPolicy,
    tier,
    slashRefs,
  })
  // Feishu follows the same binding + task-grant scope as every connector.
  const includeSystemFeishu = false
  if (noTools) {
    groundingTaskFrame = null
    if (session && typeof session === 'object') session.referenceState = undefined
  }
  const candidateProjectId = session?.projectId
    || (needsConnectorTools ? getActiveProjectId?.() : null)
  const projectContext = candidateProjectId ? resolveProjectContext?.(candidateProjectId) : null
  const candidateProjectUsable = Boolean(
    projectContext?.ok
    && projectContext.workspace?.available
    && !['archived', 'missing'].includes(projectContext.project?.status),
  )
  if (session?.projectId && (
    !projectContext?.ok
    || (needsConnectorTools && (
      !projectContext.workspace?.available
      || projectContext.project?.status === 'archived'
      || projectContext.project?.status === 'missing'
    ))
  )) {
    return fail(projectContext?.error || '任务绑定的项目当前不可用，请先重新关联项目目录')
  }
  let fileTools = needsConnectorTools
    ? buildActiveSourceFileTools(embedFn, {
      workspaceState: s.workspaceState || null,
      runMetrics: metrics,
      runId,
      projectId: candidateProjectId || undefined,
    })
    : null
  const bindCandidateProject = () => (
    persistSessionProjectBinding(session, candidateProjectId, { loadAgentSessions, saveAgentSessions })
  )
  if (fileTools?.fileAdapter && !session?.projectId && candidateProjectId && candidateProjectUsable) {
    fileTools = {
      ...fileTools,
      fileAdapter: guardFileAdapterForProjectBinding(fileTools.fileAdapter, bindCandidateProject),
    }
  }
  if (projectContext?.ok) {
    const projectInfo = {
      id: projectContext.project.id,
      name: projectContext.project.name,
      status: projectContext.project.status,
      workspaceSourceId: projectContext.project.workspaceSourceId,
      outputPolicy: projectContext.project.outputPolicy,
      binding: session?.projectId ? 'bound' : 'bind-on-first-file-operation',
    }
    contextInfo = { ...contextInfo, project: projectInfo }
    if (prepared.contextDraft) {
      prepared.contextDraft.infoBase = { ...(prepared.contextDraft.infoBase || {}), project: projectInfo }
      prepared.contextDraft.blocks = [
        ...(Array.isArray(prepared.contextDraft.blocks) ? prepared.contextDraft.blocks : []),
        {
          id: 'task.project-work-context',
          kind: 'task_fact',
          priority: 93,
          maxTokens: 220,
          cachePolicy: 'turn',
          content: [
            '【项目工作上下文】',
            `项目：${projectInfo.name}（${projectInfo.id}）`,
            `工作区来源：${projectInfo.workspaceSourceId}`,
            `新建正式成果默认放入：${projectInfo.outputPolicy?.directory || 'outputs'}`,
            '读取或修改既有文件时保持其原路径；不要把项目文件写入参考资料源。',
          ].join('\n'),
          source: { type: 'project-runtime', id: projectInfo.id, version: '1' },
        },
      ]
    }
  }
  await yieldToEventLoop()
  const sourceRoot = fileTools?.sourceRoot || (candidateProjectId ? null : getActiveSourceRoot())
  let processTools = needsConnectorTools && isToolSurfaceV1() && sourceRoot
    && (!candidateProjectId || projectContext?.workspace?.writable)
    ? agentProcessTools.buildProcessTools({
      runId,
      resolveCwd: () => sourceRoot,
    })
    : null
  let artifactTools = needsConnectorTools && isToolSurfaceV1()
    ? agentArtifactTools.buildArtifactTools({
      runId,
      projectId: candidateProjectUsable ? candidateProjectId : undefined,
      sourceId: fileTools?.sourceId || projectContext?.workspace?.sourceId,
      taskId: session?.taskRef?.id,
    })
    : null
  if (!session?.projectId && candidateProjectId && candidateProjectUsable) {
    processTools = guardToolBundleForProjectBinding(
      processTools,
      bindCandidateProject,
      ['run_task', 'start_process'],
    )
    artifactTools = guardToolBundleForProjectBinding(artifactTools, bindCandidateProject)
  }
  const currentSession = () => typeof loadAgentSessions === 'function'
    ? (loadAgentSessions() || []).find(item => item.id === session?.id) || null : session
  const resolveScope = current => getSessionCapabilityBindings(current, ensureCapabilityHub().expertRuntime(), {
    userData: userDataPath, permissions: payload.permissions, executionPolicy: effectiveExecutionPolicy,
  })
  const sessionConnectorBindings = resolveScope(session)
  const initialScopeIdentity = taskCapabilityIdentity(session)
  const connectorCandidates = getConnectorsApi?.().loadConnectors?.()
  if (Array.isArray(connectorCandidates)) {
    sessionConnectorBindings.allowedConnectorIds = connectorCandidates
      .filter(conn => conn.enabled !== false && sessionConnectorBindings.decision('connectors', conn.id).allowed).map(conn => conn.id)
  }
  const getLiveCapabilityState = () => {
    const current = currentSession()
    if (!current || !sameTaskCapabilityIdentity(initialScopeIdentity, taskCapabilityIdentity(current))
      || signal?.aborted || ['cancelled', 'canceled'].includes(current.run?.status)) return null
    const scope = resolveScope(current)
    const snapshot = current.expertId
      ? ensureCapabilityHub().expertRuntime().getSessionPersona(current.id, current.expertId) : null
    const available = getConnectorsApi?.().loadConnectors?.()
    return { scope, connectors: Array.isArray(available) ? available : null,
    availableConnectorIds: Array.isArray(available)
      ? available.filter(conn => conn.enabled !== false).map(conn => conn.id) : null,
    governancePolicy: buildRunGovernancePolicy({
      session: current, permissions: payload.permissions,
      expertSnapshot: snapshot?.ok ? snapshot : null, capabilityScope: scope,
    }) }
  }
  const validateExecutionApproval = createCapabilityExecutionCheck({
    session, runId, signal, getSession: currentSession, getState: getLiveCapabilityState,
    getTask: id => env.deps.getWorkbenchTaskStore?.().get(id)?.task,
    getConnectors: () => getConnectorsApi?.().loadConnectors?.() || [],
  })
  const sessionExpertSnapshot = session?.expertId
    ? ensureCapabilityHub().expertRuntime().getSessionPersona(session.id, session.expertId)
    : null
  const declaredGovernancePolicy = buildRunGovernancePolicy({
    permissions: payload.permissions,
    session,
    expertSnapshot: sessionExpertSnapshot?.ok ? sessionExpertSnapshot : null,
    allowedConnectorIds: sessionConnectorBindings.allowedConnectorIds,
    capabilityScope: sessionConnectorBindings,
    budget: session?.run?.budget || payload.budget || null,
  })
  // Turn-local planning/no-tools must not persist a new permission restriction.
  const governancePolicy = noTools ? { ...declaredGovernancePolicy, allowlist: [] } : declaredGovernancePolicy
  const declaredRunPermissions = { ...(session?.run?.permissions || {}), ...(payload.permissions || {}) }
  declaredRunPermissions.tools = {
    ...(declaredRunPermissions.tools || {}),
    ...(declaredGovernancePolicy.allowlist === null ? {} : { allowlist: declaredGovernancePolicy.allowlist }),
    denylist: declaredGovernancePolicy.denylist,
  }
  // Provider adapters are projected from the declared tool/connector contract.
  // A custom expert with the same capabilities must receive the same surface.
  const needsPangoImageAdapter = shouldProjectProviderAdapter({
    requiredTools: groundingTaskFrame?.requiredTools,
    allowedConnectorIds: sessionConnectorBindings.allowedConnectorIds,
  }, IMAGE_PROVIDER_ADAPTER)
  const pangoConnector = needsPangoImageAdapter
    ? getConnectorsApi().loadConnectors?.().find(connector => connector.id === agentImageTools.PANGO_CONNECTOR_ID)
    : null
  const pangoRuntimeOptions = pangoConnector
    ? getConnectorsApi().resolveRuntimeOptions(pangoConnector)
    : null
  const imageTools = needsConnectorTools && isToolSurfaceV1() && needsPangoImageAdapter
    ? agentImageTools.buildImageTools({
      runId,
      userData: userDataPath,
      signal,
      connector: pangoConnector,
      runtimeOptions: pangoRuntimeOptions,
      resolveMediaReference: createMediaResourceResolver({
        getAttachments: () => prepared.contextDraft?.imageAttachments || payload.attachments || [],
        getArtifacts: () => (loadAgentSessions?.() || []).find(item => item.id === session?.id)?.run?.artifacts
          || session?.run?.artifacts || [],
      }),
    })
    : null
  if (imageTools?.definitions) imageTools.definitions = imageTools.definitions.map(definition => ({
    ...definition, _knowme: { ...definition._knowme, connectorId: agentImageTools.PANGO_CONNECTOR_ID },
  }))
  const teamRuntime = ensureAgentTeamRuntime()
  teamRuntime.manager.adoptRunningRun({
    runId,
    sessionId: session?.id || sessionId,
    abortController: controller,
    budget: session?.run?.budget || payload.budget || {},
    governanceEnvelope: {
      permissions: declaredRunPermissions,
      orchestration: governancePolicy.orchestration,
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
  await yieldToEventLoop()
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
  const { webTools, calculationTools } = buildHostBuiltinBundles({
    signal,
    noTools,
    includeWeb: needsConnectorTools,
  })
  const skillTools = needsConnectorTools
    ? ensureCapabilityHub().buildSkillToolsForSession(session, sandboxPermissions, {
      getCurrentSession: currentSession, getCapabilityState: getLiveCapabilityState,
      explicitUserSkillIds: slashRefs.map(ref => ensureCapabilityHub().skillRuntime?.().findSkillRecord?.(ref)?.id)
        .filter(id => id && sessionConnectorBindings.decision('skills', id).allowed),
      taskId: String(payload.taskId || ''),
    })
    : null
  const stewardTools = session?.run?.role === 'steward'
    ? knowledgeStewardTools.buildKnowledgeStewardTools({
      userData: app.getPath('userData'),
      sources: kosSourcesCtx().sources || [],
    })
    : null
  const capabilityImportTools = requiresCapabilityImportTools(groundingTaskFrame?.requiredTools || [])
    ? agentCapabilityImportTools.buildCapabilityImportTools({ hub: ensureCapabilityHub() })
    : null
  const registryTools = requiresAgentRegistryTools(groundingTaskFrame?.requiredTools || [])
    ? agentRegistryTools.buildAgentRegistryTools({ hub: ensureCapabilityHub() })
    : null
  const capabilityAccessTools = needsConnectorTools && !noTools ? buildCapabilityAccessTools({
    userData: userDataPath, runId, getSession: currentSession, getScope: resolveScope,
    getCatalog: () => listHostCapabilityCatalog(env.deps),
  }) : null
  const extraTools = mergeExtraTools(
    capabilityAccessTools,
    calculationTools,
    fileTools,
    processTools,
    artifactTools,
    orchestrationTools,
    sandboxTools,
    planTools,
    webTools,
    skillTools,
    stewardTools,
    capabilityImportTools,
    registryTools,
    imageTools,
  )
  await yieldToEventLoop()
  // V1 registers file/process/artifact/orchestration groups through their
  // dedicated registry slots below. Passing them again via extraTools creates
  // tool_conflict issues (for example read_file and await_sub_run), which
  // incorrectly makes the whole Feishu tool stage look partially broken.
  const v1ExtraTools = mergeExtraTools(
    capabilityAccessTools,
    calculationTools,
    sandboxTools,
    planTools,
    webTools,
    skillTools,
    stewardTools,
    capabilityImportTools,
    registryTools,
    imageTools,
  )
  const recoverySession = currentSession()
  const executionApprovalRecoveryRunId = require('./agent-execution-approval-recovery')
    .getHostExecutionApprovalRecoveryRunId(recoverySession)
  const resolvedSurface = needsConnectorTools
    ? await resolveToolSurfaceForRun({
      userData: userDataPath,
      runId,
      sessionId: session?.id || sessionId,
      executionApprovalRecoveryRunId,
      fileAdapter: fileTools?.fileAdapter,
      processTools,
      artifactTools,
      orchestrationTools,
      extraTools: isToolSurfaceV1() ? v1ExtraTools : extraTools,
      permissions: runPermissions,
      governancePolicy,
      validateExecutionApproval,
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
        executionApprovalContext: { runId, sessionId: session.id, validateExecutionApproval,
          signal, approvalFileRoot: fileTools?.fileAdapter?.rootPath },
        extraTools: cOpts.extraTools,
        allowedConnectorIds: sessionConnectorBindings.allowedConnectorIds,
        includeSystemFeishu,
        registry: cOpts.registry,
        resolveRuntimeOptions: conn => getConnectorsApi().resolveRuntimeOptions(conn),
      }),
    })
    : {
      surface: agentTools.createToolSurface({
        governancePolicy,
        includeBuiltins: !noTools,
        extraDefinitions: noTools ? [] : (extraTools?.definitions || []),
        handlers: noTools ? {} : (extraTools?.handlers || {}),
      }),
      close: async () => {},
      mode: 'minimal',
      governancePolicy,
    }
  const toolSurface = guardCapabilityToolSurface(resolvedSurface.surface, getLiveCapabilityState)
  const connectorRuntime = { close: resolvedSurface.close, mcpProjectionError: resolvedSurface.mcpProjectionError }
  if (connectorRuntime.mcpProjectionError && typeof stage === 'function') {
    const projection = connectorRuntime.mcpProjectionError
    stage('stage_tools', 'MCP 工具加载失败', 'error', {
      runPhase: 'tool',
      summary: String(projection.message || projection.code || 'MCP 工具未能加载').slice(0, 500),
      code: projection.code || 'mcp_error',
    })
  }
  const registrationIssues = typeof resolvedSurface.registry?.getRegistrationIssues === 'function'
    ? resolvedSurface.registry.getRegistrationIssues()
    : []
  if (registrationIssues.length && typeof stage === 'function') {
    stage('stage_tools', '部分工具未能加载', 'error', {
      runPhase: 'tool',
      summary: registrationIssues
        .slice(0, 5)
        .map(issue => `${issue.name || '未知工具'}：${issue.message || issue.code || '注册失败'}`)
        .join('；')
        .slice(0, 500),
      code: 'tool_registration_failed',
    })
  }
  const toolRecords = typeof toolSurface.getToolRecords === 'function'
    ? toolSurface.getToolRecords()
    : toolSurface.getToolDefinitions()
  const researchRoute = noTools
    ? {
        active: false,
        intent: researchRouting.classifyResearchIntent(researchPrompt || prompt),
        sources: [],
        context: '',
        taskFrame: null,
      }
    : researchRouting.buildResearchRoute({
        prompt: researchPrompt || prompt,
        toolRecords,
      })
  try {
    const finalized = finalizeAgentContext({ prepared, toolRecords, researchRoute })
    apiMessages = finalized.apiMessages
    contextInfo = finalized.contextInfo
    try {
      logger.systemPrompt('llm-system-prompt', '构建系统提示词', {
        model: prepared.modelProfile?.model,
        agentId: session?.agentId || payload.agentId || 'general',
        sessionId: session?.id || payload.sessionId || '',
        skillRefs: prepared.slashRefs || [],
        capabilityIds: finalized.capabilityIds,
        contextManifest: finalized.contextAssembly?.manifest || null,
      }, { runId, scope: 'ai-generate' })
    } catch { /* logging must not block execution */ }
    if (typeof stage === 'function') {
      stage('stage_prepare', '上下文准备完成', 'done', { contextInfo })
    }
  } catch (error) {
    await connectorRuntime.close().catch(() => {})
    if (error?.code === 'critical_context_budget_exceeded') {
      contextEngine.recordCriticalBudgetFailure()
      return fail(error.message)
    }
    throw error
  }
  if (researchRoute.active) {
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
  const pendingRequiredToolSchemas = []
  const unavailableRequiredTools = [...new Set(groundingTaskFrame?.requiredTools || [])]
    .filter(toolName => {
      if (toolSurface.isAllowedTool(toolName)) return false
      const dependency = require('./agent-required-mcp-schema')
        .pendingRequiredMcpSchema(toolName, toolSurface, getLiveCapabilityState())
      if (!dependency) return true
      pendingRequiredToolSchemas.push(dependency)
      return false
    })
  if (unavailableRequiredTools.length) {
    await connectorRuntime.close().catch(() => {})
    const schemaHint = unavailableRequiredTools.some(name => String(name).startsWith('mcp.'))
      ? ' 冷 MCP 工具还依赖显式授权的 schema 加载入口；工具 allowlist、deny 和 no-tools 不会自动扩大。' : ''
    return fail(`所需工具不可用：${unavailableRequiredTools.join(', ')}。请启用对应连接器或安装能力后重试。${schemaHint}`)
  }
  if (pendingRequiredToolSchemas.length) contextInfo = { ...contextInfo, pendingRequiredToolSchemas }
  const toolExecutor = toolSurface.createToolExecutor({
    searchKnowledge: queryKnowledge,
    fabricSearch: queryKnowledge,
    kbQuery: kbQueryTool,
    kbGet: kbGetTool,
    signal,
  })
  const feishuIntent = resolveFeishuExecutionIntent({
    conversationMode: payload.conversationMode,
    executionContract: groundingTaskFrame || payload.executionContract,
    prompt: prepared.contextDraft?.prompt || prompt,
  })

  return {
    session,
    noTools,
    needsConnectorTools,
    fileTools,
    sourceRoot,
    processTools,
    artifactTools,
    imageTools,
    teamRuntime,
    settleAdoptedRun,
    orchestrationTools,
    sandboxEnabled,
    sandboxWorkdir,
    declaredRunPermissions,
    sandboxPermissions,
    runPermissions,
    sandboxTools,
    planTools,
    webTools,
    skillTools,
    stewardTools,
    capabilityImportTools,
    registryTools,
    extraTools,
    userDataPath,
    resolvedSurface,
    toolSurface,
    connectorRuntime,
    systemFeishuEnabled: includeSystemFeishu,
    researchRoute,
    apiMessages,
    groundingTaskFrame,
    pendingRequiredToolSchemas,
    contextInfo,
    toolExecutor,
    feishuIntent,
  }
}

module.exports = { buildRunToolSurface, shouldProjectProviderAdapter }
