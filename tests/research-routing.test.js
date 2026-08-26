'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const researchRouting = require('../src/lib/research-routing')
const chatIntent = require('../src/lib/chat-intent')
const conversationGrounding = require('../src/lib/conversation-grounding')
const agentWebTools = require('../src/lib/agent-web-tools')
const agentTools = require('../src/lib/agent-tools')

function researchToolRecords(extra = []) {
  const web = agentWebTools.buildWebTools()
  return agentTools.createToolSurface({
    extraDefinitions: [...web.definitions, ...extra],
    handlers: web.handlers,
  }).getToolRecords()
}

describe('research-routing', () => {
  it('recognizes current public research without promoting greetings', () => {
    const intent = researchRouting.classifyResearchIntent('帮我看下今天关于 AI 的资讯')
    assert.equal(intent.active, true)
    assert.equal(intent.scope, 'public')
    assert.equal(intent.mode, 'news')
    assert.equal(intent.recencyDays, 1)
    assert.equal(chatIntent.classifyIntent({ prompt: '帮我看下今天关于 AI 的资讯' }), 'assist')
    assert.equal(chatIntent.classifyIntent({ prompt: '你好' }), 'chat')
    assert.equal(researchRouting.classifyResearchIntent('实现动态规划算法').active, false)
  })

  it('uses the visible formal-task goal instead of internal prompt scaffolding', () => {
    const prompt = [
      '当前时间：2026-08-23T15:00:00.000Z',
      '已确认的执行计划：检索会议内容',
      '材料：不要执行公开网络搜索',
    ].join('\n')
    const selected = researchRouting.selectResearchPrompt({
      prompt,
      displayPrompt: '分析我上周五的会议',
    })
    assert.equal(selected, '分析我上周五的会议')
    assert.equal(researchRouting.classifyResearchIntent(selected).active, false)
  })

  it('clears a stale public-research requirement from an internal meeting task', () => {
    const frame = {
      workflowId: 'realtime-public-research',
      requiredTools: ['search_web'],
    }
    assert.equal(researchRouting.reconcileResearchTaskFrame(frame, '分析我上周五的会议'), null)
    assert.equal(
      researchRouting.reconcileResearchTaskFrame(frame, '帮我看下今天关于 AI 的资讯'),
      frame,
    )
  })

  it('activates conversation grounding for a research request', () => {
    const result = conversationGrounding.buildGrounding({
      prompt: '帮我看下今天关于 AI 的资讯',
    })
    assert.equal(result.active, true)
    assert.equal(result.title, '研究最新资讯')
    assert.ok(result.labels.includes('实时研究'))
  })

  it('discovers only tools actually projected in this run', () => {
    const mcpSearch = {
      type: 'function',
      function: {
        name: 'mcp.corp.search',
        description: 'Search internal company documents',
        parameters: { type: 'object', properties: {} },
      },
      _knowme: {
        source: 'mcp',
        capability: 'mcp',
        risk: 'network',
        sideEffects: false,
        requiresApproval: false,
        scope: 'external',
        timeoutMs: 30000,
        idempotencySupported: false,
        rollbackSupported: false,
      },
    }
    const sources = researchRouting.discoverResearchSources(researchToolRecords([mcpSearch]))
    const tools = sources.map(source => source.toolName)
    assert.ok(tools.includes('search_web'))
    assert.ok(tools.includes('fetch_web_page'))
    assert.ok(tools.includes('search_knowledge'))
    assert.ok(tools.includes('mcp.corp.search'))
    assert.ok(!tools.includes('feishu.search_docs'))
  })

  it('builds an executable public task frame and direct-execution context', () => {
    const route = researchRouting.buildResearchRoute({
      prompt: '最近 OpenAI 有什么新闻动态',
      toolRecords: researchToolRecords(),
    })
    assert.equal(route.active, true)
    assert.deepEqual(route.taskFrame.requiredTools, ['search_web'])
    assert.equal(route.taskFrame.requiredEvidence[0].tool, 'search_web')
    assert.match(route.context, /信息足够时直接研究/)
    assert.match(route.context, /不得生成只有一个项目/)
    assert.ok(!route.context.includes('feishu.search_docs'))
  })

  it('does not invent a required search tool when it is unavailable', () => {
    const route = researchRouting.buildResearchRoute({
      prompt: '今天 AI 行业有什么新闻',
      toolRecords: [agentTools.SEARCH_KNOWLEDGE_TOOL],
    })
    assert.equal(route.active, true)
    assert.equal(route.taskFrame, null)
    assert.deepEqual(route.sources.map(source => source.toolName), ['search_knowledge'])
  })

  it('injects research context immediately before the current user turn', () => {
    const messages = researchRouting.injectResearchContext([
      { role: 'system', content: 'base' },
      { role: 'user', content: 'today news' },
    ], 'research rules')
    assert.deepEqual(messages.map(message => message.role), ['system', 'system', 'user'])
    assert.equal(messages[1].content, 'research rules')
  })
})
