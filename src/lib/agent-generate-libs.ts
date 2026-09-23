'use strict'

/**
 * ai-generate 共享依赖桶：集中 require，避免 prepare/execute/tool-surface 重复加载。
 * 不含业务编排。
 */

const { app } = require('electron')
const path = require('path')
const promptRouter = require('./assistant-prompt-router')
const { buildSystemContent, buildChatMessages } = require('./ai-assistant-context')
const contextEngine = require('./context-engine')
const { buildCoreContextBlocks } = require('./knowme-system-prompt')
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
const brainService = require('./brain-service')
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
const agentImageTools = require('./agent-image-tools')
const agentOrchestration = require('./agent-orchestration')
const knowledgeStewardTools = require('./knowledge-steward-tools')
const agentCapabilityImportTools = require('./agent-capability-import-tools')
const agentRegistryTools = require('./agent-registry-tools')
const { isToolSurfaceV1 } = require('./tool-contract-registry')
const { resolveToolSurfaceForRun } = require('./tool-surface-builder')
const { getSessionCapabilityBindings } = require('./agent-context-assembly')
const { buildTemporalAnchorContext } = require('./temporal-anchor')
const { mergeExtraTools } = require('./merge-extra-tools')
const logger = require('./logger')
const { parseKnowledgeCollectionRef } = require('../shared/knowledge-selection')

