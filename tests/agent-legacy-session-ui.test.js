'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const { parseSuggestionBlock } = require('../src/lib/agent-suggestion')

describe('legacy session suggestion hydration', () => {
  const agent = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace-agent.js'), 'utf8')

  it('workspace includes lazy legacy hydration helper', () => {
    assert.ok(agent.includes('function hydrateLegacyAssistantMessage'), 'lazy hydration helper exists')
    assert.ok(agent.includes('parseSuggestionBlock'), 'reuses agent suggestion parser')
    assert.ok(agent.includes('data-structured-ui="1"'), 'structured ui is rendered separately')
  })

  it('strips fenced suggestion json from legacy body', () => {
    const text = `说明。\n\n\`\`\`suggestion\n${JSON.stringify({
      title: '下一步',
      items: [{ label: '发送', action: 'send', payload: 'go' }],
    })}\n\`\`\``
    const { bodyWithoutBlock, bar } = parseSuggestionBlock(text)
    assert.ok(bar)
    assert.ok(!bodyWithoutBlock.includes('```suggestion'))
    assert.ok(!bodyWithoutBlock.includes('"action"'))
  })

  it('strips bare trailing suggestion json', () => {
    const text = '正文\n[{"label":"发送","action":"send","payload":"go"}]'
    const { bodyWithoutBlock, bar } = parseSuggestionBlock(text)
    assert.ok(bar)
    assert.ok(bodyWithoutBlock.includes('正文'))
    assert.ok(!bodyWithoutBlock.includes('"label"'))
  })

  it('keeps invalid fenced suggestion out of visible body when stripped by assembler path', () => {
    const { stripMalformedSuggestionBlocks } = require('../src/lib/agent-output-assembler')
    const out = stripMalformedSuggestionBlocks('可见\n```suggestion\n{bad}\n```')
    assert.ok(out.includes('可见'))
    assert.ok(!out.includes('{bad}'))
  })

  it('handles incomplete suggestion fence without json leak', () => {
    const text = '推荐如下\n```suggestion\n{"title":"选","items":[{"label":"A","action":"send","payload":"a"}]}'
    const { bodyWithoutBlock, bar } = parseSuggestionBlock(text)
    assert.ok(bar)
    assert.ok(!bodyWithoutBlock.includes('"title"'))
  })
})
