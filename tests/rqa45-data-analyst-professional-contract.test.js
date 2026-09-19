'use strict'

const { it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const profile = require('../src/lib/expert-execution-profile')

const ROOT = path.join(__dirname, '../src/catalog')
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'))

it('RQA45 data analyst can use bounded calculation without requiring side effects', () => {
  const expert = readJson(path.join(ROOT, 'experts/data-analyst/capability.manifest.json'))
  const route = expert.metadata?.knowme?.execution?.routes?.find(item => item.default)

  assert.equal(expert.version, '2.3.0')
  assert.deepEqual(expert.permissions?.tools?.allowlist, ['calculate'])
  assert.equal(expert.permissions?.network, false)
  assert.equal(expert.permissions?.write, false)
  assert.equal(expert.permissions?.externalWrite, false)
  assert.deepEqual(route?.toolAllowlist, ['calculate'])
  assert.deepEqual(route?.requiredTools || [], [])
  const output = profile.resolveOutputSpec({ brief: {}, deliverables: [] }, { capabilityManifest: expert })
  assert.deepEqual(output.executionToolAllowlist, ['calculate'])
  assert.deepEqual(output.requiredTools, [])
  assert.deepEqual(profile.scopePermissionsForOutputSpec(expert.permissions, output).tools.allowlist, ['calculate'])
})

it('RQA45 data analyst owns a full-response numerical and causal review contract', () => {
  const expert = readJson(path.join(ROOT, 'experts/data-analyst/capability.manifest.json'))
  const review = expert.metadata?.knowme?.execution?.qualityReview

  assert.equal(review?.enabled, true)
  assert.ok(Array.isArray(review.criteria) && review.criteria.length >= 4)
  const criteria = review.criteria.join('\n')
  assert.match(criteria, /分子|分母|合计|单位/)
  assert.match(criteria, /全文|摘要|表格|建议/)
  assert.match(criteria, /未知|零|冲突/)
  assert.match(criteria, /因果|竞争解释|证据强度/)
})

it('RQA45 keeps the upgraded data analyst package aligned with the catalog', () => {
  const catalog = readJson(path.join(ROOT, 'catalog.json')).entries
  const expert = readJson(path.join(ROOT, 'experts/data-analyst/capability.manifest.json'))
  const sidecar = readJson(path.join(ROOT, 'experts/data-analyst/manifest.json'))
  const entry = catalog.find(item => item.id === 'data-analyst' && item.kind === 'expert')

  assert.equal(expert.version, '2.3.0')
  assert.equal(sidecar.version, expert.version)
  assert.equal(entry?.version, expert.version)
})

it('RQA45 data analyst routes business insight and report writing through dedicated methods', () => {
  const expert = readJson(path.join(ROOT, 'experts/data-analyst/capability.manifest.json'))
  const snapshot = { capabilityManifest: expert }
  const insight = profile.selectExecutionRoute({ goal: '做经营指标异常归因和商业洞察', brief: {} }, snapshot)
  const report = profile.selectExecutionRoute({ goal: '整理一份月度数据分析报告', brief: {} }, snapshot)
  assert.equal(insight.id, 'business-insight')
  assert.deepEqual(insight.requiredSkills, ['business-metrics-analysis', 'business-cause-analysis', 'business-insight-report'])
  assert.deepEqual(insight.toolAllowlist, ['calculate'])
  assert.equal(report.id, 'data-report')
  assert.deepEqual(report.requiredSkills, ['data-report-method'])
})
