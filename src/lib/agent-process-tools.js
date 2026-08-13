'use strict'

const { spawn } = require('child_process')
const crypto = require('crypto')
const agentSandbox = require('./agent-sandbox')
const { createEvictingMap } = require('./runtime-store')

const TASK_TEMPLATES = {
  'npm test': { cmd: 'npm', args: ['test'], cwdRequired: true },
  'npm run lint': { cmd: 'npm', args: ['run', 'lint'], cwdRequired: true },
  'npm run build': { cmd: 'npm', args: ['run', 'build'], cwdRequired: true },
}

const PROCESS_TEMPLATES = {
  'npm test': TASK_TEMPLATES['npm test'],
  'npm run lint': TASK_TEMPLATES['npm run lint'],
  'npm run build': TASK_TEMPLATES['npm run build'],
}

const MAX_LOG_CHARS = 24000
const DEFAULT_TIMEOUT_MS = 120000
const KILL_GRACE_MS = 800

const processStore = createEvictingMap({ maxEntries: 500, ttlMs: 24 * 60 * 60 * 1000 })
const processRegistry = processStore.map

const POWERSHELL_INJECTION = [
  /\bpowershell(?:\.exe)?\b/i,
  /\bpwsh(?:\.exe)?\b/i,
  /\bcmd(?:\.exe)?\s+\/c\b/i,
]

function createTaskId() {
  return `task_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`
}

