import { useState } from 'react'
import { knowledgeTaskStatusLabel } from '../../../domain/knowledge-surface'
import { useAppStore } from '../../app/store'

export function KnowledgeOrganizePage() {
  const wiki = useAppStore((s) => s.knowledgeWiki)
  const okf = useAppStore((s) => s.knowledgeOkf)
  const tasks = useAppStore((s) => s.stewardTasks)
  const proposals = useAppStore((s) => s.stewardProposals)
  const organizing = useAppStore((s) => s.knowledgeOrganizing)
  const organize = useAppStore((s) => s.organizeKnowledge)
  const setPage = useAppStore((s) => s.setKnowledgePage)
  const [mode, setMode] = useState<'changed' | 'all' | 'topic'>('changed')
  const [topic, setTopic] = useState('')
  const pending = proposals.filter((item) => !item.status || item.status === 'draft')
  const latest = [...tasks].sort((a, b) => String((b as { updatedAt?: string }).updatedAt || '').localeCompare(String((a as { updatedAt?: string }).updatedAt || '')))[0]
  const latestTotal = (latest as { total?: number } | undefined)?.total || 0
  const latestAnalyzed = (latest as { analyzed?: number } | undefined)?.analyzed || 0
  const latestProposals = (latest as { proposalCount?: number } | undefined)?.proposalCount || pending.length
  const nextTitle = pending.length
    ? `有 ${pending.length} 条整理提案等待确认`
    : wiki.length
      ? '让 AI 先分析这份知识'
      : '先放入一份资料'

  return (
    <div className="knowledge-workspace">
      <main className="knowledge-page-main">
        <div className="knowledge-reader-inner knowledge-organizer">
          <section className="knowledge-organizer-hero">
        <div className="knowledge-panel-kicker">智能知识管家</div>
            <h1>{nextTitle}</h1>
            <p>KnowMe 会读取资料并生成带来源的整理提案。原始资料不会被覆盖，只有你确认后才会写入正式知识。</p>
            <div className="knowledge-organizer-actions">
              {pending.length ? (
                <button type="button" className="knowledge-btn primary" onClick={() => setPage('review')}>查看待审核提案</button>
              ) : (
                <button type="button" className="knowledge-btn primary" disabled={organizing} onClick={() => void organize({ mode, topic })}>
                  {organizing ? '正在分析…' : '开始 AI 整理'}
                </button>
              )}
              <button type="button" className="knowledge-btn" onClick={() => setPage('status')}>浏览资料</button>
              <button type="button" className="knowledge-btn" onClick={() => setPage('health')}>先做体检</button>
            </div>
          </section>
          <section className="knowledge-organizer-stats" aria-label="知识状态">
            <div><span>原始资料</span><strong>{wiki.length}</strong><small>来自当前知识网</small></div>
            <div><span>已整理知识</span><strong>{okf.length}</strong><small>可稳定复用的概念</small></div>
            <div><span>待审核</span><strong className={pending.length ? 'attention' : ''}>{pending.length}</strong><small>{pending.length ? '需要你的确认' : '暂无待处理提案'}</small></div>
          </section>
          <section className="knowledge-organizer-task">
            <div className="knowledge-organizer-section-head">
        <div><div className="knowledge-panel-kicker">开始整理</div><h2>选择整理范围</h2></div>
            </div>
            <div className="knowledge-scope-options" role="radiogroup" aria-label="整理范围">
              {([
                ['changed', '新增或变更', '优先处理最近更新的资料'],
                ['all', '全部资料', '重新分析当前知识'],
                ['topic', '指定主题', '按标题或目录筛选'],
              ] as const).map(([value, title, desc]) => (
                <label key={value} className={`knowledge-scope-option${mode === value ? ' active' : ''}`}>
                  <input type="radio" name="kosScope" value={value} checked={mode === value} onChange={() => setMode(value)} />
                  <strong>{title}</strong>
                  <span>{desc}</span>
                </label>
              ))}
            </div>
            <input
              className="knowledge-input"
              placeholder="指定主题时输入关键词"
              disabled={mode !== 'topic'}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </section>
          <section className="knowledge-organizer-task-state">
            <div className="knowledge-organizer-section-head">
        <div><div className="knowledge-panel-kicker">最近任务</div><h2>最近一次整理</h2></div>
              {latest ? <span className={`knowledge-task-status ${latest.status || ''}`}>{knowledgeTaskStatusLabel(latest.status)}</span> : <span>尚未开始</span>}
            </div>
            {latest ? (
              <p>{knowledgeTaskStatusLabel(latest.status)} · {latestAnalyzed}/{latestTotal} 份资料 · {latestProposals} 条提案</p>
            ) : (
              <div className="knowledge-task-empty">还没有整理任务。建议先从“新增或变更”开始。</div>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
