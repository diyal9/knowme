'use strict'

const ARTIFACT_STATUS_LABELS = {
  draft: '待确认',
  accepted: '已接受',
  rejected: '已拒绝',
}

function artifactStatusLabel(status) {
  return ARTIFACT_STATUS_LABELS[String(status || '').trim()] || '草稿'
}

function targetPathLabel(targetPath) {
  const raw = String(targetPath || '').trim().replace(/\\/g, '/')
  if (!raw) return ''
  const parts = raw.split('/').filter(Boolean)
  return parts.length ? parts[parts.length - 1] : ''
}

function normalizeGeneratedArtifact(raw, session = {}) {
  if (!raw || typeof raw !== 'object') return null
  const id = String(raw.id || '').trim()
  const sessionId = String(session.id || '').trim()
  if (!id || !sessionId) return null
  return {
    id,
    sessionId,
    title: String(raw.title || raw.name || raw.type || '未命名产物').trim().slice(0, 120),
    type: String(raw.type || 'text').trim(),
    status: ['draft', 'accepted', 'rejected'].includes(raw.status) ? raw.status : 'draft',
    sessionTitle: String(session.displayTitle || session.title || session.run?.goal || 'Agent 会话').trim().slice(0, 120),
    updatedAt: String(session.updatedAt || session.createdAt || '').trim(),
    targetPath: String(raw.targetPath || '').trim().slice(0, 260),
  }
}

function artifactMetaLabel(artifact) {
  if (!artifact || typeof artifact !== 'object') return '草稿'
  const parts = [artifactStatusLabel(artifact.status)]
  const pathLabel = targetPathLabel(artifact.targetPath)
  if (pathLabel) parts.push(pathLabel)
  return parts.join(' · ')
}

function collectGeneratedArtifacts(sessions = [], limit = 8) {
  const rows = []
  for (const session of Array.isArray(sessions) ? sessions : []) {
    const artifacts = Array.isArray(session?.run?.artifacts) ? session.run.artifacts : []
    for (const artifact of artifacts) {
      const normalized = normalizeGeneratedArtifact(artifact, session)
      if (normalized) rows.push(normalized)
    }
  }
  rows.sort((a, b) => {
    const at = new Date(a.updatedAt || 0).getTime()
    const bt = new Date(b.updatedAt || 0).getTime()
    return bt - at || a.title.localeCompare(b.title, 'zh-CN')
  })
  const seen = new Set()
  return rows.filter((row) => {
    const key = `${row.sessionId}:${row.id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, Math.max(0, Number(limit) || 0))
}

const fileCenterModelApi = {
  ARTIFACT_STATUS_LABELS,
  artifactStatusLabel,
  artifactMetaLabel,
  normalizeGeneratedArtifact,
  collectGeneratedArtifacts,
}

if (typeof module === 'object' && module.exports) {
  module.exports = fileCenterModelApi
}
if (typeof window !== 'undefined') {
  window.FileCenterModel = fileCenterModelApi
}
