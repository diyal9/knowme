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
    expect(screen.queryByLabelText('领域能力')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '编辑领域能力' }))
    expect(screen.getByLabelText('领域能力')).toHaveValue('产品分析')
    expect(screen.getByLabelText('领域能力')).toHaveAttribute('placeholder', expect.stringContaining('真实 Skill'))
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
    fireEvent.click(screen.getByRole('button', { name: 'KnowMe 配置方法' }))
    expect(screen.getByRole('tooltip')).toHaveTextContent('设置 → 个人档案')
    fireEvent.change(screen.getByLabelText('领域能力'), { target: { value: '产品分析\n会议总结' } })
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
  })
})
