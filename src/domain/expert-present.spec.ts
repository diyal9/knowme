import { describe, expect, it } from 'vitest'
import { collapseExpertDocumentLabels, collapseExpertDocumentOutputs, expertDeliverableDisplayTitle, resolveExpertOutputType } from './expert-present'

describe('expert document presentation', () => {
  it('keeps the PRD as the only primary document when acceptance output is a companion section', () => {
    expect(collapseExpertDocumentOutputs([
      { id: 'primary', label: '产品需求文档' },
      { id: 'acceptance', label: '验收标准与范围边界', mergeInto: 'primary' },
    ])).toEqual([{ id: 'primary', label: '产品需求文档' }])
  })

  it('does not collapse unrelated independent outputs', () => {
    const outputs = [{ id: 'prd', label: '产品需求文档' }, { id: 'report', label: '风险评估报告' }]
    expect(collapseExpertDocumentOutputs(outputs)).toEqual(outputs)
  })

  it('uses intuitive display names for office-partner outputs without changing their contract names', () => {
    expect(expertDeliverableDisplayTitle('可直接审阅的同步稿')).toBe('今日待办与消息汇总')
    expect(expertDeliverableDisplayTitle('发送前检查清单')).toBe('发送前消息检查清单')
    expect(expertDeliverableDisplayTitle('风险评估报告')).toBe('风险评估报告')
  })

  it('uses the declared output type and promotes any conversational answer when a file is requested', () => {
    expect(resolveExpertOutputType('answer', '帮我查看今天有哪些消息和待办')).toBe('answer')
    expect(resolveExpertOutputType('answer', '请导出成飞书文档')).toBe('document')
    expect(resolveExpertOutputType('answer', '帮我策划百炼商业化活动', '产品需求文档')).toBe('document')
    expect(resolveExpertOutputType('image', '请生成图标')).toBe('image')
  })
})
