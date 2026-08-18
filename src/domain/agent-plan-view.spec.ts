import { describe, expect, it } from 'vitest'
import { buildPlanView } from './agent-plan-view'

describe('agent-plan-view', () => {
  it('titles To-dos n and maps marks', () => {
    const view = buildPlanView({
      items: [
        { id: '1', title: '思考目标', status: 'done' },
        { id: '2', title: '执行', status: 'doing' },
        { id: '3', title: '验收', status: 'pending' },
      ],
    })
    expect(view?.title).toBe('To-dos 3')
    expect(view?.remainingHint).toBe('剩余 2')
    expect(view?.items.map((i) => i.mark)).toEqual(['✓', '▶', '○'])
  })

  it('returns null for empty plan', () => {
    expect(buildPlanView({ items: [] })).toBeNull()
  })
})
