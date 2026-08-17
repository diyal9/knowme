/** 会话 run.artifacts 产物卡：打开 / 接受 / 拒绝。 */
import type { AgentRunArtifact } from '../../../shared/api'
import { useAppStore } from '../../app/store'

function summarize(art: AgentRunArtifact, max = 140) {
  return String(art.body || '').replace(/\s+/g, ' ').trim().slice(0, max)
}

export function AgentArtifactCards({ artifacts }: { artifacts: AgentRunArtifact[] }) {
  const accept = useAppStore((s) => s.acceptAssistantArtifact)
  const reject = useAppStore((s) => s.rejectAssistantArtifact)
  const showToast = useAppStore((s) => s.showToast)
  if (!artifacts.length) return null

  return (
    <div className="agent-artifact-list" data-testid="agent-artifact-list">
      {artifacts.map((art) => {
        const st = art.status || 'draft'
        const isPatch = art.type === 'editor_patch'
        return (
          <div
            key={art.id}
            className={`agent-artifact summary ${st}`}
            data-testid="agent-artifact-card"
          >
            <div className="agent-artifact-title">{art.title || art.type || '产物'}</div>
            {art.targetPath || art.meta?.path ? (
              <div className="agent-artifact-meta">
                目标：{art.targetPath || art.meta?.path}
              </div>
            ) : isPatch ? (
              <div className="agent-artifact-meta">写入当前打开的文件 · 需确认</div>
            ) : null}
            <div className="agent-artifact-body">{summarize(art)}</div>
            <div className="agent-artifact-actions">
              <button
                type="button"
                className="primary-open"
                onClick={() => {
                  const path = art.targetPath || art.meta?.path
                  if (path) showToast(`目标：${path}`)
                  else showToast(art.title || '产物')
                }}
              >
                查看摘要
              </button>
              {st === 'draft' ? (
                <>
                  <button type="button" onClick={() => void accept(art.id)}>接受</button>
                  <button type="button" className="subtle" onClick={() => void reject(art.id)}>拒绝</button>
                </>
              ) : (
                <span className="agent-artifact-meta" style={{ alignSelf: 'center' }}>
                  {st === 'accepted' ? (isPatch ? '已写入' : '已接受') : '已拒绝'}
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
