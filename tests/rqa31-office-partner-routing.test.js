'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { describe, it } = require('node:test')
const { parseExpertFrontmatter, validateExpertPackage } = require('../src/lib/expert-runtime')
const { validateAndNormalizeManifest } = require('../src/lib/capability-manifest-v2')
const profile = require('../src/lib/expert-execution-profile')

const ROOT = path.join(__dirname, '../src/catalog')
const EXPERT_DIR = path.join(ROOT, 'experts', 'office-partner')
const read = file => fs.readFileSync(path.join(EXPERT_DIR, file), 'utf8')
const json = file => JSON.parse(read(file))

function packageFiles() {
  return {
    expert: parseExpertFrontmatter(read('EXPERT.md')),
    canonical: json('capability.manifest.json'),
    legacy: json('manifest.json'),
  }
}

function snapshot(canonical) {
  return {
    capabilityManifest: canonical,
    bindings: {
      skills: canonical.dependencies.filter(item => item.kind === 'skill').map(item => item.id),
      connectors: canonical.dependencies.filter(item => item.kind === 'connector').map(item => item.id),
    },
  }
}

describe('RQA31 office-partner supplied-material routing', () => {
  it('keeps E/C/L/catalog version and the single dialogue deliverable aligned', () => {
    const { expert, canonical, legacy } = packageFiles()
    assert.equal(expert.ok, true)
    assert.equal(validateExpertPackage(expert).ok, true)
    assert.equal(validateAndNormalizeManifest(canonical, { id: 'office-partner', kind: 'expert' }).ok, true)
    assert.deepEqual(
      [expert.frontmatter.version, canonical.version, legacy.version],
        ['2.4.0', '2.4.0', '2.4.0'],
    )
    const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'catalog.json'), 'utf8'))
      assert.equal(catalog.entries.find(item => item.id === 'office-partner')?.version, '2.4.0')
    assert.deepEqual(canonical.metadata.knowme.execution.deliverables, [
      {
        id: 'output-1', title: '办公协作结果', type: 'answer',
        required: true,
      },
    ])
    assert.deepEqual(expert.outputContract, ['办公协作结果'])
    assert.deepEqual(canonical.outputs, ['办公协作结果'])
    assert.deepEqual(legacy.outputs, ['办公协作结果'])
  })

  it('binds one required office method across expert, manifests, catalog and pack', () => {
    const { expert, canonical, legacy } = packageFiles()
    const core = 'office-collaboration-method'
    assert.ok(expert.skills.includes(core))
    assert.ok(legacy.skills.includes(core))
    assert.equal(canonical.dependencies.find(item => item.id === core)?.required, true)
    assert.equal(canonical.dependencies.find(item => item.id === 'writing-polish')?.required, false)
    const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'catalog.json'), 'utf8'))
    assert.equal(catalog.entries.find(item => item.id === core)?.kind, 'skill')
    assert.ok(catalog.entries.find(item => item.id === 'office-partner')?.skills.includes(core))
    const pack = JSON.parse(fs.readFileSync(path.join(ROOT, '../packs/office-partner/pack.json'), 'utf8'))
    assert.equal(pack.version, '1.2.0')
    assert.ok(pack.skills.includes(core))
  })

  it('ships a bounded expert method for source fidelity, genre fit, uncertainty and revision', () => {
    const dir = path.join(ROOT, 'skills', 'office-collaboration-method')
    const skill = fs.readFileSync(path.join(dir, 'SKILL.md'), 'utf8')
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'capability.manifest.json'), 'utf8'))
    assert.equal(manifest.id, 'office-collaboration-method')
    assert.equal(manifest.kind, 'skill')
    assert.equal(manifest.version, '1.0.0')
    assert.deepEqual(manifest.permissions.tools.allowlist, [])
    for (const phrase of ['事实范围', '文体', '行动项', '待确认', '修订', '外部写入']) {
      assert.match(skill, new RegExp(phrase))
    }
  })

  it('uses the provided text directly and does not require Feishu tools', () => {
    const { canonical } = packageFiles()
    const task = {
      goal: '请整理这份会议纪要并形成团队同步稿',
      brief: { materials: [{ title: '会议转写', content: '决定周五上线；负责人李明。' }] },
      deliverables: [],
    }
    const spec = profile.resolveOutputSpec(task, snapshot(canonical))
      assert.equal(spec.executionRoute, 'provided-meeting')
      assert.deepEqual(spec.requiredTools, [])
      assert.deepEqual(spec.executionToolAllowlist, [])
      assert.deepEqual(spec.requiredConnectorIds, [])
    assert.deepEqual(spec.requiredSkills, ['meeting-evidence-method'])
  })

  it('extracts action items with the dedicated method and its own quality review', () => {
    const { canonical } = packageFiles()
    const spec = profile.resolveOutputSpec({
      goal: '从会议记录中提取行动项、负责人和截止日',
      brief: { materials: [{ content: '李明承诺周五提交测试报告；王芳提议下周再讨论灰度范围。' }] },
      deliverables: [],
    }, snapshot(canonical))
    assert.equal(spec.executionRoute, 'action-extraction')
    assert.deepEqual(spec.requiredSkills, ['action-extraction'])
    assert.deepEqual(spec.requiredTools, [])
    assert.match(profile.qualityReviewContract(snapshot(canonical), spec).criteria.join('\n'), /承诺|负责人|外部任务/)
  })

  it('still requires real Feishu reads when the user explicitly requests retrieval', () => {
    const { canonical } = packageFiles()
    const task = {
      goal: '请从飞书读取今天的会议并整理纪要',
      brief: { materials: [{ content: '范围提示：查研发例会。' }] },
      deliverables: [],
    }
    const spec = profile.resolveOutputSpec(task, snapshot(canonical))
      assert.equal(spec.executionRoute, 'meeting-summary')
      assert.deepEqual(spec.requiredTools, ['feishu.meeting_candidates'])
      assert.deepEqual(spec.executionToolAllowlist, ['feishu.meeting_candidates', 'feishu.meeting_read'])
      assert.deepEqual(spec.requiredConnectorIds, ['feishu'])
  })

  it('supports direct drafting without inventing an external lookup', () => {
    const { canonical } = packageFiles()
    const spec = profile.resolveOutputSpec({
      goal: '草拟一封项目延期说明邮件', brief: {}, deliverables: [],
    }, snapshot(canonical))
      assert.equal(spec.executionRoute, 'direct-drafting')
      assert.deepEqual(spec.requiredTools, [])
      assert.deepEqual(spec.executionToolAllowlist, [])
      assert.deepEqual(spec.requiredConnectorIds, [])
    assert.deepEqual(spec.requiredSkills, ['office-collaboration-method'])
  })

  it('does not promise a separate checklist artifact for work that is not being sent', () => {
    const { expert, canonical, legacy } = packageFiles()
    for (const source of [read('EXPERT.md'), canonical.metadata.sop, legacy.sop]) {
      assert.match(source, /仅当用户要求发送、发布或交付前检查时/)
      assert.doesNotMatch(source, /交付物和检查清单/)
    }
  })
})
