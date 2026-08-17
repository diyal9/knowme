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

const { isTraversalPath, simpleDiffPreview, truncate, formatReadResult, formatListResult, formatGrepResult, grepFiles, buildWriteDraft, checkPath } = require('./agent-file-tools-format')

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

const { applyFileDraft, rollbackFileDraft } = require('./agent-file-tools-apply')

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
