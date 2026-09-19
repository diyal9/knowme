import { describe, expect, it } from 'vitest'
import { classifyExpertTaskComplexity, minimumPlanStepsFor } from './expert-task-complexity'

describe('expert task planning complexity', () => {
  it('routes ordinary explanation to simple planning', () => {
    expect(classifyExpertTaskComplexity({ goal: '解释这段文字' })).toBe('simple')
    expect(minimumPlanStepsFor('simple')).toBe(1)
  })
  it('routes a side effect to at least a single-step plan', () => {
    expect(classifyExpertTaskComplexity({ goal: '把结果写入文件', requiredTools: ['write_file'] })).toBe('multi_step')
  })
  it('requires depth for multiple outputs or dependencies', () => {
    expect(classifyExpertTaskComplexity({ goal: '制作网站并发布', deliverables: ['页面', '发布说明'] })).toBe('multi_step')
    expect(minimumPlanStepsFor('multi_step')).toBe(2)
  })
})
