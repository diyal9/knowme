'use strict'

const MODEL_CATALOG = [
  {
    id: 'qwen3.6-flash',
    provider: 'dashscope',
    label: 'Qwen 3.6 Flash',
    contextWindow: 1000000,
    maxOutput: 64000,
    supportsTools: true,
    supportsVision: true,
    parameter: 'max_tokens',
  },
  {
    id: 'qwen3.8-max',
    provider: 'dashscope',
    label: 'Qwen 3.8 Max',
    contextWindow: 1000000,
    maxOutput: 64000,
    supportsTools: true,
    supportsVision: true,
    parameter: 'max_tokens',
  },
  {
    id: 'gpt-4o-mini',
    provider: 'openai',
    label: 'GPT-4o mini',
    contextWindow: 128000,
    maxOutput: 8192,
    supportsTools: true,
    supportsVision: true,
    parameter: 'max_tokens',
  },
  {
    id: 'gpt-4o',
    provider: 'openai',
    label: 'GPT-4o',
    contextWindow: 128000,
    maxOutput: 8192,
    supportsTools: true,
    supportsVision: true,
    parameter: 'max_tokens',
  },
]

const AUTO_MODEL_ID = 'auto'
const AUTO_MODEL_LABEL = 'Auto'

const PROVIDERS = [
  { id: 'dashscope', label: '阿里云百炼' },
  { id: 'openai', label: 'OpenAI' },
  { id: 'custom', label: '自定义兼容接口' },
]

function isAutoModel(model = '') {
  return String(model || '').trim().toLowerCase() === AUTO_MODEL_ID
}

function isSupportedForKnowMe(model = {}) {
  const contextWindow = Number(model.contextWindow) || 0
  return model.supportsTools !== false && contextWindow >= 64000
}

function withModelMeta(model = {}) {
  return {
    ...model,
    supported: isSupportedForKnowMe(model),
  }
}

function inferProvider(endpoint = '') {
  const value = String(endpoint || '').toLowerCase()
  if (value.includes('dashscope.aliyuncs.com')) return 'dashscope'
  if (value.includes('api.openai.com')) return 'openai'
  return 'custom'
}

function getModels(provider = '') {
  return MODEL_CATALOG
    .filter(model => model.provider === provider)
    .map(withModelMeta)
}

function getSupportedModels(provider = '') {
  return getModels(provider).filter(isSupportedForKnowMe)
}

function getAutoPreset(provider = '') {
  const supported = getSupportedModels(provider)
  const source = supported.length ? supported : MODEL_CATALOG
  const contextWindow = source.reduce(
    (max, item) => Math.max(max, Number(item.contextWindow) || 0),
    32768,
  )
  const maxOutput = source.reduce(
    (max, item) => Math.max(max, Number(item.maxOutput) || 0),
    4096,
  )
  return {
    id: AUTO_MODEL_ID,
    provider: provider || 'custom',
    label: AUTO_MODEL_LABEL,
    contextWindow,
    maxOutput,
    supportsTools: true,
    parameter: 'max_tokens',
    supported: true,
  }
}

function getRouteSignals({ tier = 'chat', prompt = '', history = [] } = {}) {
  const text = String(prompt || '')
  const lower = text.toLowerCase()
  const historyCount = Array.isArray(history) ? history.length : 0
  const heavyKeywords = [
    '架构', '重构', '方案', '设计', '排查', '根因', '复杂', '多步骤',
    'debug', 'trace', 'architecture', 'refactor', 'analysis',
  ]
  const codingKeywords = [
    '代码', '报错', '修复', '函数', '接口', '测试', 'bug',
    'code', 'error', 'fix', 'test',
  ]
  const heavyHit = heavyKeywords.some(keyword => lower.includes(keyword))
  const codingHit = codingKeywords.some(keyword => lower.includes(keyword))
  const highLoad = tier === 'retrieval' || text.length > 1200 || historyCount >= 10
  return { heavyHit, codingHit, highLoad }
}

function pickAutoModel(settings = {}, routeInput = {}) {
  const provider = String(
    settings.llmProvider || inferProvider(settings.apiEndpoint),
  ).trim() || 'custom'
  const allForProvider = getModels(provider)
  const supported = allForProvider.filter(isSupportedForKnowMe)
  const candidates = supported.length ? supported : allForProvider
  const findById = id => candidates.find(item => item.id === id)
  const signals = getRouteSignals(routeInput)
  const needsVision = routeInput.hasImage === true

  if (!candidates.length) {
    return {
      provider,
      model: 'gpt-4o-mini',
      label: 'GPT-4o mini',
      reason: 'provider_without_candidates',
    }
  }

  if (provider === 'openai') {
    const heavy = findById('gpt-4o')
    const fast = findById('gpt-4o-mini') || heavy
    if ((signals.highLoad || signals.heavyHit) && heavy) {
      return { provider, model: heavy.id, label: heavy.label, reason: 'openai_heavy' }
    }
    return { provider, model: fast.id, label: fast.label, reason: 'openai_fast' }
  }

  if (provider === 'dashscope') {
    const vision = candidates.find(item => item.supportsVision)
    const heavy = findById('qwen3.8-max') || vision || candidates[0]
    const fast = findById('qwen3.6-flash') || heavy
    if (needsVision && vision) {
      return { provider, model: vision.id, label: vision.label, reason: 'dashscope_vision' }
    }
    if (signals.highLoad || signals.heavyHit) {
      return { provider, model: heavy.id, label: heavy.label, reason: 'dashscope_heavy' }
    }
    return { provider, model: fast.id, label: fast.label, reason: 'dashscope_fast' }
  }

  const preferred = findById('gpt-4o-mini') || candidates[0]
  return { provider, model: preferred.id, label: preferred.label, reason: 'custom_fallback' }
}

