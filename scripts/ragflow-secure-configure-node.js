#!/usr/bin/env node
'use strict'

require('./register-ts')
const path = require('node:path')
const knowledgeOs = require('../src/lib/knowledge-os')
const knowledgeProvider = require('../src/lib/knowledge-provider')
const providerSecret = require('../src/lib/provider-secret')

async function main() {
  const endpoint = String(process.argv[2] || '').trim().replace(/\/+$/, '')
  const displayName = String(process.argv[3] || '团队 RAGFlow').trim().slice(0, 60)
  const apiKey = String(process.env.KNOWME_RAGFLOW_KEY || '').trim()
  if (!/^https?:\/\//i.test(endpoint)) throw new Error('请提供有效的 RAGFlow 服务地址')
  if (!apiKey) throw new Error('未收到 API Key')

  const probe = await knowledgeProvider.listCollections({ id: 'ragflow_primary', kind: 'ragflow', displayName, endpoint, apiKey }, { timeoutMs: 8_000, pageSize: 100 })
  if (probe.ok === false) throw new Error(`RAGFlow 验证失败：${probe.error || '无法读取知识库目录'}`)
  const providedCipher = String(process.env.KNOWME_RAGFLOW_KEY_DPAPI || '').trim()
  const apiKeyEnc = providedCipher.startsWith('dpapi:') ? providedCipher : providerSecret.encryptWithDpapi(apiKey)
  if (!apiKeyEnc) throw new Error('Windows DPAPI 加密失败，未保存连接')

  const userData = path.join(process.env.APPDATA || '', 'KnowMe')
  const config = knowledgeOs.loadConfig(userData)
  const providers = Array.isArray(config.providers) ? [...config.providers] : []
  const index = providers.findIndex((item) => item.id === 'ragflow_primary' || (item.kind === 'ragflow' && String(item.endpoint || '').replace(/\/+$/, '') === endpoint))
  const existing = index >= 0 ? providers[index] : {}
  const record = {
    ...existing,
    id: existing.id || 'ragflow_primary',
    kind: 'ragflow',
    displayName,
    endpoint,
    collectionIds: Array.isArray(existing.collectionIds) ? existing.collectionIds : [],
    collections: probe.collections || [],
    topK: Number(existing.topK) || knowledgeProvider.DEFAULT_TOPK,
    apiKeyEnc,
    health: 'ready',
    lastSyncedAt: new Date().toISOString(),
  }
  delete record.apiKey
  if (index >= 0) providers[index] = record
  else providers.push(record)
  knowledgeOs.saveConfig(userData, { providers })
  console.log(JSON.stringify({ ok: true, providerId: record.id, endpoint, collectionCount: record.collections.length, hasApiKey: true, grantedCollectionCount: record.collectionIds.length }))
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, message: String(error?.message || error) }))
  process.exitCode = 1
})
