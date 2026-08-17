import { useCallback, useEffect, useState } from 'react'
import type {
  MemoryConsolidatedPreview,
  MemoryOverview,
  MemoryPattern,
  MemoryRecord,
  SettingsForm,
} from '../../../shared/api-extended'
import { SettingsToggle } from './SettingsToggle'

const INDUSTRIES = [
  { value: 'general', label: '通用办公' },
  { value: 'software', label: '互联网/软件' },
  { value: 'game', label: '游戏' },
  { value: 'sales', label: '销售/商务' },
  { value: 'education', label: '教育/培训' },
  { value: 'content', label: '内容/媒体' },
] as const

type Props = {
  form: SettingsForm
  onPatch: (next: Partial<SettingsForm>) => void
  flash: (msg: string, kind?: 'ok' | 'err') => void
  dirty?: boolean
}

function industryLabel(id?: string) {
  return INDUSTRIES.find((item) => item.value === id)?.label || id || '—'
}

function briefText(form: SettingsForm) {
  const profile = String(form.userProfile || '').trim()
  const prompt = String(form.userPrompt || '').trim()
  if (!profile && !prompt) return '还没有写下身份与协作偏好。保存后会参与 AI 对话，不会写入项目知识库。'
  return [profile, prompt].filter(Boolean).join('\n')
}