const PROCESS_TOOL_DEFS = [
  {
    type: 'function',
    function: {
      name: 'run_task',
      description: 'Run a structured task template (npm test/lint/build) in the content source cwd with timeout.',
      parameters: {
        type: 'object',
        properties: {
          task: { type: 'string', enum: ['npm test', 'npm run lint', 'npm run build'] },
          cwd: { type: 'string' },
          timeoutMs: { type: 'number' },
        },
        required: ['task'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'start_process',
      description: 'Start a long-running background process tracked by runId.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string' },
          args: { type: 'array', items: { type: 'string' } },
          cwd: { type: 'string' },
        },
        required: ['command'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'task_status',
      description: 'Get status of a tracked process/task.',
      parameters: {
        type: 'object',
        properties: { taskId: { type: 'string' } },
        required: ['taskId'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'task_logs',
      description: 'Get stdout/stderr logs for a tracked process/task.',
      parameters: {
        type: 'object',
        properties: { taskId: { type: 'string' }, tail: { type: 'number' } },
        required: ['taskId'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_task',
      description: 'Cancel a running task/process.',
      parameters: {
        type: 'object',
        properties: { taskId: { type: 'string' } },
        required: ['taskId'],
        additionalProperties: false,
      },
    },
  },
]

function truncateLog(text, max = MAX_LOG_CHARS) {
  const s = String(text || '')
  if (s.length <= max) return s
  return `${s.slice(-max)}\n\n[日志已截断]`
}

function isDangerousCommand(cmd, args = []) {
  const joined = `${cmd} ${args.join(' ')}`
  const screen = agentSandbox.screenCommand(joined, { mode: 'shell', permissions: { dangerous: false, network: false, write: false } })
  if (!screen.allowed) return true
  for (const re of POWERSHELL_INJECTION) {
    if (re.test(joined)) return true
  }
  return /\brm\s+-rf\b|\bformat\b|\bdel\s+\/f|\bshutdown\b|\bcurl\b.*\|\s*sh/.test(joined.toLowerCase())
}

function screenStartProcessCommand(cmd, argList = []) {
  const joined = [cmd, ...argList].join(' ')
  if (PROCESS_TEMPLATES[cmd]) return { ok: true, template: PROCESS_TEMPLATES[cmd] }
  const nodeEval = agentSandbox.screenCommand(joined, { mode: 'shell' })
  if (!nodeEval.allowed) {
    return { ok: false, code: nodeEval.category === 'network' ? 'scope_denied' : 'scope_denied', text: nodeEval.reason || '命令被拦截' }
  }
  if (isDangerousCommand(cmd, argList)) {
    return { ok: false, code: 'scope_denied', text: '危险命令被拦截' }
  }
  for (const re of POWERSHELL_INJECTION) {
    if (re.test(joined)) {
      return { ok: false, code: 'scope_denied', text: 'PowerShell/cmd 注入被拦截；请使用 run_task 模板' }
    }
  }
  if (/^node(?:\.exe)?$/i.test(cmd) && argList.some((a) => /^(-e|--eval|-p|--print)$/i.test(a))) {
    return { ok: false, code: 'scope_denied', text: 'node -e/--eval 注入被拦截' }
  }
  return { ok: true, raw: { cmd, args: argList } }
}

function spawnOpts(cwd, spawnImpl) {
  return {
    cwd,
    shell: false,
    windowsHide: true,
    env: { ...process.env },
  }
}

function registerProcessEntry(entry) {
  processStore.set(entry.taskId, entry)
  // createEvictingMap.set 会浅拷贝；必须返回 map 内对象，后续 status/child 变更才落库
  return processStore.map.get(String(entry.taskId)) || entry
}

function getProcessEntry(taskId) {
  return processStore.map.get(String(taskId || '')) || null
}

function lookupProcessEntry(taskId) {
  const hit = processStore.getFriendly(String(taskId || ''), {
    notFound: '任务不存在或已清理',
    expired: '任务已过期，请重新发起',
  })
  if (!hit.ok) return { ok: false, code: hit.code, text: hit.text || hit.message }
  return { ok: true, entry: hit.entry }
}

function cancelProcessEntry(taskId, opts = {}) {
  const entry = getProcessEntry(taskId)
  if (!entry) return { ok: false, code: 'not_found', text: '任务不存在' }
  if (entry.status === 'completed' || entry.status === 'cancelled' || entry.status === 'failed') {
    return { ok: true, text: `任务已结束：${entry.status}`, status: entry.status }
  }
  entry.status = 'cancelling'
  const killFn = opts.killImpl || defaultKill
  try {
    if (entry.child) killFn(entry.child)
    else if (entry.pid) killFn({ pid: entry.pid })
  } catch { /* ignore */ }
  entry.status = 'cancelled'
  entry.endedAt = Date.now()
  return { ok: true, text: '任务已取消', status: 'cancelled', cancelLatencyMs: entry.endedAt - (entry.cancelRequestedAt || Date.now()) }
}

function defaultKill(child) {
  if (!child) return
  try {
    if (child.kill) child.kill('SIGTERM')
    setTimeout(() => {
      try { child.kill?.('SIGKILL') } catch { /* ignore */ }
    }, KILL_GRACE_MS)
  } catch { /* ignore */ }
}

function cancelProcessesForRun(runId, opts = {}) {
  const cancelled = []
  for (const [, entry] of processRegistry) {
    if (entry.runId === runId && (entry.status === 'running' || entry.status === 'starting')) {
      entry.cancelRequestedAt = Date.now()
      const r = cancelProcessEntry(entry.taskId, opts)
      cancelled.push({ taskId: entry.taskId, ...r })
    }
  }
  return cancelled
}

function runTaskOnce(template, opts = {}) {
  const spawnImpl = opts.spawnImpl || spawn
  const taskId = createTaskId()
  const logs = { stdout: '', stderr: '' }
  const timeoutMs = Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : DEFAULT_TIMEOUT_MS
  const signal = opts.signal
  let child
  let timer
  let abortListener = null
  return new Promise((resolve) => {
    let settled = false
    const finish = (result) => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      if (abortListener && signal && typeof signal.removeEventListener === 'function') {
        signal.removeEventListener('abort', abortListener)
      }
      resolve(result)
    }
    const entry = registerProcessEntry({
      taskId,
      runId: opts.runId || null,
      template: template.key,
      status: 'running',
      startedAt: Date.now(),
      logs,
      child: null,
    })
    try {
      child = spawnImpl(template.cmd, template.args, {
        ...spawnOpts(opts.cwd, spawnImpl),
        env: { ...process.env, ...(opts.env || {}) },
      })
      entry.child = child
      entry.pid = child.pid
    } catch (err) {
      entry.status = 'failed'
      return finish({ ok: false, code: 'spawn_failed', text: String(err.message), taskId })
    }
    const requestCancel = (code = 'cancelled', text = '任务已取消') => {
      if (settled) return
      if (entry.status === 'running' || entry.status === 'starting') {
        entry.status = code === 'timeout' ? 'timeout' : 'cancelling'
        entry.cancelRequestedAt = Date.now()
      }
      defaultKill(child)
      // 若子进程迟迟无 close（异常 mock），仍须收口
      setTimeout(() => {
        if (settled) return
        entry.status = code === 'timeout' ? 'timeout' : 'cancelled'
        entry.endedAt = Date.now()
        finish({
          ok: false,
          code,
          text: code === 'timeout'
            ? (truncateLog(`${logs.stdout}\n${logs.stderr}`) || text)
            : text,
          taskId,
          status: entry.status,
        })
      }, KILL_GRACE_MS + 50)
    }
    child.stdout?.on('data', (d) => { logs.stdout += String(d) })
    child.stderr?.on('data', (d) => { logs.stderr += String(d) })
    timer = setTimeout(() => {
      requestCancel('timeout', '任务执行超时')
    }, timeoutMs)
    if (signal) {
      abortListener = () => requestCancel('cancelled', '任务已取消')
      if (signal.aborted) {
        requestCancel('cancelled', '任务已取消')
      } else if (typeof signal.addEventListener === 'function') {
        signal.addEventListener('abort', abortListener, { once: true })
      }
    }
    child.on('close', (code, closeSignal) => {
      if (entry.status === 'cancelling' || entry.status === 'cancelled') {
        entry.status = 'cancelled'
        entry.endedAt = Date.now()
        return finish({ ok: false, code: 'cancelled', text: '任务已取消', taskId, status: 'cancelled' })
      }
      if (entry.status === 'timeout') {
        entry.endedAt = Date.now()
        return finish({
          ok: false,
          code: 'timeout',
          text: truncateLog(`${logs.stdout}\n${logs.stderr}`),
          taskId,
          status: 'timeout',
        })
      }
      entry.status = code === 0 ? 'completed' : 'failed'
      entry.exitCode = code
      entry.signal = closeSignal
      entry.endedAt = Date.now()
      const combined = truncateLog(`${logs.stdout}\n${logs.stderr}`)
      finish({
        ok: code === 0,
        code: code === 0 ? 'ok' : 'task_failed',
        text: combined || `(exit ${code})`,
        preview: code === 0
          ? '命令执行完成'
          : `命令执行失败（exit ${code}${closeSignal ? ` / ${closeSignal}` : ''}）`,
        taskId,
        status: entry.status,
        exitCode: code,
      })
    })
  })
}

function buildProcessTools(opts = {}) {
  const resolveCwd = typeof opts.resolveCwd === 'function' ? opts.resolveCwd : () => opts.cwd || process.cwd()
  const spawnImpl = opts.spawnImpl || spawn

  const handlers = {
    run_task: async (args = {}, signal, handlerCtx = {}) => {
      const taskKey = String(args.task || '').trim()
      const template = TASK_TEMPLATES[taskKey]
      if (!template) return { ok: false, code: 'invalid_args', text: '不支持的任务模板' }
      const cwd = String(args.cwd || resolveCwd() || '').trim()
      if (template.cwdRequired && !cwd) return { ok: false, code: 'invalid_args', text: 'run_task 需要 cwd' }
      if (isDangerousCommand(template.cmd, template.args)) {
        return { ok: false, code: 'scope_denied', text: '危险命令被拦截' }
      }
      const ctxTimeout = Number(handlerCtx?.timeoutMs)
      const argTimeout = Number(args.timeoutMs)
      const timeoutMs = Number.isFinite(argTimeout)
        ? argTimeout
        : (Number.isFinite(ctxTimeout) ? ctxTimeout : undefined)
      return runTaskOnce({ ...template, key: taskKey }, {
        cwd,
        runId: opts.runId || handlerCtx?.runId || null,
        timeoutMs,
        spawnImpl,
        signal: signal || handlerCtx?.signal || null,
      })
    },
    start_process: async (args = {}) => {
      const cmd = String(args.command || '').trim()
      const argList = Array.isArray(args.args) ? args.args.map(String) : []
      if (!cmd) return { ok: false, code: 'invalid_args', text: 'start_process 需要 command' }
      const screened = screenStartProcessCommand(cmd, argList)
      if (!screened.ok) return screened
      const taskId = createTaskId()
      const logs = { stdout: '', stderr: '' }
      let child
      const cwd = String(args.cwd || resolveCwd() || '')
      try {
        if (screened.template) {
          child = spawnImpl(screened.template.cmd, screened.template.args, spawnOpts(cwd, spawnImpl))
        } else if (screened.raw) {
          child = spawnImpl(screened.raw.cmd, screened.raw.args, spawnOpts(cwd, spawnImpl))
        } else {
          return { ok: false, code: 'scope_denied', text: '仅允许 run_task 模板或预批准命令' }
        }
      } catch (err) {
        return { ok: false, code: 'spawn_failed', text: String(err.message) }
      }
      registerProcessEntry({
        taskId,
        runId: opts.runId,
        status: 'running',
        startedAt: Date.now(),
        logs,
        child,
        pid: child.pid,
      })
      child.stdout?.on('data', (d) => { logs.stdout += String(d) })
      child.stderr?.on('data', (d) => { logs.stderr += String(d) })
      child.on('close', (code) => {
        const e = getProcessEntry(taskId)
        if (e && e.status === 'running') {
          e.status = code === 0 ? 'completed' : 'failed'
          e.endedAt = Date.now()
          e.exitCode = code
        }
      })
      return { ok: true, text: `后台进程已启动 taskId=${taskId}`, taskId, status: 'running' }
    },
    task_status: async (args = {}) => {
      const hit = lookupProcessEntry(args.taskId)
      if (!hit.ok) return hit
      const entry = hit.entry
      return { ok: true, text: `status=${entry.status} exit=${entry.exitCode ?? 'n/a'}`, status: entry.status, taskId: entry.taskId }
    },
    task_logs: async (args = {}) => {
      const hit = lookupProcessEntry(args.taskId)
      if (!hit.ok) return hit
      const entry = hit.entry
      const tail = Number.isFinite(args.tail) ? args.tail : MAX_LOG_CHARS
      const combined = `${entry.logs?.stdout || ''}\n${entry.logs?.stderr || ''}`
      return { ok: true, text: truncateLog(combined, tail) }
    },
    cancel_task: async (args = {}) => {
      const entry = getProcessEntry(args.taskId)
      if (entry) entry.cancelRequestedAt = Date.now()
      return cancelProcessEntry(args.taskId, { killImpl: opts.killImpl })
    },
  }

  return { definitions: PROCESS_TOOL_DEFS, handlers, cancelProcessesForRun }
}

module.exports = {
  TASK_TEMPLATES,
  PROCESS_TEMPLATES,
  MAX_LOG_CHARS,
  DEFAULT_TIMEOUT_MS,
  PROCESS_TOOL_DEFS,
  processRegistry,
  processStore,
  createTaskId,
  isDangerousCommand,
  screenStartProcessCommand,
  spawnOpts,
  registerProcessEntry,
  getProcessEntry,
  lookupProcessEntry,
  cancelProcessEntry,
  cancelProcessesForRun,
  runTaskOnce,
  buildProcessTools,
}
