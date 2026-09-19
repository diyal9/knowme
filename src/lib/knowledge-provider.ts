'use strict'

/**
 * knowledge-provider — 知识库 Provider 抽象。
 *
 * 联邦知识库：
 *   - local       本地卡帕西 Wiki（委托 knowledge-os，空间 + 子目录）
 *   - remote-rag  可配置远程 RAG 端点（POST 查询 → 统一 hits）
 *   - ragflow     只同步 Dataset 元数据，查询时按授权 Dataset 检索
 *
 * 统一检索接口 queryProvider() → { ok, hits, message }，使 AI 对话对类型透明。
 * 纯逻辑：网络通过 ctx.fetch 注入；apiKey 明文仅存在于内存，持久层由主进程加密。
 */

const llmwikiService = require('./llmwiki-service')

const DEFAULT_TIMEOUT_MS = 8000
const DEFAULT_TOPK = 5
const SCOPES = new Set(['client', 'server', 'shared'])
const PROVIDER_KINDS = new Set(['local', 'qmd-local', 'folder', 'gitlab', 'remote-rag', 'ragflow'])
const providerAdapters = new Map()

function clampAuthority(value, fallback = 2) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.max(1, Math.min(5, Math.floor(n))) : fallback
}

function clampTier(value, fallback = 2) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.max(1, Math.min(9, Math.floor(n))) : fallback
}

function normalizeCollections(items = []) {
  return (Array.isArray(items) ? items : []).map(item => ({
    id: String(item.id || ''),
    name: String(item.name || item.displayName || item.id || '未命名知识库').slice(0, 120),
    description: String(item.description || '').slice(0, 500),
    documentCount: Number(item.documentCount ?? item.document_count ?? item.doc_num ?? 0) || 0,
    updatedAt: item.updatedAt || item.update_date || item.update_time || null,
    tags: Array.isArray(item.tags) ? item.tags.map(tag => String(tag).slice(0, 40)).slice(0, 20) : [],
    permission: item.permission || null,
    status: item.status ?? null,
    health: item.health || null,
    topics: Array.isArray(item.topics) ? item.topics.map(topic => String(topic).slice(0, 80)).slice(0, 20) : [],
  })).filter(item => item.id)
}

function normalizeProvider(def = {}) {
  const kind = PROVIDER_KINDS.has(def.kind) ? def.kind : 'local'
  const scope = SCOPES.has(def.scope) ? def.scope : 'client'
  const authority = clampAuthority(def.authority, kind === 'remote-rag' || kind === 'ragflow' ? 3 : 2)
  const retrievalTier = clampTier(def.retrievalTier, 1)
  const base = {
    id: String(def.id || ''),
    kind,
    displayName: String(
      def.displayName || (kind === 'ragflow' ? 'RAGFlow 知识库' : kind === 'remote-rag' ? '远程 RAG 知识库' : '本地知识库')
    ).slice(0, 60),
    scope,
    authority,
    retrievalTier,
    governance: String(def.governance || 'llm-wiki').slice(0, 40),
    writable: def.writable !== false,
    promotable: def.promotable !== false,
    collectionId: String(def.collectionId || def.id || 'root').slice(0, 80),
    collections: normalizeCollections(def.collections),
    health: String(def.health || '').slice(0, 40) || undefined,
    lastHealthCheckAt: def.lastHealthCheckAt || undefined,
    lastSyncedAt: def.lastSyncedAt || undefined,
    lastQueryAt: def.lastQueryAt || undefined,
    lastQueryStatus: def.lastQueryStatus || undefined,
    recentQueries: Array.isArray(def.recentQueries) ? def.recentQueries.slice(0, 10) : [],
  }
  if (kind === 'remote-rag' || kind === 'ragflow') {
    return {
      ...base,
      endpoint: String(def.endpoint || ''),
      apiKey: def.apiKey != null ? String(def.apiKey) : '',
      collection: String(def.collection || ''),
      collectionIds: [...new Set((Array.isArray(def.collectionIds) ? def.collectionIds : [])
        .map(item => String(item || '').trim()).filter(Boolean))],
      documentIds: [...new Set((Array.isArray(def.documentIds) ? def.documentIds : [])
        .map(item => String(item || '').trim()).filter(Boolean))],
      retrieval: def.retrieval && typeof def.retrieval === 'object' ? { ...def.retrieval } : {},
      collections: normalizeCollections(def.collections),
      topK: Number.isFinite(def.topK) ? def.topK : DEFAULT_TOPK,
      writable: false,
      promotable: false,
    }
  }
  return {
    ...base,
    spaceSourceId: def.spaceSourceId || def.sourceId || null,
    sourceId: def.sourceId || def.spaceSourceId || null,
    subDir: String(def.subDir || ''),
    repositoryRef: String(def.repositoryRef || def.projectPath || '').slice(0, 240),
  }
}

