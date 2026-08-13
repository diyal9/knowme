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
function buildFileTools(adapter = {}, opts = {}) {
  const includeWrite = opts.includeWrite !== false
  const defs = includeWrite ? FILE_TOOL_DEFS : READ_TOOL_DEFS

  const remember = (draft) => {
    if (typeof adapter.rememberDraft === 'function') return adapter.rememberDraft(draft)
    return draft
  }

  const handlers = {
    read_file: async (args = {}) => {
      const rel = String(args.path || '').trim()
      if (!rel) return { ok: false, code: 'invalid_args', text: 'read_file 需要 path' }
      const scope = checkPath(rel, adapter)
      if (!scope.ok) return scope
      if (typeof adapter.readFile !== 'function') return { ok: false, code: 'tool_unavailable', text: '文件读取不可用' }
      return formatReadResult(rel, await adapter.readFile(rel))
    },
    list_dir: async (args = {}) => {
      const rel = String(args.path || '').trim()
      if (rel) {
        const scope = checkPath(rel, adapter)
        if (!scope.ok) return scope
      }
      if (typeof adapter.listDir !== 'function') return { ok: false, code: 'tool_unavailable', text: '列目录不可用' }
      return formatListResult(rel, await adapter.listDir(rel))
    },
    grep_files: async (args = {}) => {
      const query = String(args.query || '').trim()
      if (!query) return { ok: false, code: 'invalid_args', text: 'grep_files 需要非空 query' }
      if (typeof adapter.grep !== 'function') return { ok: false, code: 'tool_unavailable', text: '搜索不可用' }
      return formatGrepResult(query, await adapter.grep(query))
    },
  }

  if (includeWrite) {
    handlers.write_file = async (args = {}) => {
      const rel = String(args.path || '').trim()
      const content = String(args.content ?? '')
      if (!rel) return { ok: false, code: 'invalid_args', text: 'write_file 需要 path' }
      const scope = checkPath(rel, adapter)
      if (!scope.ok) return scope
      let before = ''
      if (typeof adapter.readFile === 'function') {
        const existing = await adapter.readFile(rel)
        if (existing?.ok) before = existing.content || ''
      }
      const preview = simpleDiffPreview(before, content)
      const draft = remember(buildWriteDraft('write_file', rel, preview, {
        idempotencyKey: args.idempotencyKey,
        backupDir: adapter.backupDir,
        payload: { content, before },
      }))
      return {
        ok: true,
        text: `已生成 write_file 草稿：${rel}\n\n${preview}\n\n等待用户批准后才会写入。`,
        draft,
        draftId: draft.id,
        requiresApproval: true,
        code: 'approval_required',
      }
    }

    handlers.create_file = async (args = {}) => {
      const rel = String(args.path || '').trim()
      const content = String(args.content ?? '')
      if (!rel) return { ok: false, code: 'invalid_args', text: 'create_file 需要 path' }
      const scope = checkPath(rel, adapter)
      if (!scope.ok) return scope
      if (typeof adapter.statPath === 'function') {
        const st = await adapter.statPath(rel)
        if (st?.exists) return { ok: false, code: 'patch_conflict', text: '文件已存在，请使用 write_file 或 apply_patch' }
      }
      const preview = `新建文件 ${rel}（${content.length} 字符）\n\n${content.slice(0, 800)}${content.length > 800 ? '\n…' : ''}`
      const draft = remember(buildWriteDraft('create_file', rel, preview, {
        idempotencyKey: args.idempotencyKey,
        backupDir: adapter.backupDir,
        payload: { content },
      }))
      return {
        ok: true,
        text: `已生成 create_file 草稿：${rel}，等待用户批准。`,
        draft,
        draftId: draft.id,
        requiresApproval: true,
        code: 'approval_required',
      }
    }

    handlers.apply_patch = async (args = {}) => {
      const rel = String(args.path || '').trim()
      const content = String(args.content ?? '').slice(0, MAX_PATCH_SIZE)
      if (!rel) return { ok: false, code: 'invalid_args', text: 'apply_patch 需要 path' }
      const scope = checkPath(rel, adapter)
      if (!scope.ok) return scope
      if (typeof adapter.readFile !== 'function') return { ok: false, code: 'tool_unavailable', text: '无法读取目标文件' }
      const existing = await adapter.readFile(rel)
      if (!existing?.ok) return { ok: false, code: 'patch_conflict', text: '目标文件不存在或无法读取' }
      const before = existing.content || ''
      if (args.expectedHash && adapter.hashContent) {
        const hash = adapter.hashContent(before)
        if (hash !== args.expectedHash) {
          return { ok: false, code: 'patch_conflict', text: '文件内容与 expectedHash 不匹配' }
        }
      }
      const preview = simpleDiffPreview(before, content)
      const draft = remember(buildWriteDraft('apply_patch', rel, preview, {
        idempotencyKey: args.idempotencyKey,
        backupDir: adapter.backupDir,
        payload: { content, before },
      }))
      return {
        ok: true,
        text: `已生成 apply_patch 草稿：${rel}\n\n${preview}\n\n等待用户批准。`,
        draft,
        draftId: draft.id,
        requiresApproval: true,
        code: 'approval_required',
      }
    }

    handlers.move_path = async (args = {}) => {
      const from = String(args.from || '').trim()
      const to = String(args.to || '').trim()
      if (!from || !to) return { ok: false, code: 'invalid_args', text: 'move_path 需要 from 和 to' }
      for (const p of [from, to]) {
        const scope = checkPath(p, adapter)
        if (!scope.ok) return scope
      }
      const preview = `移动 ${from} → ${to}`
      const draft = remember(buildWriteDraft('move_path', from, preview, {
        idempotencyKey: args.idempotencyKey,
        backupDir: adapter.backupDir,
        payload: { from, to },
      }))
      return { ok: true, text: `已生成 move_path 草稿，等待批准。`, draft, draftId: draft.id, requiresApproval: true, code: 'approval_required' }
    }

    handlers.copy_path = async (args = {}) => {
      const from = String(args.from || '').trim()
      const to = String(args.to || '').trim()
      if (!from || !to) return { ok: false, code: 'invalid_args', text: 'copy_path 需要 from 和 to' }
      for (const p of [from, to]) {
        const scope = checkPath(p, adapter)
        if (!scope.ok) return scope
      }
      const preview = `复制 ${from} → ${to}`
      const draft = remember(buildWriteDraft('copy_path', from, preview, {
        idempotencyKey: args.idempotencyKey,
        backupDir: adapter.backupDir,
        payload: { from, to },
      }))
      return { ok: true, text: `已生成 copy_path 草稿，等待批准。`, draft, draftId: draft.id, requiresApproval: true, code: 'approval_required' }
    }

    handlers.delete_path = async (args = {}) => {
      const rel = String(args.path || '').trim()
      if (!rel) return { ok: false, code: 'invalid_args', text: 'delete_path 需要 path' }
      const scope = checkPath(rel, adapter)
      if (!scope.ok) return scope
      const preview = `删除 ${rel}`
      const draft = remember(buildWriteDraft('delete_path', rel, preview, {
        idempotencyKey: args.idempotencyKey,
        backupDir: adapter.backupDir,
        payload: { path: rel },
      }))
      return { ok: true, text: `已生成 delete_path 草稿，等待批准。`, draft, draftId: draft.id, requiresApproval: true, code: 'approval_required' }
    }

    handlers.mkdir = async (args = {}) => {
      const rel = String(args.path || '').trim()
      if (!rel) return { ok: false, code: 'invalid_args', text: 'mkdir 需要 path' }
      const scope = checkPath(rel, adapter)
      if (!scope.ok) return scope
      const direct = adapter.rootPath
        ? pathSecurity.canMkdirDirect(rel, adapter.rootPath, adapter)
        : { ok: true }
      if (direct.ok && typeof adapter.mkdir === 'function') {
        const r = await adapter.mkdir(rel)
        if (r?.ok === false) return { ok: false, code: 'mkdir_failed', text: String(r.error || '建目录失败') }
        return {
          ok: true,
          text: `已创建目录 \`${rel}\` · 低风险直建`,
          meta: { path: rel, lowRiskDirect: true },
          timelineTitle: `已创建目录 ${rel} · 低风险直建`,
        }
      }
      const preview = `创建目录 ${rel}`
      const draft = remember(buildWriteDraft('mkdir', rel, preview, { payload: { path: rel } }))
      return { ok: true, text: `已生成 mkdir 草稿：${rel}`, draft, draftId: draft.id, requiresApproval: true, code: 'approval_required' }
    }
  }

  return { definitions: defs, handlers }
}

