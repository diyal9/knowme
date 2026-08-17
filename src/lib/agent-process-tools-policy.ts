'use strict'

const crypto = require('crypto')
const agentSandbox = require('./agent-sandbox')

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

module.exports = {
  TASK_TEMPLATES,
  PROCESS_TEMPLATES,
  MAX_LOG_CHARS,
  DEFAULT_TIMEOUT_MS,
  KILL_GRACE_MS,
  POWERSHELL_INJECTION,
  PROCESS_TOOL_DEFS,
  createTaskId,
  truncateLog,
  isDangerousCommand,
  screenStartProcessCommand,
}
