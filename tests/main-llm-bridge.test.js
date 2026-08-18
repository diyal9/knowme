'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const {
  normalizeChatEndpoint,
  formatLlmTimeoutError,
  applyProviderCompat,
  FIRST_BYTE_TIMEOUT_MS,
} = require('../src/lib/main-llm-bridge')

describe('main-llm-bridge', () => {
  it('appends chat/completions onto DashScope compatible-mode /v1', () => {
    assert.equal(
      normalizeChatEndpoint('https://dashscope.aliyuncs.com/compatible-mode/v1'),
      'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    )
  })

  it('names the host on first-byte timeout so a configured API is not mistaken for missing settings', () => {
    const msg = formatLlmTimeoutError({
      host: 'dashscope.aliyuncs.com',
      phase: 'first-byte',
      firstByteMs: FIRST_BYTE_TIMEOUT_MS,
    })
    assert.match(msg, /连接超时（15s）/)
    assert.match(msg, /dashscope\.aliyuncs\.com/)
    assert.match(msg, /API 已配置/)
  })

  it('keeps the 120s idle copy used by the renderer error bubble', () => {
    assert.equal(
      formatLlmTimeoutError({ host: 'dashscope.aliyuncs.com', phase: 'idle' }),
      '请求超时（120s），请检查网络或 Endpoint',
    )
  })

  it('turns off Qwen thinking on DashScope unless the user opted in', () => {
    const url = new URL('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions')
    const patched = applyProviderCompat(url, { model: 'qwen-turbo', messages: [] }, { llmProvider: 'dashscope' })
    assert.equal(patched.enable_thinking, false)
    const on = applyProviderCompat(url, { model: 'qwen-plus', messages: [] }, {
      llmProvider: 'dashscope',
      enableThinking: true,
    })
    assert.equal(on.enable_thinking, true)
  })

  it('does not inject enable_thinking for non-Qwen DashScope models', () => {
    const url = new URL('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions')
    const patched = applyProviderCompat(url, { model: 'deepseek-v3', messages: [] }, { llmProvider: 'dashscope' })
    assert.equal(patched.enable_thinking, undefined)
  })

  it('keeps request metadata free of secrets and body', () => {
    const { llmCallMeta } = require('../src/lib/main-llm-bridge')
    const meta = llmCallMeta(
      new URL('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'),
      { model: 'qwen-turbo', stream: true, messages: [{ role: 'user', content: 'secret' }] },
      { bytes: 12, status: 200, latencyMs: 40 },
    )
    const dumped = JSON.stringify(meta)
    assert.equal(meta.host, 'dashscope.aliyuncs.com')
    assert.equal(meta.model, 'qwen-turbo')
    assert.equal(meta.stream, true)
    assert.ok(!dumped.includes('secret'))
    assert.ok(!dumped.includes('apiKey'))
    assert.ok(!dumped.includes('Authorization'))
  })

  it('fails probe immediately on a bad endpoint without waiting', async () => {
    const { probeLlmConnection } = require('../src/lib/main-llm-bridge')
    const result = await probeLlmConnection({ apiEndpoint: 'not-a-url', apiKey: 'x' })
    assert.equal(result.ok, false)
    assert.match(result.error, /Endpoint 格式错误/)
  })

  it('routes once-shot and workbench-dispatch through the same HTTP client', () => {
    const fs = require('fs')
    const path = require('path')
    const bridge = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'main-llm-bridge.ts'), 'utf8')
    const dispatch = fs.readFileSync(path.join(__dirname, '..', 'src', 'ipc', 'workbench-dispatch.ts'), 'utf8')
    const onceFn = bridge.slice(bridge.indexOf('function chatCompletionOnce'))
    assert.equal((bridge.match(/lib\.request\(/g) || []).length, 1)
    assert.ok(onceFn.includes('return requestAgentCompletion('))
    assert.ok(!onceFn.includes('lib.request('))
    assert.ok(dispatch.includes('requestAgentCompletion'))
    assert.ok(!dispatch.includes('lib.request('))
    assert.ok(!dispatch.includes('https.request'))
    assert.ok(bridge.includes('lookup: createIpv4FirstLookup()'))
    assert.ok(!bridge.includes('family: 4'))
  })

  it('prefers IPv4 but allows IPv6-only endpoints via custom lookup', async () => {
    const dns = require('dns')
    const { createIpv4FirstLookup } = require('../src/lib/main-llm-bridge')
    const lookup = createIpv4FirstLookup()
    const orig = dns.lookup
    try {
      dns.lookup = (hostname, options, cb) => {
        if (hostname === 'dual.example') {
          return cb(null, [
            { address: '2001:db8::1', family: 6 },
            { address: '93.184.216.34', family: 4 },
          ])
        }
        if (hostname === 'v6only.example') {
          return cb(null, [{ address: '2001:db8::2', family: 6 }])
        }
        return orig(hostname, options, cb)
      }
      const dual = await new Promise((resolve, reject) => {
        lookup('dual.example', {}, (err, address, family) => {
          if (err) reject(err)
          else resolve({ address, family })
        })
      })
      assert.equal(dual.address, '93.184.216.34')
      assert.equal(dual.family, 4)
      const v6 = await new Promise((resolve, reject) => {
        lookup('v6only.example', {}, (err, address, family) => {
          if (err) reject(err)
          else resolve({ address, family })
        })
      })
      assert.equal(v6.address, '2001:db8::2')
      assert.equal(v6.family, 6)
    } finally {
      dns.lookup = orig
    }
  })
})
