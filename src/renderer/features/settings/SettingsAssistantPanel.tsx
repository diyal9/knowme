import type { SettingsForm } from '../../../shared/api-extended'

const MODES = [
  {
    key: 'general',
    label: '通用办公（general）',
    placeholder: '例：先给可执行结论，再给 1-3 步行动建议；避免过度技术细节。',
    hint: '可选补充。留空表示沿用系统默认模式能力。',
  },
  {
    key: 'steward',
    label: '知识管家（steward）',
    placeholder: '例：先结论，再列依据来源与适用边界；缺信息时指出缺口并建议补齐路径。',
    hint: '可选补充。建议描述你偏好的证据呈现方式。',
  },
  {
    key: 'writing',
    label: '写作专家（writing）',
    placeholder: '例：输出可直接发送版本；保持原意；必要时给正式版与简版。',
    hint: '可选补充。建议写明语气、长度、格式偏好。',
  },
  {
    key: 'coding',
    label: '研发助手（coding）',
    placeholder: '例：先复述问题，再给根因假设、最小改动方案和验收清单。',
    hint: '可选补充。建议写明你偏好的排查/实现输出结构。',
  },
] as const

type Props = {
  form: SettingsForm
  onPatch: (next: Partial<SettingsForm>) => void
  onOpenCapabilityHub?: () => void
}

export function SettingsAssistantPanel({ form, onPatch, onOpenCapabilityHub }: Props) {
  const cfg = form.assistantModeConfig || {}

  const patchMode = (key: string, value: string) => {
    onPatch({
      assistantModeConfig: {
        ...cfg,
        [key]: value,
      },
    })
  }

  return (
    <>
      <div className="settings-section">
        <div className="settings-section-head">
          <div className="settings-section-title">技能管理已迁移</div>
          <span className="settings-badge">专家库</span>
        </div>
        <p className="settings-intro">
          旧版 OKF slash 技能入口已迁移至工作台左侧「专家库」入口。请在<strong>专家库</strong>中通过 Tab 浏览、安装与管理专家、技能与 MCP 连接器。
        </p>
        <div className="settings-actions">
          <button
            type="button"
            className="settings-btn primary"
            onClick={() => {
              if (onOpenCapabilityHub) onOpenCapabilityHub()
              else window.parent.postMessage({ type: 'open-capability-hub', tab: 'skills' }, '*')
            }}
          >
            打开专家库
          </button>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-head">
          <div className="settings-section-title">助手模式提示词</div>
          <span className="settings-badge">4 Modes</span>
        </div>
        <p className="settings-intro">
          这里填写的是“用户可追加偏好”。系统基础提示词始终在后台生效且不会展示，避免误改导致能力失效。
        </p>
        <div className="settings-field settings-soul">
          <label htmlFor="assistantSoul">Soul（通用回答风格）</label>
          <textarea
            id="assistantSoul"
            value={cfg.soul || ''}
            onChange={(e) => patchMode('soul', e.target.value)}
            placeholder="例：简洁直接；先结论后展开；不确定时明确假设并给验证路径。"
          />
          <div className="settings-hint">对所有模式生效，建议写语气、结构偏好；留空则仅使用系统默认风格。</div>
        </div>
        <div className="settings-mode-grid">
          {MODES.map((mode) => (
            <div key={mode.key} className="settings-field">
              <label htmlFor={`mode-${mode.key}`}>{mode.label}</label>
              <textarea
                id={`mode-${mode.key}`}
                value={cfg[mode.key] || ''}
                onChange={(e) => patchMode(mode.key, e.target.value)}
                placeholder={mode.placeholder}
              />
              <div className="settings-hint">{mode.hint}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
