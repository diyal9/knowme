'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawn } = require('child_process')

/**
 * agent-sandbox — 受限的临时工作区脚本工具（run_python / run_shell）。
 *
 * 设计原则：
 *  - 一切执行都被限制在「每次 Run 独占的临时工作目录」内（cwd 沙箱）。
 *  - 破坏性 / 系统级 / 外联命令默认拦截，返回需用户确认，不直接执行。
 *  - run 级 permissions: { network, write, dangerous }，默认均为 false。
 *  - 强制超时 + 输出长度上限，避免挂死或刷屏。
 *  - 纯逻辑（命令甄别、格式化）与副作用（spawn/fs）分离，副作用可注入，便于单测。
 */

const DEFAULT_TIMEOUT_MS = 20000
const MAX_OUTPUT_CHARS = 8000
const MAX_SOURCE_CHARS = 20000

/** @type {{ network: boolean, write: boolean, dangerous: boolean }} */
const DEFAULT_SANDBOX_PERMISSIONS = Object.freeze({
  network: false,
  write: false,
  dangerous: false,
})

const PERMISSION_CATEGORIES = new Set(['network', 'write', 'dangerous'])

// Python 联网相关模块：network=false 时静态拦截 import。
const PYTHON_NETWORK_IMPORTS = [
  'urllib',
  'requests',
  'socket',
  'http.client',
  'aiohttp',
  'httpx',
  'ftplib',
  'smtplib',
  'poplib',
  'imaplib',
  'telnetlib',
  'http',
]

const PYTHON_NETWORK_IMPORT_PATTERNS = PYTHON_NETWORK_IMPORTS.flatMap((mod) => {
  const escaped = mod.replace(/\./g, '\\.')
  const base = mod.split('.')[0]
  return [
    new RegExp(`^\\s*import\\s+${escaped}(\\s|$|,|\\.)`, 'm'),
    new RegExp(`^\\s*from\\s+${escaped}(\\s|$|\\.)`, 'm'),
    new RegExp(`^\\s*import\\s+${base}\\b`, 'm'),
    new RegExp(`^\\s*from\\s+${base}\\b`, 'm'),
    new RegExp(`__import__\\s*\\(\\s*['"]${escaped}(?:\\.[^'"]*)?['"]`, 'm'),
    new RegExp(`importlib\\.import_module\\s*\\(\\s*['"]${escaped}(?:\\.[^'"]*)?['"]`, 'm'),
  ]
})

