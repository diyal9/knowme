import { useState } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ManagedAgentTarget } from '../../../shared/api'
import { resetAppStore } from '../../test/helpers'
import { AgentComposer } from './AgentComposer'

const targets: ManagedAgentTarget[] = [
  { id: 'my-agent', name: '我的 Agent', source: 'custom', ownership: 'user', editable: true },
  { id: 'sentiment-agent', name: '舆情专家', source: 'curated', ownership: 'system', editable: true, version: '1.0.0' },
]

function Harness({ onSubmit }: { onSubmit: (text: string) => void }) {
  const [target, setTarget] = useState<ManagedAgentTarget | null>(null)
  return (
    <AgentComposer
      surface="workbench"
      placeholder="输入 # 选择 Agent"
      agentTargets={targets}
      selectedAgentTarget={target}
      onAgentTargetChange={setTarget}
      onSubmit={onSubmit}
    />
  )
}

describe('Agent target composer', () => {
  beforeEach(() => resetAppStore())
  afterEach(cleanup)

  it('selects an Agent with #, renders it as a token, and submits it with the request', async () => {
    const onSubmit = vi.fn()
    render(<Harness onSubmit={onSubmit} />)

    const composer = screen.getByRole('textbox', { name: '输入 # 选择 Agent' })
    fireEvent.change(composer, { target: { value: '#' } })
    const menu = await screen.findByTestId('agent-target-menu')
    expect(menu).toHaveAttribute('aria-label', '选择要训练或优化的 Agent')
    const search = screen.getByRole('searchbox', { name: '搜索已添加的 Agent' })
    expect(search).toBeInTheDocument()
    fireEvent.change(search, { target: { value: '舆情' } })

    fireEvent.mouseDown(screen.getByRole('treeitem', { name: /舆情专家/ }))
    expect(screen.queryByTestId('agent-target-menu')).not.toBeInTheDocument()
    expect(screen.getByTestId('agent-selected-agent-sentiment-agent')).toHaveTextContent('舆情专家')
    expect(composer).toHaveValue('#舆情专家 ')

    fireEvent.change(composer, { target: { value: '#舆情专家 请评估并优化提示词' } })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('#舆情专家 请评估并优化提示词'))
  })

  it('removes the selected Agent when its token is clicked', async () => {
    render(<Harness onSubmit={() => {}} />)
    const composer = screen.getByRole('textbox', { name: '输入 # 选择 Agent' })
    fireEvent.change(composer, { target: { value: '#舆情' } })
    fireEvent.mouseDown(await screen.findByRole('treeitem', { name: /舆情专家/ }))

    fireEvent.click(screen.getByTestId('agent-selected-agent-sentiment-agent'))
    expect(composer).toHaveValue('')
    expect(screen.queryByTestId('agent-selected-agent-sentiment-agent')).not.toBeInTheDocument()
  })
})
