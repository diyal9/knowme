export interface HashContext {
  start: number
  end: number
  query: string
}

/** Finds the Agent query immediately before the caret inside the composer. */
export function getHashContext(value: string, caret: number): HashContext | null {
  const safeCaret = Math.max(0, Math.min(value.length, caret))
  const before = value.slice(0, safeCaret)
  const match = before.match(/(^|\s)#([^\s#]*)$/)
  if (!match) return null
  const query = match[2] ?? ''
  return {
    start: safeCaret - query.length - 1,
    end: safeCaret,
    query: query.toLowerCase(),
  }
}

export function insertHashAgent(
  value: string,
  context: HashContext,
  name: string,
): { next: string; caret: number } {
  const safeName = name.trim()
  const before = value.slice(0, context.start)
  const after = value.slice(context.end).replace(/^\s+/, '')
  const insert = `#${safeName} `
  return {
    next: before + insert + after,
    caret: (before + insert).length,
  }
}

export function removeHashAgentMarker(
  value: string,
  name: string,
): { next: string; caret: number } {
  const marker = `#${name.trim()}`
  if (marker === '#') return { next: value, caret: value.length }

  let searchFrom = 0
  while (searchFrom < value.length) {
    const index = value.indexOf(marker, searchFrom)
    if (index < 0) break
    const beforeBoundary = index === 0 || /\s/.test(value[index - 1] || '')
    const markerEnd = index + marker.length
    const afterBoundary = markerEnd === value.length || /\s/.test(value[markerEnd] || '')
    if (beforeBoundary && afterBoundary) {
      const before = value.slice(0, index)
      const after = value.slice(markerEnd).replace(/^\s/, '')
      return { next: before + after, caret: before.length }
    }
    searchFrom = markerEnd
  }

  return { next: value, caret: value.length }
}
