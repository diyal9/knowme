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

  it('keeps a new expert collaboration in planning mode and addresses the selected expert', async () => {
    const generate = vi.fn(async () => ({ text: '我先确认一个关键点：结果主要给谁使用？', streamed: true }))
    const startTask = vi.fn()
    mockApi({ aiGenerate: generate, expertTaskCreateStart: startTask })
    useAppStore.setState({
      expertRoom: {
        id: 'action-owner',
        expertId: 'action-owner',
        name: '行动推进专家',
        goal: '',
        log: [],
        messages: [{ id: 'intro', role: 'assistant', text: '先澄清需求。' }],
        skills: [],
        connectors: [],
        knowledgeRefs: [],
      },
      workbenchDialogue: { composer: '帮我把会议结论变成推进计划', attachments: [] },
      isGenerating: false,
    })

    useAppStore.getState().sendWorkbenchMessage()

    await waitFor(() => expect(generate).toHaveBeenCalled())
    expect(generate).toHaveBeenCalledWith(expect.objectContaining({
      expertId: 'action-owner',
      agentId: 'general',
      role: 'general',
      conversationMode: 'expert-planning',
      prompt: '帮我把会议结论变成推进计划',
    }))
    expect(startTask).not.toHaveBeenCalled()
  })

  it('uses a discussion-only lane for messages inside a formal expert task', async () => {
    const generate = vi.fn(async () => ({ text: '这份结果缺少两项工具证据，可以先补充连接器授权。', streamed: true }))
    mockApi({ aiGenerate: generate })
    useAppStore.setState({
      expertRoom: {
        id: 'task-1',
        taskId: 'task-1',
        expertId: 'external-capability-importer',
        name: '智能体运维专员',
        goal: '导入外部工作流',
        log: [],
        messages: [{ id: 'intro', role: 'assistant', text: '任务已结束。' }],
        skills: [],
        connectors: [],
        knowledgeRefs: [],
        discussionContext: {
          taskId: 'task-1',
          goal: '导入外部工作流',
          status: 'failed',
          resultSummary: '预检没有通过。',
          deliverables: [],
          recentEvents: [{ type: 'failed', summary: '缺少导入权限' }],
        },
      },
      workbenchDialogue: { composer: '为什么这次没有完成？', attachments: [] },
      isGenerating: false,
    })

    useAppStore.getState().sendWorkbenchMessage()

    await waitFor(() => expect(generate).toHaveBeenCalledWith(expect.objectContaining({
      expertId: 'external-capability-importer',
      agentId: 'general',
      role: 'general',
      conversationMode: 'expert-discussion',
      sessionId: expect.stringMatching(/discussion-v2$/),
      prompt: '为什么这次没有完成？',
      expertDiscussionContext: expect.objectContaining({
        taskId: 'task-1', goal: '导入外部工作流', resultSummary: '预检没有通过。',
      }),
    })))
  })

  it('answers an ambiguous formal-task follow-up locally with useful choices', () => {
    const generate = vi.fn(async () => ({ text: '不应调用' }))
    mockApi({ aiGenerate: generate })
    useAppStore.setState({
      expertRoom: {
        id: 'task-1', taskId: 'task-1', expertId: 'office-partner', name: '办公协作专家', goal: '整理会议',
        log: [], messages: [], skills: [], connectors: [], knowledgeRefs: [],
        discussionContext: {
          taskId: 'task-1', goal: '整理会议', status: 'review', resultSummary: '', recentEvents: [],
          deliverables: [{ id: 'd1', title: '同步稿', type: 'document', version: 1, acceptanceStatus: 'pending', excerpt: '正文' }],
        },
      },
      workbenchDialogue: { composer: '?', attachments: [] },
      isGenerating: false,
    })

    useAppStore.getState().sendWorkbenchMessage()

    expect(generate).not.toHaveBeenCalled()
    expect(useAppStore.getState().expertRoom?.messages.map((item) => item.text)).toEqual([
      '?',
      expect.stringContaining('查看成果内容'),
    ])
  })
})
