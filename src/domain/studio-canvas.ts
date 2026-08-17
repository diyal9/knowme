import type { StudioDraft } from './studio'
import * as studioCanvasNs from '@knowme-lib/workbench-studio-canvas'

void studioCanvasNs

export type StudioCanvasNode = {
  id: string
  kind: string
  name?: string
  title?: string
  typeLabel?: string
  subtitle?: string
  x: number
  y: number
  w: number
  h: number
  selected?: boolean
  canInput?: boolean
  canOutput?: boolean
  relation?: string
  agentPackageId?: string
  sections?: Array<{ title?: string; rows?: string[]; mode?: string; tone?: string }>
}

export type StudioPaletteItem = {
  id: string
  kind: string
  title: string
  hint: string
  system?: boolean
  group?: string
  groupTitle?: string
}

export type StudioCanvasEdge = {
  id: string
  path: string
  selected?: boolean
  from: string
  to: string
  branch?: string
  label?: string
}

export type StudioCanvasBoard = {
  width: number
  height: number
  empty: boolean
  nodes: StudioCanvasNode[]
  edges: StudioCanvasEdge[]
}

type CanvasModule = {
  buildBoard: (
    draft: StudioDraft,
    options?: {
      selectedId?: string
      selectedEdgeId?: string
      knownExpertIds?: string[]
      toComposition?: (d: StudioDraft) => Record<string, unknown>
    },
  ) => StudioCanvasBoard
  paletteTypes: () => StudioPaletteItem[]
  iconForKind: (kind: string) => string
  layoutPositions: (draft: StudioDraft) => Array<{ id: string; x: number; y: number }>
  edgePathPoints: (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    fromSide?: string,
    toSide?: string,
  ) => string
  edgePath: (
    from: { x: number; y: number; w?: number; h?: number },
    to: { x: number; y: number; w?: number; h?: number },
  ) => string
}

function canvas(): CanvasModule {
  const resolved = (globalThis as { WorkbenchStudioCanvas?: CanvasModule }).WorkbenchStudioCanvas
  if (!resolved || typeof resolved.buildBoard !== 'function') {
    throw new Error('WorkbenchStudioCanvas is not loaded')
  }
  return resolved
}

export function buildStudioCanvasBoard(
  draft: StudioDraft,
  options?: Parameters<CanvasModule['buildBoard']>[1],
): StudioCanvasBoard {
  return canvas().buildBoard(draft, options)
}

export function studioPaletteTypes(): StudioPaletteItem[] {
  return canvas().paletteTypes()
}

export function studioIconForKind(kind: string): string {
  return canvas().iconForKind(kind)
}

export function studioLayoutPositions(draft: StudioDraft): Array<{ id: string; x: number; y: number }> {
  return canvas().layoutPositions(draft)
}

export function studioEdgePathPoints(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  fromSide = 'right',
  toSide = 'left',
): string {
  return canvas().edgePathPoints(x1, y1, x2, y2, fromSide, toSide)
}

export function studioEdgePath(
  from: { x: number; y: number; w?: number; h?: number },
  to: { x: number; y: number; w?: number; h?: number },
): string {
  return canvas().edgePath(from, to)
}

export const STUDIO_SCALE_MIN = 0.5
export const STUDIO_SCALE_MAX = 1.6
export const STUDIO_SCALE_STEP = 0.1
