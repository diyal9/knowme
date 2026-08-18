import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from '../../app/AppShell'
import { useAppStore } from '../../app/store'
import { mockApi, renderApp, resetAppStore } from '../../test/helpers'

const catalog = {
  ok: true,
  items: [
    { id: 'e1', kind: 'expert' as const, name: '产品经理', description: '需求澄清', category: '办公' },
    { id: 's1', kind: 'skill' as const, name: '写纪要', description: '会议纪要', category: '办公' },
    { id: 'c1', kind: 'connector' as const, name: '飞书 MCP', description: 'IM 连接器', category: '飞书' },
  ],
}

describe('capability hub overlay', () => {
  beforeEach(() => {
    resetAppStore()
    useAppStore.setState({ route: 'capabilities' })
  })
  afterEach(() => cleanup())

  it('lists experts by default with tabs for 专家/技能/MCP', async () => {
    mockApi({ capabilityList: async () => catalog })
    await renderApp(<AppShell />)
    const hub = await screen.findByTestId('capability-hub-surface')
    await waitFor(() => {
      expect(within(hub).getByRole('heading', { name: '产品经理' })).toBeInTheDocument()
    })
    const expertTab = within(hub).getByRole('tab', { name: '专家' })
    expect(expertTab).toHaveAttribute('aria-selected', 'true')
    expect(expertTab).toHaveClass('hub-tab')
    expect(within(hub).getByRole('tablist', { name: '能力类型' })).toHaveClass('hub-tabs')
    expect(hub.querySelector('.hub-nav-title')).toBeTruthy()
    expect(hub.querySelector('#hubBtnClose')).toBeNull()
    expect(within(hub).queryByRole('button', { name: '关闭' })).not.toBeInTheDocument()
    expect(within(hub).queryByText('写纪要')).not.toBeInTheDocument()
  })

  it('switches tab to skills', async () => {
    mockApi({
      capabilityList: async (opts) => ({
        ok: true,
        items: catalog.items.filter((item) => item.kind === opts?.kind),
      }),
    })
    await renderApp(<AppShell />)
    const hub = await screen.findByTestId('capability-hub-surface')
    await waitFor(() => expect(within(hub).getByRole('heading', { name: '产品经理' })).toBeInTheDocument())
    fireEvent.click(within(hub).getByRole('tab', { name: '技能' }))
    await waitFor(() => {
      expect(within(hub).getByRole('heading', { name: '写纪要' })).toBeInTheDocument()
      expect(within(hub).queryByRole('heading', { name: '产品经理' })).not.toBeInTheDocument()
    })
  })

  it('filters hub cards by search query', async () => {
    mockApi({ capabilityList: async () => catalog })
    await renderApp(<AppShell />)
    const hub = await screen.findByTestId('capability-hub-surface')
    await waitFor(() => expect(within(hub).getByRole('heading', { name: '产品经理' })).toBeInTheDocument())
    fireEvent.change(within(hub).getByLabelText('搜索能力'), { target: { value: '飞书' } })
    fireEvent.click(within(hub).getByRole('tab', { name: 'MCP 连接器' }))
    await waitFor(() => {
      expect(within(hub).getByRole('heading', { name: '飞书 MCP' })).toBeInTheDocument()
    })
  })

  it('opens chips, featured, detail drawer and add/import paths', async () => {
    const imported = vi.fn(async () => ({ ok: true }))
    mockApi({
      capabilityList: async () => ({
        ok: true,
        items: [
          { id: 'e1', kind: 'expert' as const, name: '产品经理', description: '需求澄清', category: '办公', installed: true },
          { id: 'e2', kind: 'expert' as const, name: '测试专家', description: '质量', category: '研发', status: 'featured' },
        ],
      }),
      capabilityPickLocalFolder: async () => ({ ok: true, path: 'D:/pack' }),
      capabilityImport: imported,
    })
    await renderApp(<AppShell />)
    const hub = await screen.findByTestId('capability-hub-surface')
    await waitFor(() => expect(within(hub).getByRole('heading', { name: '产品经理' })).toBeInTheDocument())
    expect(within(hub).getByTestId('hub-chips')).toHaveTextContent('办公')
    expect(within(hub).getByTestId('hub-featured')).toHaveTextContent('测试专家')
    fireEvent.click(within(hub).getByRole('checkbox', { name: '只看已安装' }))
    expect(within(hub).queryByText('测试专家')).not.toBeInTheDocument()
    fireEvent.click(within(hub).getByRole('checkbox', { name: '只看已安装' }))
    fireEvent.click(within(hub).getByRole('heading', { name: '产品经理' }))
    const drawer = screen.getByTestId('hub-detail-drawer')
    expect(drawer).toHaveClass('secondary-dialog')
    expect(drawer).toHaveTextContent('已安装')
    expect(drawer).toHaveTextContent('添加到工作台')
    fireEvent.click(within(drawer).getByRole('button', { name: '关闭详情' }))
    fireEvent.click(within(hub).getByRole('tab', { name: '技能' }))
    fireEvent.click(within(hub).getByRole('button', { name: '添加能力' }))
    fireEvent.click(screen.getByRole('button', { name: '选择文件夹' }))
    await waitFor(() => expect(screen.getByTestId('hub-import-preview')).toBeInTheDocument())
    expect(imported).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('hub-import-confirm'))
    await waitFor(() => expect(imported).toHaveBeenCalledWith(expect.objectContaining({
      source: 'local',
      path: 'D:/pack',
      trustConfirmed: true,
    })))
  })

  it('opens hub picker for skills in expert dialog', async () => {
    mockApi({
      capabilityList: async () => catalog,
      sourcesList: async () => ({ sources: [{ id: 'src1', type: 'local', displayName: '本地资料' }] }),
    })
    await renderApp(<AppShell />)
    const hub = await screen.findByTestId('capability-hub-surface')
    await waitFor(() => expect(within(hub).getByRole('button', { name: '我的' })).toBeInTheDocument())
    fireEvent.click(within(hub).getByRole('button', { name: '我的' }))
    fireEvent.click(within(hub).getByRole('button', { name: '创建专家' }))
    expect(screen.getByRole('listbox', { name: '专家头像' })).toBeInTheDocument()
    expect(screen.getByLabelText('AgenticType')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('hub-open-picker-skills'))
    expect(screen.getByTestId('hub-picker-dialog')).toBeInTheDocument()
  })

  it('guides empty skill catalog instead of opening a picker', async () => {
    mockApi({
      capabilityList: async () => ({
        ok: true,
        items: catalog.items.filter((item) => item.kind !== 'skill'),
      }),
    })
    await renderApp(<AppShell />)
    const hub = await screen.findByTestId('capability-hub-surface')
    await waitFor(() => expect(within(hub).getByRole('button', { name: '我的' })).toBeInTheDocument())
    fireEvent.click(within(hub).getByRole('button', { name: '我的' }))
    fireEvent.click(within(hub).getByRole('button', { name: '创建专家' }))
    expect(screen.queryByTestId('hub-open-picker-skills')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '去安装技能' })).toBeInTheDocument()
  })

  it('blocks save when name is empty and highlights the field', async () => {
    const save = vi.fn(async () => ({ ok: true }))
    mockApi({ capabilityList: async () => catalog, expertSave: save })
    await renderApp(<AppShell />)
    const hub = await screen.findByTestId('capability-hub-surface')
    await waitFor(() => expect(within(hub).getByRole('button', { name: '我的' })).toBeInTheDocument())
    fireEvent.click(within(hub).getByRole('button', { name: '我的' }))
    fireEvent.click(within(hub).getByRole('button', { name: '创建专家' }))
    fireEvent.click(screen.getByRole('button', { name: '保存专家' }))
    expect(save).not.toHaveBeenCalled()
    expect(screen.getByText('请填写名称')).toBeInTheDocument()
  })

  it('saves a custom expert from the hub dialog', async () => {
    const save = vi.fn(async () => ({ ok: true }))
    mockApi({
      capabilityList: async () => catalog,
      expertSave: save,
    })
    await renderApp(<AppShell />)
    const hub = await screen.findByTestId('capability-hub-surface')
    await waitFor(() => expect(within(hub).getByRole('button', { name: '我的' })).toBeInTheDocument())
    fireEvent.click(within(hub).getByRole('button', { name: '我的' }))
    fireEvent.click(within(hub).getByRole('button', { name: '创建专家' }))
    fireEvent.change(screen.getByLabelText('专家名称'), { target: { value: '值班助手' } })
    fireEvent.click(screen.getByRole('button', { name: '保存专家' }))
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({
      name: '值班助手',
      description: '',
      agenticType: 'react',
    })))
  })
})
