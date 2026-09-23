'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const {
  REMOVED_BUNDLED_EXPERT_IDS,
  PRESERVED_RETIRED_TASK_EXPERT_IDS,
} = require('../src/lib/production-catalog-migration')

const ROOT = path.join(__dirname, '..', 'src', 'catalog')
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'catalog.json'), 'utf8'))
const operationsManifest = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'experts/operations-data-analyst/capability.manifest.json'),
  'utf8',
))
const generalSkills = [
  'data-analysis-method',
  'business-metrics-analysis',
  'business-cause-analysis',
  'business-insight-report',
  'data-report-method',
]

test('generic data analysis is partner-callable Skills without a bundled expert', () => {
  assert.equal(catalog.entries.some(item => item.id === 'data-analyst' && item.kind === 'expert'), false)
  assert.equal(fs.existsSync(path.join(ROOT, 'experts/data-analyst/EXPERT.md')), false)
  assert.ok(REMOVED_BUNDLED_EXPERT_IDS.includes('data-analyst'))
  assert.ok(PRESERVED_RETIRED_TASK_EXPERT_IDS.includes('data-analyst'))
  for (const id of generalSkills) {
    assert.equal(catalog.entries.find(item => item.id === id)?.kind, 'skill', id)
    assert.equal(fs.existsSync(path.join(ROOT, 'skills', id, 'SKILL.md')), true, id)
  }
})

test('数据靓仔 remains the retained tool-backed analysis Agent', () => {
  const entry = catalog.entries.find(item => item.id === 'operations-data-analyst' && item.kind === 'expert')
  assert.equal(entry?.name, '数据靓仔')
  assert.equal(operationsManifest.name, '数据靓仔')
  for (const id of generalSkills) {
    assert.ok(operationsManifest.dependencies.some(dep => dep.id === id && dep.kind === 'skill'), id)
  }
  assert.deepEqual(operationsManifest.permissions.connectors.allowedConnectorIds,
    ['pango-data-mcp', 'thinkingdata-analysis-mcp', 'feishu'])
})
