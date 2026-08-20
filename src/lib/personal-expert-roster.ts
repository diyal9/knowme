'use strict'

const MAX_COMMON_EXPERTS = 12

function clean(value, max = 240) {
  return String(value == null ? '' : value).trim().replace(/\s+/g, ' ').slice(0, max)
}

function commonExpertIds(modeState = {}) {
  const seen = new Set()
  const ids = []
  const bindings = modeState && typeof modeState.bindings === 'object' ? modeState.bindings : {}
  for (const rows of Object.values(bindings)) {
    for (const row of Array.isArray(rows) ? rows : []) {
      const id = clean(row?.expertId, 80)
      if (!id || seen.has(id)) continue
      seen.add(id)
      ids.push(id)
      if (ids.length >= MAX_COMMON_EXPERTS) return ids
    }
  }
  return ids
}

function projectCommonExperts(modeState = {}, catalogItems = []) {
  const byId = new Map((Array.isArray(catalogItems) ? catalogItems : []).map(item => [clean(item?.id, 80), item]))
  return commonExpertIds(modeState).flatMap(id => {
    const item = byId.get(id)
    if (!item || item.kind !== 'expert' || item.enabled === false) return []
    return [{
      id,
      name: clean(item.name || id, 80),
      description: clean(item.description, 220),
      category: clean(item.category, 60),
      status: 'common',
    }]
  })
}

function buildCommonExpertContext(experts = []) {
  const rows = (Array.isArray(experts) ? experts : []).slice(0, MAX_COMMON_EXPERTS)
  if (!rows.length) return ''
  return [
    '## 我的常用专家',
    '以下是用户在工作台设为常用的私人专家 Agent。可以根据任务推荐其中一位，但在正式转接前必须向用户展示最小委托上下文并获得确认。',
    ...rows.map(item => `- ${clean(item.name, 80)} (${clean(item.id, 80)})${item.category ? ` · ${clean(item.category, 60)}` : ''}：${clean(item.description, 220) || '按专家契约完成单项专业任务'}`),
    '这份名单只用于推荐与路由；不代表可以自动读取专家历史任务、私人知识或凭据。',
  ].join('\n')
}

module.exports = { MAX_COMMON_EXPERTS, commonExpertIds, projectCommonExperts, buildCommonExpertContext }
