'use strict'

const PROMPT_SCHEMA_VERSION = 1
const PROMPT_WARNING_CHARS = 6000
const PROMPT_ERROR_CHARS = 20000

function compactText(value, max = PROMPT_ERROR_CHARS + 1) {
  return String(value || '').replace(/\r\n/g, '\n').trim().slice(0, max)
}

function normalizeExpertPromptSchema(source = {}) {
  const prompt = compactText(source.systemPrompt)
  const sop = compactText(source.sop || prompt)
  return {
    schemaVersion: PROMPT_SCHEMA_VERSION,
    identity: {
      name: compactText(source.name, 160),
      role: compactText(source.role || source.description, 500),
      soul: compactText(source.soul, 2400),
    },
    objective: compactText(source.description, 1200),
    scope: {
      useCases: (Array.isArray(source.useCases) ? source.useCases : []).map(item => compactText(item, 300)).filter(Boolean).slice(0, 12),
      boundaries: (Array.isArray(source.boundaries) ? source.boundaries : []).map(item => compactText(item, 400)).filter(Boolean).slice(0, 16),
    },
    method: {
      agenticType: compactText(source.agenticType || 'react', 40),
      sop,
    },
    contracts: {
      inputs: (Array.isArray(source.inputContract) ? source.inputContract : []).map(item => compactText(item, 400)).filter(Boolean).slice(0, 16),
      outputs: (Array.isArray(source.outputContract) ? source.outputContract : []).map(item => compactText(item, 400)).filter(Boolean).slice(0, 16),
    },
    capabilities: {
      skills: (Array.isArray(source.skills) ? source.skills : []).map(String).slice(0, 32),
      connectors: (Array.isArray(source.connectors) ? source.connectors : []).map(String).slice(0, 32),
    },
    legacyPrompt: prompt,
  }
}

function normalizedComparable(value) {
  return String(value || '').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '')
}

function lintExpertPrompt(source = {}) {
  const schema = normalizeExpertPromptSchema(source)
  const issues = []
  const add = (severity, code, message, field = '') => issues.push({ severity, code, message, field })
  const combinedParts = []
  const comparableParts = new Set()
  for (const text of [schema.identity.soul, schema.method.sop, schema.legacyPrompt].filter(Boolean)) {
    const comparable = normalizedComparable(text)
    if (!comparable || comparableParts.has(comparable)) continue
    comparableParts.add(comparable)
    combinedParts.push(text)
  }
  const combined = combinedParts.join('\n')
  if (combined.length > PROMPT_ERROR_CHARS) {
    add('error', 'prompt_too_large', `专家提示词超过 ${PROMPT_ERROR_CHARS} 字符上限`, 'systemPrompt')
  } else if (combined.length > PROMPT_WARNING_CHARS) {
    add('warning', 'prompt_large', `专家提示词超过建议的 ${PROMPT_WARNING_CHARS} 字符`, 'systemPrompt')
  }
  const overridePatterns = [
    /忽略.{0,20}(?:系统|平台|开发者).{0,12}(?:规则|指令|提示)/i,
    /(?:绕过|关闭|取消).{0,16}(?:权限|审批|确认|安全)/i,
    /system\s*override|ignore\s+(?:all\s+)?(?:previous|system|developer)\s+instructions/i,
    /reveal\s+(?:secrets?|api\s*keys?|tokens?)/i,
  ]
  if (overridePatterns.some(pattern => pattern.test(combined))) {
    add('error', 'authority_override', '专家提示词试图覆盖平台、权限或安全规则', 'systemPrompt')
  }
  const raw = source.frontmatter && typeof source.frontmatter === 'object' ? source.frontmatter : source
  const hasExplicitSop = Object.prototype.hasOwnProperty.call(raw, 'sop') && String(raw.sop || '').trim()
  const hasExplicitPrompt = Object.prototype.hasOwnProperty.call(raw, 'systemPrompt') && String(raw.systemPrompt || '').trim()
  const sopComparable = normalizedComparable(hasExplicitSop ? raw.sop : '')
  const promptComparable = normalizedComparable(hasExplicitPrompt ? raw.systemPrompt : '')
  if (hasExplicitSop && hasExplicitPrompt && sopComparable.length > 80 && promptComparable.length > 80
    && (sopComparable.includes(promptComparable) || promptComparable.includes(sopComparable))) {
    add('warning', 'duplicate_sop_prompt', 'SOP 与 systemPrompt 高度重复，建议只保留结构化 SOP', 'sop')
  }
  if (schema.identity.name && !/工作伙伴/.test(schema.identity.name) && /(?:你是|作为).{0,8}(?:通用)?工作伙伴/.test(combined)) {
    add('warning', 'generic_identity_overlap', '专家提示词包含通用“工作伙伴”身份，可能与专家身份冲突', 'systemPrompt')
  }
  const imperativeCount = (combined.match(/必须|禁止|绝不|务必|始终|不得/g) || []).length
  if (imperativeCount > 14) {
    add('warning', 'imperative_density', '强制指令过密，建议将通用安全规则交给平台层，只保留专家特有边界', 'systemPrompt')
  }
  const connectorSet = new Set(schema.capabilities.connectors.map(item => item.toLowerCase()))
  const toolNamespaces = [...new Set((combined.match(/\b[a-z][a-z0-9_-]{1,40}\.[a-z][a-z0-9_.-]{1,80}\b/gi) || [])
    .filter(item => !/\.(?:md|json|ya?ml|txt|ts|tsx|js|jsx|py|toml|ini)$/i.test(item))
    .map(item => item.split('.')[0].toLowerCase()))]
  const unbound = toolNamespaces.filter(namespace => !connectorSet.has(namespace))
  if (unbound.length) {
    add('warning', 'unbound_tool_namespace', `提示词引用了未绑定的工具命名空间：${unbound.join('、')}`, 'connectors')
  }
  if (!schema.contracts.outputs.length) {
    add('warning', 'missing_output_contract', '建议声明 outputContract，使交付和验收可验证', 'outputContract')
  }
  return {
    ok: !issues.some(item => item.severity === 'error'),
    schema,
    issues,
    errors: issues.filter(item => item.severity === 'error'),
    warnings: issues.filter(item => item.severity === 'warning'),
  }
}

module.exports = {
  PROMPT_SCHEMA_VERSION,
  PROMPT_WARNING_CHARS,
  PROMPT_ERROR_CHARS,
  normalizeExpertPromptSchema,
  lintExpertPrompt,
}
