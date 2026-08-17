const { currentPage, readPreload } = require('./helpers/current-src')
/**
 * agent-suggestion-bar — parse whitelist suggestion blocks
 */
const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const {
  parseSuggestionBlock,
  hasIncompleteSuggestionFence,
  resolveOpenTarget,
  payloadNeedsUserEdit,
  applyUserInputToPayload,
} = require('../src/lib/agent-suggestion')

describe('agent-suggestion', () => {
  it('parses valid suggestion fence and strips from body', () => {
    const text = `先说明一下。\n\n\`\`\`suggestion\n${JSON.stringify({
      title: '你可能想问的',
      items: [
        { id: 'a', label: '演示', action: 'fill', payload: '请演示' },
        { id: 'b', label: '知识库', action: 'open_knowledge', payload: '' },
        { id: 'bad', label: '黑客', action: 'eval', payload: 'x' },
      ],
    }, null, 2)}\n\`\`\`\n\n结尾。`
    const { bodyWithoutBlock, bar } = parseSuggestionBlock(text)
    assert.ok(bodyWithoutBlock.includes('先说明一下'))
    assert.ok(bodyWithoutBlock.includes('结尾'))
    assert.ok(!bodyWithoutBlock.includes('```suggestion'))
    assert.equal(bar.title, '你可能想问的')
    assert.equal(bar.items.length, 2)
    assert.equal(bar.items[0].action, 'fill')
    assert.equal(bar.items[1].action, 'open_knowledge')
  })

  it('returns null bar on invalid json', () => {
    const text = 'hi\n\n```suggestion\n{not json}\n```\n'
    const r = parseSuggestionBlock(text)
    assert.equal(r.bar, null)
    assert.ok(r.bodyWithoutBlock.includes('```suggestion'))
  })

  it('parses suggestion fence even when json starts on same line', () => {
    const text = '正文\n```suggestion {"title":"下一步","items":[{"label":"补全","action":"fill","payload":"请补充"}]}\n```\n收尾'
    const { bodyWithoutBlock, bar } = parseSuggestionBlock(text)
    assert.ok(!bodyWithoutBlock.includes('```suggestion'))
    assert.ok(bodyWithoutBlock.includes('正文'))
    assert.ok(bodyWithoutBlock.includes('收尾'))
    assert.equal(bar.title, '下一步')
    assert.equal(bar.items.length, 1)
    assert.equal(bar.items[0].label, '补全')
  })

  it('parses unclosed suggestion fence at tail and strips raw json', () => {
    const text = [
      '我先给你推荐一个操作。',
      '',
      '"```suggestion',
      '{',
      '  "title": "请选择要深入操作的文档",',
      '  "items": [',
      '    { "label": "读取 A", "action": "send", "payload": "feishu.read_doc doc_token=a" },',
      '    { "label": "读取 B", "action": "send", "payload": "feishu.read_doc doc_token=b" }',
      '  ]',
      '}',
    ].join('\n')
    const { bodyWithoutBlock, bar } = parseSuggestionBlock(text)
    assert.ok(bar, 'parses incomplete fence when suggestion json is valid')
    assert.equal(bar.title, '请选择要深入操作的文档')
    assert.equal(bar.items.length, 2)
    assert.ok(bodyWithoutBlock.includes('我先给你推荐一个操作。'))
    assert.ok(!bodyWithoutBlock.includes('```suggestion'))
    assert.ok(!bodyWithoutBlock.includes('"title"'))
  })

  it('parses a bare JSON array inside the suggestion fence', () => {
    const text = '正文\n```suggestion\n[{"label":"发送","action":"send","payload":"go"}]\n```'
    const { bodyWithoutBlock, bar } = parseSuggestionBlock(text)
    assert.ok(!bodyWithoutBlock.includes('```'))
    assert.equal(bar.items.length, 1)
    assert.equal(bar.items[0].action, 'send')
  })

  it('falls back to a plain ```json fence of whitelist actions', () => {
    const text = '## 下一步交付建议（您可点选）\n\n```json\n' + JSON.stringify([
      { label: '生成检查清单', action: 'send', payload: '请生成 Checklist' },
      { label: '导出为表格模板', action: 'send', payload: '请导出为表格' },
    ], null, 2) + '\n```'
    const { bodyWithoutBlock, bar } = parseSuggestionBlock(text)
    assert.ok(bar, 'recognizes bare json array as suggestions')
    assert.equal(bar.items.length, 2)
    assert.ok(!bodyWithoutBlock.includes('```'), 'strips the json fence from body')
    assert.ok(bodyWithoutBlock.includes('下一步交付建议'), 'keeps the heading text')
  })

  it('falls back to same-line ```json suggestion object', () => {
    const text = '请补充信息。\n```json {"title":"快速检索","items":[{"label":"搜索关键词","action":"fill","payload":"[在此输入搜索关键词]"},{"label":"在知识库搜索","action":"send","payload":"search now"}]}\n```'
    const { bodyWithoutBlock, bar } = parseSuggestionBlock(text)
    assert.ok(bar)
    assert.equal(bar.title, '快速检索')
    assert.equal(bar.items.length, 2)
    assert.ok(!bodyWithoutBlock.includes('```'))
  })

  it('parses wrapped suggestion array in json fence', () => {
    const text = [
      '我将直接调用工具。',
      '```json',
      JSON.stringify([
        {
          title: '下一步建议',
          items: [
            { label: '搜索飞书知识库', action: 'fill', payload: '请输入关键词' },
            { label: '读取指定文档', action: 'send', payload: '请提供 doc_token' },
          ],
        },
      ], null, 2),
      '```',
    ].join('\n')
    const { bodyWithoutBlock, bar } = parseSuggestionBlock(text)
    assert.ok(bar, 'recognizes wrapped suggestion array')
    assert.equal(bar.title, '下一步建议')
    assert.equal(bar.items.length, 2)
    assert.ok(!bodyWithoutBlock.includes('"下一步建议"'))
  })

  it('falls back to bare trailing suggestion JSON without a code fence', () => {
    const text = [
      '为了帮你更精准地找到相关资料，请补充：',
      '',
      '- 你要搜的关键词或主题',
      '',
      JSON.stringify({
        title: '快速检索',
        items: [
          { label: '搜索关键词（如：排行榜缓存策略）', action: 'fill', payload: '[在此输入搜索关键词]' },
          { label: '在「技术中台知识库」中搜索', action: 'send', payload: 'search_knowledge_in_feishu_technical_platform' },
        ],
      }, null, 2),
    ].join('\n')
    const { bodyWithoutBlock, bar } = parseSuggestionBlock(text)
    assert.ok(bar, 'recognizes unfenced suggestion object')
    assert.equal(bar.title, '快速检索')
    assert.equal(bar.items.length, 2)
    assert.ok(bodyWithoutBlock.includes('请补充'))
    assert.ok(!bodyWithoutBlock.includes('"title"'))
  })

  it('parses wrapped trailing suggestion array without fence', () => {
    const text = [
      '可以继续选择：',
      '',
      JSON.stringify([
        {
          title: '下一步建议',
          items: [
            { label: '列出知识库节点', action: 'send', payload: 'list wiki nodes' },
            { label: '输入搜索词', action: 'fill', payload: '请输入关键词' },
          ],
        },
      ], null, 2),
    ].join('\n')
    const { bodyWithoutBlock, bar } = parseSuggestionBlock(text)
    assert.ok(bar, 'recognizes wrapped trailing suggestion json')
    assert.equal(bar.title, '下一步建议')
    assert.equal(bar.items.length, 2)
    assert.ok(bodyWithoutBlock.includes('可以继续选择'))
    assert.ok(!bodyWithoutBlock.includes('"items"'))
  })

  it('does not treat unrelated json fences as suggestions', () => {
    const text = '看这段配置：\n```json\n{"port": 8080, "host": "local"}\n```'
    const { bar } = parseSuggestionBlock(text)
    assert.equal(bar, null)
  })

  it('detects incomplete suggestion fence', () => {
    assert.equal(hasIncompleteSuggestionFence('```suggestion\n{"a":1'), true)
    assert.equal(hasIncompleteSuggestionFence('```suggestion {"a":1}'), true)
    assert.equal(hasIncompleteSuggestionFence('```suggestion\n{"items":[]}\n```'), false)
    assert.equal(hasIncompleteSuggestionFence('plain'), false)
  })

  it('detects payloads that still need user edit', () => {
    assert.equal(payloadNeedsUserEdit('请用这份记录生成表格：\n[在此粘贴真实会议记录]'), true)
    assert.equal(payloadNeedsUserEdit('请填写你的姓名'), true)
    assert.equal(payloadNeedsUserEdit('用预设案例演示会议纪要表格'), false)
    assert.equal(payloadNeedsUserEdit(''), false)
  })

  it('merges user input into placeholder payloads without requiring composer draft', () => {
    assert.equal(
      applyUserInputToPayload('请帮我处理飞书文档，链接或内容是：[在此输入]', 'https://feishu.cn/doc/x'),
      '请帮我处理飞书文档，链接或内容是：https://feishu.cn/doc/x',
    )
    assert.equal(applyUserInputToPayload('完整可发送指令', '用户自己写的'), '用户自己写的')
    assert.equal(applyUserInputToPayload('[在此输入]', ''), '')
  })

  it('keeps open_link items in the whitelist', () => {
    const text = `看这里。\n\n\`\`\`suggestion\n${JSON.stringify({
      title: '下一步聚焦建议',
      items: [
        { label: '打开热爱杯篮球群', action: 'open_link', payload: 'https://applink.feishu.cn/client/chat/open?openChatId=oc_x' },
        { label: '打开知识库', action: 'open_knowledge', payload: '' },
      ],
    })}\n\`\`\``
    const { bar } = parseSuggestionBlock(text)
    assert.equal(bar.items.length, 2)
    assert.equal(bar.items[0].action, 'open_link')
    assert.equal(bar.items[0].payload, 'https://applink.feishu.cn/client/chat/open?openChatId=oc_x')
  })

  it.skip('routes open actions by payload rather than action name', () => {
    const applink = 'https://applink.feishu.cn/client/chat/open?openChatId=oc_x'
    const authDeeplink = 'knowme://feishu/auth'
    assert.deepEqual(resolveOpenTarget('open_link', applink), { kind: 'link', url: applink })
    assert.deepEqual(resolveOpenTarget('open_link', authDeeplink), { kind: 'link', url: authDeeplink })
    // 模型把 URL 塞进 open_knowledge 时不能落到知识库全页
    assert.deepEqual(resolveOpenTarget('open_knowledge', applink), { kind: 'link', url: applink })
    assert.deepEqual(resolveOpenTarget('open_knowledge', ''), { kind: 'knowledge', url: '' })
    assert.deepEqual(resolveOpenTarget('open_knowledge', '会议纪要'), { kind: 'knowledge', url: '' })
    assert.deepEqual(resolveOpenTarget('open_link', '去报名三分赛'), { kind: 'invalid', url: '' })
    assert.deepEqual(resolveOpenTarget('send', applink), { kind: 'none', url: '' })
  })

  it.skip('workspace wires AgentSuggestion UI', () => {
    const agent = currentPage('workspace-agent.js')
    const html = currentPage('workspace.html')
    const editorHtml = fs.readFileSync(path.join(__dirname, '..', 'src', 'editor-pane.html'), 'utf8')
    const noteHtml = fs.readFileSync(path.join(__dirname, '..', 'src', 'note.html'), 'utf8')
    const ctx = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'ai-assistant-context.ts'), 'utf8')
    assert.ok(html.includes('lib/agent-suggestion.js'), 'loads suggestion lib')
    assert.ok(html.includes('lib/structured-choice.js'), 'loads structured choice component')
    assert.ok(html.includes('agent-suggest'), 'suggest styles')
    assert.ok(agent.includes('data-suggest-act'), 'click wiring')
    assert.ok(agent.includes('renderSuggestionBar'), 'renders bar')
    assert.ok(agent.includes("'选择一项'") || agent.includes('"选择一项"'), 'explains single-choice behavior')
    assert.ok(agent.includes('window.StructuredChoice.render'), 'delegates rendering to structured choice component')
    assert.ok(agent.includes('window.StructuredChoice.parseSelectionButton'), 'delegates selection parsing to component')
    assert.ok(agent.includes('payloadNeedsUserEdit'), 'guards placeholder payloads')
    assert.ok(agent.includes('applyUserInputToPayload'), 'merges user input on send')
    assert.ok(agent.includes('pendingSuggestionPayload'), 'keeps chosen payload off the composer')
    assert.ok(agent.includes('已选择建议，请补充内容后发送'), 'reminds user to type then send')
    assert.ok(agent.includes('dispatchAgentAction'), 'routes suggestion actions through dispatcher')
    assert.ok(agent.includes('sug-choice'), 'renders numbered choice marker')
    assert.ok(agent.includes('window.StructuredChoice.lock'), 'locks bar after one choice')
    assert.ok(agent.includes('suggestionChosenIndex'), 'persists chosen index on message')
    assert.ok(agent.includes("'已选择'") || agent.includes('"已选择"'), 'shows decided status after choice')
    assert.ok(agent.includes('is-decided'), 'marks decided suggestion group')
    assert.ok(html.includes('.agent-suggest-item.is-selected'), 'shows selected feedback')
    assert.ok(html.includes('.agent-suggest.is-decided'), 'styles locked suggestion group')
    assert.ok(!agent.includes('<button class="agent-chat-act" data-act="copy"'), 'removes persistent message copy button')
    assert.ok(agent.includes("action: 'send'") || agent.includes("act === 'send'"), 'send action')
    assert.ok(agent.includes('resolveOpenTarget'), 'routes open actions through payload resolution')
    assert.ok(agent.includes("legacyAction === 'open_knowledge'"), 'keeps open action compatibility')
    assert.ok(agent.includes("error.code = 'invalid_target'"), 'reports open_link without a URL')
    assert.ok(ctx.includes('含占位符或「手动输入」类选项 MUST 用 fill'), 'prompt separates fill vs send')
    assert.ok(ctx.includes('open_link：payload MUST 是完整 URL'), 'prompt defines open_link')
    assert.ok(ctx.includes('仅用于打开本机知识库全页'), 'prompt narrows open_knowledge to the local library')
    assert.ok(!ctx.includes('两者均会直接发送 payload'), 'prompt no longer treats fill as send')
    assert.ok(html.includes('class="agent-menu agent-quick-menu"'), 'workspace uses an inline expanding quick panel')
    assert.ok(html.indexOf('id="agentQuickMenu"') < html.indexOf('class="agent-input-wrap"'), 'quick panel expands before the input instead of covering chat')
    assert.ok(html.includes('@media (prefers-reduced-motion: reduce)'), 'quick panel respects reduced motion')
    assert.ok(agent.includes('function setQuickMenuOpen(open)'), 'workspace synchronizes quick menu state')
    for (const page of [html, editorHtml, noteHtml]) {
      assert.ok(!page.includes('<span>优化提示词</span>'), 'quick menu is not positioned around prompts')
      assert.ok(page.includes('aria-expanded="false"'), 'quick menu trigger exposes collapsed state')
      assert.ok(page.includes('aria-hidden="true"'), 'quick menu exposes hidden state')
      assert.ok(!page.includes('<span>改写清晰</span>'), 'quick menu drops generic rewrite action')
      assert.ok(!page.includes('<span>查歧义</span>'), 'quick menu drops generic ambiguity action')
    }
    assert.ok(html.includes('id="agentQuickSearch"'), 'workspace quick launcher is searchable')
    assert.ok(!html.includes('快捷大类') && !html.includes('快捷子项'), 'workspace launcher hides internal categories')
    for (const page of [editorHtml, noteHtml]) {
      // 窄编辑器继续使用紧凑飞书能力菜单；工作台改由搜索式命令面板承载。
      assert.ok(page.includes('<span>飞书沟通</span>'), 'quick menu covers instant communication')
      assert.ok(page.includes('<span>文档读写</span>'), 'quick menu covers Feishu docs and drive')
      assert.ok(page.includes('<span>知识库检索</span>'), 'quick menu covers wiki and base')
      assert.ok(page.includes('<span>会议记录</span>'), 'quick menu covers minutes and meeting notes')
      assert.ok(page.includes('<span>日程任务</span>'), 'quick menu covers calendar and tasks')
      assert.ok(page.includes('<span>组织协同</span>'), 'quick menu covers org collaboration')
    }
  })
})
