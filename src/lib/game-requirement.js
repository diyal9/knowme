'use strict'

const crypto = require('crypto')

const SECTIONS = [
  { key: 'background', title: '背景', required: true },
  { key: 'goals', title: '目标', required: true },
  { key: 'gameplay', title: '玩法', required: true },
  { key: 'rules', title: '规则', required: false },
  { key: 'economy', title: '数值/资源', required: false },
  { key: 'analytics', title: '埋点', required: false },
  { key: 'acceptance', title: '验收标准', required: true },
  { key: 'risks', title: '风险与待确认', required: false },
]

const SECTION_HEADING_RE = /^#{1,3}\s*(背景|目标|玩法|规则|数值\/资源|数值|资源|埋点|验收标准|风险)/

function emptyDoc(title = '') {
  const doc = {
    id: crypto.randomUUID(),
    title: String(title || '').trim() || '未命名游戏需求',
    status: 'draft',
    sections: {},
    sources: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  for (const s of SECTIONS) doc.sections[s.key] = ''
  return doc
}

function headingToKey(heading) {
  const h = String(heading || '').trim()
  if (/背景/.test(h)) return 'background'
  if (/目标/.test(h)) return 'goals'
  if (/玩法/.test(h)) return 'gameplay'
  if (/规则/.test(h)) return 'rules'
  if (/数值|资源/.test(h)) return 'economy'
  if (/埋点/.test(h)) return 'analytics'
  if (/验收/.test(h)) return 'acceptance'
  if (/风险/.test(h)) return 'risks'
  return null
}

function parseFromMarkdown(text = '', title = '') {
  const doc = emptyDoc(title)
  const lines = String(text || '').split(/\r?\n/)
  let currentKey = null
  const chunks = []

  for (const line of lines) {
    const m = line.match(SECTION_HEADING_RE)
    if (m) {
      if (currentKey && chunks.length) {
        doc.sections[currentKey] = chunks.join('\n').trim()
        chunks.length = 0
      }
      currentKey = headingToKey(m[1])
      continue
    }
    if (/^#\s+/.test(line)) {
      doc.title = line.replace(/^#+\s*/, '').trim() || doc.title
      continue
    }
    if (currentKey) chunks.push(line)
  }
  if (currentKey && chunks.length) {
    doc.sections[currentKey] = chunks.join('\n').trim()
  }
  doc.updatedAt = new Date().toISOString()
  return doc
}

function validate(doc) {
  const errors = []
  const missing = []
  if (!doc || typeof doc !== 'object') {
    return { ok: false, errors: ['invalid_document'], missing: SECTIONS.filter(s => s.required).map(s => s.key) }
  }
  if (!String(doc.title || '').trim()) errors.push('missing_title')
  for (const s of SECTIONS) {
    const val = String(doc.sections?.[s.key] || '').trim()
    if (s.required && !val) missing.push(s.key)
  }
  if (missing.length) errors.push('missing_required_sections')
  return { ok: errors.length === 0, errors, missing }
}

function toMarkdown(doc) {
  const lines = [`# ${doc.title || '游戏需求案'}`, '']
  for (const s of SECTIONS) {
    const body = String(doc.sections?.[s.key] || '').trim()
    lines.push(`## ${s.title}`, body || '（待补充）', '')
  }
  if (Array.isArray(doc.sources) && doc.sources.length) {
    lines.push('## 引用来源', ...doc.sources.map(src => `- ${src}`), '')
  }
  return lines.join('\n').trim()
}

function buildPromptContext(doc) {
  const v = validate(doc)
  const lines = [
    '【结构化游戏需求案】',
    `标题：${doc.title}`,
    `完整性：${v.ok ? '可提交审批' : `缺 ${v.missing.join('、')}`}`,
  ]
  for (const s of SECTIONS) {
    const body = String(doc.sections?.[s.key] || '').trim()
    if (body) lines.push(`### ${s.title}\n${body.slice(0, 800)}`)
  }
  return lines.join('\n\n')
}

function buildArtifact(doc) {
  return {
    type: 'text',
    title: doc.title || '游戏需求案',
    body: toMarkdown(doc),
    status: 'draft',
    meta: {
      workspaceAction: 'game_requirement_review',
      gameRequirementId: doc.id,
      allowFeishuDraft: true,
      suggestedFeishuTitle: doc.title,
      sections: doc.sections,
      validation: validate(doc),
    },
  }
}

function attachSource(doc, source) {
  const next = { ...doc, sources: [...(doc.sources || [])] }
  const label = String(source || '').trim()
  if (label && !next.sources.includes(label)) next.sources.push(label)
  next.updatedAt = new Date().toISOString()
  return next
}

function approve(doc) {
  const v = validate(doc)
  if (!v.ok) return { ok: false, validation: v, doc }
  return {
    ok: true,
    doc: { ...doc, status: 'approved', updatedAt: new Date().toISOString() },
  }
}

module.exports = {
  SECTIONS,
  emptyDoc,
  parseFromMarkdown,
  validate,
  toMarkdown,
  buildPromptContext,
  buildArtifact,
  attachSource,
  approve,
}
