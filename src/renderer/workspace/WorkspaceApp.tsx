import { useEffect, useState } from 'react'
import { mountLegacyWorkspace } from './legacy/mountLegacyWorkspace'
import { SideRailOverlay } from './shell/SideRailOverlay'
import type { WorkspaceMode } from './shell/types'
import { WORKSPACE_SURFACES } from './surfaces/registry'

/**
 * React/TS workspace entry: boot legacy DOM+scripts for product parity,
 * while React owns migration shell telemetry and future surface ownership.
 */
export function WorkspaceApp() {
  const [status, setStatus] = useState<'booting' | 'ready' | 'error'>('booting')
  const [error, setError] = useState('')
  const [mode, setMode] = useState<WorkspaceMode>('agent')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await mountLegacyWorkspace()
        if (cancelled) return
        document.getElementById('root')?.setAttribute('data-km-renderer', 'vite')
        document.getElementById('root')?.setAttribute(
          'data-km-surfaces',
          JSON.stringify(WORKSPACE_SURFACES),
        )
        setStatus('ready')
        void window.api?.appInfo?.().catch(() => null)
      } catch (err) {
        if (cancelled) return
        setStatus('error')
        setError(err instanceof Error ? err.message : String(err))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (status !== 'ready') return
    const shell = document.getElementById('appShell')
    if (!shell) return
    const sync = () => {
      if (shell.classList.contains('mode-workbench')) setMode('workbench')
      else if (shell.classList.contains('mode-knowledge')) setMode('knowledge')
      else setMode('agent')
    }
    sync()
    const obs = new MutationObserver(sync)
    obs.observe(shell, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [status])

  if (status === 'booting') {
    return <div className="km-boot">正在加载 KnowMe 工作台…</div>
  }
  if (status === 'error') {
    return (
      <div className="km-boot">
        <div className="km-boot-error">
          Vite workspace 启动失败（可设 KNOWME_RENDERER=legacy 回滚）{'\n'}
          {error}
        </div>
      </div>
    )
  }

  return <SideRailOverlay mode={mode} />
}
