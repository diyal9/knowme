'use strict'

/**
 * agent-file-tools — 受限文件工具（read_file / list_dir / grep_files）。
 *
 * 纯逻辑：不直接触碰 fs，而是接收一个 adapter：
 *   {
 *     readFile(relPath) -> { ok, content, path } | { ok:false, error },
 *     listDir(relPath)  -> { ok, nodes:[{type,name,path}] } | { ok:false, error },
 *     grep(query, opts) -> { ok, matches:[{path, line, text}] } | { ok:false, error },
 *   }
 * 由 main.js 基于活跃内容源 + sources.js 构建 adapter，从而复用其路径安全校验。
 */

const MAX_READ_CHARS = 16000
const MAX_LIST_NODES = 200
const MAX_GREP_MATCHES = 40

const FILE_TOOL_DEFS = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read a text file inside the active content source. Prefer this over guessing file contents.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative path inside the active source root.' },
        },
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
        properties: {
          path: { type: 'string', description: 'Relative directory path; empty for the source root.' },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'grep_files',
      description: 'Search for a keyword across files in the active content source and return matching lines.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Non-empty keyword or phrase to search for.' },
        },
        required: ['query'],
        additionalProperties: false,
      },
    },
  },
]

function truncate(text, max = MAX_READ_CHARS) {
  const src = String(text || '')
  if (src.length <= max) return { text: src, truncated: false }
  return { text: `${src.slice(0, max)}\n\n[文件内容已截断]`, truncated: true }
}

function formatReadResult(rel, result) {
  if (!result || result.ok === false) {
    return { ok: false, code: 'read_failed', text: String(result?.error || '读取失败') }
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
  const lines = nodes.map(n => `${n.type === 'dir' ? '📁' : '📄'} ${n.path}`)
  return { ok: true, text: `目录 ${rel || '/'}（${nodes.length} 项）:\n${lines.join('\n')}` }
}

function formatGrepResult(query, result) {
  if (!result || result.ok === false) {
    return { ok: false, code: 'grep_failed', text: String(result?.error || '搜索失败') }
  }
  const matches = Array.isArray(result.matches) ? result.matches.slice(0, MAX_GREP_MATCHES) : []
  if (!matches.length) return { ok: true, text: `未找到包含「${query}」的内容` }
  const lines = matches.map(m => `${m.path}:${m.line}: ${String(m.text || '').trim().slice(0, 200)}`)
  return { ok: true, text: `共 ${matches.length} 处命中「${query}」:\n${lines.join('\n')}` }
}

/**
 * 纯逻辑 grep：遍历给定文件清单，用注入的 readFile 读取内容（可为缓存版本）。
 * 支持早停（maxMatches），供 main.js 结合 context-cache 做索引/内容缓存。
 * @param {string} query
 * @param {{ files: Array<{path:string}>, readFile:(rel:string)=>(string|null), maxMatches?: number }} opts
 * @returns {{ ok: boolean, matches: Array<{path,line,text}> }}
 */
function grepFiles(query, opts = {}) {
  const q = String(query || '').toLowerCase().trim()
  if (!q) return { ok: false, matches: [] }
  const files = Array.isArray(opts.files) ? opts.files : []
  const readFile = typeof opts.readFile === 'function' ? opts.readFile : () => null
  const maxMatches = Number.isFinite(opts.maxMatches) && opts.maxMatches > 0
    ? opts.maxMatches
    : MAX_GREP_MATCHES
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

/**
 * @param {object} adapter { readFile, listDir, grep }
 * @returns {{ definitions: object[], handlers: Record<string, Function> }}
 */
function buildFileTools(adapter = {}) {
  const handlers = {
    read_file: async (args = {}) => {
      const rel = String(args.path || '').trim()
      if (!rel) return { ok: false, code: 'invalid_args', text: 'read_file 需要 path' }
      if (typeof adapter.readFile !== 'function') return { ok: false, code: 'tool_unavailable', text: '文件读取不可用' }
      return formatReadResult(rel, await adapter.readFile(rel))
    },
    list_dir: async (args = {}) => {
      const rel = String(args.path || '').trim()
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
  return { definitions: FILE_TOOL_DEFS, handlers }
}

module.exports = {
  MAX_READ_CHARS,
  MAX_LIST_NODES,
  MAX_GREP_MATCHES,
  FILE_TOOL_DEFS,
  truncate,
  formatReadResult,
  formatListResult,
  formatGrepResult,
  grepFiles,
  buildFileTools,
}
