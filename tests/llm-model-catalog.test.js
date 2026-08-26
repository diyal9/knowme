'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const catalog = require('../src/lib/llm-model-catalog')

describe('llm-model-catalog', () => {
  it('infers DashScope from the compatible endpoint', () => {
    assert.equal(
      catalog.inferProvider('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'),
      'dashscope',
    )
  })

  it('resolves a Qwen preset with its context capability', () => {
    const profile = catalog.resolveProfile({
      apiEndpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      model: 'qwen3.8-max',
    })
    assert.equal(profile.provider, 'dashscope')
    assert.equal(profile.contextWindow, 1000000)
    assert.equal(profile.supportsTools, true)
    assert.equal(profile.supportsVision, true)
  })

  it('keeps custom models on conservative defaults', () => {
    const profile = catalog.resolveProfile({
      llmProvider: 'custom',
      model: 'my-company-model',
    })
    assert.equal(profile.contextWindow, 32768)
    assert.equal(profile.model, 'my-company-model')
  })

  it('lists grouped models and marks the current one', () => {
    const listing = catalog.listCatalog({
      llmProvider: 'dashscope',
      apiEndpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      model: 'qwen3.8-max',
    })
    assert.ok(Array.isArray(listing.groups))
    const dashscope = listing.groups.find(group => group.id === 'dashscope')
    assert.ok(dashscope && dashscope.models.length > 0)
    assert.equal(dashscope.models[0].id, 'auto')
    assert.equal(listing.current.model, 'qwen3.8-max')
  })

  it('puts unknown Model IDs into the custom group', () => {
    const listing = catalog.listCatalog({
      llmProvider: 'custom',
      model: 'my-company-model',
    })
    const custom = listing.groups.find(group => group.id === 'custom')
    assert.ok(custom)
    assert.ok(custom.models.some(model => model.id === 'my-company-model'))
    assert.equal(listing.current.model, 'my-company-model')
  })

  it('filters unsupported models by default', () => {
    const listing = catalog.listCatalog({
      llmProvider: 'dashscope',
      model: 'qwen3.8-max',
    })
    const dashscope = listing.groups.find(group => group.id === 'dashscope')
    const long = dashscope.models.find(model => model.id === 'qwen-long')
    assert.equal(long, undefined)
  })

  it('keeps an unknown current model visible to prevent lockout', () => {
    const listing = catalog.listCatalog({
      llmProvider: 'dashscope',
      model: 'qwen-legacy-custom',
      llmProfile: {
        contextWindow: 1000000,
        maxOutput: 8192,
        supportsTools: false,
      },
    })
    const custom = listing.groups.find(group => group.id === 'custom')
    const long = custom.models.find(model => model.id === 'qwen-legacy-custom')
    assert.ok(long)
    assert.equal(long.supportsTools, false)
    assert.equal(long.supported, false)
  })

  it('routes auto to a coding-friendly model on coding prompts', () => {
    const routed = catalog.resolveRuntimeModel({
      llmProvider: 'dashscope',
      model: 'auto',
    }, {
      tier: 'assist',
      prompt: '请帮我修复这个报错并给出最小代码改动',
    })
    assert.equal(routed.autoRouted, true)
    assert.equal(routed.model, 'qwen3.6-flash')
  })
})
