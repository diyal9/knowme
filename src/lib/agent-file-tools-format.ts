'use strict'

/**
 * agent-file-tools — 文件工具（读 + 写 draft）。
 * 写操作经 draft store 预览→批准→执行；路径策略由 adapter  enforce。
 */

const { createDraftId } = require('./tool-drafts-store')
const pathSecurity = require('./path-security')
const fileBackup = require('./file-backup')

const MAX_READ_CHARS = 16000
const MAX_LIST_NODES = 200
const MAX_GREP_MATCHES = 40
const MAX_PATCH_SIZE = 64000

const READ_TOOL_DEFS = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read a text file inside the active content source.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_dir',
      description: 'List entries of a directory inside the active content source.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' } },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'grep_files',
      description: 'Search for a keyword across files in the active content source.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query'],
        additionalProperties: false,
      },
    },
  },
]

const WRITE_TOOL_DEFS = [
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Overwrite a file in the active content source. Creates a draft for user approval before writing.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          content: { type: 'string' },
          idempotencyKey: { type: 'string' },
        },
        required: ['path', 'content'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_file',
      description: 'Create a new file. Creates a draft for user approval.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          content: { type: 'string' },
          idempotencyKey: { type: 'string' },
        },
        required: ['path', 'content'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'apply_patch',
      description: 'Apply a structured patch to an existing file. Creates a draft with diff preview.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          content: { type: 'string', description: 'Full replacement content or patched result.' },
          expectedHash: { type: 'string', description: 'Optional content hash for conflict detection.' },
          idempotencyKey: { type: 'string' },
        },
        required: ['path', 'content'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'move_path',
      description: 'Move or rename a file/directory. Creates a draft for approval.',
      parameters: {
        type: 'object',
        properties: {
          from: { type: 'string' },
          to: { type: 'string' },
          idempotencyKey: { type: 'string' },
        },
        required: ['from', 'to'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'copy_path',
      description: 'Copy a file. Creates a draft for approval.',
      parameters: {
        type: 'object',
        properties: {
          from: { type: 'string' },
          to: { type: 'string' },
          idempotencyKey: { type: 'string' },
        },
        required: ['from', 'to'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_path',
      description: 'Delete a file or directory. Creates a draft for approval.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          idempotencyKey: { type: 'string' },
        },
        required: ['path'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'mkdir',
      description: 'Create an empty directory inside the content source (low risk, may execute without approval for empty dirs).',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
        additionalProperties: false,
      },
    },
  },
]

const FILE_TOOL_DEFS = [...READ_TOOL_DEFS, ...WRITE_TOOL_DEFS]

function isTraversalPath(rel) {
  const p = String(rel || '').replace(/\\/g, '/').trim()
  if (!p) return false
  if (p.startsWith('/') || /^[a-zA-Z]:/.test(p)) return true
  return p.split('/').some((seg) => seg === '..')
}

function simpleDiffPreview(before, after) {
  const b = String(before || '')
  const a = String(after || '')
  if (b === a) return '(无变更)'
  const bLines = b.split('\n')
  const aLines = a.split('\n')
  const lines = ['--- before', '+++ after']
  const max = Math.max(bLines.length, aLines.length)
  for (let i = 0; i < Math.min(max, 40); i++) {
    const bl = bLines[i]
    const al = aLines[i]
    if (bl !== al) {
      if (bl !== undefined) lines.push(`- ${bl}`)
      if (al !== undefined) lines.push(`+ ${al}`)
    }
  }
  if (max > 40) lines.push('… (diff truncated)')
  return lines.join('\n')
}

function truncate(text, max = MAX_READ_CHARS) {
  const src = String(text || '')
  if (src.length <= max) return { text: src, truncated: false }
  return { text: `${src.slice(0, max)}\n\n[文件内容已截断]`, truncated: true }
}

function formatReadResult(rel, result) {
  if (!result || result.ok === false) {
    return { ok: false, code: result?.code || 'read_failed', text: String(result?.error || '读取失败') }
  }
  const { text, truncated } = truncate(result.content)
  return { ok: true, text: `文件：${rel}\n\n${text}`, truncated }
}

function formatListResult(rel, result) {
  if (!result || result.ok === false) {
    return { ok: false, code: 'list_failed', text: String(result?.error || '列目录失败') }
  }
  const nodes = Array.isArray(result.nodes) ? result.nodes.slice(0, MAX_LIST_NODES) : []
  if (!nodes.length) return { ok: true, text: `目录 ${rel || '/'} 为空` }
  const lines = nodes.map((n) => `${n.type === 'dir' ? '📁' : '📄'} ${n.path}`)
  return { ok: true, text: `目录 ${rel || '/'}（${nodes.length} 项）:\n${lines.join('\n')}` }
}

function formatGrepResult(query, result) {
  if (!result || result.ok === false) {
    return { ok: false, code: 'grep_failed', text: String(result?.error || '搜索失败') }
  }
  const matches = Array.isArray(result.matches) ? result.matches.slice(0, MAX_GREP_MATCHES) : []
  if (!matches.length) return { ok: true, text: `未找到包含「${query}」的内容` }
  const lines = matches.map((m) => `${m.path}:${m.line}: ${String(m.text || '').trim().slice(0, 200)}`)
  return { ok: true, text: `共 ${matches.length} 处命中「${query}」:\n${lines.join('\n')}` }
}

function grepFiles(query, opts = {}) {
  const q = String(query || '').toLowerCase().trim()
  if (!q) return { ok: false, matches: [] }
  const files = Array.isArray(opts.files) ? opts.files : []
  const readFile = typeof opts.readFile === 'function' ? opts.readFile : () => null
  const maxMatches = Number.isFinite(opts.maxMatches) && opts.maxMatches > 0 ? opts.maxMatches : MAX_GREP_MATCHES
  const matches = []
  for (const file of files) {
    if (matches.length >= maxMatches) break
    const rel = typeof file === 'string' ? file : file?.path
    if (!rel) continue
    const content = readFile(rel)
    if (content == null) continue
    const lines = String(content).split(/\r?\n/)
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(q)) {
        matches.push({ path: rel, line: i + 1, text: lines[i] })
        if (matches.length >= maxMatches) break
      }
    }
  }
  return { ok: true, matches }
}

