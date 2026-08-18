import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsSurface } from './SettingsSurface'
import { mockApi } from '../../test/helpers'

describe('settings-surface', () => {
  beforeEach(() => {
    mockApi({
      getSettings: () => ({
        model: 'gpt-4o-mini',
        apiEndpoint: 'https://api.openai.com/v1/chat/completions',
        llmProvider: 'openai',
        temperature: 0.7,
      }),
      initSettings: (cb) => cb({
        model: 'gpt-4o-mini',
        apiEndpoint: 'https://api.openai.com/v1/chat/completions',
      }),
      sourcesList: async () => ({ sources: [{ id: 's1', type: 'local', displayName: 'Docs' }] }),
      llmProfile: async () => ({ model: 'gpt-4o-mini' }),
      llmModels: async () => ({ presets: [{ id: 'gpt-4o-mini', label: 'GPT-4o mini' }] }),
      saveSettings: vi.fn(async () => ({ ok: true })),
    })
  })
  afterEach(() => cleanup())

  it('renders tabbed settings with sources and save', async () => {
    render(<SettingsSurface />)
    expect(screen.getByTestId('settings-surface')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '内容源' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'AI 接口' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Docs')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('tab', { name: 'AI 接口' }))
    expect(screen.getByLabelText('API Endpoint')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Model ID'), { target: { value: 'qwen-plus' } })
    fireEvent.click(screen.getByRole('button', { name: '保存设置' }))
  })

  it('probes the saved AI endpoint from the settings page', async () => {
    const probe = vi.fn(async () => ({ ok: true, latencyMs: 42, host: 'dashscope.aliyuncs.com', model: 'qwen-turbo' }))
    mockApi({
      getSettings: () => ({
        model: 'qwen-turbo',
        apiEndpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        llmProvider: 'dashscope',
      }),
      initSettings: (cb) => cb({
        model: 'qwen-turbo',
        apiEndpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      }),
      sourcesList: async () => ({ sources: [] }),
      llmProbe: probe,
    })
    render(<SettingsSurface />)
    fireEvent.click(screen.getByRole('tab', { name: 'AI 接口' }))
    fireEvent.click(screen.getByRole('button', { name: '测试连接' }))
    await waitFor(() => expect(probe).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByText(/连通（42ms）/)).toBeInTheDocument())
  })

  it('restores memory tab identity and pattern review', async () => {
    const review = vi.fn(async () => ({ ok: true }))
    mockApi({
      getSettings: () => ({ userProfile: '独立开发者', userPrompt: '先给结论', industry: 'software' }),
      initSettings: (cb) => cb({ userProfile: '独立开发者', userPrompt: '先给结论', industry: 'software' }),
      sourcesList: async () => ({ sources: [] }),
      memoryOverview: async () => ({
        config: { learningEnabled: true },
        patterns: [{ id: 'p1', summary: '喜欢列表回答', prompt_state: 'pending', count: 4 }],
        recent: [{ kind: 'copy', summary: '复制了一段提示词', ts: new Date().toISOString() }],
        stats: { recentCount: 1, pendingCount: 1, acceptedCount: 0 },
      }),
      memoryReviewPattern: review,
    })
    render(<SettingsSurface />)
    fireEvent.click(screen.getByRole('tab', { name: '我的记忆' }))
    expect(screen.getByLabelText('关于我')).toHaveValue('独立开发者')
    expect(screen.getByLabelText('协作偏好')).toHaveValue('先给结论')
    await waitFor(() => expect(screen.getByTestId('memory-pattern')).toHaveTextContent('喜欢列表回答'))
    fireEvent.click(screen.getByRole('button', { name: '接受' }))
    await waitFor(() => expect(review).toHaveBeenCalledWith({ id: 'p1', action: 'accepted' }))
    fireEvent.click(screen.getByRole('tab', { name: '助手模式' }))
    expect(screen.queryByLabelText('关于我')).not.toBeInTheDocument()
  })

  it('polls Feishu authorization and shows missing scopes', async () => {
    let connected = false
    mockApi({
      getSettings: () => ({ model: 'gpt-4o-mini' }),
      initSettings: (cb) => cb({ model: 'gpt-4o-mini' }),
      sourcesList: async () => ({ sources: [] }),
      connectorsList: async () => ({ connectors: [{ id: 'feishu', title: '飞书', allowlist: [], enabled: true }] }),
      connectorsUpsert: async () => ({ ok: true }),
      connectorsStatus: async () => (
        connected
          ? {
              ok: true,
              connected: true,
              state: 'online',
              userReady: true,
              capabilities: { docsKb: { ready: true } },
              permissions: { known: true, complete: true, categories: [] },
            }
          : {
              ok: false,
              message: '未连接',
              state: 'auth_required',
              userReady: false,
              permissionPlan: {
                missingCategories: [{ id: 'calendar', label: '日程' }],
                categories: [{ id: 'calendar', label: '日程', state: 'missing' }],
              },
            }
      ),
      connectorsFeishuAuthStart: async () => {
        connected = true
        return { verificationUrl: 'https://auth.test/feishu' }
      },
      openExternal: async () => ({ ok: true }),
    })
    render(<SettingsSurface />)
    fireEvent.click(screen.getByRole('tab', { name: '连接器' }))
    await waitFor(() => expect(screen.getByTestId('feishu-primary-action')).toHaveTextContent('一键授权'))
    fireEvent.click(screen.getByTestId('feishu-primary-action'))
    await waitFor(() => expect(screen.getByTestId('feishu-scopes')).toHaveTextContent('日程'))
    fireEvent.click(screen.getByRole('button', { name: '确认并授权' }))
    await waitFor(() => expect(screen.getByTestId('feishu-primary-action')).toHaveTextContent('已连接'), { timeout: 3000 })
    expect(screen.getByTestId('feishu-primary-action')).toBeDisabled()
  })

  it('restores assistant, system, mcp and about controls', async () => {
    mockApi({
      getSettings: () => ({ model: 'gpt-4o-mini' }),
      initSettings: (cb) => cb({ model: 'gpt-4o-mini' }),
      sourcesList: async () => ({ sources: [], gitAvailable: true }),
      connectorsList: async () => ({ connectors: [{ id: 'mcp-default', title: '公司 MCP', mcp: { command: 'npx', args: [] } }] }),
      connectorsStatus: async () => ({ ok: false, message: '未连接' }),
      workbenchAuthStatus: async () => ({ ok: true, auth: { state: 'disabled', endpoint: 'http://127.0.0.1:8010' } }),
      workbenchBootstrapStatus: async () => ({ ok: true, status: { message: '尚未检测' } }),
      appInfo: async () => ({ name: 'KnowMe', version: '0.3.0', isPackaged: false }),
    })
    render(<SettingsSurface />)
    await waitFor(() => expect(screen.getByTestId('git-avail-hint')).toHaveTextContent('已检测到本机 git'))
    fireEvent.click(screen.getByRole('tab', { name: '助手模式' }))
    expect(screen.getByRole('button', { name: '打开专家库' })).toBeInTheDocument()
    expect(screen.getByText('4 Modes')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: '系统配置' }))
    expect(screen.getByText('开机自动启动')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '导出' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: '连接器' }))
    expect(screen.getByLabelText('启动命令')).toBeInTheDocument()
    expect(screen.getByLabelText('服务地址')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: '关于' }))
    await waitFor(() => expect(screen.getByTestId('app-version')).toHaveTextContent('v0.3.0'))
    expect(screen.getByText('开发模式')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '技术博客' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '请喝冰美式' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '联系邮箱' })).toBeInTheDocument()
    expect(screen.getByText(/diyal9/)).toBeInTheDocument()
  })
})
