import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from '../../app/AppShell'
import { useAppStore } from '../../app/store'
import { mockApi, renderApp, resetAppStore } from '../../test/helpers'

const catalog = {
  ok: true,
  items: [
    { id: 'e1', kind: 'expert' as const, name: '产品经理', description: '需求澄清', category: '产品与研究' },
    { id: 's1', kind: 'skill' as const, name: '写纪要', description: '会议纪要', category: '办公' },
    { id: 'c1', kind: 'connector' as const, name: '飞书 MCP', description: 'IM 连接器', category: '飞书' },
  ],
}

describe('capability hub overlay', () => {
  beforeEach(() => {
    resetAppStore()
    window.sessionStorage.clear()
    useAppStore.setState({ route: 'capabilities' })
  })
  afterEach(() => {
    window.sessionStorage.clear()
    cleanup()
  })

  it('lists experts by default with tabs for expert, skill and connector', async () => {
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
    expect(within(hub).getByRole('button', { name: '我的专家' })).toBeInTheDocument()
    expect(within(hub).getAllByRole('button', { name: '添加能力' })).toHaveLength(1)
    const addButton = within(hub).getByRole('button', { name: '添加能力' })
    expect(addButton.closest('.hub-nav')).toBeTruthy()
    expect(addButton).toHaveAttribute('title', '添加能力')
    expect(addButton).toHaveAttribute('data-tooltip', '添加能力')
    expect(addButton.querySelector('[data-icon="component"]')).toBeTruthy()
    expect(hub.querySelector('.hub-command-actions #hubBtnAdd')).toBeNull()
    expect(within(hub).queryByRole('group', { name: '专家来源' })).not.toBeInTheDocument()
    expect(within(hub).queryByRole('button', { name: '官方' })).not.toBeInTheDocument()
    expect(within(hub).queryByText('精选')).not.toBeInTheDocument()
    expect(within(hub).getByRole('heading', { name: '精选推荐' })).toBeInTheDocument()
    expect(within(hub).queryByText('能力目录')).not.toBeInTheDocument()
    expect(within(hub).getByTestId('hub-featured')).not.toHaveTextContent('产品与研究')
    expect(within(hub).getByTestId('hub-featured').querySelector('.hub-featured-arrow')).toBeNull()
    expect(within(hub).queryByText('写纪要')).not.toBeInTheDocument()
    expect(within(hub).queryByText('分类')).not.toBeInTheDocument()
  })

  it('keeps the import entry in the top bar when a capability list is empty', async () => {
    mockApi({
      capabilityList: async (opts) => ({ ok: true, items: opts?.kind === 'expert' ? catalog.items.filter((item) => item.kind === 'expert') : [] }),
    })
    await renderApp(<AppShell />)
    const hub = await screen.findByTestId('capability-hub-surface')
    fireEvent.click(within(hub).getByRole('tab', { name: '技能' }))
    await waitFor(() => expect(within(hub).getByText('还没有技能')).toBeInTheDocument())
    expect(within(hub).getAllByRole('button', { name: '添加能力' })).toHaveLength(1)
    expect(hub.querySelector('.hub-state .hub-btn')).toBeNull()
  })

  it('filters experts by 收藏 and places the favorite control beside status badges', async () => {
    const experts = [
      { id: 'e1', kind: 'expert' as const, name: '已收藏专家', description: '收藏项', category: '办公', favorite: true, installed: true, source: 'curated' },
      { id: 'e2', kind: 'expert' as const, name: '未收藏专家', description: '普通项', category: '办公', favorite: false, source: 'curated' },
    ]
    mockApi({ capabilityList: async (opts) => ({ ok: true, items: opts?.kind === 'expert' ? experts : [] }) })
    await renderApp(<AppShell />)
    const hub = await screen.findByTestId('capability-hub-surface')
    await waitFor(() => expect(within(hub).getByRole('heading', { name: '已收藏专家' })).toBeInTheDocument())

    const chips = within(hub).getByTestId('hub-chips')
    fireEvent.click(within(chips).getByRole('button', { name: '收藏' }))
    await waitFor(() => expect(within(hub).queryByRole('heading', { name: '未收藏专家' })).not.toBeInTheDocument())
    expect(hub.querySelector('.hub-card-version')).toBeNull()
    expect(hub.querySelector('.hub-card-foot-actions .hub-card-fav')).toBeTruthy()
    expect(hub.querySelector('.hub-badge.installed.icon-only[aria-label="已添加"]')).toBeTruthy()
    expect(hub.querySelector('.hub-badge.installed [data-icon="wrench"]')).toBeTruthy()
  })

  it('shows three featured cards first and expands the remaining recommendations', async () => {
    const items = Array.from({ length: 4 }, (_, index) => ({
      id: `e${index + 1}`,
      kind: 'expert' as const,
      name: `推荐专家${index + 1}`,
      description: '精选能力',
      category: '办公',
    }))
    mockApi({ capabilityList: async () => ({ ok: true, items }) })
    await renderApp(<AppShell />)
    const hub = await screen.findByTestId('capability-hub-surface')
    const featured = within(hub).getByTestId('hub-featured')
    expect(within(featured).getAllByRole('button', { name: /查看精选推荐：/ })).toHaveLength(3)
    fireEvent.click(within(featured).getByRole('button', { name: '展开更多（1）' }))
    expect(within(featured).getAllByRole('button', { name: /查看精选推荐：/ })).toHaveLength(4)
    fireEvent.click(within(featured).getByRole('button', { name: '收起推荐' }))
    expect(within(featured).getAllByRole('button', { name: /查看精选推荐：/ })).toHaveLength(3)
  })

  it('focuses search from Ctrl K', async () => {
    mockApi({ capabilityList: async () => catalog })
    await renderApp(<AppShell />)
    const hub = await screen.findByTestId('capability-hub-surface')
    const search = within(hub).getByRole('searchbox', { name: '搜索能力' })
    fireEvent.keyDown(document, { key: 'k', code: 'KeyK', ctrlKey: true })
    expect(search).toHaveFocus()
  })

  it('opens an expert card as a visible fixed detail dialog', async () => {
    mockApi({ capabilityList: async () => catalog })
    await renderApp(<AppShell />)
    const hub = await screen.findByTestId('capability-hub-surface')
    const card = await within(hub).findByRole('button', { name: '查看详情：产品经理' })
    fireEvent.click(card)
    const drawer = screen.getByTestId('hub-detail-drawer')
    expect(drawer).toBeVisible()
    expect(drawer).toHaveAttribute('role', 'dialog')
    expect(drawer).toHaveClass('secondary-dialog', 'open')
    expect(screen.getByTestId('hub-detail-drawer-backdrop')).toHaveClass('secondary-dialog-mask', 'open')
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
    expect(within(hub).getByTestId('hub-chips')).toHaveTextContent('产品与研究')
    expect(within(hub).getByTestId('hub-chips')).toHaveTextContent('软件研发')
    expect(within(hub).queryByText('精选')).not.toBeInTheDocument()
    expect(within(hub).queryByText('能力目录')).not.toBeInTheDocument()
  })

  it('opens a skill from its visible action and completes install management', async () => {
    let installed = false
    const install = vi.fn(async () => {
      installed = true
      return { ok: true }
    })
    mockApi({
      capabilityList: async (opts) => ({
        ok: true,
        items: catalog.items
          .filter((item) => item.kind === opts?.kind)
          .map((item) => item.id === 's1' ? { ...item, installed, enabled: installed } : item),
      }),
      capabilityInstall: install,
    })
    await renderApp(<AppShell />)
    const hub = await screen.findByTestId('capability-hub-surface')
    fireEvent.click(within(hub).getByRole('tab', { name: '技能' }))
    await waitFor(() => expect(within(hub).getByRole('button', { name: '查看并安装：写纪要' })).toBeInTheDocument())
    fireEvent.click(within(hub).getByRole('button', { name: '查看并安装：写纪要' }))
    const drawer = screen.getByTestId('hub-detail-drawer')
    expect(drawer).toHaveTextContent('写纪要')
    fireEvent.click(within(drawer).getByRole('button', { name: '安装' }))
    await waitFor(() => expect(install).toHaveBeenCalledWith({ id: 's1', kind: 'skill' }))
    await waitFor(() => expect(within(screen.getByTestId('hub-detail-drawer')).getByLabelText('在新会话中使用')).toBeInTheDocument())
  })

  it('configures, tests and authorizes an installed MCP connector in the hub', async () => {
    const upsert = vi.fn(async () => ({ ok: true }))
    const setSecrets = vi.fn(async () => ({ ok: true }))
    const setAllowlist = vi.fn(async () => ({ ok: true }))
    mockApi({
      capabilityList: async (opts) => ({
        ok: true,
        items: opts?.kind === 'connector' ? [{
          id: 'cocos-creator-mcp', kind: 'connector' as const, name: 'Cocos Creator MCP',
          description: 'Creator 编辑器连接器', category: '游戏研发', installed: true, enabled: true,
        }] : [],
      }),
      connectorsList: async () => ({ connectors: [{
        id: 'cocos-creator-mcp', title: 'Cocos Creator MCP', type: 'mcp', enabled: true,
        mcp: { transport: 'sse', url: 'http://127.0.0.1:3103/sse' },
        secretSlots: [{ key: 'access_token', label: 'Access Token', required: true, configured: false }],
      }] }),
      connectorsReferences: async () => ({ ok: true, references: [{ id: 'psd-flow', kind: 'workflow', name: 'PSD 工作流', required: true }] }),
      connectorsStatus: async () => ({ ok: true, connector: { id: 'cocos-creator-mcp', status: { ok: true, state: 'online', message: 'MCP 在线' } } }),
      connectorsTools: async () => ({ ok: true, availableTools: [{ rawName: 'get_editor_context', description: '读取编辑器状态', selected: false }] }),
      connectorsUpsert: upsert,
      connectorsSetSecrets: setSecrets,
      connectorsSetAllowlist: setAllowlist,
    })
    await renderApp(<AppShell />)
    const hub = await screen.findByTestId('capability-hub-surface')
    fireEvent.click(within(hub).getByRole('tab', { name: '连接器' }))
    fireEvent.click(await within(hub).findByRole('button', { name: '管理连接器：Cocos Creator MCP' }))
    const manager = await screen.findByTestId('hub-connector-manager')
    expect(within(manager).getByLabelText('传输方式')).toHaveValue('sse')
    expect(within(manager).getByText(/PSD 工作流/)).toBeInTheDocument()
    fireEvent.change(within(manager).getByLabelText('Access Token（必填）'), { target: { value: 'secret-once' } })
    fireEvent.click(within(manager).getByRole('button', { name: '保存配置' }))
    await waitFor(() => expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ id: 'cocos-creator-mcp' })))
    expect(setSecrets).toHaveBeenCalledWith('cocos-creator-mcp', { access_token: 'secret-once' })
    fireEvent.click(within(manager).getByRole('button', { name: '测试连接' }))
    await waitFor(() => expect(within(manager).getByRole('status')).toHaveTextContent('MCP 在线'))
    fireEvent.click(within(manager).getByRole('button', { name: '发现工具' }))
    const tool = await within(manager).findByRole('checkbox')
    fireEvent.click(tool)
    fireEvent.click(within(manager).getByRole('button', { name: '保存工具授权' }))
    await waitFor(() => expect(setAllowlist).toHaveBeenCalledWith('cocos-creator-mcp', ['get_editor_context']))
  })

  it('adds a catalog expert to My Experts and the workbench in one action', async () => {
    let installed = false
    const install = vi.fn(async () => {
      installed = true
      return { ok: true }
    })
    const bind = vi.fn(async () => ({ ok: true }))
    mockApi({
      capabilityList: async () => ({
        ok: true,
        items: [{
          id: 'e1',
          kind: 'expert' as const,
          name: '产品经理',
          description: '需求澄清',
          category: '产品与研究',
          source: 'curated',
          installed,
          enabled: installed,
        }],
      }),
      capabilityInstall: install,
      workbenchModeBindExpert: bind,
      workbenchModeList: async () => ({
        ok: true,
        modes: [{ id: 'office', name: '办公', bindings: [{ expertId: 'e1' }] }],
        activeModeId: 'office',
      }),
    })
    await renderApp(<AppShell />)
    const hub = await screen.findByTestId('capability-hub-surface')
    await waitFor(() => expect(within(hub).getByRole('button', { name: '查看详情：产品经理' })).toBeInTheDocument())
    fireEvent.click(within(hub).getByRole('button', { name: '查看详情：产品经理' }))
    fireEvent.click(within(screen.getByTestId('hub-detail-drawer')).getByRole('button', { name: '召唤专家' }))
    await waitFor(() => expect(install).toHaveBeenCalledWith({ id: 'e1', kind: 'expert' }))
    expect(bind).toHaveBeenCalledWith({ expertId: 'e1' })
    await waitFor(() => expect(screen.getByTestId('expert-detail')).toBeInTheDocument())
    expect(screen.getByRole('heading', { name: '产品经理' })).toBeInTheDocument()
  })

  it('opens a private Agent detail drawer before entering maintenance', async () => {
    const items = [
      { id: 'e1', kind: 'expert' as const, name: '产品经理', description: '需求澄清', category: '办公', source: 'custom', installed: true },
      { id: 's1', kind: 'skill' as const, name: '写纪要', description: '会议纪要', category: '办公', installed: true },
      { id: 'c1', kind: 'connector' as const, name: '飞书 MCP', description: 'IM 连接器', category: '飞书', installed: true },
    ]
    mockApi({
      capabilityList: async (opts) => ({ ok: true, items: items.filter((item) => item.kind === opts?.kind) }),
      expertGet: async () => ({
        ok: true,
        expert: { id: 'e1', name: '产品经理', description: '需求澄清', skills: ['s1'], connectors: ['c1'] },
      }),
    })
    await renderApp(<AppShell />)
    const hub = await screen.findByTestId('capability-hub-surface')
    await waitFor(() => expect(within(hub).getByRole('button', { name: '我的专家' })).toBeInTheDocument())
    fireEvent.click(within(hub).getByRole('button', { name: '我的专家' }))
    await waitFor(() => expect(within(hub).getByRole('button', { name: '打开我的专家：产品经理' })).toBeInTheDocument())
    fireEvent.click(within(hub).getByRole('button', { name: '打开我的专家：产品经理' }))
    const drawer = screen.getByTestId('hub-detail-drawer')
    expect(drawer).toHaveTextContent('打开我的专家')
    fireEvent.click(within(drawer).getByRole('button', { name: '编辑' }))
    expect(screen.getByRole('dialog', { name: '调优专家' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('hub-open-picker-skills')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('hub-open-picker-skills'))
    expect(screen.getByTestId('hub-picker-dialog')).toHaveTextContent('写纪要')
    fireEvent.click(within(screen.getByTestId('hub-picker-dialog')).getByRole('button', { name: '取消' }))
    await waitFor(() => expect(screen.getByTestId('hub-open-picker-connectors')).toBeInTheDocument())
  })

  it('opens an unbound My Expert in workbench collaboration from its detail drawer', async () => {
    mockApi({
      capabilityList: async (opts) => ({
        ok: true,
        items: opts?.kind === 'expert'
          ? [{ id: 'e1', kind: 'expert' as const, name: '办公写作专家', description: '整理办公材料', source: 'custom', installed: true }]
          : [],
      }),
      expertGet: async () => ({ ok: true, expert: { id: 'e1', name: '办公写作专家', description: '整理办公材料' } }),
    })
    await renderApp(<AppShell />)
    const hub = await screen.findByTestId('capability-hub-surface')
    fireEvent.click(within(hub).getByRole('button', { name: '我的专家' }))
    fireEvent.click(within(hub).getByRole('button', { name: '打开我的专家：办公写作专家' }))
    fireEvent.click(within(screen.getByTestId('hub-detail-drawer')).getByRole('button', { name: '打开我的专家' }))
    await waitFor(() => expect(screen.getByTestId('expert-detail')).toBeInTheDocument())
    expect(screen.getByRole('heading', { name: '办公写作专家' })).toBeInTheDocument()
  })

  it('updates or uninstalls an installed curated expert from its detail drawer', async () => {
    const update = vi.fn(async () => ({ ok: true }))
    const uninstall = vi.fn(async () => ({ ok: true }))
    mockApi({
      capabilityList: async () => ({
        ok: true,
        items: [{
          id: 'external-capability-importer',
          kind: 'expert' as const,
          name: '智能体运维专员',
          description: '导入外部项目能力',
          source: 'curated',
          installed: true,
          enabled: true,
        }],
      }),
      capabilityUpdate: update,
      capabilityUninstall: uninstall,
    })
    await renderApp(<AppShell />)
    const hub = await screen.findByTestId('capability-hub-surface')
    fireEvent.click(await within(hub).findByRole('button', { name: '查看详情：智能体运维专员' }))
    const drawer = screen.getByTestId('hub-detail-drawer')
    fireEvent.click(within(drawer).getByRole('button', { name: '更新专家' }))
    await waitFor(() => expect(update).toHaveBeenCalledWith({ id: 'external-capability-importer' }))
    fireEvent.click(within(drawer).getByRole('button', { name: '卸载专家' }))
    await waitFor(() => expect(uninstall).toHaveBeenCalledWith({ id: 'external-capability-importer' }))
    await waitFor(() => expect(screen.queryByTestId('hub-detail-drawer')).not.toBeInTheDocument())
  })

  it('filters hub cards by search query', async () => {
    mockApi({ capabilityList: async () => catalog })
    await renderApp(<AppShell />)
    const hub = await screen.findByTestId('capability-hub-surface')
    await waitFor(() => expect(within(hub).getByRole('heading', { name: '产品经理' })).toBeInTheDocument())
    fireEvent.change(within(hub).getByLabelText('搜索能力'), { target: { value: '飞书' } })
    fireEvent.click(within(hub).getByRole('tab', { name: '连接器' }))
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
          { id: 'e1', kind: 'expert' as const, name: '产品经理', description: '需求澄清', category: '产品与研究', source: 'curated', installed: true },
          { id: 'e2', kind: 'expert' as const, name: '测试专家', description: '质量', category: '软件研发', status: 'featured' },
        ],
      }),
      capabilityPickLocalFolder: async () => ({ ok: true, path: 'D:/pack' }),
      capabilityImport: imported,
    })
    await renderApp(<AppShell />)
    const hub = await screen.findByTestId('capability-hub-surface')
    await waitFor(() => expect(within(hub).getByRole('heading', { name: '产品经理' })).toBeInTheDocument())
    expect(within(hub).getByTestId('hub-chips')).toHaveTextContent('产品与研究')
    expect(within(hub).getByTestId('hub-featured')).toHaveTextContent('测试专家')
    fireEvent.click(within(hub).getByRole('checkbox', { name: '只看已添加' }))
    expect(within(hub).queryByText('测试专家')).not.toBeInTheDocument()
    fireEvent.click(within(hub).getByRole('checkbox', { name: '只看已添加' }))
    expect(hub.querySelector('.hub-badge.verified.icon-only[aria-label="认证"]')).toBeTruthy()
    expect(hub.querySelector('.hub-badge.verified [data-icon="badgeCheck"]')).toBeTruthy()
    fireEvent.click(within(hub).getByRole('heading', { name: '产品经理' }))
    const drawer = screen.getByTestId('hub-detail-drawer')
    expect(drawer).toHaveClass('secondary-dialog')
    expect(drawer.querySelector('.hub-badge.installed.icon-only[aria-label="已添加"]')).toBeTruthy()
    expect(within(drawer).getByRole('button', { name: '已召唤' })).toBeDisabled()
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
    await waitFor(() => expect(within(hub).getByRole('button', { name: '我的专家' })).toBeInTheDocument())
    fireEvent.click(within(hub).getByRole('button', { name: '我的专家' }))
    expect(within(hub).getByText('你拥有的私人 Agent')).toBeInTheDocument()
    expect(within(hub).getByText(/只有你能管理和使用/)).toBeInTheDocument()
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
    await waitFor(() => expect(within(hub).getByRole('button', { name: '我的专家' })).toBeInTheDocument())
    fireEvent.click(within(hub).getByRole('button', { name: '我的专家' }))
    fireEvent.click(within(hub).getByRole('button', { name: '创建专家' }))
    expect(screen.queryByTestId('hub-open-picker-skills')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '去安装技能' })).toBeInTheDocument()
  })

  it('blocks save when name is empty and highlights the field', async () => {
    const save = vi.fn(async () => ({ ok: true }))
    mockApi({ capabilityList: async () => catalog, expertSave: save })
    await renderApp(<AppShell />)
    const hub = await screen.findByTestId('capability-hub-surface')
    await waitFor(() => expect(within(hub).getByRole('button', { name: '我的专家' })).toBeInTheDocument())
    fireEvent.click(within(hub).getByRole('button', { name: '我的专家' }))
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
    await waitFor(() => expect(within(hub).getByRole('button', { name: '我的专家' })).toBeInTheDocument())
    fireEvent.click(within(hub).getByRole('button', { name: '我的专家' }))
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
