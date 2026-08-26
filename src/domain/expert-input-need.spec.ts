import { describe, expect, it } from 'vitest'
import { describeExpertInputNeed } from './expert-input-need'

describe('describeExpertInputNeed', () => {
  it('treats a missing required read as an execution block, not missing user information', () => {
    expect(describeExpertInputNeed('缺少必需读取：公开网络搜索')).toMatchObject({
      kind: 'execution',
      title: '需要完成一次读取',
      item: '公开网络搜索',
      detail: '不需要补充资料。专家还没有完成「公开网络搜索」。',
    })
  })

  it('reroutes public search when an internal meeting task was classified incorrectly', () => {
    expect(describeExpertInputNeed('缺少必需读取：公开网络搜索', '分析我上周五的会议')).toMatchObject({
      kind: 'reroute',
      title: '执行路径需要调整',
      item: '公开网络搜索',
      alternative: '飞书会议内容',
      detail: '这项任务应读取你的飞书会议，不需要公开网络搜索。',
    })
  })

  it('hides internal grounding codes from the user', () => {
    const need = describeExpertInputNeed('missing_required_evidence: requiredEvidence')
    expect(need.kind).toBe('execution')
    expect(need.detail).not.toMatch(/requiredEvidence|missing_required_evidence/)
  })

  it('keeps a concrete material request as user input', () => {
    expect(describeExpertInputNeed('请补充需要分析的会议时间范围')).toMatchObject({
      kind: 'information',
      title: '还需要一项信息',
      item: '需要分析的会议时间范围',
    })
  })

  it('routes an unavailable connector to capability setup', () => {
    expect(describeExpertInputNeed('未授权连接器：飞书妙记')).toMatchObject({
      kind: 'capability',
      title: '需要启用能力',
      item: '飞书妙记',
    })
  })
})
