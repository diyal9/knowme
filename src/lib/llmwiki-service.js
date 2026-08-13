'use strict'

/**
 * Application-facing root LLM Wiki service.
 *
 * UI, Agent and other main-process modules use this boundary instead of
 * selecting knowledge-os/qmd implementations independently.
 */

const knowledgeOs = require('./knowledge-os')
const qmdEngine = require('./qmd-engine')

const ROOT_COLLECTION = 'root'

function retrievalState(result = {}, probe = null) {
  const actual = result.engine === 'qmd' ? 'qmd' : 'fallback'
  return {
    requested: 'qmd',
    actual,
    available: probe ? probe.available === true : actual === 'qmd',
    degraded: actual !== 'qmd' || result.degraded === true,
    reason: result.fallbackReason || (probe?.available === false ? probe.reason : null),
    collectionId: result.collectionId || null,
  }
}

function createService(deps = {}) {
  const os = deps.knowledgeOs || knowledgeOs
  const qmd = deps.qmdEngine || qmdEngine

  async function query(userData, queryText, ctx = {}) {
    const text = String(queryText || '').trim()
    if (!text) {
      return {
        ok: true,
        operation: 'query',
        action: '查找知识',
        hits: [],
        message: '请输入要查找的内容',
        retrieval: retrievalState({ engine: 'fallback', fallbackReason: 'empty_query' }),
      }
    }
    const { wikiRoot, docs } = os.loadQueryDocuments(userData, ctx)
    const result = await qmd.queryCollection(ROOT_COLLECTION, text, {
      docs,
      rootPath: wikiRoot,
      topK: ctx.topK,
      embed: ctx.embed,
      rerankAlpha: ctx.rerankAlpha,
    })
    const hits = Array.isArray(result.hits) ? result.hits : []
    return {
      ...result,
      ok: result.ok !== false,
      operation: 'query',
      action: '查找知识',
      hits,
      message: hits.length ? null : (result.message || '没有找到相关资料'),
      retrieval: retrievalState(result),
    }
  }

  async function syncAfterMutation(userData, ctx = {}) {
    const wikiRoot = os.resolveWikiRoot(userData, ctx)
    const synced = await qmd.syncCollection(ROOT_COLLECTION, wikiRoot)
    return retrievalState(
      synced.ok
        ? { engine: 'qmd', collectionId: synced.collectionId }
        : { engine: 'fallback', degraded: true, fallbackReason: synced.error }
    )
  }

  async function ingest(userData, payload = {}, ctx = {}) {
    if (typeof ctx.beforeIngest === 'function') {
      const checked = await ctx.beforeIngest(payload)
      if (checked?.blocked) {
        return {
          ok: false,
          operation: 'ingest',
          action: '添加资料',
          error: checked.message || '这份资料需要先确认',
          check: checked,
        }
      }
    }
    const result = os.ingest(userData, payload, ctx)
    if (!result?.ok) {
      return { ...result, operation: 'ingest', action: '添加资料' }
    }
    const retrieval = await syncAfterMutation(userData, ctx)
    return {
      ...result,
      operation: 'ingest',
      action: '添加资料',
      retrieval,
    }
  }

  async function lint(userData, ctx = {}) {
    const report = os.lintWiki(userData, ctx)
    const status = await qmd.getEngineStatus()
    return {
      ...report,
      operation: 'lint',
      action: '检查问题',
      summary: report.healthy
        ? `已检查 ${report.scanned || 0} 份知识，没有发现问题`
        : `已检查 ${report.scanned || 0} 份知识，发现 ${report.issueCount || 0} 个问题`,
      retrieval: retrievalState(
        status.engine === 'qmd'
          ? { engine: 'qmd' }
          : { engine: 'fallback', degraded: true, fallbackReason: status.probe?.reason },
        status.probe
      ),
    }
  }

  async function saveRaw(userData, payload = {}, ctx = {}) {
    const result = os.saveRaw(userData, payload, ctx)
    if (!result?.ok) return result
    return { ...result, retrieval: await syncAfterMutation(userData, ctx) }
  }

  async function refresh(userData, ctx = {}) {
    const index = os.refreshIndex(userData, ctx)
    return {
      ok: true,
      scanned: index.entries?.length || 0,
      index,
      retrieval: await syncAfterMutation(userData, ctx),
    }
  }

  return Object.freeze({
    query,
    ingest,
    lint,
    saveRaw,
    refresh,
    syncAfterMutation,
  })
}

const rootLlmWiki = createService()

module.exports = {
  ROOT_COLLECTION,
  retrievalState,
  createService,
  ...rootLlmWiki,
}