/** 默认根 Fabric 个人库 */
function defaultPersonalProvider(cfg = {}) {
  return normalizeProvider({
    id: cfg.id || 'kb_personal',
    displayName: cfg.displayName || '我的知识',
    kind: 'qmd-local',
    scope: cfg.scope || 'client',
    authority: cfg.authority,
    retrievalTier: cfg.retrievalTier || 1,
    governance: 'llm-wiki',
    writable: cfg.writable !== false,
    promotable: cfg.promotable !== false,
    collectionId: cfg.collectionId || 'root',
    spaceSourceId: cfg.spaceSourceId || null,
    subDir: cfg.subDir || '',
  })
}

/** 列表/日志安全：移除 apiKey 明文，仅暴露 hasApiKey */
function redactProvider(def) {
  const p = normalizeProvider(def)
  if (p.kind === 'remote-rag' || p.kind === 'ragflow') {
    const { apiKey, ...rest } = p
    return { ...rest, hasApiKey: !!apiKey }
  }
  return p
}

function apiBase(endpoint) {
  const value = String(endpoint || '').trim().replace(/\/+$/, '')
  if (!value) return ''
  return /\/api\/v1$/i.test(value) ? value : `${value}/api/v1`
}

async function fetchJson(url, init, ctx = {}) {
  const fetchFn = ctx.fetch || (typeof fetch === 'function' ? fetch : null)
  if (!fetchFn) return { ok: false, error: '运行环境不支持网络请求' }
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timeoutMs = Number(ctx.timeoutMs) || DEFAULT_TIMEOUT_MS
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null
  const externalSignal = ctx.signal
  const abortExternal = () => controller?.abort()
  externalSignal?.addEventListener('abort', abortExternal, { once: true })
  try {
    const response = await fetchFn(url, { ...init, signal: controller ? controller.signal : externalSignal })
    if (!response?.ok) return { ok: false, error: `HTTP ${response?.status || '无响应'}` }
    const json = await response.json()
    if (Number(json?.code || 0) !== 0) return { ok: false, error: String(json?.message || '知识源返回失败') }
    return { ok: true, json }
  } catch (error) {
    return { ok: false, error: error?.name === 'AbortError' ? '知识源请求超时' : '知识源请求失败' }
  } finally {
    if (timer) clearTimeout(timer)
    externalSignal?.removeEventListener('abort', abortExternal)
  }
}

function ragflowHeaders(provider) {
  return {
    'content-type': 'application/json',
    ...(provider.apiKey ? { authorization: `Bearer ${provider.apiKey}` } : {}),
  }
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback
}

const RAGFLOW_QUERY_INTENTS = Object.freeze({
  exact: Object.freeze({ candidateTopK: 40, pageSize: 8, similarityThreshold: 0.12, vectorSimilarityWeight: 0.2, useKnowledgeGraph: false }),
  factual: Object.freeze({ candidateTopK: 30, pageSize: 8, similarityThreshold: 0.18, vectorSimilarityWeight: 0.45, useKnowledgeGraph: false }),
  exploratory: Object.freeze({ candidateTopK: 50, pageSize: 10, similarityThreshold: 0.15, vectorSimilarityWeight: 0.55, useKnowledgeGraph: true }),
})

/** Classify the retrieval need without another model/network round trip. */
function classifyRagflowQueryIntent(queryText, explicitIntent) {
  const explicit = String(explicitIntent || '').trim().toLowerCase()
  if (explicit === 'exact' || explicit === 'factual' || explicit === 'exploratory') return explicit
  const query = String(queryText || '').trim()
  const asksExplanation = /(为什么|为何|如何|怎么|怎样|原因|区别|是否|能否|可否|吗|呢|？|\?)/i.test(query)
  if (/(\.md|\.txt|\.pdf|文件名|标题|原文|全文|哪一份|哪份)/i.test(query)
    || (!asksExplanation && /(规则|配置|模板|编号|名称)/i.test(query))) return 'exact'
  if (/(有哪些|列出|相关内容|分别|对比|比较|梳理|汇总|介绍|整体|关联|知识图谱|全貌|覆盖)/i.test(query)) return 'exploratory'
  return 'factual'
}

