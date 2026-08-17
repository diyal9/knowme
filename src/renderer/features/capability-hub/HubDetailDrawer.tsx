import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  hubOriginLabel,
  hubSourceLabel,
  isCapabilityInstalled,
  isCuratedExpert,
  isLocalExpert,
  type HubCapabilityItem,
} from '../../../domain/capability-hub'
import { Icon } from '../../app/Icon'
import { useAppStore } from '../../app/store'
import { HubCapabilityIcon } from './HubCapabilityIcon'
import { HubStatusBadges } from './HubStatusBadges'

type Props = {
  item: HubCapabilityItem
  onClose: () => void
  onChanged: () => void
  onEditExpert: (item: HubCapabilityItem, mode: 'tune' | 'copy') => void
}

function hubVersion(item: HubCapabilityItem): string {
  const version = String(item.version || '').trim()
  return version ? `v${version}` : 'v0.1.0'
}

function listValues(values: unknown[]): string[] {
  return values.map((value) => {
    if (typeof value === 'string') return value
    if (value && typeof value === 'object') {
      const rec = value as { name?: string; id?: string }
      return String(rec.name || rec.id || '')
    }
    return ''
  }).filter(Boolean)
}

export function HubDetailDrawer({ item, onClose, onChanged, onEditExpert }: Props) {
  const showToast = useAppStore((s) => s.showToast)
  const modes = useAppStore((s) => s.modes)
  const activeModeId = useAppStore((s) => s.activeModeId)
  const installed = isCapabilityInstalled(item) || ['installed', 'enabled', 'disabled'].includes(String(item.status || ''))
  const active = modes.find((mode) => mode.id === activeModeId) || modes[0]
  const bound = (active?.bindings || []).some((bind) => bind.expertId === item.id)
  const [busy, setBusy] = useState('')

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function run(act: string) {
    setBusy(act)
    try {
      if (act === 'install') await window.api?.capabilityInstall?.({ id: item.id, kind: item.kind })
      if (act === 'uninstall') await window.api?.capabilityUninstall?.({ id: item.id })
      if (act === 'enable') await window.api?.capabilityEnable?.({ id: item.id })
      if (act === 'disable') await window.api?.capabilityDisable?.({ id: item.id })
      if (act === 'addExpert') {
        const result = await window.api?.workbenchModeBindExpert?.({ expertId: item.id }) as { ok?: boolean; alreadyBound?: boolean; modeName?: string; error?: string } | undefined
        if (result?.ok === false) throw new Error(result.error || '添加失败')
        showToast(result?.alreadyBound ? `“${item.name}”已在工作台` : `已将“${item.name}”添加到${result?.modeName || '当前工作台'}`)
      }
      if (act === 'removeExpert') {
        const result = await window.api?.workbenchModeUnbindExpert?.({ expertId: item.id }) as { ok?: boolean; modeName?: string; error?: string } | undefined
        if (result?.ok === false) throw new Error(result.error || '撤回失败')
        showToast(`已从${result?.modeName || '当前工作台'}撤回“${item.name}”`)
      }
      onChanged()
    } catch (error) {
      showToast(error instanceof Error ? error.message : '操作失败')
    } finally {
      setBusy('')
    }
  }

  const origin = hubOriginLabel(item)
  const deps = listValues(item.dependencies || [])
  const inputs = listValues(item.inputs || [])
  const outputs = listValues(item.outputs || [])
  const permissionKeys = Object.keys(item.permissions || {})
  const canEdit = item.kind === 'expert' && (isLocalExpert(item) || installed)
  const curated = isCuratedExpert(item)

  const dialog = (
    <>
      <div
        className="hub-drawer-backdrop secondary-dialog-mask open"
        data-testid="hub-detail-drawer-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className="hub-drawer secondary-dialog open"
        id="hubDrawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hubDrawerTitle"
        data-testid="hub-detail-drawer"
      >
        <div className="hub-drawer-head secondary-dialog__head">
          <h2 id="hubDrawerTitle">{item.name || item.id}</h2>
          <button type="button" className="hub-icon-btn" aria-label="关闭详情" title="关闭详情" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="hub-drawer-body secondary-dialog__body" id="hubDrawerBody">
          <div className="hub-drawer-hero">
            <HubCapabilityIcon item={item} className="hub-card-icon" />
            <strong>{item.category || '未分类'} · {hubSourceLabel(item.source)}</strong>
            <p>{item.description || '暂无描述'}</p>
            <HubStatusBadges item={item} />
          </div>
          <section className="hub-drawer-section">
            <h3>元信息</h3>
            <dl className="hub-kv">
              <dt>版本</dt><dd>{hubVersion(item)}</dd>
              <dt>来源</dt><dd>{hubSourceLabel(item.source)}</dd>
              <dt>分类</dt><dd>{item.category || '未分类'}</dd>
              <dt>状态</dt><dd>{item.status || (installed ? 'installed' : 'available')}</dd>
              {origin ? <><dt>原始标识</dt><dd>{origin}</dd></> : null}
              {item.contentHash ? <><dt>Hash</dt><dd>{String(item.contentHash).slice(0, 12)}…</dd></> : null}
              {item.installedAt ? <><dt>安装于</dt><dd>{item.installedAt}</dd></> : null}
            </dl>
          </section>
          {item.kind === 'expert' ? (
            <section className="hub-drawer-section">
              <h3>装配</h3>
              <p>{listValues(item.skills || []).join('、') || '未装配技能，它只会依据 persona 回答。'}</p>
              <p>{listValues(item.connectors || []).join('、') || '未装配连接器，它不会访问外部系统。'}</p>
            </section>
          ) : null}
          <section className="hub-drawer-section">
            <h3>依赖</h3>
            {deps.length ? <ul>{deps.map((dep) => <li key={dep}>{dep}</li>)}</ul> : <p>未声明</p>}
          </section>
          <section className="hub-drawer-section">
            <h3>权限</h3>
            {permissionKeys.length ? <ul>{permissionKeys.map((key) => <li key={key}>{key}</li>)}</ul> : <p>未声明额外权限</p>}
          </section>
          <section className="hub-drawer-section">
            <h3>输入 / 输出</h3>
            <h4>输入</h4>
            {inputs.length ? <ul>{inputs.map((value) => <li key={value}>{value}</li>)}</ul> : <p>未声明</p>}
            <h4>输出</h4>
            {outputs.length ? <ul>{outputs.map((value) => <li key={value}>{value}</li>)}</ul> : <p>未声明</p>}
          </section>
          <section className="hub-drawer-section">
            <h3>风险与来源</h3>
            <dl className="hub-kv">
              <dt>风险等级</dt><dd>{item.risk?.level || 'low'}</dd>
              {item.risk?.reasons?.length ? <><dt>风险依据</dt><dd>{item.risk.reasons.join('；')}</dd></> : null}
              <dt>来源证据</dt><dd>{item.provenance?.ref || item.provenance?.source || hubSourceLabel(item.source)}</dd>
            </dl>
          </section>
          {installed ? (
            <section className="hub-drawer-section">
              <div className="hub-toggle-row">
                <label htmlFor="hubEnableToggle">在新会话中使用</label>
                <label className="hub-filter-toggle">
                  <input
                    id="hubEnableToggle"
                    type="checkbox"
                    checked={item.enabled !== false}
                    onChange={(e) => void run(e.target.checked ? 'enable' : 'disable')}
                  />
                  <span className="hub-toggle-track" aria-hidden="true"><span /></span>
                  <span>{item.enabled !== false ? '已启用' : '已停用'}</span>
                </label>
              </div>
            </section>
          ) : null}
        </div>
        <div className="hub-drawer-foot secondary-dialog__foot" id="hubDrawerActions">
          {item.kind === 'expert' ? (
            <>
              {bound ? (
                <button type="button" className="hub-btn" disabled={!!busy} onClick={() => void run('removeExpert')}>
                  {busy === 'removeExpert' ? '正在撤回…' : '工作台撤回'}
                </button>
              ) : (
                <button type="button" className="hub-btn primary" disabled={!!busy} onClick={() => void run('addExpert')}>
                  {busy === 'addExpert' ? '正在添加…' : '添加到工作台'}
                </button>
              )}
              {curated ? <button type="button" className="hub-btn" onClick={() => onEditExpert(item, 'copy')}>复制为自建</button> : null}
              {canEdit && !curated ? <button type="button" className="hub-btn" onClick={() => onEditExpert(item, 'tune')}>编辑</button> : null}
            </>
          ) : installed ? (
            <button type="button" className="hub-btn" onClick={() => void run('uninstall')}>卸载</button>
          ) : (
            <button type="button" className="hub-btn primary" onClick={() => void run('install')}>安装</button>
          )}
        </div>
      </aside>
    </>
  )

  return createPortal(dialog, document.body)
}
