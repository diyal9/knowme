'use strict'

const fs = require('fs')
const path = require('path')

const srcPath = path.join(__dirname, '..', 'src', 'ipc', 'ai-generate.ts')
const src = fs.readFileSync(srcPath, 'utf8')
const lines = src.split(/\r?\n/)

function sliceInclusive(startNeedle, endNeedle, endInclusive = true) {
  const start = lines.findIndex((l) => l.includes(startNeedle))
  const end = lines.findIndex((l, i) => i > start && l.includes(endNeedle))
  if (start < 0 || end < 0) {
    throw new Error(`slice failed: ${startNeedle} -> ${endNeedle} (${start}, ${end})`)
  }
  return lines.slice(start, endInclusive ? end + 1 : end).join('\n')
}

const prepareBody = sliceInclusive(
  "stage('stage_prepare', '正在准备上下文…'",
  "stage('stage_prepare', '上下文准备完成', 'done', { contextInfo })",
).replace(
  'return { text: resolved.clarification, runId, sessionId: session.id, toolCalls: 0 }',
  'return { early: { text: resolved.clarification, runId, sessionId: session.id, toolCalls: 0 } }',
)

const toolsBody = sliceInclusive(
  'const needsConnectorTools = tier !== \'chat\' || slashRefs.length > 0',
  'const feishuIntent = feishuGrounding.detectFeishuIntent(prompt)',
)

const childInner = sliceInclusive(
  'agentRuntimePortFactories.set(runId, async childCtx => {',
  'return childPorts',
)
const childBody = childInner
  .replace('agentRuntimePortFactories.set(runId, async childCtx => {', '')
  .replace(/\n    \}\}$/, '')

const kernelStart = lines.findIndex((l) => l.includes("if (resolveAgentExecutorMode() === 'kernel')"))
const kernelEnd = lines.findIndex((l, i) => i > kernelStart && l.trim() === '}')
// kernel block includes child factory; we'll replace factory with call

const libs = `'use strict'

const { app } = require('electron')
const path = require('path')
const promptRouter = require('./assistant-prompt-router')
const { buildSystemContent, buildChatMessages } = require('./ai-assistant-context')
const { normalizeAssistantOutput } = require('./assistant-output-style')
const productKnowledge = require('./product-knowledge')
const productMemory = require('./product-memory')
const conversationGrounding = require('./conversation-grounding')
const agentSessions = require('./agent-sessions')
const agentRun = require('./agent-run')
const agentTools = require('./agent-tools')
const agentVerify = require('./agent-verify')
const agentSandbox = require('./agent-sandbox')
const agentPlanTools = require('./agent-plan-tools')
const agentWebTools = require('./agent-web-tools')
const { resolveAgentExecutorMode, resolveGroundingRuntimeMode } = require('./agent-run-ports')
const groundingRuntime = require('./agent-grounding-runtime')
const feishuGroundingAdapter = require('./agent-grounding-feishu-adapter')
const { AgentRunExecutor } = require('./agent-run-executor')
const { buildProductionRunPorts } = require('./agent-run-kernel-adapter')
const llmRuntime = require('./llm-runtime')
const llmModelCatalog = require('./llm-model-catalog')
const llmUsage = require('./llm-usage')
const knowledgeOs = require('./knowledge-os')
const fabricRetrieval = require('./fabric-retrieval')
const chatIntent = require('./chat-intent')
const researchRouting = require('./research-routing')
const contextCache = require('./context-cache')
const contextOrchestrator = require('./agent-context-orchestrator')
const contextPacketLib = require('./context-packet')
const feishuGrounding = require('./feishu-grounding')
const writingWorkflow = require('./writing-workflow')
const connectorToolRuntime = require('./connectors/tool-runtime')
const agentProcessTools = require('./agent-process-tools')
const agentArtifactTools = require('./agent-artifact-tools')
const agentOrchestration = require('./agent-orchestration')
const knowledgeStewardTools = require('./knowledge-steward-tools')
const { isToolSurfaceV1 } = require('./tool-contract-registry')
const { resolveToolSurfaceForRun } = require('./tool-surface-builder')
const { getSessionCapabilityBindings } = require('./agent-context-assembly')
const { buildTemporalAnchorContext } = require('./temporal-anchor')
const { mergeExtraTools } = require('./merge-extra-tools')
const logger = require('./logger')

module.exports = {
  app, path, promptRouter, buildSystemContent, buildChatMessages, normalizeAssistantOutput,
  productKnowledge, productMemory, conversationGrounding, agentSessions, agentRun, agentTools,
  agentVerify, agentSandbox, agentPlanTools, agentWebTools, resolveAgentExecutorMode,
  resolveGroundingRuntimeMode, groundingRuntime, feishuGroundingAdapter, AgentRunExecutor,
  buildProductionRunPorts, llmRuntime, llmModelCatalog, llmUsage, knowledgeOs, fabricRetrieval,
  chatIntent, researchRouting, contextCache, contextOrchestrator, contextPacketLib,
  feishuGrounding, writingWorkflow, connectorToolRuntime, agentProcessTools, agentArtifactTools,
  agentOrchestration, knowledgeStewardTools, isToolSurfaceV1, resolveToolSurfaceForRun,
  getSessionCapabilityBindings, buildTemporalAnchorContext, mergeExtraTools, logger,
}
`

