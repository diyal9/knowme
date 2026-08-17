import type { ReviewTabId } from '../../../domain/daemon-review-tabs'
import type { ShelfCardModel } from '../../../domain/shelf'
import { rosterLabelsFromPackage } from '../../../domain/run-projection'
import type { RunState } from '../../app/store-types'
import { api } from '../../app/store-types'

export type { RunState }

export function emptyRun(
  card: Pick<ShelfCardModel, 'id' | 'name'>,
  brief = '',
  slug = card.id,
  phase: RunState['phase'] = 'input',
): RunState {
  return {
    workflowId: card.id,
    workflowName: card.name,
    slug,
    lane: 'workflow',
    phase,
    brief,
    log: phase === 'input'
      ? [`已打开工作流「${card.name}」`, '填写目标后开始运行']
      : [`已打开运行「${card.name}」`],
    gateNode: null,
    gateTitle: null,
    processLogsText: '',
    progressText: '',
    showProcess: false,
    artifacts: [],
    inputAgents: [],
    agents: [],
    graphNodes: [],
    currentOwner: '',
    projectionDegraded: false,
    projectionDegradedReason: '',
    reviewTab: 'steps',
    reviewEvents: [],
    reviewChanges: { summary: '', files: [], empty: true },
    daemonStatus: '',
    dialogueMessages: [],
  }
}

export async function loadInputAgents(workflowId: string): Promise<string[]> {
  try {
    const result = await api()?.workbenchWorkflowPackageGet?.(workflowId)
    return rosterLabelsFromPackage(result)
  } catch {
    return []
  }
}

export function parseReviewEventsFromRaw(
  eventsRaw: unknown,
  fallback: RunState['reviewEvents'],
): RunState['reviewEvents'] {
  const eventsRecord = eventsRaw && typeof eventsRaw === 'object'
    ? eventsRaw as Record<string, unknown>
    : null
  if (!Array.isArray(eventsRecord?.events)) return fallback
  return eventsRecord!.events.map((item, index) => {
    const rec = item && typeof item === 'object' ? item as Record<string, unknown> : {}
    return {
      id: String(rec.id || rec.event_id || `event-${index + 1}`),
      type: String(rec.type || rec.kind || 'event'),
      message: String(rec.message || rec.summary || rec.text || ''),
      at: String(rec.at || rec.ts || rec.time || ''),
    }
  })
}

export function parseReviewChangesFromRaw(
  changesRaw: unknown,
  fallback: RunState['reviewChanges'],
): RunState['reviewChanges'] {
  const changesRecord = changesRaw && typeof changesRaw === 'object'
    ? changesRaw as Record<string, unknown>
    : null
  if (!changesRecord) return fallback
  const files = Array.isArray(changesRecord.files) ? changesRecord.files : []
  return {
    summary: String(changesRecord.summary || changesRecord.message || ''),
    files: files.map((item, index) => {
      if (typeof item === 'string') {
        return { id: `chg-${index + 1}`, path: item, status: 'modified' }
      }
      const rec = item && typeof item === 'object' ? item as Record<string, unknown> : {}
      return {
        id: String(rec.id || rec.path || `chg-${index + 1}`),
        path: String(rec.path || rec.file || rec.name || ''),
        status: String(rec.status || rec.change || 'modified'),
      }
    }).filter((item) => item.path),
    empty: !files.length,
  }
}
