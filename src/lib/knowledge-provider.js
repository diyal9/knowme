'use strict'

/**
 * knowledge-provider — 知识库 Provider 抽象。
 *
 * 两类知识库：
 *   - local       本地卡帕西 Wiki（委托 knowledge-os，空间 + 子目录）
 *   - remote-rag  可配置远程 RAG 端点（POST 查询 → 统一 hits）
 *
 * 统一检索接口 queryProvider() → { ok, hits, message }，使 AI 对话对类型透明。
 * 纯逻辑：网络通过 ctx.fetch 注入；apiKey 明文仅存在于内存，持久层由主进程加密。
 */

const knowledgeOs = require('./knowledge-os')

const DEFAULT_TIMEOUT_MS = 8000
const DEFAULT_TOPK = 5

function normalizeProvider(def = {}) {
  const kind = def.kind === 'remote-rag' ? 'remote-rag' : 'local'
  const base = {
    id: String(def.id || ''),
    kind,
    displayName: String(
      def.displayName || (kind === 'remote-rag' ? '远程 RAG 知识库' : '本地知识库')
    ).slice(0, 60),
  }
  if (kind === 'remote-rag') {
    return {
      ...base,
      endpoint: String(def.endpoint || ''),
      apiKey: def.apiKey != null ? String(def.apiKey) : '',
      collection: String(def.collection || ''),
      topK: Number.isFinite(def.topK) ? def.topK : DEFAULT_TOPK,
    }
  }
  return {
    ...base,
    spaceSourceId: def.spaceSourceId || null,
    subDir: String(def.subDir || ''),
  }
}

/** 列表/日志安全：移除 apiKey 明文，仅暴露 hasApiKey */
function redactProvider(def) {
  const p = normalizeProvider(def)
  if (p.kind === 'remote-rag') {
    const { apiKey, ...rest } = p
    return { ...rest, hasApiKey: !!apiKey }
  }
  return p
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
async function queryProvider(def, text, ctx = {}) {
  const p = normalizeProvider(def)
  const q = String(text || '').trim()
  if (!q) return { ok: true, hits: [], message: '请输入查询关键词' }

  if (p.kind === 'local') {
    return knowledgeOs.queryRanked(ctx.userData, q, ctx)
  }

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

module.exports = {
  DEFAULT_TIMEOUT_MS,
  DEFAULT_TOPK,
  normalizeProvider,
  redactProvider,
  mapRagResponse,
  queryProvider,
}
