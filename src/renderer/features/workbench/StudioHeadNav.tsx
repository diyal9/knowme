import { useEffect, useState } from 'react'
import { studioBusinessNodes } from '../../../domain/studio'
import { useAppStore } from '../../app/store'

export function StudioHeadNav() {
  const draft = useAppStore((s) => s.studioDraft)
  const updateName = useAppStore((s) => s.updateStudioDraftName)
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')

  useEffect(() => {
    if (!editing) setValue(draft?.name || '我的专家协作')
  }, [draft?.name, editing])

  if (!draft) return null

  const displayName = draft.name?.trim() || '我的专家协作'
  const bizCount = studioBusinessNodes(draft).length
  const inputCount = Array.isArray(draft.inputs) ? draft.inputs.length : 0
  const outputCount = Array.isArray(draft.outputs) ? draft.outputs.length : 0
  const meta = `${bizCount || draft.nodes.length} 节点 · ${inputCount}入/${outputCount}出${draft.dirty ? ' · 未保存' : ''}`

  function commit() {
    updateName(value)
    setEditing(false)
  }

  return (
    <div className="wb-studio-head-nav" id="wbStudioHeadNav" aria-label="编排导航" data-testid="studio-head-nav">
      <div className="wb-studio-head-title">
        {editing ? (
          <input
            type="text"
            className="wb-studio-title-input"
            id="wbStudioTitleInput"
            maxLength={120}
            aria-label="编辑工作流名称"
            value={value}
            autoFocus
            onChange={(e) => setValue(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit()
              if (e.key === 'Escape') {
                setValue(displayName)
                setEditing(false)
              }
            }}
          />
        ) : (
          <button
            type="button"
            className="wb-studio-title-btn"
            id="wbStudioTitle"
            title="点击修改名称"
            aria-label="工作流名称，点击修改"
            onClick={() => {
              setValue(displayName)
              setEditing(true)
            }}
          >
            {displayName}
          </button>
        )}
        <span className="wb-studio-head-meta" id="wbStudioTopMeta" aria-live="polite">
          {meta}
        </span>
      </div>
    </div>
  )
}
