'use strict'

/**
 * 五段 cron（分 时 日 月 周）下次触发。仅本机 App tick，不做系统 crontab。
 */

const FIELD_BOUNDS = [
  [0, 59],
  [0, 23],
  [1, 31],
  [1, 12],
  [0, 6],
]

function parseField(raw, min, max) {
  const text = String(raw || '').trim()
  if (!text || text === '*') {
    const all = []
    for (let n = min; n <= max; n += 1) all.push(n)
    return all
  }
  const out = new Set()
  for (const part of text.split(',')) {
    const [range, stepRaw] = part.split('/')
    const step = stepRaw ? Number(stepRaw) : 1
    if (!Number.isFinite(step) || step < 1) return null
    let start
    let end
    if (range === '*') {
      start = min
      end = max
    } else if (range.includes('-')) {
      const [a, b] = range.split('-').map(Number)
      start = a
      end = b
    } else {
      start = Number(range)
      end = start
    }
    if (!Number.isFinite(start) || !Number.isFinite(end)) return null
    if (start < min || end > max || start > end) return null
    for (let n = start; n <= end; n += step) out.add(n)
  }
  return [...out].sort((a, b) => a - b)
}

/** 合法五段 cron 返回字段集合；非法返回 null。 */
function parseCronExpr(expr) {
  const parts = String(expr || '').trim().split(/\s+/)
  if (parts.length !== 5) return null
  const fields = []
  for (let i = 0; i < 5; i += 1) {
    const parsed = parseField(parts[i], FIELD_BOUNDS[i][0], FIELD_BOUNDS[i][1])
    if (!parsed || !parsed.length) return null
    fields.push(parsed)
  }
  return { minute: fields[0], hour: fields[1], day: fields[2], month: fields[3], dow: fields[4] }
}

function matches(parsed, date) {
  return parsed.minute.includes(date.getMinutes())
    && parsed.hour.includes(date.getHours())
    && parsed.month.includes(date.getMonth() + 1)
    && parsed.day.includes(date.getDate())
    && parsed.dow.includes(date.getDay())
}

/**
 * 从 fromDate 的下一分钟起找下次命中；最多扫 366 天。
 * @returns {string} ISO 或空串
 */
function nextCronRunAt(expr, fromDate = new Date()) {
  const parsed = parseCronExpr(expr)
  if (!parsed) return ''
  const start = fromDate instanceof Date ? fromDate : new Date(fromDate)
  if (!Number.isFinite(start.getTime())) return ''
  const cursor = new Date(start)
  cursor.setSeconds(0, 0)
  cursor.setMinutes(cursor.getMinutes() + 1)
  const limit = cursor.getTime() + 366 * 24 * 3600 * 1000
  while (cursor.getTime() <= limit) {
    if (matches(parsed, cursor)) return cursor.toISOString()
    cursor.setMinutes(cursor.getMinutes() + 1)
  }
  return ''
}

module.exports = {
  parseCronExpr,
  nextCronRunAt,
}