function buildWriteDraft(action, rel, preview, extra = {}) {
  return {
    id: createDraftId(),
    kind: 'file',
    action,
    path: rel,
    status: 'pending_review',
    createdAt: new Date().toISOString(),
    preview,
    rollbackPlan: extra.rollbackPlan || { backupDir: extra.backupDir || null },
    ...extra.payload,
    idempotencyKey: extra.idempotencyKey || null,
  }
}

function checkPath(rel, adapter) {
  if (isTraversalPath(rel)) {
    return { ok: false, code: 'scope_denied', text: '路径 traversal 被拒绝' }
  }
  if (adapter.rootPath) {
    const sec = pathSecurity.validateContentPath(rel, adapter.rootPath)
    if (!sec.ok) return { ok: false, code: sec.code || 'scope_denied', text: sec.text }
  }
  if (typeof adapter.validatePath === 'function') {
    const v = adapter.validatePath(rel)
    if (v && v.ok === false) return { ok: false, code: 'scope_denied', text: String(v.error || '路径超出内容源') }
  }
  return { ok: true }
}

/**
 * @param {object} adapter { readFile, listDir, grep, validatePath, statPath, rememberDraft, runId, backupDir }
 */

module.exports = {
  isTraversalPath,
  simpleDiffPreview,
  truncate,
  formatReadResult,
  formatListResult,
  formatGrepResult,
  grepFiles,
  buildWriteDraft,
  checkPath,
}