function resolveRagflowRetrievalOptions(queryText, provider, ctx = {}) {
  const intent = classifyRagflowQueryIntent(queryText, ctx.queryIntent || ctx.intent)
  const profile = RAGFLOW_QUERY_INTENTS[intent]
  return { ...profile, ...provider.retrieval, ...ctx, queryIntent: intent }
}

/**
 * Build the RAGFlow /retrieval request without leaking provider credentials.
 * The endpoint accepts the same retrieval schema as the official SDK:
 * dataset/document scope, hybrid-search controls, reranking, multilingual,
 * metadata and knowledge-graph options.
 */
function buildRagflowRetrievalRequest(def, queryText, ctx = {}) {
  const provider = normalizeProvider(def)
  const options = resolveRagflowRetrievalOptions(queryText, provider, ctx)
  const query = String(queryText || '').trim()
  const datasetIds = Array.isArray(options.collectionIds) && options.collectionIds.length
    ? options.collectionIds
    : provider.collectionIds.length
      ? provider.collectionIds
      : provider.collection ? [provider.collection] : []
  const documentIds = Array.isArray(options.documentIds)
    ? options.documentIds
    : Array.isArray(provider.documentIds) ? provider.documentIds : []
  const requestedTopK = Number.isFinite(options.topK) ? options.topK : provider.topK
  const resultTopK = clampNumber(requestedTopK, 1, 100, DEFAULT_TOPK)
  const candidateTopK = clampNumber(options.candidateTopK, resultTopK, 1024, Math.max(20, resultTopK))
  const pageSize = clampNumber(options.pageSize, 1, 100, resultTopK)
  const request = {
    dataset_ids: [...new Set(datasetIds.map(String).map(id => id.trim()).filter(Boolean))].slice(0, 50),
    question: query,
    top_k: candidateTopK,
    page: clampNumber(options.page, 1, 100000, 1),
    page_size: pageSize,
    similarity_threshold: clampNumber(options.similarityThreshold, 0, 1, 0.2),
    vector_similarity_weight: clampNumber(options.vectorSimilarityWeight, 0, 1, 0.3),
    keyword: options.keyword !== false,
    use_kg: options.useKnowledgeGraph === true,
  }
  if (documentIds.length) request.document_ids = [...new Set(documentIds.map(String).map(id => id.trim()).filter(Boolean))].slice(0, 100)
  if (options.rerankId) request.rerank_id = String(options.rerankId)
  if (Array.isArray(options.crossLanguages) && options.crossLanguages.length) {
    request.cross_languages = options.crossLanguages.map(String).filter(Boolean).slice(0, 20)
  }
  if (options.metadataCondition && typeof options.metadataCondition === 'object') request.metadata_condition = options.metadataCondition
  if (options.tocEnhance === true) request.toc_enhance = true
  if (options.forceRefresh === true) request.force_refresh = true
  return request
}

function mapRagflowCollections(json) {
  const data = Array.isArray(json?.data) ? json.data : Array.isArray(json?.data?.items) ? json.data.items : []
  return data.map(item => ({
    id: String(item.id || ''),
    name: String(item.name || item.id || '未命名知识库').slice(0, 120),
    description: String(item.description || '').slice(0, 500),
    documentCount: Number(item.document_count ?? item.doc_num ?? 0) || 0,
    updatedAt: item.update_date || item.update_time || null,
    tags: Array.isArray(item.tags) ? item.tags.map(tag => String(tag).slice(0, 40)).slice(0, 20) : [],
    permission: item.permission || null,
    status: item.status ?? null,
  })).filter(item => item.id)
}

