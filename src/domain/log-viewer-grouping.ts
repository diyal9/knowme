import type { LogEntry } from '../shared/api-extended'
import * as logGroupingNs from '@knowme-lib/log-grouping'
const logGrouping = (logGroupingNs as any).logGrouping || logGroupingNs

export type LogGroupSummary = {
  runId?: string
  level?: string
  title?: string
  count?: number
  errorCount?: number
  startTs?: string
  endTs?: string
}

export type LogGroupItem =
  | { type: 'entry'; entry: LogEntry }
  | { type: 'group'; runId: string; entries: LogEntry[]; summary: LogGroupSummary }

type GroupingModule = {
  groupLogEntries: (entries: LogEntry[]) => LogGroupItem[]
}

const grouping = logGrouping as GroupingModule

export function groupLogEntries(entries: LogEntry[]): LogGroupItem[] {
  return grouping.groupLogEntries(entries)
}
