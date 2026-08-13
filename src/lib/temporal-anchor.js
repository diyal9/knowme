'use strict'

/**
 * Build a local-clock temporal anchor block for LLM relative-time grounding.
 * @param {Date|string|number} [now=new Date()]
 * @returns {string}
 */
function buildTemporalAnchorContext(now = new Date()) {
  const current = now instanceof Date ? now : new Date(now)
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][current.getDay()]
  const pad = n => String(n).padStart(2, '0')
  const localDate = `${current.getFullYear()}-${pad(current.getMonth() + 1)}-${pad(current.getDate())}`
  const localTime = `${pad(current.getHours())}:${pad(current.getMinutes())}:${pad(current.getSeconds())}`
  const tzName = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local'
  return [
    '【当前本地时间锚点】',
    `本地日期: ${localDate} (${weekday})`,
    `本地时间: ${localTime}`,
    `时区: ${tzName}`,
    `ISO时间: ${current.toISOString()}`,
    '规则: 解释“昨天/今天/明天/上周”等相对时间时，必须严格基于以上锚点换算；不允许猜测年份。',
  ].join('\n')
}

module.exports = { buildTemporalAnchorContext }
