export type ExpertAdaptiveIntentKind = 'discuss' | 'revise' | 'accept' | 'continue'

export interface ExpertAdaptiveIntent {
  kind: ExpertAdaptiveIntentKind
  confidence: 'high' | 'medium' | 'low'
  comment: string
}

/**
 * Expert collaboration is conversational: only high-signal review commands
 * bypass the model and update the task gate. Everything else remains dialogue.
 */
export function classifyExpertAdaptiveIntent(text: unknown, status: unknown): ExpertAdaptiveIntent {
  const value = String(text || '').trim()
  const normalizedStatus = String(status || '').trim().toLowerCase()
  if (!value) return { kind: 'discuss', confidence: 'low', comment: '' }
  if (/^(接受|确认接受|接受成果|可以了|没问题|通过|最终确认|就这样|ok|okay)$/i.test(value)
    && normalizedStatus === 'review') {
    return { kind: 'accept', confidence: 'high', comment: '' }
  }
  if (/(退回|打回|修改|改一下|重写|补充|调整|不对|需要完善|只改|不要改)/.test(value)
    && ['review', 'completed', 'revising'].includes(normalizedStatus)) {
    return { kind: 'revise', confidence: 'high', comment: value }
  }
  if (/^(继续|继续执行|开始吧|直接开始|按这个做)$/i.test(value)
    && ['draft', 'needs_input', 'revising'].includes(normalizedStatus)) {
    return { kind: 'continue', confidence: 'high', comment: value }
  }
  return { kind: 'discuss', confidence: 'low', comment: value }
}
