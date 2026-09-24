import { describe, expect, it } from 'vitest'
import { workflowReadingLayout } from './workflow-reading-layout'

const node = (id: string, boundary?: string) => ({ id, boundary, x: 900, y: 40, width: 236, height: 116 })
describe('workflow reading layout', () => {
  it('aligns a chain on one axis without modifying saved coordinates', () => {
    const nodes = [node('start', 'start'), node('agent'), node('end', 'end')]
    const before = JSON.stringify(nodes)
    const layout = workflowReadingLayout(nodes, [{ from: 'start', to: 'agent' }, { from: 'agent', to: 'end' }])!
    expect(new Set(layout.map(n => n.x + n.width / 2)).size).toBe(1)
    expect(layout[1].y).toBeGreaterThan(layout[0].y + layout[0].height)
    expect(layout[2].y).toBeGreaterThan(layout[1].y + layout[1].height)
    expect(JSON.stringify(nodes)).toBe(before)
  })
  it('keeps parallel branches at the same level and joins below both', () => {
    const nodes = ['start', 'a', 'b', 'end'].map(id => node(id))
    const edges = [{ from: 'start', to: 'a' }, { from: 'start', to: 'b' }, { from: 'a', to: 'end' }, { from: 'b', to: 'end' }]
    const layout = workflowReadingLayout(nodes, edges)!
    expect(layout[1].y).toBe(layout[2].y)
    expect(layout[2].x).toBeGreaterThan(layout[1].x + layout[1].width)
    expect(layout[3].y).toBeGreaterThan(layout[2].y + layout[2].height)
    expect(edges).toHaveLength(4)
  })
  it('does not invent a sequential path for a cycle', () => {
    expect(workflowReadingLayout([node('a'), node('b')], [{ from: 'a', to: 'b' }, { from: 'b', to: 'a' }])).toBeNull()
  })
  it('handles an empty graph', () => {
    expect(workflowReadingLayout([], [])).toEqual([])
  })
})
