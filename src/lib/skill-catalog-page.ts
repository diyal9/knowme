'use strict'

const crypto = require('crypto')

const DEFAULT_SKILL_PAGE_LIMIT = 10
const MAX_SKILL_PAGE_LIMIT = 30
const MAX_SKILL_PAGE_CHARS = 12000

function validateSkillCatalogPage(args = {}) {
  const query = args.query === undefined ? '' : args.query
  const cursor = args.cursor === undefined ? '' : args.cursor
  const limit = args.limit === undefined ? DEFAULT_SKILL_PAGE_LIMIT : args.limit
  if (typeof query !== 'string' || query.length > 200 || typeof cursor !== 'string' || cursor.length > 256
    || !Number.isSafeInteger(limit) || limit < 1 || limit > MAX_SKILL_PAGE_LIMIT) {
    return { ok: false, code: 'invalid_args', message: 'list_skills query 最多 200 字符；cursor 必须为上一页返回值；limit 必须为 1–30 的整数。' }
  }
  return { ok: true, args: { query: query.trim(), cursor, limit } }
}

function pageSkillCatalog(records, args = {}) {
  const validation = validateSkillCatalogPage(args)
  if (!validation.ok) return validation
  const { query, cursor, limit } = validation.args
  const search = query.toLowerCase()
  const matches = records.filter(item => !search || [item.id, item.name, item.description]
    .some(value => String(value || '').toLowerCase().includes(search)))
    .sort((a, b) => a.id.localeCompare(b.id))
  const revision = crypto.createHash('sha256').update(JSON.stringify([search, matches])).digest('hex').slice(0, 24)
  let offset = 0
  if (cursor) {
    try {
      if (!/^[A-Za-z0-9_-]+$/.test(cursor)) throw new Error('invalid cursor')
      const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))
      if (decoded.revision !== revision || !Number.isSafeInteger(decoded.offset) || decoded.offset < 0 || decoded.offset > matches.length) throw new Error('stale cursor')
      offset = decoded.offset
    } catch {
      return { ok: false, code: 'invalid_cursor', message: '技能目录、查询或权限已变化，或 cursor 无效；请清空 cursor 重新调用 list_skills。' }
    }
  }
  const skills = []
  let chars = 0
  let next = offset
  for (const record of matches.slice(offset, offset + limit)) {
    const description = String(record.description || '')
    const name = String(record.name || record.id)
    const item = {
      id: record.id, name: name.slice(0, 160), description: description.slice(0, 240),
      source: record.source, disableModelInvocation: Boolean(record.disableModelInvocation),
      metadataTruncated: description.length > 240 || name.length > 160,
    }
    const size = JSON.stringify(item).length
    if (size > MAX_SKILL_PAGE_CHARS) return { ok: false, code: 'skill_metadata_too_large', message: '技能标识/来源元数据过大；请修复技能目录后重试。' }
    if (chars + size > MAX_SKILL_PAGE_CHARS) break
    skills.push(item)
    chars += size
    next++
  }
  const nextCursor = next < matches.length
    ? Buffer.from(JSON.stringify({ revision, offset: next })).toString('base64url') : null
  return { ok: true, skills, total: matches.length, nextCursor }
}

module.exports = { validateSkillCatalogPage, pageSkillCatalog, DEFAULT_SKILL_PAGE_LIMIT, MAX_SKILL_PAGE_LIMIT }
