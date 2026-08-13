const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const {
  stripMineSuffix,
  workflowDisplayName,
  workflowSearchHaystack,
} = require('../src/lib/workflow-display-name')

describe('workflow-display-name', () => {
  it('maps known seed ids to outcome-oriented short names', () => {
    assert.equal(
      workflowDisplayName({ id: 'office-meeting-to-actions', name: '会议资料 → 纪要与待办' }),
      '会议纪要与待办',
    )
    assert.equal(
      workflowDisplayName({ id: 'engineering-delivery', name: '需求 → 实现 → 测试 → 交付' }),
      '研发交付',
    )
    assert.equal(
      workflowDisplayName({ id: 'visual-brief-to-export', name: 'Brief → 生成 → 审阅 → 导出' }),
      '视觉 Brief 出图',
    )
  })

  it('maps forked ids and parentRef without mutating stored name', () => {
    const item = {
      id: 'office-meeting-to-actions-ab12',
      name: '会议资料 → 纪要与待办（我的版本）',
      parentRef: { id: 'office-meeting-to-actions' },
    }
    assert.equal(workflowDisplayName(item), '会议纪要与待办')
    assert.equal(item.name, '会议资料 → 纪要与待办（我的版本）')
  })

  it('strips mine suffix and pipeline formula for unmapped names', () => {
    assert.equal(stripMineSuffix('自定义流程（我的版本）'), '自定义流程')
    assert.equal(
      workflowDisplayName({ id: 'custom-1', name: '素材 — 周报摘要（我的版本）' }),
      '周报摘要',
    )
  })

  it('keeps plain names unchanged', () => {
    assert.equal(
      workflowDisplayName({ id: 'my-collab', name: '我的智能体协作' }),
      '我的智能体协作',
    )
  })

  it('builds search haystack with internal and display names', () => {
    const hay = workflowSearchHaystack({
      id: 'office-meeting-to-actions',
      name: '会议资料 → 纪要与待办',
      description: '整理会议资料',
    })
    assert.match(hay, /会议资料/)
    assert.match(hay, /会议纪要与待办/)
    assert.match(hay, /office-meeting-to-actions/)
  })
})
