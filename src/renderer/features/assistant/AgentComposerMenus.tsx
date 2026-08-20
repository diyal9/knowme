import { useEffect, useRef, useState } from 'react'
import type { AgentContextInfo, CapabilityItem } from '../../../shared/api'
import { ASSISTANT_QUICK_COMMANDS, parseConfiguredQuickActions } from '../../../domain/agent-quick-commands'
import { buildIntelligentRecommendations, type IntelligentRecommendation } from '../../../domain/assistant-recommendations'
import {
  buildContextUsageViewModel,
  contextUsageSectionLabel,
  formatTokenCount,
} from '../../../domain/agent-context-usage'
import { Icon } from '../../app/Icon'

export type ModelPreset = { id: string; label: string; contextWindow?: number; supportsTools?: boolean }
export type ModelGroup = { id: string; label: string; models: ModelPreset[] }

type KnowledgeEntry = { path: string; title?: string }

export function AgentModelMenu({
  groups,
  presets,
  modelId,
  onPick,
  contextInfo,
  historyTokens = 0,
  fallbackLimit = 32768,
}: {
  groups: ModelGroup[]
  presets: ModelPreset[]
  modelId: string
  onPick: (id: string) => void
  contextInfo?: AgentContextInfo | null
  historyTokens?: number
  fallbackLimit?: number
}) {
  const hasGroups = groups.some((group) => group.models.length > 0)
  const usage = buildContextUsageViewModel(contextInfo, fallbackLimit, historyTokens)
  const hasUsage = usage.used > 0 || usage.rows.length > 0
  return (
    <div className="agent-menu agent-model-menu show" data-testid="agent-model-menu" role="listbox" aria-label="选择模型">
      <div className="agent-model-layout">
        <div className="agent-model-list">
          {hasGroups ? groups.map((group) => (
            <div key={group.id}>
              <div className="agent-model-group">{group.label}</div>
              {group.models.map((item) => (
                <button
                  key={`${group.id}-${item.id}`}
                  type="button"
                  className={`agent-menu-item agent-model-item${item.id === modelId ? ' active' : ''}${item.supportsTools === false ? ' no-tools' : ''}`}
                  role="option"
                  aria-selected={item.id === modelId}
                  onClick={() => onPick(item.id)}
                >
                  <span className="m-label">{item.label}</span>
                  <span className="m-ctx">
                    {item.contextWindow ? (
                      <span className="m-limit">{Math.round(item.contextWindow / 1000)}k</span>
                    ) : null}
                    {item.supportsTools === false ? (
                      <>
                        <span className="m-sep">·</span>
                        <span className="m-no-tools">无工具</span>
                      </>
                    ) : null}
                  </span>
                </button>
              ))}
            </div>
          )) : presets.length === 0 ? (
            <div className="agent-model-group">暂无可选模型，请在设置中配置</div>
          ) : presets.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`agent-menu-item agent-model-item${item.id === modelId ? ' active' : ''}`}
              role="option"
              onClick={() => onPick(item.id)}
            >
              <span className="m-label">{item.label}</span>
            </button>
          ))}
        </div>
        <aside className="agent-model-context" aria-label="Context Usage">
          <div className="ctx2-title">
            Context Usage
            {usage.sourceLabel ? (
              <span className="ctx2-source" data-testid="ctx-usage-source"> · {usage.sourceLabel}</span>
            ) : null}
          </div>
          {hasUsage ? (
            <>
              <div className="ctx2-sub">{Math.round(usage.ratio * 100)}% Full</div>
              <div className="ctx2-total">
                {usage.source === 'estimate' ? '~' : ''}
                {`${formatTokenCount(usage.used)} / ${formatTokenCount(usage.limit)} Tokens`}
              </div>
              <div className={`ctx2-bar ${usage.barClass}`}>
                <i style={{ width: `${Math.max(usage.ratio * 100, usage.ratio > 0 ? 2 : 0)}%` }} />
              </div>
              {usage.rows.length ? usage.rows.map((item) => (
                <div key={item.key} className="ctx2-row">
                  <span>{contextUsageSectionLabel(item.key)}</span>
                  <strong>{formatTokenCount(item.usedTokens || 0)}</strong>
                </div>
              )) : null}
              {usage.note ? <div className="ctx2-note">{usage.note}</div> : null}
            </>
          ) : (
            <>
              <div className="ctx2-sub">发送一轮对话后可查看</div>
              <div className="ctx2-empty">发送一轮对话后可查看分区明细</div>
            </>
          )}
        </aside>
      </div>
    </div>
  )
}

