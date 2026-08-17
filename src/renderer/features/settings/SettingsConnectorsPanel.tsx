import { useCallback, useEffect, useState } from 'react'
import type { ConnectorRecord, ConnectorStatus, SettingsForm } from '../../../shared/api-extended'
import { SettingsFeishuSection } from './SettingsFeishuSection'
import { SettingsMcpSection } from './SettingsMcpSection'
import { SettingsWorkbenchSection } from './SettingsWorkbenchSection'
import { connectorList, feishuUserReady } from './settings-connector-status'

type Props = {
  form: SettingsForm
  onPatch: (next: Partial<SettingsForm>) => void
  flash: (msg: string, kind?: 'ok' | 'err') => void
}

export function SettingsConnectorsPanel({ form, onPatch, flash }: Props) {
  const [items, setItems] = useState<ConnectorRecord[]>([])
  const [feishuStatus, setFeishuStatus] = useState<ConnectorStatus | null>(null)
  const [polling, setPolling] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const list = await window.api?.connectorsList?.()
      setItems(connectorList(list))
    } catch {
      setItems([])
    }
    try {
      const status = await window.api?.connectorsStatus?.('feishu')
      setFeishuStatus(status || null)
      return feishuUserReady(status)
    } catch {
      setFeishuStatus(null)
      return false
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!polling) return undefined
    let n = 0
    const timer = window.setInterval(() => {
      n += 1
      void refresh().then((connected) => {
        if (connected || n >= 20) setPolling(false)
      })
    }, 400)
    return () => window.clearInterval(timer)
  }, [polling, refresh])

  const feishu = items.find((item) => item.id === 'feishu')
  const mcp = items.find((item) => item.id === 'mcp-default')
  const extras = items.filter((item) => item.id !== 'feishu' && item.id !== 'mcp-default')

  return (
    <>
      <div className="settings-section">
        <div className="settings-section-head">
          <div className="settings-section-title">连接器</div>
          <span className="settings-badge">公司系统 / 飞书</span>
        </div>
        <p className="settings-intro">点击一次即可完成飞书连接和当前项目所需权限授权。Token 不会被 KnowMe 持久化保存。</p>
        <SettingsFeishuSection
          feishu={feishu}
          status={feishuStatus}
          polling={polling}
          flash={flash}
          onRefresh={refresh}
          onPolling={setPolling}
        />
        <div style={{ padding: '0 16px 12px' }} data-testid="settings-connectors-list">
          {extras.length === 0 ? (
            <p className="settings-hint">暂无其他连接器。</p>
          ) : extras.map((item) => (
            <div key={item.id} className="settings-source-row">
              <div>
                <strong>{item.title || item.name || item.id}</strong>
                <small>{item.type || 'connector'}{item.enabled === false ? ' · 未启用' : ''}</small>
              </div>
            </div>
          ))}
        </div>
      </div>
      <SettingsMcpSection mcp={mcp} flash={flash} onRefresh={refresh} />
      <SettingsWorkbenchSection form={form} onPatch={onPatch} flash={flash} />
    </>
  )
}
