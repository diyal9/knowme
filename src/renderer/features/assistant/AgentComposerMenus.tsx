import type { CapabilityItem } from '../../../shared/api'
import { ASSISTANT_QUICK_COMMANDS } from '../../../domain/agent-quick-commands'
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
  contextInfo?: {
    usedTokens?: number
    contextWindow?: number
    omittedTurns?: number
    omittedMessages?: number
    sectionUsage?: { key: string; usedTokens?: number }[]
    sectionOmitted?: string[]
  } | null
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
          <div className="ctx2-title">Context Usage</div>
          {hasUsage ? (
            <>
              <div className="ctx2-sub">{Math.round(usage.ratio * 100)}% Full</div>
              <div className="ctx2-total">{`~${formatTokenCount(usage.used)} / ${formatTokenCount(usage.limit)} Tokens`}</div>
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
  query,
  onQueryChange,
  onPick,
}: {
  query: string
  onQueryChange: (value: string) => void
  onPick: (prompt: string) => void
}) {
  const items = ASSISTANT_QUICK_COMMANDS.filter((item) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return `${item.title} ${item.prompt}`.toLowerCase().includes(q)
  })

  return (
    <div
      className="agent-quick-menu show"
      id="agentQuickMenu"
      data-testid="agent-quick-menu"
      role="menu"
      aria-label="快捷操作"
      onClick={(e) => e.stopPropagation()}
    >
      <label className="agent-command-search" htmlFor="agentQuickSearch">
        <Icon name="optimize" />
        <input
          id="agentQuickSearch"
          type="search"
          autoComplete="off"
          spellCheck={false}
          placeholder="搜索任务、技能或结果…"
          aria-label="搜索快捷任务"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
      </label>
      <div className="agent-command-summary" id="agentQuickSummary">
        {query.trim() ? `${items.length} 项匹配` : `${items.length} 项可用任务`}
      </div>
      <div className="agent-command-results" id="agentQuickItems" role="listbox" aria-label="快捷任务结果">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className="agent-command-item"
            role="option"
            data-quick-command="1"
            onClick={() => onPick(item.prompt)}
          >
            <Icon name="note" />
            <span className="agent-command-copy">
              <strong>{item.title}</strong>
              <small>{item.subtitle}</small>
            </span>
            <span className="agent-command-group">推荐操作</span>
          </button>
        ))}
      </div>
      <div className={`agent-command-empty${items.length ? '' : ' show'}`} id="agentQuickEmpty" role="status">
        没有匹配的任务，换个关键词试试。
      </div>
    </div>
  )
}

export function AgentSlashMenu({
  items,
  onPick,
}: {
  items: CapabilityItem[]
  onPick: (item: CapabilityItem) => void
}) {
  return (
    <div className="agent-slash-menu show" data-testid="agent-slash-menu" role="listbox" aria-label="技能快捷引用">
      {items.length === 0 ? (
        <div className="agent-pop-empty">没有匹配的技能</div>
      ) : items.map((item) => (
        <button
          key={item.id}
          type="button"
          className="agent-slash-item"
          onMouseDown={(e) => { e.preventDefault(); onPick(item) }}
        >
          <span className="slash-cmd">/{item.name || item.id}</span>
          <span className="slash-title">{item.description || '技能'}</span>
        </button>
      ))}
    </div>
  )
}
