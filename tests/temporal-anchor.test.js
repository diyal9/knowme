'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const { buildTemporalAnchorContext } = require('../src/lib/temporal-anchor')

describe('temporal-anchor', () => {
  it('builds deterministic anchor text for a fixed clock', () => {
    const fixed = new Date('2026-08-13T05:15:08.000Z')
    const text = buildTemporalAnchorContext(fixed)
    assert.match(text, /【当前本地时间锚点】/)
    assert.match(text, /本地日期: \d{4}-\d{2}-\d{2} \(/)
    assert.match(text, /本地时间: \d{2}:\d{2}:\d{2}/)
    assert.match(text, /时区: \S+/)
    assert.match(text, /ISO时间: 2026-08-13T05:15:08\.000Z/)
    assert.match(text, /昨天\/今天\/明天\/上周/)
  })
})
