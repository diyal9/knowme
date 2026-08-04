const { describe, it } = require('node:test')
const assert = require('node:assert')
const {
  buildGrounding,
  deriveTitle,
  roleGuidance,
  userStatusLabel,
} = require('../src/lib/conversation-grounding')

describe('conversation grounding', () => {
  it('keeps small talk lightweight', () => {
    const result = buildGrounding({ prompt: '你好' })
    assert.equal(result.active, false)
    assert.equal(result.text, '')
  })

  it('extracts a conservative work brief', () => {
    const result = buildGrounding({
      prompt: '请把下面会议记录整理成纪要，保留结论和待办',
      context: '会议记录正文',
    })
    assert.equal(result.active, true)
    assert.match(result.text, /目标：/)
    assert.match(result.text, /材料：当前打开的文件或附加材料/)
    assert.match(result.text, /约束：/)
    assert.equal(result.title, '整理会议纪要')
    assert.ok(result.labels.includes('整理'))
  })

  it('uses task facts without inventing missing participants', () => {
    const result = buildGrounding({
      prompt: '推进当前任务',
      task: { name: '上线准备', factualBrief: '状态：进行中' },
    })
    assert.match(result.text, /目标：上线准备/)
    assert.match(result.text, /任务进展：状态：进行中/)
    assert.doesNotMatch(result.text, /财务|法务|运营/)
  })

  it('uses displayPrompt for visible goal instead of long shortcut instructions', () => {
    const longPrompt = '请为我做会议总结：总结最近三天与我相关的会议。第一阶段仅展示候选会议列表：每场会议显示标题、时间和一张可打开的飞书妙记卡片，不展示原始 minute_token/url，不要直接读取正文、不要直接总结；若首轮为 0 条先自动放宽关键词再检索一轮。第二阶段等我选择具体会议后，再调用 feishu.meeting_read 读取并输出会议总结。'
    const result = buildGrounding({
      prompt: longPrompt,
      displayPrompt: '为我总结最近三天的会议',
    })
    assert.equal(result.active, true)
    assert.equal(result.goal, '为我总结最近三天的会议')
    assert.match(result.text, /^目标：为我总结最近三天的会议$/m)
    assert.doesNotMatch(result.text, /minute_token|feishu\.meeting_read|第一阶段/)
    assert.ok(result.goal.length <= 80)
  })

  it('provides human labels and role guidance', () => {
    assert.equal(deriveTitle('请改写这段说明'), '改写与润色内容')
    assert.equal(deriveTitle('请帮我写一份需求文档，包含验收标准'), '起草需求文档')
    assert.match(roleGuidance('coding'), /影响范围/)
    assert.match(roleGuidance('writing'), /AI 套话/)
    assert.equal(userStatusLabel('正在检索知识库'), '正在查找相关资料')
    assert.equal(userStatusLabel('知识检索完成', 'done'), '资料查找完成')
    assert.equal(userStatusLabel('候选文档已整理', 'done'), '候选文档已整理')
    assert.equal(userStatusLabel('已完成', 'done'), '执行完成')
  })
})