function getPreset(provider, model) {
  if (isAutoModel(model)) return getAutoPreset(provider)
  return MODEL_CATALOG.find(item => item.provider === provider && item.id === model) || null
}

function resolveProfile(settings = {}) {
  const provider = String(settings.llmProvider || inferProvider(settings.apiEndpoint)).trim() || 'custom'
  const model = String(settings.model || (provider === 'dashscope' ? 'qwen3.6-flash' : 'gpt-4o-mini')).trim()
  const preset = getPreset(provider, model)
  const explicit = settings.llmProfile && typeof settings.llmProfile === 'object'
    ? settings.llmProfile
    : {}
  return {
    provider,
    model,
    label: preset?.label || model,
    contextWindow: Number(explicit.contextWindow || preset?.contextWindow) || 32768,
    maxOutput: Number(explicit.maxOutput || preset?.maxOutput) || 4096,
    supportsTools: explicit.supportsTools !== undefined
      ? Boolean(explicit.supportsTools)
      : preset?.supportsTools !== false,
    supportsVision: explicit.supportsVision !== undefined
      ? Boolean(explicit.supportsVision)
      : preset?.supportsVision === true,
    parameter: explicit.parameter || preset?.parameter || 'max_tokens',
  }
}

function publicProfile(settings = {}) {
  const profile = resolveProfile(settings)
  return {
    provider: profile.provider,
    model: profile.model,
    label: profile.label,
    contextWindow: profile.contextWindow,
    maxOutput: profile.maxOutput,
    supportsTools: profile.supportsTools,
    supportsVision: profile.supportsVision,
  }
}

function listCatalog(settings = {}) {
  const current = resolveProfile(settings)
  const includeUnsupported = settings.includeUnsupportedModels === true
  const groups = PROVIDERS.map(provider => ({
    id: provider.id,
    label: provider.label,
    models: [
      getAutoPreset(provider.id),
      ...(includeUnsupported
        ? getModels(provider.id)
        : getSupportedModels(provider.id)),
    ].map(model => ({
      id: model.id,
      label: model.label,
      contextWindow: model.contextWindow,
      maxOutput: model.maxOutput,
      supportsTools: model.supportsTools !== false,
      supportsVision: model.supportsVision === true,
      supported: model.supported !== false,
    })),
  }))
  const knownIds = new Set([AUTO_MODEL_ID, ...MODEL_CATALOG.map(model => model.id)])
  if (current.model && !knownIds.has(current.model)) {
    const customGroup = groups.find(group => group.id === 'custom') || groups[groups.length - 1]
    if (customGroup && !customGroup.models.some(model => model.id === current.model)) {
      customGroup.models.push({
        id: current.model,
        label: current.label || current.model,
        contextWindow: current.contextWindow,
        maxOutput: current.maxOutput,
        supportsTools: current.supportsTools !== false,
        supportsVision: current.supportsVision === true,
        supported: current.supportsTools !== false && Number(current.contextWindow) >= 64000,
      })
    }
  } else if (current.model) {
    const targetGroup = groups.find(group => group.id === current.provider)
    const baseModel = getPreset(current.provider, current.model)
    if (
      targetGroup &&
      baseModel &&
      !isSupportedForKnowMe(baseModel) &&
      !targetGroup.models.some(model => model.id === current.model)
    ) {
      targetGroup.models.push({
        id: baseModel.id,
        label: baseModel.label,
        contextWindow: baseModel.contextWindow,
        maxOutput: baseModel.maxOutput,
        supportsTools: baseModel.supportsTools !== false,
        supportsVision: baseModel.supportsVision === true,
        supported: false,
      })
    }
  }
  return {
    providers: PROVIDERS,
    groups,
    current: {
      provider: current.provider,
      model: current.model,
      label: current.label,
      contextWindow: current.contextWindow,
      maxOutput: current.maxOutput,
      supportsTools: current.supportsTools,
      supportsVision: current.supportsVision,
      supported: current.supportsTools !== false && Number(current.contextWindow) >= 64000,
    },
  }
}

function resolveRuntimeModel(settings = {}, routeInput = {}) {
  const requestedModel = String(settings.model || 'gpt-4o-mini').trim()
  if (!isAutoModel(requestedModel)) {
    const profile = resolveProfile(settings)
    return {
      requestedModel,
      model: profile.model,
      label: profile.label,
      provider: profile.provider,
      profile,
      autoRouted: false,
      autoReason: null,
    }
  }
  const routed = pickAutoModel(settings, routeInput)
  const profile = resolveProfile({
    ...settings,
    llmProvider: routed.provider,
    model: routed.model,
    llmProfile: null,
  })
  return {
    requestedModel,
    model: profile.model,
    label: `${AUTO_MODEL_LABEL} · ${profile.label}`,
    provider: profile.provider,
    profile: { ...profile, label: `${AUTO_MODEL_LABEL} · ${profile.label}` },
    autoRouted: true,
    autoReason: routed.reason,
  }
}

module.exports = {
  AUTO_MODEL_ID,
  AUTO_MODEL_LABEL,
  MODEL_CATALOG,
  PROVIDERS,
  isAutoModel,
  isSupportedForKnowMe,
  inferProvider,
  getModels,
  getSupportedModels,
  getPreset,
  pickAutoModel,
  resolveProfile,
  resolveRuntimeModel,
  publicProfile,
  listCatalog,
}