// 兜底：__import__('urllib.request') 等带子模块的动态 import。
const PYTHON_DYNAMIC_IMPORT_RE = /(?:__import__|importlib\.import_module)\s*\(\s*['"](?:urllib|requests|socket|aiohttp|httpx|ftplib|http(?:\.client)?)(?:\.[^'"]*)?['"]/m

// 破坏性 / 系统级命令：即便在沙箱 cwd 内也可能越权，dangerous=false 时一律拦截。
const DANGEROUS_PATTERNS = [
  /\brm\s+-[a-z]*r[a-z]*f?/i, // rm -rf / rm -fr
  /\brmdir\s+\/s/i,
  /\bdel\s+\/[a-z]*s/i, // del /s /q
  /\bformat\b\s+[a-z]:/i,
  /\bmkfs\b/i,
  /\bdd\s+if=/i,
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\bhalt\b/i,
  /\bpoweroff\b/i,
  /:\(\)\s*\{/, // fork bomb :(){ :|:& };:
  /\bmv\s+\/\s/i,
  /\bchmod\s+-[a-z]*R[a-z]*\s+\d{3,4}\s+\//i,
  /\bchown\s+-[a-z]*R/i,
  /\breg\s+delete/i,
  /\bRemove-Item\b[^\n]*-Recurse[^\n]*-Force/i,
  /\bStop-Computer\b/i,
  /\bRestart-Computer\b/i,
  /\bschtasks\b/i,
  /\btaskkill\b/i,
  /\bnet\s+user\b/i,
  /\bnetsh\b/i,
  /\b(git)\s+push\b[^\n]*--force/i,
  />\s*\/dev\/sd[a-z]/i,
]

// 外联/下载/装包命令：network=false 时拦截。
const NETWORK_PATTERNS = [
  /\bcurl\b/i,
  /\bwget\b/i,
  /\bnc\b\s/i,
  /\bncat\b/i,
  /\btelnet\b/i,
  /\bssh\b/i,
  /\bscp\b/i,
  /\bftp\b/i,
  /\bInvoke-WebRequest\b/i,
  /\bInvoke-RestMethod\b/i,
  /\biwr\b/i,
  /\birm\b/i,
  /\bStart-BitsTransfer\b/i,
  /\bpip\s+install\b/i,
  /\bnpm\s+(install|i)\b/i,
  /\bapt(-get)?\s+install\b/i,
  /\byum\s+install\b/i,
  /\byarn\s+add\b/i,
  /\bpnpm\s+add\b/i,
]

// node -e/--eval/-p/--print 可绕过 shell denylist 直接联网。
const NODE_EVAL_PATTERNS = [
  /\bnode(?:\.exe)?\s+(?:[^\s|&;]+\s+)*(-e|--eval)\b/i,
  /\bnode(?:\.exe)?\s+(?:[^\s|&;]+\s+)*(-p|--print)\b/i,
  /\bnode(?:\.exe)?\s+(?:[^\s|&;]+\s+)*--input-type\b/i,
]

// write=false 时拦截写到工作区外的明显重定向/复制。
const WRITE_OUTSIDE_PATTERNS = [
  />\s*[A-Za-z]:\\/i,
  />\s*\/(?!dev\/null\b)/i,
  />>\s*[A-Za-z]:\\/i,
  />>\s*\/(?!dev\/null\b)/i,
  /\b(?:cp|copy|move|mv|tee)\s+[^\s|&;]+\s+[A-Za-z]:\\/i,
  /\b(?:cp|copy|move|mv|tee)\s+[^\s|&;]+\s+\/(?!tmp\b|dev\/null\b)/i,
]

/**
 * 归一化 run 级沙箱权限。兼容 legacy allowNetwork 布尔值。
 * @param {Partial<{ network: boolean, write: boolean, dangerous: boolean }>|null|undefined} input
 * @param {{ allowNetwork?: boolean }} [legacy]
 * @returns {{ network: boolean, write: boolean, dangerous: boolean }}
 */

function normalizeSandboxPermissions(input, legacy = {}) {
  const src = input && typeof input === 'object' ? input : {}
  const network = src.network === true
    || (src.network !== false && legacy.allowNetwork === true)
  return {
    network,
    write: src.write === true,
    dangerous: src.dangerous === true,
  }
}

/**
 * 静态扫描 Python 源码中的联网 import。
 * @param {string} source
 * @param {{ allowNetwork?: boolean, permissions?: { network?: boolean } }} [opts]
 */
function screenPythonImports(source, opts = {}) {
  const permissions = opts.permissions || normalizeSandboxPermissions(null, opts)
  const allowNetwork = opts.allowNetwork === true || permissions.network === true
  if (allowNetwork) return { allowed: true }
  const text = String(source || '')
  for (const re of PYTHON_NETWORK_IMPORT_PATTERNS) {
    if (re.test(text)) {
      const hit = text.match(re)
      const mod = hit ? hit[0].trim().slice(0, 80) : 'networking module'
      return {
        allowed: false,
        category: 'network',
        reason: `检测到 Python 联网模块 import（${mod}）；沙箱默认禁止外联，如需联网请让用户开启 network 权限。`,
      }
    }
  }
  if (PYTHON_DYNAMIC_IMPORT_RE.test(text)) {
    return {
      allowed: false,
      category: 'network',
      reason: '检测到 Python 动态 import 联网模块；沙箱默认禁止外联，如需联网请让用户开启 network 权限。',
    }
  }
  return { allowed: true }
}

/**
 * 解析 node 命令中的脚本路径（非 -e/--eval）。
 * @param {string} command
 * @returns {string|null}
 */
function extractNodeScriptPath(command) {
  const text = String(command || '').trim()
  const parts = text.split(/\s+/).filter(Boolean)
  if (!parts.length || !/^node(?:\.exe)?$/i.test(parts[0])) return null
  let i = 1
  while (i < parts.length) {
    const token = parts[i]
    if (!token.startsWith('-')) break
    if (/^(-e|--eval|-p|--print|--input-type)$/i.test(token)) return null
    if (/^(-r|--require|-i|--import|--loader|--experimental-loader)$/i.test(token)) {
      i += 2
      continue
    }
    i += 1
  }
  if (i >= parts.length) return null
  const candidate = parts[i]
  if (/^(-e|--eval|-p|--print|--input-type)$/i.test(candidate)) return null
  return candidate
}

/**
 * node 脚本路径是否落在 workspace 内。
 * @param {string} scriptPath
 * @param {string} workspaceRoot
 */
function isPathInsideWorkspace(scriptPath, workspaceRoot) {
  if (!workspaceRoot) return true
  const root = path.resolve(workspaceRoot)
  const resolved = path.isAbsolute(scriptPath)
    ? path.resolve(scriptPath)
    : path.resolve(root, scriptPath)
  const relative = path.relative(root, resolved)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

/**
 * 甄别 shell 命令中的 node 调用。
 * @param {string} command
 * @param {{ workspaceRoot?: string, permissions?: object, allowNetwork?: boolean }} opts
 */
function screenNodeInvocation(command, opts = {}) {
  const permissions = opts.permissions || normalizeSandboxPermissions(null, opts)
  const allowNetwork = opts.allowNetwork === true || permissions.network === true
  const text = String(command || '')

  for (const re of NODE_EVAL_PATTERNS) {
    if (re.test(text)) {
      return {
        allowed: false,
        category: 'network',
        reason: '检测到 node -e/--eval/-p/--print 内联脚本；沙箱禁止该方式执行（可绕过禁网），请改用 workspace 内的 .js 脚本文件。',
      }
    }
  }

  const scriptPath = extractNodeScriptPath(text)
  if (scriptPath && opts.workspaceRoot) {
    if (!isPathInsideWorkspace(scriptPath, opts.workspaceRoot)) {
      return {
        allowed: false,
        category: 'write',
        reason: `node 脚本路径必须在沙箱工作区内（${scriptPath} 不在 workspace 内）。`,
      }
    }
  }

  if (!allowNetwork && /\bnode(?:\.exe)?\b/i.test(text)) {
    const inlineNet = /\b(require\s*\(\s*['"](?:http|https|net|dns|fetch)['"]\)|fetch\s*\(|globalThis\.fetch\b)/i
    if (inlineNet.test(text) && NODE_EVAL_PATTERNS.some((re) => re.test(text))) {
      return {
        allowed: false,
        category: 'network',
        reason: 'node 内联脚本含联网 API，沙箱默认禁止外联。',
      }
    }
  }

  return { allowed: true }
}

/**
 * 甄别一段命令/脚本是否允许在沙箱执行。纯逻辑，可单测。
 * @param {string} source
 * @param {{
 *   allowNetwork?: boolean,
 *   permissions?: Partial<{ network: boolean, write: boolean, dangerous: boolean }>,
 *   workspaceRoot?: string,
 *   mode?: 'python' | 'shell',
 * }} [opts]
 * @returns {{ allowed: boolean, reason?: string, category?: string }}
 */
function screenCommand(source, opts = {}) {
  const text = String(source || '')
  const permissions = opts.permissions || normalizeSandboxPermissions(null, opts)
  const allowNetwork = opts.allowNetwork === true || permissions.network === true
  const allowWrite = permissions.write === true
  const allowDangerous = permissions.dangerous === true

  if (!text.trim()) return { allowed: false, reason: '脚本内容为空', category: 'invalid_args' }
  if (text.length > MAX_SOURCE_CHARS) {
    return { allowed: false, reason: `脚本过长（>${MAX_SOURCE_CHARS} 字符），请拆分`, category: 'too_large' }
  }

  if (!allowDangerous) {
    for (const re of DANGEROUS_PATTERNS) {
      if (re.test(text)) {
        return {
          allowed: false,
          category: 'dangerous',
          reason: '检测到破坏性或系统级命令，出于安全已拦截，需用户明确确认并开启 dangerous 权限后才能执行。',
        }
      }
    }
  }

  if (!allowNetwork) {
    for (const re of NETWORK_PATTERNS) {
      if (re.test(text)) {
        return {
          allowed: false,
          category: 'network',
          reason: '检测到联网/下载/装包命令，沙箱默认禁止外联；如确有需要，请让用户开启 network 权限。',
        }
      }
    }
  }

  if (!allowWrite) {
    for (const re of WRITE_OUTSIDE_PATTERNS) {
      if (re.test(text)) {
        return {
          allowed: false,
          category: 'write',
          reason: '检测到写入沙箱工作区外的操作，默认禁止；如确有需要，请让用户开启 write 权限。',
        }
      }
    }
  }

  if (opts.mode === 'python') {
    const py = screenPythonImports(text, { permissions, allowNetwork })
    if (!py.allowed) return py
  }

  if (opts.mode === 'shell' || opts.mode == null) {
    const node = screenNodeInvocation(text, { permissions, allowNetwork, workspaceRoot: opts.workspaceRoot })
    if (!node.allowed) return node
  }

  return { allowed: true }
}

/**
 * 检查 run 级权限是否满足需求；供 run_skill_script 等复用。
 * @param {{ network?: boolean, write?: boolean, dangerous?: boolean }} permissions
 * @param {'network'|'write'|'dangerous'} need
 */

module.exports = {
  normalizeSandboxPermissions,
  screenPythonImports,
  extractNodeScriptPath,
  isPathInsideWorkspace,
  screenNodeInvocation,
  screenCommand,
}
