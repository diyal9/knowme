import { useEffect, useState } from 'react'
import type { SettingsForm } from '../../../shared/api-extended'
import { SettingsToggle } from './SettingsToggle'

type Props = {
  form: SettingsForm
  onPatch: (next: Partial<SettingsForm>) => void
  flash: (msg: string, kind?: 'ok' | 'err') => void
}

export function SettingsSystemPanel({ form, onPatch, flash }: Props) {
  const [autostart, setAutostart] = useState(false)
  const rc = form.remoteConfig || {}

  useEffect(() => {
    try {
      setAutostart(!!window.api?.getAutostart?.())
    } catch {
      setAutostart(false)
    }
  }, [])

  return (
    <>
      <div className="settings-section">
        <div className="settings-section-head">
          <div className="settings-section-title">组织托管</div>
          <span className="settings-badge">{form.orgManaged ? '托管' : 'Remote · 可选'}</span>
        </div>
        <p className="settings-intro">
          默认关闭。启用后从本机管理后台拉取组织级模型与连接器策略；个人 API Key、记忆与内容源仍可本地编辑。
        </p>
        <SettingsToggle
          checked={!!rc.enabled}
          onChange={(next) => onPatch({ remoteConfig: { ...rc, enabled: next } })}
          label="启用组织远程配置"
          sub="仅允许连接本机 HTTP 服务（127.0.0.1 / localhost）"
        />
        <div className="settings-field">
          <label htmlFor="remoteEndpoint">管理后台地址</label>
          <input
            id="remoteEndpoint"
            value={rc.endpoint || ''}
            onChange={(e) => onPatch({ remoteConfig: { ...rc, endpoint: e.target.value } })}
            placeholder="http://127.0.0.1:8020"
          />
        </div>
        <div className="settings-actions">
          <button
            type="button"
            className="settings-btn primary"
            onClick={async () => {
              const result = await window.api?.pullRemoteConfig?.()
              if (result?.ok && result.settings) {
                onPatch(result.settings)
                flash('远程配置已拉取')
              } else {
                flash(result?.error || '拉取失败', 'err')
              }
            }}
          >
            拉取组织配置
          </button>
          <button
            type="button"
            className="settings-btn"
            onClick={() => void window.api?.saveRemoteConfigPrefs?.(rc)}
          >
            保存连接设置
          </button>
        </div>
        <p className="settings-intro">状态：{rc.enabled ? (rc.lastError ? `最近错误：${rc.lastError}` : '已启用') : '未启用'}</p>
        {form.orgManaged ? (
          <p className="settings-intro">部分 AI / 连接器字段已由管理员托管，请在后台修改。</p>
        ) : null}
      </div>

      <div className="settings-section">
        <div className="settings-section-head">
          <div className="settings-section-title">系统</div>
        </div>
        <SettingsToggle
          checked={autostart}
          onChange={(next) => {
            setAutostart(next)
            window.api?.setAutostart?.(next)
          }}
          label="开机自动启动"
          sub="登录后自动在后台运行"
        />
        <div className="settings-action-row">
          <div>
            <div className="settings-toggle-label">知识库备份</div>
            <div className="settings-hint">导出/导入本机知识库包（OKF）</div>
          </div>
          <button
            type="button"
            className="settings-btn primary"
            onClick={async () => {
              const result = await window.api?.knowledgeExport?.()
              if (result?.canceled) return
              if (result?.ok) flash('知识库已导出')
              else flash(result?.error || '导出失败', 'err')
            }}
          >
            导出
          </button>
          <button
            type="button"
            className="settings-btn"
            onClick={async () => {
              const result = await window.api?.knowledgeImport?.()
              if (result?.canceled) return
              if (result?.ok) flash('知识库已导入')
              else flash(result?.error || '导入失败', 'err')
            }}
          >
            导入
          </button>
        </div>
        <div className="settings-action-row">
          <div>
            <div className="settings-toggle-label">数据目录</div>
            <div className="settings-hint">会话、设置与索引的存储位置</div>
          </div>
          <button type="button" className="settings-btn" onClick={() => window.api?.openDataDir?.()}>
            打开
          </button>
        </div>
        <p className="settings-intro">
          右上角 <strong>最小化</strong> 收起到托盘，<strong>× 关闭</strong> 仅隐藏当前窗；永久删除请在总览或托盘右键菜单中确认。
        </p>
      </div>

      <div className="settings-section">
        <details className="settings-advanced">
          <summary className="settings-section-head">
            <div className="settings-section-title">高级：检索与缓存</div>
            <span className="settings-badge">可选</span>
          </summary>
          <SettingsToggle
            checked={!!form.promptCacheControl}
            onChange={(next) => onPatch({ promptCacheControl: next })}
            label="Prompt cache_control"
            sub="按 Provider 门控启用缓存提示"
          />
          <SettingsToggle
            checked={!!form.semanticRerank}
            onChange={(next) => onPatch({ semanticRerank: next })}
            label="向量语义重排"
            sub="检索结果按语义再排序"
          />
          <div className="settings-field">
            <label htmlFor="embeddingModel">Embedding 模型 ID</label>
            <input
              id="embeddingModel"
              value={form.embeddingModel || ''}
              onChange={(e) => onPatch({ embeddingModel: e.target.value })}
              placeholder="留空则按 Provider 推断"
            />
          </div>
          <div className="settings-actions">
            <button type="button" className="settings-btn" onClick={() => window.api?.openKnowledgeDir?.()}>
              打开知识库目录
            </button>
          </div>
        </details>
      </div>
    </>
  )
}
