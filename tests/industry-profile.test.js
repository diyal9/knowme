'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const os = require('os')

const industry = require('../src/lib/industry-profile')
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
      })
      assert.equal(settingsSecure.load(file).industry, 'game')

      fs.writeFileSync(file, JSON.stringify({ industry: 'invalid-vertical' }), 'utf8')
      assert.equal(settingsSecure.load(file).industry, 'general')
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('injects industry into context items and prompt assembly', () => {
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

describe('settings / workspace industry wiring', () => {
  const settingsHtml = fs.readFileSync(path.join(__dirname, '..', 'src', 'settings.html'), 'utf8')
  const workspaceHtml = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace.html'), 'utf8')
  const agent = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace-agent.js'), 'utf8')

  it('exposes industry select in personal memory settings', () => {
    assert.ok(settingsHtml.includes('id="userIndustry"'))
    assert.ok(settingsHtml.includes('value="game"'))
    assert.ok(settingsHtml.includes('industry: $(\'userIndustry\')'))
    assert.ok(settingsHtml.includes('id="userBriefIndustry"'))
  })

  it('loads industry-profile in workspace and uses empty-state helper', () => {
    assert.ok(workspaceHtml.includes('lib/industry-profile.js'))
    assert.ok(agent.includes('emptyTodayPriorityBody()'))
    assert.ok(agent.includes('IndustryProfile.formatEmptyTodayPriorityBody'))
    assert.ok(agent.includes('允许给出最多 3 条**行业占位示例**'))
    assert.ok(agent.includes('禁止把示例写成推荐任务'))
    assert.ok(agent.includes('const bar = emptyTodayPriority ? null : parsed.bar'))
  })
})
