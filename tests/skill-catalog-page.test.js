'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const { pageSkillCatalog, validateSkillCatalogPage } = require('../src/lib/skill-catalog-page')
const { buildSkillTools, validateSkillToolCall, LIST_SKILLS_TOOL } = require('../src/lib/agent-skill-tools')

const records = Array.from({ length: 75 }, (_, i) => ({ id: `skill-${String(i).padStart(3, '0')}`, name: `Skill ${i}`, description: `${i % 2 ? 'odd' : 'even'} method`, source: 'pack', dependencies: [{ id: 'private-host-metadata' }] }))

test('catalog pages default to ten and cover the matching directory without gaps', () => {
  let cursor = ''
  const ids = []
  do {
    const page = pageSkillCatalog(records, { cursor })
    assert.equal(page.ok, true)
    assert.equal(page.total, 75)
    assert.ok(page.skills.length <= 10)
    assert.equal(page.skills[0].dependencies, undefined)
    ids.push(...page.skills.map(item => item.id))
    cursor = page.nextCursor
  } while (cursor)
  assert.deepEqual(ids, records.map(item => item.id))
  assert.equal(pageSkillCatalog(records, { limit: 30 }).skills.length, 30)
})

test('query and cursor validation bound L0 and invalidate changed scope/catalog', () => {
  const first = pageSkillCatalog(records, { query: 'ODD', limit: 3 })
  assert.equal(first.total, 37)
  assert.ok(first.skills.every(item => item.description.startsWith('odd')))
  assert.equal(pageSkillCatalog(records.slice(1), { query: 'ODD', cursor: first.nextCursor }).ok, true)
  assert.equal(pageSkillCatalog(records.slice(2), { query: 'ODD', cursor: first.nextCursor }).code, 'invalid_cursor')
  assert.equal(pageSkillCatalog(records, { query: 'even', cursor: first.nextCursor }).code, 'invalid_cursor')
  for (const args of [{ limit: 0 }, { limit: 31 }, { limit: 2.5 }, { query: 'x'.repeat(201) }, { cursor: 3 }, { limit: '10' }]) assert.equal(validateSkillCatalogPage(args).ok, false)
  assert.equal(pageSkillCatalog(records, { cursor: 'invalid' }).code, 'invalid_cursor')
  assert.equal(pageSkillCatalog([], {}).nextCursor, null)
})

test('long optional L0 metadata is visibly abbreviated without leaking host-only fields', () => {
  const page = pageSkillCatalog([{ ...records[0], name: 'n'.repeat(10000), description: 'd'.repeat(100000), body: 'host only' }])
  assert.equal(page.skills[0].metadataTruncated, true)
  assert.equal(page.skills[0].description.length, 240)
  assert.equal(page.skills[0].body, undefined)
  assert.ok(JSON.stringify(page).length < 1000)
})

test('list_skills schema, validator and handler expose bounded searchable pages', async () => {
  const props = LIST_SKILLS_TOOL.function.parameters.properties
  assert.equal(props.limit.maximum, 30)
  assert.ok(props.query && props.cursor)
  assert.equal(validateSkillToolCall('list_skills', { limit: 31 }).ok, false)
  const { handlers } = buildSkillTools({ runtime: { listSkillsL0: () => records } })
  const first = await handlers.list_skills({ limit: 3 })
  assert.equal(first.skills.length, 3)
  assert.ok(first.nextCursor)
  assert.match(first.text, /nextCursor/)
  const next = await handlers.list_skills({ limit: 3, cursor: first.nextCursor })
  assert.equal(next.skills[0].id, 'skill-003')
  assert.equal((await handlers.list_skills({ query: 'missing' })).skills.length, 0)
})
