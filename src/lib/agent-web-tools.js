'use strict'

/**
 * agent-web-tools — fetch_web_page 工具定义与 handler 工厂。
 *
 * 描述里显式写死「外链走本工具、飞书链接走 feishu.read_doc」：模型的工具选择
 * 只看名字和描述，边界写在这里比写在系统提示词里更靠得住。
 */

const webFetch = require('./web-fetch')

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
  _knowme: { source: 'web', requiresApproval: false },
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

/**
 * @param {{ signal?: AbortSignal, fetchImpl?: Function, lookup?: Function,
 *           timeoutMs?: number }} [options]
 * @returns {{ definitions: object[], handlers: Record<string, Function> }}
 */
function buildWebTools(options = {}) {
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
    definitions: [FETCH_WEB_PAGE_TOOL],
    handlers: { fetch_web_page: handleFetchWebPage },
  }
}

module.exports = {
  FETCH_WEB_PAGE_TOOL,
  formatPage,
  buildWebTools,
}
