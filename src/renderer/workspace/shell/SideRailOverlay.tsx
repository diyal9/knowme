import type { WorkspaceMode } from './types'

/**
 * Non-invasive React overlay for migration telemetry / future rail ownership.
 * Does not replace legacy rail DOM (product parity); listens and mirrors mode.
 */
export function SideRailOverlay({ mode }: { mode: WorkspaceMode }) {
  return (
    <div
      id="km-react-shell-badge"
      data-mode={mode}
      hidden
      aria-hidden="true"
      title="React/TS renderer active"
    />
  )
}
