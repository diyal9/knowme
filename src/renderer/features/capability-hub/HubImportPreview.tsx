/**
 * 导入前决策面板：展示预检快照，确认后才 trustConfirmed。
 */
import { redactPreviewFields } from '../../../domain/agent-recovery-actions'

type Preview = {
  name?: string
  version?: string
  kind?: string
  risk?: { level?: string; reasons?: string[] }
  compatibility?: { status?: string; reason?: string }
  estimatedCost?: { estimate?: string; level?: string }
  rollbackHint?: string
  permissions?: Record<string, unknown>
  trust?: { status?: string; message?: string }
  counts?: { experts?: number; skills?: number; connectors?: number; workflows?: number; blocked?: number }
}

type Props = {
  preview: Preview
  error?: string
  onConfirm: () => void
  onCancel: () => void
}

export function HubImportPreview({ preview, error, onConfirm, onCancel }: Props) {
  const safe = redactPreviewFields(preview) as Preview
  const blocked = safe.compatibility?.status === 'blocked' || Boolean(error)
  const risk = String(safe.risk?.level || 'low')
  return (
    <div className="hub-import-preview" data-testid="hub-import-preview">
      <h3>{safe.name || '待导入能力'}</h3>
      <p className="hub-import-meta">{[safe.kind, safe.version].filter(Boolean).join(' · ')}</p>
      <dl>
        <div><dt>风险</dt><dd data-testid="hub-import-risk">{risk}{safe.risk?.reasons?.length ? ` · ${safe.risk.reasons[0]}` : ''}</dd></div>
        <div><dt>兼容</dt><dd>{safe.compatibility?.status === 'blocked' ? (safe.compatibility.reason || '不兼容') : '可用'}</dd></div>
        <div><dt>成本</dt><dd>{safe.estimatedCost?.estimate || '估算值 · 较低'}</dd></div>
        {safe.counts ? <div><dt>内容</dt><dd>{`专家 ${safe.counts.experts || 0} · 技能 ${safe.counts.skills || 0} · 连接器 ${safe.counts.connectors || 0} · 工作流 ${safe.counts.workflows || 0}`}</dd></div> : null}
        <div><dt>回滚</dt><dd>{safe.rollbackHint || '安装后可在详情中停用'}</dd></div>
      </dl>
      {blocked ? (
        <p className="hub-import-fail" data-testid="hub-import-blocked">
          {error || safe.compatibility?.reason || '未通过预检，已阻断安装。'}
          {' '}可检查依赖、签名或更换来源后再试。
        </p>
      ) : null}
      <div className="hub-import-actions">
        <button type="button" className="hub-btn" onClick={onCancel}>取消</button>
        <button type="button" className="hub-btn primary" data-testid="hub-import-confirm" disabled={blocked} onClick={onConfirm}>
          确认安装
        </button>
      </div>
    </div>
  )
}
