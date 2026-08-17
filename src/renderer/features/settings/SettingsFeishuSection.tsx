/**
 * 设置页飞书连接区块：一键授权主路径、权限确认、高级白名单。
 * 状态文案与主 CTA 由 buildFeishuCardModel 决定，本组件不内联就绪分支。
 */
import { useEffect, useState } from 'react'
import type { ConnectorRecord, ConnectorStatus } from '../../../shared/api-extended'
import {
  DEFAULT_FEISHU_ALLOWLIST,
  buildFeishuCardModel,
  feishuUserReady,
  parseAllowlist,
} from './settings-connector-status'

type Props = {
  feishu?: ConnectorRecord
  status?: ConnectorStatus | null
  polling: boolean
  flash: (msg: string, kind?: 'ok' | 'err') => void
  onRefresh: () => Promise<boolean>
  onPolling: (v: boolean) => void
}

export function SettingsFeishuSection({ feishu, status, polling, flash, onRefresh, onPolling }: Props) {
  const card = buildFeishuCardModel(status, {
    polling,
    enabled: feishu ? feishu.enabled !== false : true,
    present: feishu === undefined && status == null ? undefined : feishu !== undefined,
  })
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [authUrl, setAuthUrl] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [allowlist, setAllowlist] = useState((feishu?.allowlist || []).join(', '))

  useEffect(() => {
    setAllowlist((feishu?.allowlist || []).join(', '))
  }, [feishu])

  const startAuth = async (force = true) => {
    const enabled = await window.api?.connectorsUpsert?.({
      id: 'feishu',
      type: 'feishu',
      enabled: true,
      allowlist: [...new Set([...parseAllowlist(allowlist), ...DEFAULT_FEISHU_ALLOWLIST])],
    })
    if (enabled && enabled.ok === false) {
      flash(enabled.error || '启用飞书连接器失败', 'err')
      return
    }
    const result = await window.api?.connectorsFeishuAuthStart?.({ force })
    if (result?.verificationUrl) {
      setAuthUrl(result.verificationUrl)
      setQrDataUrl(String(result.qrDataUrl || ''))
      setAuthOpen(true)
      setConfirmOpen(false)
      onPolling(true)
      const opened = await window.api?.openExternal?.(result.verificationUrl)
      if (!opened?.ok) flash(opened?.message || '无法打开授权链接', 'err')
    } else if (result?.ok && feishuUserReady(result)) {
      flash('飞书已连接')
      setAuthOpen(false)
      void onRefresh()
    } else {
      flash(result?.message || '授权启动失败', 'err')
    }
  }

  const onPrimaryClick = () => {
    if (card.primaryDisabled || card.primaryMode === 'done' || card.primaryMode === 'none') return
    if (card.needsConfirm) setConfirmOpen(true)
    else void startAuth(true)
  }

  const confirmTitle = card.primaryMode === 'topup' ? '确认补充飞书权限' : '确认申请飞书权限'
  const confirmIntro = card.primaryMode === 'topup' && card.missingLabels.length
    ? `确认后会打开飞书授权页，申请补齐：${card.missingLabels.join('、')}。飞书会保留已授予的权限。`
    : '确认后会打开飞书授权页，一次性申请项目所需能力。Token 不会被 KnowMe 持久化保存。'

  return (
    <>
      <div className="settings-quick-card" data-testid="feishu-card">
        <div>
          <div className="settings-quick-title">飞书连接</div>
          <div className="settings-hint" data-testid="feishu-status">
            {card.statusText}
          </div>
        </div>
        <div className="settings-actions" style={{ padding: 0 }}>
          <button
            type="button"
            className={`settings-btn${card.primaryDisabled ? '' : ' primary'}`}
            disabled={card.primaryDisabled}
            data-testid="feishu-primary-action"
            data-mode={card.primaryMode}
            onClick={onPrimaryClick}
          >
            {card.primaryLabel}
          </button>
          <button type="button" className="settings-btn" onClick={() => void onRefresh()}>
            刷新状态
          </button>
        </div>
      </div>

      {confirmOpen ? (
        <div className="settings-auth-panel" data-testid="feishu-scope-confirm">
          <strong>{confirmTitle}</strong>
          <p className="settings-hint">{confirmIntro}</p>
          {card.categories.length ? (
            <ul className="settings-scope-list" data-testid="feishu-scopes">
              {card.categories.map((item) => (
                <li key={item.id} data-state={item.state || 'unknown'}>
                  <span className="settings-scope-state">
                    {item.state === 'ready' ? '已授权' : item.state === 'missing' ? '本次申请' : '待确认'}
                  </span>
                  <span>{item.label || item.id}</span>
                </li>
              ))}
            </ul>
          ) : card.missingLabels.length ? (
            <p className="settings-hint" data-testid="feishu-scopes">
              缺少：{card.missingLabels.join('、')}
            </p>
          ) : (
            <p className="settings-hint" data-testid="feishu-scopes">
              本次将申请：云盘、文档、知识库、多维表格、通讯录、聊天、会议、妙记、日程和待办。
            </p>
          )}
          <div className="settings-actions" style={{ padding: '8px 0 0' }}>
            <button type="button" className="settings-btn primary" onClick={() => void startAuth(true)}>
              确认并授权
            </button>
            <button type="button" className="settings-btn" onClick={() => setConfirmOpen(false)}>
              取消
            </button>
          </div>
        </div>
      ) : null}

      {authOpen ? (
        <div className="settings-auth-panel" data-testid="feishu-auth-panel">
          <strong>飞书授权</strong>
          <p className="settings-hint">请在打开的页面完成登录。浏览器打不开时，复制链接或扫码。</p>
          <div className="settings-actions" style={{ padding: '8px 0' }}>
            {authUrl ? (
              <button type="button" className="settings-btn primary" onClick={() => void window.api?.openExternal?.(authUrl)}>
                重新打开授权页
              </button>
            ) : null}
            {authUrl ? (
              <button
                type="button"
                className="settings-btn"
                onClick={() => {
                  window.api?.copyToClipboard?.(authUrl)
                  flash('授权链接已复制')
                }}
              >
                复制授权链接
              </button>
            ) : null}
          </div>
          {qrDataUrl ? (
            <details>
              <summary className="settings-hint">使用飞书 App 扫码</summary>
              <img src={qrDataUrl} alt="飞书授权二维码" style={{ maxWidth: 180, marginTop: 8 }} />
            </details>
          ) : null}
          <div className="settings-actions" style={{ padding: '8px 0 0' }}>
            <button
              type="button"
              className="settings-btn"
              onClick={async () => {
                const ready = await onRefresh()
                if (ready) {
                  flash('飞书已连接')
                  setAuthOpen(false)
                  onPolling(false)
                } else flash('尚未完成授权', 'err')
              }}
            >
              我已完成，检测连接
            </button>
            <button type="button" className="settings-btn" onClick={() => void startAuth(true)}>
              重试授权
            </button>
            <button type="button" className="settings-btn" onClick={() => { setAuthOpen(false); onPolling(false) }}>
              收起
            </button>
          </div>
        </div>
      ) : null}

      <details className="settings-advanced">
        <summary className="settings-section-head">
          <div className="settings-section-title">高级设置：Agent 工具白名单</div>
        </summary>
        <div className="settings-field">
          <label htmlFor="feishuAllowlist">允许 Agent 调用的工具（开发者选项）</label>
          <input
            id="feishuAllowlist"
            value={allowlist}
            onChange={(e) => setAllowlist(e.target.value)}
            placeholder="保持默认即可"
          />
          <div className="settings-hint">普通使用无需修改。写入能力仍需在操作前确认。</div>
        </div>
        <div className="settings-actions">
          <button
            type="button"
            className="settings-btn"
            onClick={async () => {
              const result = await window.api?.connectorsSetAllowlist?.('feishu', parseAllowlist(allowlist))
              if (result && result.ok === false) flash(result.error || '保存失败', 'err')
              else flash('飞书白名单已保存')
              void onRefresh()
            }}
          >
            保存高级设置
          </button>
        </div>
      </details>
    </>
  )
}