async function listCollectionsLegacy(def, ctx = {}) {
  const provider = normalizeProvider(def)
  if (['local', 'qmd-local', 'folder', 'gitlab'].includes(provider.kind)) {
    const label = provider.kind === 'gitlab' ? 'GitLab 工作副本' : provider.kind === 'folder' ? '本地文件夹' : '本地挂载的 LLM Wiki'
    return {
      ok: true,
      collections: [{
        id: provider.collectionId || provider.id || 'root',
        name: provider.displayName,
        description: `${label}，只在查询时读取正文。`,
        documentCount: Number(ctx.documentCount || 0),
        updatedAt: null,
        tags: ['local', provider.kind],
      }],
    }
  }
  if (provider.kind !== 'ragflow') {
    return {
      ok: true,
      collections: [{
        id: provider.collection || provider.collectionId || provider.id,
        name: provider.displayName,
        description: '按需查询的远程知识库。',
        documentCount: 0,
        updatedAt: null,
        tags: ['remote-rag'],
      }],
    }
  }
  if (!provider.endpoint) return { ok: false, collections: [], error: '未配置 RAGFlow 地址' }
  const pageSize = Math.max(1, Math.min(150, Number(ctx.pageSize) || 100))
  const result = await fetchJson(
    `${apiBase(provider.endpoint)}/datasets?page=1&page_size=${pageSize}&orderby=update_time&desc=true`,
    { method: 'GET', headers: ragflowHeaders(provider) },
    ctx
  )
  if (!result.ok) return { ...result, collections: [] }
  return { ok: true, collections: mapRagflowCollections(result.json) }
}

function mapRagflowHits(json, provider, topK = DEFAULT_TOPK) {
  const data = json?.data || {}
  const chunks = Array.isArray(data.chunks) ? data.chunks : Array.isArray(data) ? data : []
  return chunks.slice(0, topK).map((chunk, index) => ({
    title: String(chunk.document_name || chunk.doc_name || chunk.title || `检索结果 ${index + 1}`).slice(0, 120),
    path: String(chunk.doc_id || chunk.document_id || chunk.id || ''),
    snippet: String(chunk.content_with_weight || chunk.content || chunk.text || '')
      .replace(/\s+/g, ' ').trim().slice(0, 600),
    score: Number(chunk.similarity ?? chunk.score ?? chunks.length - index) || 0,
    source: 'ragflow',
    kbId: provider.id,
    collectionId: chunk.dataset_id || chunk.kb_id || null,
    documentRef: chunk.doc_id || chunk.document_id || chunk.id || null,
  }))
}

function normalizeDocumentName(value) {
  return String(value || '').toLowerCase().replace(/\.[a-z0-9]{1,8}$/i, '').replace(/\s+/g, '')
}

function mapRagflowDocuments(json) {
  const data = json?.data || {}
  const docs = Array.isArray(data.docs) ? data.docs : Array.isArray(data) ? data : []
  return docs.map(doc => ({
    id: String(doc.id || doc.document_id || ''),
    name: String(doc.name || doc.document_name || doc.title || '').trim(),
    status: doc.run ?? doc.status ?? null,
  })).filter(doc => doc.id && doc.name)
}

async function findRagflowDocuments(provider, datasetIds, query, ctx = {}) {
  const normalizedQuery = normalizeDocumentName(query)
  if (!normalizedQuery) return { documents: [], checkedDatasets: [] }
  const found = []
  const checkedDatasets = []
  for (const datasetId of datasetIds.slice(0, 50)) {
    const result = await fetchJson(
      `${apiBase(provider.endpoint)}/datasets/${encodeURIComponent(datasetId)}/documents?page=1&page_size=100&keywords=${encodeURIComponent(query)}`,
      { method: 'GET', headers: ragflowHeaders(provider) },
      ctx,
    )
    checkedDatasets.push(datasetId)
    if (!result.ok) continue
    for (const document of mapRagflowDocuments(result.json)) {
      const name = normalizeDocumentName(document.name)
      if (name.includes(normalizedQuery) || normalizedQuery.includes(name)) found.push({ ...document, datasetId })
    }
  }
  return { documents: found, checkedDatasets }
}

