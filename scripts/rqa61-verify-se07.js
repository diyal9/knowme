'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')

const sourcePath = process.argv[2]
if (!sourcePath) throw new Error('Usage: node scripts/rqa61-verify-se07.js <raw-export.json>')

const exported = JSON.parse(fs.readFileSync(sourcePath, 'utf8'))
const artifact = Object.values(exported.artifacts || {})[0]
const source = String(artifact?.body || '').match(/```javascript\s*([\s\S]*?)```/)?.[1]
if (!source) throw new Error('JavaScript implementation was not found in the exported artifact')

const context = vm.createContext({ Promise, Map, Object, Number, TypeError })
vm.runInContext(`${source}\nthis.createLoader = createLoader`, context)
const createLoader = context.createLoader

function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

async function testInvalidatedKeyStartsNewFlight() {
  let now = 0
  let calls = 0
  const oldFlight = deferred()
  const newFlight = deferred()
  const loader = createLoader({ ttlMs: 100, now: () => now })
  const first = loader.load('A', () => { calls += 1; return oldFlight.promise })
  loader.invalidate('A')
  const second = loader.load('A', () => { calls += 1; return newFlight.promise })
  assert.equal(calls, 2, 'a post-invalidation load must start a new fetcher')
  newFlight.resolve('new')
  oldFlight.resolve('old')
  assert.equal(await second, 'new')
  assert.equal(await first, 'old')
}

async function testInvalidatingADoesNotEvictB() {
  let now = 0
  let bCalls = 0
  const bFlight = deferred()
  const loader = createLoader({ ttlMs: 100, now: () => now })
  const firstB = loader.load('B', () => { bCalls += 1; return bFlight.promise })
  loader.invalidate('A')
  bFlight.resolve('b-value')
  assert.equal(await firstB, 'b-value')
  assert.equal(await loader.load('B', () => { bCalls += 1; return 'unexpected' }), 'b-value')
  assert.equal(bCalls, 1, 'invalidating A must not prevent successful B from being cached')
}

async function testPromiseIdentityClaim() {
  const flight = deferred()
  const loader = createLoader({ ttlMs: 100, now: () => 0 })
  const first = loader.load('A', () => flight.promise)
  const second = loader.load('A', () => { throw new Error('must not run') })
  assert.equal(first, second, 'the answer claims callers receive the same Promise reference')
  flight.resolve('ok')
  await Promise.all([first, second])
}

async function run(name, fn) {
  try {
    await fn()
    return { name, passed: true }
  } catch (error) {
    return { name, passed: false, error: String(error?.message || error) }
  }
}

Promise.all([
  run('post-invalidation read starts a new flight', testInvalidatedKeyStartsNewFlight),
  run('different keys remain isolated', testInvalidatingADoesNotEvictB),
  run('claimed Promise identity is true', testPromiseIdentityClaim),
]).then((results) => {
  process.stdout.write(`${JSON.stringify({ results }, null, 2)}\n`)
  process.exitCode = results.every((item) => item.passed) ? 0 : 1
})
