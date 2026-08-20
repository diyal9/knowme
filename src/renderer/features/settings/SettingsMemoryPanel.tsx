import { useCallback, useEffect, useMemo, useState } from 'react'
import type { GlobalMemoryItem, MemoryOverview, MemoryPattern, MemoryRecord } from '../../../shared/api-extended'
import { SettingsToggle } from './SettingsToggle'

type Props = { flash: (msg: string, kind?: 'ok' | 'err') => void }
type MemoryType = GlobalMemoryItem['type']

const TYPE_LABELS: Record<MemoryType, string> = {
  fact: '个人事实', preference: '长期偏好', goal: '目标与关注',
  relationship: '人物与关系', decision: '经验与决策',
}

export function SettingsMemoryPanel({ flash }: Props) {
  const [learning, setLearning] = useState(false)
  const [items, setItems] = useState<GlobalMemoryItem[]>([])
  const [patterns, setPatterns] = useState<MemoryPattern[]>([])
  const [recent, setRecent] = useState<MemoryRecord[]>([])
  const [stats, setStats] = useState<MemoryOverview['stats']>({})
  const [type, setType] = useState<MemoryType>('fact')
  const [text, setText] = useState('')
  const [scope, setScope] = useState<'global' | 'project'>('global')
  const [project, setProject] = useState('')
  const [filter, setFilter] = useState<'all' | MemoryType>('all')
  const [showActivity, setShowActivity] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const overview = await window.api?.memoryOverview?.()
      setLearning(overview?.config?.learningEnabled !== false)
      setItems(overview?.globalMemories || [])
      setPatterns((overview?.patterns || []).filter((item) => item.prompt_state === 'pending' && (item.review_ready || Number(item.count || 0) >= 3)))
      setRecent(overview?.recent || [])
      setStats(overview?.stats || {})
    } catch { setItems([]) }
  }, [])

  useEffect(() => { void refresh() }, [refresh])
  const visibleItems = useMemo(() => filter === 'all' ? items : items.filter((item) => item.type === filter), [filter, items])

  const remember = async () => {
    const content = text.trim()
    if (!content) return
    const result = await window.api?.memoryGlobalUpsert?.({ type, text: content, scope, project })
    if (!result?.ok) return flash(result?.error || '保存记忆失败', 'err')
    setText(''); setProject(''); flash('已加入我的记忆'); void refresh()
  }

  const review = async (item: MemoryPattern, action: 'accepted' | 'dismissed') => {
    await window.api?.memoryReviewPattern?.({ id: item.id, action, summary: item.summary })
    flash(action === 'accepted' ? '已确认长期偏好' : '已忽略记忆建议'); void refresh()
  }

  return <div className="memory-center">
    <section className="memory-hero">
        <div><span className="memory-eyebrow">全局长期记忆</span><h2>我的记忆</h2><p>关于你的事实、偏好、目标、关系和重要决策。跨会话生效，由你决定记住什么。</p></div>
      <div className="memory-hero-stat"><strong>{items.length}</strong><span>条已确认记忆</span></div>
    </section>

    <section className="memory-add-panel">
      <div className="memory-section-head"><div><h3>记住一件事</h3><p>你明确添加的内容会立即成为全局记忆。</p></div></div>
      <div className="memory-compose-row">
        <select aria-label="记忆类型" value={type} onChange={(event) => setType(event.target.value as MemoryType)}>{Object.entries(TYPE_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
        <input aria-label="记忆内容" value={text} onChange={(event) => setText(event.target.value)} placeholder="例如：我是游戏服务端开发者；方案请先给结论。" onKeyDown={(event) => { if (event.key === 'Enter') void remember() }} />
        <button type="button" className="settings-btn primary" disabled={!text.trim()} onClick={() => void remember()}>记住</button>
      </div>
      <div className="memory-scope-row">
        <label><input type="radio" name="memory-scope" checked={scope === 'global'} onChange={() => setScope('global')} /> 全局生效</label>
        <label><input type="radio" name="memory-scope" checked={scope === 'project'} onChange={() => setScope('project')} /> 仅特定项目</label>
        {scope === 'project' ? <input aria-label="适用项目" value={project} onChange={(event) => setProject(event.target.value)} placeholder="项目名称" /> : null}<span>仅保存在本机</span>
      </div>
    </section>

    {patterns.length ? <section className="memory-suggestions">
      <div className="memory-section-head"><div><h3>等待你确认</h3><p>智能伙伴从重复协作中发现的稳定偏好，确认前不会生效。</p></div><b>{patterns.length}</b></div>
      {patterns.map((item) => <div className="memory-suggestion" key={item.id}><div><small>长期偏好 · 已观察 {item.count || 3} 次</small><strong>{item.summary}</strong></div><div><button type="button" className="settings-btn" onClick={() => void review(item, 'dismissed')}>忽略</button><button type="button" className="settings-btn primary" onClick={() => void review(item, 'accepted')}>确认记住</button></div></div>)}
    </section> : null}

    <section className="memory-library">
      <div className="memory-section-head"><div><h3>已记住</h3><p>KnowMe 会按当前任务选择相关记忆，不会把所有内容都发送给模型。</p></div></div>
      <div className="memory-filters"><button type="button" className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>全部</button>{Object.entries(TYPE_LABELS).map(([id, label]) => <button type="button" key={id} className={filter === id ? 'active' : ''} onClick={() => setFilter(id as MemoryType)}>{label}</button>)}</div>
      {!visibleItems.length ? <div className="memory-empty"><strong>还没有这类记忆</strong><span>可以直接告诉 KnowMe，也可以让智能伙伴在协作中逐渐发现。</span></div> : <div className="memory-grid">{visibleItems.map((item) => <article className="memory-item" key={item.id}><div className="memory-item-meta"><span>{TYPE_LABELS[item.type]}</span><small>{item.scope === 'project' ? item.project || '项目记忆' : '全局'}</small></div><p>{item.text}</p><footer><span>{item.source?.label || '由你添加'} · 已确认</span><button type="button" aria-label={`忘记：${item.text}`} onClick={async () => { await window.api?.memoryGlobalRemove?.(item.id); flash('已忘记这条内容'); void refresh() }}>忘记</button></footer></article>)}</div>}
    </section>

    <section className="memory-learning">
      <SettingsToggle checked={learning} onChange={async (next) => { setLearning(next); await window.api?.memorySetLearning?.(next) }} label="允许智能伙伴发现记忆建议" sub="只识别重复出现的偏好与纠正；任务名、入口选择和完成记录不会自动成为长期记忆。" />
      <button type="button" className="memory-activity-toggle" onClick={() => setShowActivity((value) => !value)}>{showActivity ? '收起' : '查看'}近期活动记录（{stats?.recentCount ?? recent.length}）</button>
      {showActivity ? <div className="memory-activity-list">{recent.slice(0, 12).map((row, index) => <div key={`${row.ts || index}-${row.summary}`}><small>{row.kind || 'activity'}</small><span>{row.summary}</span></div>)}</div> : null}
      <div className="memory-data-actions"><span>记忆保存在本机，可随时查看目录或清除自动学习记录。</span><button type="button" className="settings-btn" onClick={() => window.api?.openMemoryDir?.()}>打开目录</button><button type="button" className="settings-btn" onClick={async () => { if (!window.confirm('清除自动学习记录和推断？已确认的全局记忆不会删除。')) return; await window.api?.memoryClear?.(); flash('已清除自动学习记录'); void refresh() }}>清除活动</button></div>
    </section>
  </div>
}
