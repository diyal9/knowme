import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import { useAppStore } from '../../app/store'
import { makeRunState, mockApi, resetAppStore } from '../../test/helpers'

describe('workbench dialogue send', () => {
  beforeEach(() => {
    resetAppStore()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not call aiGenerate from a pipeline task room', async () => {
    const generate = vi.fn(async () => ({ text: 'should-not-run' }))
    const clarify = vi.fn(async () => ({ ok: true }))
    mockApi({ aiGenerate: generate, workbenchDaemonClarify: clarify })
    useAppStore.setState({
      expertRoom: null,
      run: makeRunState({
        phase: 'running',
        lane: 'pipeline',
        slug: 'task-1',
        clarifyNode: 'n-q1',
        dialogueMessages: [],
      }),
      workbenchDialogue: { composer: '补充材料已放仓库', attachments: [] },
      isGenerating: false,
    })
    useAppStore.getState().sendWorkbenchMessage()
    await waitFor(() => expect(clarify).toHaveBeenCalledWith('task-1', {
      node: 'n-q1',
      answer: '补充材料已放仓库',
    }))
    expect(generate).not.toHaveBeenCalled()
    const messages = useAppStore.getState().run?.dialogueMessages || []
    expect(messages.some((item) => item.role === 'user' && item.text.includes('补充材料'))).toBe(true)
    expect(messages.some((item) => item.role === 'assistant' && item.text.includes('补充信息'))).toBe(true)
  })

  it('acks running pipeline text without hitting the LLM', async () => {
    const generate = vi.fn(async () => ({ text: 'no' }))
    const gate = vi.fn(async () => ({ ok: true }))
    mockApi({ aiGenerate: generate, workbenchDaemonGate: gate })
    useAppStore.setState({
      expertRoom: null,
      run: makeRunState({ phase: 'running', lane: 'pipeline', slug: 'task-1', dialogueMessages: [] }),
      workbenchDialogue: { composer: '?', attachments: [] },
      isGenerating: false,
    })
    useAppStore.getState().sendWorkbenchMessage()
    await waitFor(() => {
      const messages = useAppStore.getState().run?.dialogueMessages || []
      expect(messages.some((item) => item.text.includes('已记下'))).toBe(true)
    })
    expect(generate).not.toHaveBeenCalled()
    expect(gate).not.toHaveBeenCalled()
  })
})
