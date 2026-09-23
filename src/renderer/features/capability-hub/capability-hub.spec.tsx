import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from '../../app/AppShell'
import { useAppStore } from '../../app/store'
import { mockApi, renderApp, resetAppStore } from '../../test/helpers'
import type { CapabilityItem } from '../../../shared/api'

const catalog = {
  ok: true,
  items: [
    { id: 'e1', kind: 'expert' as const, name: '产品经理', description: '需求澄清', category: '产品与研究' },
    { id: 's1', kind: 'skill' as const, name: '写纪要', description: '会议纪要', category: '办公' },
    { id: 'c1', kind: 'connector' as const, name: '飞书', description: 'lark-cli 连接器', category: '飞书' },
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
    const topNav = hub.querySelector('.hub-nav') as HTMLElement
    expect(within(topNav).getByRole('button', { name: '展开搜索' })).toBeInTheDocument()
    expect(within(hub).queryByRole('searchbox', { name: '搜索能力' })).not.toBeInTheDocument()
    expect(within(topNav).queryByRole('switch', { name: '只看已添加' })).not.toBeInTheDocument()
    expect(hub.querySelector('.hub-header .hub-search-wrap')).toBeNull()
    expect(hub.querySelector('.hub-nav-title')).toBeTruthy()
    expect(hub.querySelector('#hubBtnClose')).toBeNull()
    expect(within(hub).queryByRole('button', { name: '关闭' })).not.toBeInTheDocument()
    expect(within(hub).getByRole('button', { name: '我的专家' })).toBeInTheDocument()
    expect(within(hub).queryByRole('button', { name: '添加能力' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('hub-add-dialog')).not.toBeInTheDocument()
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

  it('keeps an empty capability list free of secondary add actions', async () => {
    mockApi({
      capabilityList: async (opts) => ({ ok: true, items: opts?.kind === 'expert' ? catalog.items.filter((item) => item.kind === 'expert') : [] }),
    })
    await renderApp(<AppShell />)
    const hub = await screen.findByTestId('capability-hub-surface')
    fireEvent.click(within(hub).getByRole('tab', { name: '技能' }))
    await waitFor(() => expect(within(hub).getByText('还没有技能')).toBeInTheDocument())
    expect(within(hub).queryByRole('button', { name: '添加能力' })).not.toBeInTheDocument()
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

  it('opens and focuses search from Ctrl K, then closes it with Escape', async () => {
    mockApi({ capabilityList: async () => catalog })
    await renderApp(<AppShell />)
    const hub = await screen.findByTestId('capability-hub-surface')
    expect(within(hub).queryByRole('searchbox', { name: '搜索能力' })).not.toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'k', code: 'KeyK', ctrlKey: true })
    const search = within(hub).getByRole('searchbox', { name: '搜索能力' })
    await waitFor(() => expect(search).toHaveFocus())
    expect(search.closest('.hub-search-panel')?.closest('.hub-nav')).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })
    expect(within(hub).queryByRole('searchbox', { name: '搜索能力' })).not.toBeInTheDocument()
    expect(within(hub).getByRole('button', { name: '展开搜索' })).toHaveFocus()
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

  it('shows route-specific readiness without hiding the expert details', async () => {
    mockApi({
      capabilityList: async () => ({
        ok: true,
        items: [{
          id: 'image-producer',
          kind: 'expert' as const,
          name: '生图执行专家',
          description: '视觉内容生产',
          category: '视觉创意',
          readiness: {
            state: 'ready' as const,
            routes: [
              { id: 'local-brief', label: '整理视觉 Brief', state: 'ready' as const, issues: [] },
              {
                id: 'pango-generate',
                label: '调用生图服务',
                state: 'limited' as const,
                issues: [{ code: 'route_skill_unavailable', message: '技能未安装或已停用: image-generate' }],
              },
            ],
          },
        }],
      }),
    })
    await renderApp(<AppShell />)
    const hub = await screen.findByTestId('capability-hub-surface')
    fireEvent.click(await within(hub).findByRole('button', { name: '查看详情：生图执行专家' }))
    const drawer = screen.getByTestId('hub-detail-drawer')
    expect(within(drawer).getByRole('region', { name: '专家执行路径' })).toHaveTextContent('整理视觉 Brief')
    expect(within(drawer).getByRole('region', { name: '专家执行路径' })).toHaveTextContent('调用生图服务')
    expect(within(drawer).getByRole('region', { name: '专家执行路径' })).toHaveTextContent('缺少依赖')
    expect(within(drawer).getByRole('region', { name: '专家执行路径' })).toHaveTextContent('缺失项只影响对应专项路径')
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
    const topNav = hub.querySelector('.hub-nav') as HTMLElement
    expect(within(topNav).getByRole('button', { name: '我的技能' })).toBeInTheDocument()
    expect(within(topNav).queryByRole('switch', { name: '只看已安装' })).not.toBeInTheDocument()
    expect(within(hub).getByTestId('hub-chips')).toHaveTextContent('产品与研究')
    expect(within(hub).getByTestId('hub-chips')).toHaveTextContent('软件研发')
    expect(within(hub).queryByText('精选')).not.toBeInTheDocument()
    expect(within(hub).queryByText('能力目录')).not.toBeInTheDocument()
  })

  it('shows installed skills in My Skills using the same management pattern as My Experts', async () => {
    const update = vi.fn(async () => ({ ok: true }))
    const uninstall = vi.fn(async () => ({ ok: true }))
    const skills = [
      { id: 'installed-skill', kind: 'skill' as const, name: '已添加技能', description: '用于管理', category: '日常办公', source: 'curated', installed: true, enabled: true },
      { id: 'catalog-skill', kind: 'skill' as const, name: '技能库条目', description: '尚未添加', category: '日常办公', source: 'curated' },
    ]
    mockApi({
      capabilityList: async (opts) => ({
        ok: true,
        items: opts?.kind === 'skill' ? skills : [],
      }),
      capabilityUpdate: update,
      capabilityUninstall: uninstall,
    })
    await renderApp(<AppShell />)
    const hub = await screen.findByTestId('capability-hub-surface')
    fireEvent.click(within(hub).getByRole('tab', { name: '技能' }))
    await waitFor(() => expect(within(hub).getByRole('heading', { name: '技能库条目' })).toBeInTheDocument())

    const mySkills = within(hub).getByRole('button', { name: '我的技能' })
    fireEvent.click(mySkills)

    await waitFor(() => expect(within(hub).queryByRole('heading', { name: '技能库条目' })).not.toBeInTheDocument())
    expect(mySkills).toHaveAttribute('aria-pressed', 'true')
    expect(within(hub).getByRole('heading', { name: '我的技能' })).toBeInTheDocument()
    expect(within(hub).getByText('你添加的技能')).toBeInTheDocument()
    expect(within(hub).getByRole('button', { name: '新建技能' })).toBeInTheDocument()
    expect(within(hub).getByRole('button', { name: '管理我的技能：已添加技能' })).toBeInTheDocument()

    fireEvent.click(within(hub).getByRole('button', { name: '管理我的技能：已添加技能' }))
    const drawer = screen.getByTestId('hub-detail-drawer')
    expect(within(drawer).getByText('新会话默认启用')).toBeInTheDocument()
    expect(within(drawer).getByRole('button', { name: '优化与评估' })).toBeInTheDocument()
    fireEvent.click(within(drawer).getByRole('button', { name: '更新技能' }))
    await waitFor(() => expect(update).toHaveBeenCalledWith({ id: 'installed-skill' }))
    fireEvent.click(within(drawer).getByRole('button', { name: '卸载技能' }))
    await waitFor(() => expect(uninstall).toHaveBeenCalledWith({ id: 'installed-skill' }))
    await waitFor(() => expect(screen.queryByTestId('hub-detail-drawer')).not.toBeInTheDocument())
  })

  it('opens the Agent and Skill governance expert instead of a direct Skill form', async () => {
    const installOperations = vi.fn(async () => ({ ok: true }))
    const createTask = vi.fn(async () => ({ ok: true, task: { id: 'task-skill-create-1', status: 'draft' } }))
    mockApi({
      capabilityList: async () => ({ ok: true, items: [] }),
      capabilityInstall: installOperations,
      workbenchTaskCreate: createTask,
    })
    await renderApp(<AppShell />)
    const hub = await screen.findByTestId('capability-hub-surface')
    fireEvent.click(within(hub).getByRole('tab', { name: '技能' }))
    fireEvent.click(within(hub).getByRole('button', { name: '我的技能' }))
    fireEvent.click(await within(hub).findByRole('button', { name: '新建技能' }))

    await waitFor(() => expect(installOperations).toHaveBeenCalledWith({ id: 'agent-operations', kind: 'expert' }))
    expect(screen.queryByRole('dialog', { name: '创建技能' })).not.toBeInTheDocument()
    expect(createTask).toHaveBeenCalledWith(expect.objectContaining({
      title: '创建新的 Skill',
      expertId: 'agent-operations',
      expertName: '能力管家',
      status: 'draft',
    }))
    await waitFor(() => expect(useAppStore.getState().expertRoom).toEqual(expect.objectContaining({
      taskId: 'task-skill-create-1',
      expertId: 'agent-operations',
        name: '能力管家',
    })))
    expect(useAppStore.getState().route).toBe('workbench')
    expect(useAppStore.getState().workbenchSurface).toBe('run')
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
    await waitFor(() => expect(within(hub).getByRole('button', { name: '查看详情：写纪要' })).toBeInTheDocument())
    expect(within(hub).queryByRole('button', { name: '查看并安装：写纪要' })).not.toBeInTheDocument()
    expect(within(hub).queryByRole('button', { name: '管理技能：写纪要' })).not.toBeInTheDocument()
    fireEvent.click(within(hub).getByRole('button', { name: '查看详情：写纪要' }))
    const drawer = screen.getByTestId('hub-detail-drawer')
    expect(drawer).toHaveTextContent('写纪要')
    fireEvent.click(within(drawer).getByRole('button', { name: '安装' }))
    await waitFor(() => expect(install).toHaveBeenCalledWith({ id: 's1', kind: 'skill' }))
    await waitFor(() => expect(within(screen.getByTestId('hub-detail-drawer')).getByText('新会话默认启用')).toBeInTheDocument())
  })

  it('shows connector search and My Connectors beside the connector tab', async () => {
    const connectors = [
      { id: 'feishu', kind: 'connector' as const, name: '飞书', description: '办公协作连接器', category: '办公协作', source: 'curated', installed: true, enabled: true },
      { id: 'gitlab', kind: 'connector' as const, name: 'GitLab', description: '代码托管连接器', category: '研发工具', source: 'curated' },
    ]
    mockApi({
      capabilityList: async (opts) => ({
        ok: true,
        items: opts?.kind === 'connector' ? connectors : [],
      }),
    })
    await renderApp(<AppShell />)
    const hub = await screen.findByTestId('capability-hub-surface')
    fireEvent.click(within(hub).getByRole('tab', { name: '连接器' }))
    await waitFor(() => expect(within(hub).getByRole('heading', { name: 'GitLab' })).toBeInTheDocument())

    const topNav = hub.querySelector('.hub-nav') as HTMLElement
    const myConnectors = within(topNav).getByRole('button', { name: '我的连接器' })
    expect(within(topNav).getByRole('button', { name: '展开搜索' })).toBeInTheDocument()
    expect(within(topNav).queryByRole('switch', { name: '只看已安装' })).not.toBeInTheDocument()
    expect(myConnectors.querySelector('[data-icon="network"]')).toBeTruthy()

    fireEvent.click(within(topNav).getByRole('button', { name: '展开搜索' }))
    const search = within(hub).getByRole('searchbox', { name: '搜索能力' })
    await waitFor(() => expect(search).toHaveFocus())
    fireEvent.change(search, { target: { value: 'GitLab' } })
    await waitFor(() => expect(within(hub).queryByRole('heading', { name: '飞书' })).not.toBeInTheDocument())
    expect(within(hub).getByRole('heading', { name: 'GitLab' })).toBeInTheDocument()

    fireEvent.change(search, { target: { value: '' } })
    fireEvent.click(myConnectors)
    await waitFor(() => expect(within(hub).queryByRole('heading', { name: 'GitLab' })).not.toBeInTheDocument())
    expect(myConnectors).toHaveAttribute('aria-pressed', 'true')
    expect(within(hub).getByRole('heading', { name: '我的连接器' })).toBeInTheDocument()
    expect(within(hub).getByText('你添加的连接器')).toBeInTheDocument()
    expect(within(hub).getByRole('button', { name: '管理我的连接器：飞书' })).toBeInTheDocument()
    expect(within(hub).queryByRole('button', { name: '新建连接器' })).not.toBeInTheDocument()
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
    fireEvent.click(await within(hub).findByRole('button', { name: '查看详情：Cocos Creator MCP' }))
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

  it('requires an explicit risk confirmation before summoning a high-risk expert', async () => {
    let installed = false
    const precheck = vi.fn(async () => ({
      ok: true,
      preview: {
        name: '数据靓仔',
        risk: {
          level: 'high',
          reasons: ['可访问公司数据服务', '飞书填表属于外部写入且必须逐次确认'],
        },
        permissions: { network: true, write: true, externalWrite: true },
        dependencies: { requiredIssues: [], optionalWarnings: [] },
        rollbackHint: '安装后可在能力详情中停用或卸载。',
      },
    }))
    const install = vi.fn(async () => {
      installed = true
      return { ok: true }
    })
    const bind = vi.fn(async () => ({ ok: true }))
    mockApi({
      capabilityList: async () => ({
        ok: true,
        items: [{
          id: 'operations-data-analyst',
          kind: 'expert' as const,
          name: '数据靓仔',
          description: '运营数据分析',
          category: '数据分析',
          source: 'curated',
          installed,
          enabled: installed,
          risk: { level: 'high', reasons: ['可访问公司数据服务'] },
          permissions: { network: true, write: true, externalWrite: true },
        }],
      }),
      capabilityInstallPrecheck: precheck,
      capabilityInstall: install,
      workbenchModeBindExpert: bind,
      workbenchModeList: async () => ({ ok: true, modes: [], activeModeId: '' }),
    })

    await renderApp(<AppShell />)
    const hub = await screen.findByTestId('capability-hub-surface')
    fireEvent.click(await within(hub).findByRole('button', { name: '查看详情：数据靓仔' }))
    fireEvent.click(within(screen.getByTestId('hub-detail-drawer')).getByRole('button', { name: '召唤专家' }))

    const confirmation = await screen.findByTestId('hub-summon-confirm')
    expect(precheck).toHaveBeenCalledWith({ id: 'operations-data-analyst', kind: 'expert' })
    expect(install).not.toHaveBeenCalled()
    expect(bind).not.toHaveBeenCalled()
    expect(confirmation).toHaveTextContent('可访问公司数据服务')
    expect(confirmation).toHaveTextContent('外部系统写入')

    fireEvent.click(within(confirmation).getByRole('button', { name: '确认风险并召唤' }))
    await waitFor(() => expect(install).toHaveBeenCalledWith({
      id: 'operations-data-analyst',
      kind: 'expert',
      riskConfirmed: true,
    }))
    expect(bind).toHaveBeenCalledWith({ expertId: 'operations-data-analyst' })
  })

  it('opens a private Agent detail drawer before entering maintenance', async () => {
    const items = [
      { id: 'e1', kind: 'expert' as const, name: '产品经理', description: '需求澄清', category: '办公', source: 'custom', installed: true },
      { id: 's1', kind: 'skill' as const, name: '写纪要', description: '会议纪要', category: '办公', installed: true },
      { id: 'c1', kind: 'connector' as const, name: '飞书', description: 'lark-cli 连接器', category: '飞书', installed: true },
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

  it('shows imported contract limitations and does not present a limited expert as executable', async () => {
    mockApi({
      capabilityList: async (opts) => ({
        ok: true,
        items: opts?.kind === 'expert'
          ? [{
              id: 'limited-expert',
              kind: 'expert' as const,
              name: '待修复专家',
              description: '导入包缺少执行合同',
              source: 'custom',
              installed: true,
              enabled: true,
              qualification: {
                state: 'limited' as const,
                issues: ['undeclared_connector_contract'],
                limitedSkills: ['image-generation'],
                assessedAtImport: true,
              },
            }]
          : [],
      }),
      expertGet: async () => ({ ok: true, expert: { id: 'limited-expert', name: '待修复专家' } }),
    })
    await renderApp(<AppShell />)
    const hub = await screen.findByTestId('capability-hub-surface')
    fireEvent.click(within(hub).getByRole('button', { name: '我的专家' }))
    fireEvent.click(await within(hub).findByRole('button', { name: '打开我的专家：待修复专家' }))

    const drawer = screen.getByTestId('hub-detail-drawer')
    expect(drawer).toHaveTextContent('能力受限')
    expect(drawer).toHaveTextContent('image-generation')
    expect(drawer).toHaveTextContent('undeclared_connector_contract')
    expect(within(drawer).getByRole('button', { name: '修复能力合同后再打开' })).toBeDisabled()
  })

  it('shows runtime dependency readiness before opening an installed expert', async () => {
    mockApi({
      capabilityList: async (opts) => ({
        ok: true,
        items: opts?.kind === 'expert'
          ? [{
              id: 'image-expert',
              kind: 'expert' as const,
              name: '生图专家',
              description: '生成图片',
              source: 'custom',
              installed: true,
              enabled: true,
              readiness: {
                state: 'limited' as const,
                items: [{ id: 'pango-image-mcp', kind: 'connector', required: true, status: 'limited', reason: '连接器未安装或已停用' }],
                issues: [{ code: 'unavailable_connector', dependency: { id: 'pango-image-mcp', kind: 'connector' }, message: '连接器未安装或已停用: pango-image-mcp' }],
              },
            }]
          : [],
      }),
      expertGet: async () => ({ ok: true, expert: { id: 'image-expert', name: '生图专家', description: '生成图片' } }),
    })
    await renderApp(<AppShell />)
    const hub = await screen.findByTestId('capability-hub-surface')
    fireEvent.click(within(hub).getByRole('button', { name: '我的专家' }))
    await waitFor(() => expect(within(hub).getByRole('heading', { name: '生图专家' })).toBeInTheDocument())
    expect(hub).toHaveTextContent('当前不可执行')
    fireEvent.click(within(hub).getByRole('button', { name: '打开我的专家：生图专家' }))

    const drawer = screen.getByTestId('hub-detail-drawer')
    expect(drawer).toHaveTextContent('当前不可执行')
    expect(drawer).toHaveTextContent('连接器：pango-image-mcp')
    expect(within(drawer).getByRole('button', { name: '完成依赖安装/授权后再打开' })).toBeDisabled()
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
    fireEvent.click(within(hub).getByRole('button', { name: '展开搜索' }))
    fireEvent.change(within(hub).getByLabelText('搜索能力'), { target: { value: '飞书' } })
    fireEvent.click(within(hub).getByRole('tab', { name: '连接器' }))
    await waitFor(() => {
      expect(within(hub).getByRole('heading', { name: '飞书' })).toBeInTheDocument()
    })
  })

  it('opens chips, featured and the detail drawer without an add-capability path', async () => {
    mockApi({
      capabilityList: async () => ({
        ok: true,
        items: [
          { id: 'e1', kind: 'expert' as const, name: '产品经理', description: '需求澄清', category: '产品与研究', source: 'curated', installed: true },
          { id: 'e2', kind: 'expert' as const, name: '测试专家', description: '质量', category: '软件研发', status: 'featured' },
        ],
      }),
    })
    await renderApp(<AppShell />)
    const hub = await screen.findByTestId('capability-hub-surface')
    await waitFor(() => expect(within(hub).getByRole('heading', { name: '产品经理' })).toBeInTheDocument())
    expect(within(hub).getByTestId('hub-chips')).toHaveTextContent('产品与研究')
    expect(within(hub).getByTestId('hub-featured')).toHaveTextContent('测试专家')
    expect(within(hub).queryByRole('switch', { name: '只看已添加' })).not.toBeInTheDocument()
    expect(hub.querySelector('.hub-badge.official[aria-label="官方"]')).toBeTruthy()
    expect(hub.querySelector('.hub-badge.verified')).toBeFalsy()
    fireEvent.click(within(hub).getByRole('heading', { name: '产品经理' }))
    const drawer = screen.getByTestId('hub-detail-drawer')
    expect(drawer).toHaveClass('secondary-dialog')
    expect(drawer.querySelector('.hub-badge.installed.icon-only[aria-label="已添加"]')).toBeTruthy()
    expect(within(drawer).getByRole('button', { name: '已召唤' })).toBeDisabled()
    fireEvent.click(within(drawer).getByRole('button', { name: '关闭详情' }))
    expect(within(hub).queryByRole('button', { name: '添加能力' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('hub-add-dialog')).not.toBeInTheDocument()
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
    expect(screen.queryByRole('listbox', { name: '专家头像' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '选择头像' }))
    expect(screen.getByRole('listbox', { name: '专家头像' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('option', { name: '游戏制作' }))
    expect(screen.queryByRole('listbox', { name: '专家头像' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '更换头像，当前游戏制作' })).toBeInTheDocument()
    expect(screen.queryByLabelText('AgenticType')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '创建专家' })).toBeInTheDocument()
    expect(screen.queryByText('这里只建立草稿')).not.toBeInTheDocument()
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
    mockApi({ capabilityList: async () => catalog, agentRegistryDraftSave: save })
    await renderApp(<AppShell />)
    const hub = await screen.findByTestId('capability-hub-surface')
    await waitFor(() => expect(within(hub).getByRole('button', { name: '我的专家' })).toBeInTheDocument())
    fireEvent.click(within(hub).getByRole('button', { name: '我的专家' }))
    fireEvent.click(within(hub).getByRole('button', { name: '创建专家' }))
    fireEvent.click(screen.getByRole('button', { name: '保存并调优' }))
    expect(save).not.toHaveBeenCalled()
    expect(screen.getByText('请填写名称')).toBeInTheDocument()
  })

  it('saves an expert draft and opens the Agent Ops collaboration room', async () => {
    const saveDraft = vi.fn(async () => ({ ok: true }))
    const installOperations = vi.fn(async () => ({ ok: true }))
    const createTask = vi.fn(async (payload) => ({
      ok: true,
      task: { id: 'task-agent-ops-1', status: String(payload?.status || 'draft') },
    }))
    mockApi({
      capabilityList: async () => catalog,
      agentRegistryDraftSave: saveDraft,
      capabilityInstall: installOperations,
      workbenchTaskCreate: createTask,
      workbenchTaskList: async () => ({ items: [] }),
    })
    await renderApp(<AppShell />)
    const hub = await screen.findByTestId('capability-hub-surface')
    await waitFor(() => expect(within(hub).getByRole('button', { name: '我的专家' })).toBeInTheDocument())
    fireEvent.click(within(hub).getByRole('button', { name: '我的专家' }))
    fireEvent.click(within(hub).getByRole('button', { name: '创建专家' }))
    fireEvent.change(screen.getByLabelText('专家名称'), { target: { value: '值班助手' } })
    fireEvent.change(screen.getByLabelText('专家 persona'), { target: { value: '负责汇总值班信息并标记风险' } })
    fireEvent.change(screen.getByLabelText('主要场景'), { target: { value: '生成交接摘要' } })
    fireEvent.change(screen.getByLabelText('能力边界'), { target: { value: '不替代负责人做事故定级' } })
    fireEvent.change(screen.getByLabelText('主要输入'), { target: { value: '值班记录' } })
    fireEvent.change(screen.getByLabelText('预期交付物'), { target: { value: '结构化交接报告' } })
    fireEvent.click(screen.getByRole('button', { name: '保存并调优' }))

    await waitFor(() => expect(saveDraft).toHaveBeenCalledWith(expect.objectContaining({
      intent: 'create',
      draft: expect.objectContaining({
        name: '值班助手',
        description: '负责汇总值班信息并标记风险',
        avatar: '',
        useCases: ['生成交接摘要'],
        boundaries: ['不替代负责人做事故定级'],
      }),
    })))
    expect(createTask).toHaveBeenCalledWith(expect.objectContaining({
      expertId: 'agent-operations',
      expertName: '能力管家',
      status: 'draft',
    }))
    expect(installOperations).toHaveBeenCalledWith({ id: 'agent-operations', kind: 'expert' })
    await waitFor(() => expect(useAppStore.getState().expertRoom).toEqual(expect.objectContaining({
      taskId: 'task-agent-ops-1',
      expertId: 'agent-operations',
        name: '能力管家',
    })))
    expect(useAppStore.getState().route).toBe('workbench')
    expect(useAppStore.getState().workbenchSurface).toBe('run')
  })

  it('keeps the saved draft recoverable when Agent Ops installation fails', async () => {
    const saveDraft = vi.fn(async () => ({ ok: true }))
    const createTask = vi.fn()
    mockApi({
      capabilityList: async () => catalog,
      agentRegistryDraftSave: saveDraft,
      capabilityInstall: async () => ({ ok: false, error: '能力管家依赖安装失败' }),
      workbenchTaskCreate: createTask,
    })
    await renderApp(<AppShell />)
    const hub = await screen.findByTestId('capability-hub-surface')
    await waitFor(() => expect(within(hub).getByRole('button', { name: '我的专家' })).toBeInTheDocument())
    fireEvent.click(within(hub).getByRole('button', { name: '我的专家' }))
    fireEvent.click(within(hub).getByRole('button', { name: '创建专家' }))
    fireEvent.change(screen.getByLabelText('专家名称'), { target: { value: '风险助手' } })
    fireEvent.change(screen.getByLabelText('专家 persona'), { target: { value: '负责识别项目风险并形成核查清单' } })
    fireEvent.change(screen.getByLabelText('主要场景'), { target: { value: '项目风险审查' } })
    fireEvent.change(screen.getByLabelText('能力边界'), { target: { value: '不代替负责人审批' } })
    fireEvent.change(screen.getByLabelText('主要输入'), { target: { value: '项目计划' } })
    fireEvent.change(screen.getByLabelText('预期交付物'), { target: { value: '风险清单' } })
    fireEvent.click(screen.getByRole('button', { name: '保存并调优' }))

    await waitFor(() => expect(screen.getByText('能力管家依赖安装失败')).toBeInTheDocument())
    expect(saveDraft).toHaveBeenCalledTimes(1)
    expect(createTask).not.toHaveBeenCalled()
    expect(screen.getByTestId('hub-expert-dialog')).toBeInTheDocument()
  })
})
