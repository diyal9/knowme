'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { describe, it } = require('node:test')
const { parseExpertFrontmatter } = require('../src/lib/expert-runtime')
const { parseSkillFrontmatter } = require('../src/lib/skill-runtime')
const { validateAndNormalizeManifest } = require('../src/lib/capability-manifest-v2')

const ROOT = path.join(__dirname, '../src/catalog')
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'))

function expertPackage(id) {
  const dir = path.join(ROOT, 'experts', id)
  return {
    expert: parseExpertFrontmatter(fs.readFileSync(path.join(dir, 'EXPERT.md'), 'utf8')),
    legacy: readJson(path.join(dir, 'manifest.json')),
    canonical: readJson(path.join(dir, 'capability.manifest.json')),
  }
}

describe('RQA56 image producer deserves end-to-end professional depth', () => {
  it('owns visual direction, brief compilation and real image generation in one package', () => {
    const { expert, legacy, canonical } = expertPackage('image-producer')
    assert.deepEqual([expert.frontmatter.version, legacy.version, canonical.version], ['4.0.0', '4.0.0', '4.0.0'])
    assert.equal(validateAndNormalizeManifest(canonical, { id: 'image-producer', kind: 'expert' }).ok, true)
    for (const id of ['creative-concept-method', 'visual-brief-prompt', 'th-art-intake', 'th-art-prompt-enrich', 'th-art-pango-generate']) {
      assert.equal(canonical.dependencies.find(item => item.id === id)?.required, true, id)
      assert.ok(expert.skills.includes(id), id)
      assert.ok(legacy.skills.includes(id), id)
    }
    assert.match(expert.sop, /视觉 Brief/)
    assert.match(expert.sop, /generate_image/)
  })

  it('visual brief method is a decision method instead of a field template', () => {
    const dir = path.join(ROOT, 'skills/visual-brief-prompt')
    const source = fs.readFileSync(path.join(dir, 'SKILL.md'), 'utf8')
    const skill = parseSkillFrontmatter(source)
    const manifest = readJson(path.join(dir, 'capability.manifest.json'))
    assert.equal(skill.frontmatter.version, '2.1.0')
    assert.equal(manifest.version, '2.1.0')
    assert.ok(source.split(/\r?\n/).length >= 70)
    for (const phrase of ['信息层级', '视觉动线', '安全区', '多比例', '缩略图', '可访问性', '权利状态', '不可兼得']) {
      assert.match(source, new RegExp(phrase), phrase)
    }
  })

  it('image producer owns evidence-based generation and revision review', () => {
    const { expert, legacy, canonical } = expertPackage('image-producer')
    assert.deepEqual([expert.frontmatter.version, legacy.version, canonical.version], ['4.0.0', '4.0.0', '4.0.0'])
    assert.equal(validateAndNormalizeManifest(canonical, { id: 'image-producer', kind: 'expert' }).ok, true)
    const review = canonical.metadata.knowme.execution.qualityReview
    assert.equal(review.enabled, true)
    const body = review.criteria.join('\n')
    assert.match(body, /generate_image.*image artifact.*解码/s)
    assert.match(body, /实际可见图像.*构图.*文字.*品牌/s)
    assert.match(body, /变更集.*保留集.*基图/s)
    assert.match(body, /失败.*未知.*重试.*付费/s)
    assert.deepEqual(canonical.permissions.tools.allowlist, ['list_paint_models', 'generate_image'])
    assert.equal(canonical.permissions.externalWrite, false)
  })

  it('all three image execution skills contain versioned professional methods', () => {
    const expectations = {
      'th-art-intake': ['阻塞项', '默认值', '参考图角色', '确认边界'],
      'th-art-prompt-enrich': ['约束优先级', '变更集', '保留集', '冲突检查', 'reference_images'],
      'th-art-pango-generate': ['调用回执', 'decoded-file', '副作用未知', '禁止自动重试', '版本'],
    }
    for (const [id, phrases] of Object.entries(expectations)) {
      const dir = path.join(ROOT, 'skills', id)
      const source = fs.readFileSync(path.join(dir, 'SKILL.md'), 'utf8')
      const skill = parseSkillFrontmatter(source)
      const manifest = readJson(path.join(dir, 'capability.manifest.json'))
      assert.equal(skill.frontmatter.version, '1.1.0', id)
      assert.equal(manifest.version, '1.1.0', id)
      assert.ok(source.split(/\r?\n/).length >= 45, id)
      for (const phrase of phrases) assert.match(source, new RegExp(phrase), `${id}: ${phrase}`)
    }
  })
})
