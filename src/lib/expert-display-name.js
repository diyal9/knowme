'use strict'

/**
 * expert-display-name — 从专家包已有的中文信息里推导面向用户的展示名。
 * 纯本地推导：不调用模型、不访问网络；推导不出时保留源名字。
 */

const CJK_RE = /[\u3400-\u4dbf\u4e00-\u9fff]/
const MAX_LEN = 20
const ROLE_SUFFIX_RE = /(专家|助手|伙伴|顾问|工程师|教练|管家|搭子|分析师|设计师|策划)$/
const LANGUAGE_PREFIX_RE = /^(简体中文|中文说明|中文|Chinese|CN)\s*[：:]\s*/i
const OTHER_LANGUAGE_RE = /(?:^|[\s。；;])(English|EN|Japanese|JP)\s*[：:]/i
const SEGMENT_RE = /[：:。；;、，,\n]/
const TITLE_KEYS = Object.freeze(['displayName', 'title', 'nameZh', 'zhName'])

function hasChineseText(value) {
  return CJK_RE.test(String(value || ''))
}

function cleanupPhrase(value) {
  return String(value || '')
    .replace(/[*_`#>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[-—·:：、,，/|]+/, '')
    .replace(/[-—·:：、,，/|。；;]+$/, '')
    .trim()
}

function acceptable(value) {
  const phrase = cleanupPhrase(value)
  if (!phrase || !hasChineseText(phrase)) return ''
  return phrase.length > MAX_LEN ? '' : phrase
}

/** 剥离「中文：」这类语种前缀，并截断到其他语种版本之前 */
function stripLanguageMarkers(description) {
  let text = String(description || '').trim().replace(LANGUAGE_PREFIX_RE, '')
  const other = text.search(OTHER_LANGUAGE_RE)
  if (other > 0) text = text.slice(0, other)
  return text.trim()
}

function descriptionSegments(description) {
  const text = stripLanguageMarkers(description).replace(/[（(][^）)]*[）)]/g, '')
  if (!text) return []
  return text.split(SEGMENT_RE).map(cleanupPhrase).filter(Boolean)
}

function personaRole(input = {}) {
  const persona = input.persona && typeof input.persona === 'object' ? input.persona : {}
  return persona.role || persona.title || ''
}

function explicitTitle(input = {}) {
  const frontmatter = input.frontmatter && typeof input.frontmatter === 'object' ? input.frontmatter : {}
  for (const key of TITLE_KEYS) {
    const value = input[key] || frontmatter[key]
    if (value) return value
  }
  return ''
}

/**
 * 推导展示名。优先级：已含中文的 name → 显式标题字段 → description 中的角色短语
 * → persona.role → description 首段 → 源 name 原样。
 *
 * @param {{ name?: string, description?: string, persona?: object, frontmatter?: object }} input
 * @returns {{ name: string, source: 'name'|'title'|'description-role'|'persona'|'description'|'fallback' }}
 */
function deriveExpertDisplayName(input = {}) {
  const rawName = String(input.name || '').trim()
  if (hasChineseText(rawName)) return { name: rawName, source: 'name' }

  const title = acceptable(explicitTitle(input))
  if (title) return { name: title, source: 'title' }

  const segments = descriptionSegments(input.description)
  for (const segment of segments.slice(0, 2)) {
    const phrase = acceptable(segment)
    if (phrase && ROLE_SUFFIX_RE.test(phrase)) return { name: phrase, source: 'description-role' }
  }

  const role = acceptable(personaRole(input))
  if (role) return { name: role, source: 'persona' }

  const lead = acceptable(segments[0])
  if (lead) return { name: lead, source: 'description' }

  return { name: rawName, source: 'fallback' }
}

module.exports = {
  MAX_LEN,
  deriveExpertDisplayName,
  hasChineseText,
  stripLanguageMarkers,
}
