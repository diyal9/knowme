'use strict'

const crypto = require('node:crypto')
const {
  buildBehaviorEvalCases,
  buildBehaviorEvalMessages,
  scoreBehaviorResponse,
} = require('../src/lib/context-engine/behavior-eval')

const allowSkip = process.argv.includes('--allow-skip')
const apiKey = process.env.CONTEXT_CHAT_API_KEY || process.env.OPENAI_API_KEY || ''
const endpoint = process.env.CONTEXT_CHAT_ENDPOINT || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
const model = process.env.CONTEXT_CHAT_MODEL || process.env.OPENAI_MODEL || ''
const locale = process.env.CONTEXT_CHAT_LOCALE || 'zh-CN'

function completionUrl(value) {
  const base = String(value || '').replace(/\/+$/, '')
  if (/\/chat\/completions$/i.test(base)) return base
  return `${base}/chat/completions`
}

function responseText(payload = {}) {
  const content = payload?.choices?.[0]?.message?.content
  if (Array.isArray(content)) return content.map(item => item?.text || '').join('')
  return String(content || '')
}

async function runCase(testCase) {
  const assembled = buildBehaviorEvalMessages(testCase)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)
  const startedAt = Date.now()
  try {
    const response = await fetch(completionUrl(endpoint), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: assembled.messages, temperature: 0, max_tokens: 600 }),
      signal: controller.signal,
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(`provider_http_${response.status}`)
    const text = responseText(payload)
    return {
      ...scoreBehaviorResponse(testCase, text),
      latencyMs: Date.now() - startedAt,
      responseHash: crypto.createHash('sha256').update(text).digest('hex').slice(0, 16),
      promptPackVersion: assembled.manifest.promptPackVersion,
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function main() {
  if (!apiKey || !model) {
    process.stdout.write(`${JSON.stringify({
      version: 1, status: 'skipped', reason: 'credential_or_model_missing',
    }, null, 2)}\n`)
    if (!allowSkip) process.exitCode = 1
    return
  }
  const cases = buildBehaviorEvalCases(locale)
  const settled = await Promise.allSettled(cases.map(runCase))
  const results = settled.map((item, index) => item.status === 'fulfilled'
    ? item.value
    : { id: cases[index].id, passed: false, error: String(item.reason?.message || item.reason || 'provider_error') })
  const passed = results.every(item => item.passed === true)
  process.stdout.write(`${JSON.stringify({
    version: 1,
    status: passed ? 'passed' : 'failed',
    modelHash: crypto.createHash('sha256').update(model).digest('hex').slice(0, 12),
    results,
  }, null, 2)}\n`)
  if (!passed) process.exitCode = 1
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ version: 1, error: String(error?.message || error) })}\n`)
  process.exitCode = 1
})
