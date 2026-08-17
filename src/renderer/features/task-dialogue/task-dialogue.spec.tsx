import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockApi, resetAppStore } from '../../test/helpers'
import { TaskDialogueLaunch } from './TaskDialogueLaunch'

describe('task-dialogue shared launch', () => {
  beforeEach(() => {
    mockApi()
    resetAppStore()
  })
  afterEach(() => cleanup())

  it('renders shared prompts without lane-specific copy', () => {
    const onPrompt = vi.fn()
    render(
      <TaskDialogueLaunch
        mark={<span>mark</span>}
        kicker="共享入口"
        title="示例"
        caps={['公共']}
        emptyClass="agent-empty-workflow"
        emptyLabel="共享入口"
        prompts={[{ title: '对齐目标', subtitle: '公共快捷', prompt: 'go' }]}
        onPrompt={onPrompt}
      />,
    )
    expect(screen.getByLabelText('共享入口')).toHaveTextContent('示例')
    fireEvent.click(screen.getByRole('button', { name: /对齐目标/ }))
    expect(onPrompt).toHaveBeenCalledWith('go')
  })
})
