'use strict'

/**
 * agent-web-tools — search_web / fetch_web_page 工具定义与 handler 工厂。
 *
 * 描述里显式写死「外链走本工具、飞书链接走 feishu.read_doc」：模型的工具选择
 * 只看名字和描述，边界写在这里比写在系统提示词里更靠得住。
 */

const webFetch = require('./web-fetch')
const webSearch = require('./web-search')

const WEB_FETCH_CONTRACT = {
  source: 'builtin',
  capability: 'web-fetch',
  risk: 'network',
  sideEffects: false,
  requiresApproval: false,
  scope: 'external',
  timeoutMs: 20000,
  idempotencySupported: false,
  rollbackSupported: false,
  research: {
    kind: 'web-fetch',
    scope: 'public',
    label: '公开网页原文读取',
  },
}

const WEB_SEARCH_CONTRACT = {
  source: 'builtin',
  capability: 'web-search',
  risk: 'network',
  sideEffects: false,
  requiresApproval: false,
  scope: 'external',
  timeoutMs: 15000,
  idempotencySupported: false,
  rollbackSupported: false,
  research: {
    kind: 'web-search',
    scope: 'public',
    label: '公开网络搜索',
    preferred: true,
  },
}

const FETCH_WEB_PAGE_TOOL = {
  type: 'function',
  function: {
    name: 'fetch_web_page',
    description:
      'Fetch a public http/https web page and return its readable text content. Use this for ANY external link the user pastes or references (articles, blogs, docs, release notes) before answering or writing about it. For feishu.cn / larksuite.com links use feishu.read_doc instead. Does not perform web search — the caller must supply an exact URL.',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'Absolute http(s) URL of the page to read, e.g. https://example.com/post.',
        },
      },
      required: ['url'],
      additionalProperties: false,
    },
  },
  _knowme: WEB_FETCH_CONTRACT,
}

const SEARCH_WEB_TOOL = {
  type: 'function',
  function: {
    name: 'search_web',
    description:
      'Search the public web for current information and return bounded result leads with URLs, snippets, publication time when available, and retrieval time. Use this first for requests about today/latest/recent news or public facts. Search snippets are discovery leads, not full-page evidence; use fetch_web_page on relevant results before making detailed claims.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Non-empty public web search query.',
        },
        mode: {
          type: 'string',
          enum: ['web', 'news'],
          description: 'Use news for current coverage and web for general public pages.',
        },
        recency_days: {
          type: 'integer',
          minimum: 1,
          maximum: 365,
          description: 'Optional lookback window in days.',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 10,
          description: 'Maximum result count.',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  _knowme: WEB_SEARCH_CONTRACT,
}

function formatPage(page) {
  const lines = [
    `标题：${page.title}`,
    `来源：${page.finalUrl}`,
  ]
  if (page.truncated) lines.push('说明：正文过长，以下内容已截断。')
  lines.push('', '正文：', page.text)
  return lines.join('\n')
}

function formatSearchResults(result) {
  const lines = [
    `搜索：${result.query}`,
    `模式：${result.mode === 'news' ? '新闻' : '网页'}`,
    `检索时间：${result.retrievedAt}`,
    '说明：以下摘要仅用于发现线索；输出具体事实前请继续读取相关网页原文。',
    '',
  ]
  result.results.forEach((item, index) => {
    lines.push(`${index + 1}. ${item.title}`)
    lines.push(`   URL：${item.url}`)
    lines.push(`   来源：${item.source || '未知'}`)
    lines.push(`   发布时间：${item.publishedAt || '未知'}`)
    if (item.snippet) lines.push(`   摘要：${item.snippet}`)
  })
  return lines.join('\n')
}

/**
 * @param {{ signal?: AbortSignal, fetchImpl?: Function, lookup?: Function,
 *           timeoutMs?: number }} [options]
 * @returns {{ definitions: object[], handlers: Record<string, Function> }}
 */
function buildWebTools(options = {}) {
  async function handleSearchWeb(args = {}, signal) {
    const query = String(args.query || '').trim()
    const result = await webSearch.searchWeb(query, {
      signal: signal || options.signal,
      fetchImpl: options.searchFetchImpl || options.fetchImpl,
      endpointBuilder: options.searchEndpointBuilder,
      timeoutMs: options.searchTimeoutMs,
      now: options.now,
      mode: args.mode,
      recencyDays: args.recency_days,
      limit: args.limit,
    })
    if (!result.ok) {
      return {
        ok: false,
        code: result.code,
        text: `未能完成网络搜索：${result.message}`,
        meta: {
          provider: result.provider || 'bing-rss',
          status: result.status || 0,
        },
      }
    }
    const candidates = result.results.map(item => ({
      title: item.title,
      url: item.url,
      summary: item.snippet,
      source: item.source,
      publishedAt: item.publishedAt,
      retrievedAt: item.retrievedAt,
    }))
    return {
      ok: true,
      text: formatSearchResults(result),
      sources: candidates.map(item => ({
        title: item.title,
        path: item.url,
        snippet: item.summary,
        publishedAt: item.publishedAt,
        retrievedAt: item.retrievedAt,
      })),
      meta: {
        provider: result.provider,
        query: result.query,
        mode: result.mode,
        recencyDays: result.recencyDays,
        retrievedAt: result.retrievedAt,
        candidates,
      },
    }
  }

  async function handleFetchWebPage(args = {}, signal) {
    const url = String(args.url || '').trim()
    const page = await webFetch.fetchReadablePage(url, {
      signal: signal || options.signal,
      fetchImpl: options.fetchImpl,
      lookup: options.lookup,
      timeoutMs: options.timeoutMs,
    })
    if (!page.ok) {
      return {
        ok: false,
        code: page.code,
        text: `未能读取该网页（${url}）：${page.message}`,
      }
    }
    return {
      ok: true,
      text: formatPage(page),
      meta: {
        finalUrl: page.finalUrl,
        title: page.title,
        truncated: page.truncated,
        contentType: page.contentType,
      },
    }
  }

  return {
    definitions: [SEARCH_WEB_TOOL, FETCH_WEB_PAGE_TOOL],
    handlers: {
      search_web: handleSearchWeb,
      fetch_web_page: handleFetchWebPage,
    },
  }
}

module.exports = {
  WEB_FETCH_CONTRACT,
  WEB_SEARCH_CONTRACT,
  FETCH_WEB_PAGE_TOOL,
  SEARCH_WEB_TOOL,
  formatPage,
  formatSearchResults,
  buildWebTools,
}
