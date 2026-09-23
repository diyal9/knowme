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

  it('hides project context while preserving existing session project data', async () => {
    mockApi({
      projectsList: async () => ({
        ok: true,
        projects: [
          { id: 'p1', name: '会话项目', workspaceSourceId: 's1', status: 'active' },
          { id: 'p2', name: '导航项目', workspaceSourceId: 's2', status: 'active' },
        ],
        activeProjectId: 'p2',
      }),
      sourcesList: async () => ({ sources: [], activeSourceId: null }),
      agentSessionList: async () => ({
        sessions: [{ id: 'bound-session', title: '项目对话', projectId: 'p1', messageCount: 1 }],
        ui: { openSessionIds: ['bound-session'], activeSessionId: 'bound-session' },
      }),
      agentSessionGet: async () => ({ id: 'bound-session', title: '项目对话', projectId: 'p1', messages: [{ id: 'm1', role: 'user', text: '继续工作' }] }),
    })
    render(<AppShell />)

    await waitFor(() => {
      expect(useAppStore.getState().activeSessionId).toBe('bound-session')
    })
    expect(screen.queryByRole('button', { name: /当前对话项目：|当前对话：全局/ })).not.toBeInTheDocument()
    expect(useAppStore.getState().activeProjectId).toBe('p2')
    expect(useAppStore.getState().sessions.find((item) => item.id === 'bound-session')?.projectId).toBe('p1')
  })

  it('allows sending without an open editor file', async () => {
    render(<AppShell />)
    fireEvent.change(screen.getByPlaceholderText(/Ctrl \+ k智能推荐/), { target: { value: '你好' } })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))
    expect(screen.getByText('你好')).toBeInTheDocument()
    expect(screen.getByTestId('agent-execution-timeline')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText('你好，我是知我。需要我帮你做什么？')).toBeInTheDocument()
    })
    expect(screen.queryByText('未能收到完整答复，请重试。')).not.toBeInTheDocument()

    const composer = screen.getByPlaceholderText(/Ctrl \+ k智能推荐/)
    expect(composer).toHaveAttribute('data-empty', 'true')
    // Electron/Chromium may leave a filler node after clearing contentEditable.
    // A completed reply must still restore a genuinely empty, reusable editor.
    composer.append(document.createElement('br'))
    fireEvent.focus(composer)
    expect(composer).toHaveTextContent('')
    composer.textContent = '继续追问'
    fireEvent.input(composer)
    expect(composer).toHaveValue('继续追问')
    expect(composer).toHaveAttribute('data-empty', 'false')
  })

  it('applies late v2 answer.committed after invoke returns', async () => {
    let emit: ((event: Record<string, unknown>) => void) | undefined
    mockApi({
      onAiStreamEvent: (cb) => {
        emit = cb
        return () => undefined
      },
      aiGenerate: async (input) => {
        const runId = String(input?.runId || '')
        await new Promise((r) => setTimeout(r, 5))
        setTimeout(() => {
          emit?.({
            version: '2',
            runId,
            seq: '1',
            type: 'answer.committed',
            payload: { text: '迟到的完整答复', hash: 'h-late' },
          })
        }, 0)
        return {}
      },
    })
    render(<AppShell />)
    fireEvent.change(screen.getByPlaceholderText(/Ctrl \+ k智能推荐/), { target: { value: '你好' } })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))
    await waitFor(() => {
      expect(screen.getByText('迟到的完整答复')).toBeInTheDocument()
    })
  })

  it('hides follow-up chips when the reply is incomplete', async () => {
    mockApi({ aiGenerate: async () => ({}) })
    render(<AppShell />)
    fireEvent.change(screen.getByPlaceholderText(/Ctrl \+ k智能推荐/), { target: { value: '你好' } })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))
    await waitFor(() => {
      expect(screen.getByText('未能收到完整答复，请重试。')).toBeInTheDocument()
    })
    expect(screen.queryByText('继续追问细节')).not.toBeInTheDocument()
  })

  it('isolates messages when switching session tabs', async () => {
    render(<AppShell />)
    fireEvent.change(screen.getByPlaceholderText(/Ctrl \+ k智能推荐/), { target: { value: '会话一' } })
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
    fireEvent.change(screen.getByPlaceholderText(/Ctrl \+ k智能推荐/), { target: { value: '测流式' } })
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
    fireEvent.change(screen.getByPlaceholderText(/Ctrl \+ k智能推荐/), { target: { value: '@rea' } })
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
    expect(screen.queryByRole('region', { name: '常用入口' })).not.toBeInTheDocument()
    expect(screen.queryByText(/智能推荐可从输入框左下角打开/)).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Ctrl \+ k智能推荐/)).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /^新主题/ })).toBeInTheDocument()
    expect(screen.getByLabelText('选择本次对话知识库')).toBeInTheDocument()
    expect(screen.queryByTestId('agent-stream-bar')).not.toBeInTheDocument()
    expect(screen.getByTestId('agent-quick-btn')).toBeInTheDocument()
    expect(screen.getByTestId('agent-model-btn')).toBeInTheDocument()
    expect(screen.getByTestId('agent-model-btn').querySelector('.agent-model-caret')).toBeInTheDocument()
    expect(screen.getByTestId('agent-model-btn').querySelector('svg')).toBeNull()
    expect(screen.getByTestId('agent-model-btn')).not.toHaveClass('has-usage')
    expect(screen.getByTestId('agent-model-btn').querySelector('.agent-model-usage-ring')).toBeNull()
    expect(screen.queryByRole('button', { name: /查找和整理资料|分析相关信息|会议总结|回顾近期工作/ })).not.toBeInTheDocument()
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

  it('uses the model caret direction to show collapsed and expanded states', async () => {
    render(<AppShell />)
    const model = screen.getByTestId('agent-model-btn')
    const caret = model.querySelector('.agent-model-caret')
    expect(caret).toBeInTheDocument()
    expect(model).toHaveAttribute('aria-expanded', 'false')
    expect(caret).not.toHaveClass('is-open')
    fireEvent.click(model)
    expect(model).toHaveAttribute('aria-expanded', 'true')
  })

  it('opens quick task menu only via Ctrl+K when conversation has user turns', async () => {
    render(<AppShell />)
    fireEvent.change(screen.getByPlaceholderText(/Ctrl \+ k智能推荐/), { target: { value: '你好' } })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))
    await waitFor(() => expect(screen.getByText('你好')).toBeInTheDocument())
    expect(screen.queryByTestId('agent-quick-menu')).not.toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    const quickMenu = screen.getByTestId('agent-quick-menu')
    expect(quickMenu).toBeInTheDocument()
    expect(quickMenu.closest('#agentComposer')).toBeNull()
    expect(quickMenu.closest('.agent-col-foot')).toBeTruthy()
    expect(screen.getByRole('heading', { name: '智能推荐' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '相关能力与习惯' })).toBeInTheDocument()
    const menu = screen.getByTestId('agent-quick-menu')
    const recommended = within(menu).getAllByRole('menuitem')
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
      agentSessionList: async () => ({
        sessions: [{ id: 's1', title: '新助手', expertId: 'expert-a' }],
        ui: { openSessionIds: ['s1'], activeSessionId: 's1' },
      }),
      capabilityList: async ({ kind }: { kind?: string } = {}) => (
        kind === 'skill'
          ? { ok: true, items: [
            { id: 'sk1', kind: 'skill' as const, name: 'meeting notes', description: '整理会议纪要', category: '日常办公', favorite: true },
            { id: 'sk2', kind: 'skill' as const, name: 'summarize', description: '总结', category: '知识研究' },
            { id: 'sk3', kind: 'skill' as const, name: 'email handoff', description: '生成办公交付', category: '日常办公' },
            { id: 'sk4', kind: 'skill' as const, name: 'code checker', description: '检查代码', category: '软件研发' },
          ] }
          : kind === 'expert'
            ? { ok: true, items: [{ id: 'expert-a', kind: 'expert' as const, installed: true, enabled: true, skills: ['sk2', 'sk3'] }] }
            : { ok: true, items: [] }
      ),
    })
    render(<AppShell />)
    await waitFor(() => expect(screen.getByTestId('agent-model-btn')).toHaveTextContent('GPT'))
    await waitFor(() => expect(useAppStore.getState().assistantSkillIdsByExpert['expert-a']).toEqual(['sk2', 'sk3']))
    fireEvent.click(screen.getByTestId('agent-model-btn'))
    expect(screen.getByTestId('agent-model-menu')).toHaveTextContent('GPT')
    const composer = screen.getByPlaceholderText(/Ctrl \+ k智能推荐/)
    composer.textContent = '/'
    const slashRange = document.createRange()
    slashRange.selectNodeContents(composer)
    slashRange.collapse(false)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(slashRange)
    fireEvent.input(composer)
    expect(composer).toHaveTextContent('/')
    expect(composer).not.toHaveTextContent('//')
    await waitFor(() => expect(screen.getByTestId('agent-slash-menu')).toHaveTextContent('meeting notes'))
    const search = screen.getByRole('searchbox', { name: '搜索已安装技能' })
    expect(screen.getByTestId('agent-slash-menu')).not.toHaveTextContent('code checker')
    fireEvent.change(search, { target: { value: '代码' } })
    expect(screen.getByTestId('agent-slash-menu')).toHaveTextContent('code checker')
    fireEvent.change(search, { target: { value: '' } })
    const dailyCategory = screen.getByRole('treeitem', { name: /日常办公/ })
    const researchCategory = screen.getByRole('treeitem', { name: /知识研究/ })
    expect(dailyCategory).toHaveAttribute('aria-expanded', 'true')
    expect(researchCategory).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('treeitem', { name: /meeting notes/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('treeitem', { name: /email handoff/ })).toBeInTheDocument()
    expect(screen.queryByRole('treeitem', { name: /summarize/ })).not.toBeInTheDocument()

    fireEvent.keyDown(composer, { key: 'ArrowUp' })
    expect(dailyCategory).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(composer, { key: 'ArrowDown' })
    fireEvent.keyDown(composer, { key: 'ArrowDown' })
    fireEvent.keyDown(composer, { key: 'ArrowDown' })
    expect(researchCategory).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(composer, { key: 'ArrowRight' })
    expect(researchCategory).toHaveAttribute('aria-expanded', 'true')
    expect(dailyCategory).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('treeitem', { name: /meeting notes/ })).not.toBeInTheDocument()
    fireEvent.keyDown(composer, { key: 'ArrowRight' })
    expect(screen.getByRole('treeitem', { name: /summarize/ })).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(composer, { key: 'ArrowLeft' })
    expect(researchCategory).toHaveAttribute('aria-selected', 'true')

    fireEvent.change(search, { target: { value: '会议' } })
    expect(screen.getByTestId('agent-slash-menu')).toHaveTextContent('meeting notes')
    expect(screen.getByTestId('agent-slash-menu')).not.toHaveTextContent('summarize')
    fireEvent.keyDown(screen.getByRole('searchbox', { name: '搜索已安装技能' }), { key: 'Enter' })
    expect(composer).toHaveValue('/meeting notes ')
    expect(screen.getByTestId('agent-selected-skill-sk1')).toHaveTextContent('meeting notes')
    expect(useAppStore.getState().sessionStates.s1.skillRefs).toEqual(['sk1'])
    expect(screen.queryByTestId('agent-slash-menu')).not.toBeInTheDocument()

    composer.append(document.createTextNode('继续处理'))
    fireEvent.input(composer)
    expect(composer).toHaveValue('/meeting notes 继续处理')
    expect(screen.getByTestId('agent-selected-skill-sk1')).toHaveTextContent('meeting notes')
  })

  it('shows a removable skill toggle and sends the canonical skill id', async () => {
    const generate = vi.fn(async () => ({ text: '已完成' }))
    mockApi({
      aiGenerate: generate,
      capabilityList: async ({ kind }: { kind?: string } = {}) => (
        kind === 'skill'
          ? { ok: true, items: [
            { id: 'lark-sheet-fill', kind: 'skill' as const, name: '飞书数据填表', description: '写入飞书表格', category: '数据分析', favorite: true },
            { id: 'meeting-notes', kind: 'skill' as const, name: '会议纪要整理', description: '整理会议行动项', category: '日常办公', favorite: true },
          ] }
          : { ok: true, items: [] }
      ),
    })
    render(<AppShell />)

    const composer = screen.getByPlaceholderText(/Ctrl \+ k智能推荐/)
    fireEvent.change(composer, { target: { value: '请使用 /飞书' } })
    const skill = await screen.findByRole('treeitem', { name: /飞书数据填表/ })
    fireEvent.mouseDown(skill)

    expect(composer).toHaveValue('请使用 /飞书数据填表 ')
    const richComposer = screen.getByRole('textbox', { name: /Ctrl \+ k智能推荐/ })
    const toggle = screen.getByRole('button', { name: '已选择技能 飞书数据填表，点击移除' })
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(toggle.parentElement).toBe(richComposer)
    expect(toggle.previousSibling?.textContent).toBe('请使用 ')
    expect(screen.queryByRole('group', { name: '已选技能' })).not.toBeInTheDocument()
    expect(useAppStore.getState().sessionStates.s1.skillRefs).toEqual(['lark-sheet-fill'])

    fireEvent.click(toggle)
    expect(composer).toHaveValue('请使用 ')
    expect(screen.queryByTestId('agent-selected-skill-lark-sheet-fill')).not.toBeInTheDocument()
    expect(useAppStore.getState().sessionStates.s1.skillRefs).toEqual([])

    fireEvent.change(composer, { target: { value: '' } })
    fireEvent.change(composer, { target: { value: '/飞书' } })
    fireEvent.mouseDown(await screen.findByRole('treeitem', { name: /飞书数据填表/ }))
    fireEvent.change(composer, { target: { value: '/飞书数据填表 把分析结果写入本周数据表' } })
    expect(screen.queryByTestId('agent-slash-menu')).not.toBeInTheDocument()

    composer.append(document.createTextNode(' /'))
    const endRange = document.createRange()
    endRange.selectNodeContents(composer)
    endRange.collapse(false)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(endRange)
    fireEvent.input(composer)
    expect(composer).toHaveValue('/飞书数据填表 把分析结果写入本周数据表 /')
    expect(await screen.findByTestId('agent-slash-menu')).toBeInTheDocument()
    fireEvent.mouseDown(screen.getByRole('treeitem', { name: /日常办公/ }))
    fireEvent.mouseDown(screen.getByRole('treeitem', { name: /会议纪要整理/ }))
    expect(screen.queryByTestId('agent-slash-menu')).not.toBeInTheDocument()
    expect(composer).toHaveValue('/飞书数据填表 把分析结果写入本周数据表 /会议纪要整理 ')
    expect(screen.getByTestId('agent-selected-skill-meeting-notes')).toHaveTextContent('会议纪要整理')
    expect(useAppStore.getState().sessionStates.s1.skillRefs).toEqual(['lark-sheet-fill', 'meeting-notes'])

    fireEvent.click(screen.getByRole('button', { name: '发送' }))

    await waitFor(() => expect(generate).toHaveBeenCalled())
    expect(generate).toHaveBeenCalledWith(expect.objectContaining({
      prompt: expect.stringContaining('/飞书数据填表 把分析结果写入本周数据表 /会议纪要整理'),
      displayPrompt: '/飞书数据填表 把分析结果写入本周数据表 /会议纪要整理',
      skillRefs: ['lark-sheet-fill', 'meeting-notes'],
    }))
    expect(screen.queryByTestId('agent-selected-skill-lark-sheet-fill')).not.toBeInTheDocument()
    const sentMessage = screen.getByTestId('msg-user')
    expect(sentMessage).toHaveTextContent('/飞书数据填表 把分析结果写入本周数据表 /会议纪要整理')
    expect(sentMessage).not.toHaveTextContent('lark-sheet-fill')
    expect(within(sentMessage).getByLabelText('技能 飞书数据填表')).toHaveClass('agent-user-skill-ref')
    expect(within(sentMessage).getByLabelText('技能 会议纪要整理')).toHaveClass('agent-user-skill-ref')
    expect(sentMessage.querySelectorAll('.agent-user-skill-ref .agent-skill-toggle-icon')).toHaveLength(2)
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
    fireEvent.change(screen.getByPlaceholderText(/Ctrl \+ k智能推荐/), { target: { value: '你好' } })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))
    await waitFor(() => expect(screen.getByTestId('agent-execution-timeline')).toBeInTheDocument())
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
    expect(screen.queryByText('https://example.test/a.png')).not.toBeInTheDocument()
    expect(screen.getByTestId('agent-msg-image')).toHaveClass('agent-msg-image')
    fireEvent.click(screen.getByTestId('agent-msg-image'))
    expect(screen.getByTestId('agent-image-viewer')).toBeInTheDocument()
  })

  it('renders multiple message images as a compact preview strip', async () => {
    useAppStore.setState({
      sessionStates: {
        s1: {
          composer: '',
          attachments: [],
          messages: [{ id: 'u1', role: 'user', text: '看两张图' }, {
            id: 'a1', role: 'assistant', text: '候选图：![A](https://example.test/a.png) https://example.test/b.jpg',
          }],
        },
      },
      isGenerating: false,
    })
    render(<AppShell />)
    expect(await screen.findByText('已查看 2 张图像')).toBeInTheDocument()
    expect(screen.getAllByTestId('agent-msg-image')).toHaveLength(2)
    expect(screen.queryByText('https://example.test/a.png')).not.toBeInTheDocument()
    expect(screen.queryByText('https://example.test/b.jpg')).not.toBeInTheDocument()
  })

  it('keeps stage-only progress out of ordinary companion replies', async () => {
    useAppStore.setState({
      sessionStates: {
        s1: {
          composer: '',
          attachments: [],
          messages: [
            { id: 'u1', role: 'user', text: 'hi' },
            {
              id: 'a1',
              role: 'assistant',
              text: '你好！',
              trace: [
                { id: 'prepare', kind: 'stage', title: '上下文准备完成', status: 'done', round: 1 },
                { id: 'answer', kind: 'stage', title: '回答已完成', status: 'done', round: 2 },
              ],
            },
          ],
        },
      },
      isGenerating: false,
    })
    render(<AppShell />)
    expect(screen.queryByTestId('agent-execution-timeline')).not.toBeInTheDocument()
    expect(screen.getByTestId('user-message-content')).toHaveTextContent('hi')
  })

  it('keeps Chinese prose outside an adjacent Feishu link', () => {
    const href = 'https://example.feishu.cn/wiki/BdKrdR019oCv5bxpnFlc4TTnpkh'
    useAppStore.setState({
      sessionStates: {
        s1: {
          composer: '',
          attachments: [],
          messages: [{ id: 'u1', role: 'user', text: `帮我总结下${href}这个飞书文档` }],
        },
      },
    })
    render(<AppShell />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', href)
    expect(screen.getByTestId('user-message-content')).toHaveTextContent('这个飞书文档')
    fireEvent.click(link)
    expect(useAppStore.getState().linkPreview?.href).toBe(href)
  })

  it('shows expandable returned code and message for a failed tool', () => {
    useAppStore.setState({
      sessionStates: {
        s1: {
          composer: '',
          attachments: [],
          messages: [
            { id: 'u1', role: 'user', text: '读取这个飞书文档' },
            {
              id: 'a1',
              role: 'assistant',
              text: '未能读取文档。',
              trace: [{
                id: 'tool-feishu',
                kind: 'tool',
                title: '飞书：read_doc',
                toolName: 'feishu.read_doc',
                status: 'error',
                errorCode: 'invalid_args',
                errorMessage: '文档链接格式无效',
              }],
            },
          ],
        },
      },
    })
    render(<AppShell />)
    expect(screen.queryByText(/工具调用失败/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('飞书：read_doc 未完成'))
    expect(screen.getByText('错误码')).toBeInTheDocument()
    expect(screen.getByText('invalid_args')).toBeInTheDocument()
    expect(screen.getByText('错误信息')).toBeInTheDocument()
    expect(screen.getByText('文档链接格式无效')).toBeInTheDocument()
  })

  it('renders composer attachment chips after file pick', async () => {
    render(<AppShell />)
    useAppStore.getState().addComposerAttachment({ name: 'notes.md', text: '# hello' })
    await waitFor(() => expect(screen.getByTestId('agent-attachments')).toHaveTextContent('notes.md'))
  })

  it('renders pasted image attachments as compact preview cards', async () => {
    render(<AppShell />)
    useAppStore.getState().addComposerAttachment({
      name: 'image.png',
      kind: 'image',
      dataUrl: 'data:image/png;base64,aGVsbG8=',
    })
    await waitFor(() => {
      const image = screen.getByAltText('image.png')
      expect(image).toHaveClass('agent-attachment-thumb')
      expect(image.closest('.agent-attachment')).toHaveClass('is-image')
      expect(screen.getByRole('button', { name: '预览 image.png' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '移除 image.png' })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: '预览 image.png' }))
    expect(screen.getByRole('dialog', { name: '预览 image.png' })).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: '预览 image.png' })).not.toBeInTheDocument()
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
    expect(screen.getByTestId('agent-topic-nav')).toHaveStyle({ left: '28px' })
    expect(screen.getByLabelText(/主题 1：主题一/)).toBeInTheDocument()
    expect(screen.getByTestId('msg-user')).toHaveAttribute('data-user-msg-idx', '0')
    expect(screen.getByTestId('agent-chat-log').contains(screen.getByTestId('agent-topic-nav'))).toBe(false)
    expect(screen.queryByTestId('agent-topic-viewport')).not.toBeInTheDocument()
  })

  it('keeps the empty home focused on composer and live execution progress', async () => {
    const generate = vi.fn(async (payload: Record<string, unknown>) => {
      expect(String(payload.prompt)).toContain('你好')
      expect(payload.displayPrompt).toContain('你好')
      return { text: '候选会议已列出', streamed: true }
    })
    mockApi({
      connectorsStatus: async () => ({ ok: true, connected: true }),
      aiGenerate: generate,
    })
    render(<AppShell />)
    fireEvent.change(screen.getByPlaceholderText(/Ctrl \+ k智能推荐/), { target: { value: '你好' } })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))
    expect(screen.getByTestId('msg-user')).toHaveTextContent('你好')
    expect(screen.queryByTestId('msg-user')?.textContent).not.toMatch(/feishu\.meeting_read/)
    expect(screen.getByTestId('agent-execution-timeline')).toBeInTheDocument()
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

  it('keeps empty-home focused on the composer without starter cards', async () => {
    render(<AppShell />)
    const home = await screen.findByTestId('assistant-empty-home')
    const composer = home.querySelector('[data-testid="assistant-empty-composer"]')
    expect(composer).toBeTruthy()
    expect(home.querySelector('.agent-empty-actions')).toBeNull()
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
    fireEvent.click(screen.getByRole('button', { name: '接受成果' }))
    await waitFor(() => expect(write).toHaveBeenCalled())
    expect(write).toHaveBeenCalledWith(expect.objectContaining({ sourceId: 'src1', path: 'docs/a.md', content: '已写入正文' }))
  })

  it('shows compact history sessions without avatar marks', async () => {
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
    expect(within(pop).getByText('清空历史对话')).toBeInTheDocument()
    expect(pop.querySelector('.agent-avatar-photo')).toBeNull()
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
    fireEvent.change(screen.getByPlaceholderText(/Ctrl \+ k智能推荐/), { target: { value: '你好' } })
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
    fireEvent.change(screen.getByPlaceholderText(/Ctrl \+ k智能推荐/), { target: { value: '你好' } })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))
    await waitFor(() => expect(screen.getByRole('button', { name: '停止生成' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: '停止生成' }))
    await waitFor(() => expect(screen.getByTestId('guided-recovery-panel')).toHaveTextContent('已取消'))
    expect(screen.queryByRole('button', { name: '重试' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '降级本地' })).not.toBeInTheDocument()
  })
})
