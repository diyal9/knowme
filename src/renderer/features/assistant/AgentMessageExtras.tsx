import { useMemo, useState } from 'react'
import type { ChatMessage } from '../../../shared/api'
import { buildGroundingMetaView, formatGroundingSourceLine } from '../../../domain/agent-grounding-meta'
import { useAppStore } from '../../app/store'
import { buildKnowledgeSelectionOptions } from '../../../shared/knowledge-selection'

export function AgentGroundingMeta({ message }: { message: ChatMessage }) {
  const view = buildGroundingMetaView(message.groundingStatus)
  const knowledgeProviders = useAppStore((state) => state.knowledgeProviders)
  const [sourceOpen, setSourceOpen] = useState(false)
  const ragRefs = Array.from(String(message.text || '').matchAll(/rag:([^\s\[]+)/g)).map((match) => match[0])
  const describeRagRef = (ref: string) => {
    const [, providerId, collectionId] = ref.match(/^rag:([^:]+):(.+)$/) || []
    const provider = knowledgeProviders.find((item) => item.id === providerId)
    const collection = provider?.collections?.find((item) => String(item.id) === collectionId)
    return {
      label: collection?.name || collectionId || 'RAG Dataset',
      provider: provider?.displayName || providerId || 'RAG',
      ref,
    }
  }
  if (!view || message.streaming) return null
  return (
    <div className={`agent-grounding-meta ${view.className}`} role="status">
      <span className="agent-grounding-badge">{view.badge}</span>
      {view.violationText ? <p className="agent-grounding-note">{view.violationText}</p> : null}
      {ragRefs.length ? (
        <div className="agent-rag-sources">
          <button type="button" className="agent-rag-source-trigger" onClick={() => setSourceOpen(true)}>
            <span aria-hidden="true">⌁</span> 查看 RAG 来源（{ragRefs.length}）
          </button>
          {sourceOpen ? (
            <div className="agent-rag-source-backdrop" role="presentation" onMouseDown={() => setSourceOpen(false)}>
              <section className="agent-rag-source-dialog" role="dialog" aria-modal="true" aria-label="RAG 来源详情" onMouseDown={(event) => event.stopPropagation()}>
                <div className="agent-rag-source-dialog-head">
                  <div>
                    <span className="agent-rag-source-kicker">RAG 来源</span>
                    <h3>本次回答使用的 Dataset</h3>
                  </div>
                  <button type="button" aria-label="关闭来源详情" onClick={() => setSourceOpen(false)}>×</button>
                </div>
                <div className="agent-rag-source-list">
                  {ragRefs.map((ref, index) => {
                    const item = describeRagRef(ref)
                    return (
                      <div className="agent-rag-source-item" key={`${ref}-${index}`}>
                        <span className="agent-rag-source-index">{index + 1}</span>
                        <div>
                          <strong>{item.label}</strong>
                          <span>{item.provider}</span>
                          <code>{item.ref}</code>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <p className="agent-rag-source-hint">点击来源可查看 Dataset 与原始引用；正文查看仍以 RAG 服务返回的文档内容为准。</p>
              </section>
            </div>
          ) : null}
        </div>
      ) : null}
      {view.sources.length ? (
        <details className="agent-grounding-sources">
          <summary>{`查看来源（${view.sources.length}）`}</summary>
          <ul>
            {view.sources.slice(0, 5).map((source, index) => (
              <li key={`${source.tool}-${index}`}>
                <span className="agent-grounding-source-name">{formatGroundingSourceLine(source).split(' · ')[0]}</span>
                {' · '}
                {formatGroundingSourceLine(source).split(' · ')[1]}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  )
}

export function AgentStructuredUi({
  message,
  onPick,
  interactive = true,
}: {
  message: ChatMessage
  onPick: (payload: string, needsInput: boolean) => void
  interactive?: boolean
}) {
  const bars = message.structuredUi || []
  const [knowledgeOpen, setKnowledgeOpen] = useState(false)
  const knowledgeProviders = useAppStore((state) => state.knowledgeProviders)
  const sessions = useAppStore((state) => state.sessions)
  const activeSessionId = useAppStore((state) => state.activeSessionId)
  const toggleSessionKnowledge = useAppStore((state) => state.toggleSessionKnowledge)
  const clearSessionKnowledge = useAppStore((state) => state.clearSessionKnowledge)
  const activeSession = sessions.find((session) => session.id === activeSessionId)
  const knowledgeRefs = activeSession?.knowledgeRefs || []
  const knowledgeOptions = useMemo(() => buildKnowledgeSelectionOptions(knowledgeProviders), [knowledgeProviders])
  const selectedKnowledge = knowledgeOptions.filter((item) => knowledgeRefs.includes(item.id))
  if (!bars.length || message.streaming) return null
  const chosenIndex = message.suggestionChosenIndex ?? -1
  const decided = chosenIndex >= 0
  const available = interactive && !decided
  return (
    <div className="agent-structured-ui" data-structured-ui="1">
      {bars.map((bar, barIndex) => {
        return (
          <div
            key={`${bar.title}-${barIndex}`}
            className={`agent-suggest structured-choice${decided ? ' is-decided' : ''}${!interactive ? ' is-expired' : ''}`}
            role="group"
            aria-label={`${bar.title || '结构化选择'}，${decided ? '已选择' : interactive ? '选择一项' : '已过期'}`}
          >
            <div className="agent-suggest-head">
              <div className="agent-suggest-title">{bar.title || '结构化选择'}</div>
              <span>{decided ? '已选择' : interactive ? '选择一项' : '已过期'}</span>
            </div>
            {interactive && !decided && activeSession ? (
              <div className="agent-suggest-knowledge" data-testid="suggestion-knowledge-scope">
                <span>知识范围：{knowledgeRefs.length ? (selectedKnowledge.length ? selectedKnowledge.map((item) => item.name).join('、') : `${knowledgeRefs.length} 个已选范围`) : '跟随默认'}</span>
                {knowledgeOptions.length ? (
                  <button type="button" onClick={() => setKnowledgeOpen((open) => !open)} aria-expanded={knowledgeOpen}>
                    {knowledgeOpen ? '收起' : '调整知识库'}
                  </button>
                ) : null}
                {knowledgeOpen ? (
                  <div className="agent-suggest-knowledge-options" role="group" aria-label="执行前调整知识库">
                    <button type="button" className={!knowledgeRefs.length ? 'is-selected' : ''} onClick={() => { void clearSessionKnowledge() }}>
                      跟随默认
                    </button>
                    {knowledgeOptions.map((item) => (
                      <button key={item.id} type="button" className={knowledgeRefs.includes(item.id) ? 'is-selected' : ''} onClick={() => { void toggleSessionKnowledge(item.id) }}>
                        {item.name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="agent-suggest-list">
              {bar.items.map((item, index) => {
                const selected = decided && index === chosenIndex
                const needsInput = item.action === 'fill' || /补充|填写|输入|说明|描述|背景|上下文|澄清|手动/.test(`${item.label} ${item.description || ''} ${item.payload || ''}`)
                return (
                  <button
                    key={`${item.id || item.label}-${index}`}
                    type="button"
                    className={`agent-suggest-item${selected ? ' is-selected' : ''}`}
                    disabled={!available}
                    onClick={() => onPick(item.payload || item.label, needsInput)}
                  >
                    <span className="sug-choice" aria-hidden="true">{index + 1}</span>
                    <span className="sug-copy">
                      <strong>{item.label}</strong>
                      {item.description ? <span className="sug-desc">{item.description}</span> : null}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function AgentFollowUps({
  body,
  userInput,
  onPick,
}: {
  body: string
  userInput?: string
  onPick: (prompt: string) => void
}) {
  // 底部建议必须来自模型明确声明的 structuredUi；不再根据正文关键词推测操作。
  void body
  void userInput
  void onPick
  return null
}
