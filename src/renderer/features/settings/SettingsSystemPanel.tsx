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
  const [embeddingTesting, setEmbeddingTesting] = useState(false)
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
            label="知识检索向量重排"
            sub="只影响知识检索候选，不影响 Context Engine"
          />
          <div className="settings-field">
            <label htmlFor="contextSemanticMode">Context Engine 语义选择</label>
            <select
              id="contextSemanticMode"
              value={form.contextSemanticMode || 'off'}
              onChange={(e) => onPatch({ contextSemanticMode: e.target.value as 'off' | 'shadow' | 'active' })}
            >
              <option value="off">关闭（本地词面排序）</option>
              <option value="shadow">Shadow（只观测，不改变选择）</option>
              <option value="active">启用（参与可选上下文排序）</option>
            </select>
          </div>
          <div className="settings-field">
            <label htmlFor="embeddingEndpoint">Embedding Endpoint</label>
            <input
              id="embeddingEndpoint"
              value={form.embeddingEndpoint || ''}
              onChange={(e) => onPatch({ embeddingEndpoint: e.target.value })}
              placeholder="留空则继承主模型 Endpoint"
            />
          </div>
          <div className="settings-field">
            <label htmlFor="embeddingModel">Embedding 模型 ID</label>
            <input
              id="embeddingModel"
              value={form.embeddingModel || ''}
              onChange={(e) => onPatch({ embeddingModel: e.target.value })}
              placeholder="留空则按 Provider 推断"
            />
          </div>
          <div className="settings-field">
            <label htmlFor="embeddingApiKey">Embedding API Key</label>
            <input
              id="embeddingApiKey"
              type="password"
              value={form.embeddingApiKey || ''}
              onChange={(e) => onPatch({ embeddingApiKey: e.target.value })}
              placeholder={form.embeddingApiKeyConfigured
                ? '已配置；清空后仅在继承/同源 Endpoint 时复用主密钥'
                : '继承/同源 Endpoint 可留空；独立 Host 必须填写'}
              autoComplete="off"
            />
          </div>
          <SettingsToggle
            checked={!!form.embeddingAllowSensitive}
            onChange={(next) => onPatch({ embeddingAllowSensitive: next })}
            label="允许发送敏感上下文"
            sub="允许把标记为敏感的记忆和检索候选发送到 Embedding Provider；默认关闭"
          />
          <div className="settings-actions">
            <button
              type="button"
              className="settings-btn"
              disabled={embeddingTesting}
              onClick={async () => {
                setEmbeddingTesting(true)
                try {
                  const result = await window.api?.embeddingProbe?.(form)
                  if (result?.ok) {
                    flash(`Embedding 可用：${result.dimensions || 0} 维，${result.latencyMs || 0}ms`)
                  } else {
                    flash(result?.error || 'Embedding 连接失败', 'err')
                  }
                } catch {
                  flash('Embedding 连接失败', 'err')
                } finally {
                  setEmbeddingTesting(false)
                }
              }}
            >
              {embeddingTesting ? '测试中…' : '测试 Embedding'}
            </button>
            <button type="button" className="settings-btn" onClick={() => window.api?.openKnowledgeDir?.()}>
              打开知识库目录
            </button>
          </div>
          <p className="settings-intro">
            只有候选超过 topK 时才请求。Shadow 不改变实际选择；任何超时或非法向量都会回退本地排序。
          </p>
        </details>
      </div>
    </>
  )
}