async function queryRagflow(def, queryText, ctx = {}) {
  const provider = normalizeProvider(def)
  const query = String(queryText || '').trim()
  if (!query) return { ok: true, hits: [], message: '请输入查询关键词' }
  if (!provider.endpoint) return { ok: false, hits: [], message: '未配置 RAG 地址', code: 'rag_endpoint_missing' }
  if (!provider.apiKey) return { ok: false, hits: [], message: 'RAG API Key 未配置或无法解密，请重新保存 API Key', code: 'rag_api_key_missing' }
  const options = resolveRagflowRetrievalOptions(query, provider, ctx)
  const request = buildRagflowRetrievalRequest(provider, query, options)
  const allowed = request.dataset_ids
  if (!allowed.length) return { ok: false, hits: [], message: '请先选择允许查询的 RAG Dataset', code: 'rag_dataset_missing' }
  const result = await fetchJson(
    `${apiBase(provider.endpoint)}/retrieval`,
    {
      method: 'POST',
      headers: ragflowHeaders(provider),
      body: JSON.stringify(request),
    },
    ctx
  )
  if (!result.ok) {
    return {
      ok: false,
      hits: [],
      message: `RAG 检索请求失败：${result.error}`,
      code: 'rag_request_failed',
      diagnostics: { providerId: provider.id, datasetIds: allowed, queryIntent: options.queryIntent, request },
    }
  }
  let responseJson = result.json
  let titleLookup = null
  let hits = mapRagflowHits(responseJson, provider, request.page_size)
  if (!hits.length && options.queryIntent === 'exact' && !request.document_ids) {
    titleLookup = await findRagflowDocuments(provider, allowed, query, ctx)
    const documentIds = titleLookup.documents.map(document => document.id)
    if (documentIds.length) {
      const retryRequest = { ...request, document_ids: [...new Set(documentIds)].slice(0, 100), force_refresh: true }
      const retry = await fetchJson(
        `${apiBase(provider.endpoint)}/retrieval`,
        {
          method: 'POST',
          headers: ragflowHeaders(provider),
          body: JSON.stringify(retryRequest),
        },
        ctx,
      )
      if (retry.ok) {
        responseJson = retry.json
        hits = mapRagflowHits(responseJson, provider, request.page_size)
        request.document_ids = retryRequest.document_ids
        request.force_refresh = true
      }
    }
  }
  const total = Number(responseJson?.data?.total ?? responseJson?.total ?? hits.length) || 0
  const noHitReason = hits.length
    ? null
    : total === 0
      ? `Dataset 未命中：${allowed.join(', ')}；可能是关键词、相似度阈值或文档索引未命中`
      : `Dataset 已返回 ${total} 条结果，但没有可映射的内容分块`
  return {
    ok: true,
    hits,
    message: noHitReason,
    diagnostics: {
      providerId: provider.id,
      datasetIds: allowed,
      queryIntent: options.queryIntent,
      documentIds: request.document_ids || [],
      request,
      total,
      noHitReason,
      titleLookup,
    },
  }
}

/** 将远程 RAG 响应映射为统一 hits（兼容 hits/results/data/数组 多种形态） */
function mapRagResponse(json, topK = DEFAULT_TOPK) {
  const arr = Array.isArray(json?.hits)
    ? json.hits
    : Array.isArray(json?.results)
      ? json.results
      : Array.isArray(json?.data)
        ? json.data
        : Array.isArray(json)
          ? json
          : []
  const k = Number.isFinite(topK) && topK > 0 ? topK : DEFAULT_TOPK
  return arr.slice(0, k).map((h, i) => ({
    title: String(h.title || h.name || h.source || `结果 ${i + 1}`).slice(0, 120),
    path: String(h.url || h.source || h.path || h.id || ''),
    snippet: String(h.snippet || h.text || h.content || h.chunk || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 400),
    score: Number.isFinite(h.score) ? h.score : arr.length - i,
  }))
}

/**
 * 统一检索。
 * @param {object} def provider 定义（remote-rag 的 apiKey 须为解密后的明文）
 * @param {string} text 查询词
 * @param {object} ctx { userData, sources, fetch, timeoutMs, readFile }
 */
