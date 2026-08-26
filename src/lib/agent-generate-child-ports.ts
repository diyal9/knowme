'use strict'

/**
 * 子 Agent 端口：隔离会话 + 独立工具面，不共享父会话历史。
 * 由 execute 登记到 agentRuntimePortFactories，供编排 spawn。
 */

const L = require('./agent-generate-libs')

/** 工厂：为一次子 run 装配 ports；子会话 ephemeral，只继承一条父 system。 */
function createChildRunPortFactory(env, prepared, surface) {
  const {
    app, path, agentSessions, agentProcessTools, agentArtifactTools, agentOrchestration,
    agentSandbox, agentPlanTools, agentWebTools, resolveToolSurfaceForRun,
    getSessionCapabilityBindings, mergeExtraTools, connectorToolRuntime, buildProductionRunPorts,
    normalizeAssistantOutput,
  } = L
  const { ensureCapabilityHub, loadAgentSessions, saveAgentSessions, MEMORY_DIR, requestAgentCompletion, getConnectorsApi } = env.deps
  const { runId, signal } = env
  const { s, url, routedModel, policy, promptCachePolicy, tokenCalKey, modelProfile, queryKnowledge, kbQueryTool, kbGetTool } = prepared
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
        resolveRuntimeOptions: conn => getConnectorsApi().resolveRuntimeOptions(conn),
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
