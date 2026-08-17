import * as AgentIdentity from '@knowme-lib/agent-identity'
import { resolveAvatarAssetUrl } from '../../lib/avatar-urls'

const listPresetAvatars = (AgentIdentity as any).listPresetAvatars as () => {
  id: string
  label?: string
  src?: string
}[]

type Props = {
  value: string
  onChange: (id: string) => void
}

export function HubExpertAvatarRow({ value, onChange }: Props) {
  const presets = listPresetAvatars()
  return (
    <div className="hub-field">
      <label>头像</label>
      <div className="hub-avatar-picker" role="listbox" aria-label="专家头像">
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            role="option"
            aria-selected={value === preset.id}
            className={`hub-avatar-option${value === preset.id ? ' selected' : ''}`}
            onClick={() => onChange(preset.id)}
          >
            <img src={resolveAvatarAssetUrl(preset.src || preset.id)} alt="" />
            <span>{preset.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
