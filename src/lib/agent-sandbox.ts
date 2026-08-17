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
function checkSandboxPermission(permissions, need) {
  const normalized = normalizeSandboxPermissions(permissions)
  if (normalized[need] === true) return { allowed: true }
  const labels = {
    network: 'network（联网）',
    write: 'write（写入）',
    dangerous: 'dangerous（危险操作）',
  }
  return {
    allowed: false,
    category: need,
    needsPermission: need,
    reason: `缺少 ${labels[need] || need} 权限（当前 run permissions.${need}=false）；请让用户授权后再试。`,
  }
}

/**
 * 从工具结果解析可升级的 run 级沙箱权限键。
 * @param {{ needsPermission?: string, code?: string }} result
 * @returns {'network'|'write'|'dangerous'|null}
 */
function parseSandboxPermissionNeed(result = {}) {
  const direct = String(result.needsPermission || '').trim()
  if (PERMISSION_CATEGORIES.has(direct)) return direct
  const code = String(result.code || '').trim()
  if (PERMISSION_CATEGORIES.has(code)) return code
  if (code === 'blocked_dangerous') return 'dangerous'
  return null
}

/**
 * @param {'network'|'write'|'dangerous'} need
 */
function permissionUpgradeLabel(need) {
  const labels = {
    network: 'network（联网）',
    write: 'write（写入）',
    dangerous: 'dangerous（危险操作）',
  }
  return labels[need] || need
}

const SANDBOX_TOOL_DEFS = [
  {
    type: 'function',
    function: {
      name: 'run_python',
      description:
        'Run a short Python 3 snippet in an isolated temporary workspace to compute, transform, parse or verify data. No network by default; destructive/system commands are blocked. Output is captured and length-capped. Use for calculations, parsing tool results, quick data checks — not for accessing arbitrary user files.',
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'Self-contained Python 3 source. Print results to stdout.' },
        },
        required: ['code'],
        additionalProperties: false,
      },
    },
    _knowme: { source: 'sandbox', requiresApproval: false },
  },
  {
    type: 'function',
    function: {
      name: 'run_shell',
      description:
        'Run a short, non-destructive shell command in an isolated temporary workspace (cwd is a scratch dir). No network by default; destructive/system commands are blocked and require user confirmation. Use for lightweight text processing on data you already have.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'A single non-destructive shell command line.' },
        },
        required: ['command'],
        additionalProperties: false,
      },
    },
    _knowme: { source: 'sandbox', requiresApproval: false },
  },
]

function clampOutput(text, max = MAX_OUTPUT_CHARS) {
  const src = String(text || '')
  if (src.length <= max) return { text: src, truncated: false }
  return { text: `${src.slice(0, max)}\n\n[输出已截断]`, truncated: true }
}

/**
 * 格式化进程执行结果为工具结果文本。纯逻辑。
 */
function formatRunResult(label, run = {}) {
  const stdout = String(run.stdout || '').trim()
  const stderr = String(run.stderr || '').trim()
  const parts = []
  if (run.timedOut) parts.push('（执行超时，已终止）')
  parts.push(`退出码：${run.timedOut ? '124 (timeout)' : run.code}`)
  if (stdout) parts.push(`stdout:\n${stdout}`)
  if (stderr) parts.push(`stderr:\n${stderr}`)
  if (!stdout && !stderr && !run.timedOut) parts.push('（无输出）')
  const body = clampOutput(parts.join('\n\n'))
  const ok = run.timedOut ? false : run.code === 0
  return {
    ok,
    code: ok ? undefined : (run.timedOut ? 'sandbox_timeout' : 'sandbox_error'),
    text: `${label}\n\n${body.text}`,
    truncated: body.truncated,
  }
}

/** 默认的进程执行器（副作用）。可被注入替换用于测试。 */
function defaultRunProcess({ cmd, args = [], cwd, input = '', timeoutMs = DEFAULT_TIMEOUT_MS, spawnImpl = spawn } = {}) {
  return new Promise((resolve) => {
    let child
    try {
      child = spawnImpl(cmd, args, { cwd, windowsHide: true, shell: false })
    } catch (err) {
      resolve({ ok: false, code: -1, stdout: '', stderr: String(err?.message || err), timedOut: false })
      return
    }
    let stdout = ''
    let stderr = ''
    let timedOut = false
    let done = false
    const finish = (payload) => {
      if (done) return
      done = true
      clearTimeout(timer)
      resolve(payload)
    }
    const timer = setTimeout(() => {
      timedOut = true
      try { child.kill('SIGKILL') } catch { /* ignore */ }
      finish({ ok: false, code: null, stdout, stderr, timedOut: true })
    }, timeoutMs)
    child.stdout?.on('data', (d) => { stdout += String(d) })
    child.stderr?.on('data', (d) => { stderr += String(d) })
    child.on('error', (err) => finish({ ok: false, code: -1, stdout, stderr: stderr || String(err?.message || err), timedOut }))
    child.on('close', (code) => finish({ ok: code === 0, code, stdout, stderr, timedOut }))
    if (input) {
      try { child.stdin?.write(input); child.stdin?.end() } catch { /* ignore */ }
    } else {
      try { child.stdin?.end() } catch { /* ignore */ }
    }
  })
}

