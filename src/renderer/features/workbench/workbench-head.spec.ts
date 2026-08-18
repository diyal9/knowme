import { describe, expect, it } from 'vitest'
import { resolveWorkbenchTabMode } from './workbench-head'

describe('resolveWorkbenchTabMode', () => {
  it('maps expert collab / workflow / daemon to their tabs', () => {
    expect(resolveWorkbenchTabMode('taskhome', 'daemon')).toBe('tasks')
    expect(resolveWorkbenchTabMode('shelf', 'daemon')).toBe('workflows')
    expect(resolveWorkbenchTabMode('manage', 'daemon')).toBe('daemon')
    expect(resolveWorkbenchTabMode('manage', 'workflows')).toBe('workflows')
  })

  it('does not treat the automation panel as 专家协作', () => {
    expect(resolveWorkbenchTabMode('manage', 'automation')).toBe('')
  })
})