export function AgentKnowledgeMenu({
  knowledge,
  providers = [],
  refs,
  onToggle,
  onClear,
}: {
  knowledge: KnowledgeEntry[]
  /** 知识源 provider（与 wiki/okf 条目并列可选） */
  providers?: Array<{ id: string; displayName?: string; name?: string; kind?: string }>
  refs: string[]
  onToggle: (path: string) => void
  onClear: () => void
}) {
  const empty = providers.length === 0 && knowledge.length === 0
  return (
    <div className="agent-menu agent-knowledge-menu show" data-testid="agent-knowledge-menu" role="menu" aria-label="本次对话知识库">
      <div className="agent-knowledge-menu-head">
        <strong>本次对话知识库</strong>
        <span>{refs.length ? `已选 ${refs.length}` : '跟随默认'}</span>
      </div>
      <div className="agent-expert-knowledge-options">
        <button
          type="button"
          className={`agent-expert-knowledge${refs.length ? '' : ' selected'}`}
          onClick={onClear}
        >
          跟随默认 · 系统默认
        </button>
        {empty ? (
          <span className="agent-expert-capability limited">暂无知识库条目</span>
        ) : null}
        {providers.map((item) => (
          <button
            key={`provider:${item.id}`}
            type="button"
            className={`agent-expert-knowledge${refs.includes(item.id) ? ' selected' : ''}`}
            aria-pressed={refs.includes(item.id)}
            data-testid="agent-knowledge-provider"
            onClick={() => onToggle(item.id)}
          >
            {item.displayName || item.name || item.id}
            {item.kind ? ` · ${item.kind}` : ''}
          </button>
        ))}
        {knowledge.map((item) => (
          <button
            key={item.path}
            type="button"
            className={`agent-expert-knowledge${refs.includes(item.path) ? ' selected' : ''}`}
            aria-pressed={refs.includes(item.path)}
            onClick={() => onToggle(item.path)}
          >
            {item.title || item.path}
          </button>
        ))}
      </div>
    </div>
  )
}

