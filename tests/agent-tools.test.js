'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const tools = require('../src/lib/agent-tools')

describe('agent-tools', () => {
  it('exports fabric-aware knowledge tool specs', () => {
    const defs = tools.getToolDefinitions()
    assert.ok(defs.length >= 4)
    const names = defs.map(d => d.function.name)
    assert.ok(names.includes('search_knowledge'))
    assert.ok(names.includes('fabric_search'))
    assert.ok(names.includes('kb_query'))
    assert.ok(names.includes('kb_get'))
    const search = defs.find(d => d.function.name === 'search_knowledge')
    assert.equal(search.type, 'function')
    assert.deepEqual(search.function.parameters.required, ['query'])
  })

  it('blocks unknown tools', () => {
    const res = tools.validateToolCall('run_shell', '{"cmd":"rm -rf /"}')
    assert.equal(res.ok, false)
    assert.equal(res.code, 'unknown_tool')
  })

  it('blocks invalid JSON arguments', () => {
    const res = tools.validateToolCall('search_knowledge', '{query:')
    assert.equal(res.ok, false)
    assert.equal(res.code, 'invalid_args')
  })

  it('blocks missing query', () => {
    const empty = tools.validateToolCall('search_knowledge', '{}')
    assert.equal(empty.ok, false)
    assert.equal(empty.code, 'invalid_args')
    const blank = tools.validateToolCall('search_knowledge', '{"query":"   "}')
    assert.equal(blank.ok, false)
    assert.equal(blank.code, 'invalid_args')
  })

  it('accepts valid search_knowledge call', () => {
    const res = tools.validateToolCall('search_knowledge', '{"query":"  报销流程  "}')
    assert.equal(res.ok, true)
    assert.equal(res.args.query, '报销流程')
    assert.equal(tools.summarizeToolArgs('search_knowledge', res.args), '报销流程')
    assert.equal(
      tools.summarizeToolArgs('feishu.meeting_candidates', { days: 7 }),
      '最近 7 天 · 查找本人参与的会议纪要'
    )
    assert.equal(
      tools.summarizeToolArgs('feishu.related_chats', { days: 3 }),
      '最近 3 天 · 分析 @我 的聊天'
    )
    assert.equal(
      tools.summarizeToolArgs('feishu.today_priority', {}),
      '今天 · 日程+待办优先级事实'
    )
  })

  it('registers web search and fetch through the tool surface', () => {
    const webTools = require('../src/lib/agent-web-tools').buildWebTools()
    const surface = tools.createToolSurface({
      extraDefinitions: webTools.definitions,
      handlers: webTools.handlers,
    })
    assert.equal(surface.isAllowedTool('fetch_web_page'), true)
    const names = surface.getToolDefinitions().map(d => d.function.name)
    assert.deepEqual(names, ['search_knowledge', 'fabric_search', 'kb_query', 'kb_get', 'search_web', 'fetch_web_page'])
  })

  it('requires a non-empty url for fetch_web_page', () => {
    const webTools = require('../src/lib/agent-web-tools').buildWebTools()
    const surface = tools.createToolSurface({
      extraDefinitions: webTools.definitions,
      handlers: webTools.handlers,
    })
    const empty = surface.validateToolCall('fetch_web_page', '{}')
    assert.equal(empty.ok, false)
    assert.equal(empty.code, 'invalid_args')
    const blank = surface.validateToolCall('fetch_web_page', '{"url":"   "}')
    assert.equal(blank.ok, false)
    const ok = surface.validateToolCall('fetch_web_page', '{"url":" https://example.com/a "}')
    assert.equal(ok.ok, true)
    assert.equal(ok.args.url, 'https://example.com/a')
  })

  it('summarizes fetch_web_page as host + path', () => {
    assert.equal(
      tools.summarizeToolArgs('fetch_web_page', { url: 'https://www.anthropic.com/engineering/harness-design' }),
      'www.anthropic.com/engineering/harness-design'
    )
    assert.equal(
      tools.summarizeToolArgs('fetch_web_page', { url: 'https://example.com/' }),
      'example.com'
    )
    assert.equal(tools.summarizeToolArgs('fetch_web_page', { url: 'not a url' }), 'not a url')
  })

  it('formats and truncates oversized provider results', () => {
    const hits = Array.from({ length: 3 }, (_, i) => ({
      title: `标题${i}`,
      path: `doc/${i}.md`,
      snippet: 'x'.repeat(9000),
    }))
    const formatted = tools.formatProviderResult({ ok: true, hits })
    assert.equal(formatted.ok, true)
    assert.equal(formatted.truncated, true)
    assert.ok(formatted.text.length <= tools.MAX_TOOL_RESULT_CHARS)
    assert.ok(formatted.text.endsWith(tools.TRUNCATION_SUFFIX))
    assert.ok(formatted.preview.length <= tools.MAX_UI_PREVIEW_CHARS)
    assert.equal(formatted.sources.length, 3)
    assert.equal(formatted.sources[0].path, 'doc/0.md')
  })

  it('truncateText respects custom limit', () => {
    const { text, truncated } = tools.truncateText('abcdefgh', 5, '…')
    assert.equal(truncated, true)
    assert.equal(text, 'abcd…')
  })

  it('executes search_knowledge via injected dependency', async () => {
    let seenQuery = null
    const { executeToolCall } = tools.createToolExecutor({
      searchKnowledge: async (query) => {
        seenQuery = query
        return {
          ok: true,
          hits: [{ title: '报销说明', path: 'wiki/expense.md', snippet: '提交发票' }],
        }
      },
    })
    const result = await executeToolCall({
      name: 'search_knowledge',
      arguments: '{"query":"如何报销"}',
    })
    assert.equal(seenQuery, '如何报销')
    assert.equal(result.ok, true)
    assert.equal(result.toolName, 'search_knowledge')
    assert.ok(result.text.includes('报销说明'))
    assert.ok(result.preview.includes('报销说明'))
    assert.deepEqual(result.sources, [{
      title: '报销说明',
      path: 'wiki/expense.md',
      snippet: '提交发票',
    }])
  })

  it('returns safe error for unknown tool via executor', async () => {
    const { executeToolCall } = tools.createToolExecutor({
      searchKnowledge: async () => ({ ok: true, hits: [] }),
    })
    const result = await executeToolCall({ name: 'delete_file', arguments: '{}' })
    assert.equal(result.ok, false)
    assert.equal(result.code, 'unknown_tool')
  })

  it('returns invalid_args via executor without calling dependency', async () => {
    let called = false
    const { executeToolCall } = tools.createToolExecutor({
      searchKnowledge: async () => { called = true; return { ok: true, hits: [] } },
    })
    const result = await executeToolCall({
      name: 'search_knowledge',
      arguments: '{"q":"missing query key"}',
    })
    assert.equal(result.ok, false)
    assert.equal(result.code, 'invalid_args')
    assert.equal(called, false)
  })

  it('dispatchToolCall delegates to executor', async () => {
    const result = await tools.dispatchToolCall(
      { name: 'search_knowledge', arguments: '{"query":"test"}' },
      { searchKnowledge: async () => ({ ok: false, message: 'provider down' }) }
    )
    assert.equal(result.ok, false)
    assert.equal(result.text, 'provider down')
  })

  it('formats empty hits gracefully', () => {
    const formatted = tools.formatProviderResult({ ok: true, hits: [] })
    assert.equal(formatted.ok, true)
    assert.ok(formatted.text.includes('未找到'))
  })
})

