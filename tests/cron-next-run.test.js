'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const { parseCronExpr, nextCronRunAt } = require('../src/lib/cron-next-run')

describe('cron-next-run', () => {
  it('parses five-field expressions', () => {
    const parsed = parseCronExpr('*/15 9-18 * * 1-5')
    assert.ok(parsed)
    assert.ok(parsed.minute.includes(0) && parsed.minute.includes(15))
    assert.equal(parseCronExpr('not cron'), null)
  })

  it('finds next weekday 09:00 from Monday morning', () => {
    const from = new Date('2026-08-17T08:00:00')
    const next = nextCronRunAt('0 9 * * 1-5', from)
    assert.ok(next)
    const t = new Date(next)
    assert.equal(t.getHours(), 9)
    assert.equal(t.getMinutes(), 0)
  })
})
