'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { EventEmitter } = require('node:events')
const { createCapabilityPackRuntime } = require('../src/lib/capability-pack-runtime')
const { executeRelatedChats } = require('../src/lib/connectors/feishu-cli/im')

const ROOT = path.join(__dirname, '../src')
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'catalog/catalog.json'), 'utf8'))
const pack = JSON.parse(fs.readFileSync(path.join(ROOT, 'packs/office-partner/pack.json'), 'utf8'))
const scenes = JSON.parse(fs.readFileSync(path.join(ROOT, 'packs/office-partner/scenes.json'), 'utf8'))
const OFFICE_SKILLS = [
  'office-collaboration-method',
  'meeting-evidence-method',
  'action-extraction',
  'writing-polish',
  'feishu-meeting-summary',
  'feishu-related-chats',
  'feishu-today-priority',
  'feishu-doc-kb',
]

test('daily office ships as partner-callable skills without a curated office expert', () => {
  assert.equal(catalog.entries.some(item => item.id === 'office-partner' && item.kind === 'expert'), false)
  assert.equal(fs.existsSync(path.join(ROOT, 'catalog/experts/office-partner/EXPERT.md')), false)
  assert.equal(pack.expert, undefined)
  assert.equal(pack.bundledCapabilities.expert, undefined)
  for (const id of OFFICE_SKILLS) {
    assert.ok(pack.skills.includes(id), `${id} remains in the default office skill pack`)
    assert.equal(catalog.entries.find(item => item.id === id)?.kind, 'skill', `${id} remains catalogued as a Skill`)
  }
})

test('office launch scenes select skills without switching the partner into an expert persona', () => {
  assert.equal(scenes.scenes.every(scene => !scene.expertId), true)
  assert.deepEqual(
    scenes.scenes.filter(scene => scene.showInEmptyState !== false).map(scene => scene.skillId),
    ['feishu-today-priority', 'feishu-doc-kb', 'feishu-meeting-summary', 'feishu-related-chats'],
  )
  assert.equal(Object.values(scenes.scenePrompts).some(prompt => /你是 KnowMe/.test(prompt)), false)
})

test('default office pack exposes skills without invoking the expert installer', () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-office-skills-'))
  const installedExperts = []
  const runtime = createCapabilityPackRuntime({
    userData,
    ensureExpertInstalled: id => {
      installedExperts.push(id)
      return { ok: true, expertId: id }
    },
  })
  assert.equal(runtime.ensureDefaultPacks().ok, true)
  assert.deepEqual(installedExperts, [])
  const sources = runtime.listSkillSources().sources
  for (const id of OFFICE_SKILLS) assert.ok(sources.some(source => source.id === id), id)
})

function chatSpawn({ failList = false, hasMore = false } = {}) {
  return (_bin, argv) => {
    const child = new EventEmitter()
    child.stdout = new EventEmitter()
    child.stderr = new EventEmitter()
    queueMicrotask(() => {
      const isList = argv.includes('+chat-list')
      const payload = argv.includes('auth') ? { identities: { user: { openId: 'ou_fixture', userName: 'Fixture' } } }
        : isList ? { items: [] }
          : { data: { messages: [{ message_id: 'om_fixture', body: { text: '请确认方案' } }], has_more: hasMore, page_token: 'repeat' } }
      if (isList && failList) child.stderr.emit('data', 'fixture: chat list unavailable')
      else child.stdout.emit('data', JSON.stringify(payload))
      child.emit('close', isList && failList ? 1 : 0)
    })
    return child
  }
}

test('related-chat Skill preserves mentions and reports a failed chat list', async () => {
  const result = await executeRelatedChats({}, { spawnImpl: chatSpawn({ failList: true }) })
  assert.equal(result.ok, true)
  assert.equal(result.meta.mentions.length, 1)
  assert.equal(result.meta.partial, true)
  assert.match(result.text, /会话列表读取失败/)
  assert.equal(result.meta.coverage.unreadCountsAvailable, false)
  assert.equal(result.meta.coverage.allMessageBodiesRead, false)
})

test('related-chat Skill reports incomplete pagination without claiming today-only coverage', async () => {
  const result = await executeRelatedChats({ days: 3 }, { spawnImpl: chatSpawn({ hasMore: true }) })
  assert.equal(result.meta.coverage.truncated, true)
  assert.match(result.text, /部分消息/)
  assert.match(result.text, /近期会话列表/)
  assert.doesNotMatch(result.text, /今日相关会话/)
})
