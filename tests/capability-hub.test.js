'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const { currentPage } = require('./helpers/current-src')

const src = path.join(__dirname, '..', 'src')
const html = currentPage('capability-hub.html')

describe('capability hub renderer contract', () => {
  it('experts library surface has search and type tabs', () => {
assert.match(html, /能力中心/)
    assert.match(html, /搜索能力/)
    assert.match(html, /id: 'expert'/)
    assert.match(html, /id: 'skill'/)
    assert.match(html, /id: 'connector'/)
  })
})

describe('skill hub domain categories', () => {
  const {
    mapPackSkillToHub,
    mapCatalogItemToHub,
  } = require('../src/lib/capability-hub-service')
  const catalog = JSON.parse(fs.readFileSync(path.join(src, 'catalog', 'catalog.json'), 'utf8'))

  it('maps pack skills to work-domain primary categories', () => {
    const feishu = mapPackSkillToHub({ id: 'feishu-today-priority', name: '飞书今日优先级', ownerPackId: 'game-studio' })
    assert.equal(feishu.category, '办公')
    assert.ok(feishu.categories.includes('办公'))
    assert.ok(feishu.categories.includes('能力包'))

    const office = mapPackSkillToHub({ id: 'office-document', name: '办公文档', ownerPackId: 'game-studio' })
    assert.equal(office.category, '写作')

    const game = mapPackSkillToHub({ id: 'game-qa-acceptance', name: '游戏测试验收', ownerPackId: 'game-studio' })
    assert.equal(game.category, '游戏')
  })

  it('normalizes curated 开发 to 研发 and keeps code-review under 研发', () => {
    const review = catalog.entries.find((e) => e.id === 'code-review')
    assert.ok(review)
    assert.deepEqual(review.categories, ['研发'])

    const hub = mapCatalogItemToHub({ ...review, categories: ['开发'] })
    assert.equal(hub.category, '研发')
    assert.deepEqual(hub.categories, ['研发'])
  })
})

describe('capability hub icons and favorites store', () => {
  const { resolveCapabilityIcon } = require('../src/lib/capability-hub-icons')
  const {
    toggleFavorite,
    listFavoriteKeys,
    favoriteKey,
  } = require('../src/lib/capability-store')
  const os = require('os')

  it('maps skill domains to representative icons', () => {
    assert.equal(resolveCapabilityIcon({ kind: 'skill', category: '写作' }).icon, 'pencilLine')
    assert.equal(resolveCapabilityIcon({ kind: 'skill', category: '游戏' }).icon, 'gamepad')
    assert.equal(resolveCapabilityIcon({ kind: 'skill', category: '研发' }).icon, 'code')
    assert.equal(resolveCapabilityIcon({ kind: 'skill', category: '办公' }).icon, 'clipboardCheck')
  })

  it('persists favorite toggles under capabilities/favorites.json', () => {
    const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'km-fav-'))
    const first = toggleFavorite(userData, 'skill', 'writing-polish')
    assert.equal(first.ok, true)
    assert.equal(first.favorite, true)
    assert.ok(listFavoriteKeys(userData).includes(favoriteKey('skill', 'writing-polish')))
    const second = toggleFavorite(userData, 'skill', 'writing-polish')
    assert.equal(second.favorite, false)
    assert.ok(!listFavoriteKeys(userData).includes(favoriteKey('skill', 'writing-polish')))
  })
})
