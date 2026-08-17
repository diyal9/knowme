import { useCallback, useEffect, useState } from 'react'
import { Icon } from '../../app/Icon'
import { useAppStore } from '../../app/store'

type TreeEntry = {
  name: string
  path: string
  kind: 'dir' | 'file'
  size?: number
}

function parseTree(raw: unknown): TreeEntry[] {
  const rec = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  const list = Array.isArray(rec.entries) ? rec.entries : Array.isArray(rec.items) ? rec.items : []
  return list.map((item) => {
    const row = item && typeof item === 'object' ? item as Record<string, unknown> : {}
    const kind: TreeEntry['kind'] = row.kind === 'dir' || row.type === 'dir' ? 'dir' : 'file'
    return {
      name: String(row.name || row.path || ''),
      path: String(row.path || row.name || ''),
      kind,
      size: Number(row.size) || undefined,
    }
  }).filter((item) => item.name)
}

export function WorkspaceTreeModal() {
  const modal = useAppStore((s) => s.workspaceModal)
  const close = useAppStore((s) => s.closeWorkspaceModal)
  const [entries, setEntries] = useState<TreeEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedPath, setSelectedPath] = useState('')
  const [blobText, setBlobText] = useState('')

  const loadTree = useCallback(async (slug: string, relPath = '') => {
    setLoading(true)
    try {
      const result = await window.api?.workbenchDaemonWorkspaceTree?.(slug, relPath) as Record<string, unknown> | undefined
      if (result?.ok === false) {
        setEntries([])
        return
      }
      setEntries(parseTree(result))
    } catch {
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!modal?.slug) return
    setSelectedPath('')
    setBlobText('')
    void loadTree(modal.slug)
  }, [loadTree, modal?.slug])

  async function openFile(path: string) {
    if (!modal?.slug) return
    setSelectedPath(path)
    setBlobText('')
    try {
      const result = await window.api?.workbenchDaemonWorkspaceBlob?.(modal.slug, path) as Record<string, unknown> | undefined
      if (result?.ok === false) {
        setBlobText(String(result.error || '无法读取文件'))
        return
      }
      const text = String(result?.text || result?.content || result?.body || '')
      setBlobText(text || '（空文件）')
    } catch {
      setBlobText('无法读取文件')
    }
  }

  if (!modal) return null

  return (
    <div className="wb-modal-mask wb-ws-mask" id="wbDaemonWorkspaceMask" data-testid="workspace-tree-modal" role="presentation">
      <div className="wb-modal wb-ws-modal" role="dialog" aria-modal="true" aria-label="代码工作区">
        <div className="wb-modal-head wb-ws-head">
          <div className="wb-ws-meta">
            <Icon name="code" />
            <select id="wbWsRepoSelect" aria-label="代码仓" value={modal.slug} disabled>
              <option value={modal.slug}>{modal.slug}</option>
            </select>
            <span className="wb-ws-path" id="wbWsBlobPath">{selectedPath || '选择左侧文件查看内容'}</span>
          </div>
          <div className="wb-ws-head-actions">
            <button type="button" className="wb-run-btn" id="wbWsRefresh" title="刷新" onClick={() => void loadTree(modal.slug)}>
              <Icon name="refresh" />
              <span>刷新</span>
            </button>
            <button type="button" className="wb-icon-btn" id="wbWsClose" title="关闭" aria-label="关闭代码工作区" onClick={close}>
              <Icon name="close" />
            </button>
          </div>
        </div>
        <div className="wb-ws-body">
          <div className={`wb-ws-tree${loading ? ' busy' : ''}`} id="wbWsTree" data-testid="workspace-tree">
            {!loading && entries.length === 0 ? (
              <div className="wb-ws-empty" data-testid="workspace-tree-empty">工作区暂时不可用或服务离线，请稍后刷新。</div>
            ) : null}
            {entries.map((entry) => (
              <button
                key={entry.path}
                type="button"
                className={`wb-ws-node${selectedPath === entry.path ? ' active' : ''}${entry.kind === 'dir' ? ' is-dir' : ''}`}
                onClick={() => {
                  if (entry.kind === 'dir') void loadTree(modal.slug, entry.path)
                  else void openFile(entry.path)
                }}
              >
                <span className="ico" aria-hidden="true"><Icon name={entry.kind === 'dir' ? 'folder' : 'file'} /></span>
                <span className="wb-ws-name">{entry.name}</span>
                {entry.size ? <span className="wb-ws-size">{entry.size}</span> : null}
              </button>
            ))}
          </div>
          <div className="wb-ws-blob" id="wbWsBlob">
            {blobText ? <pre className="wb-ws-code">{blobText}</pre> : (
              <div className="wb-ws-empty">从左侧选择文件查看内容。</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
