import { describe, expect, it } from 'vitest'
import { buildRecoveryView, classifyRecovery, redactPreviewFields } from './agent-recovery-actions'

describe('agent-recovery-actions', () => {
  it('maps waiting and failure kinds', () => {
    expect(classifyRecovery({ recommendedAction: 'provide_input' })).toBe('waiting_input')
    expect(classifyRecovery({ code: 'timeout' })).toBe('timeout')
    expect(buildRecoveryView({ code: 'timeout' }).alternatives.map((a) => a.id)).toContain('degrade_local')
  })

  it('redacts secrets', () => {
    const out = redactPreviewFields({ apiKey: 'sk-live', nested: { password: 'x' }, ok: true }) as Record<string, unknown>
    expect(out.apiKey).toBe('[REDACTED]')
    expect((out.nested as Record<string, unknown>).password).toBe('[REDACTED]')
    expect(out.ok).toBe(true)
  })
})
