'use strict'

function capabilityDiscoveryScore(rawQuery, item) {
  const query = String(rawQuery || '').toLowerCase().trim().slice(0, 200)
  if (!query) return 1
  const tokens = [...new Set([
    ...(query.match(/[a-z0-9_-]+/g) || []),
    ...(query.match(/[\u3400-\u9fff]+/g) || []).flatMap(part => Array.from({ length: Math.max(0, part.length - 1) }, (_, i) => part.slice(i, i + 2))),
  ])].filter(token => !['查找', '搜索', '查询', '能力', '工具', '帮我', '使用', 'find', 'search', 'tools', 'capability'].includes(token)).slice(0, 40)
  const title = `${item.name || ''} ${item.id || ''}`.toLowerCase()
  const body = `${item.description || ''} ${item.keywords || ''}`.toLowerCase()
  return (title.includes(query) ? 10 : 0)
    + tokens.reduce((sum, token) => {
      const weight = ['文档', '文件', '消息', 'documents', 'document', 'files'].includes(token) ? 1 : 3
      return sum + (title.includes(token) ? weight : body.includes(token) ? 1 : 0)
    }, 0)
}

module.exports = { capabilityDiscoveryScore }
