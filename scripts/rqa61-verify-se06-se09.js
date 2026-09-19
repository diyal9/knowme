'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')

function loadFunction(exportPath, functionName) {
  const exported = JSON.parse(fs.readFileSync(exportPath, 'utf8'))
  const artifacts = exported.artifacts || {}
  let body = String(Object.values(artifacts)[0]?.body || '')
  if (!body) body = String(exported.transcript?.text || '').split('\nAssistant:\n').at(-1) || ''
  const source = body.match(/```javascript\s*([\s\S]*?)```/)?.[1]
  if (!source) throw new Error(`JavaScript implementation not found for ${functionName}`)
  const context = vm.createContext({ Promise, Number, Array, Error, TypeError, Set, Map })
  vm.runInContext(`${source}\nthis.selected = ${functionName}`, context)
  return context.selected
}

function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

const turn = () => new Promise((resolve) => setImmediate(resolve))

async function verifySe06(runPool) {
  await assert.rejects(runPool([1], 1), { message: 'INVALID_ARGUMENT' })
  await assert.rejects(runPool([() => 1], 0), { message: 'INVALID_ARGUMENT' })
  assert.deepEqual(Array.from(await runPool([], 3)), [])

  const gates = [deferred(), deferred(), deferred()]
  const starts = []
  let active = 0
  let peak = 0
  const tasks = gates.map((gate, index) => () => {
    starts.push(index)
    active += 1
    peak = Math.max(peak, active)
    return gate.promise.finally(() => { active -= 1 })
  })
  const ordered = runPool(tasks, 2)
  assert.deepEqual(starts, [0, 1])
  gates[1].resolve('second')
  await turn()
  assert.deepEqual(starts, [0, 1, 2])
  gates[2].resolve('third')
  gates[0].resolve('first')
  assert.deepEqual(Array.from(await ordered), ['first', 'second', 'third'])
  assert.equal(peak, 2)

  const late = deferred()
  const marker = new Error('first-failure')
  let unscheduledCalls = 0
  const unhandled = []
  const onUnhandled = (reason) => unhandled.push(reason)
  process.on('unhandledRejection', onUnhandled)
  try {
    const failed = runPool([
      () => late.promise,
      () => Promise.reject(marker),
      () => { unscheduledCalls += 1; return 'must-not-run' },
    ], 2)
    await assert.rejects(failed, (error) => error === marker)
    assert.equal(unscheduledCalls, 0)
    late.reject(new Error('late-running-task-failure'))
    await turn()
    assert.deepEqual(unhandled, [])
  } finally {
    process.off('unhandledRejection', onUnhandled)
  }

  let afterSyncThrow = 0
  const syncMarker = new Error('sync')
  await assert.rejects(runPool([
    () => { throw syncMarker },
    () => { afterSyncThrow += 1 },
  ], 1), (error) => error === syncMarker)
  assert.equal(afterSyncThrow, 0)

  const counts = [0, 0, 0]
  assert.deepEqual(Array.from(await runPool(counts.map((_, index) => () => {
    counts[index] += 1
    return index
  }), 2)), [0, 1, 2])
  assert.deepEqual(counts, [1, 1, 1])
}

function verifySe09(parsePositiveInt) {
  for (const [input, expected] of [[1, 1], [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER], ['42', 42], [' 123 ', 123]]) {
    assert.equal(parsePositiveInt(input), expected)
  }
  const rejected = [
    0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1,
    '', '   ', '0', '-1', '+1', '01', '1.0', '123abc', '0x1A',
    '１２３', '\t123', '123\n', '\u3000123\u3000', '9007199254740992',
    null, undefined, true, {}, [],
  ]
  for (const input of rejected) {
    assert.throws(() => parsePositiveInt(input), { message: 'INVALID_POSITIVE_INT' })
  }
}

async function main() {
  const [se06Path, se09Path] = process.argv.slice(2)
  if (!se06Path || !se09Path) throw new Error('Usage: node scripts/rqa61-verify-se06-se09.js <se06.json> <se09.json>')
  const results = []
  try {
    await verifySe06(loadFunction(se06Path, 'runPool'))
    results.push({ evalId: 'SE06', passed: true })
  } catch (error) {
    results.push({ evalId: 'SE06', passed: false, error: String(error?.stack || error) })
  }
  try {
    verifySe09(loadFunction(se09Path, 'parsePositiveInt'))
    results.push({ evalId: 'SE09', passed: true })
  } catch (error) {
    results.push({ evalId: 'SE09', passed: false, error: String(error?.stack || error) })
  }
  process.stdout.write(`${JSON.stringify({ results }, null, 2)}\n`)
  process.exitCode = results.every((item) => item.passed) ? 0 : 1
}

void main()
