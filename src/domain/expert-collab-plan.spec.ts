import { describe, expect, it } from 'vitest'
import { extractExpertPlanSteps, formatExpertPlanMaterial } from './expert-collab-plan'

describe('expert collaboration plan', () => {
  it('extracts a bounded dynamic plan from the expert reply', () => {
    const steps = extractExpertPlanSteps([{
      role: 'assistant',
      text: '【协作计划】\n目标：整理会议\n执行步骤：\n1. 提取议题与结论\n2. 识别负责人和期限\n3. 生成可审阅的同步稿\n验收：内容完整',
    }])
    expect(steps).toEqual(['提取议题与结论', '识别负责人和期限', '生成可审阅的同步稿'])
    expect(formatExpertPlanMaterial(steps)).toContain('2. 识别负责人和期限')
  })

  it('does not mistake clarification choices for an execution plan', () => {
    expect(extractExpertPlanSteps([{
      role: 'assistant',
      text: '你更关注哪一项？\n1. 会议结论\n2. 行动项\n3. 风险',
    }])).toEqual([])
  })
})
