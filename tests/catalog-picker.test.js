'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const CatalogPicker = require('../src/lib/catalog-picker')

const skills = [
  { id: 'game-qa', name: '游戏测试验收', category: '游戏' },
  { id: 'office-doc', name: '办公文档', category: '办公' },
  { id: 'feishu-doc', name: '飞书文档', category: '办公' },
]

describe('catalog picker', () => {
  it('exports a browse threshold and panel renderer', () => {
    assert.equal(CatalogPicker.BROWSE_THRESHOLD, 9)
    const html = CatalogPicker.renderPanel({
      title: 'Skills',
      name: 'hub-expert-skill',
      items: skills,
      selected: ['office-doc'],
      unit: 'Skill',
    })
    assert.ok(html.includes('data-picker="hub-expert-skill"'))
    assert.ok(html.includes('value="office-doc" checked'))
    assert.ok(html.includes('游戏测试验收'))
    assert.ok(!html.includes('data-picker-search='), 'small lists skip browse search')
  })

  it('switches large catalogs to grouped browse mode', () => {
    const items = Array.from({ length: 12 }, (_, i) => ({
      id: `s-${i}`,
      name: `技能 ${i}`,
      category: i < 4 ? '游戏' : '办公',
    }))
    const html = CatalogPicker.renderPanel({
      name: 'hub-expert-skill',
      title: 'Skills',
      items,
      selected: ['s-0'],
      unit: 'Skill',
    })
    assert.ok(html.includes('data-picker-search='))
    assert.ok(html.includes('hub-check-subgroup'))
    assert.ok(html.includes('data-pick-all="hub-expert-skill"'))
    assert.ok(html.includes('.hub-check:not([hidden]) input') === false)
    assert.equal(typeof CatalogPicker.filter, 'function')
    assert.equal(typeof CatalogPicker.applyBulk, 'function')
    assert.equal(typeof CatalogPicker.selectedValues, 'function')
  })

  it('renders empty install-then-select guidance', () => {
    const html = CatalogPicker.renderSummary({
      title: 'Skills',
      hint: '专家可以调用的技能。',
      name: 'hub-expert-skill',
      items: [],
      selected: [],
      emptyLabel: '请先安装技能，再选择要装配的能力。',
      emptyAction: { label: '去安装技能', tab: 'skills' },
      unit: 'Skill',
    })
    assert.ok(html.includes('请先安装技能，再选择要装配的能力。'))
    assert.ok(html.includes('data-picker-empty-action="skills"'))
    assert.ok(html.includes('去安装技能'))
    assert.ok(!html.includes('data-open-picker='))
  })

  it('summary lists selected chips and hidden values', () => {
    const html = CatalogPicker.renderSummary({
      title: 'Skills',
      hint: '专家可以调用的技能。',
      name: 'hub-expert-skill',
      items: skills,
      selected: ['office-doc', 'game-qa'],
      selectLabel: '选择技能',
      unit: 'Skill',
    })
    assert.ok(html.includes('data-open-picker="hub-expert-skill"'))
    assert.ok(html.includes('选择技能'))
    assert.ok(html.includes('办公文档'))
    assert.ok(html.includes('name="hub-expert-skill"'))
    assert.ok(html.includes('2/3'))
  })
})