/** 本轮知识检索三件套；范围 degraded 时 query 返回空 hits 而非抛错。 */
function createKnowledgeTools({ app, fabricRetrieval, knowledgeProvider, retrievalScope, knowledgePolicy = {}, embedFn, ensureFabricSeeded, buildFabricCtx, getCurrentScope = null, projectId = undefined }) {
  const scopedProviderPolicies = Array.isArray(knowledgePolicy.providers) ? knowledgePolicy.providers : []
  const retrievalProviders = Array.isArray(retrievalScope.providers) ? retrievalScope.providers : []
  const providers = retrievalProviders.filter(provider => scopedProviderPolicies.some(policy => policy.providerId === provider.id))
    .flatMap(provider => {
      const policy = scopedProviderPolicies.find(item => item.providerId === provider.id)
      const configured = (provider.collectionIds || [provider.collectionId || provider.collection].filter(Boolean)).map(String)
      if (!configured.length) return [{ ...provider }]
      const collectionIds = configured.filter(id => (policy.collectionIds || []).map(String).includes(id))
      // Empty collection policy is denial, not permission to fall back to every configured collection.
      return collectionIds.length ? [{ ...provider, collectionIds, collection: collectionIds[0] }] : []
    })
  const allowedCollections = new Set(scopedProviderPolicies.flatMap((policy) => {
    const provider = providers.find(item => item.id === policy.providerId)
    const collectionIds = Array.isArray(policy.collectionIds) ? policy.collectionIds.filter(Boolean).map(String) : []
    if (collectionIds.length) return collectionIds
    const providerCollections = [provider?.collectionId, provider?.collection, ...(provider?.collectionIds || [])].filter(Boolean)
    return providerCollections.length ? [] : [policy.providerId]
  }))
  const resolveKnowledgeTarget = (rawCollection) => {
    const raw = String(rawCollection || '').trim()
    if (!raw) return null
    const scopedRef = parseKnowledgeCollectionRef(raw)
    for (const provider of providers) {
      // RAG Dataset selections use an opaque ref in the session. Resolve it
      // back to provider + dataset before handling legacy plain IDs/names.
      const legacySeparator = raw.indexOf(':')
      const legacyProviderId = legacySeparator > 0 ? raw.slice(0, legacySeparator) : ''
      const legacyCollectionId = legacySeparator > 0 ? raw.slice(legacySeparator + 1) : ''
      const scopedProviderId = scopedRef?.providerId || legacyProviderId
      const scopedCollectionId = scopedRef?.collectionId || legacyCollectionId
      if (scopedProviderId) {
        if (String(provider.id) !== scopedProviderId) continue
        const collectionId = String(scopedCollectionId)
        const allowed = (provider.collectionIds || []).map(String)
        return allowed.includes(collectionId) ? { provider, collectionId } : null
      }
      const providerIds = [provider.id, provider.collectionId, provider.collection, ...(provider.collectionIds || [])]
        .filter(Boolean).map(String)
      if (providerIds.includes(raw)) {
        const collectionId = (provider.collectionIds || []).map(String).includes(raw) ? raw : null
        return { provider, collectionId }
      }
      const namedCollection = (provider.collections || []).find((item) =>
        String(item?.id || '') === raw || String(item?.name || '').trim() === raw)
      if (namedCollection && (provider.collectionIds || []).map(String).includes(String(namedCollection.id))) {
        return { provider, collectionId: String(namedCollection.id) }
      }
      if (String(provider.displayName || provider.name || '').trim() === raw) {
        return { provider, collectionId: null }
      }
    }
    return null
  }
  const allowedRefs = new Set()
  const rememberRefs = (result) => {
    if (Array.isArray(result?.hits)) result = { ...result, hits: require('./knowledge-hit-projection').uniqueKnowledgeHits(result.hits) }
    for (const hit of result?.hits || []) {
      const ref = String(hit?.ref || hit?.refKey || hit?.documentRef || hit?.path || '').trim()
      if (ref) allowedRefs.add(ref)
    }
    return result
  }
  const querySelectedRag = async (query, querySignal) => {
    const ragProviders = providers.filter(provider => provider.kind === 'ragflow')
    if (!ragProviders.length) return null
    if (knowledgePolicy.allowRemoteQuery !== true) {
      return { ok: false, code: 'remote_query_denied', hits: [], error: '当前 Agent 未获授权访问远程知识库' }
    }
    const fabricCtx = typeof buildFabricCtx === 'function' ? (buildFabricCtx() || {}) : {}
    const queryProvider = typeof fabricCtx.queryProvider === 'function'
      ? fabricCtx.queryProvider
      : knowledgeProvider && typeof knowledgeProvider.queryProvider === 'function'
        ? (provider, query, options) => knowledgeProvider.queryProvider(provider, query, options)
        : null
    if (!queryProvider) {
      return { ok: false, hits: [], message: 'RAG 检索执行器未配置', code: 'rag_executor_missing' }
    }
    const results = await Promise.all(ragProviders.map(async (provider) => {
      const policy = scopedProviderPolicies.find(item => item.providerId === provider.id)
      const collectionIds = Array.isArray(policy?.collectionIds) && policy.collectionIds.length
        ? policy.collectionIds.map(String)
        : (provider.collectionIds || []).map(String)
      return queryProvider(provider, query, {
        ...fabricCtx,
        providers,
        collectionIds,
        signal: querySignal,
      })
    }))
    const hits = results.flatMap(result => Array.isArray(result?.hits) ? result.hits : [])
    const failed = results.find(result => result?.ok === false)
    if (!hits.length && failed) return failed
    return {
      ok: true,
      hits,
      message: hits.length ? null : results.map(result => result?.message).filter(Boolean).join('；') || '所选 RAG Dataset 未命中',
      diagnostics: {
        mode: 'direct-rag',
        providers: ragProviders.map(provider => provider.id),
        results: results.map(result => result?.diagnostics || null).filter(Boolean),
      },
    }
  }
  const queryKnowledge = async (query, querySignal) => {
    // Local Brain is independent of mounted Wiki/RAG providers. A missing
    // default provider must not disable authorized native cognition; an explicit
    // unavailable selection still fails closed instead of searching elsewhere.
    const nativeBrainAvailable = retrievalScope.mode === 'default' && knowledgePolicy.brainScopes?.length > 0
    if (retrievalScope.degraded && !nativeBrainAvailable) {
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
    const directRag = await querySelectedRag(query, querySignal)
    if (directRag) {
      return rememberRefs(directRag)
    }
    const result = await brainService.query(userData, {
      text: query,
      ...(projectId !== undefined ? { projectId } : {}),
      mode: 'mixed',
      maxProviders: 3,
      maxCollectionsPerProvider: 2,
      knowledgePolicy: {
        brainScopes: Array.isArray(knowledgePolicy.brainScopes) ? knowledgePolicy.brainScopes : ['project'],
        providers: scopedProviderPolicies,
        allowPersonalMemory: knowledgePolicy.allowPersonalMemory === true,
        allowRemoteQuery: knowledgePolicy.allowRemoteQuery !== false && providers.length > 0,
        allowPromotionProposal: knowledgePolicy.allowPromotionProposal !== false,
        allowDirectWrite: false,
      },
    }, {
      ...buildFabricCtx(),
      providers,
      fabricSearch: fabricRetrieval.fabricSearch,
      embed: embedFn,
      signal: querySignal,
    })
    return rememberRefs(result)
  }
  const kbQueryTool = async (collection, query, querySignal) => {
    const collectionId = String(collection || '').trim()
    const target = resolveKnowledgeTarget(collectionId)
    if (!target || (target.collectionId && !allowedCollections.has(target.collectionId))) {
      return {
        ok: false,
        code: 'knowledge_scope_denied',
        message: `当前 Agent 未获授权读取该知识库：${collectionId.slice(0, 120)}`,
        error: `当前 Agent 未获授权读取该知识库：${collectionId.slice(0, 120)}`,
      }
    }
    const provider = target.provider
    if (provider && ['remote-rag', 'ragflow'].includes(provider.kind) && knowledgePolicy.allowRemoteQuery !== true) {
      return {
        ok: false,
        code: 'remote_query_denied',
        message: `当前 Agent 未获授权访问远程知识库：${provider.displayName || provider.id}`,
        error: `当前 Agent 未获授权访问远程知识库：${provider.displayName || provider.id}`,
      }
    }
    if (provider && ['remote-rag', 'ragflow'].includes(provider.kind)) {
      const fabricCtx = typeof buildFabricCtx === 'function' ? (buildFabricCtx() || {}) : {}
      const queryProvider = typeof fabricCtx.queryProvider === 'function'
        ? fabricCtx.queryProvider
        : knowledgeProvider && typeof knowledgeProvider.queryProvider === 'function'
          ? (targetProvider, targetQuery, options) => knowledgeProvider.queryProvider(targetProvider, targetQuery, options)
          : null
      const selectedCollections = target.collectionId ? [target.collectionId] : provider.collectionIds
      if (queryProvider) {
        return rememberRefs(await queryProvider(provider, query, {
          ...fabricCtx,
          providers,
          collectionIds: selectedCollections,
          signal: querySignal,
        }))
      }
    }
    const result = await fabricRetrieval.kbQuery(
      app.getPath('userData'),
      target.collectionId || collectionId,
      query,
      { ...buildFabricCtx(), providers, signal: querySignal },
    )
    return rememberRefs(result)
  }
  const kbGetTool = async (ref) => {
    const refId = String(ref || '').trim()
    if (!refId || !allowedRefs.has(refId)) {
      return { ok: false, code: 'knowledge_scope_denied', error: '当前 Agent 未获授权读取该资料' }
    }
    return fabricRetrieval.kbGet(app.getPath('userData'), refId, buildFabricCtx())
  }
  return require('./agent-knowledge-request-guard').guardKnowledgeTools(
    { queryKnowledge, kbQueryTool, kbGetTool },
    { retrievalScope, knowledgePolicy, getCurrentScope, projectId },
  )
}

module.exports = {
  app, path, promptRouter, buildSystemContent, buildChatMessages, contextEngine, buildCoreContextBlocks, normalizeAssistantOutput,
  productKnowledge, productMemory, conversationGrounding, agentSessions, agentRun, agentTools,
  agentVerify, agentSandbox, agentPlanTools, agentWebTools, resolveAgentExecutorMode,
  resolveGroundingRuntimeMode, groundingRuntime, feishuGroundingAdapter, AgentRunExecutor,
  buildProductionRunPorts, llmRuntime, llmModelCatalog, llmUsage, knowledgeOs, fabricRetrieval, brainService,
  chatIntent, researchRouting, contextCache, contextOrchestrator, contextPacketLib,
  feishuGrounding, writingWorkflow, connectorToolRuntime, agentProcessTools, agentArtifactTools, agentImageTools,
  agentOrchestration, knowledgeStewardTools, agentCapabilityImportTools, agentRegistryTools, isToolSurfaceV1, resolveToolSurfaceForRun,
  getSessionCapabilityBindings, buildTemporalAnchorContext, mergeExtraTools, logger,
  createKnowledgeTools,
}
