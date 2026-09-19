'use strict'

const { it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { parseSkillFrontmatter } = require('../src/lib/skill-runtime')
const profile = require('../src/lib/expert-execution-profile')

const ROOT = path.join(__dirname, '../src/catalog')
const read = file => fs.readFileSync(file, 'utf8')
const json = file => JSON.parse(read(file))

it('RQA60 software verification turns explicit scale constraints into complexity evidence', () => {
  const source = read(path.join(ROOT, 'skills/software-change-verification/SKILL.md'))
  const parsed = parseSkillFrontmatter(source)
  const manifest = json(path.join(ROOT, 'skills/software-change-verification/capability.manifest.json'))
  const catalog = json(path.join(ROOT, 'catalog.json')).entries
    .find(item => item.id === 'software-change-verification' && item.kind === 'skill')

  assert.equal(parsed.ok, true)
  assert.equal(parsed.frontmatter.version, '1.1.0')
  assert.equal(manifest.version, '1.1.0')
  assert.equal(catalog.version, '1.1.0')
  assert.match(parsed.body, /输入上限|数据规模/)
  assert.match(parsed.body, /时间复杂度/)
  assert.match(parsed.body, /空间复杂度/)
  assert.match(parsed.body, /最坏情况/)
  assert.match(parsed.body, /待测指标/)
  assert.doesNotMatch(parsed.body, /保证.*毫秒|保证.*吞吐/)
  assert.deepEqual(manifest.permissions, {
    connectors: { allowedConnectorIds: [] },
    tools: { allowlist: [] },
    network: false,
    write: false,
    externalWrite: false,
  })
})

it('RQA60 software engineer integrates implementation, architecture and independent QA modes', () => {
  const manifest = json(path.join(ROOT, 'experts/software-engineer/capability.manifest.json'))
  const sidecar = json(path.join(ROOT, 'experts/software-engineer/manifest.json'))
  const routes = manifest.metadata.knowme.execution.routes
  assert.equal(manifest.version, '3.1.0')
  assert.equal(manifest.name, 'Web 开发专家')
  assert.equal(sidecar.version, manifest.version)
  assert.equal(manifest.permissions.write, true)
  assert.ok(manifest.permissions.tools.allowlist.includes('write_file'))
  assert.ok(manifest.permissions.tools.allowlist.includes('run_task'))
  assert.deepEqual(routes.map(item => item.id), [
    'web-visual-reference', 'architecture-decision', 'software-change-verification', 'quality-verification',
  ])
  const architecture = profile.selectExecutionRoute({ goal: '评审架构边界与迁移策略', brief: {} }, { capabilityManifest: manifest })
  const quality = profile.selectExecutionRoute({ goal: '设计回归测试并给出发布判断', brief: {} }, { capabilityManifest: manifest })
  assert.deepEqual(architecture.requiredSkills, ['architecture-decision'])
  assert.deepEqual(quality.requiredSkills, ['qa-test-design'])
  assert.match(quality.qualityReview.criteria.join('\n'), /测试设计不能冒充测试通过|发布结论必须由实际证据支持/)
})