/**
 * 构建沙箱工具（definitions + handlers），供 agent tool surface 投影。
 *
 * @param {{
 *   workdir?: string,
 *   ensureDir?: (dir:string)=>void,
 *   writeFile?: (file:string, content:string)=>void,
 *   runProcess?: (opts:object)=>Promise<object>,
 *   spawnImpl?: Function,
 *   pythonCmd?: string,
 *   shellCmd?: string,
 *   shellFlag?: string,
 *   timeoutMs?: number,
 *   allowNetwork?: boolean,
 *   permissions?: Partial<{ network: boolean, write: boolean, dangerous: boolean }>,
 * }} [options]
 */
function buildSandboxTools(options = {}) {
  const workdir = options.workdir || path.join(os.tmpdir(), 'knowme-agent-sandbox')
  const permissions = normalizeSandboxPermissions(options.permissions, {
    allowNetwork: options.allowNetwork === true,
  })
  const allowNetwork = permissions.network
  const ensureDir = typeof options.ensureDir === 'function'
    ? options.ensureDir
    : (dir) => fs.mkdirSync(dir, { recursive: true })
  const writeFile = typeof options.writeFile === 'function'
    ? options.writeFile
    : (file, content) => fs.writeFileSync(file, content, 'utf8')
  const runProcess = typeof options.runProcess === 'function'
    ? options.runProcess
    : (opts) => defaultRunProcess({ ...opts, spawnImpl: options.spawnImpl })
  const timeoutMs = Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
    ? options.timeoutMs
    : DEFAULT_TIMEOUT_MS
  const isWin = process.platform === 'win32'
  const pythonCmd = options.pythonCmd || (isWin ? 'python' : 'python3')
  const shellCmd = options.shellCmd || (isWin ? 'cmd' : 'bash')
  const shellFlag = options.shellFlag || (isWin ? '/c' : '-c')

  let scriptSeq = 0

  function blockedResult(label, screen) {
    const category = screen.category === 'dangerous' ? 'dangerous' : screen.category
    const needsPermission = PERMISSION_CATEGORIES.has(category) ? category : undefined
    return {
      ok: false,
      code: screen.category === 'dangerous' ? 'blocked_dangerous' : (screen.category || 'blocked'),
      needsPermission,
      requiresApproval: screen.category === 'dangerous',
      text: `${label}\n\n${screen.reason}`,
    }
  }

  const screenOpts = { permissions, allowNetwork, workspaceRoot: workdir }

  const handlers = {
    run_python: async (args = {}) => {
      const code = String(args.code || '')
      const screen = screenCommand(code, { ...screenOpts, mode: 'python' })
      if (!screen.allowed) return blockedResult('run_python 未执行：', screen)
      try {
        ensureDir(workdir)
        scriptSeq += 1
        const file = path.join(workdir, `script_${Date.now()}_${scriptSeq}.py`)
        writeFile(file, code)
        const run = await runProcess({ cmd: pythonCmd, args: ['-I', file], cwd: workdir, timeoutMs })
        if (run.code === -1 && /enoent|not found|无法找到|不是内部/i.test(String(run.stderr || ''))) {
          return { ok: false, code: 'python_unavailable', text: 'run_python 未执行：未检测到可用的 Python 运行时。' }
        }
        return formatRunResult('run_python 结果：', run)
      } catch (err) {
        return { ok: false, code: 'sandbox_error', text: `run_python 失败：${String(err?.message || err).slice(0, 300)}` }
      }
    },
    run_shell: async (args = {}) => {
      const command = String(args.command || '')
      const screen = screenCommand(command, { ...screenOpts, mode: 'shell' })
      if (!screen.allowed) return blockedResult('run_shell 未执行：', screen)
      try {
        ensureDir(workdir)
        const run = await runProcess({ cmd: shellCmd, args: [shellFlag, command], cwd: workdir, timeoutMs })
        return formatRunResult('run_shell 结果：', run)
      } catch (err) {
        return { ok: false, code: 'sandbox_error', text: `run_shell 失败：${String(err?.message || err).slice(0, 300)}` }
      }
    },
  }

  return { definitions: SANDBOX_TOOL_DEFS, handlers, permissions }
}

module.exports = {
  DEFAULT_TIMEOUT_MS,
  MAX_OUTPUT_CHARS,
  MAX_SOURCE_CHARS,
  DEFAULT_SANDBOX_PERMISSIONS,
  DANGEROUS_PATTERNS,
  NETWORK_PATTERNS,
  NODE_EVAL_PATTERNS,
  PYTHON_NETWORK_IMPORTS,
  PYTHON_NETWORK_IMPORT_PATTERNS,
  PYTHON_DYNAMIC_IMPORT_RE,
  SANDBOX_TOOL_DEFS,
  normalizeSandboxPermissions,
  screenPythonImports,
  screenNodeInvocation,
  extractNodeScriptPath,
  isPathInsideWorkspace,
  checkSandboxPermission,
  parseSandboxPermissionNeed,
  permissionUpgradeLabel,
  PERMISSION_CATEGORIES,
  screenCommand,
  clampOutput,
  formatRunResult,
  defaultRunProcess,
  buildSandboxTools,
}
