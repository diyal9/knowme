const fs = require('fs')
const os = require('os')
const path = require('path')
const { describe, it, before } = require('node:test')
const assert = require('node:assert')
const gameStudio = require('../src/lib/game-studio-scenes')
const { createCapabilityPackRuntime } = require('../src/lib/capability-pack-runtime')

describe('game studio scenes', () => {
  before(() => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-game-scenes-'))
    const rt = createCapabilityPackRuntime({ userData: tmpDir })
    rt.installPack('game-studio', 'bundled')
    rt.installPack('office-partner', 'bundled')
    gameStudio.setPackRuntimeForTests(rt)
  })

  it('returns null for non-game industry', () => {
    assert.equal(gameStudio.resolveGameScene({ industry: 'software', mode: 'writing' }), null)
  })

  it('maps legacy writing mode to game-design', () => {
    assert.equal(
      gameStudio.resolveGameScene({ industry: 'game', mode: 'writing' }),
      'game-design',
    )
  })

  it('classifies dev prompts to game-dev', () => {
    assert.equal(
      gameStudio.resolveGameScene({ industry: 'game', mode: 'general', prompt: '启动 daemon 工作流开发客户端' }),
      'game-dev',
    )
  })

  it('lists connector empty-state scenes on office-partner when both packs enabled', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-scenes-both-'))
    const rt = createCapabilityPackRuntime({ userData: tmpDir })
    rt.installPack('game-studio', 'bundled')
    rt.installPack('office-partner', 'bundled')
    gameStudio.setPackRuntimeForTests(rt)

    const scenes = rt.listScenesForUi()
    assert.ok(scenes.some(s => s.id === 'feishu-docs' && s.packId === 'office-partner'))
    assert.ok(!scenes.some(s => s.id === 'workflow-intake'))
    assert.ok(!scenes.some(s => s.id === 'game-design'))
    assert.ok(!scenes.some(s => s.id === 'game-knowledge'))
  })

  it('game-knowledge scene binds knowledge-steward skill', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-knowledge-scene-'))
    const rt = createCapabilityPackRuntime({ userData: tmpDir })
    rt.installPack('game-studio', 'bundled')
    gameStudio.setPackRuntimeForTests(rt)
    const scene = gameStudio.getScene('game-knowledge')
    assert.equal(scene.skillId, 'knowledge-steward')
  })

  it('empty state groups come from office-partner with today priority first', () => {
    const rt = createCapabilityPackRuntime({ userData: fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-empty-')) })
    rt.installPack('office-partner', 'bundled')
    const emptyGroups = rt.listEmptyStateGroups()
    assert.ok(emptyGroups.length >= 1)
    const group = emptyGroups.find(g => g.packId === 'office-partner')
    assert.ok(group)
    assert.match(group.sub, /今日优先级|飞书/)
    const ids = group.scenes.map(s => s.id)
    assert.equal(ids[0], 'feishu-today-priority')
    assert.ok(ids.includes('feishu-docs'))
  })

  it('workflow intake scene binds requirement skill and default workflow', () => {
    const rt = createCapabilityPackRuntime({ userData: fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-intake-')) })
    rt.installPack('game-studio', 'bundled')
    assert.equal(rt.getPackWorkflow('game-studio', 'workflow-intake'), 'game-dev-delivery')
    const intake = gameStudio.getScene('workflow-intake')
    assert.ok(intake)
    assert.equal(intake.skillId, 'game-requirement-doc')
    const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/packs/game-studio/scenes.json'), 'utf8'))
    const rawIntake = raw.scenes.find(s => s.id === 'workflow-intake')
    assert.ok(rawIntake)
    assert.equal(rawIntake.showInEmptyState, false)
    assert.match(rawIntake.emptyPrompt, /intake/)
  })

  it('builds scene prompt with skill hint', () => {
    const prompt = gameStudio.buildScenePrompt('game-design')
    assert.match(prompt, /策划需求/)
    assert.match(prompt, /game-requirement-doc/)
  })
})
