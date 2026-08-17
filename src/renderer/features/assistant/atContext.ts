export interface AtContext {
  start: number
  end: number
  query: string
}

export function getAtContext(value: string, caret: number): AtContext | null {
  const before = value.slice(0, caret)
  const match = before.match(/(^|\s)@([^\s@]*)$/)
  if (!match) return null
  const query = match[2] ?? ''
  return {
    start: caret - query.length - 1,
    end: caret,
    query: query.toLowerCase(),
  }
}

export function insertAtReference(value: string, ctx: AtContext, title: string): { next: string; caret: number } {
  const safeTitle = title.trim() || '未命名'
  const before = value.slice(0, ctx.start)
  const after = value.slice(ctx.end)
  const insert = `@${safeTitle} `
  const next = before + insert + after
  return { next, caret: (before + insert).length }
}
