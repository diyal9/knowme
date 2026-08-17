import { useCallback, useEffect, useState } from 'react'
import type { ContentSourceRef } from '../../../shared/api'
import type { SettingsForm } from '../../../shared/api-extended'

export type SettingsTabId =
  | 'sources'
  | 'ai'
  | 'assistant'
  | 'system'
  | 'connectors'
  | 'memory'
  | 'about'

const TAB_IDS: SettingsTabId[] = [
  'sources',
  'ai',
  'assistant',
  'system',
  'connectors',
  'memory',
  'about',
]

export function parseSettingsTab(raw?: string): SettingsTabId | '' {
  const tab = String(raw || '').trim()
  return TAB_IDS.includes(tab as SettingsTabId) ? (tab as SettingsTabId) : ''
}

export function tabFromQuery(): SettingsTabId {
  try {
    return parseSettingsTab(new URLSearchParams(window.location.search).get('tab') || '') || 'sources'
  } catch {
    return 'sources'
  }
}

export function useSettingsForm(initialTab?: string) {
  const [tab, setTab] = useState<SettingsTabId>(parseSettingsTab(initialTab) || tabFromQuery())
  const [form, setForm] = useState<SettingsForm>({})
  const [sources, setSources] = useState<ContentSourceRef[]>([])
  const [gitAvailable, setGitAvailable] = useState<boolean | undefined>(undefined)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [toastKind, setToastKind] = useState<'ok' | 'err' | ''>('')

  const patch = useCallback((next: Partial<SettingsForm>) => {
    setForm((prev) => ({ ...prev, ...next }))
    setDirty(true)
  }, [])

  const flash = useCallback((message: string, kind: 'ok' | 'err' = 'ok') => {
    setToast(message)
    setToastKind(kind)
    window.setTimeout(() => {
      setToast('')
      setToastKind('')
    }, 3200)
  }, [])

  const refreshSources = useCallback(async () => {
    try {
      const list = await window.api?.sourcesList?.()
      setSources(list?.sources || [])
      setGitAvailable(list?.gitAvailable)
    } catch {
      setSources([])
    }
  }, [])

  useEffect(() => {
    const apply = (settings: SettingsForm) => {
      setForm(settings || {})
      setDirty(false)
    }
    window.api?.initSettings?.(apply)
    try {
      const sync = window.api?.getSettings?.()
      if (sync) apply(sync)
    } catch {
      /* ignore */
    }
    void refreshSources()
    window.api?.onSelectSettingsTab?.((nextTab) => {
      if (TAB_IDS.includes(nextTab as SettingsTabId)) setTab(nextTab as SettingsTabId)
    })
  }, [refreshSources])

  useEffect(() => {
    const next = parseSettingsTab(initialTab)
    if (next) setTab(next)
  }, [initialTab])

  const save = useCallback(async () => {
    setSaving(true)
    try {
      await window.api?.saveSettings?.(form)
      setDirty(false)
      flash('设置已保存')
    } catch {
      flash('保存失败', 'err')
    } finally {
      setSaving(false)
    }
  }, [flash, form])

  return {
    tab,
    setTab,
    form,
    patch,
    sources,
    gitAvailable,
    refreshSources,
    dirty,
    saving,
    save,
    toast,
    toastKind,
    flash,
  }
}
