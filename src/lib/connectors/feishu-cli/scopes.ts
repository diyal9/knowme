/**
 * feishu-cli/scopes — 飞书 user scope 解析与当前授权身份。
 * 不负责：CLI spawn（见 core）或工作流业务逻辑。
 */
'use strict'

const {
  runLarkCli,
  parseCliJsonOutput,
} = require('./core')

function parseMissingScopeError(text = '') {
  const parsed = parseCliJsonOutput(text)
  const err = parsed && typeof parsed === 'object' ? parsed.error : null
  if (!err || typeof err !== 'object') return null
  const scopes = Array.isArray(err.missing_scopes)
    ? err.missing_scopes.map((s) => String(s || '').trim()).filter(Boolean)
    : []
  const isMissingScope = err.subtype === 'missing_scope' || scopes.length > 0
  if (!isMissingScope) return null
  return {
    missingScopes: scopes,
    identity: String(err.identity || parsed.identity || '').trim() || null,
    hint: String(err.hint || '').trim() || null,
    rawMessage: String(err.message || '').trim() || null,
  }
}

/** Build a precise, non-misleading user message naming the exact missing scope(s). */
function describeMissingScopes(missingScopes = []) {
  const list = (Array.isArray(missingScopes) ? missingScopes : []).filter(Boolean)
  if (!list.length) return '飞书用户授权缺少所需权限，请补充授权后重试。'
  return `飞书用户授权缺少权限：${list.join('、')}。可一键补充授权后自动重试。`
}

/**
 * Query the user's currently granted scopes from lark-cli — the authoritative
 * "what we already have" source (equivalent to the token `scope` field).
 * Returns { ok, scopes:[], tokenStatus, userName }; scopes is empty when unauthorized.
 */
async function getGrantedUserScopes(opts = {}) {
  const result = await runLarkCli(['auth', 'status'], opts)
  const parsed = parseCliJsonOutput(result.text || result.message || '')
  const user = parsed && parsed.identities && parsed.identities.user ? parsed.identities.user : null
  if (!user) {
    return { ok: false, scopes: [], tokenStatus: null, userName: null, message: result.message || '无法读取飞书授权状态' }
  }
  const scopes = String(user.scope || '').split(/\s+/).map((s) => s.trim()).filter(Boolean)
  return {
    ok: user.status === 'ready' && user.tokenStatus === 'valid',
    scopes,
    tokenStatus: String(user.tokenStatus || '') || null,
    userName: String(user.userName || '') || null,
  }
}

async function resolveCurrentUserIdentity(opts = {}) {
  try {
    const res = await runLarkCli(['auth', 'status'], opts)
    if (!res || !res.ok) return null
    const parsed = parseCliJsonOutput(res.text)
    const user = parsed && parsed.identities && parsed.identities.user
    if (!user) return null
    const openId = String(user.openId || user.open_id || '').trim()
    const userName = String(user.userName || user.user_name || '').trim()
    if (!openId && !userName) return null
    return { openId, userName }
  } catch {
    return null
  }
}

module.exports = {
  parseMissingScopeError,
  describeMissingScopes,
  getGrantedUserScopes,
  resolveCurrentUserIdentity,
}
