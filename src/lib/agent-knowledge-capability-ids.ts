'use strict'

const { parseKnowledgeCollectionRef, makeKnowledgeCollectionRef } = require('../shared/knowledge-selection')

function canonicalKnowledgeCapabilityId(id) {
  const ref = parseKnowledgeCollectionRef(id)
  return ref ? makeKnowledgeCollectionRef(ref.providerId, ref.collectionId) : String(id)
}

function knowledgeCapabilityContains(parent, child) {
  const a = parseKnowledgeCollectionRef(parent)
  const b = parseKnowledgeCollectionRef(child)
  if (a) return Boolean(b && a.providerId === b.providerId && a.collectionId === b.collectionId)
  return String(parent) === (b?.providerId || String(child))
}

function intersectKnowledgeCapabilityIds(lists) {
  const declared = lists.filter(Array.isArray)
  if (!declared.length) return null
  return declared.reduce((current, next) => [...new Set(current.flatMap(a => next.flatMap(b => {
    if (knowledgeCapabilityContains(a, b)) return [canonicalKnowledgeCapabilityId(b)]
    if (knowledgeCapabilityContains(b, a)) return [canonicalKnowledgeCapabilityId(a)]
    return []
  })))])
}

module.exports = { canonicalKnowledgeCapabilityId, knowledgeCapabilityContains, intersectKnowledgeCapabilityIds }
