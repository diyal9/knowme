import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockApi } from '../../test/helpers'
import { PersonalAgentGrowthPanel } from './PersonalAgentGrowthPanel'

describe('personal-agent growth', () => {
  afterEach(() => cleanup())

  it('configures partner soul, capabilities, collaboration and self-drive', async () => {
    const save = vi.fn(async (_payload: Record<string, unknown>) => ({
      ok: true,
      profile: {
        profileVersion: 3,
        id: 'my-knowme',
        agentId: 'personal',
        profileKind: 'personal' as const,
        identity: { displayName: '小知', avatar: 'other/partner' },
        contexts: [],
        taskPreferences: { domainCapabilities: '产品分析', selfDriveLevel: 'balanced', selfDriveRules: '发布前确认' },
        roleOverlay: '可靠的长期工作伙伴',
        promptOverlay: '先给建议',
      },
    }))
    mockApi({
      personalAgentGet: async () => ({
        ok: true,
        profile: {
          profileVersion: 3,
          id: 'my-knowme',
          agentId: 'personal',
          profileKind: 'personal',
          identity: { displayName: '小知', avatar: 'other/partner' },
          contexts: [],
          taskPreferences: { domainCapabilities: '产品分析', selfDriveLevel: 'balanced', selfDriveRules: '发布前确认' },
          roleOverlay: '可靠的长期工作伙伴',
          promptOverlay: '先给结论',
        },
      }),
      personalAgentGrowthList: async () => ({ ok: true, events: [], proposals: [] }),
      personalAgentSave: save,
      memoryOverview: async () => ({
        patterns: [
          { id: 'p1', kind: 'preference', summary: '喜欢简洁回答', prompt_state: 'pending', count: 3, review_ready: true },
          { id: 'p2', kind: 'workflow_choice', summary: '选择工作入口：整理会议纪要', prompt_state: 'pending', count: 1, review_ready: false },
        ],
        recent: [],
        stats: {},
      }),
    })

    render(<PersonalAgentGrowthPanel onClose={() => undefined} />)
    await waitFor(() => expect(screen.getByTestId('personal-preview-soul')).toHaveTextContent('可靠的长期工作伙伴'))
    expect(screen.queryByLabelText('伙伴 Soul')).not.toBeInTheDocument()
    expect(screen.getByTestId('personal-preview-capabilities')).toHaveTextContent('产品分析')
    expect(screen.queryByLabelText('工作侧重')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '编辑工作侧重' }))
    expect(screen.getByLabelText('工作侧重')).toHaveValue('产品分析')
    expect(screen.getByLabelText('工作侧重')).toHaveAttribute('placeholder', expect.stringContaining('不会自动获得 Skill'))
    expect(screen.getByTestId('personal-preview-collaboration')).toHaveTextContent('先给结论')
    expect(screen.getByTestId('personal-preview-drive-rules')).toHaveTextContent('发布前确认')
    expect(screen.getByTestId('self-drive-config')).toHaveTextContent('协作推进')
    expect(screen.queryByLabelText('工作领域')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('岗位')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('关于我')).not.toBeInTheDocument()
    expect(screen.getByTestId('personal-memory-policy')).toHaveTextContent('至少出现 3 次')
    expect(screen.getByTestId('personal-memory-pattern')).toHaveTextContent('喜欢简洁回答')
    expect(screen.queryByText('选择工作入口：整理会议纪要')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '确认记住' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'KnowMe 配置方法' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('工作侧重'), { target: { value: '产品分析\n会议总结' } })
    fireEvent.click(screen.getByDisplayValue('proactive'))
    fireEvent.click(screen.getByRole('button', { name: '保存更改' }))
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({
      taskPreferences: expect.objectContaining({
        domainCapabilities: '产品分析\n会议总结',
        selfDriveLevel: 'proactive',
        selfDriveRules: '发布前确认',
      }),
      roleOverlay: '可靠的长期工作伙伴',
      promptOverlay: '先给结论',
    })))

    fireEvent.click(screen.getByRole('button', { name: '主动边界' }))
    expect(screen.getByRole('heading', { name: '它可以主动到哪一步' })).toBeInTheDocument()
    expect(screen.getByText('选择推进方式，明确必须由你确认的事项。')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '成长' }))
    expect(screen.getByTestId('personal-growth-tab')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'KnowMe 正在懂你什么' })).toBeInTheDocument()
    expect(screen.getByText('成长只读取已确认记忆')).toBeInTheDocument()
    expect(screen.getByTestId('personal-memory-pattern').closest('section')).toHaveClass('personal-tab-inactive')

    fireEvent.click(screen.getByRole('button', { name: '前往记忆与变更' }))
    expect(screen.getByTestId('personal-memory-pattern').closest('section')).not.toHaveClass('personal-tab-inactive')
  })
})
