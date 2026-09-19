'use strict'
const { createHash } = require('node:crypto')

/** Host-only identity hash. Never persist/log source credentials or endpoint query strings. */
function knowledgeProviderFingerprint(provider = {}) {
  const stable = value => Array.isArray(value) ? value.map(stable)
    : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value
  const fields = ['id', 'kind', 'enabled', 'version', 'updatedAt', 'endpoint', 'apiKey', 'credentialRef',
    'authRef', 'sourceId', 'spaceSourceId', 'subDir', 'repositoryRef', 'rootPath', 'path', 'collection', 'collectionId', 'retrieval']
  const identity = Object.fromEntries(fields.map(key => [key, provider[key] ?? null]))
  for (const key of ['collectionIds', 'documentIds']) identity[key] = [...new Set(provider[key] || [])].map(String).sort()
  return createHash('sha256').update(JSON.stringify(stable(identity))).digest('hex')
}

module.exports = { knowledgeProviderFingerprint }
