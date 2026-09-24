type ReadingNode = { id: string; x: number; y: number; width: number; height: number; boundary?: string }
type ReadingEdge = { from: string; to: string }

/** Display-only topological layout. Saved positions and edge semantics stay untouched. */
export function workflowReadingLayout<T extends ReadingNode>(nodes: T[], edges: ReadingEdge[]): T[] | null {
  const levels = new Map(nodes.map(node => [node.id, 0]))
  const incoming = new Map(nodes.map(node => [node.id, 0]))
  const outgoing = new Map(nodes.map(node => [node.id, [] as string[]]))
  for (const edge of edges) {
    if (!incoming.has(edge.from) || !incoming.has(edge.to)) continue
    incoming.set(edge.to, incoming.get(edge.to)! + 1)
    outgoing.get(edge.from)!.push(edge.to)
  }
  const queue = nodes.filter(node => incoming.get(node.id) === 0).map(node => node.id)
  let visited = 0
  while (queue.length) {
    const id = queue.shift()!
    visited += 1
    for (const next of outgoing.get(id)!) {
      levels.set(next, Math.max(levels.get(next)!, levels.get(id)! + 1))
      incoming.set(next, incoming.get(next)! - 1)
      if (incoming.get(next) === 0) queue.push(next)
    }
  }
  // Cycles have no topological reading order: retain the original layout.
  if (visited !== nodes.length) return null
  const layers = Array.from({ length: Math.max(0, ...levels.values()) + 1 }, (_, level) =>
    nodes.filter(node => levels.get(node.id) === level))
  const widest = Math.max(1, ...layers.map(layer => layer.length))
  const columnWidth = 264
  const gap = 48
  const fullWidth = widest * columnWidth + (widest - 1) * gap
  let y = 32
  return layers.flatMap(layer => {
    const width = layer.length * columnWidth + (layer.length - 1) * gap
    const positioned = layer.map((node, index) => ({
      ...node,
      width: node.boundary ? 220 : columnWidth,
      height: node.boundary ? 60 : 112,
      x: 32 + (fullWidth - width) / 2 + index * (columnWidth + gap) + (node.boundary ? 22 : 0),
      y,
    }))
    y += Math.max(0, ...positioned.map(node => node.height)) + gap
    return positioned
  })
}
