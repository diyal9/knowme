import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import '../../../secondary-dialog.css'
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
import { HubConnectorManager } from './HubConnectorManager'

type Props = {
  item: HubCapabilityItem
  isMine?: boolean
  onClose: () => void
  onChanged: () => void | Promise<void>
  onEditExpert: (item: HubCapabilityItem, mode: 'tune' | 'copy') => void
  onOpenWorkbench: (item: HubCapabilityItem) => void
  onManageSkill: (item: HubCapabilityItem) => void
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

export function HubDetailDrawer({ item, isMine = false, onClose, onChanged, onEditExpert, onOpenWorkbench, onManageSkill }: Props) {
  const showToast = useAppStore((s) => s.showToast)
  const modes = useAppStore((s) => s.modes)
  const installed = isCapabilityInstalled(item) || ['installed', 'enabled', 'disabled'].includes(String(item.status || ''))
  const bound = modes.some((mode) => (mode.bindings || []).some((bind) => bind.expertId === item.id))
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
      let result: { ok?: boolean; error?: string } | undefined
      if (act === 'install') result = await window.api?.capabilityInstall?.({ id: item.id, kind: item.kind }) as typeof result
      if (act === 'uninstall') result = await window.api?.capabilityUninstall?.({ id: item.id }) as typeof result
      if (act === 'enable') result = await window.api?.capabilityEnable?.({ id: item.id }) as typeof result
      if (act === 'disable') result = await window.api?.capabilityDisable?.({ id: item.id }) as typeof result
      if (act === 'update') result = await window.api?.capabilityUpdate?.({ id: item.id }) as typeof result
      if (act === 'addMyExpert') {
        result = await window.api?.capabilityInstall?.({ id: item.id, kind: 'expert' }) as typeof result
        if (!result) throw new Error('专家安装接口不可用')
        if (result.ok === false) throw new Error(result.error || '添加专家失败')
        const binding = await window.api?.workbenchModeBindExpert?.({ expertId: item.id })
        if (binding?.ok === false) throw new Error(binding.error || '专家已添加，但设为常用失败')
        showToast(`已召唤“${item.name || item.id}”，并打开工作台专家协作`)
      }
      if (['install', 'uninstall', 'enable', 'disable', 'update'].includes(act) && !result) {
        throw new Error('能力操作接口不可用')
      }
      if (result?.ok === false) throw new Error(result.error || '操作失败')
      if (act === 'addExpert') {
        const binding = await window.api?.workbenchModeBindExpert?.({ expertId: item.id }) as { ok?: boolean; alreadyBound?: boolean; modeName?: string; error?: string } | undefined
        if (binding?.ok === false) throw new Error(binding.error || '添加失败')
        showToast(binding?.alreadyBound ? `“${item.name}”已在工作台` : `已将“${item.name}”添加到${binding?.modeName || '当前工作台'}`)
      }
      if (act === 'removeExpert') {
        const binding = await window.api?.workbenchModeUnbindExpert?.({ expertId: item.id, everywhere: true }) as { ok?: boolean; modeName?: string; error?: string } | undefined
        if (binding?.ok === false) throw new Error(binding.error || '撤回失败')
        showToast(`已从${binding?.modeName || '当前工作台'}撤回“${item.name}”`)
      }
      if (act === 'install') showToast(`已安装“${item.name || item.id}”`)
      if (act === 'uninstall') showToast(`已卸载“${item.name || item.id}”`)
      if (act === 'enable') showToast(`已启用“${item.name || item.id}”`)
      if (act === 'disable') showToast(`已停用“${item.name || item.id}”`)
      if (act === 'update') showToast(`已更新“${item.name || item.id}”，新会话将使用最新版本`)
      await onChanged()
      if (act === 'uninstall') onClose()
      if (act === 'addMyExpert') onOpenWorkbench({ ...item, installed: true, enabled: true, status: 'enabled' })
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
            <HubStatusBadges item={item} compact />
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
              <dl className="hub-detail-list">
                <div><dt>技能</dt><dd>{listValues(item.skills || []).join('、') || '未装配；仅依据 persona 回答'}</dd></div>
                <div><dt>连接器</dt><dd>{listValues(item.connectors || []).join('、') || '未装配；不会访问外部系统'}</dd></div>
              </dl>
            </section>
          ) : null}
          {item.kind === 'skill' ? (
            <section className="hub-drawer-section hub-skill-usage-note">
              <h3>技能如何使用</h3>
              <p>技能不会作为独立伙伴出现在工作台。安装后，可以装备给智能伙伴或“我的专家”。</p>
            </section>
          ) : null}
          {item.kind === 'connector' && installed ? (
            <section className="hub-drawer-section">
              <h3>连接器实例</h3>
              <HubConnectorManager connectorId={item.id} onChanged={onChanged} />
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
            <div className="hub-io-grid">
              <div className="hub-io-item">
                <span>输入</span>
                <p>{inputs.length ? inputs.join('、') : '未声明'}</p>
              </div>
              <div className="hub-io-item">
                <span>输出</span>
                <p>{outputs.length ? outputs.join('、') : '未声明'}</p>
              </div>
            </div>
          </section>
          <section className="hub-drawer-section">
            <h3>风险与来源</h3>
            <dl className="hub-kv">
              <dt>风险等级</dt><dd>{item.risk?.level || 'low'}</dd>
              {item.risk?.reasons?.length ? <><dt>风险依据</dt><dd>{item.risk.reasons.join('；')}</dd></> : null}
              <dt>来源证据</dt><dd>{item.provenance?.ref || item.provenance?.source || hubSourceLabel(item.source)}</dd>
            </dl>
          </section>
          {installed && (isMine || item.kind !== 'expert') ? (
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
              {!installed ? (
                <button type="button" className="hub-btn primary" disabled={!!busy} onClick={() => void run('addMyExpert')}>
                  {busy === 'addMyExpert' ? '正在召唤…' : '召唤专家'}
                </button>
              ) : isMine ? <button type="button" className="hub-btn primary" onClick={() => onOpenWorkbench(item)}>打开我的专家</button>
                : <button type="button" className="hub-btn" disabled>已召唤</button>}
              {isMine && installed && bound ? (
                <button type="button" className="hub-btn" disabled={!!busy} onClick={() => void run('removeExpert')}>
                  {busy === 'removeExpert' ? '正在撤回…' : '从工作台撤回'}
                </button>
              ) : isMine && installed ? (
                <button type="button" className="hub-btn" disabled={!!busy} onClick={() => void run('addExpert')}>
                  {busy === 'addExpert' ? '正在添加…' : '设为常用专家'}
                </button>
              ) : null}
              {isMine && canEdit && !curated ? <button type="button" className="hub-btn" onClick={() => onEditExpert(item, 'tune')}>编辑</button> : null}
              {installed && curated ? (
                <button type="button" className="hub-btn" disabled={!!busy} onClick={() => void run('update')}>
                  {busy === 'update' ? '正在更新…' : '更新专家'}
                </button>
              ) : null}
              {installed && curated ? (
                <button type="button" className="hub-btn danger" disabled={!!busy} onClick={() => void run('uninstall')}>
                  {busy === 'uninstall' ? '正在卸载…' : '卸载专家'}
                </button>
              ) : null}
            </>
          ) : installed && item.kind === 'skill' ? (
            <button type="button" className="hub-btn primary" onClick={() => onManageSkill(item)}>管理技能装备</button>
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
