import { useEffect, useState } from 'react'
import type { SettingsForm } from '../../../shared/api-extended'

type Props = {
  form: SettingsForm
  onPatch: (next: Partial<SettingsForm>) => void
}

export function SettingsAiPanel({ form, onPatch }: Props) {
  const [modelHint, setModelHint] = useState('加载中…')
  const [presets, setPresets] = useState<{ id: string; label?: string }[]>([])

  useEffect(() => {
    void (async () => {
      try {
        const profile = await window.api?.llmProfile?.()
        const p = profile as { model?: string; contextWindow?: number; maxOutput?: number }
        const parts = [p?.model || form.model || '未选择']
        if (p?.contextWindow) parts.push(`上下文 ${p.contextWindow}`)
        if (p?.maxOutput) parts.push(`输出 ${p.maxOutput}`)
        setModelHint(parts.join(' · '))
      } catch {
        setModelHint('无法读取模型能力')
      }
      try {
        const catalog = await window.api?.llmModels?.()
        setPresets(catalog?.presets || [])
      } catch {
        setPresets([])
      }
    })()
  }, [form.model, form.llmProvider])

  return (
    <div className="settings-section">
      <div className="settings-section-head">
        <div className="settings-section-title">AI 接口</div>
      </div>
      <div className="settings-field">
        <label htmlFor="apiEndpoint">API Endpoint</label>
        <input
          id="apiEndpoint"
          value={form.apiEndpoint || ''}
          onChange={(e) => onPatch({ apiEndpoint: e.target.value })}
          placeholder="https://api.openai.com/v1/chat/completions"
        />
        <div className="settings-hint">
          需含完整路径 · 通常以 <code>/chat/completions</code> 结尾<br />
          DashScope: <code>https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions</code>
        </div>
      </div>
      <div className="settings-field">
        <label htmlFor="apiKey">API Key</label>
        <input
          id="apiKey"
          type="password"
          value={form.apiKey || ''}
          onChange={(e) => onPatch({ apiKey: e.target.value })}
          placeholder={form.apiKeyConfigured ? '已配置（留空则不修改）' : 'sk-…'}
          autoComplete="off"
        />
      </div>
      <div className="settings-field">
        <label htmlFor="llmProvider">Provider</label>
        <select
          id="llmProvider"
          value={form.llmProvider || 'custom'}
          onChange={(e) => onPatch({ llmProvider: e.target.value })}
        >
          <option value="dashscope">阿里云百炼</option>
          <option value="openai">OpenAI</option>
          <option value="custom">自定义兼容接口</option>
        </select>
      </div>
      <div className="settings-field">
        <label htmlFor="modelPreset">模型预设</label>
        <select
          id="modelPreset"
          value=""
          onChange={(e) => {
            const id = e.target.value
            if (!id) return
            onPatch({ model: id })
          }}
        >
          <option value="">选择预设…</option>
          {presets.map((p) => (
            <option key={p.id} value={p.id}>{p.label || p.id}</option>
          ))}
        </select>
        <div className="settings-hint">预设只用于选择模型能力；也可以在下方填写自定义模型 ID。</div>
      </div>
      <div className="settings-field">
        <label htmlFor="model">Model ID</label>
        <input
          id="model"
          value={form.model || ''}
          onChange={(e) => onPatch({ model: e.target.value })}
          placeholder="qwen-plus 或 gpt-4o-mini"
        />
        <div className="settings-hint">{modelHint}</div>
      </div>
      <div className="settings-field">
        <label htmlFor="temperature">
          对话温度 <span>{Number(form.temperature ?? 0.7).toFixed(1)}</span>
        </label>
        <input
          id="temperature"
          type="range"
          min={0}
          max={2}
          step={0.1}
          value={Number(form.temperature ?? 0.7)}
          onChange={(e) => onPatch({ temperature: Number(e.target.value) })}
        />
        <div className="settings-hint">偏低更严谨稳定，偏高更发散创意。默认 0.7。</div>
      </div>
    </div>
  )
}
