'use strict'

const crypto = require('crypto')
const { createEvictingMap } = require('./runtime-store')

const MAX_PDF_PAGES = 20
const MAX_ARTIFACT_CHARS = 200000

const artifactEvictStore = createEvictingMap({ maxEntries: 200, ttlMs: 7 * 24 * 60 * 60 * 1000 })
const artifactStore = artifactEvictStore.map

function createArtifactId() {
  return `art_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`
}

const ARTIFACT_TOOL_DEFS = [
  {
    type: 'function',
    function: {
      name: 'create_artifact',
      description: 'Create a markdown/text/csv artifact in the run workspace.',
      parameters: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['markdown', 'text', 'csv'] },
          title: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['kind', 'content'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_artifact',
      description: 'Update an existing artifact by id.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          content: { type: 'string' },
          title: { type: 'string' },
        },
        required: ['id', 'content'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'export_artifact_csv',
      description: 'Export JSON rows to CSV artifact.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          rows: { type: 'array', items: { type: 'object' } },
        },
        required: ['rows'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'export_artifact_pdf',
      description: 'Export markdown/html content to local PDF (max 20 pages).',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          html: { type: 'string' },
          markdown: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
  },
]

function rowsToCsv(rows = []) {
  const list = Array.isArray(rows) ? rows : []
  if (!list.length) return ''
  const headers = [...new Set(list.flatMap((r) => Object.keys(r || {})))]
  const escape = (v) => {
    const s = String(v ?? '')
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const lines = [headers.map(escape).join(',')]
  for (const row of list) {
    lines.push(headers.map((h) => escape(row[h])).join(','))
  }
  return lines.join('\n')
}

function markdownToSimpleHtml(md = '') {
  const escaped = String(md)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return `<html><body><pre>${escaped}</pre></body></html>`
}

function estimatePdfPages(html = '') {
  const len = String(html).length
  return Math.max(1, Math.ceil(len / 3000))
}

function buildArtifactTools(opts = {}) {
  const backing = opts.store || artifactEvictStore
  const map = backing.map || backing
  const setEntry = typeof backing.set === 'function'
    ? (key, entry) => backing.set(key, entry)
    : (key, entry) => map.set(key, entry)
  const runId = opts.runId || 'default'
  const exportPdf = typeof opts.exportPdf === 'function' ? opts.exportPdf : null

  const handlers = {
    create_artifact: async (args = {}) => {
      const kind = String(args.kind || 'markdown').trim()
      const content = String(args.content || '').slice(0, MAX_ARTIFACT_CHARS)
      if (!content) return { ok: false, code: 'invalid_args', text: 'create_artifact 需要 content' }
      const id = createArtifactId()
      const artifact = {
        id,
        kind,
        title: String(args.title || '未命名').slice(0, 200),
        content,
        runId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      setEntry(id, artifact)
      if (typeof opts.persistArtifact === 'function') await opts.persistArtifact(artifact)
      return {
        ok: true,
        text: `已创建 ${kind} artifact「${artifact.title}」`,
        artifactRefs: [{ id, kind, title: artifact.title }],
      }
    },
    update_artifact: async (args = {}) => {
      const id = String(args.id || '').trim()
      const hit = lookupArtifact(backing, id)
      if (!hit.ok) return hit
      const existing = hit.entry
      existing.content = String(args.content || '').slice(0, MAX_ARTIFACT_CHARS)
      if (args.title) existing.title = String(args.title).slice(0, 200)
      existing.updatedAt = new Date().toISOString()
      setEntry(id, existing)
      if (typeof opts.persistArtifact === 'function') await opts.persistArtifact(existing)
      return {
        ok: true,
        text: `已更新 artifact ${id}`,
        artifactRefs: [{ id, kind: existing.kind, title: existing.title }],
      }
    },
    export_artifact_csv: async (args = {}) => {
      const csv = rowsToCsv(args.rows)
      const id = createArtifactId()
      const artifact = {
        id,
        kind: 'csv',
        title: String(args.title || 'export').slice(0, 200),
        content: csv,
        runId,
        createdAt: new Date().toISOString(),
      }
      setEntry(id, artifact)
      return {
        ok: true,
        text: `已导出 CSV（${(args.rows || []).length} 行）`,
        artifactRefs: [{ id, kind: 'csv', title: artifact.title }],
      }
    },
    export_artifact_pdf: async (args = {}) => {
      const html = args.html ? String(args.html) : markdownToSimpleHtml(args.markdown || '')
      const pages = estimatePdfPages(html)
      if (pages > MAX_PDF_PAGES) {
        return { ok: false, code: 'pdf_too_large', text: `PDF 超过 ${MAX_PDF_PAGES} 页限制（估算 ${pages} 页）` }
      }
      if (!exportPdf) {
        const id = createArtifactId()
        const artifact = {
          id,
          kind: 'pdf',
          title: String(args.title || 'export').slice(0, 200),
          content: html,
          runId,
          pendingPdf: true,
          createdAt: new Date().toISOString(),
        }
        setEntry(id, artifact)
        return {
          ok: true,
          text: `PDF 草稿已创建（${pages} 页），待本地 printToPDF`,
          artifactRefs: [{ id, kind: 'pdf', title: artifact.title }],
        }
      }
      const pdfResult = await exportPdf({ html, title: args.title, pages })
      if (!pdfResult?.ok) return pdfResult
      return {
        ok: true,
        text: pdfResult.text || 'PDF 已导出',
        artifactRefs: pdfResult.artifactRefs || [],
      }
    },
  }

  return { definitions: ARTIFACT_TOOL_DEFS, handlers, store: backing }
}

function lookupArtifact(store, id) {
  const s = store || artifactEvictStore
  if (typeof s.getFriendly === 'function') {
    return s.getFriendly(String(id || ''), {
      notFound: 'artifact 不存在或已清理',
      expired: 'artifact 已过期，请重新生成',
    })
  }
  const entry = (store || artifactStore).get(String(id || ''))
  return entry ? { ok: true, entry } : { ok: false, code: 'not_found', text: 'artifact 不存在' }
}

function getArtifact(store, id) {
  const hit = lookupArtifact(store, id)
  return hit.ok ? hit.entry : null
}

function listArtifacts(store, runId) {
  const out = []
  for (const [, art] of (store || artifactStore)) {
    if (!runId || art.runId === runId) out.push(art)
  }
  return out
}

module.exports = {
  MAX_PDF_PAGES,
  MAX_ARTIFACT_CHARS,
  ARTIFACT_TOOL_DEFS,
  artifactStore,
  artifactEvictStore,
  createArtifactId,
  rowsToCsv,
  markdownToSimpleHtml,
  estimatePdfPages,
  buildArtifactTools,
  getArtifact,
  listArtifacts,
}
