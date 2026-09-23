'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const { stableHash } = require('../src/lib/agent-output-protocol')
const {
  createAssembler,
  ingestSnapshot,
  clearRoundDraft,
  setCandidate,
  canonicalize,
} = require('../src/lib/agent-output-assembler')

describe('agent-output-assembler', () => {
  it('tracks cumulative snapshots and non-prefix revisions', () => {
    const state = createAssembler()
    ingestSnapshot(state, 'hello')
    ingestSnapshot(state, 'hello world')
    assert.equal(state.roundDraft, 'hello world')
    ingestSnapshot(state, 'world')
    assert.equal(state.roundDraft, 'world')
    assert.ok(state.diagnostics.some(d => d.code === 'non_prefix_revision'))
  })

  it('canonicalizes suggestion blocks into text hash and ui', () => {
    const suggestion = {
      title: '下一步',
      items: [{ id: 'a', label: '发送', action: 'send', payload: 'go' }],
    }
    const raw = `正文开始\n\n\`\`\`suggestion\n${JSON.stringify(suggestion, null, 2)}\n\`\`\`\n\n结尾`
    const state = createAssembler()
    setCandidate(state, raw)
    const out = canonicalize(raw, state)
    assert.ok(out.text.includes('正文开始'))
    assert.ok(out.text.includes('结尾'))
    assert.ok(!out.text.includes('```suggestion'))
    assert.ok(!out.text.includes('"action"'))
    assert.equal(out.hash, stableHash(out.text))
    assert.equal(out.ui.length, 1)
    assert.equal(out.ui[0].kind, 'choice')
    assert.equal(out.ui[0].items.length, 1)
  })

  it('canonicalizes an explicit prose single-choice question into ui', () => {
    const raw = [
      '为了继续，我需要先确认范围。',
      '问题：本次先聚焦哪个阶段？',
      '选项：1. 定义与调优（完善已有草稿）；2. 测试与评估（验证失败场景）；3. 发布治理（上架或回滚）',
    ].join('\n')
    const out = canonicalize(raw, createAssembler())
    assert.equal(out.text, '为了继续，我需要先确认范围。')
    assert.equal(out.ui.length, 1)
    assert.equal(out.ui[0].title, '本次先聚焦哪个阶段？')
    assert.deepEqual(out.ui[0].items.map(item => item.label), ['定义与调优', '测试与评估', '发布治理'])
  })

  it('strips invalid suggestion fences without leaking raw json', () => {
    const raw = '可见正文\n\n```suggestion\n{not json}\n```\n'
    const state = createAssembler()
    const out = canonicalize(raw, state)
    assert.ok(out.text.includes('可见正文'))
    assert.ok(!out.text.includes('```suggestion'))
    assert.ok(!out.text.includes('{not json}'))
    assert.equal(out.ui.length, 0)
  })

  it('strips incomplete suggestion fences without leaking json', () => {
    const raw = [
      '推荐如下：',
      '',
      '```suggestion',
      '{ "title": "选择", "items": [{ "label": "A", "action": "send", "payload": "a" }] }',
    ].join('\n')
    const state = createAssembler()
    const out = canonicalize(raw, state)
    assert.ok(out.text.includes('推荐如下'))
    assert.ok(!out.text.includes('"title"'))
    assert.ok(!out.text.includes('```suggestion'))
  })

  it('strips provider thinking protocol without hiding normal json code', () => {
    const raw = [
      '最终结论。',
      '',
      '```thinking',
      '{"type":"reasoning","steps":["secret"],"next_action":"answer"}',
      '```',
      '',
      '```json',
      '{"public":"example"}',
      '```',
    ].join('\n')
    const state = createAssembler()
    const out = canonicalize(raw, state)
    assert.ok(out.text.includes('最终结论'))
    assert.ok(out.text.includes('"public":"example"'))
    assert.ok(!out.text.includes('"steps"'))
    assert.ok(!out.text.includes('```thinking'))
    assert.ok(out.diagnostics.some(d => d.code === 'thinking_protocol_stripped'))
  })

  it('clears round draft independently from candidate', () => {
    const state = createAssembler()
    ingestSnapshot(state, 'draft prose')
    setCandidate(state, 'final candidate')
    clearRoundDraft(state)
    assert.equal(state.roundDraft, '')
    assert.equal(state.candidate, 'final candidate')
  })
})
