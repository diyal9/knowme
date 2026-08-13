'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')

const {
  PRESET_AVATARS,
  FALLBACK_PRESET_ID,
  identityAvatarSrc,
  identityAvatarKey,
  listPresetAvatars,
  identityIcon,
} = require('../src/lib/agent-identity')

const AVATAR_ROOT = path.join(__dirname, '..', 'src', 'assets', 'avatars')

describe('agent-identity preset avatars', () => {
  it('ships thirteen preset png files and catalog', () => {
    const catalog = JSON.parse(fs.readFileSync(path.join(AVATAR_ROOT, 'catalog.json'), 'utf8'))
    assert.equal(catalog.presets.length, 13)
    assert.equal(PRESET_AVATARS.length, 13)
    assert.equal(catalog.fallback, FALLBACK_PRESET_ID)
    for (const preset of catalog.presets) {
      const file = path.join(AVATAR_ROOT, preset.file)
      assert.ok(fs.existsSync(file), `missing ${preset.file}`)
    }
  })

  it('resolves explicit role keys and legacy short strings', () => {
    assert.equal(identityAvatarSrc({ avatar: 'office/writer' }), 'assets/avatars/office/writer.png')
    assert.equal(identityAvatarSrc({ avatar: 'writer' }), 'assets/avatars/office/writer.png')
    assert.equal(identityAvatarSrc({ avatar: 'office' }), 'assets/avatars/office/writer.png')
    assert.equal(identityAvatarSrc({ avatar: 'game' }), 'assets/avatars/game/producer.png')
    assert.equal(identityAvatarSrc({ avatar: 'game/qa' }), 'assets/avatars/game/qa.png')
    assert.equal(identityAvatarSrc({ avatar: 'game/client' }), 'assets/avatars/game/client.png')
    assert.equal(identityAvatarSrc({ avatar: 'game/server' }), 'assets/avatars/game/server.png')
    assert.equal(identityAvatarSrc({ avatar: 'game/planner' }), 'assets/avatars/game/planner.png')
    assert.equal(identityAvatarSrc({ avatar: 'game/ui' }), 'assets/avatars/game/ui.png')
    assert.equal(identityAvatarSrc({ avatar: 'game/vfx' }), 'assets/avatars/game/vfx.png')
  })

  it('prefers specific game roles over generic engineer/designer', () => {
    assert.equal(
      identityAvatarSrc({ name: '客户端工程师', description: 'Unity 客户端开发' }),
      'assets/avatars/game/client.png',
    )
    assert.equal(
      identityAvatarSrc({ name: '服务端工程师', description: '游戏服务端网关' }),
      'assets/avatars/game/server.png',
    )
    assert.equal(
      identityAvatarSrc({ name: '产品策划', description: '玩法与功能案' }),
      'assets/avatars/game/planner.png',
    )
    assert.equal(
      identityAvatarSrc({ name: 'UI 设计师', description: '界面与交互' }),
      'assets/avatars/game/ui.png',
    )
    assert.equal(
      identityAvatarSrc({ name: '特效师', description: '粒子与受击特效' }),
      'assets/avatars/game/vfx.png',
    )
  })

  it('falls back for unknown avatar without throwing', () => {
    assert.equal(identityAvatarSrc({ avatar: '🧩' }), 'assets/avatars/other/partner.png')
    assert.equal(identityAvatarSrc({}), 'assets/avatars/other/partner.png')
    assert.equal(identityIcon({ name: '写作教练', description: '办公润色' }), 'note')
  })

  it('matches curated expert semantics', () => {
    assert.equal(
      identityAvatarSrc({
        id: 'office-partner',
        name: '办公伙伴',
        description: '日常办公多能力专家，擅长写作润色',
        avatar: 'office/writer',
      }),
      'assets/avatars/office/writer.png',
    )
    assert.equal(
      identityAvatarSrc({
        id: 'game-studio-partner',
        name: '游戏工作室伙伴',
        description: '覆盖策划、研发、测试与制作推进',
        avatar: 'game/producer',
      }),
      'assets/avatars/game/producer.png',
    )
  })

  it('exposes avatar keys and picker list for create/edit UI', () => {
    assert.equal(identityAvatarKey({ name: '客户端工程师' }), 'game/client')
    assert.equal(listPresetAvatars().length, 13)
    assert.ok(listPresetAvatars().every(item => item.src && item.label && item.id))
  })

  it('uses skills and tags when matching avatars', () => {
    assert.equal(
      identityAvatarKey({
        name: '交付助手',
        skills: ['game-dev-delivery'],
        description: '跟进研发交付',
      }),
      'game/engineer',
    )
  })
})