export function SettingsMemoryPanel({ form, onPatch, flash, dirty }: Props) {
  const [learning, setLearning] = useState(false)
  const [patterns, setPatterns] = useState<MemoryPattern[]>([])
  const [recent, setRecent] = useState<MemoryRecord[]>([])
  const [consolidated, setConsolidated] = useState<MemoryConsolidatedPreview[]>([])
  const [consolidatedAt, setConsolidatedAt] = useState<string | null>(null)
  const [stats, setStats] = useState<MemoryOverview['stats']>({})

  const refresh = useCallback(async () => {
    try {
      const overview = await window.api?.memoryOverview?.()
      const cfg = overview?.config
      setLearning(cfg?.learningEnabled !== false)
      setPatterns(overview?.patterns || [])
      setRecent(overview?.recent || [])
      setConsolidated(overview?.consolidated?.preview || [])
      setConsolidatedAt(overview?.consolidated?.updatedAt || null)
      setStats(overview?.stats || {})
    } catch {
      setPatterns([])
      setRecent([])
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const pending = patterns.filter((item) => item.prompt_state === 'pending')
  const completeness = [form.industry, form.userProfile, form.userPrompt].filter((v) => String(v || '').trim()).length

  return (
    <>
      <div className="settings-section">
        <div className="settings-section-head">
          <div className="settings-section-title">KnowMe 如何理解我</div>
          <span className="settings-badge">仅存本机</span>
        </div>
        <p className="settings-intro">
          让 KnowMe 越用越懂你，同时始终由你决定。个人资料和协作偏好会跨项目生效；项目事实与资料请在「内容源」管理。
        </p>
        <div className="settings-brief" data-testid="user-brief-card">
          <div className="settings-brief-head">
            <strong>KnowMe 目前这样理解你</strong>
            <span>{completeness ? `已填 ${completeness}/3` : '待完善'}</span>
          </div>
          <p>{briefText(form)}</p>
          <div className="settings-brief-grid">
            <div><small>行业</small><span>{industryLabel(form.industry)}</span></div>
            <div><small>身份背景</small><span>{form.userProfile?.trim() ? '已填写' : '—'}</span></div>
            <div><small>协作方式</small><span>{form.userPrompt?.trim() ? '已填写' : '—'}</span></div>
          </div>
        </div>
        <div className="settings-field">
          <label htmlFor="userIndustry">行业</label>
          <select
            id="userIndustry"
            value={form.industry || 'general'}
            onChange={(e) => onPatch({ industry: e.target.value })}
          >
            {INDUSTRIES.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
          <div className="settings-hint">影响助手默认口吻。不替代「关于我」自由文本。</div>
        </div>
        <div className="settings-memory-grid">
          <div className="settings-field">
            <label htmlFor="userProfile">关于我</label>
            <textarea
              id="userProfile"
              value={form.userProfile || ''}
              onChange={(e) => onPatch({ userProfile: e.target.value })}
              placeholder="例：我是独立开发者，主要做 Windows 桌面产品…"
            />
            <div className="settings-hint">填写长期稳定的身份与工作背景。保存后参与 AI 对话，不会写入项目知识库。</div>
          </div>
          <div className="settings-field">
            <label htmlFor="userPrompt">协作偏好</label>
            <textarea
              id="userPrompt"
              value={form.userPrompt || ''}
              onChange={(e) => onPatch({ userPrompt: e.target.value })}
              placeholder="例：回答简洁、优先用列表；先给结论…"
            />
            <div className="settings-hint">你明确写下的偏好优先于软件推断。</div>
          </div>
        </div>
        <p className={`settings-memory-save${dirty ? ' dirty' : ' saved'}`}>
          {dirty ? '有未保存的修改，点底部「保存设置」写入本机' : '已保存到本机'}
        </p>
      </div>

      <div className="settings-section">
        <div className="settings-section-head">
          <div className="settings-section-title">AI 学到的习惯</div>
          <span className="settings-badge">{learning ? '学习中' : '已暂停'}</span>
        </div>
        <p className="settings-intro">KnowMe 会根据你的使用方式提出推测。只有你接受后，才会作为稳定协作偏好影响 AI。</p>
        <SettingsToggle
          checked={learning}
          onChange={async (next) => {
            setLearning(next)
            await window.api?.memorySetLearning?.(next)
          }}
          label="适应我的工作方式"
          sub="学习收藏、复制和工作流等本地行为；关闭后停止新增记忆。"
        />
        <div className="settings-stat-grid">
          <div>
            <small>最近学习记录</small>
            <strong>{stats?.recentCount ?? recent.length}</strong>
            <span>不是项目知识库事实</span>
          </div>
          <div>
            <small>已应用习惯</small>
            <strong>{stats?.acceptedCount ?? 0}</strong>
            <span>{stats?.pendingCount ?? pending.length} 条等你确认</span>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-head">
          <div className="settings-section-title">等你确认的推测</div>
          <span className="settings-badge">确认后生效</span>
        </div>
        <p className="settings-intro">这是 AI 对你工作方式的推测，不是事实。可以接受或忽略。</p>
        {!pending.length ? (
          <p className="settings-intro">暂无可审阅的习惯。持续使用一段时间后，这里会出现重复模式。</p>
        ) : pending.map((item) => (
          <div key={item.id} className="settings-pattern" data-testid="memory-pattern">
            <p>{item.summary}</p>
            <div className="settings-actions">
              <button
                type="button"
                className="settings-btn primary"
                onClick={async () => {
                  const result = await window.api?.memoryReviewPattern?.({ id: item.id, action: 'accepted' })
                  if (result?.ok === false) flash(result.error || '无法接受', 'err')
                  else flash('已接受该习惯')
                  void refresh()
                }}
              >
                接受
              </button>
              <button
                type="button"
                className="settings-btn"
                onClick={async () => {
                  await window.api?.memoryReviewPattern?.({ id: item.id, action: 'dismissed' })
                  flash('已忽略')
                  void refresh()
                }}
              >
                忽略
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="settings-section">
        <div className="settings-section-head">
          <div className="settings-section-title">工作记忆整合</div>
          <span className="settings-badge">{consolidatedAt ? '已整合' : '—'}</span>
        </div>
        <p className="settings-intro">从近期活动与已确认偏好中提炼结构化工作记忆。活动信号与近期推断不是项目知识库事实。</p>
        {!consolidated.length ? (
          <p className="settings-intro">暂无整合结果。持续使用或确认习惯后，点击「整合」。</p>
        ) : consolidated.map((item) => (
          <div key={item.id || item.text} className="settings-pattern">
            <small>{item.fieldLabel || item.field}</small>
            <p>{item.text}</p>
          </div>
        ))}
        <div className="settings-actions">
          <button
            type="button"
            className="settings-btn"
            onClick={async () => {
              await window.api?.memoryConsolidate?.()
              flash('工作记忆已重新整合')
              void refresh()
            }}
          >
            整合
          </button>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-head">
          <div className="settings-section-title">近期记忆</div>
        </div>
        {!recent.length ? (
          <p className="settings-intro">暂无使用记忆。</p>
        ) : recent.slice(0, 12).map((row, index) => (
          <div key={`${row.ts || index}-${row.summary || ''}`} className="settings-pattern">
            <small>{row.kind || 'habit'}</small>
            <p>{row.summary}</p>
          </div>
        ))}
        <div className="settings-action-row">
          <div>
            <div className="settings-toggle-label">记忆目录</div>
            <div className="settings-hint">个人记忆仅保存在本机，不会自动写入项目知识库。</div>
          </div>
          <button type="button" className="settings-btn" onClick={() => window.api?.openMemoryDir?.()}>
            打开目录
          </button>
        </div>
        <div className="settings-action-row">
          <div>
            <div className="settings-toggle-label">一键遗忘</div>
            <div className="settings-hint">清除自动记忆、近期记录和 AI 推断。「关于我」与协作偏好不会被删除。</div>
          </div>
          <button
            type="button"
            className="settings-btn"
            onClick={async () => {
              if (!window.confirm('清除全部自动记忆、近期记录和 AI 推断？“关于我”、协作偏好和项目知识库不会被删除。')) return
              await window.api?.memoryClear?.()
              flash('已清除自动记忆')
              void refresh()
            }}
          >
            清除
          </button>
        </div>
      </div>
    </>
  )
}
