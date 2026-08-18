/**
 * 能力导入：先预检决策面板，确认后才 trustConfirmed。
 * 不负责 catalog 安装主路径（见详情抽屉）。
 */
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../../app/Icon'
import { HubImportPreview } from './HubImportPreview'

type Props = {
  onClose: () => void
  onImported: () => void
}

type SourceKind = 'local' | 'zip' | 'https' | 'cursor' | 'custom'

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
}

type PendingImport = {
  source: SourceKind
  extra: Record<string, unknown>
  preview: Preview
  error?: string
}

const TABS: { id: SourceKind; label: string; hint: string }[] = [
  { id: 'local', label: '本地文件夹', hint: 'SKILL / EXPERT / MCP' },
  { id: 'cursor', label: 'Cursor 仓库', hint: '扫描完整能力目录' },
  { id: 'zip', label: 'ZIP 能力包', hint: '校验后安全导入' },
  { id: 'https', label: 'HTTPS 地址', hint: '仅可信远程来源' },
  { id: 'custom', label: '自定义创建', hint: '从最小模板开始' },
]

function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
}

function previewFromResult(raw: unknown, fallback: Preview): { preview: Preview; error?: string } {
  const rec = asRecord(raw)
  const nested = rec.preview && typeof rec.preview === 'object' ? rec.preview as Preview : {}
  const error = rec.ok === false ? String(rec.error || rec.message || '') : ''
  return {
    preview: {
      ...fallback,
      ...nested,
      name: nested.name || fallback.name,
      risk: nested.risk || fallback.risk,
      compatibility: nested.compatibility || fallback.compatibility,
      rollbackHint: nested.rollbackHint || fallback.rollbackHint,
    },
    error: error || undefined,
  }
}

async function precheckSource(source: SourceKind, extra: Record<string, unknown>) {
  const fallback: Preview = {
    name: String(extra.path || extra.url || extra.name || '待导入能力'),
    kind: source,
    risk: { level: 'medium', reasons: ['导入前须确认信任'] },
    compatibility: { status: 'compatible' },
    rollbackHint: '安装后可在详情中停用或卸载。',
  }
  if (source === 'cursor') {
    const scanned = await window.api?.capabilityScanCursorRepository?.({ path: extra.path })
    const rec = asRecord(scanned)
    return previewFromResult(scanned, {
      ...fallback,
      name: String(rec.name || rec.root || extra.path || 'Cursor 仓库'),
      kind: 'cursor-repo',
    })
  }
  const checked = await window.api?.capabilityImportPrecheck?.({ source, ...extra })
  if (!checked) return { preview: fallback }
  return previewFromResult(checked, fallback)
}

async function commitImport(pending: PendingImport) {
  const { source, extra } = pending
  if (source === 'cursor') {
    return window.api?.capabilityImportCursorRepository?.({
      ...extra,
      trustConfirmed: true,
      riskConfirmed: true,
    })
  }
  return window.api?.capabilityImport?.({
    source,
    trustConfirmed: true,
    riskConfirmed: true,
    ...extra,
  })
}

export function HubAddDialog({ onClose, onImported }: Props) {
  const [tab, setTab] = useState<SourceKind>('local')
  const [url, setUrl] = useState('')
  const [customKind, setCustomKind] = useState('skill')
  const [customId, setCustomId] = useState('')
  const [customName, setCustomName] = useState('')
  const [customDesc, setCustomDesc] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState<PendingImport | null>(null)
  const [busy, setBusy] = useState(false)

  async function beginPrecheck(source: SourceKind, extra: Record<string, unknown> = {}) {
    setError('')
    setBusy(true)
    try {
      const { preview, error: precheckError } = await precheckSource(source, extra)
      setPending({ source, extra, preview, error: precheckError })
    } catch (err) {
      setError(String((err as Error)?.message || err || '预检失败'))
    } finally {
      setBusy(false)
    }
  }

  async function pickAndPrecheck(source: 'local' | 'zip' | 'cursor') {
    const picked = source === 'local'
      ? await window.api?.capabilityPickLocalFolder?.()
      : source === 'zip'
        ? await window.api?.capabilityPickZipFile?.()
        : await window.api?.capabilityPickCursorRepository?.()
    const rec = asRecord(picked)
    const path = String(rec.path || '')
    if (!path) {
      setError(source === 'cursor' ? '未选择 Cursor 仓库' : '未选择文件')
      return
    }
    const extra: Record<string, unknown> = { path }
    if (source === 'cursor' && rec.previewToken) extra.previewToken = rec.previewToken
    await beginPrecheck(source, extra)
    if (source === 'cursor') {
      const scanned = await window.api?.capabilityScanCursorRepository?.({ path })
      const token = String(asRecord(scanned).previewToken || '')
      if (token) {
        setPending((cur) => cur ? { ...cur, extra: { ...cur.extra, previewToken: token } } : cur)
      }
    }
  }

  async function confirmPending() {
    if (!pending) return
    setBusy(true)
    setError('')
    try {
      const result = await commitImport(pending) as { ok?: boolean; error?: string; previewToken?: string } | undefined
      const rec = asRecord(result)
      if (rec.previewToken) {
        setPending({
          ...pending,
          extra: { ...pending.extra, previewToken: rec.previewToken },
          preview: { ...pending.preview, ...(rec.preview as Preview || {}) },
          error: String(rec.error || '仓库内容有变，请复核后再确认'),
        })
        return
      }
      if (result?.ok === false) {
        setError(result.error || '导入失败')
        return
      }
      onImported()
      onClose()
    } finally {
      setBusy(false)
    }
  }

  async function confirmImport() {
    if (pending) return confirmPending()
    if (tab === 'local' || tab === 'zip' || tab === 'cursor') {
      await pickAndPrecheck(tab)
      return
    }
    if (tab === 'https') return beginPrecheck('https', { url })
    return beginPrecheck('custom', {
      kind: customKind,
      id: customId || customName,
      name: customName,
      description: customDesc,
    })
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
          {pending ? (
            <HubImportPreview
              preview={pending.preview}
              error={pending.error}
              onCancel={() => setPending(null)}
              onConfirm={() => void confirmPending()}
            />
          ) : (
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
                    <button type="button" className="hub-btn primary" disabled={busy} onClick={() => void pickAndPrecheck('local')}>选择文件夹</button>
                  </div>
                ) : null}
                {tab === 'cursor' ? (
                  <div className="hub-add-panel active">
                    <div className="hub-source-mark"><Icon name="workbench" /></div>
                    <h3>注册 Cursor 智能体仓库</h3>
                    <p className="hub-hint">KnowMe 将扫描专家、技能与安全的 MCP 配置，确认前不会写入或执行脚本。</p>
                    <button type="button" className="hub-btn primary" disabled={busy} onClick={() => void pickAndPrecheck('cursor')}>选择 Cursor 仓库</button>
                  </div>
                ) : null}
                {tab === 'zip' ? (
                  <div className="hub-add-panel active">
                    <div className="hub-source-mark"><Icon name="file" /></div>
                    <h3>导入 ZIP 能力包</h3>
                    <p className="hub-hint">选择能力包后会检查路径、文件数量与大小，再写入本地能力目录。</p>
                    <button type="button" className="hub-btn primary" disabled={busy} onClick={() => void pickAndPrecheck('zip')}>选择 ZIP 文件</button>
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
          )}
        </div>
        {pending ? null : (
          <div className="hub-dialog-foot">
            <button type="button" className="hub-btn" onClick={onClose}>取消</button>
            <button type="button" className="hub-btn primary" disabled={busy} onClick={() => void confirmImport()}>导入</button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