export function AgentQuickMenu({
  context,
  onPick,
}: {
  context: string
  onPick: (prompt: string) => void
}) {
  const [memoryHints, setMemoryHints] = useState<string[]>([])
  const [commonActions, setCommonActions] = useState<IntelligentRecommendation[]>(() => ASSISTANT_QUICK_COMMANDS.map((item) => ({
    label: item.title,
    description: item.subtitle,
    prompt: item.prompt,
  })))
  useEffect(() => {
    let active = true
    void window.api?.personalAgentGet?.().then((result) => {
      if (!active) return
      const profile = result?.profile
      setMemoryHints([
        String(profile?.promptOverlay || '').trim(),
        String(profile?.taskPreferences?.domainCapabilities || '').trim(),
      ].filter(Boolean).map((item) => item.slice(0, 120)))
      const configured = parseConfiguredQuickActions(profile?.taskPreferences?.quickActions)
      if (configured.length) {
        setCommonActions(configured.map((item) => ({
          label: item.title,
          description: item.subtitle,
          prompt: item.prompt || `请使用 Skill「${item.skillRef}」执行这项操作。`,
        })))
      }
    }).catch(() => undefined)
    return () => { active = false }
  }, [])
  const recommendations = buildIntelligentRecommendations(context || '当前工作', 'general', { memoryHints })
  const items = recommendations
  const commonItems = commonActions
  const allItems = [...items, ...commonItems]
  const [activeIndex, setActiveIndex] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => { menuRef.current?.focus() }, [])
  useEffect(() => { setActiveIndex(0) }, [context])
  function choose(index: number) {
    const item = allItems[index]
    if (item) onPick(item.prompt)
  }
  function moveSelection(key: string) {
    const leftCount = items.length
    const rightCount = commonItems.length
    if (!leftCount && !rightCount) return
    const onLeft = activeIndex < leftCount
    const row = onLeft ? activeIndex : activeIndex - leftCount
    if (key === 'ArrowLeft' && !onLeft && leftCount) {
      setActiveIndex(Math.min(row, leftCount - 1)); return
    }
    if (key === 'ArrowRight' && onLeft && rightCount) {
      setActiveIndex(leftCount + Math.min(row, rightCount - 1)); return
    }
    if (key === 'ArrowDown') {
      const count = onLeft ? leftCount : rightCount
      const next = Math.min(row + 1, count - 1)
      setActiveIndex(onLeft ? next : leftCount + next)
    }
    if (key === 'ArrowUp') {
      const next = Math.max(row - 1, 0)
      setActiveIndex(onLeft ? next : leftCount + next)
    }
  }

  return (
    <div
      className="agent-quick-menu show"
      id="agentQuickMenu"
      data-testid="agent-quick-menu"
      role="menu"
      aria-label="智能推荐"
      tabIndex={-1}
      ref={menuRef}
      onKeyDown={(e) => {
        if (!allItems.length) return
        if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) { e.preventDefault(); moveSelection(e.key) }
        if (e.key === 'Enter') { e.preventDefault(); choose(activeIndex) }
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="agent-quick-columns">
        <section className="agent-quick-section" aria-labelledby="agentQuickRecommendedTitle">
          <h3 id="agentQuickRecommendedTitle">智能推荐</h3>
          <div className="agent-command-results" id="agentQuickItems" role="listbox" aria-label="智能推荐结果">
            {items.map((item, index) => (
              <button key={`${item.label}-${item.prompt}`} type="button" className={`agent-command-item${activeIndex === index ? ' active' : ''}`} role="menuitem" aria-current={activeIndex === index ? 'true' : undefined} data-quick-command="1" onMouseEnter={() => setActiveIndex(index)} onClick={() => onPick(item.prompt)}>
                <Icon name="optimize" />
                <span className="agent-command-copy"><strong>{item.label}</strong><small>{item.description}</small></span>
              </button>
            ))}
          </div>
        </section>
        <section className="agent-quick-section" aria-labelledby="agentQuickCommonTitle">
          <h3 id="agentQuickCommonTitle">我的常用</h3>
          <div className="agent-command-results" role="listbox" aria-label="我的常用操作">
            {commonItems.map((item, index) => (
              <button key={`${item.label}-${item.prompt}`} type="button" className={`agent-command-item${activeIndex === items.length + index ? ' active' : ''}`} role="menuitem" aria-current={activeIndex === items.length + index ? 'true' : undefined} data-quick-command="1" onMouseEnter={() => setActiveIndex(items.length + index)} onClick={() => onPick(item.prompt)}>
                <Icon name="history" />
                <span className="agent-command-copy"><strong>{item.label}</strong><small>{item.description}</small></span>
              </button>
            ))}
          </div>
        </section>
      </div>
      <div className={`agent-command-empty${items.length || commonItems.length ? '' : ' show'}`} id="agentQuickEmpty" role="status">
        暂无可推荐操作
      </div>
    </div>
  )
}

export function AgentSlashMenu({
  items,
  onPick,
  query = '',
  onQueryChange,
  activeIndex = 0,
  onActiveChange,
}: {
  items: CapabilityItem[]
  onPick: (item: CapabilityItem) => void
  query?: string
  onQueryChange?: (query: string) => void
  activeIndex?: number
  onActiveChange?: (index: number) => void
}) {
  return (
    <div className="agent-slash-menu show" data-testid="agent-slash-menu" role="listbox" aria-label="已安装技能">
      <label className="agent-skill-search">
        <Icon name="search" />
        <input
          value={query}
          placeholder="搜索已安装技能…"
          aria-label="搜索已安装技能"
          onChange={(e) => onQueryChange?.(e.target.value)}
          onKeyDown={(e) => {
            if (!items.length) return
            if (e.key === 'ArrowDown') { e.preventDefault(); onActiveChange?.((activeIndex + 1) % items.length) }
            if (e.key === 'ArrowUp') { e.preventDefault(); onActiveChange?.((activeIndex - 1 + items.length) % items.length) }
            if (e.key === 'Enter') { e.preventDefault(); onPick(items[activeIndex]) }
          }}
        />
      </label>
      {items.length === 0 ? (
        <div className="agent-pop-empty">没有匹配的已安装技能</div>
      ) : items.map((item, index) => (
        <button key={item.id} type="button" className={`agent-slash-item${index === activeIndex ? ' active' : ''}`} aria-selected={index === activeIndex} onMouseEnter={() => onActiveChange?.(index)} onMouseDown={(e) => { e.preventDefault(); onPick(item) }}>
          <Icon name="bookOpen" />
          <span className="slash-copy">
            <strong>{item.name || item.id}</strong>
            <small>{item.description || '已安装技能'}</small>
          </span>
          <span className="slash-origin">{item.category || '个人'}</span>
        </button>
      ))}
    </div>
  )
}
