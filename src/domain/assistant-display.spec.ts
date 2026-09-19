import { describe, expect, it } from 'vitest'
import { normalizeAssistantDisplay } from './assistant-display'

describe('assistant-display', () => {
  it('removes decorative emoji from generated prose and table cells', () => {
    const source = '✅ 结论\n\n- ⚠️ 待确认\n\n| 事项 | 状态 |\n| --- | --- |\n| ✅ 权限申请 | ⚠️ 待确认 |'
    expect(normalizeAssistantDisplay(source)).toBe('结论\n\n- 待确认\n\n| 事项 | 状态 |\n| --- | --- |\n| 权限申请 | 待确认 |')
  })

  it('keeps quoted source and fenced code unchanged', () => {
    const source = '> ✅ 原文\n\n```text\n✅ code marker\n```'
    expect(normalizeAssistantDisplay(source)).toBe(source)
  })

  it('removes an empty code fence left after a structured block is extracted', () => {
    expect(normalizeAssistantDisplay('说明\n\n```json\n\n```\n\n结论')).toBe('说明\n\n结论')
  })
})