describe('agent-tools extra projection budget', () => {
  const def = (name, contract) => ({
    type: 'function',
    function: { name, description: name, parameters: { type: 'object', properties: {} } },
    ...(contract ? { _knowme: contract } : {}),
  })

  it('keeps the full builtin surface plus connector tools', () => {
    const builtins = Array.from({ length: 35 }, (_, i) => def(`builtin_${i}`))
    const connectors = [
      'feishu.doc_kb_suggest',
      'feishu.search_docs',
      'feishu.read_doc',
      'feishu.list_wiki_spaces',
      'feishu.get_wiki_node',
    ].map(name => def(name, { source: 'feishu' }))
    const surface = tools.createToolSurface({ extraDefinitions: [...builtins, ...connectors] })
    for (const item of connectors) {
      assert.equal(surface.isAllowedTool(item.function.name), true, item.function.name)
    }
    assert.equal(surface.isAllowedTool('builtin_0'), true)
  })

  it('drops deferrable orchestration tools before required tools', () => {
    const deferrable = [...tools.DEFERRABLE_TOOLS].map(name => def(name, { source: 'builtin' }))
    const filler = Array.from({ length: tools.EXTRA_TOOL_BUDGET + 8 }, (_, i) => def(`filler_${i}`, { source: 'builtin' }))
    const required = def('feishu.doc_kb_suggest', { source: 'feishu' })
    const extras = normalizedNames([...deferrable, ...filler, required], ['feishu.doc_kb_suggest'])
    assert.ok(extras.includes('feishu.doc_kb_suggest'))
    assert.ok(extras.length <= tools.EXTRA_TOOL_BUDGET)
    assert.ok(!extras.includes('spawn_sub_run'))
  })

  it('preserves registration order for kept tools', () => {
    const extras = normalizedNames(
      Array.from({ length: tools.EXTRA_TOOL_BUDGET + 5 }, (_, i) => def(`t_${String(i).padStart(3, '0')}`)),
      [],
    )
    const sorted = [...extras].sort()
    assert.deepEqual(extras, sorted)
  })

  function normalizedNames(defs, requiredTools) {
    return tools
      .normalizeExtraDefinitions(defs, { requiredTools })
      .map(item => item.function.name)
  }
})
