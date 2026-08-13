'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { deriveExpertDisplayName, hasChineseText } = require('../src/lib/expert-display-name')

describe('expert display name derivation', () => {
  it('keeps a name that already reads as Chinese', () => {
    const result = deriveExpertDisplayName({ name: '办公伙伴', description: '面向日常办公场景的多能力专家。' })
    assert.deepEqual(result, { name: '办公伙伴', source: 'name' })
  })

  it('prefers an explicit title field over derivation', () => {
    const result = deriveExpertDisplayName({
      name: 'ui-expert',
      frontmatter: { title: '界面搭档' },
      description: 'UI 专家：聚焦游戏 UI 视觉生产与交互落地。',
    })
    assert.deepEqual(result, { name: '界面搭档', source: 'title' })
  })

  it('picks the role phrase from the description', () => {
    const result = deriveExpertDisplayName({
      name: 'artbundle-expert',
      description: 'ArtBundle 专家：负责制品标准化打包、校验、验证与发布前门禁控制。',
      persona: { role: '美术制品打包与交付专家' },
    })
    assert.deepEqual(result, { name: 'ArtBundle 专家', source: 'description-role' })
  })

  it('falls back to persona role when the description has no role phrase', () => {
    const result = deriveExpertDisplayName({
      name: 'pipeline-runner',
      description: 'Runs the delivery pipeline end to end.',
      persona: { role: '交付流水线管家' },
    })
    assert.deepEqual(result, { name: '交付流水线管家', source: 'persona' })
  })

  it('strips language prefixes and parentheticals from the leading phrase', () => {
    const result = deriveExpertDisplayName({
      name: 'rdpi-config-assistant',
      description: '中文：RDPI 配置协作（Excel 优先）、基础/逻辑检查、RAGFlow/Mem 双轨与本地 sqlite。 English：Guides RDPI Excel-centric config.',
    })
    assert.deepEqual(result, { name: 'RDPI 配置协作', source: 'description' })
  })

  it('keeps the original name when nothing Chinese can be derived', () => {
    const result = deriveExpertDisplayName({
      name: 'th-bi-analytics-assistant',
      description: 'Mobile game ops analytics assistant with OKF knowledge bundle.',
    })
    assert.deepEqual(result, { name: 'th-bi-analytics-assistant', source: 'fallback' })
  })

  it('rejects overlong phrases instead of using them as a title', () => {
    const long = '这是一段非常冗长的中文描述内容需要超过二十个字符才能触发长度保护逻辑'
    const result = deriveExpertDisplayName({ name: 'verbose-expert', description: long })
    assert.equal(result.name, 'verbose-expert')
    assert.equal(result.source, 'fallback')
  })

  it('detects Chinese characters', () => {
    assert.equal(hasChineseText('ArtBundle 专家'), true)
    assert.equal(hasChineseText('artbundle-expert'), false)
  })
})
