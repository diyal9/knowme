'use strict'
const { currentPage, readPreload } = require('./helpers/current-src')

const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const { splitStreamingMarkdown } = require('../src/lib/agent-stream-visibility')

describe('agent stream visibility boundary', () => {
  it('buffers an unfinished line without returning its raw content', () => {
    const result = splitStreamingMarkdown('# 尚未完成的标题')
    assert.deepEqual(result, { stable: '', pending: true })
    assert.ok(!Object.hasOwn(result, 'tail'))
  })

  it('exposes a completed paragraph as stable content', () => {
    assert.deepEqual(
      splitStreamingMarkdown('已经完成的段落。\n'),
      { stable: '已经完成的段落。\n', pending: false },
    )
  })

  it.skip('buffers an unclosed code fence after stable prose', () => {
    const result = splitStreamingMarkdown('可见段落。\n```json\n{"secret":')
    assert.equal(result.stable, '可见段落。')
    assert.equal(result.pending, true)
    assert.ok(!JSON.stringify(result).includes('secret'))
  })

  it.skip('does not release a markdown table until a blank line closes it', () => {
    const pending = splitStreamingMarkdown('说明。\n| 名称 | 状态 |\n| --- | --- |\n')
    assert.equal(pending.stable, '说明。')
    assert.equal(pending.pending, true)

    const complete = splitStreamingMarkdown('说明。\n| 名称 | 状态 |\n| --- | --- |\n\n')
    assert.equal(complete.pending, false)
    assert.ok(complete.stable.includes('| 名称 | 状态 |'))
  })

  it.skip('releases a closed code fence directly as stable markdown', () => {
    const result = splitStreamingMarkdown('说明。\n```js\nconst ok = true\n```\n')
    assert.equal(result.pending, false)
    assert.ok(result.stable.includes('const ok = true'))
  })

  it.skip('renderer never inserts buffered model tail into visible html', () => {
    const renderer = currentPage('workspace-agent.js')
    const html = currentPage('workspace.html')
    assert.ok(renderer.includes('md-stream-pending'))
    assert.ok(!renderer.includes('md-stream-tail'))
    assert.ok(!renderer.includes('escHtml(tail)'))
    assert.ok(html.includes('agent-stream-visibility.js'))
  })
})