async function queryProviderLegacy(def, text, ctx = {}) {
  const p = normalizeProvider(def)
  const q = String(text || '').trim()
  if (!q) return { ok: true, hits: [], message: '请输入查询关键词' }

  if (['local', 'qmd-local', 'folder', 'gitlab'].includes(p.kind)) {
    if (ctx.useFabric !== false && ctx.fabricSearch) {
      return ctx.fabricSearch(ctx.userData, q, { ...ctx, providers: [p] })
    }
    if (typeof ctx.loadProviderDocuments === 'function') {
      const docs = await ctx.loadProviderDocuments(p)
      const ranked = require('./knowledge-rank').rankHits(q, Array.isArray(docs) ? docs : [], { topK: p.topK })
      return { ok: true, hits: ranked.map(hit => ({ ...hit, source: p.kind, kbId: p.id })), message: ranked.length ? null : `${p.displayName} 未命中` }
    }
    return llmwikiService.query(ctx.userData, q, ctx)
  }

  if (p.kind === 'ragflow') return queryRagflow(p, q, ctx)

  // remote-rag
  if (!p.endpoint) return { ok: false, hits: [], message: '未配置远程 RAG 端点' }
  const fetchFn = ctx.fetch || (typeof fetch === 'function' ? fetch : null)
  if (!fetchFn) return { ok: false, hits: [], message: '运行环境不支持网络请求' }
  const timeoutMs = ctx.timeoutMs || DEFAULT_TIMEOUT_MS
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null
  const externalSignal = ctx.signal
  const abortExternal = () => controller?.abort()
  externalSignal?.addEventListener('abort', abortExternal, { once: true })
  try {
    const res = await fetchFn(p.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(p.apiKey ? { authorization: `Bearer ${p.apiKey}` } : {}),
      },
      body: JSON.stringify({
        query: q,
        collection: p.collection || undefined,
        topK: p.topK,
      }),
      signal: controller ? controller.signal : externalSignal,
    })
    if (!res || !res.ok) {
      return { ok: false, hits: [], message: `远程 RAG 返回 ${res ? res.status : '无响应'}` }
    }
    const json = await res.json()
    const hits = mapRagResponse(json, p.topK)
    return { ok: true, hits, message: hits.length ? null : '远程 RAG 未命中' }
  } catch (e) {
    // 绝不泄露 apiKey
    const msg = e && e.name === 'AbortError' ? '远程 RAG 超时' : '远程 RAG 请求失败'
    return { ok: false, hits: [], message: msg }
  } finally {
    if (timer) clearTimeout(timer)
    externalSignal?.removeEventListener('abort', abortExternal)
  }
}

function registerProviderAdapter(kind, adapter) {
  const id = String(kind || '').trim()
  if (!id || !adapter || typeof adapter.listCollections !== 'function' || typeof adapter.queryCollection !== 'function') {
    throw new Error('KnowledgeProviderAdapter 需要 kind、listCollections 与 queryCollection')
  }
  providerAdapters.set(id, Object.freeze({ ...adapter, kind: id }))
  return providerAdapters.get(id)
}

function getProviderAdapter(kind) {
  return providerAdapters.get(String(kind || '')) || null
}

function listProviderAdapters() {
  return [...providerAdapters.values()]
}

async function listCollections(def, ctx = {}) {
  const provider = normalizeProvider(def)
  const adapter = getProviderAdapter(provider.kind)
  if (!adapter) return { ok: false, collections: [], error: `不支持的知识源类型：${provider.kind}` }
  return adapter.listCollections(provider, ctx)
}

async function queryProvider(def, text, ctx = {}) {
  const provider = normalizeProvider(def)
  const adapter = getProviderAdapter(provider.kind)
  if (!adapter) return { ok: false, hits: [], message: `不支持的知识源类型：${provider.kind}` }
  return adapter.queryCollection(provider, String(text || ''), ctx)
}

for (const kind of PROVIDER_KINDS) {
  registerProviderAdapter(kind, {
    listCollections: (provider, ctx) => listCollectionsLegacy(provider, ctx),
    queryCollection: (provider, query, ctx) => queryProviderLegacy(provider, query, ctx),
    getStatus: async (provider, ctx = {}) => {
      const listed = await listCollectionsLegacy(provider, { ...ctx, pageSize: 1 })
      return { ok: listed.ok !== false, state: listed.ok === false ? 'offline' : 'ready', checkedAt: new Date().toISOString(), error: listed.error || listed.message || null }
    },
  })
}

module.exports = {
  DEFAULT_TIMEOUT_MS,
  DEFAULT_TOPK,
  SCOPES,
  PROVIDER_KINDS,
  normalizeProvider,
  defaultPersonalProvider,
  redactProvider,
  apiBase,
  fetchJson,
  mapRagflowCollections,
  RAGFLOW_QUERY_INTENTS,
  classifyRagflowQueryIntent,
  resolveRagflowRetrievalOptions,
  buildRagflowRetrievalRequest,
  listCollections,
  mapRagflowHits,
  queryRagflow,
  mapRagResponse,
  registerProviderAdapter,
  getProviderAdapter,
  listProviderAdapters,
  queryProvider,
}
