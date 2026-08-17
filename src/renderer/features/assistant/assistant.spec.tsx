import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from '../../app/AppShell'
import { useAppStore } from '../../app/store'
import { mockApi, resetAppStore } from '../../test/helpers'

describe('assistant chat', () => {
  beforeEach(() => {
    mockApi()
    resetAppStore()
  })
  afterEach(() => cleanup())

  it('allows sending without an open editor file', async () => {
    render(<AppShell />)
    fireEvent.change(screen.getByPlaceholderText(/给 KnowMe 发送消息/), { target: { value: '你好' } })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))
    expect(screen.getByText('你好')).toBeInTheDocument()
    expect(screen.getByTestId('agent-execution-timeline')).toHaveTextContent('正在整理相关内容')
    await waitFor(() => {
      expect(screen.getByText('你好，我是知我。需要我帮你做什么？')).toBeInTheDocument()
    })
    expect(screen.queryByText('未能收到完整答复，请重试。')).not.toBeInTheDocument()
  })

  it('applies late v2 answer.committed after invoke returns', async () => {
    let emit: ((event: Record<string, unknown>) => void) | undefined
    mockApi({
      onAiStreamEvent: (cb) => {
        emit = cb
        return () => undefined
      },
      aiGenerate: async () => {
        await new Promise((r) => setTimeout(r, 5))
        setTimeout(() => {
          emit?.({
            version: '2',
            seq: '1',
            type: 'answer.committed',
            payload: { text: '迟到的完整答复', hash: 'h-late' },
          })
        }, 0)
        return {}
      },
    })
    render(<AppShell />)
    fireEvent.change(screen.getByPlaceholderText(/给 KnowMe 发送消息/), { target: { value: '你好' } })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))
    await waitFor(() => {
      expect(screen.getByText('迟到的完整答复')).toBeInTheDocument()
    })
  })

  it('hides follow-up chips when the reply is incomplete', async () => {
    mockApi({ aiGenerate: async () => ({}) })
    render(<AppShell />)
    fireEvent.change(screen.getByPlaceholderText(/给 KnowMe 发送消息/), { target: { value: '你好' } })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))
    await waitFor(() => {
      expect(screen.getByText('未能收到完整答复，请重试。')).toBeInTheDocument()
    })
    expect(screen.queryByText('继续追问细节')).not.toBeInTheDocument()
  })

  it('isolates messages when switching session tabs', async () => {
    render(<AppShell />)
    fireEvent.change(screen.getByPlaceholderText(/给 KnowMe 发送消息/), { target: { value: '会话一' } })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))
    await waitFor(() => expect(screen.getByText('会话一')).toBeInTheDocument())
    await waitFor(() => expect(screen.getByText('你好，我是知我。需要我帮你做什么？')).toBeInTheDocument())

    fireEvent.click(screen.getByLabelText('更多'))
    fireEvent.click(screen.getByTestId('agent-new-chat-btn'))
    const tabs = screen.getAllByRole('tab')
    expect(tabs.length).toBeGreaterThan(1)
    expect(screen.queryByText('会话一')).not.toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('tab')[0])
    await waitFor(() => expect(screen.getByText('会话一')).toBeInTheDocument())
  })

  it('appends assistant text from fake stream chunks', async () => {
    mockApi({
      onAiStreamChunk: (cb) => {
        queueMicrotask(() => cb({ text: '流式片段' }))
        return () => undefined
      },
      aiGenerate: async () => {
        await new Promise((r) => setTimeout(r, 5))
        return { text: '流式片段', streamed: true }
      },
    })
    render(<AppShell />)
    fireEvent.change(screen.getByPlaceholderText(/给 KnowMe 发送消息/), { target: { value: '测流式' } })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))
    await waitFor(() => {
      expect(screen.getByText(/流式片段/)).toBeInTheDocument()
    })
  })

  it('shows @ file menu when typing @ in composer', async () => {
    mockApi({
      sourcesList: async () => ({
        sources: [{ id: 's1', type: 'local', displayName: 'demo' }],
        activeSourceId: 's1',
      }),
      sourcesTree: async () => ({
        ok: true,
        nodes: [{ type: 'file', name: 'README.md', path: 'README.md', depth: 0 }],
      }),
    })
    render(<AppShell />)
    await waitFor(() => expect(window.api?.sourcesTree).toBeDefined())
    fireEvent.change(screen.getByPlaceholderText(/给 KnowMe 发送消息/), { target: { value: '@rea' } })
    await waitFor(() => {
      expect(screen.getByTestId('agent-at-menu')).toBeInTheDocument()
      expect(screen.getByTestId('agent-at-item')).toHaveTextContent('README.md')
    })
  })

  it('restores persisted sessions from agentSessionList/get', async () => {
    mockApi({
      agentSessionList: async () => ({
        sessions: [{ id: 'p1', title: '持久会话' }],
        ui: { openSessionIds: ['p1'], activeSessionId: 'p1' },
      }),
      agentSessionGet: async () => ({
        ok: true,
        session: { id: 'p1', messages: [{ id: 'u1', role: 'user', text: '昨日内容' }] },
      }),
    })
    render(<AppShell />)
    await waitFor(() => expect(screen.getByRole('tab', { name: '持久会话' })).toBeInTheDocument())
    await waitFor(() => expect(screen.getByText('昨日内容')).toBeInTheDocument())
  })

  it('dedupes repeated tabs and hides workbench sessions on assistant surface', async () => {
    mockApi({
      agentSessionList: async () => ({
        sessions: [
          { id: 'a1', title: '日常协作' },
          { id: 'w1', title: '工作台 - Daemon', taskRef: { id: 'task-1', kind: 'workflow-chat' } },
          { id: 'g1', title: '三元礼包' },
        ],
        ui: { openSessionIds: ['g1', 'g1', 'g1', 'w1', 'a1'], activeSessionId: 'g1' },
      }),
    })
    render(<AppShell />)
    await waitFor(() => {
      const tabs = screen.getAllByRole('tab')
      expect(tabs).toHaveLength(2)
      expect(screen.getByRole('tab', { name: '三元礼包' })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: '日常协作' })).toBeInTheDocument()
      expect(screen.queryByRole('tab', { name: /工作台/ })).not.toBeInTheDocument()
    })
  })

  it('shows launch empty home when only assistant greeting exists', async () => {
    mockApi({
      agentSessionList: async () => ({
        sessions: [{ id: 'p1', title: '新对话' }],
        ui: { openSessionIds: ['p1'], activeSessionId: 'p1' },
      }),
      agentSessionGet: async () => ({
        ok: true,
        session: {
          id: 'p1',
          messages: [{
            id: 'a1',
            role: 'assistant',
            text: '您好，我是 KnowMe，您的智能工作伙伴。我专注于协助您完成具体工作任务。',
          }],
        },
      }),
    })
    render(<AppShell />)
    await waitFor(() => expect(screen.getByLabelText('任务入口')).toBeInTheDocument())
    expect(screen.getByText(/把你的问题或任务交给 KnowMe/)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/给 KnowMe 发送消息/)).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /^通用/ })).toBeInTheDocument()
    expect(screen.queryByLabelText('选择本次对话知识库')).not.toBeInTheDocument()
    expect(screen.queryByTestId('agent-stream-bar')).not.toBeInTheDocument()
    expect(screen.getByTestId('agent-quick-btn')).toBeInTheDocument()
    expect(screen.getByTestId('agent-model-btn')).toBeInTheDocument()
    expect(screen.getByTestId('agent-model-btn').querySelector('svg')).toBeNull()
    expect(screen.getByRole('button', { name: /会议总结/ })).toBeInTheDocument()
    expect(screen.queryByText(/我专注于协助您完成具体工作任务/)).not.toBeInTheDocument()
  })

  it('keeps quick actions and model picker as separate composer controls', async () => {
    render(<AppShell />)
    const quick = screen.getByTestId('agent-quick-btn')
    const model = screen.getByTestId('agent-model-btn')
    expect(quick).not.toBe(model)
    expect(model).toHaveAttribute('aria-label', '选择模型')
    fireEvent.click(quick)
    expect(screen.getByTestId('agent-quick-menu')).toBeInTheDocument()
  })

  it('opens quick task menu only via Ctrl+K when conversation has user turns', async () => {
    render(<AppShell />)
    fireEvent.change(screen.getByPlaceholderText(/给 KnowMe 发送消息/), { target: { value: '你好' } })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))
    await waitFor(() => expect(screen.getByText('你好')).toBeInTheDocument())
    expect(screen.queryByTestId('agent-quick-menu')).not.toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    const quickMenu = screen.getByTestId('agent-quick-menu')
    expect(quickMenu).toBeInTheDocument()
    expect(quickMenu.closest('#agentComposer')).toBeNull()
    expect(quickMenu.closest('.agent-col-foot')).toBeTruthy()
    expect(screen.getByText(/4 项可用任务/)).toBeInTheDocument()
  })

  it('closing the last tab opens a fresh blank session', async () => {
    mockApi({
      agentSessionCloseTab: async () => ({
        ok: true,
        createdSessionId: 's-fresh',
        ui: { openSessionIds: ['s-fresh'], activeSessionId: 's-fresh' },
      }),
    })
    render(<AppShell />)
    const tab = screen.getByRole('tab', { name: /^通用/ })
    expect(useAppStore.getState().activeSessionId).toBe('s1')
    fireEvent.click(within(tab).getByRole('button', { name: '关闭' }))
    await waitFor(() => {
      expect(useAppStore.getState().activeSessionId).toBe('s-fresh')
    })
    expect(useAppStore.getState().sessions.map((item) => item.id)).toEqual(['s-fresh'])
    expect(screen.getAllByRole('tab')).toHaveLength(1)
  })

  it('renames a session from the tab context menu', async () => {
    const rename = vi.fn(async () => ({ ok: true }))
    mockApi({ agentSessionRename: rename })
    render(<AppShell />)
    fireEvent.contextMenu(screen.getByRole('tab', { name: /^通用/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: '重命名' }))
    const input = screen.getByLabelText('重命名会话')
    fireEvent.change(input, { target: { value: '项目跟进' } })
    fireEvent.blur(input)
    await waitFor(() => expect(rename).toHaveBeenCalledWith('s1', '项目跟进'))
    expect(screen.getByRole('tab', { name: '项目跟进' })).toBeInTheDocument()
  })

  it('opens model and slash menus via IPC lists', async () => {
    mockApi({
      llmModels: async () => ({
        presets: [{ id: 'gpt', label: 'GPT' }],
        groups: [{ id: 'openai', label: 'OpenAI', models: [{ id: 'gpt', label: 'GPT', contextWindow: 128000 }] }],
      }),
      llmProfile: async () => ({ model: 'gpt' }),
      capabilityList: async ({ kind }: { kind?: string } = {}) => (
        kind === 'skill'
          ? { ok: true, items: [{ id: 'sk1', kind: 'skill' as const, name: 'summarize', description: '总结' }] }
          : { ok: true, items: [] }
      ),
    })
    render(<AppShell />)
    await waitFor(() => expect(screen.getByTestId('agent-model-btn')).toHaveTextContent('GPT'))
    fireEvent.click(screen.getByTestId('agent-model-btn'))
    expect(screen.getByTestId('agent-model-menu')).toHaveTextContent('GPT')
    fireEvent.change(screen.getByPlaceholderText(/给 KnowMe 发送消息/), { target: { value: '/' } })
    await waitFor(() => expect(screen.getByTestId('agent-slash-menu')).toHaveTextContent('/summarize'))
  })

  it('shows execution timeline from stream events and opens image viewer', async () => {
    mockApi({
      onAiStreamEvent: (cb) => {
        queueMicrotask(() => cb({
          type: 'stage',
          payload: { id: 'stage_prepare', title: '上下文准备完成', status: 'done', summary: '命中 8 条' },
        }))
        return () => undefined
      },
      aiGenerate: async () => {
        await new Promise((r) => setTimeout(r, 30))
        return { text: '完成', streamed: true }
      },
    })
    render(<AppShell />)
    fireEvent.change(screen.getByPlaceholderText(/给 KnowMe 发送消息/), { target: { value: '你好' } })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))
    await waitFor(() => expect(screen.getByTestId('agent-execution-timeline')).toHaveTextContent('内容整理完成'))
    expect(screen.queryByTestId('agent-stream-bar')).not.toBeInTheDocument()
    expect(screen.queryByText('返回工作台')).not.toBeInTheDocument()
    useAppStore.setState({
      sessionStates: {
        s1: {
          composer: '',
          attachments: [],
          messages: [
            { id: 'u1', role: 'user', text: '看图' },
            { id: 'a1', role: 'assistant', text: '见图 ![x](https://example.test/a.png)' },
          ],
        },
      },
      isGenerating: false,
      assistantStatus: '',
    })
    await waitFor(() => expect(screen.getByTestId('agent-msg-image')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('agent-msg-image'))
    expect(screen.getByTestId('agent-image-viewer')).toBeInTheDocument()
  })

  it('renders composer attachment chips after file pick', async () => {
    render(<AppShell />)
    useAppStore.getState().addComposerAttachment({ name: 'notes.md', text: '# hello' })
    await waitFor(() => expect(screen.getByTestId('agent-attachments')).toHaveTextContent('notes.md'))
  })

  it('shows topic nav when many user turns overflow chat log', async () => {
    render(<AppShell />)
    useAppStore.setState({
      sessionStates: {
        s1: {
          composer: '',
          attachments: [],
          messages: [
            { id: 'u1', role: 'user', text: '主题一：需求梳理与范围确认' },
            { id: 'a1', role: 'assistant', text: '好的' },
            { id: 'u2', role: 'user', text: '主题二：接口设计与联调计划' },
            { id: 'a2', role: 'assistant', text: '收到' },
            { id: 'u3', role: 'user', text: '主题三：测试计划与发布窗口' },
          ],
        },
      },
    })
    const log = screen.getByTestId('agent-chat-log')
    Object.defineProperty(log, 'scrollHeight', { configurable: true, value: 800 })
    Object.defineProperty(log, 'clientHeight', { configurable: true, value: 200 })
    fireEvent.scroll(log)
    window.dispatchEvent(new Event('resize'))
    await waitFor(() => expect(screen.getByTestId('agent-topic-nav')).toBeInTheDocument())
  })

  it('shows compact shortcut bubble and live execution progress for meeting summary', async () => {
    const generate = vi.fn(async (payload: Record<string, unknown>) => {
      expect(String(payload.prompt)).toContain('feishu.meeting_read')
      expect(payload.displayPrompt).toBe('会议总结')
      return { text: '候选会议已列出', streamed: true }
    })
    mockApi({
      connectorsStatus: async () => ({ ok: true, connected: true }),
      aiGenerate: generate,
    })
    render(<AppShell />)
    fireEvent.click(screen.getByRole('button', { name: /会议总结/ }))
    expect(screen.getByTestId('msg-user')).toHaveTextContent('会议总结')
    expect(screen.queryByTestId('msg-user')?.textContent).not.toMatch(/feishu\.meeting_read/)
    expect(screen.getByTestId('agent-execution-timeline')).toHaveTextContent('正在整理相关内容')
    expect(screen.queryByTestId('agent-stream-bar')).not.toBeInTheDocument()
    await waitFor(() => expect(generate).toHaveBeenCalled())
  })

  it('renders assistant markdown bold and numbered lists', async () => {
    render(<AppShell />)
    useAppStore.setState({
      sessionStates: {
        s1: {
          composer: '',
          attachments: [],
          messages: [
            { id: 'u1', role: 'user', text: 'dsh' },
            {
              id: 'a1',
              role: 'assistant',
              text: '1. **Data Server Host**\n2. **Dynamic Skill Hit**',
            },
          ],
        },
      },
      isGenerating: false,
    })
    await waitFor(() => {
      const html = screen.getByTestId('msg-assistant').querySelector('.agent-md')?.innerHTML || ''
      expect(html).toContain('<strong>Data Server Host</strong>')
      expect(html).toContain('<ol>')
      expect(html).not.toContain('**Data')
    })
  })

  it('places empty-home composer after starter cards (baseline order)', async () => {
    render(<AppShell />)
    const home = await screen.findByTestId('assistant-empty-home')
    const cards = home.querySelector('.agent-empty-actions')
    const composer = home.querySelector('[data-testid="assistant-empty-composer"]')
    expect(cards).toBeTruthy()
    expect(composer).toBeTruthy()
    expect(
      Boolean(cards && composer && (cards.compareDocumentPosition(composer) & Node.DOCUMENT_POSITION_FOLLOWING)),
    ).toBe(true)
  })
})
