'use strict'

const externalWorkflowRecipes = require('../lib/external-workflow-recipes')
const connectorDependencies = require('../lib/connectors/dependency-resolver')

/**
 * Workbench local Agent Graph plan / validate / start / run-tree / gate decision.
 */
function registerWorkbenchAgentGraphIpc(ipcMain, deps) {
  const {
    crypto,
    ensureCapabilityHub,
    compileWorkbenchAgentGraphPayload,
    workbenchAgentGraph,
    resolveWorkbenchAgentPackage,
    loadSettings,
    ensureAgentTeamRuntime,
    workbenchAgentRunControllers,
    workbenchAgentRunEvents,
    createWorkbenchAgentPortFactory,
    agentRuntimePortFactories,
    getWorkbenchAgentTeamRunner,
    workbenchAgentGateWaiters,
    agentArtifactTools,
    workbenchAgentEventList,
    getWorkbenchWorkflowPackageStore,
    getConnectorsApi,
  } = deps
  const externalRunContexts = deps.workbenchExternalRunContexts || new Map()
  const externalPreflightDeps = () => ({
    assessConnectors: (pkg, context) => connectorDependencies.assessConnectorRequirements(pkg, context, {
      getConnectorStatus: id => getConnectorsApi().getConnectorStatus(id),
    }),
  })

  const loadExecutionPackage = (workflowId) => {
    const id = String(workflowId || '').trim()
    if (!id || typeof getWorkbenchWorkflowPackageStore !== 'function') return null
    const hit = getWorkbenchWorkflowPackageStore().get(id)
    return hit?.ok && hit.package
      ? externalWorkflowRecipes.enrichExternalWorkflowPackage(hit.package)
      : null
  }

  const graphPayloadFromPackage = (payload, pkg) => {
    if (!pkg) return payload
    const nodes = Array.isArray(pkg.graph?.nodes) ? pkg.graph.nodes : []
    return {
      ...payload,
      teamPackageId: pkg.id,
      teamName: pkg.name,
      version: pkg.version,
      nodes,
      edges: Array.isArray(pkg.graph?.edges) ? pkg.graph.edges : [],
      gates: Array.isArray(pkg.graph?.gates) ? pkg.graph.gates : [],
      parallelism: Number(pkg.graph?.parallelism || 1),
      joinStrategy: String(pkg.graph?.joinStrategy || 'allSucceeded'),
      members: nodes.filter(node => node.type === 'agent' && node.agentPackageId).map(node => ({
        id: node.id,
        expertId: node.agentPackageId,
        agentPackageId: node.agentPackageId,
        profileId: node.profileId || '',
        role: node.role || node.name || node.id,
        intent: node.intent || payload.goal || '',
      })),
    }
  }

  ipcMain.handle('workbench-external-workflow-preflight', async (_e, payload = {}) => {
    const pkg = loadExecutionPackage(payload.workflowId || payload.teamPackageId)
    if (!pkg || !externalWorkflowRecipes.isArtBundlePackage(pkg)) {
      return { ok: true, supported: false, checks: [] }
    }
    const result = await externalWorkflowRecipes.preflightExternalWorkflow(pkg, payload.inputs || {}, externalPreflightDeps())
    if (!result.ok) return { ...result, context: undefined }
    return { ...result, context: undefined }
  })

  ipcMain.handle('workbench-agent-graph-plan', (_e, payload = {}) => {
    const goal = String(payload.goal || '').trim()
    if (!goal) return { ok: false, code: 'missing_goal', error: '请先填写任务目标' }
    const experts = ensureCapabilityHub().expertRuntime().listExperts()
    const result = compileWorkbenchAgentGraphPayload(payload)
    return {
      ...result,
      goal,
      availableAgents: experts.map(expert => ({
        id: expert.id,
        name: expert.name,
        description: expert.description,
        skills: expert.skills || [],
        contentHash: expert.contentHash || '',
      })),
    }
  })

  ipcMain.handle('workbench-agent-graph-validate', (_e, payload = {}) => (
    compileWorkbenchAgentGraphPayload(payload)
  ))

  ipcMain.handle('workbench-agent-graph-start', async (_e, payload = {}) => {
    const executionPackage = loadExecutionPackage(payload.teamPackageId || payload.workflowId)
    const executionPayload = graphPayloadFromPackage(payload, executionPackage)
    if (executionPackage && externalWorkflowRecipes.isArtBundlePackage(executionPackage)) {
      const preflight = await externalWorkflowRecipes.preflightExternalWorkflow(executionPackage, payload.inputs || {}, externalPreflightDeps())
      if (!preflight.ok) return { ...preflight, context: undefined }
    } else if (executionPackage) {
      const connectorGate = await connectorDependencies.assessConnectorRequirements(executionPackage, payload.inputs || {}, {
        getConnectorStatus: id => getConnectorsApi().getConnectorStatus(id),
      })
      if (!connectorGate.ok) return connectorGate
    }
    const compiled = executionPayload.teamPackage && executionPayload.snapshot
      ? workbenchAgentGraph.compileWorkbenchAgentGraph(executionPayload.composition || executionPayload, {
        resolveAgentPackage: resolveWorkbenchAgentPackage,
      })
      : compileWorkbenchAgentGraphPayload(executionPayload)
    if (!compiled.ok) return compiled
    const settings = loadSettings()
    if (!settings.apiKey || !settings.apiEndpoint) {
      return {
        ok: false,
        code: 'agent_runtime_not_configured',
        error: '请先配置 AI API Key 和 Endpoint，再启动本地 Agent Graph',
        composition: compiled.composition,
        snapshot: compiled.snapshot,
      }
    }
    const runtime = ensureAgentTeamRuntime()
    if (!runtime.enabled) {
      return { ok: false, code: 'agent_team_runtime_disabled', error: '本地 Agent Team Runtime 已关闭' }
    }
    const rootRunId = `workbench_graph_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`
    const controller = new AbortController()
    const allowedSubExperts = compiled.teamPackage.members.map(member => member.agentPackageId)
    const permissions = payload.permissions && typeof payload.permissions === 'object'
      ? payload.permissions
      : {}
    const budget = payload.budget && typeof payload.budget === 'object' ? payload.budget : {}
    const adopted = runtime.manager.adoptRunningRun({
      runId: rootRunId,
      abortController: controller,
      budget,
      governanceEnvelope: {
        permissions,
        orchestration: {
          allowDelegate: false,
          maxParallel: compiled.teamPackage.workflow.parallelism,
          allowedSubExperts,
        },
      },
      meta: {
        workbenchAgentGraph: true,
        goal: compiled.composition.goal,
        teamPackageId: compiled.teamPackage.packageId,
        compositionHash: compiled.snapshot.compositionHash,
      },
    })
    if (!adopted.ok) return adopted
    workbenchAgentRunControllers.set(rootRunId, controller)
    externalRunContexts.set(rootRunId, {
      package: executionPackage,
      inputs: payload.inputs || {},
      permissions,
    })
    workbenchAgentRunEvents.set(rootRunId, [{
      type: 'workbench.graph.started',
      rootRunId,
      goal: compiled.composition.goal,
      at: new Date().toISOString(),
    }])
    try {
      createWorkbenchAgentPortFactory({
        rootRunId,
        goal: compiled.composition.goal,
        permissions,
        workflowPackage: executionPackage,
        workflowInputs: payload.inputs || {},
      })
    } catch (error) {
      runtime.manager.completeAdoptedRun(rootRunId, {
        terminal: 'failed',
        status: 'failed',
        summary: error.message || '本地 Agent Runtime 初始化失败',
        stopReason: 'runtime_setup_failed',
      })
      workbenchAgentRunControllers.delete(rootRunId)
      agentRuntimePortFactories.delete(rootRunId)
      externalRunContexts.delete(rootRunId)
      return { ok: false, code: 'runtime_setup_failed', error: error.message || '本地 Agent Runtime 初始化失败' }
    }
    const runner = getWorkbenchAgentTeamRunner()
    void runner.run(compiled.teamPackage, {
      goal: compiled.composition.goal,
      inputs: payload.inputs || {},
    }, {
      rootRunId,
      budget,
      governanceEnvelope: {
        permissions,
        orchestration: {
          allowDelegate: false,
          maxParallel: compiled.teamPackage.workflow.parallelism,
          allowedSubExperts,
        },
      },
    }).then(result => {
      const events = workbenchAgentRunEvents.get(rootRunId) || []
      events.push({ type: 'workbench.graph.terminal', rootRunId, result, at: new Date().toISOString() })
      workbenchAgentRunEvents.set(rootRunId, events.slice(-120))
      workbenchAgentRunControllers.delete(rootRunId)
      agentRuntimePortFactories.delete(rootRunId)
      externalRunContexts.delete(rootRunId)
      for (const [key, waiter] of workbenchAgentGateWaiters.entries()) {
        if (waiter.rootRunId === rootRunId) workbenchAgentGateWaiters.delete(key)
      }
    }).catch(error => {
      const events = workbenchAgentRunEvents.get(rootRunId) || []
      events.push({
        type: 'workbench.graph.error',
        rootRunId,
        error: error.message || '本地 Agent Graph 执行失败',
        at: new Date().toISOString(),
      })
      workbenchAgentRunEvents.set(rootRunId, events.slice(-120))
      workbenchAgentRunControllers.delete(rootRunId)
      agentRuntimePortFactories.delete(rootRunId)
      externalRunContexts.delete(rootRunId)
    })
    return {
      ok: true,
      rootRunId,
      mode: 'agent-graph',
      composition: compiled.composition,
      teamPackage: compiled.teamPackage,
      snapshot: compiled.snapshot,
    }
  })

  ipcMain.handle('workbench-agent-run-tree', (_e, payload = {}) => {
    const rootRunId = String(payload.rootRunId || '').trim()
    if (!rootRunId) return { ok: false, code: 'missing_root_run_id', error: '缺少 rootRunId' }
    const runtime = ensureAgentTeamRuntime()
    const tree = runtime.manager.getRunTree(rootRunId)
    if (!tree.ok) return tree
    const pendingGates = [...workbenchAgentGateWaiters.values()]
      .filter(item => item.rootRunId === rootRunId)
      .map(item => ({ nodeId: item.nodeId }))
    const artifactsById = new Map()
    for (const runId of Object.keys(tree.nodes || {})) {
      for (const artifact of agentArtifactTools.listArtifacts(undefined, runId)) {
        if (artifact?.id) artifactsById.set(String(artifact.id), artifact)
      }
    }
    return {
      ...tree,
      rootRunId,
      events: workbenchAgentEventList(rootRunId),
      pendingGates,
      artifacts: [...artifactsById.values()],
    }
  })

  ipcMain.handle('workbench-agent-run-decision', (_e, payload = {}) => {
    const rootRunId = String(payload.rootRunId || '').trim()
    const nodeId = String(payload.nodeId || '').trim()
    const decision = String(payload.decision || '').trim().toLowerCase()
    if (!rootRunId || !nodeId) return { ok: false, code: 'missing_gate_identity', error: '缺少审批节点标识' }
    if (!['approve', 'reject', 'revise'].includes(decision)) {
      return { ok: false, code: 'invalid_gate_decision', error: '不支持的审批决定' }
    }
    const key = `${rootRunId}:${nodeId}`
    const waiter = workbenchAgentGateWaiters.get(key)
    if (!waiter) return { ok: false, code: 'gate_not_waiting', error: '当前没有等待中的审批节点' }
    workbenchAgentGateWaiters.delete(key)
    waiter.resolve({
      approved: decision === 'approve',
      reason: String(payload.reason || decision),
    })
    return { ok: true, rootRunId, nodeId, decision }
  })
}

module.exports = { registerWorkbenchAgentGraphIpc }
