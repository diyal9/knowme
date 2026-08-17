/** Work Surface 状态机：右栏 doc | review | workflow(stub) */

export const WORK_SURFACE_MODES = ['doc', 'review', 'workflow'] as const
export type WorkSurfaceMode = typeof WORK_SURFACE_MODES[number]

export type WorkSurfaceArtifact = {
  id?: string
  status?: string
  body?: string
}

export function createWorkSurface(initial: { mode?: string; artifactId?: string } = {}) {
  let mode: WorkSurfaceMode = WORK_SURFACE_MODES.includes(initial.mode as WorkSurfaceMode)
    ? (initial.mode as WorkSurfaceMode)
    : 'doc'
  let artifactId: string | null = initial.artifactId ? String(initial.artifactId) : null

  function snapshot() {
    return { mode, artifactId }
  }

  function openReview(id: string) {
    if (!id) return snapshot()
    mode = 'review'
    artifactId = String(id)
    return snapshot()
  }

  function backToDoc() {
    mode = 'doc'
    return snapshot()
  }

  function setWorkflowStub() {
    mode = 'workflow'
    return snapshot()
  }

  function onArtifactsChanged(artifacts: WorkSurfaceArtifact[], { autoOpen = true } = {}) {
    const list = Array.isArray(artifacts) ? artifacts : []
    const draft = list.find((a) => a && a.status === 'draft')
    if (!draft) {
      if (mode === 'review' && artifactId) {
        const still = list.find((a) => a.id === artifactId)
        if (!still || still.status !== 'draft') {
          mode = 'doc'
        }
      }
      return snapshot()
    }
    if (autoOpen && mode === 'doc') {
      return openReview(String(draft.id))
    }
    if (mode === 'review' && !list.some((a) => a.id === artifactId && a.status === 'draft')) {
      return openReview(String(draft.id))
    }
    return snapshot()
  }

  function findArtifact(artifacts: WorkSurfaceArtifact[]) {
    if (!artifactId) return null
    return (artifacts || []).find((a) => a && a.id === artifactId) || null
  }

  return {
    MODES: WORK_SURFACE_MODES,
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

export function summarizeArtifact(art: WorkSurfaceArtifact | null | undefined, max = 160): string {
  if (!art) return ''
  const body = String(art.body || '').replace(/\s+/g, ' ').trim()
  if (body.length <= max) return body
  return `${body.slice(0, max)}…`
}

module.exports = {
  createWorkSurface,
  summarizeArtifact,
  MODES: WORK_SURFACE_MODES,
}
