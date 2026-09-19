/** Internal transport ref for a selected RAG Dataset. Provider implementation is opaque to the UI. */
export const KNOWLEDGE_COLLECTION_REF_PREFIX = 'rag:'
const LEGACY_KNOWLEDGE_COLLECTION_REF_PREFIX = 'ragflow:'

export type KnowledgeSelectionProvider = {
  id: string
  displayName?: string
  name?: string
  kind?: string
  collectionIds?: string[]
  collections?: Array<{ id: string; name?: string; description?: string }>
}

export type KnowledgeSelectionOption = {
  id: string
  displayName: string
  name: string
  kind?: string
  category: '外挂知识库' | 'RAG 知识库'
  providerId?: string
  collectionId?: string
  description?: string
}

export function makeKnowledgeCollectionRef(providerId: string, collectionId: string) {
  return `${KNOWLEDGE_COLLECTION_REF_PREFIX}${encodeURIComponent(providerId)}:${encodeURIComponent(collectionId)}`
}

export function parseKnowledgeCollectionRef(value: string) {
  const raw = String(value || '')
  const prefix = raw.startsWith(KNOWLEDGE_COLLECTION_REF_PREFIX)
    ? KNOWLEDGE_COLLECTION_REF_PREFIX
    : raw.startsWith(LEGACY_KNOWLEDGE_COLLECTION_REF_PREFIX)
      ? LEGACY_KNOWLEDGE_COLLECTION_REF_PREFIX
      : ''
  if (!prefix) return null
  const body = raw.slice(prefix.length)
  const separator = body.indexOf(':')
  if (separator <= 0) return null
  try {
    const providerId = decodeURIComponent(body.slice(0, separator))
    const collectionId = decodeURIComponent(body.slice(separator + 1))
    return providerId && collectionId ? { providerId, collectionId } : null
  } catch {
    return null
  }
}

export function buildKnowledgeSelectionOptions(providers: KnowledgeSelectionProvider[] = []): KnowledgeSelectionOption[] {
  return providers.flatMap<KnowledgeSelectionOption>((provider) => {
    const kind = String(provider.kind || '')
    const datasetScoped = kind === 'ragflow'
    const collections = Array.isArray(provider.collections) ? provider.collections : []
    const granted = new Set((provider.collectionIds || []).map(String))
    if (datasetScoped && collections.length) {
      return collections
        .filter((collection) => granted.has(String(collection.id)))
        .map((collection) => ({
          id: makeKnowledgeCollectionRef(provider.id, collection.id),
          displayName: collection.name || collection.id,
          name: collection.name || collection.id,
          kind,
          category: 'RAG 知识库',
          providerId: provider.id,
          collectionId: String(collection.id),
          description: collection.description,
        }))
    }
    if (datasetScoped) return []
    return [{
      id: provider.id,
      displayName: provider.displayName || provider.name || provider.id,
      name: provider.name || provider.displayName || provider.id,
      kind,
      category: '外挂知识库',
      providerId: provider.id,
    }]
  })
}
