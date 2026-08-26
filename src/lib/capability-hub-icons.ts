'use strict'

/**
 * 能力 Hub 卡片图标：按工作域选代表图标（KnowMeIcons 名）。
 * 专家有头像时由渲染层优先显示头像。
 */
;(function initCapabilityHubIcons(global) {
  if (global.CapabilityHubIcons) return

  const DOMAIN_ICONS = Object.freeze({
    产品与研究: 'clipboardCheck',
    内容写作: 'pencilLine',
    视觉创意: 'image',
    日常办公: 'clipboardCheck',
    数据分析: 'optimize',
    软件研发: 'code',
    知识研究: 'bookOpen',
    写作: 'pencilLine',
    游戏: 'gamepad',
    研发: 'code',
    开发: 'code',
    办公: 'clipboardCheck',
    知识: 'bookOpen',
    视觉: 'image',
    效率: 'clipboardCheck',
    飞书: 'clipboardCheck',
    能力包: 'optimize',
  })

  const KIND_FALLBACK = Object.freeze({
    expert: 'users',
    skill: 'optimize',
    connector: 'network',
  })

  function resolveCapabilityIcon(item = {}) {
    const kind = String(item.kind || 'skill')
    if (kind === 'expert' && String(item.avatar || '').trim()) {
      return { icon: KIND_FALLBACK.expert, avatarPreferred: true }
    }
    if (kind === 'connector') {
      const cat = String(item.category || '')
      if (/飞书|feishu|lark/i.test(cat) || /feishu|lark/i.test(String(item.id || ''))) {
        return { icon: 'wechat', avatarPreferred: false }
      }
      if (/mcp/i.test(cat)) return { icon: 'network', avatarPreferred: false }
      if (/知识/i.test(cat)) return { icon: 'bookOpen', avatarPreferred: false }
      return { icon: KIND_FALLBACK.connector, avatarPreferred: false }
    }
    const category = String(item.category || '').trim()
    const fromDomain = DOMAIN_ICONS[category]
    if (fromDomain) return { icon: fromDomain, avatarPreferred: false }
    const cats = Array.isArray(item.categories) ? item.categories : []
    for (const cat of cats) {
      const mapped = DOMAIN_ICONS[String(cat || '').trim()]
      if (mapped) return { icon: mapped, avatarPreferred: false }
    }
    return { icon: KIND_FALLBACK[kind] || KIND_FALLBACK.skill, avatarPreferred: false }
  }

  const exported = {
    DOMAIN_ICONS,
    KIND_FALLBACK,
    resolveCapabilityIcon,
  }

  if (typeof module === 'object' && module.exports) module.exports = exported
  global.CapabilityHubIcons = exported
})(typeof window !== 'undefined' ? window : globalThis)
