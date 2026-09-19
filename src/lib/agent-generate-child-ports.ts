'use strict'

/**
 * 子 Agent 端口：隔离会话 + 独立工具面，不共享父会话历史。
 * 由 execute 登记到 agentRuntimePortFactories，供编排 spawn。
 */

const L = require('./agent-generate-libs')
const { resolveChildCapabilityState } = require('./agent-child-capability-scope')
const { guardCapabilityToolSurface } = require('./agent-capability-surface-guard')
const { createCapabilityExecutionCheck } = require('./agent-capability-execution-check')
const { sameTaskCapabilityIdentity, taskCapabilityIdentity } = require('./agent-task-capability-grants')
const { buildChildKnowledgeTools } = require('./agent-child-knowledge-tools')

/** 工厂：为一次子 run 装配 ports；子会话 ephemeral，只继承一条父 system。 */
function createChildRunPortFactory(env, prepared, surface) {
  const {
    app, path, agentSessions, agentProcessTools, agentArtifactTools, agentOrchestration,
    agentSandbox, agentPlanTools, agentWebTools, resolveToolSurfaceForRun,
    mergeExtraTools, connectorToolRuntime, buildProductionRunPorts,
    normalizeAssistantOutput,
  } = L
  const { ensureCapabilityHub, loadAgentSessions, saveAgentSessions, MEMORY_DIR, requestAgentCompletion, getConnectorsApi } = env.deps
  const { runId, signal } = env
  const { s, url, routedModel, policy, promptCachePolicy, tokenCalKey, modelProfile } = prepared
  const {
    session, runPermissions, sandboxEnabled, sandboxPermissions, fileTools, sourceRoot,
    orchestrationTools, userDataPath, apiMessages, teamRuntime,
  } = surface

  return async function childRunPortFactory(childCtx) {
    
    const childRunId = String(childCtx.runId)
    const childSession = agentSessions.createSession(session.agentId || 'general', 1, {
      expertId: childCtx.expertId,
      ephemeral: true,
      role: 'general',
      goal: String(childCtx.prompt || '').slice(0, 2000),
      projectId: session?.projectId,
    })
    childSession.run.id = childRunId
    childSession.run.permissions = JSON.parse(JSON.stringify(runPermissions || {}))
    childSession.knowledgeRefs = JSON.parse(JSON.stringify(session.knowledgeRefs || []))
    const parentIdentity = taskCapabilityIdentity(session)
    const getChildSession = () => loadAgentSessions().find(item => item.id === childSession.id) || null
    const getChildState = () => {
      const parent = loadAgentSessions().find(item => item.id === session.id)
      const current = getChildSession()
      if (!parent || !sameTaskCapabilityIdentity(parentIdentity, taskCapabilityIdentity(parent))
        || parent.run?.id !== runId
        || signal?.aborted || childCtx.signal?.aborted || ['cancelled', 'canceled'].includes(parent.run?.status)) return null
      const state = resolveChildCapabilityState({ parentSession: parent, childSession: current,
        expertRuntime: ensureCapabilityHub().expertRuntime(), userData: userDataPath,
        parentPermissions: runPermissions, parentPolicy: surface.resolvedSurface?.governancePolicy,
        noTools: surface.noTools })
      if (state) {
        // The skill runtime closes over this session object; refresh its ceiling before each dispatch.
        Object.assign(childSession.run.permissions, {
          allowedSkillIds: state.scope.allowedSkillIds, allowedKnowledgeIds: state.scope.allowedKnowledgeIds,
          capabilities: state.ceiling.capabilities,
        })
        state.connectors = getConnectorsApi().loadConnectors?.() || []
        state.availableConnectorIds = state.connectors.filter(conn => conn.enabled !== false).map(conn => conn.id)
      }
      return state
    }
    saveAgentSessions([...loadAgentSessions(), childSession])
    const initialChildState = getChildState()
    if (!initialChildState) throw Object.assign(new Error('父任务或子任务授权已失效'), { code: 'scope_denied' })
    const validateExecutionApproval = createCapabilityExecutionCheck({ session: childSession, runId: childRunId,
      signal: childCtx.signal, getSession: getChildSession, getState: getChildState,
      getConnectors: () => getConnectorsApi().loadConnectors?.() || [],
    })
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
    const childArtifactTools = agentArtifactTools.buildArtifactTools({
      runId: childRunId,
      projectId: childSession.projectId,
      taskId: childSession.taskRef?.id,
    })
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
    const childSkillTools = ensureCapabilityHub().buildSkillToolsForSession(childSession, sandboxPermissions, {
      getCurrentSession: getChildSession, getCapabilityState: getChildState,
    })
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
    const childBindings = initialChildState.scope
    const childExpertSnapshot = childCtx.expertId
      ? ensureCapabilityHub().expertRuntime().loadExpert(childCtx.expertId)
      : null
    const childResolvedSurface = await resolveToolSurfaceForRun({
      userData: userDataPath,
      runId: childRunId,
      parentRunId: childCtx.parentRunId,
      subRunId: childRunId,
      sessionId: childSession.id,
      executionApprovalRecoveryRunId: require('./agent-execution-approval-recovery')
        .getHostExecutionApprovalRecoveryRunId(getChildSession()),
      fileAdapter: fileTools?.fileAdapter,
      processTools: childProcessTools,
      artifactTools: childArtifactTools,
      orchestrationTools: childOrchestrationTools,
      extraTools: childExtraTools,
      permissions: runPermissions,
      governancePolicy: initialChildState.governancePolicy,
      validateExecutionApproval,
      expertSnapshot: childExpertSnapshot?.ok ? childExpertSnapshot : null,
      allowedConnectorIds: childBindings.allowedConnectorIds,
      signal: childCtx.signal,
      recordReceipt: receipt => teamRuntime.store.writeReceipt(
        childRunId,
        receipt.idempotencyKey || receipt.auditId || `receipt_${Date.now()}`,
        { result: receipt.envelope || receipt },
      ),
      connectorBuild: cOpts => connectorToolRuntime.buildConnectorToolSurface(userDataPath, {
        executionApprovalContext: { runId: childRunId, sessionId: childSession.id, validateExecutionApproval,
          signal: childCtx.signal, approvalFileRoot: fileTools?.fileAdapter?.rootPath },
        extraTools: cOpts.extraTools,
        allowedConnectorIds: childBindings.allowedConnectorIds,
        registry: cOpts.registry,
        resolveRuntimeOptions: conn => getConnectorsApi().resolveRuntimeOptions(conn),
      }),
    })
    const childToolSurface = guardCapabilityToolSurface(childResolvedSurface.surface, getChildState)
    const childKnowledge = buildChildKnowledgeTools({ libs: L, deps: env.deps, prepared,
      getSession: getChildSession, getState: getChildState })
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
      toolSurface: childToolSurface,
      toolExecutor: childToolSurface.createToolExecutor({
        searchKnowledge: childKnowledge.queryKnowledge,
        fabricSearch: childKnowledge.queryKnowledge,
        kbQuery: childKnowledge.kbQueryTool,
        kbGet: childKnowledge.kbGetTool,
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
      orchestration: makeOrchestrationPort(env, teamRuntime, runId)(childRunId),
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
  }
}

/** 父 run 编排口：绑定输出桥、级联取消子 run。 */
function makeOrchestrationPort(env, teamRuntime, runId) {
  const { agentProcessTools } = L
  const { agentRuntimeOutputBridges } = env.deps
  return (currentRunId) => ({
    bindOutputEmitter: (bridge) => {
      if (currentRunId === runId) agentRuntimeOutputBridges.set(runId, bridge)
    },
    cancelAll: ({ reason = 'parent_cancelled' } = {}) => (
      teamRuntime.manager.cancelAllChildren(currentRunId, reason)
    ),
    cancelCascade: (reason) => teamRuntime.manager.cancelAllChildren(currentRunId, reason),
    cancelAllSubRuns: ({ reason = 'parent_cancelled' } = {}) => (
      teamRuntime.manager.cancelAllChildren(currentRunId, reason)
    ),
    cancelSubRun: (subRunId) => teamRuntime.manager.cancelRun(subRunId, 'parent_cancelled'),
    cancelProcessesForRun: agentProcessTools.cancelProcessesForRun,
  })
}

module.exports = { createChildRunPortFactory, makeOrchestrationPort }