/**
 * Apply an approved file draft (called from main after user approval).
 */
async function applyFileDraft(draft, adapter = {}) {
  if (!draft || draft.kind !== 'file') {
    return { ok: false, code: 'invalid_draft', text: '无效文件草稿' }
  }
  const action = draft.action
  const payload = draft
  if (typeof adapter.backupBefore === 'function') {
    await adapter.backupBefore(draft)
  }
  try {
    if (action === 'write_file' || action === 'create_file' || action === 'apply_patch') {
      if (typeof adapter.writeFile !== 'function') return { ok: false, code: 'tool_unavailable', text: '写入不可用' }
      const rel = draft.path
      const content = payload.content ?? draft.content
      const r = await adapter.writeFile(rel, content)
      if (r?.ok === false) {
        if (typeof adapter.rollbackFromBackup === 'function') await adapter.rollbackFromBackup(draft)
        return { ok: false, code: 'write_failed', text: String(r.error || '写入失败') }
      }
      return { ok: true, text: `已写入 ${rel}` }
    }
    if (action === 'move_path') {
      if (typeof adapter.movePath !== 'function') return { ok: false, code: 'tool_unavailable', text: '移动不可用' }
      const from = payload.from || draft.from
      const to = payload.to || draft.to
      const r = await adapter.movePath(from, to)
      if (r?.ok === false) {
        if (adapter.rootPath && adapter.runId) {
          fileBackup.rollbackMove(adapter.rootPath, adapter.runId, from, to)
        } else if (typeof adapter.rollbackFromBackup === 'function') {
          await adapter.rollbackFromBackup(draft)
        }
        return { ok: false, code: 'move_failed', text: String(r.error || '移动失败') }
      }
      return { ok: true, text: `已移动 ${from} → ${to}` }
    }
    if (action === 'copy_path') {
      if (typeof adapter.copyPath !== 'function') return { ok: false, code: 'tool_unavailable', text: '复制不可用' }
      const r = await adapter.copyPath(payload.from || draft.from, payload.to || draft.to)
      if (r?.ok === false) return { ok: false, code: 'copy_failed', text: String(r.error || '复制失败') }
      return { ok: true, text: `已复制 ${payload.from} → ${payload.to}` }
    }
    if (action === 'delete_path' || action === 'mkdir') {
      if (action === 'delete_path' && typeof adapter.deletePath === 'function') {
        const r = await adapter.deletePath(payload.path || draft.path)
        if (r?.ok === false) return { ok: false, code: 'delete_failed', text: String(r.error || '删除失败') }
        return { ok: true, text: `已删除 ${draft.path}` }
      }
      if (action === 'mkdir' && typeof adapter.mkdir === 'function') {
        const r = await adapter.mkdir(payload.path || draft.path)
        if (r?.ok === false) return { ok: false, code: 'mkdir_failed', text: String(r.error || '建目录失败') }
        return { ok: true, text: `已创建目录 ${draft.path}` }
      }
    }
    return { ok: false, code: 'invalid_draft', text: `未知文件操作: ${action}` }
  } catch (err) {
    if (typeof adapter.rollbackFromBackup === 'function') {
      try { await adapter.rollbackFromBackup(draft) } catch { /* ignore */ }
    }
    return { ok: false, code: 'apply_failed', text: String(err?.message || err).slice(0, 500) }
  }
}

async function rollbackFileDraft(draft, adapter = {}) {
  if (typeof adapter.rollbackFromBackup !== 'function') {
    return { ok: false, code: 'rollback_unavailable', text: '回滚不可用' }
  }
  return adapter.rollbackFromBackup(draft)
}

module.exports = {
  MAX_READ_CHARS,
  MAX_LIST_NODES,
  MAX_GREP_MATCHES,
  MAX_PATCH_SIZE,
  READ_TOOL_DEFS,
  WRITE_TOOL_DEFS,
  FILE_TOOL_DEFS,
  isTraversalPath,
  truncate,
  formatReadResult,
  formatListResult,
  formatGrepResult,
  grepFiles,
  buildFileTools,
  applyFileDraft,
  rollbackFileDraft,
  simpleDiffPreview,
}
