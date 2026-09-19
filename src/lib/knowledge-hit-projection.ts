'use strict'

/** Remove repeated fragments without collapsing distinct source citations or chunks. */
function uniqueKnowledgeHits(hits = []) {
  const seen = new Set()
  return hits.filter(hit => {
    if (!hit || typeof hit !== 'object') return false
    const ref = hit.ref || hit.refKey || hit.documentRef || hit.path || ''
    const source = hit.providerId || hit.kbId || hit.provenance?.kbId || hit.sourceKind || ''
    const text = String(hit.snippet || hit.content || '').replace(/\s+/g, ' ').trim()
    const key = JSON.stringify([source, ref, text, hit.title || ''])
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

module.exports = { uniqueKnowledgeHits }
