type Props = {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  sub?: string
}

export function SettingsToggle({ checked, onChange, label, sub }: Props) {
  return (
    <div className="settings-toggle-row">
      <div className="settings-toggle-copy">
        <div className="settings-toggle-label">{label}</div>
        {sub ? <div className="settings-toggle-sub">{sub}</div> : null}
      </div>
      <label className="settings-switch">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="settings-switch-slider" />
      </label>
    </div>
  )
}