const prepareFile = `'use strict'

const L = require('./agent-generate-libs')

async function prepareAgentGenerate(env) {
  const {
    app, path, promptRouter, buildSystemContent, buildChatMessages, productKnowledge,
    productMemory, conversationGrounding, agentSessions, agentRun, groundingRuntime,
    feishuGroundingAdapter, llmRuntime, llmModelCatalog, llmUsage, knowledgeOs,
    fabricRetrieval, chatIntent, contextCache, contextOrchestrator, contextPacketLib,
    writingWorkflow, buildTemporalAnchorContext, logger, resolveGroundingRuntimeMode,
  } = L
  const {
    loadSettings, ensureAgentSession, saveAgentSessions, buildFabricCtx, ensureFabricSeeded,
    ensureCapabilityHub, readNote, buildEmbedFn, normalizeChatEndpoint, resolveActiveProvider,
    KNOWLEDGE_DIR, MEMORY_DIR, loadSourcesStore,
  } = env.deps
  const { payload, runId, stage, emit, fail, metrics } = env
  const {
    prompt, displayPrompt, context, history, noteId, category, skillRefs, taskId: rawTaskId,
    sessionId, agentId, contentGrounding, memoryToggles, role: payloadRole, expertId, surface, taskRef,
  } = payload

${prepareBody}

  return {
    session, ensured, s, url, theme, slashRefs, requestedTaskId, ctxRole, grounding, writingTask,
    forceFullCtx, tier, todayPriorityFactsOnly, heavyCtx, retrievalScope, localKnowledgeEnabled,
    kbSnippet, skillCtx, baseMemCtx, embedFn, queryKnowledge, kbQueryTool, kbGetTool, wikiCtx,
    memCtx, personalizationContext, effectivePersonalization, sessionSummary, sessionHistory,
    contextItems, lightPacket, workPacket, tokenCalKey, tokenCalBefore, routedModel, modelProfile,
    policy, promptCachePolicy, memoryPolicy, dynamicContextPack, writingPromptContext, capAssembly,
    effectivePrompt, groundingTaskFrame, dynamicContext, sceneId, systemContent, apiMessages,
    fittedConversation, contextInfo,
  }
}

module.exports = { prepareAgentGenerate }
`

// prepareBody uses memCtx etc that are defined between wikiCtx and tokenCal - they're in the slice. Good.

const toolsFile = `'use strict'

const L = require('./agent-generate-libs')

async function buildRunToolSurface(env, prepared) {
  const {
    app, path, agentTools, agentSandbox, agentPlanTools, agentWebTools, agentProcessTools,
    agentArtifactTools, agentOrchestration, knowledgeStewardTools, isToolSurfaceV1,
    resolveToolSurfaceForRun, getSessionCapabilityBindings, mergeExtraTools, researchRouting,
    llmRuntime, groundingRuntime, feishuGrounding, resolveGroundingRuntimeMode, connectorToolRuntime,
  } = L
  const {
    ensureCapabilityHub, ensureAgentTeamRuntime, getActiveSourceRoot, kosSourcesCtx,
    workbenchDaemon, buildActiveSourceFileTools,
  } = env.deps
  const { payload, runId, signal, stage, fail, metrics, controller } = env
  let { session } = prepared
  const {
    s, slashRefs, tier, embedFn, queryKnowledge, kbQueryTool, kbGetTool, apiMessages,
    policy, groundingTaskFrame: initialFrame, contextInfo, prompt,
  } = prepared
  let groundingTaskFrame = initialFrame
  let settleAdoptedRun = env.settleAdoptedRun

${toolsBody}

  return {
    session,
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
`

