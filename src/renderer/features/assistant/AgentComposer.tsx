import { useEffect, useMemo, useRef, useState } from 'react'
import { selectActiveAttachments, selectActiveComposer, useAppStore } from '../../app/store'
import { getSessionSlice } from './store-session'
import { buildContextUsageViewModel } from '../../../domain/agent-context-usage'
import { Icon } from '../../app/Icon'
import { getAtContext, insertAtReference } from './atContext'
import { fileTitle, recentFileSuggestions } from './fileSuggestions'
import {
  AgentKnowledgeMenu,
  AgentModelMenu,
  AgentQuickMenu,
  AgentSlashMenu,
} from './AgentComposerMenus'

export function AgentComposer({
  extraClass = '',
  surface = 'assistant',
  launchEmpty = false,
}: {
  extraClass?: string
  /** 助理主列 vs 工作台 task-room 对话；后者不挂载 Ctrl+K 快捷任务 */
  surface?: 'assistant' | 'workbench'
  /** 助手空态首屏 composer：对齐 f6ad048 launch-state 工具条与 placeholder */
  launchEmpty?: boolean
}) {
  const composer = useAppStore(surface === 'workbench'
    ? (s) => s.workbenchDialogue.composer
    : selectActiveComposer)
  const attachments = useAppStore(surface === 'workbench'
    ? (s) => s.workbenchDialogue.attachments
    : selectActiveAttachments)
  const addComposerAttachment = useAppStore(surface === 'workbench'
    ? (s) => s.addWorkbenchAttachment
    : (s) => s.addComposerAttachment)
  const removeComposerAttachment = useAppStore(surface === 'workbench'
    ? (s) => s.removeWorkbenchAttachment
    : (s) => s.removeComposerAttachment)
  const setComposer = useAppStore(surface === 'workbench'
    ? (s) => s.setWorkbenchComposer
    : (s) => s.setComposer)
  const sendMessage = useAppStore(surface === 'workbench'
    ? (s) => s.sendWorkbenchMessage
    : (s) => s.sendMessage)
  const fileCatalog = useAppStore((s) => s.fileCatalog)
  const isGenerating = useAppStore((s) => s.isGenerating)
  const stopGenerate = useAppStore((s) => s.stopGenerate)
  const models = useAppStore((s) => s.assistantModels)
  const modelGroups = useAppStore((s) => s.assistantModelGroups)
  const modelId = useAppStore((s) => s.assistantModelId)
  const assistantContextInfo = useAppStore((s) => s.assistantContextInfo)
  const activeMessages = useAppStore((s) => getSessionSlice(s.sessionStates, s.activeSessionId).messages)
  const setAssistantModel = useAppStore((s) => s.setAssistantModel)
  const skills = useAppStore((s) => s.assistantSkills)
  const knowledgeWiki = useAppStore((s) => s.knowledgeWiki)
  const knowledgeOkf = useAppStore((s) => s.knowledgeOkf)
  const sessions = useAppStore((s) => s.sessions)
  const activeSessionId = useAppStore((s) => s.activeSessionId)
  const toggleSessionKnowledge = useAppStore((s) => s.toggleSessionKnowledge)
  const clearSessionKnowledge = useAppStore((s) => s.clearSessionKnowledge)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [atActive, setAtActive] = useState(0)
  const [menu, setMenu] = useState<'model' | 'knowledge' | 'quick' | null>(null)
  const [quickQuery, setQuickQuery] = useState('')
  const allowQuickMenu = surface === 'assistant'
  const active = sessions.find((item) => item.id === activeSessionId)
  const showKnowledgeToolbar = Boolean(active?.expertId)
  const placeholder = surface === 'workbench'
    ? '补充任务要求或材料… @ 选文件'
    : launchEmpty
      ? '给 KnowMe 发送消息…'
      : '说说你想做什么，或问公司约定… @ 选文件'

  const knowledge = [...knowledgeWiki, ...knowledgeOkf]
  const refs = active?.knowledgeRefs || []
  const knowledgeLabel = refs.length ? `${refs.length} 个知识库` : '默认知识库'

  const atContext = useMemo(() => {
    const caret = textareaRef.current?.selectionStart ?? composer.length
    return getAtContext(composer, caret)
  }, [composer])
  const atSuggestions = useMemo(() => {
    if (!atContext) return []
    return recentFileSuggestions(fileCatalog, atContext.query)
  }, [atContext, fileCatalog])
  const slashOpen = composer.trimStart().startsWith('/')
  const slashQuery = slashOpen ? composer.trimStart().slice(1).toLowerCase() : ''
  const slashItems = skills.filter((item) => {
    if (!slashQuery) return true
    return `${item.name || ''} ${item.id} ${item.description || ''}`.toLowerCase().includes(slashQuery)
  })
  const historyTokens = Math.ceil(
    activeMessages.map((item) => item.text || '').join('\n').length / 4,
  )
  const activeModel = models.find((item) => item.id === modelId)
  const contextUsage = buildContextUsageViewModel(
    assistantContextInfo,
    activeModel?.contextWindow || 32768,
    historyTokens,
  )

  useEffect(() => { setAtActive(0) }, [atContext?.query])

  useEffect(() => {
    if (!launchEmpty) return
    requestAnimationFrame(() => textareaRef.current?.focus())
  }, [launchEmpty, activeSessionId])

  useEffect(() => {
    if (!allowQuickMenu) return
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setMenu((current) => (current === 'quick' ? null : 'quick'))
        return
      }
      if (e.key === 'Escape') setMenu(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [allowQuickMenu])

  useEffect(() => {
    if (!menu) return
    function onPointerDown() { setMenu(null) }
    document.addEventListener('click', onPointerDown)
    return () => document.removeEventListener('click', onPointerDown)
  }, [menu])

  function pickFile(note: { id: string; title?: string; preview?: string }) {
    if (!atContext) return
    const title = fileTitle(note)
    const { next, caret } = insertAtReference(composer, atContext, title)
    setComposer(next)
    requestAnimationFrame(() => {
      const el = textareaRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(caret, caret)
    })
  }

  function insertSkill(item: { id: string; name?: string }) {
    setComposer(`/${item.name || item.id} `)
    setMenu(null)
  }

  return (
    <>
    {allowQuickMenu && menu === 'quick' ? (
      <AgentQuickMenu
        query={quickQuery}
        onQueryChange={setQuickQuery}
        onPick={(prompt) => {
          setComposer(prompt)
          setMenu(null)
          sendMessage(prompt)
        }}
      />
    ) : null}
    <form
      className={`agent-composer${extraClass ? ` ${extraClass}` : ''}`}
      id="agentComposer"
      onClick={(e) => e.stopPropagation()}
      onSubmit={(e) => { e.preventDefault(); if (isGenerating) stopGenerate(); else sendMessage() }}
    >
      <div className="agent-input-wrap">
        {atContext ? (
          <div className="agent-at-menu show" role="listbox" aria-label="选择文件" data-testid="agent-at-menu">
            {atSuggestions.length === 0 ? (
              <div className="agent-at-empty">没有找到这个文件</div>
            ) : atSuggestions.map((note, index) => (
              <button
                key={note.id}
                type="button"
                className={`agent-at-item${index === atActive ? ' active' : ''}`}
                role="option"
                aria-selected={index === atActive}
                data-testid="agent-at-item"
                onMouseDown={(e) => { e.preventDefault(); pickFile(note) }}
              >
                <span className="at-name">{fileTitle(note)}</span>
                {note.project ? <span className="at-project">{note.project}</span> : null}
              </button>
            ))}
          </div>
        ) : null}
        {slashOpen ? (
          <AgentSlashMenu items={slashItems} onPick={insertSkill} />
        ) : null}
        <textarea
          ref={textareaRef}
          id="agentInput"
          rows={2}
          placeholder={placeholder}
          spellCheck={false}
          value={composer}
          onChange={(e) => setComposer(e.target.value)}
          onKeyDown={(e) => {
            if (atContext && atSuggestions.length > 0) {
              if (e.key === 'ArrowDown') { e.preventDefault(); setAtActive((i) => (i + 1) % atSuggestions.length); return }
              if (e.key === 'ArrowUp') { e.preventDefault(); setAtActive((i) => (i - 1 + atSuggestions.length) % atSuggestions.length); return }
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); pickFile(atSuggestions[atActive]); return }
              if (e.key === 'Escape') {
                e.preventDefault()
                setComposer(composer.slice(0, atContext.start) + composer.slice(atContext.end))
                return
              }
            }
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
          }}
        />
      </div>
      <div className="agent-toolbar">
        <input
          ref={fileRef}
          className="agent-file-input"
          type="file"
          multiple
          aria-hidden="true"
          onChange={(e) => {
            const files = [...(e.target.files || [])]
            if (!files.length) return
            for (const file of files.slice(0, 3)) {
              const reader = new FileReader()
              reader.onload = () => {
                addComposerAttachment({
                  name: file.name,
                  text: typeof reader.result === 'string' ? reader.result.slice(0, 12000) : undefined,
                })
              }
              reader.readAsText(file)
            }
            e.target.value = ''
          }}
        />
        {allowQuickMenu ? (
          <div className="ai-menu-wrap">
            <button
              type="button"
              className="agent-menu-trigger icon-only"
              id="agentQuickBtn"
              data-testid="agent-quick-btn"
              title="快捷操作（Ctrl+K）"
              aria-label="快捷操作"
              aria-expanded={menu === 'quick'}
              aria-controls="agentQuickMenu"
              onClick={() => setMenu(menu === 'quick' ? null : 'quick')}
            >
              <Icon name="optimize" />
            </button>
          </div>
        ) : null}
        <div className="ai-menu-wrap">
        <button
          type="button"
          className={`agent-model-btn${contextUsage.ratio > 0.5 ? contextUsage.ratio > 0.85 ? ' usage-danger' : ' usage-warn' : contextUsage.ratio > 0 ? ' usage-safe' : ''}`}
          data-testid="agent-model-btn"
          title="选择模型"
          aria-label="选择模型"
          aria-expanded={menu === 'model'}
          style={contextUsage.ratio > 0 ? { ['--model-usage-progress' as string]: String(Math.max(contextUsage.ratio, 0.04)) } : undefined}
          onClick={() => setMenu(menu === 'model' ? null : 'model')}
        >
          <span id="agentModelLabel">{models.find((item) => item.id === modelId)?.label || modelId || '模型'}</span>
          <span
            className={`agent-model-usage${contextUsage.compacted ? ' compacted' : ''}`}
            id="agentModelUsage"
            hidden={!contextUsage.compacted}
            title={contextUsage.compacted ? contextUsage.note || '已压缩上下文' : '查看上下文占用'}
          >
            {contextUsage.compacted ? '已压缩' : ''}
          </span>
          <span className="agent-model-caret">▾</span>
        </button>
        </div>
        {showKnowledgeToolbar ? (
          <button
            type="button"
            className="agent-knowledge-btn"
            id="agentSessionKnowledgeBtn"
            title="选择本次对话知识库"
            aria-label="选择本次对话知识库"
            aria-expanded={menu === 'knowledge'}
            aria-controls="agentSessionKnowledgeMenu"
            onClick={() => setMenu(menu === 'knowledge' ? null : 'knowledge')}
          >
            <Icon name="bookOpen" />
            <span id="agentSessionKnowledgeLabel">{knowledgeLabel}</span>
            <span className="agent-model-caret">▾</span>
          </button>
        ) : null}
        <div style={{ flex: 1 }} />
        <button
          type="button"
          className={`agent-go agent-attach${attachments.length ? ' has-attachment' : ''}`}
          title="添加文件"
          aria-label="添加文件"
          onClick={() => fileRef.current?.click()}
        >
          <Icon name="paperclip" />
        </button>
        <button
          type="submit"
          className={`agent-go${isGenerating ? ' is-running' : ''}`}
          aria-label={isGenerating ? '停止生成' : '发送'}
        >
          <Icon name={isGenerating ? 'stop' : 'send'} />
        </button>
      </div>
      {attachments.length ? (
        <div className="agent-composer-attachments" data-testid="agent-attachments">
          {attachments.map((file) => (
            <div key={file.name} className="agent-attachment">
              <span className="attachment-name">{file.name}</span>
              <button type="button" className="agent-attachment-remove" aria-label={`移除 ${file.name}`} onClick={() => removeComposerAttachment(file.name)}>×</button>
            </div>
          ))}
        </div>
      ) : null}
      {menu === 'model' ? (
        <AgentModelMenu
          groups={modelGroups}
          presets={models}
          modelId={modelId}
          contextInfo={assistantContextInfo}
          historyTokens={historyTokens}
          fallbackLimit={activeModel?.contextWindow || 32768}
          onPick={(id) => { void setAssistantModel(id); setMenu(null) }}
        />
      ) : null}
      {showKnowledgeToolbar && menu === 'knowledge' ? (
        <AgentKnowledgeMenu
          knowledge={knowledge}
          refs={refs}
          onToggle={(path) => void toggleSessionKnowledge(path)}
          onClear={() => void clearSessionKnowledge()}
        />
      ) : null}
    </form>
    </>
  )
}
