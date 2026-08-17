'use strict'

/**
 * ai-generate 共享依赖桶：集中 require，避免 prepare/execute/tool-surface 重复加载。
 * 不含业务编排。
 */

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

/** 本轮知识检索三件套；范围 degraded 时 query 返回空 hits 而非抛错。 */
function createKnowledgeTools({ app, fabricRetrieval, retrievalScope, embedFn, ensureFabricSeeded, buildFabricCtx }) {
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
    { ...buildFabricCtx(), signal: querySignal },
  )
  const kbGetTool = async (ref) => fabricRetrieval.kbGet(app.getPath('userData'), ref, buildFabricCtx())
  return { queryKnowledge, kbQueryTool, kbGetTool }
}

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
  createKnowledgeTools,
}
