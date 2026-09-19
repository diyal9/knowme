import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkbenchTask } from '../../../shared/api'
import { mockApi, resetAppStore } from '../../test/helpers'
import { useAppStore } from '../../app/store'
import { ExpertTaskCapabilities } from './ExpertTaskCapabilities'
import { HubDetailDrawer } from '../capability-hub/HubDetailDrawer'

beforeEach(() => resetAppStore())
afterEach(cleanup)

const expert = { id: 'software-engineer', kind: 'expert' as const, name: '软件开发工程师', skills: ['code-review'], connectors: ['feishu'], status: 'enabled', permissions: { network: false, tools: { allowlist: [] } }, risk: { level: 'low' } }

describe('expert display regressions', () => {
  it.each(['pending', 'accepted'])('keeps the confirmed delivery contract for %s text deliverables', acceptanceStatus => {
    mockApi()
    const task = { id: 'display-task', expertId: expert.id, status: 'review', brief: { deliverables: [{ id: 'primary', title: '代码审查结论' }] }, deliverables: [{ deliverableId: 'primary', title: '代码审查结论', type: 'answer', acceptanceStatus }] } as WorkbenchTask
    render(<ExpertTaskCapabilities task={task} stageLabel="等待验收" goal="审查代码" sop="" />)
    expect(screen.getByLabelText('本次委托：等待验收')).toHaveTextContent('代码审查结论')
    expect(screen.queryByText('确认计划后锁定')).not.toBeInTheDocument()
  })

  it('resolves cross-kind dependency names and installation actions from an expert-only catalog', async () => {
    useAppStore.setState({ hubItems: [expert] })
    mockApi({ capabilityList: async options => ({ ok: true, items: options?.kind === 'skill' ? [{ id: 'code-review', kind: 'skill', name: '代码审查' }] : [{ id: 'feishu', kind: 'connector', name: '飞书' }] }) })
    render(<HubDetailDrawer item={expert} onClose={() => {}} onChanged={() => {}} onEditExpert={() => {}} onOpenWorkbench={() => {}} onManageSkill={() => {}} />)
    await waitFor(() => expect(screen.getAllByText('代码审查').length).toBeGreaterThan(0))
    expect(screen.getAllByText('飞书').length).toBeGreaterThan(0)
    const dependencies = screen.getByLabelText('专家依赖安装建议')
    expect(within(dependencies).getAllByRole('button', { name: '建议安装' })).toHaveLength(2)
    within(dependencies).getAllByRole('button').forEach(button => expect(button).toBeEnabled())
    expect(screen.queryByText(/未装配/)).not.toBeInTheDocument()
    expect(screen.getByText('已启用')).toBeInTheDocument()
    expect(screen.getByText('低')).toBeInTheDocument()
    expect(screen.getByText('禁止')).toBeInTheDocument()
    expect(screen.getByText('不允许调用')).toBeInTheDocument()
  })

  it('retains the authorization retry panel on a failed probe and closes it only on success', async () => {
    const status = vi.fn()
      .mockResolvedValueOnce({ ok: true, connector: { status: { ok: false, state: 'auth_required', userReady: false } } })
      .mockResolvedValueOnce({ ok: false, code: 'not_found' })
      .mockResolvedValueOnce({ ok: true, connector: { status: { ok: true, state: 'ready', userReady: true } } })
    mockApi({ expertGet: async () => ({ ok: true, expert: { id: expert.id, name: expert.name, skills: [], connectors: ['feishu'] } }), connectorsStatus: status, connectorsFeishuAuthStart: async () => ({ ok: true, verificationUrl: 'https://example.test/auth' }), openExternal: async () => ({ ok: true }) } as never)
    render(<ExpertTaskCapabilities task={{ id: 'display-task', expertId: expert.id } as WorkbenchTask} stageLabel="等待授权" goal="整理材料" sop="" />)
    fireEvent.click(screen.getByRole('button', { name: /能力/ }))
    fireEvent.click(await screen.findByRole('button', { name: '授权全部能力' }))
    fireEvent.click(await screen.findByRole('button', { name: '我已完成，重新检测' }))
    await waitFor(() => expect(screen.getByText('不可用')).toBeInTheDocument())
    expect(screen.getByTestId('expert-inline-feishu-auth')).toBeInTheDocument()
    expect(screen.queryByText('已授权')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '我已完成，重新检测' }))
    await waitFor(() => expect(screen.queryByTestId('expert-inline-feishu-auth')).not.toBeInTheDocument())
    expect(screen.getByText('已授权')).toBeInTheDocument()
  })
})
