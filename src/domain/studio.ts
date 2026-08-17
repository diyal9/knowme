import * as studioModelNs from '@knowme-lib/workbench-studio-model'
import { unwrapCjsApi } from './agent-v2-runtime'

export interface StudioNode {
  id: string
  kind: string
  name: string
  agentPackageId?: string
  intent?: string
  role?: string
  relation?: string
  approvalNote?: string
  x?: number | null
  y?: number | null
  inputSpec?: string
  outputSpec?: string
  config?: Record<string, unknown>
  /** 与基线一致：技能等挂在 profile.skillRefs，不写 config.skillIds。 */
  profile?: Record<string, unknown> | null
}

export interface StudioEdge {
  id: string
  from: string
  to: string
  label?: string
  branch?: string
}

export interface StudioDraft {
  id: string
  name: string
  goal: string
  dirty: boolean
  graphMode: 'free' | 'linear'
  nodes: StudioNode[]
  edges: StudioEdge[] | null
  sourceWorkflowId?: string
  inputs?: unknown[]
  outputs?: unknown[]
}

export interface StudioIssue {
  code: string
  message: string
  nodeId?: string
}

interface StudioModelModule {
  START_ID: string
  END_ID: string
  createDraft: (raw?: Record<string, unknown>) => StudioDraft
  ensureFreeGraph: (draft: StudioDraft, options?: { markDirty?: boolean }) => StudioDraft
  addNode: (draft: StudioDraft, raw?: Record<string, unknown>, options?: Record<string, unknown>) => StudioDraft
  updateDraft: (draft: StudioDraft, patch?: Record<string, unknown>) => StudioDraft
  updateNode: (draft: StudioDraft, nodeId: string, patch?: Record<string, unknown>) => StudioDraft
  updatePosition: (draft: StudioDraft, nodeId: string, x: number, y: number) => StudioDraft
  connect: (draft: StudioDraft, fromId: string, toId: string, meta?: Record<string, unknown>) => StudioDraft
  disconnect: (draft: StudioDraft, edgeIdOrFrom: string, toId?: string) => StudioDraft
  addAgent: (draft: StudioDraft, agent?: Record<string, unknown>, at?: number | null) => StudioDraft
  removeNode: (draft: StudioDraft, nodeId: string) => StudioDraft
  validateDraft: (draft: StudioDraft) => { ok: boolean; issues: StudioIssue[] }
  inspectStudioGraph: (draft: StudioDraft) => {
    ok: boolean
    issues: StudioIssue[]
    walk: { nodeId: string }[]
    startId?: string
  }
  toComposition: (draft: StudioDraft) => Record<string, unknown>
  fromGraph: (graph: Record<string, unknown>, meta?: Record<string, unknown>) => StudioDraft
}

/** Vite 对 IIFE CJS 的 import * 可能拿不到方法，回退到 IIFE 挂在 globalThis 上的同名 API。 */
function resolveStudioModel(): StudioModelModule {
  const fromImport = unwrapCjsApi<StudioModelModule>(studioModelNs, 'createDraft')
  if (typeof fromImport.createDraft === 'function') return fromImport
  const fromGlobal = (globalThis as { WorkbenchStudioModel?: StudioModelModule }).WorkbenchStudioModel
  if (fromGlobal && typeof fromGlobal.createDraft === 'function') return fromGlobal
  throw new Error('WorkbenchStudioModel is not loaded')
}

const model = resolveStudioModel()

export const STUDIO_START_ID = model.START_ID
export const STUDIO_END_ID = model.END_ID

export function createStudioDraft(raw: Record<string, unknown> = {}): StudioDraft {
  return model.createDraft(raw)
}

export function ensureStudioFreeGraph(draft: StudioDraft, markDirty = false): StudioDraft {
  return model.ensureFreeGraph(draft, { markDirty })
}

export function addStudioNode(draft: StudioDraft, raw: Record<string, unknown> = {}): StudioDraft {
  return model.addNode(draft, { kind: 'agent', name: '专家节点', ...raw })
}

export function addStudioNodeOfKind(draft: StudioDraft, raw: Record<string, unknown> = {}): StudioDraft {
  return model.addNode(draft, raw)
}

export function updateStudioDraft(draft: StudioDraft, patch: Record<string, unknown>): StudioDraft {
  return model.updateDraft(draft, patch)
}

export function updateStudioNode(draft: StudioDraft, nodeId: string, patch: Record<string, unknown>): StudioDraft {
  return model.updateNode(draft, nodeId, patch)
}

export function updateStudioNodePosition(
  draft: StudioDraft,
  nodeId: string,
  x: number,
  y: number,
): StudioDraft {
  return model.updatePosition(draft, nodeId, x, y)
}

export function connectStudioNodes(
  draft: StudioDraft,
  fromId: string,
  toId: string,
  meta: Record<string, unknown> = {},
): StudioDraft {
  return model.connect(draft, fromId, toId, meta)
}

export function disconnectStudioEdge(draft: StudioDraft, edgeId: string): StudioDraft {
  return model.disconnect(draft, edgeId)
}

export function addStudioAgent(draft: StudioDraft, agent: Record<string, unknown>): StudioDraft {
  return model.addAgent(draft, agent)
}

export function applyStudioNodePositions(
  draft: StudioDraft,
  positions: Array<{ id: string; x: number; y: number }>,
): StudioDraft {
  let next = draft
  for (const pos of positions) {
    if (!pos?.id) continue
    next = model.updatePosition(next, pos.id, pos.x, pos.y)
  }
  return next
}

export function removeStudioNode(draft: StudioDraft, nodeId: string): StudioDraft {
  return model.removeNode(draft, nodeId)
}

export function validateStudioDraft(draft: StudioDraft): { ok: boolean; issues: StudioIssue[] } {
  return model.validateDraft(draft)
}

export function inspectStudioDraft(draft: StudioDraft) {
  return model.inspectStudioGraph(draft)
}

export function studioDraftToComposition(draft: StudioDraft): Record<string, unknown> {
  return model.toComposition(draft)
}

export function studioDraftFromGraph(graph: Record<string, unknown>, meta: Record<string, unknown> = {}): StudioDraft {
  return model.fromGraph(graph, meta)
}

export function studioBusinessNodes(draft: StudioDraft | null): StudioNode[] {
  return (draft?.nodes || []).filter((node) => node.kind !== 'start' && node.kind !== 'end')
}

export function studioStepListNodes(draft: StudioDraft | null): StudioNode[] {
  const nodes = draft?.nodes || []
  const start = nodes.filter((node) => node.kind === 'start' || node.id === STUDIO_START_ID)
  const end = nodes.filter((node) => node.kind === 'end' || node.id === STUDIO_END_ID)
  const mid = nodes.filter((node) => node.kind !== 'start' && node.kind !== 'end'
    && node.id !== STUDIO_START_ID && node.id !== STUDIO_END_ID)
  return [...start, ...mid, ...end]
}

export function studioEdges(draft: StudioDraft | null): StudioEdge[] {
  return Array.isArray(draft?.edges) ? draft.edges : []
}

export function automationRunCapable(job: {
  workflowId?: string
  domain?: string
  backend?: string
}): boolean {
  return Boolean(String(job.workflowId || '').trim() && String(job.domain || '').trim() && String(job.backend || '').trim())
}

export const AUTOMATION_LIST_HINT =
  '侧栏自动化绑定可执行管线后才会按计划触发；未绑定的计划仅为草稿，不会后台自动运行'
