import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../../app/Icon'

type Props = {
  onClose: () => void
  onImported: () => void
}

type SourceKind = 'local' | 'zip' | 'https' | 'cursor' | 'custom'

const TABS: { id: SourceKind; label: string; hint: string }[] = [
  { id: 'local', label: '本地文件夹', hint: 'SKILL / EXPERT / MCP' },
  { id: 'cursor', label: 'Cursor 仓库', hint: '扫描完整能力目录' },
  { id: 'zip', label: 'ZIP 能力包', hint: '校验后安全导入' },
  { id: 'https', label: 'HTTPS 地址', hint: '仅可信远程来源' },
  { id: 'custom', label: '自定义创建', hint: '从最小模板开始' },
]

async function importSource(source: SourceKind, extra: Record<string, unknown> = {}) {
  if (source === 'cursor') {
    const picked = await window.api?.capabilityPickCursorRepository?.()
    const path = String((picked as { path?: string } | undefined)?.path || '')
    if (!path) return { ok: false, error: '未选择 Cursor 仓库' }
    return window.api?.capabilityImportCursorRepository?.({ path, trustConfirmed: true, riskConfirmed: true })
  }
  if (source === 'local' || source === 'zip') {
    const picked = source === 'local'
      ? await window.api?.capabilityPickLocalFolder?.()
      : await window.api?.capabilityPickZipFile?.()
    const path = String((picked as { path?: string } | undefined)?.path || extra.path || '')
    if (!path) return { ok: false, error: '未选择文件' }
    return window.api?.capabilityImport?.({ source, path, trustConfirmed: true, riskConfirmed: true })
  }
  return window.api?.capabilityImport?.({ source, trustConfirmed: true, riskConfirmed: true, ...extra })
}

export function HubAddDialog({ onClose, onImported }: Props) {
  const [tab, setTab] = useState<SourceKind>('local')
  const [url, setUrl] = useState('')
  const [customKind, setCustomKind] = useState('skill')
  const [customId, setCustomId] = useState('')
  const [customName, setCustomName] = useState('')
  const [customDesc, setCustomDesc] = useState('')
  const [error, setError] = useState('')

  async function run(source: SourceKind, extra: Record<string, unknown> = {}) {
    setError('')
    const result = await importSource(source, extra) as { ok?: boolean; error?: string } | undefined
    if (result?.ok === false) {
      setError(result.error || '导入失败')
      return
    }
    onImported()
    onClose()
  }

  async function confirmImport() {
    if (tab === 'local') return run('local')
    if (tab === 'cursor') return run('cursor')
    if (tab === 'zip') return run('zip')
    if (tab === 'https') return run('https', { url })
    return run('custom', { kind: customKind, id: customId || customName, name: customName, description: customDesc })
  }

  return createPortal(
    <div className="hub-dialog-mask" data-testid="hub-add-dialog" role="dialog" aria-modal="true" aria-labelledby="hubAddTitle">
      <div className="hub-dialog">
        <div className="hub-dialog-head">
          <div>
            <span className="hub-section-kicker">Add capability</span>
            <h2 id="hubAddTitle">添加能力</h2>
            <p>从可信来源导入，或创建一项属于你的能力。</p>
          </div>
          <button type="button" className="hub-icon-btn" aria-label="关闭添加能力" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="hub-dialog-body">
          <div className="hub-add-layout">
            <div className="hub-add-tabs" role="tablist" aria-label="能力来源">
              {TABS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`hub-add-tab${tab === item.id ? ' active' : ''}`}
                  role="tab"
                  aria-selected={tab === item.id}
                  onClick={() => setTab(item.id)}
                >
                  <span>{item.label}</span>
                  <small>{item.hint}</small>
                </button>
              ))}
            </div>
            <div className="hub-add-content">
              {tab === 'local' ? (
                <div className="hub-add-panel active" data-add-panel="local">
                  <div className="hub-source-mark"><Icon name="folder" /></div>
                  <h3>从本地文件夹导入</h3>
                  <p className="hub-hint">选择包含 SKILL.md、EXPERT.md 或 connector manifest 的目录。确认前不会执行其中脚本。</p>
                  <button type="button" className="hub-btn primary" onClick={() => void run('local')}>选择文件夹</button>
                </div>
              ) : null}
              {tab === 'cursor' ? (
                <div className="hub-add-panel active">
                  <div className="hub-source-mark"><Icon name="workbench" /></div>
                  <h3>注册 Cursor 智能体仓库</h3>
                  <p className="hub-hint">KnowMe 将扫描专家、技能与安全的 MCP 配置，确认前不会写入或执行脚本。</p>
                  <button type="button" className="hub-btn primary" onClick={() => void run('cursor')}>选择 Cursor 仓库</button>
                </div>
              ) : null}
              {tab === 'zip' ? (
                <div className="hub-add-panel active">
                  <div className="hub-source-mark"><Icon name="file" /></div>
                  <h3>导入 ZIP 能力包</h3>
                  <p className="hub-hint">选择能力包后会检查路径、文件数量与大小，再写入本地能力目录。</p>
                  <button type="button" className="hub-btn primary" onClick={() => void run('zip')}>选择 ZIP 文件</button>
                </div>
              ) : null}
              {tab === 'https' ? (
                <div className="hub-add-panel active">
                  <h3>从 HTTPS 地址导入</h3>
                  <div className="hub-field">
                    <label htmlFor="hubHttpsUrl">HTTPS 地址</label>
                    <input id="hubHttpsUrl" type="url" placeholder="https://example.com/package.zip" value={url} onChange={(e) => setUrl(e.target.value)} spellCheck={false} />
                    <small>仅支持 HTTPS；未知来源需要再次确认信任。</small>
                  </div>
                </div>
              ) : null}
              {tab === 'custom' ? (
                <div className="hub-add-panel active">
                  <h3>创建最小能力</h3>
                  <div className="hub-form-grid">
                    <div className="hub-field">
                      <label htmlFor="hubCustomKind">类型</label>
                      <select id="hubCustomKind" value={customKind} onChange={(e) => setCustomKind(e.target.value)}>
                        <option value="skill">技能</option>
                        <option value="expert">专家</option>
                        <option value="connector">连接器</option>
                      </select>
                    </div>
                    <div className="hub-field">
                      <label htmlFor="hubCustomId">ID</label>
                      <input id="hubCustomId" type="text" placeholder="my-capability" value={customId} onChange={(e) => setCustomId(e.target.value)} spellCheck={false} />
                    </div>
                  </div>
                  <div className="hub-field">
                    <label htmlFor="hubCustomName">名称</label>
                    <input id="hubCustomName" type="text" placeholder="我的能力" value={customName} onChange={(e) => setCustomName(e.target.value)} />
                  </div>
                  <div className="hub-field">
                    <label htmlFor="hubCustomDesc">描述</label>
                    <textarea id="hubCustomDesc" placeholder="简要说明它解决什么问题" value={customDesc} onChange={(e) => setCustomDesc(e.target.value)} />
                  </div>
                </div>
              ) : null}
              {error ? <p className="empty">{error}</p> : null}
            </div>
          </div>
        </div>
        <div className="hub-dialog-foot">
          <button type="button" className="hub-btn" onClick={onClose}>取消</button>
          <button type="button" className="hub-btn primary" onClick={() => void confirmImport()}>导入</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
