import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from '../../app/AppShell'
import { useAppStore } from '../../app/store'
import { mockApi, resetAppStore } from '../../test/helpers'
import { AssistantSessionTabs } from './AssistantSessionTabs'

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

    fireEvent.click(screen.getByLabelText('新主题'))
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
    expect(screen.getByText(/今天想让 KnowMe 做什么/)).toBeInTheDocument()
    expect(screen.queryByText('开始使用')).not.toBeInTheDocument()
    expect(screen.getByText(/最近三天会议/)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/给 KnowMe 发送消息/)).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /^新主题/ })).toBeInTheDocument()
    expect(screen.queryByLabelText('选择本次对话知识库')).not.toBeInTheDocument()
    expect(screen.queryByTestId('agent-stream-bar')).not.toBeInTheDocument()
    expect(screen.getByTestId('agent-quick-btn')).toBeInTheDocument()
    expect(screen.getByTestId('agent-model-btn')).toBeInTheDocument()
    expect(screen.getByTestId('agent-model-btn').querySelector('svg')).toBeNull()
    expect(screen.getByTestId('agent-model-btn')).not.toHaveClass('has-usage')
    expect(screen.getByTestId('agent-model-btn').querySelector('.agent-model-usage-ring')).toBeNull()
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
    expect(screen.getByRole('heading', { name: '智能推荐' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '我的常用' })).toBeInTheDocument()
    const menu = screen.getByTestId('agent-quick-menu')
    const recommended = within(menu).getAllByRole('menuitem')
    expect(recommended[0]).toHaveClass('active')
    fireEvent.keyDown(menu, { key: 'ArrowRight' })
    expect(recommended[4]).toHaveClass('active')
    fireEvent.keyDown(menu, { key: 'ArrowLeft' })
    expect(recommended[0]).toHaveClass('active')
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
    const tab = screen.getByRole('tab', { name: /^新主题/ })
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
    fireEvent.contextMenu(screen.getByRole('tab', { name: /^新主题/ }))
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
    await waitFor(() => expect(screen.getByTestId('agent-slash-menu')).toHaveTextContent('summarize'))
    fireEvent.keyDown(screen.getByPlaceholderText(/给 KnowMe 发送消息/), { key: 'Escape' })
    expect(screen.queryByTestId('agent-slash-menu')).not.toBeInTheDocument()
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

  it('shows topic rail as soon as a meaningful user turn exists', async () => {
    render(<AppShell />)
    useAppStore.setState({
      sessionStates: {
        s1: {
          composer: '',
          attachments: [],
          messages: [
            { id: 'u1', role: 'user', text: '主题一：需求梳理与范围确认' },
            { id: 'a1', role: 'assistant', text: '好的，先从范围与里程碑开始' },
          ],
        },
      },
    })
    await waitFor(() => expect(screen.getByTestId('agent-topic-nav')).toBeInTheDocument())
    expect(screen.getByTestId('agent-topic-nav')).not.toHaveAttribute('hidden')
    expect(screen.getByLabelText(/主题 1：主题一/)).toBeInTheDocument()
    expect(screen.getByTestId('msg-user')).toHaveAttribute('data-user-msg-idx', '0')
    expect(screen.getByTestId('agent-chat-log').contains(screen.getByTestId('agent-topic-nav'))).toBe(false)
    expect(screen.queryByTestId('agent-topic-viewport')).not.toBeInTheDocument()
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
    expect(screen.getByTestId('agent-execution-timeline')).toHaveClass('is-compact')
    expect(screen.queryByTestId('agent-thinking-status')).not.toBeInTheDocument()
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

  it('does not show sticky-notes apply-to-file on assistant replies', async () => {
    render(<AppShell />)
    useAppStore.setState({
      activeSourceId: 'src1',
      assistantApplyTarget: { sourceId: 'src1', path: 'docs/a.md' },
      sessionStates: {
        s1: {
          composer: '',
          attachments: [],
          messages: [
            { id: 'u1', role: 'user', text: '写一段' },
            { id: 'a1', role: 'assistant', text: '新正文内容' },
          ],
        },
      },
    })
    await waitFor(() => expect(screen.getByText('新正文内容')).toBeInTheDocument())
    expect(screen.queryByTestId('agent-apply-menu')).not.toBeInTheDocument()
    expect(screen.queryByText('应用到文件')).not.toBeInTheDocument()
    expect(screen.queryByText('插入光标')).not.toBeInTheDocument()
    expect(screen.queryByText('追加文末')).not.toBeInTheDocument()
  })

  it('accepts editor_patch artifact and writes target file', async () => {
    const write = vi.fn(async () => ({ ok: true }))
    mockApi({
      agentArtifactAccept: async () => ({
        ok: true,
        editorPatch: true,
        body: '已写入正文',
        session: {
          id: 's1',
          run: {
            artifacts: [{
              id: 'art-1',
              type: 'editor_patch',
              status: 'accepted',
              targetPath: 'docs/a.md',
              meta: { sourceId: 'src1', path: 'docs/a.md' },
            }],
          },
        },
      }),
      sourcesWriteFile: write,
    })
    render(<AppShell />)
    useAppStore.setState({
      assistantApplyTarget: { sourceId: 'src1', path: 'docs/a.md' },
      sessions: [{
        id: 's1',
        title: '新助手',
        agentId: 'general',
        run: {
          artifacts: [{
            id: 'art-1',
            type: 'editor_patch',
            title: '替换当前文件全文（待确认）',
            body: '已写入正文',
            status: 'draft',
            targetPath: 'docs/a.md',
            meta: { sourceId: 'src1', path: 'docs/a.md' },
          }],
        },
      }],
      sessionStates: {
        s1: {
          composer: '',
          attachments: [],
          messages: [
            { id: 'u1', role: 'user', text: '写' },
            { id: 'a1', role: 'assistant', text: '正文' },
          ],
        },
      },
    })
    await waitFor(() => expect(screen.getByTestId('agent-artifact-card')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: '接受' }))
    await waitFor(() => expect(write).toHaveBeenCalled())
    expect(write).toHaveBeenCalledWith(expect.objectContaining({ sourceId: 'src1', path: 'docs/a.md', content: '已写入正文' }))
  })

  it('shows history sessions with mode avatar marks', async () => {
    mockApi({
      agentSessionList: async () => ({
        sessions: [
          { id: 's1', title: '当前', agentId: 'general' },
          { id: 'h1', title: '历史会话', agentId: 'general', summary: '整理本周会议纪要并提炼行动项', updatedAt: '2026-08-18T02:00:00.000Z' },
          { id: 'h2', title: 'New Agent', agentId: 'general' },
        ],
        ui: { openSessionIds: ['s1'], activeSessionId: 's1' },
      }),
    })
    render(<AppShell />)
    await waitFor(() => expect(screen.getByRole('tab', { name: '当前' })).toBeInTheDocument())
    fireEvent.click(screen.getByLabelText('历史'))
    const pop = await screen.findByTestId('agent-history-pop')
    expect(within(pop).getByLabelText('搜索历史会话')).toHaveClass('history-pop-query')
    expect(within(pop).getByText('历史会话')).toBeInTheDocument()
    expect(within(pop).getByText('整理本周会议纪要并提炼行动项')).toBeInTheDocument()
    expect(within(pop).getByText('新主题')).toBeInTheDocument()
    expect(pop.querySelector('.agent-avatar-photo')).toBeTruthy()
  })

  it('keeps tab context menu to session actions only', async () => {
    render(<AppShell />)
    const tab = await screen.findByRole('tab')
    fireEvent.contextMenu(tab)
    const menu = await screen.findByTestId('agent-tab-ctx')
    expect(within(menu).getByText('重命名')).toBeInTheDocument()
    expect(within(menu).getByText('复制对话记录')).toBeInTheDocument()
    expect(within(menu).getByText('关闭')).toBeInTheDocument()
    expect(within(menu).queryByText('管理对话')).not.toBeInTheDocument()
    expect(within(menu).queryByText('Pin')).not.toBeInTheDocument()
    expect(within(menu).queryByText('分叉')).not.toBeInTheDocument()
    expect(within(menu).queryByText('关闭左侧')).not.toBeInTheDocument()
  })

  it('keeps more menu to current-work actions', async () => {
    render(<AppShell />)
    await waitFor(() => expect(screen.getByLabelText('更多')).toBeInTheDocument())
    fireEvent.click(screen.getByLabelText('更多'))
    const pop = await screen.findByTestId('agent-more-pop')
    expect(within(pop).getByText('智能伙伴属性')).toBeInTheDocument()
    expect(within(pop).queryByText('新对话')).not.toBeInTheDocument()
    expect(within(pop).getByText('在新对话继续')).toBeInTheDocument()
    expect(within(pop).getByText('复制当前总结')).toBeInTheDocument()
    expect(within(pop).queryByText('重命名')).not.toBeInTheDocument()
    expect(within(pop).queryByText('关闭 Tab')).not.toBeInTheDocument()
    expect(within(pop).queryByText(/动作表现/)).not.toBeInTheDocument()
    expect(within(pop).queryByText('复制错误信息')).not.toBeInTheDocument()
  })

  it('opens personal-agent properties from the more menu', async () => {
    const openGrowth = vi.fn()
    render(<AssistantSessionTabs onOpenGrowth={openGrowth} />)
    fireEvent.click(screen.getByLabelText('更多'))
    fireEvent.click(await screen.findByText('智能伙伴属性'))
    expect(openGrowth).toHaveBeenCalledOnce()
    expect(screen.queryByTestId('agent-more-pop')).not.toBeInTheDocument()
  })

  it('renders streaming assistant text as plain fallback without markdown parse', async () => {
    render(<AppShell />)
    useAppStore.setState({
      sessionStates: {
        s1: {
          composer: '',
          attachments: [],
          messages: [
            { id: 'u1', role: 'user', text: '你好' },
            { id: 'a1', role: 'assistant', text: '1. **bold**', streaming: true },
          ],
        },
      },
      isGenerating: true,
      assistantStatus: '正在组织回答',
    })
    await waitFor(() => {
      expect(screen.getByTestId('msg-assistant')).toBeInTheDocument()
      expect(screen.getByTestId('content-view-fallback')).toHaveTextContent('1. **bold**')
    })
    expect(screen.queryByTestId('content-view')).not.toBeInTheDocument()
    const streamStatus = screen.getByTestId('assistant-stream-status')
    expect(streamStatus).toHaveTextContent('正在组织回答')
    expect(screen.getByTestId('agent-chat-log').contains(streamStatus)).toBe(true)
    expect(document.querySelector('.agent-col-foot')?.contains(streamStatus)).toBe(false)
  })

  it('keeps finished timeout errors in the transcript, not above the composer', async () => {
    render(<AppShell />)
    useAppStore.setState({
      isGenerating: false,
      assistantStatus: '请求超时（120s），请检查网络或 Endpoint',
      assistantProcessFeed: '请求超时（120s），请检查网络或 Endpoint',
      sessionStates: {
        s1: {
          composer: '',
          attachments: [],
          messages: [
            { id: 'u1', role: 'user', text: '会议总结' },
            { id: 'a1', role: 'error', text: '请求超时（120s），请检查网络或 Endpoint' },
          ],
        },
      },
    })
    await waitFor(() => expect(screen.getByText('请求超时（120s），请检查网络或 Endpoint')).toBeInTheDocument())
    expect(screen.queryByTestId('assistant-stream-status')).not.toBeInTheDocument()
  })

  it('preloads knowledge providers during assistant chrome load', async () => {
    const providerList = vi.fn(async () => ({
      ok: true,
      providers: [{ id: 'p-remote', displayName: '远程知识库', kind: 'remote' }],
      activeProviderId: 'p-remote',
    }))
    mockApi({ knowledgeProviderList: providerList })
    render(<AppShell />)
    await waitFor(() => expect(providerList).toHaveBeenCalled())
    await waitFor(() => {
      expect(useAppStore.getState().knowledgeProviders.some((p) => p.id === 'p-remote')).toBe(true)
    })
  })

  it('shows guided recovery after a failed generate', async () => {
    mockApi({ aiGenerate: async () => ({ error: '远程超时' }) })
    render(<AppShell />)
    fireEvent.change(screen.getByPlaceholderText(/给 KnowMe 发送消息/), { target: { value: '你好' } })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))
    await waitFor(() => {
      expect(screen.getByTestId('guided-recovery-panel')).toBeInTheDocument()
    })
    expect(screen.getByTestId('guided-recovery-panel')).toHaveTextContent('重试')
  })

  it('shows only a cancelled label after stopping generation', async () => {
    mockApi({
      aiGenerate: async () => new Promise(() => undefined),
      aiCancelRun: async () => ({ ok: true }),
    })
    render(<AppShell />)
    fireEvent.change(screen.getByPlaceholderText(/给 KnowMe 发送消息/), { target: { value: '你好' } })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))
    await waitFor(() => expect(screen.getByRole('button', { name: '停止生成' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: '停止生成' }))
    await waitFor(() => expect(screen.getByTestId('guided-recovery-panel')).toHaveTextContent('已取消'))
    expect(screen.queryByRole('button', { name: '重试' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '降级本地' })).not.toBeInTheDocument()
  })
})
