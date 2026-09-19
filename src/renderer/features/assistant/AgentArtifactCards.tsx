/** 会话 run.artifacts 产物卡：打开 / 接受 / 拒绝。 */
import type { AgentRunArtifact } from '../../../shared/api'
import { artifactPreviewSource, artifactPreviewSources, createArtifactPreviewContract, type ArtifactPreviewAction } from '../../../domain/artifact-preview'
import { conversationFileKind, conversationFileKindLabel, conversationFileName } from '../../../domain/conversation-file'
import { useAppStore } from '../../app/store'
import { ArtifactActionBar, ArtifactPreview } from '../artifact/ArtifactPreview'

export function AgentArtifactCards({ artifacts, onImageOpen }: { artifacts: AgentRunArtifact[]; onImageOpen?: (url: string) => void }) {
  const accept = useAppStore((s) => s.acceptAssistantArtifact)
  const reject = useAppStore((s) => s.rejectAssistantArtifact)
  const showToast = useAppStore((s) => s.showToast)
  if (!artifacts.length) return null

  return (
    <div className="agent-artifact-list" data-testid="agent-artifact-list">
      {artifacts.map((art) => {
        const st = art.status || 'draft'
        const isPatch = art.type === 'editor_patch'
        const path = art.targetPath || art.path || art.meta?.path || ''
        const fileKind = conversationFileKind(art.type, art.title, art.url || path)
        const imageSource = fileKind === 'image'
          ? artifactPreviewSource(art)
          : ''
        const actions: ArtifactPreviewAction[] = ['open']
        if (st === 'draft') actions.push('accept', 'reject')
        const preview = createArtifactPreviewContract({
          id: art.id,
          type: art.type,
          title: art.title || art.type || '产物',
          source: imageSource,
          sources: fileKind === 'image' ? artifactPreviewSources(art) : undefined,
          fileName: path ? conversationFileName(path) : undefined,
          state: st === 'accepted' ? 'accepted' : st === 'rejected' ? 'rejected' : 'pending',
          actions,
        })
        const handleAction = (action: ArtifactPreviewAction, resolvedArtifact = preview) => {
          if (action === 'accept') return void accept(art.id)
          if (action === 'reject') return void reject(art.id)
          if (action !== 'open') return
          if (resolvedArtifact.source && onImageOpen) return onImageOpen(resolvedArtifact.source)
          if (path) showToast(`目标：${path}`)
          else showToast(art.title || conversationFileKindLabel(fileKind))
        }
        return (
          <div key={art.id} data-testid="agent-artifact-card" data-file-kind={fileKind} data-editor-patch={isPatch || undefined}>
            <ArtifactPreview artifact={preview} onAction={handleAction} showActions={false} />
            <ArtifactActionBar artifact={preview} onAction={handleAction} showState />
          </div>
        )
      })}
    </div>
  )
}
