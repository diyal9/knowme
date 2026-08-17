import type { ReactNode } from 'react'
import { Icon } from '../../app/Icon'
import { useAppStore } from '../../app/store'

type Props = {
  simpleMode: boolean
  hasNodes: boolean
  meta: ReactNode
  onToggleMode: () => void
  onInspect: () => void
}

function ToolBtn({
  label,
  icon,
  onClick,
  disabled,
  pressed,
  primary,
  testId,
}: {
  label: string
  icon: string
  onClick: () => void
  disabled?: boolean
  pressed?: boolean
  primary?: boolean
  testId?: string
}) {
  return (
    <button
      type="button"
      className={`wb-studio-tool-btn${primary ? ' primary' : ''}`}
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      data-testid={testId}
      onClick={onClick}
    >
      <Icon name={icon} />
    </button>
  )
}

export function StudioToolbar({ simpleMode, hasNodes, meta, onToggleMode, onInspect }: Props) {
  const saving = useAppStore((s) => s.studioSaving)
  const saveStudio = useAppStore((s) => s.saveStudio)
  const autoLayoutStudio = useAppStore((s) => s.autoLayoutStudio)

  return (
    <>
      <div className="wb-studio-tools" id="wbStudioTools" role="toolbar" aria-label="编排工具">
        <ToolBtn
          label={simpleMode ? '专业画布' : '轻量步骤'}
          icon={simpleMode ? 'network' : 'list'}
          pressed={simpleMode}
          testId="studio-toggle-mode"
          onClick={onToggleMode}
        />
        {simpleMode ? null : (
          <>
            <span className="wb-studio-tools-sep" aria-hidden="true" />
            <ToolBtn
              label="一键对齐"
              icon="layoutTidy"
              disabled={!hasNodes}
              testId="studio-auto-layout"
              onClick={() => autoLayoutStudio()}
            />
          </>
        )}
      </div>
      <div className="wb-studio-toolbar-meta">{meta}</div>
      <div className="wb-studio-actions" id="wbStudioActions">
        <ToolBtn
          label={saving ? '保存中…' : '保存'}
          icon="save"
          disabled={saving || !hasNodes}
          testId="studio-save"
          onClick={() => void saveStudio()}
        />
        <ToolBtn
          label="检查流程（不会真正运行）"
          icon="play"
          primary
          disabled={!hasNodes}
          testId="studio-inspect"
          onClick={onInspect}
        />
      </div>
    </>
  )
}