const childFile = `'use strict'

const L = require('./agent-generate-libs')

function createChildRunPortFactory(env, prepared, surface) {
  const {
    app, path, agentSessions, agentProcessTools, agentArtifactTools, agentOrchestration,
    agentSandbox, agentPlanTools, agentWebTools, resolveToolSurfaceForRun,
    getSessionCapabilityBindings, mergeExtraTools, connectorToolRuntime, buildProductionRunPorts,
    normalizeAssistantOutput,
  } = L
  const { ensureCapabilityHub, loadAgentSessions, saveAgentSessions, MEMORY_DIR, requestAgentCompletion } = env.deps
  const { runId, signal } = env
  const { s, url, routedModel, policy, promptCachePolicy, tokenCalKey, modelProfile, queryKnowledge, kbQueryTool, kbGetTool } = prepared
  const {
    session, runPermissions, sandboxEnabled, sandboxPermissions, fileTools, sourceRoot,
    orchestrationTools, userDataPath, apiMessages, teamRuntime,
  } = surface

  return async function childRunPortFactory(childCtx) {
${childBody.split('\n').map((l) => (l.startsWith('      ') ? l.slice(2) : l)).join('\n')}
  }
}

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
`

const executeFile = `'use strict'

const L = require('./agent-generate-libs')
const { prepareAgentGenerate } = require('./agent-generate-prepare')
const { buildRunToolSurface } = require('./agent-generate-tool-surface')
const { createChildRunPortFactory, makeOrchestrationPort } = require('./agent-generate-child-ports')

async function executeAgentGenerate(env) {
  const {
    AgentRunExecutor, buildProductionRunPorts, resolveAgentExecutorMode, resolveGroundingRuntimeMode,
    feishuGrounding, feishuGroundingAdapter, agentVerify, agentRun, writingWorkflow, llmUsage,
    productMemory, normalizeAssistantOutput, agentProcessTools, logger,
  } = L
  const {
    loadSettings, saveSettings_, loadAgentSessions, saveAgentSessions, getFeishuGroundingContext,
    hasPriorFeishuFacts, MEMORY_DIR, agentRuntimePortFactories, agentRuntimeOutputBridges,
    activeAgentRuns,
  } = env.deps
  const { payload, runId, signal, stage, emit, fail, metrics, runStartedAt } = env

  try {
    const prepared = await prepareAgentGenerate(env)
    if (prepared.early) return prepared.early

    const surface = await buildRunToolSurface(env, prepared)
    if (surface.early) return surface.early
    env.settleAdoptedRun = surface.settleAdoptedRun
    prepared.session = surface.session
    prepared.apiMessages = surface.apiMessages
    prepared.groundingTaskFrame = surface.groundingTaskFrame
    prepared.contextInfo = surface.contextInfo

    if (resolveAgentExecutorMode() !== 'kernel') {
      return fail(new Error('legacy agent executor is no longer supported'))
    }

    const {
      s, url, routedModel, policy, promptCachePolicy, tokenCalKey, tokenCalBefore, modelProfile,
      tier, session, ctxRole, writingTask, prompt, effectivePersonalization, groundingTaskFrame,
      contextInfo, apiMessages,
    } = prepared
    const {
      teamRuntime, toolSurface, toolExecutor, connectorRuntime, resolvedSurface, feishuIntent,
    } = surface

    const suppressStreamForFeishuGuard = !!(
      feishuIntent &&
      feishuIntent.mentioned &&
      (feishuIntent.needsSearch || feishuIntent.needsContentRead || feishuIntent.asksMinutes)
    )
    void suppressStreamForFeishuGuard

    const orchestrationPort = makeOrchestrationPort(env, teamRuntime, runId)
    agentRuntimePortFactories.set(runId, createChildRunPortFactory(env, prepared, surface))

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
      requestAgentCompletion: env.deps.requestAgentCompletion,
      onStreamChunk: null,
      runStartedAt,
      effectivePersonalization,
      ctxBundle: { contextInfo, taskFrame: groundingTaskFrame },
      loadAgentSessions,
      saveAgentSessions,
      productMemoryCapture: productMemory.capture,
      memoryDir: MEMORY_DIR,
      normalizeAssistantOutput,
      orchestration: orchestrationPort(runId),
      governancePolicy: resolvedSurface.governancePolicy,
      budget: session?.run?.budget || payload.budget || null,
      persistRunCheckpoint: checkpoint => teamRuntime.manager.saveCheckpoint(runId, 'latest', checkpoint),
      cancelProcessesForRun: agentProcessTools.cancelProcessesForRun,
      recordReceipt: receipt => teamRuntime.store.writeReceipt(
        runId,
        receipt.idempotencyKey || receipt.auditId || \`receipt_\${Date.now()}\`,
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
        const feishuGroundingContext = await getFeishuGroundingContext()
        if (resolveGroundingRuntimeMode() === 'legacy') {
          const feishuHint = feishuGrounding.buildFeishuGroundingHint(prompt, toolMsgs, fullText, {
            ...feishuGroundingContext,
            priorFeishuFacts: hasPriorFeishuFacts(sess),
          })
          if (feishuHint) return feishuHint
        } else {
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
          return \`\${String(fullText || '').trim()}\\n\\n---\\n\${planPartial}\`.trim()
        }
        return fullText
      },
    })
    try {
      const kernelResult = await AgentRunExecutor.run(payload, ports, emit)
      const failed = Boolean(kernelResult.error && (kernelResult.terminal === 'ERROR' || kernelResult.terminal === 'FAILED'))
      env.settleAdoptedRun = null
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
        streamed: kernelResult.streamed, runId, sessionId: finalSession.id,
        artifacts: finalSession?.run?.artifacts || [],
        toolCalls: kernelResult.metrics?.toolCalls || 0, compacted: false,
        metrics: kernelResult.metrics, protocolVersion: kernelResult.protocolVersion || null,
        answerHash: kernelResult.answerHash || null, terminal: kernelResult.terminal || null,
        text: String(kernelResult.text || ''),
        personalization: {
          applied: effectivePersonalization.applied.map(item => ({
            id: item.id, kind: item.kind, text: item.text,
          })),
          omitted: effectivePersonalization.omitted,
        },
      }
    } catch (err) {
      env.settleAdoptedRun = null
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
}

module.exports = { executeAgentGenerate }
`

