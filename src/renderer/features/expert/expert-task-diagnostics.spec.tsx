import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { AppShell } from '../../app/AppShell'
import { useAppStore } from '../../app/store'
import { mockApi, resetAppStore } from '../../test/helpers'

afterEach(() => cleanup())

it('restores folded execution diagnostics from the saved session without creating chat messages', async () => {
  resetAppStore()
  useAppStore.setState({ route: 'workbench', workbenchSurface: 'run', expertRoom: {
    id: 'diagnostic-task', taskId: 'diagnostic-task', expertId: 'data-analyst', name: '数据分析专家',
    goal: '', log: [], messages: [], skills: [], connectors: [], knowledgeRefs: [],
  } })
  mockApi({
    expertTaskGet: async () => ({ ok: true, task: { id: 'diagnostic-task', kind: 'expert', status: 'running',
      expertId: 'data-analyst', goal: '分析材料', execRef: { kind: 'session', id: 'diagnostic-session' }, events: [], deliverables: [] } }),
    agentSessionGet: async (id: string) => ({ ok: true, session: { id, messages: [],
      ...(id === 'diagnostic-session' ? { expertTaskDiagnostics: { available: 12, loaded: 1, loadedNames: ['search_knowledge'],
        omitted: 11, usedTokens: 1200, schemaTokens: 200, inputBudget: 2000, rawBody: 'private-source-body' } } : {}),
    } }),
  })
  render(<AppShell />)
  const summary = await screen.findByText('执行诊断（最近一次记录）')
  const panel = summary.closest('details')!
  expect(panel).not.toHaveAttribute('open')
  expect(within(panel).getByText('1 / 12')).toBeInTheDocument()
  expect(within(panel).getByText('1200 / 2000 tokens')).toBeInTheDocument()
  expect(within(panel).getByText('search_knowledge')).toBeInTheDocument()
  expect(screen.queryByText('private-source-body')).not.toBeInTheDocument()
  expect(useAppStore.getState().expertRoom?.messages).toEqual([])
})
