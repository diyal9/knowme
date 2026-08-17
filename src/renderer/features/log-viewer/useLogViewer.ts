import { useCallback, useEffect, useRef, useState } from 'react'
import { groupLogEntries, type LogGroupItem } from '../../../domain/log-viewer-grouping'
import type { LogEntry } from '../../../shared/api-extended'

const CATEGORY_LABELS: Record<string, string> = {
  '': '全部',
  operation: '操作',
  llm: 'LLM',
  'system-prompt': '系统提示词',
  mcp: 'MCP',
  api: 'API',
  system: '软件运行',
}
const CATEGORY_ORDER = ['', 'operation', 'llm', 'system-prompt', 'mcp', 'api', 'system']

function fmtTime(iso?: string) {
  const d = new Date(iso || '')
  if (Number.isNaN(d.getTime())) return String(iso || '')
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

export function useLogViewer() {
  const [category, setCategory] = useState('')
  const [level, setLevel] = useState('')
  const [search, setSearch] = useState('')
  const [date, setDate] = useState('')
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [lastLoadMs, setLastLoadMs] = useState(0)
  const [groupRuns, setGroupRuns] = useState(true)
  const loadSeq = useRef(0)

  const load = useCallback(async () => {
    const seq = ++loadSeq.current
    setLoading(true)
    setError('')
    const started = Date.now()
    try {
      const result = await window.api?.logsQuery?.({
        category,
        level,
        search,
        date,
      })
      if (seq !== loadSeq.current) return
      if (!result?.ok) {
        setError(result?.error || '加载失败')
        setEntries([])
      } else {
        setEntries(result.entries || [])
      }
      setLastLoadMs(Date.now() - started)
    } catch (err) {
      if (seq !== loadSeq.current) return
      setError(err instanceof Error ? err.message : '加载失败')
      setEntries([])
    } finally {
      if (seq === loadSeq.current) setLoading(false)
    }
    try {
      const cnt = await window.api?.logsCounts?.(date)
      if (seq !== loadSeq.current) return
      if (cnt?.ok) setCounts(cnt.counts || {})
    } catch {
      /* ignore */
    }
  }, [category, date, level, search])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('knowme.log-viewer.group-runs')
      if (saved != null) setGroupRuns(saved !== '0')
    } catch {
      /* ignore */
    }
  }, [])

  const grouped: LogGroupItem[] = groupRuns
    ? groupLogEntries(entries)
    : entries.map((entry) => ({ type: 'entry' as const, entry }))

  const warnPlus = entries.filter((e) => e.level === 'warn' || e.level === 'error').length

  return {
    category,
    setCategory,
    level,
    setLevel,
    search,
    setSearch,
    date,
    setDate,
    entries,
    grouped,
    counts,
    loading,
    error,
    lastLoadMs,
    warnPlus,
    groupRuns,
    setGroupRuns: (next: boolean) => {
      setGroupRuns(next)
      try {
        window.localStorage.setItem('knowme.log-viewer.group-runs', next ? '1' : '0')
      } catch {
        /* ignore */
      }
    },
    reload: load,
    clear: async () => {
      await window.api?.logsClear?.(date)
      void load()
    },
    categoryLabels: CATEGORY_LABELS,
    categoryOrder: CATEGORY_ORDER,
    fmtTime,
  }
}
