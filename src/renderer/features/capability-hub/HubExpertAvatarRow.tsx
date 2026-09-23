import { useEffect, useRef, useState } from 'react'
import * as AgentIdentity from '@knowme-lib/agent-identity'
import { Icon } from '../../app/Icon'
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
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const selected = presets.find((preset) => preset.id === value)

  useEffect(() => {
    if (!open) return
    function closeOnOutsideClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    return () => document.removeEventListener('mousedown', closeOnOutsideClick)
  }, [open])

  return (
    <div
      ref={rootRef}
      className="hub-field hub-avatar-field"
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !open) return
        event.stopPropagation()
        setOpen(false)
      }}
    >
      <label>头像</label>
      <button
        type="button"
        className={`hub-avatar-trigger${selected ? ' selected' : ''}`}
        aria-label={selected ? `更换头像，当前${selected.label || '已选择'}` : '选择头像'}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {selected ? (
          <img src={resolveAvatarAssetUrl(selected.src || selected.id)} alt="" />
        ) : (
          <Icon name="users" />
        )}
      </button>
      {open ? (
        <div className="hub-avatar-popover">
          <div className="hub-avatar-picker" role="listbox" aria-label="专家头像">
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                role="option"
                aria-selected={value === preset.id}
                className={`hub-avatar-option${value === preset.id ? ' selected' : ''}`}
                onClick={() => {
                  onChange(preset.id)
                  setOpen(false)
                }}
              >
                <img src={resolveAvatarAssetUrl(preset.src || preset.id)} alt="" />
                <span>{preset.label}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
