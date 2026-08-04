const { describe, it } = require('node:test')
const assert = require('node:assert')
const gameStudio = require('../src/lib/game-studio-scenes')

describe('game studio scenes', () => {
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

  it('lists UI scenes without knowledge admin', () => {
    const scenes = gameStudio.listScenesForUi()
    assert.ok(scenes.some(s => s.id === 'game-design'))
    assert.ok(!scenes.some(s => s.id === 'game-knowledge'))
  })

  it('builds scene prompt with skill hint', () => {
    const prompt = gameStudio.buildScenePrompt('game-design')
    assert.match(prompt, /策划需求/)
    assert.match(prompt, /game-requirement-doc/)
  })
})
