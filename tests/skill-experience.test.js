'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const { validateExperienceExtension, toDisplaySafeTask } = require('../src/lib/skill-experience')

const VALID_TASK = {
  id: 'relatedChats',
  title: '分析跟我相关的聊天',
  subtitle: '今天：私聊/群聊主题与 @我',
  icon: 'chat',
  group: 'knowledge-collab',
  modes: ['general'],
  surfaces: ['empty', 'quick-menu'],
  prompt: '请分析跟我相关的聊天。',
  preflight: {
    type: 'connector-auth',
    connector: 'feishu',
    message: '请先授权飞书。',
  },
  requiredTools: ['feishu.related_chats'],
  templateVars: { days: 1 },
}

describe('skill-experience', () => {
  it('accepts a valid experience task', () => {
    const result = validateExperienceExtension({ tasks: [VALID_TASK] }, { skillId: 'feishu-related-chats' })
    assert.equal(result.tasks.length, 1)
    assert.equal(result.issues.length, 0)
    assert.equal(result.tasks[0].id, 'relatedChats')
    assert.deepEqual(result.tasks[0].requiredTools, ['feishu.related_chats'])
  })

  it('isolates invalid tasks while keeping valid ones', () => {
    const result = validateExperienceExtension({
      tasks: [
        VALID_TASK,
        { id: 'bad id', title: 'x', modes: ['general'], surfaces: ['empty'], prompt: 'x' },
      ],
    })
    assert.equal(result.tasks.length, 1)
    assert.ok(result.issues.some((item) => item.path.includes('.id')))
  })

  it('rejects approval bypass and script expressions', () => {
    const bypass = validateExperienceExtension({
      tasks: [{ ...VALID_TASK, skipApproval: true }],
    })
    assert.equal(bypass.tasks.length, 0)
    assert.ok(bypass.issues.some((item) => item.code === 'unsafe_task_field'))

    const script = validateExperienceExtension({
      tasks: [{ ...VALID_TASK, prompt: 'run ${process.env.SECRET}' }],
    })
    assert.equal(script.tasks.length, 0)
    assert.ok(script.issues.some((item) => item.code === 'unsafe_task_field'))
  })

  it('rejects secret template vars and URLs', () => {
    const result = validateExperienceExtension({
      tasks: [{
        ...VALID_TASK,
        templateVars: { apiKey: 'abc', url: 'https://evil.example' },
      }],
    })
    assert.equal(result.tasks.length, 0)
    assert.ok(result.issues.some((item) => item.code === 'unsafe_task_field'))
  })

  it('enforces allowlists for modes, surfaces, icons and groups', () => {
    const result = validateExperienceExtension({
      tasks: [{
        ...VALID_TASK,
        modes: ['unknown'],
        surfaces: ['sidebar'],
        icon: 'rocket',
        group: 'unknown-group',
      }],
    })
    assert.equal(result.tasks.length, 0)
    assert.ok(result.issues.length >= 4)
  })

  it('toDisplaySafeTask omits unsafe extras', () => {
    const dto = toDisplaySafeTask(VALID_TASK, { skillId: 'feishu-related-chats', source: 'pack', ownerPackId: 'game-studio' })
    assert.equal(dto.skillId, 'feishu-related-chats')
    assert.equal(dto.source, 'pack')
    assert.equal(dto.ownerPackId, 'game-studio')
    assert.ok(!('dir' in dto))
    assert.ok(!('body' in dto))
  })
})
