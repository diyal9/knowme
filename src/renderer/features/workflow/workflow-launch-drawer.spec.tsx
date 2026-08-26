import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ShelfCardModel } from '../../../domain/shelf'
import { mockApi } from '../../test/helpers'
import { WorkflowLaunchDrawer } from './WorkflowLaunchDrawer'

const card: ShelfCardModel = {
  id: 'th-art-psd-to-artbundle',
  name: 'PSD导Artbundle',
  description: '将 PSD 转换为 ArtBundle。',
  source: 'team',
  provenanceLabel: '共享',
  provenanceKind: 'team',
  domain: 'visual',
  markIcon: 'image',
  inputLabel: 'PSD 文件',
  outcomeLabel: 'ArtBundle',
  backendLabel: '本地运行',
  stepLabels: ['预读', '切图', '导出'],
  stepCount: 3,
  blocked: false,
}

const workflowPackage = {
  inputs: [
    { id: 'goal', label: '本次运行目标', hidden: true, defaultValue: '将 PSD 导出为 ArtBundle 并完成 Creator 验收' },
    { id: 'psdPath', label: 'PSD 文件', required: true, control: 'file', extensions: ['psd'] },
    { id: 'clientRoot', label: 'Creator 工程', required: true, control: 'directory' },
    { id: 'previewPath', label: '参考效果图', advanced: true, control: 'file', extensions: ['png'] },
  ],
  outputs: [{ id: 'bundle', label: 'ArtBundle 制品' }],
}

describe('WorkflowLaunchDrawer', () => {
  afterEach(() => cleanup())

  it('keeps technical inputs implicit and launches from two path selections', async () => {
    const pickFiles = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, files: [{ path: 'D:\\art\\shop.psd', name: 'shop.psd' }] })
      .mockResolvedValueOnce({ ok: true, files: [{ path: 'D:\\game\\client', name: 'client' }] })
    const onSubmit = vi.fn(async () => true)
    mockApi({ workbenchPickFiles: pickFiles })

    render(
      <WorkflowLaunchDrawer
        card={card}
        workflowPackage={workflowPackage}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    )

    const drawer = screen.getByTestId('workflow-launch-drawer')
    expect(within(drawer).queryByLabelText(/本次运行目标/)).not.toBeInTheDocument()
    expect(within(drawer).queryByText('任务标识')).not.toBeInTheDocument()
    expect(within(drawer).queryByText('Prefab 名称')).not.toBeInTheDocument()
    expect(within(drawer).getByText('高级设置')).toBeInTheDocument()
    expect(within(drawer).getByRole('button', { name: '启动工作流' })).toBeDisabled()

    const chooseButtons = within(drawer).getAllByRole('button', { name: '选择' })
    fireEvent.click(chooseButtons[0])
    await waitFor(() => expect(within(drawer).getByLabelText(/PSD 文件/)).toHaveValue('D:\\art\\shop.psd'))
    fireEvent.click(chooseButtons[1])
    await waitFor(() => expect(within(drawer).getByLabelText(/Creator 工程/)).toHaveValue('D:\\game\\client'))

    expect(pickFiles).toHaveBeenNthCalledWith(1, expect.objectContaining({ directory: false, multi: false }))
    expect(pickFiles).toHaveBeenNthCalledWith(2, expect.objectContaining({ directory: true, multi: false }))
    const launch = within(drawer).getByRole('button', { name: '启动工作流' })
    expect(launch).toBeEnabled()
    fireEvent.click(launch)

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({
      goal: '将 PSD 导出为 ArtBundle 并完成 Creator 验收',
      inputs: {
        goal: '将 PSD 导出为 ArtBundle 并完成 Creator 验收',
        psdPath: 'D:\\art\\shop.psd',
        clientRoot: 'D:\\game\\client',
      },
    }))
  })
})
