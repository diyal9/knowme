'use strict'

const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const {
  FEISHU_AUTH_DOMAIN_LIST,
  FEISHU_AUTH_DOMAINS,
  FEISHU_AUTH_SCOPE_LIST,
  FEISHU_AUTH_SCOPES,
  FEISHU_PERMISSION_PROFILE,
  FEISHU_CAPABILITY_PROFILE,
  INVALID_SCOPE_RE,
  SCOPE_TOKEN_RE,
  summarizeFeishuPermissions,
  summarizeFeishuCapabilityReadiness,
  findUnrequestedPermissionCategories,
  planFeishuScopeRequest,
  missingPermissionCategoryIds,
} = require('./feishu-auth-scopes')

const DEFAULT_TIMEOUT_MS = 20000
let pollChild = null
let pendingAuth = null

function defaultBin() {
  return process.platform === 'win32' ? 'lark-cli.cmd' : 'lark-cli'
}

function quoteCmdArg(value) {
  const text = String(value)
  if (/^[A-Za-z0-9_@%+=:,./\\-]+$/.test(text)) return text
  return `"${text.replace(/"/g, '\\"')}"`
}

function commandFor(bin, args) {
  if (process.platform !== 'win32') return [bin, args]
  const command = [bin, ...args].map(quoteCmdArg).join(' ')
  return [process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', command]]
}

function parseJsonLine(text) {
  const lines = String(text || '').trim().split(/\r?\n/).filter(Boolean)
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    try { return JSON.parse(lines[i]) } catch { /* keep looking */ }
  }
  return null
}

