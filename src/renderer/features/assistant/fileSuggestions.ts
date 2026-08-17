import type { AgentFileRef } from '../../../shared/api'

function fileTitle(note: AgentFileRef): string {
  return String(note.title || note.preview || '未命名').trim()
}

function fileMatches(note: AgentFileRef, query: string): boolean {
  const title = fileTitle(note)
  const project = String(note.project || '').trim()
  return !query || `${title} ${project}`.toLowerCase().includes(query)
}

export function recentFileSuggestions(catalog: AgentFileRef[], query: string, limit = 6): AgentFileRef[] {
  return catalog
    .slice()
    .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())
    .filter((note) => fileMatches(note, query))
    .slice(0, limit)
}

export { fileTitle }
