'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
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
    assert.equal(feishu.category, '日常办公')
    assert.ok(feishu.categories.includes('日常办公'))
    assert.ok(feishu.categories.includes('能力包'))

    const office = mapPackSkillToHub({ id: 'office-document', name: '办公文档', ownerPackId: 'game-studio' })
    assert.equal(office.category, '内容写作')

    const game = mapPackSkillToHub({ id: 'game-qa-acceptance', name: '游戏测试验收', ownerPackId: 'game-studio' })
    assert.equal(game.category, '软件研发')
  })

  it('normalizes curated 开发 to 研发 and keeps code-review under 研发', () => {
    const review = catalog.entries.find((e) => e.id === 'code-review')
    assert.ok(review)
    assert.deepEqual(review.categories, ['软件研发'])

    const hub = mapCatalogItemToHub({ ...review, categories: ['开发'] })
    assert.equal(hub.category, '软件研发')
    assert.deepEqual(hub.categories, ['软件研发'])
  })

  it('projects imported qualification facts without conflating install state with readiness', () => {
    const hub = mapCatalogItemToHub({
      id: 'limited-expert',
      kind: 'expert',
      name: '待修复专家',
      installed: true,
      enabled: true,
      manifest: {
        metadata: {
          knowme: {
            qualification: {
              state: 'limited',
              issues: ['undeclared_connector_contract'],
              limitedSkills: ['image-generation'],
              assessedAtImport: true,
            },
          },
        },
      },
    })

    assert.equal(hub.status, 'enabled')
    assert.deepEqual(hub.qualification, {
      state: 'limited',
      issues: ['undeclared_connector_contract'],
      limitedSkills: ['image-generation'],
      assessedAtImport: true,
    })
  })

  it('projects expert lifecycle without changing install or readiness state', () => {
    const hub = mapCatalogItemToHub({
      id: 'old-expert', kind: 'expert', name: '旧专家', installed: true, enabled: true,
      lifecycle: { state: 'legacy', newTasks: false, successors: [{ kind: 'expert', id: 'new-expert' }] },
    })
    assert.equal(hub.status, 'enabled')
    assert.deepEqual(hub.lifecycle, {
      state: 'legacy', newTasks: false, successors: [{ kind: 'expert', id: 'new-expert' }],
    })
  })
})

describe('generic skill script arguments', () => {
  const { createCapabilityRuntime, serializeSkillScriptArgs } = require('../src/lib/capability-hub/runtime')

  it('preserves explicit argv and maps named values to predictable CLI flags', () => {
    assert.deepEqual(serializeSkillScriptArgs({ argv: ['--input', 'a b', 2] }), {
      ok: true,
      argv: ['--input', 'a b', '2'],
    })
    assert.deepEqual(serializeSkillScriptArgs({ outputPath: 'result.json', verbose: true, tags: ['a', 'b'] }), {
      ok: true,
      argv: ['--output-path', 'result.json', '--verbose', '--tags', 'a', '--tags', 'b'],
    })
  })

  it('rejects ambiguous or unsafe argument shapes before execution', () => {
    assert.equal(serializeSkillScriptArgs({ argv: 'nope' }).code, 'invalid_args')
    assert.equal(serializeSkillScriptArgs({ 'bad key': 'x' }).code, 'invalid_args')
  })

  it('forwards exact argv through the capability runtime to the package script', async t => {
    const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'km-capability-script-'))
    t.after(() => fs.rmSync(userData, { recursive: true, force: true }))
    const scriptsRoot = path.join(userData, 'scripts')
    const scriptAbs = path.join(scriptsRoot, 'echo-args.mjs')
    fs.mkdirSync(scriptsRoot, { recursive: true })
    fs.writeFileSync(scriptAbs, 'console.log(JSON.stringify(process.argv.slice(2)))\n', 'utf8')
    const runtime = createCapabilityRuntime({
      getUserData: () => userData,
      getKnowledgeDir: () => path.join(userData, 'knowledge'),
      store: { loadInstallStore: () => ({ entries: {} }) },
      unifiedConnectors: { loadConnectors: () => [] },
      getPackEmptyStateGroups: () => [],
      getPackScenesForUi: () => [],
    })

    const result = await runtime.runSkillScriptInSandbox({
      scriptsRoot,
      scriptAbs,
      args: { argv: ['--out', 'folder with spaces', '&literal'] },
    })
    assert.equal(result.ok, true)
    assert.match(result.text, /\["--out","folder with spaces","&literal"\]/)
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
