'use strict'

const { spawn } = require('child_process')
const { summarizeFeishuPermissions } = require('./feishu-auth')

const DEFAULT_TIMEOUT_MS = 8000

function parseAuthJson(text) {
  try {
    return JSON.parse(String(text || ''))
  } catch {
    return null
  }
}

function defaultBin() {
  return process.platform === 'win32' ? 'lark-cli.cmd' : 'lark-cli'
}

function quoteCmdArg(value) {
  const text = String(value)
  if (/^[A-Za-z0-9_@%+=:,./\\-]+$/.test(text)) return text
  return `"${text.replace(/"/g, '\\"')}"`
}

/**
 * L0 probe — never writes to Feishu.
 * @param {{ bin?: string, timeoutMs?: number, spawnImpl?: typeof spawn }} [opts]
 */
function probeFeishuStatus(opts = {}) {
  const bin = opts.bin || process.env.KNOWME_LARK_CLI || defaultBin()
  const timeoutMs = Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : DEFAULT_TIMEOUT_MS
  const injectedSpawn = typeof opts.spawnImpl === 'function'
  const spawnImpl = injectedSpawn ? opts.spawnImpl : spawn

  return new Promise((resolve) => {
    let settled = false
    const finish = (result) => {
      if (settled) return
      settled = true
      resolve(result)
    }

    let child
    try {
      // lark-cli auth status already emits JSON; older versions reject
      // the generic --format flag.
      const command = process.platform === 'win32' && !injectedSpawn
        ? [process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', [bin, 'auth', 'status'].map(quoteCmdArg).join(' ')]]
        : [bin, ['auth', 'status']]
      child = spawnImpl(...command, {
        windowsHide: true,
        shell: false,
        env: process.env,
      })
    } catch (err) {
      return finish({
        ok: false,
        state: 'offline',
        message: String(err?.message || '无法启动 lark-cli'),
        identity: null,
      })
    }

    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      try { child.kill() } catch { /* ignore */ }
      finish({
        ok: false,
        state: 'timeout',
        message: `lark-cli 状态探测超时（${timeoutMs}ms）`,
        identity: null,
      })
    }, timeoutMs)

    child.stdout?.on('data', (chunk) => { stdout += String(chunk) })
    child.stderr?.on('data', (chunk) => { stderr += String(chunk) })
    child.on('error', (err) => {
      clearTimeout(timer)
      const missing = err && (err.code === 'ENOENT' || /not found/i.test(String(err.message)))
      finish({
        ok: false,
        state: missing ? 'missing_cli' : 'error',
        message: missing
          ? '未找到 lark-cli，请安装并确保在 PATH 中'
          : String(err.message || 'lark-cli 启动失败'),
        identity: null,
      })
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      const parsed = parseAuthJson(stdout)
      if (!parsed) {
        return finish({
          ok: false,
          state: 'error',
          message: String(stderr || stdout || `lark-cli 退出码 ${code}`).slice(0, 400),
          identity: null,
        })
      }
      const botReady = Boolean(parsed?.identities?.bot?.available || parsed?.identities?.bot?.status === 'ready')
      const userReady = Boolean(parsed?.identities?.user?.available || parsed?.identities?.user?.status === 'ready')
      const identity = parsed.identity || (botReady ? 'bot' : userReady ? 'user' : null)
      const permissions = summarizeFeishuPermissions(parsed?.identities?.user?.scope)
      finish({
        ok: botReady || userReady,
        state: botReady || userReady ? 'online' : 'auth_required',
        message: parsed.note || (botReady || userReady ? '飞书 CLI 已就绪' : '需要登录飞书'),
        identity,
        botReady,
        userReady,
        brand: parsed.brand || 'feishu',
        userName: parsed.userName || '',
        permissions,
      })
    })
  })
}

module.exports = {
  DEFAULT_TIMEOUT_MS,
  parseAuthJson,
  probeFeishuStatus,
}
