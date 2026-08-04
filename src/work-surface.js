'use strict'

/**
 * Work Surface 状态机：右栏 doc | review | workflow(stub)
 */

const MODES = ['doc', 'review', 'workflow']

function createWorkSurface(initial = {}) {
  let mode = MODES.includes(initial.mode) ? initial.mode : 'doc'
  let artifactId = initial.artifactId ? String(initial.artifactId) : null

  function snapshot() {
    return { mode, artifactId }
  }

  function openReview(id) {
    if (!id) return snapshot()
    mode = 'review'
    artifactId = String(id)
    return snapshot()
  }

  function backToDoc() {
    mode = 'doc'
    // 保留 artifactId 便于「再次打开」记忆；回文档不删产物
    return snapshot()
  }

  function setWorkflowStub() {
    mode = 'workflow'
    return snapshot()
  }

  /** 首个 draft：仅当当前为 doc 时自动进入 review */
  function onArtifactsChanged(artifacts, { autoOpen = true } = {}) {
    const list = Array.isArray(artifacts) ? artifacts : []
    const draft = list.find((a) => a && a.status === 'draft')
    if (!draft) {
      if (mode === 'review' && artifactId) {
        const still = list.find((a) => a.id === artifactId)
        if (!still || still.status !== 'draft') {
          // 当前审阅件已结束 → 回文档
          mode = 'doc'
        }
      }
      return snapshot()
    }
    if (autoOpen && mode === 'doc') {
      return openReview(draft.id)
    }
    if (mode === 'review' && !list.some((a) => a.id === artifactId && a.status === 'draft')) {
      return openReview(draft.id)
    }
    return snapshot()
  }

  function findArtifact(artifacts) {
    if (!artifactId) return null
    return (artifacts || []).find((a) => a && a.id === artifactId) || null
  }

  return {
    MODES,
    getMode: () => mode,
    getArtifactId: () => artifactId,
    snapshot,
    openReview,
    backToDoc,
    setWorkflowStub,
    onArtifactsChanged,
    findArtifact,
  }
}

function summarizeArtifact(art, max = 160) {
  if (!art) return ''
  const body = String(art.body || '').replace(/\s+/g, ' ').trim()
  if (body.length <= max) return body
  return `${body.slice(0, max)}…`
}

const workSurfaceApi = { createWorkSurface, summarizeArtifact, MODES }

if (typeof module === 'object' && module.exports) {
  module.exports = workSurfaceApi
}
if (typeof window !== 'undefined') {
  window.WorkSurface = workSurfaceApi
}
