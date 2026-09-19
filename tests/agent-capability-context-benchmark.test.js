const { test } = require('node:test')
const assert = require('node:assert/strict')
const { benchmarkCapabilityContext } = require('../scripts/agent-capability-context-benchmark')

test('500-tool synthetic baseline preserves discovery and relevant selection with bounded schemas', () => {
  const result = benchmarkCapabilityContext(500)
  assert.equal(result.discoverableCount, 500)
  assert.equal(result.relevantToolSelected, true)
  assert.ok(result.selectedCount <= 8)
  assert.ok(result.selectedSchemaTokens < result.fullSchemaTokens)
  assert.ok(Number.isFinite(result.selectionP95Ms))
})
