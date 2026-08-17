import { useCallback, useEffect, useState } from 'react'
import type { SettingsForm } from '../../../shared/api-extended'

type Props = {
  form: SettingsForm
  onPatch: (next: Partial<SettingsForm>) => void
  flash: (msg: string, kind?: 'ok' | 'err') => void
}

export function SettingsWorkbenchSection({ form, onPatch, flash }: Props) {
  const auth = form.workbenchAuth || {}
  const [key, setKey] = useState('')
  const [statusText, setStatusText] = useState('状态：未配置')
  const [bootstrapText, setBootstrapText] = useState('状态：尚未检测')
  const installPath = form.workbenchInstall?.path || ''

  const refreshAuth = useCallback(async () => {
    try {
      const result = await window.api?.workbenchAuthStatus?.()
      const a = result?.auth
      if (!a) {
        setStatusText('状态：未配置')
        return
      }
      const bits = [a.state || 'unknown', a.endpoint, a.user].filter(Boolean)
      setStatusText(`状态：${bits.join(' · ')}`)
    } catch {
      setStatusText('状态：无法读取')
    }
  }, [])

  const refreshBootstrap = useCallback(async () => {
    try {
      const result = await window.api?.workbenchBootstrapStatus?.()
      setBootstrapText(`状态：${result?.status?.message || '尚未检测'}`)
    } catch {
      setBootstrapText('状态：检测失败')
    }
  }, [])

  useEffect(() => {
    void refreshAuth()
    void refreshBootstrap()
  }, [refreshAuth, refreshBootstrap])

  const runBootstrap = async (payload: Record<string, unknown>) => {
    const result = await window.api?.workbenchBootstrapRun?.({
      installPath,
      saveInstallPath: true,
      ...payload,
    })
    if (result?.ok) flash(result.message || '已完成')
    else flash(result?.message || result?.error || '操作失败', 'err')
    void refreshBootstrap()
  }

  return (
    <>
      <div className="settings-section">
        <div className="settings-section-head">
          <div className="settings-section-title">Workbench 授权</div>
          <span className="settings-badge">Agent Service</span>
        </div>
        <p className="settings-intro">
          连接本机或远程 Agent Service（默认 127.0.0.1:8010）。远程地址必须使用 HTTPS；授权码经系统加密保存在本地，不会写入 git 或日志。
        </p>
        <div className="settings-grid">
          <div className="settings-field">
            <label htmlFor="workbenchAuthEndpoint">服务地址</label>
            <input
              id="workbenchAuthEndpoint"
              value={auth.endpoint || ''}
              onChange={(e) => onPatch({ workbenchAuth: { ...auth, endpoint: e.target.value } })}
              placeholder="http://127.0.0.1:8010 或 https://daemon.example.com"
            />
          </div>
          <div className="settings-field">
            <label htmlFor="workbenchAuthTenant">项目组（可选）</label>
            <select
              id="workbenchAuthTenant"
              value={auth.tenantId || ''}
              onChange={(e) => onPatch({ workbenchAuth: { ...auth, tenantId: e.target.value } })}
            >
              <option value="">平台管理员</option>
              <option value="rdpi">RDPI</option>
              <option value="ff">FF</option>
              <option value="hyper">Hyper</option>
            </select>
          </div>
          <div className="settings-field full">
            <label htmlFor="workbenchAuthKey">授权码</label>
            <input
              id="workbenchAuthKey"
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="向管理员索取 wb_* 授权码"
              autoComplete="off"
            />
            <div className="settings-hint">验证成功后会加密保存；此处不会回显已保存的授权码。</div>
          </div>
        </div>
        <div className="settings-actions">
          <button
            type="button"
            className="settings-btn primary"
            onClick={async () => {
              const result = await window.api?.workbenchAuthLogin?.({
                endpoint: auth.endpoint,
                tenantId: auth.tenantId,
                key,
              })
              if (result?.ok) {
                flash('Workbench 授权已保存')
                setKey('')
              } else flash(result?.error || '验证失败', 'err')
              void refreshAuth()
            }}
          >
            验证并保存
          </button>
          <button
            type="button"
            className="settings-btn"
            onClick={async () => {
              await window.api?.workbenchAuthLogout?.()
              flash('已清除授权')
              void refreshAuth()
            }}
          >
            清除授权
          </button>
          <button type="button" className="settings-btn" onClick={() => void refreshAuth()}>
            刷新状态
          </button>
        </div>
        <p className="settings-intro">{statusText}</p>
      </div>

      <div className="settings-section">
        <div className="settings-section-head">
          <div className="settings-section-title">Workbench 部署与兼容</div>
          <span className="settings-badge">管线服务引入</span>
        </div>
        <p className="settings-intro">
          配置本机 Workbench 安装目录后，KnowMe 可自动注册 <code>game-dev-delivery</code> 工作流，并在版本匹配时安装 script-only 兼容层。
        </p>
        <div className="settings-field">
          <label htmlFor="workbenchInstallPath">Workbench 安装目录</label>
          <input
            id="workbenchInstallPath"
            value={installPath}
            onChange={(e) => onPatch({
              workbenchInstall: { ...form.workbenchInstall, path: e.target.value },
            })}
            placeholder="例如 D:\workflows\workbench 或 KNOWME_WORKBENCH_INSTALL"
          />
          <div className="settings-hint">管线服务进程使用的 Workbench 仓库根目录；留空则尝试环境变量自动发现。</div>
        </div>
        <div className="settings-actions">
          <button type="button" className="settings-btn" onClick={() => void refreshBootstrap()}>
            检测状态
          </button>
          <button type="button" className="settings-btn primary" onClick={() => void runBootstrap({ deploy: true, applyCompat: false })}>
            注册工作流
          </button>
          <button type="button" className="settings-btn" onClick={() => void runBootstrap({ deploy: false, applyCompat: true })}>
            安装兼容层
          </button>
        </div>
        <p className="settings-intro">{bootstrapText}</p>
      </div>
    </>
  )
}
