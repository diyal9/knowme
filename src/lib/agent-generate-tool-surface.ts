'use strict'

/**
 * 为本轮 run 装配工具面、沙箱权限与 teamRuntime.adopt。
 * chat 且无 slash 时不挂连接器/进程工具。
 */

const L = require('./agent-generate-libs')

/** 成功返回 surface 字段；缺必需工具时 `{ early }`。 */
async function buildRunToolSurface(env, prepared) {
  const {
    app, path, agentTools, agentSandbox, agentPlanTools, agentWebTools, agentProcessTools,
    agentArtifactTools, agentOrchestration, knowledgeStewardTools, agentCapabilityImportTools, isToolSurfaceV1,
    resolveToolSurfaceForRun, getSessionCapabilityBindings, mergeExtraTools, researchRouting,
    llmRuntime, groundingRuntime, feishuGrounding, resolveGroundingRuntimeMode, connectorToolRuntime, contextEngine,
  } = L
  const {
    ensureCapabilityHub, ensureAgentTeamRuntime, getActiveSourceRoot, kosSourcesCtx,
    workbenchDaemon, buildActiveSourceFileTools, getConnectorsApi,
  } = env.deps
  const { payload, runId, signal, metrics, controller } = env
  const fail = (error) => ({ early: env.fail(error) })
  const sessionId = payload.sessionId
  let { session } = prepared
  const {
    s, slashRefs, tier, embedFn, queryKnowledge, kbQueryTool, kbGetTool,
    policy, groundingTaskFrame: initialFrame, contextInfo, prompt, researchPrompt,
  } = prepared
  // research 路由可能改写对话消息，须 let（原先 const 会在注入时抛 Assignment to constant variable）
  let apiMessages = prepared.apiMessages
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
  if (noTools) {
    groundingTaskFrame = null
    if (session && typeof session === 'object') session.referenceState = undefined
  }
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
  const capabilityImportTools = session?.expertId === agentCapabilityImportTools.IMPORT_EXPERT_ID
    ? agentCapabilityImportTools.buildCapabilityImportTools({ hub: ensureCapabilityHub() })
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
    capabilityImportTools,
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
        resolveRuntimeOptions: conn => getConnectorsApi().resolveRuntimeOptions(conn),
      }),
    })
    : {
      surface: agentTools.createToolSurface({
        includeBuiltins: !noTools,
        extraDefinitions: noTools ? [] : (extraTools?.definitions || []),
        handlers: noTools ? {} : (extraTools?.handlers || {}),
      }),
      close: async () => {},
      mode: 'minimal',
    }
  const toolSurface = resolvedSurface.surface
  const connectorRuntime = { close: resolvedSurface.close, mcpProjectionError: resolvedSurface.mcpProjectionError }
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
        toolRecords: typeof toolSurface.getToolRecords === 'function'
          ? toolSurface.getToolRecords()
          : toolSurface.getToolDefinitions(),
      })
  if (researchRoute.active) {
    const researchAssembly = contextEngine.assembleContext({
      policy: {
        tier,
        scene: 'research',
        locale: s.locale || 'zh-CN',
        toolsEnabled: true,
        executionPolicy: effectiveExecutionPolicy,
      },
      blocks: [{
        id: 'scene.research-runtime',
        kind: 'scene_instruction',
        priority: 96,
        maxTokens: 1200,
        cachePolicy: 'turn',
        content: researchRoute.context,
        source: { type: 'research-routing', id: researchRoute.intent.mode, version: '1' },
      }],
      budget: 1200,
    })
    apiMessages = llmRuntime.fitConversation(
      researchRouting.injectResearchContext(apiMessages, researchAssembly.messages[0]?.content || ''),
      policy.inputBudget,
    ).messages
    contextInfo.contextManifest = contextEngine.mergeContextManifests(
      contextInfo.contextManifest,
      researchAssembly.manifest,
    )
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

  return {
    session,
    noTools,
    needsConnectorTools,
    fileTools,
    sourceRoot,
    processTools,
    artifactTools,
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
    extraTools,
    userDataPath,
    resolvedSurface,
    toolSurface,
    connectorRuntime,
    researchRoute,
    apiMessages,
    groundingTaskFrame,
    contextInfo,
    toolExecutor,
    feishuIntent,
  }
}

module.exports = { buildRunToolSurface }