const ipcFile = `'use strict'

const { humanizeAgentError } = require('../lib/agent-error-humanize')
const { assertRequiredDeps } = require('../lib/ipc-assert-deps')
const { executeAgentGenerate } = require('../lib/agent-generate-execute')
const { buildTemporalAnchorContext } = require('../lib/temporal-anchor')
const { mergeExtraTools } = require('../lib/merge-extra-tools')
const { normalizeAssistantOutput } = require('../lib/assistant-output-style')

void buildTemporalAnchorContext
void mergeExtraTools
void normalizeAssistantOutput

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
  const { activeAgentRuns } = deps
  ipcMain.handle('ai-generate', async (e, payload = {}) => {
    const { sessionId } = payload
    const webContents = e.sender
    const runId = String(payload.runId || \`run_\${Date.now()}_\${Math.random().toString(36).slice(2, 8)}\`)
    const controller = new AbortController()
    const signal = controller.signal
    activeAgentRuns.set(runId, controller)
    const runStartedAt = Date.now()
    const metrics = { rounds: 0, toolCalls: 0, firstTokenMs: null }
    const trace = []
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
    const env = {
      deps,
      payload,
      runId,
      signal,
      controller,
      metrics,
      runStartedAt,
      stage,
      emit,
      fail,
      get settleAdoptedRun() { return settleAdoptedRun },
      set settleAdoptedRun(value) { settleAdoptedRun = value },
    }
    return executeAgentGenerate(env)
  })
}

module.exports = { registerAiGenerateIpc, AI_GENERATE_REQUIRED_DEPS }
`

const outDir = path.join(__dirname, '..', 'src', 'lib')
fs.writeFileSync(path.join(outDir, 'agent-generate-libs.ts'), libs)
fs.writeFileSync(path.join(outDir, 'agent-generate-prepare.ts'), prepareFile)
fs.writeFileSync(path.join(outDir, 'agent-generate-tool-surface.ts'), toolsFile)
fs.writeFileSync(path.join(outDir, 'agent-generate-child-ports.ts'), childFile)
fs.writeFileSync(path.join(outDir, 'agent-generate-execute.ts'), executeFile)
fs.writeFileSync(srcPath, ipcFile)

for (const file of [
  'agent-generate-libs.ts',
  'agent-generate-prepare.ts',
  'agent-generate-tool-surface.ts',
  'agent-generate-child-ports.ts',
  'agent-generate-execute.ts',
  '../ipc/ai-generate.ts',
]) {
  const full = path.join(outDir, file)
  const n = fs.readFileSync(full, 'utf8').split(/\n/).length
  console.log(n, file)
}
