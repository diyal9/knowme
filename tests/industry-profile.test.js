'use strict'
const { currentPage, readPreload } = require('./helpers/current-src')

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const os = require('os')

const industry = require('../src/lib/industry-profile')
const roleCatalog = require('../src/shared/personal-role-catalog')
const productMemory = require('../src/lib/product-memory')
const promptRouter = require('../src/lib/assistant-prompt-router')
const settingsSecure = require('../src/lib/settings-secure')

describe('industry-profile', () => {
  it('normalizes unknown industry to general', () => {
    assert.equal(industry.normalizeIndustry('nope'), 'general')
    assert.equal(industry.normalizeIndustry(''), 'general')
    assert.equal(industry.normalizeIndustry('GAME'), 'game')
  })

  it('provides three goal examples per industry', () => {
    for (const item of industry.INDUSTRIES) {
      const examples = industry.getGoalExamples(item.id)
      assert.equal(examples.length, 3)
      assert.ok(examples.every(ex => String(ex).trim().length > 0))
    }
  })

  it('formats empty today-priority body with industry examples', () => {
    const gameBody = industry.formatEmptyTodayPriorityBody('game')
    assert.match(gameBody, /当前没有可用的飞书事实/)
    assert.match(gameBody, /仅作游戏场景占位/)
    assert.match(gameBody, /数值表|活动配置|版本风险/)
    assert.doesNotMatch(gameBody, /合同签署/)

    const generalBody = industry.formatEmptyTodayPriorityBody('general')
    assert.match(generalBody, /仅作通用办公场景占位/)
    assert.doesNotMatch(generalBody, /合同签署/)
  })

  it('provides linked base occupations and versioned defaults for every industry', () => {
    assert.deepEqual(
      roleCatalog.INDUSTRY_ROLE_CATALOG.map(item => item.id),
      industry.INDUSTRIES.map(item => item.id)
    )
    for (const item of roleCatalog.INDUSTRY_ROLE_CATALOG) {
      assert.ok(item.occupations.length >= 5, `${item.id} should have base occupations`)
      assert.ok(item.occupations.some(role => role.id === item.defaultOccupationId))
    }
    const softwareRoles = roleCatalog.getOccupations('software').map(item => item.id)
    for (const id of ['client-engineer', 'server-engineer', 'qa-engineer', 'product-manager', 'visual-designer', 'product-operations']) {
      assert.ok(softwareRoles.includes(id), `missing software occupation: ${id}`)
    }
    const defaults = roleCatalog.getOccupationDefaults('software', 'server-engineer')
    assert.equal(defaults.source, 'builtin')
    assert.match(defaults.version, /^builtin-/)
    assert.match(defaults.aboutMe, /服务端开发/)
    assert.match(defaults.collaborationPreference, /接口方案/)
    assert.equal(roleCatalog.normalizeOccupation('game', 'server-engineer'), 'game-designer')
  })
})

describe('industry settings + context injection', () => {
  it('persists and normalizes industry in settings-secure', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-industry-'))
    const file = path.join(dir, 'settings.json')
    try {
      settingsSecure.save(file, {
        apiEndpoint: 'https://example.com',
        apiKey: '',
        model: 'gpt-4o-mini',
        userPrompt: '',
        industry: 'game',
        occupationId: 'game-client',
        userProfile: '我负责客户端研发',
        userProfileConfigMode: 'custom',
      })
      const saved = settingsSecure.load(file)
      assert.equal(saved.industry, 'game')
      assert.equal(saved.occupationId, 'game-client')
      assert.equal(saved.userProfileConfigMode, 'custom')
      assert.match(saved.userProfileConfigVersion, /^builtin-/)

      fs.writeFileSync(file, JSON.stringify({ industry: 'game', occupationId: 'server-engineer' }), 'utf8')
      assert.equal(settingsSecure.load(file).occupationId, 'game-designer')
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it.skip('injects industry into context items and prompt assembly', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-industry-mem-'))
    try {
      productMemory.ensureMemory(dir)
      const items = productMemory.buildContextItems(dir, {
        userProfile: { industry: 'software' },
      })
      const industryItem = items.find(item => item.id === 'profile:industry')
      assert.ok(industryItem)
      assert.match(industryItem.text, /互联网\/软件/)

      const prompt = promptRouter.buildUserPrompt({ industry: 'software' }, 'general')
      assert.match(prompt, /【行业偏好】/)
      assert.match(prompt, /互联网\/软件/)
      assert.match(prompt, /占位示例/)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})
