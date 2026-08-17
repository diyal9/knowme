import { describe, expect, it } from 'vitest'
import { compactUserShortcutBubbleText } from './agent-shortcut-display'
import { ASSISTANT_QUICK_COMMANDS } from './agent-quick-commands'
import { classifyFeishuIntent, buildFeishuClarificationPrompt, maybeAugmentFeishuPrompt } from './agent-feishu-prompt'

describe('agent-shortcut-display', () => {
  it('compresses meeting summary leaked prompt to a short title', () => {
    const prompt = ASSISTANT_QUICK_COMMANDS.find((item) => item.id === 'meetingSummary')!.prompt
    expect(compactUserShortcutBubbleText(prompt)).toBe('会议总结')
  })

  it('leaves ordinary chat text unchanged', () => {
    expect(compactUserShortcutBubbleText('你好，帮我看看这段话')).toBe('你好，帮我看看这段话')
  })
})

describe('agent-feishu-prompt', () => {
  it('classifies meeting tools as calendar intent', () => {
    expect(classifyFeishuIntent('请调用 feishu.meeting_read 总结会议')).toEqual({ mentions: true, kind: 'calendar' })
  })

  it('rewrites prompt when feishu is not authorized', () => {
    const next = buildFeishuClarificationPrompt('帮我看飞书文档', { enabled: false })
    expect(next).toContain('设置 → 连接器')
    expect(next).toContain('帮我看飞书文档')
  })

  it('keeps original prompt when connector is ready', async () => {
    const prompt = '请调用 feishu.meeting_read 总结会议'
    const next = await maybeAugmentFeishuPrompt(prompt, async () => ({
      enabled: true,
      status: { userReady: true },
    }))
    expect(next).toBe(prompt)
  })
})