function normalizeVerificationUrl(value) {
  let text = String(value || '').trim()
  for (let i = 0; i < 6; i += 1) {
    if (!text) break
    const escapedWrapped = text.match(/^\\+(['"])([\s\S]*)\1\\+$/)
    if (escapedWrapped) {
      text = String(escapedWrapped[2] || '').trim()
      continue
    }
    const quoted =
      (text.startsWith('"') && text.endsWith('"')) ||
      (text.startsWith('\'') && text.endsWith('\'')) ||
      (text.startsWith('“') && text.endsWith('”')) ||
      (text.startsWith('”') && text.endsWith('“'))
    if (quoted) {
      text = text.slice(1, -1).trim()
      continue
    }
    try {
      const parsed = JSON.parse(text)
      if (typeof parsed === 'string') {
        text = parsed.trim()
        continue
      }
    } catch {
      // keep current text
    }
    break
  }
  return text
    .replace(/^\\+/, '')
    .replace(/^['"“”]+|['"“”]+$/g, '')
    .replace(/\\"/g, '"')
    .replace(/\\'/g, '\'')
    .replace(/\\+$/, '')
    .trim()
}

function resetPendingAuth() {
  pendingAuth = null
}

/**
 * Build the ordered `auth login` attempts.
 *
 * `extraScopes` carries scopes discovered at runtime (from a tool's structured
 * missing_scope error) so just-in-time re-authorization requests exactly what the
 * failing operation needs — instead of relying on a hand-maintained scope list.
 * Feishu accumulates historically granted scopes, so merging keeps existing
 * capabilities while adding the newly required one.
 */
function buildAuthLoginAttempts(extraScopes = []) {
  const { accepted } = sanitizeExtraScopes(extraScopes)
  const withExtra = [...FEISHU_AUTH_SCOPE_LIST, ...accepted].join(',')
  const login = (...args) =>
    ['auth', 'login', '--domain', FEISHU_AUTH_DOMAINS, ...args, '--no-wait', '--json']
  const attempts = []
  // Preferred: curated scopes plus whatever the failing operation reported missing.
  if (accepted.length) attempts.push(login('--scope', withExtra, '--recommend'))
  // The curated list is known-good, so dropping the runtime extras keeps the round
  // alive when Feishu does not recognize a discovered scope name.
  attempts.push(login('--scope', FEISHU_AUTH_SCOPES, '--recommend'))
  // Compatibility fallback for older lark-cli versions that reject newer scope identifiers.
  attempts.push(login('--recommend'))
  attempts.push(login('--scope', FEISHU_AUTH_SCOPES))
  // Last fallback: domain-only request.
  attempts.push(login())
  return attempts
}

/** Reverse-map granted/missing scopes to friendly capability labels for UI cards. */
function describeScopeCapabilities(scopes = []) {
  const list = (Array.isArray(scopes) ? scopes : []).map((s) => String(s || '').trim()).filter(Boolean)
  const labels = []
  for (const cat of FEISHU_PERMISSION_PROFILE) {
    if (list.some((sc) => cat.requiredPrefixes.some((p) => sc === p || sc.startsWith(p)))) {
      labels.push(cat.label)
    }
  }
  return Array.from(new Set(labels))
}

function isInvalidScopeErrorMessage(text = '') {
  return INVALID_SCOPE_RE.test(String(text || ''))
}

/**
 * Feishu rejects the *entire* device-authorization request when any single scope
 * is unknown, so one malformed runtime-discovered scope would cost the user the
 * whole round. Keep only scope-shaped tokens; the caller reports the rest.
 */
function sanitizeExtraScopes(extraScopes = []) {
  const seen = new Set(FEISHU_AUTH_SCOPE_LIST)
  const accepted = []
  const rejected = []
  for (const raw of Array.isArray(extraScopes) ? extraScopes : []) {
    const scope = String(raw || '').trim()
    if (!scope || seen.has(scope)) continue
    seen.add(scope)
    if (SCOPE_TOKEN_RE.test(scope)) accepted.push(scope)
    else rejected.push(scope)
  }
  return { accepted, rejected }
}

function run(bin, args, opts = {}) {
  const injectedSpawn = typeof opts.spawnImpl === 'function'
  const spawnImpl = injectedSpawn ? opts.spawnImpl : spawn
  const timeoutMs = Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : DEFAULT_TIMEOUT_MS
  return new Promise((resolve) => {
    let child
    try {
      const command = process.platform === 'win32' && !injectedSpawn
        ? commandFor(bin, args)
        : [bin, args]
      child = spawnImpl(...command, {
        cwd: opts.cwd,
        windowsHide: true,
        shell: false,
        env: process.env,
      })
    } catch (error) {
      resolve({ ok: false, message: String(error?.message || error) })
      return
    }
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      try { child.kill() } catch { /* ignore */ }
      resolve({ ok: false, message: '飞书授权命令超时' })
    }, timeoutMs)
    child.stdout?.on('data', chunk => { stdout += String(chunk) })
    child.stderr?.on('data', chunk => { stderr += String(chunk) })
    child.on('error', error => {
      clearTimeout(timer)
      resolve({ ok: false, message: String(error?.message || error) })
    })
    child.on('close', code => {
      clearTimeout(timer)
      resolve({ ok: code === 0, code, stdout, stderr })
    })
  })
}

async function startFeishuAuth(userData, opts = {}) {
  if (pollChild) {
    const now = Date.now()
    if (pendingAuth && Number(pendingAuth.expiresAt || 0) > now + 2000) {
      return {
        ok: true,
        code: 'in_progress',
        message: '飞书授权已在进行中，请继续扫码或打开授权链接完成确认',
        verificationUrl: pendingAuth.verificationUrl,
        qrDataUrl: pendingAuth.qrDataUrl,
        expiresIn: Math.max(0, Math.floor((pendingAuth.expiresAt - now) / 1000)),
      }
    }
    try { pollChild.kill() } catch { /* ignore */ }
    pollChild = null
    resetPendingAuth()
  }
  const bin = opts.bin || process.env.KNOWME_LARK_CLI || defaultBin()
  let result = null
  // opts.scopes: runtime-discovered scopes for just-in-time incremental re-auth.
  const { accepted: extraScopes, rejected: droppedScopes } = sanitizeExtraScopes(opts.scopes)
  const attempts = buildAuthLoginAttempts(opts.scopes)
  let usedIndex = -1
  for (let i = 0; i < attempts.length; i += 1) {
    result = await run(bin, attempts[i], opts)
    usedIndex = i
    if (result?.ok) break
    const msg = String(result?.stderr || result?.stdout || result?.message || '')
    if (!isInvalidScopeErrorMessage(msg)) break
  }
  // Only the first attempt carries the runtime extras; falling past it means
  // Feishu refused one of them and this round requests the curated set only.
  const skippedScopes = extraScopes.length && usedIndex > 0 ? extraScopes : []
  if (!result?.ok) {
    return {
      ok: false,
      code: 'auth_start_failed',
      message: result?.stderr || result?.stdout || result?.message || '无法发起飞书授权',
    }
  }
  const payload = parseJsonLine(result.stdout)
  const url = normalizeVerificationUrl(payload?.verification_url)
  const deviceCode = String(payload?.device_code || '').trim()
  if (!url || !deviceCode) return { ok: false, code: 'invalid_auth_response', message: '飞书授权响应缺少验证地址' }

  const dir = String(userData || '')
  fs.mkdirSync(dir, { recursive: true })
  const qrPath = path.join(dir, 'feishu-auth-qr.png')
  const qr = await run(bin, ['auth', 'qrcode', url, '--output', 'feishu-auth-qr.png'], { ...opts, cwd: dir })
  if (!qr.ok || !fs.existsSync(qrPath)) {
    resetPendingAuth()
    return { ok: false, code: 'qr_failed', message: qr.stderr || '无法生成授权二维码' }
  }

  const pollCommand = commandFor(bin, ['auth', 'login', '--device-code', deviceCode])
  pollChild = spawn(...pollCommand, {
    cwd: dir,
    windowsHide: true,
    shell: false,
    env: process.env,
    stdio: 'ignore',
  })
  pollChild.once('close', () => {
    pollChild = null
    resetPendingAuth()
  })
  pollChild.once('error', () => {
    pollChild = null
    resetPendingAuth()
  })

  const qrDataUrl = `data:image/png;base64,${fs.readFileSync(qrPath).toString('base64')}`
  const expiresIn = Number(payload.expires_in || 600)
  pendingAuth = {
    verificationUrl: url,
    qrDataUrl,
    expiresAt: Date.now() + Math.max(1, expiresIn) * 1000,
  }

  return {
    ok: true,
    verificationUrl: url,
    qrDataUrl,
    expiresIn,
    droppedScopes,
    skippedScopes,
  }
}

module.exports = {
  FEISHU_AUTH_DOMAIN_LIST,
  FEISHU_AUTH_DOMAINS,
  FEISHU_AUTH_SCOPES,
  FEISHU_AUTH_SCOPE_LIST,
  FEISHU_CAPABILITY_PROFILE,
  FEISHU_PERMISSION_PROFILE,
  buildAuthLoginAttempts,
  describeScopeCapabilities,
  findUnrequestedPermissionCategories,
  isInvalidScopeErrorMessage,
  missingPermissionCategoryIds,
  parseJsonLine,
  planFeishuScopeRequest,
  sanitizeExtraScopes,
  normalizeVerificationUrl,
  summarizeFeishuCapabilityReadiness,
  summarizeFeishuPermissions,
  startFeishuAuth,
}
