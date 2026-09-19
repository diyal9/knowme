'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { describe, it } = require('node:test')
const { parseExpertFrontmatter } = require('../src/lib/expert-runtime')
const { validateAndNormalizeManifest } = require('../src/lib/capability-manifest-v2')

const ROOT = path.join(__dirname, '../src/catalog')

function readPackage(id) {
  const dir = path.join(ROOT, 'experts', id)
  return {
    expert: parseExpertFrontmatter(fs.readFileSync(path.join(dir, 'EXPERT.md'), 'utf8')),
    legacy: JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')),
    canonical: JSON.parse(fs.readFileSync(path.join(dir, 'capability.manifest.json'), 'utf8')),
  }
}

describe('RQA55 product and research professional answer review', () => {
  it('product manager reviews evidence, lifecycle closure, observable acceptance and revision continuity', () => {
    const { expert, legacy, canonical } = readPackage('product-manager')
    assert.deepEqual([expert.frontmatter.version, legacy.version, canonical.version], ['2.6.0', '2.6.0', '2.6.0'])
    assert.equal(validateAndNormalizeManifest(canonical, { id: 'product-manager', kind: 'expert' }).ok, true)
    const review = canonical.metadata.knowme.execution.qualityReview
    assert.equal(review.enabled, true)
    const body = review.criteria.join('\n')
    assert.match(body, /题面已有.*状态.*删除模板.*待提交.*唯一键/s)
    assert.match(body, /不同对象.*分开建模.*范围外.*信号.*待确认/s)
    assert.match(body, /每条已定规则.*异常恢复.*GIVEN.*WHEN.*唯一可观察.*THEN/s)
    assert.match(body, /角色.*动作.*状态.*权限.*修改轮.*完整替换版.*旧口径/s)

    const skill = fs.readFileSync(path.join(ROOT, 'skills/product-definition-method/SKILL.md'), 'utf8')
    assert.match(skill, /version: 1\.2\.0/)
    assert.match(skill, /状态模型服务于已确认规则.*不是模板必填装饰/s)
    assert.match(skill, /不得为了补齐表格擅加.*草稿.*待提交/s)
    assert.match(skill, /待确认的范围外依赖.*不得.*驱动.*闭环/s)
    assert.match(skill, /不重复副作用.*客户端请求标识.*数据库落库状态/s)
    assert.match(skill, /每条 THEN 只能有一个确定结果.*拆成独立用例/s)
    assert.match(skill, /流程、状态表和验收使用同一角色与动作词典/s)
  })

  it('research analyst reviews original receipts, counterevidence, metadata and route truth', () => {
    const { expert, legacy, canonical } = readPackage('research-analyst')
    assert.deepEqual([expert.frontmatter.version, legacy.version, canonical.version], ['2.4.0', '2.4.0', '2.4.0'])
    assert.equal(validateAndNormalizeManifest(canonical, { id: 'research-analyst', kind: 'expert' }).ok, true)
    const review = canonical.metadata.knowme.execution.qualityReview
    assert.equal(review.enabled, true)
    const body = review.criteria.join('\n')
    assert.match(body, /搜索摘要.*实际读取的原文/s)
    assert.match(body, /反证.*来源冲突.*独立性.*相关性/s)
    assert.match(body, /标题.*发布者.*日期.*链接.*付费墙/s)
    assert.match(body, /本地材料路线.*公共研究路线.*search.*原文读取回执/s)
    const curation = canonical.metadata.knowme.execution.routes.find(item => item.id === 'knowledge-curation')
    assert.deepEqual(curation.requiredSkills, ['knowledge-curation-method', 'knowledge-steward'])
    assert.match(curation.qualityReview.criteria.join('\n'), /来源台账.*冲突.*检索验证/s)
  })

  it('both packages keep review bounded and do not expand write authority', () => {
    const product = readPackage('product-manager').canonical
    assert.equal(product.dependencies.some(item => item.id === 'office-requirement-doc'), false)
    for (const id of ['product-manager', 'research-analyst']) {
      const { canonical } = readPackage(id)
      const review = canonical.metadata.knowme.execution.qualityReview
      assert.equal(canonical.permissions.write, false)
      assert.equal(canonical.permissions.externalWrite, false)
      assert.equal(review.criteria.length, 4)
      assert.ok(review.criteria.every(item => item.length <= 150))
    }
  })
})
