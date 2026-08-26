'use strict'

const { probeEmbeddingConnection } = require('../src/lib/embedding-runtime')

const allowSkip = process.argv.includes('--allow-skip')
const providers = [
  {
    id: 'openai',
    key: process.env.OPENAI_API_KEY,
    endpoint: process.env.OPENAI_EMBEDDING_ENDPOINT || 'https://api.openai.com/v1',
    model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
  },
  {
    id: 'dashscope',
    key: process.env.DASHSCOPE_API_KEY,
    endpoint: process.env.DASHSCOPE_EMBEDDING_ENDPOINT || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: process.env.DASHSCOPE_EMBEDDING_MODEL || 'text-embedding-v3',
  },
]

async function main() {
  const results = []
  for (const provider of providers) {
    if (!provider.key) {
      results.push({ provider: provider.id, status: 'skipped', reason: 'credential_missing' })
      continue
    }
    const result = await probeEmbeddingConnection({
      embeddingProvider: provider.id,
      embeddingEndpoint: provider.endpoint,
      embeddingApiKey: provider.key,
      embeddingModel: provider.model,
    }, { timeoutMs: 8000 })
    results.push({
      provider: provider.id,
      status: result.ok ? 'passed' : 'failed',
      code: result.code || '',
      latencyMs: result.latencyMs || 0,
      dimensions: result.dimensions || 0,
      host: result.host || '',
    })
  }
  const configured = results.filter(item => item.status !== 'skipped')
  const failed = configured.filter(item => item.status === 'failed')
  process.stdout.write(`${JSON.stringify({ version: 1, results }, null, 2)}\n`)
  if (failed.length || (!allowSkip && configured.length !== providers.length)) process.exitCode = 1
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ version: 1, error: String(error?.message || error) })}\n`)
  process.exitCode = 1
})
