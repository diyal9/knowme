'use strict'

const zhCN = require('./zh-CN')

const FALLBACK_LOCALE = 'zh-CN'
const packs = new Map([[zhCN.locale, zhCN]])

function normalizeLocale(value) {
  const raw = String(value || '').trim()
  if (!raw) return FALLBACK_LOCALE
  if (packs.has(raw)) return raw
  const base = raw.split(/[-_]/)[0].toLowerCase()
  const match = [...packs.keys()].find(locale => locale.toLowerCase().startsWith(`${base}-`))
  return match || FALLBACK_LOCALE
}

function getLocalePack(locale) {
  return packs.get(normalizeLocale(locale)) || zhCN
}

function getPromptBlock(id, locale) {
  const requested = getLocalePack(locale)
  return requested.blocks[id] || zhCN.blocks[id] || null
}

function listPromptBlocks(ids = [], locale) {
  return [...new Set(Array.isArray(ids) ? ids : [])]
    .map(id => getPromptBlock(id, locale))
    .filter(Boolean)
    .map(block => ({ ...block, locale: normalizeLocale(locale), source: {
      type: 'prompt-registry',
      id: block.id,
      version: String(getLocalePack(locale).version),
    } }))
}

module.exports = {
  FALLBACK_LOCALE,
  normalizeLocale,
  getLocalePack,
  getPromptBlock,
  listPromptBlocks,
}
