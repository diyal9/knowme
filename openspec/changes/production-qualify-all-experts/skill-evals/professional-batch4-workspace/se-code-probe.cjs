'use strict'

// Reviewer-owned synthetic probe, NOT a tool receipt from the expert task.
// Implements only frozen M2 semantics; no real database, repository or network.
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const vm = require('node:vm')
const assert = require('node:assert/strict')
const { test } = require('node:test')
const answer = readFileSync(join(__dirname, 'iteration-1/SE-N01/old_skill/outputs/answer.md'), 'utf8')
const code = answer.match(/```js\n([\s\S]*?)```/)[1]
const reserve = vm.runInNewContext(code + '\nreserve', {}, { timeout: 1000 })

function fixture() {
  const states = new Map()
  const queues = new Map()
  const db = {
    states, failPut: false, loseAck: false,
    failure: new Error('SYNTHETIC_DATABASE_FAILURE'),
    seed(tenant, stock) { states.set(tenant, { stocks: new Map([['P', stock]]), requests: new Map() }) },
    async tx(tenant, callback) {
      const prior = queues.get(tenant) || Promise.resolve()
      let release
      queues.set(tenant, new Promise(resolve => { release = resolve }))
      await prior
      try {
        const current = states.get(tenant)
        const next = { stocks: new Map(current.stocks), requests: new Map(current.requests) }
        const check = actual => assert.equal(actual, tenant, 'tenant-bound transaction')
        const result = await callback({
          async getStock(t, sku) { check(t); return next.stocks.get(sku) || 0 },
          async setStock(t, sku, n) { check(t); next.stocks.set(sku, n) },
          async getRequest(t, id) { check(t); return next.requests.get(id) },
          async putRequest(t, id, record) {
            check(t)
            if (db.failPut) { db.failPut = false; throw db.failure }
            if (next.requests.has(id)) throw new Error('UNIQUE_CONFLICT')
            next.requests.set(id, record)
          },
        })
        states.set(tenant, next)
        if (db.loseAck) { db.loseAck = false; throw db.failure }
        return result
      } finally { release() }
    },
  }
  db.seed('A', 5)
  db.seed('B', 5)
  return db
}
const input = (requestId, qty, extra = {}) => ({ tenant: 'A', sku: 'P', requestId, qty, ...extra })

test('reviewer probe: invalid quantities cause no transaction or mutation', async () => {
  const db = fixture()
  db.tx = () => { throw new Error('unexpected transaction') }
  for (const qty of [0, -1, 1.5, NaN, Infinity, 2 ** 53, '2', undefined]) {
    await assert.rejects(reserve(db, input('invalid', qty)), /INVALID_QTY/)
  }
  assert.equal(db.states.get('A').stocks.get('P'), 5)
  assert.equal(db.states.get('A').requests.size, 0)
})

test('reviewer probe: serializable concurrent different keys cannot oversell', async () => {
  const db = fixture()
  const results = await Promise.allSettled([reserve(db, input('r1', 4)), reserve(db, input('r2', 3))])
  assert.equal(results[0].status, 'fulfilled')
  assert.equal(results[1].status, 'rejected')
  assert.match(results[1].reason.message, /OUT_OF_STOCK/)
  assert.equal(db.states.get('A').stocks.get('P'), 1)
  assert.equal(db.states.get('A').requests.size, 1)
})

test('reviewer probe: concurrent same key and later replay return original result', async () => {
  const db = fixture()
  const results = await Promise.all([reserve(db, input('r1', 2)), reserve(db, input('r1', 2))])
  assert.equal(results[0].remaining, 3)
  assert.equal(results[1].remaining, 3)
  await reserve(db, input('r2', 1))
  assert.equal((await reserve(db, input('r1', 2))).remaining, 3)
  assert.equal(db.states.get('A').stocks.get('P'), 2)
})

test('reviewer probe: parameter conflict, tenant independence and missing stock', async () => {
  const db = fixture()
  await Promise.all([reserve(db, input('same', 2)), reserve(db, input('same', 3, { tenant: 'B' }))])
  await assert.rejects(reserve(db, input('same', 3)), /IDEMPOTENCY_CONFLICT/)
  await assert.rejects(reserve(db, input('same', 2, { sku: 'Q' })), /IDEMPOTENCY_CONFLICT/)
  await assert.rejects(reserve(db, input('missing', 1, { sku: 'Q' })), /OUT_OF_STOCK/)
  assert.equal(db.states.get('A').stocks.get('P'), 3)
  assert.equal(db.states.get('B').stocks.get('P'), 2)
  assert.equal(db.states.get('A').requests.has('missing'), false)
})

test('reviewer probe: failure after stock write rolls back and preserves error identity', async () => {
  const db = fixture()
  db.failPut = true
  await assert.rejects(reserve(db, input('retry', 2)), error => error === db.failure)
  assert.equal(db.states.get('A').stocks.get('P'), 5)
  assert.equal(db.states.get('A').requests.size, 0)
  assert.equal((await reserve(db, input('retry', 2))).remaining, 3)
})

test('reviewer probe: lost post-commit response replays without another decrement', async () => {
  const db = fixture()
  db.loseAck = true
  await assert.rejects(reserve(db, input('retry', 2)), error => error === db.failure)
  assert.equal(db.states.get('A').stocks.get('P'), 3)
  assert.equal((await reserve(db, input('retry', 2))).remaining, 3)
  assert.equal(db.states.get('A').requests.size, 1)
})
