/**
 * 助手 composer：输入、附件、模型/知识库/快捷菜单与发送。
 * 不负责消息列表与流式气泡。
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
  placeholder: placeholderOverride,
  onSubmit,
}: {
  extraClass?: string
  /** 助理主列 vs 工作台 task-room 对话；后者不挂载 Ctrl+K 快捷任务 */
  surface?: 'assistant' | 'workbench'
  /** 助手空态首屏 composer：对齐 f6ad048 launch-state 工具条与 placeholder */
  launchEmpty?: boolean
  /** 任务房可按当前运行态提供行动提示；助手页面不传此项，行为保持不变。 */
  placeholder?: string
  /** 任务房需要把同一输入框接到人类确认 API 时，可接管默认发送。 */
  onSubmit?: (text: string) => void | Promise<void>
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
  const loadFileCatalog = useAppStore((s) => s.loadFileCatalog)
  const isGenerating = useAppStore((s) => s.isGenerating)
  const stopGenerate = useAppStore((s) => s.stopGenerate)
  const models = useAppStore((s) => s.assistantModels)
  const modelGroups = useAppStore((s) => s.assistantModelGroups)
  const modelId = useAppStore((s) => s.assistantModelId)
  const assistantContextInfo = useAppStore((s) => s.assistantContextInfo)
  // 跳过 streaming 正文：chunk 刷新时返回值不变，Composer 不跟着每字重渲
  const historyTokens = useAppStore((s) => {
    const msgs = getSessionSlice(s.sessionStates, s.activeSessionId).messages
    let len = 0
    for (const item of msgs) {
      if (item.streaming || item.thinking) continue
      len += String(item.text || '').length
    }
    return Math.ceil(len / 4)
  })
  const setAssistantModel = useAppStore((s) => s.setAssistantModel)
  const skills = useAppStore((s) => s.assistantSkills)
  const knowledgeWiki = useAppStore((s) => s.knowledgeWiki)
  const knowledgeOkf = useAppStore((s) => s.knowledgeOkf)
  const knowledgeProviders = useAppStore((s) => s.knowledgeProviders)
  const loadKnowledge = useAppStore((s) => s.loadKnowledge)
  const sessions = useAppStore((s) => s.sessions)
  const activeSessionId = useAppStore((s) => s.activeSessionId)
  const toggleSessionKnowledge = useAppStore((s) => s.toggleSessionKnowledge)
  const clearSessionKnowledge = useAppStore((s) => s.clearSessionKnowledge)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [atActive, setAtActive] = useState(0)
  const [slashActive, setSlashActive] = useState(0)
  const [slashDismissedValue, setSlashDismissedValue] = useState<string | null>(null)
  const [menu, setMenu] = useState<'model' | 'knowledge' | 'quick' | null>(null)
  const [previewImage, setPreviewImage] = useState<{ name: string; dataUrl: string } | null>(null)
  const allowQuickMenu = surface === 'assistant'
  const active = sessions.find((item) => item.id === activeSessionId)
  const recommendationContext = useAppStore((s) => {
    const messages = getSessionSlice(s.sessionStates, s.activeSessionId).messages
    return messages.slice(-4).map((item) => `${item.role === 'assistant' ? '助手' : '用户'}：${String(item.text || '')}`).join('\n').slice(-8000)
  })
  const showKnowledgeToolbar = Boolean(active?.expertId)
  const assistantPlaceholder = 'Ctrl + k智能推荐, / 调用技能'
  const placeholder = placeholderOverride || (surface === 'workbench'
    ? '补充任务要求或材料… @ 选文件'
    : launchEmpty ? assistantPlaceholder : assistantPlaceholder)

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
  const slashOpen = composer.trimStart().startsWith('/') && composer !== slashDismissedValue
  const slashQuery = slashOpen ? composer.trimStart().slice(1).toLowerCase() : ''
  const slashItems = skills.filter((item) => item.installed !== false && item.enabled !== false).filter((item) => {
    if (!slashQuery) return true
    return `${item.name || ''} ${item.id} ${item.description || ''}`.toLowerCase().includes(slashQuery)
  })
  const activeModel = models.find((item) => item.id === modelId)
  const contextUsage = buildContextUsageViewModel(
    assistantContextInfo,
    activeModel?.contextWindow || 32768,
    historyTokens,
  )
  /* 空态/无用量不画环：0.04 下限会在底边漏一截 usage 色 */
  const showUsageRing = !launchEmpty && contextUsage.ratio > 0.02
  const usageTone = !showUsageRing
    ? ''
    : contextUsage.ratio > 0.85
      ? ' usage-danger'
      : contextUsage.ratio > 0.5
        ? ' usage-warn'
        : ' usage-safe'

  useEffect(() => { setAtActive(0) }, [atContext?.query])
  useEffect(() => { setSlashActive(0) }, [slashQuery])
  useEffect(() => {
    // `/技能` 是输入驱动的弹窗；一旦出现，关闭智能推荐/模型/知识库菜单，保持单弹窗。
    if (slashOpen && menu) setMenu(null)
  }, [slashOpen, menu])

  useLayoutEffect(() => {
    const node = textareaRef.current
    if (!node) return
    node.style.height = 'auto'
    node.style.height = `${Math.max(48, Math.min(node.scrollHeight, 180))}px`
  }, [composer])

  // @ 选文件时再拉目录，避免助理 mount 扫盘
  useEffect(() => {
    if (!atContext) return
    void loadFileCatalog()
  }, [atContext, loadFileCatalog])

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

  useEffect(() => {
    if (!slashOpen) return
    function onPointerDown(event: PointerEvent) {
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest('.agent-slash-menu') || target.closest('#agentInput')) return
      setSlashDismissedValue(composer)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [slashOpen, composer])

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

  function sendAndRefocus() {
    if (onSubmit) {
      if (!composer.trim() && !attachments.length) return
      void onSubmit(composer.trim())
    } else {
      sendMessage()
    }
    requestAnimationFrame(() => textareaRef.current?.focus())
  }

  function readAttachment(file: File) {
    if (file.type.startsWith('image/')) {
      if (file.size > 10 * 1024 * 1024) return
      const reader = new FileReader()
      reader.onload = () => addComposerAttachment({
        name: file.name || `pasted-image-${Date.now()}.png`,
        kind: 'image',
        mimeType: file.type,
        dataUrl: typeof reader.result === 'string' ? reader.result : undefined,
      })
      reader.readAsDataURL(file)
      return
    }
    const reader = new FileReader()
    reader.onload = () => addComposerAttachment({
      name: file.name,
      kind: 'text',
      text: typeof reader.result === 'string' ? reader.result.slice(0, 12000) : undefined,
    })
    reader.readAsText(file)
  }

  useEffect(() => {
    if (!previewImage) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPreviewImage(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [previewImage])

  const hasImageAttachment = attachments.some((file) => file.kind === 'image' && Boolean(file.dataUrl))

  return (
    <>
    {allowQuickMenu && menu === 'quick' && !slashOpen ? (
      <AgentQuickMenu
        context={recommendationContext || composer}
        onPick={(prompt) => {
          setComposer(prompt)
          setMenu(null)
          sendMessage(prompt)
        }}
      />
    ) : null}
    <form
      className={`agent-composer conversation-composer${hasImageAttachment ? ' has-image-attachment' : ''}${extraClass ? ` ${extraClass}` : ''}`}
      id="agentComposer"
      onClick={(e) => e.stopPropagation()}
      onSubmit={(e) => { e.preventDefault(); if (isGenerating) stopGenerate(); else sendAndRefocus() }}
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
          <AgentSlashMenu
            items={slashItems}
            query={slashQuery}
            activeIndex={slashActive}
            onActiveChange={setSlashActive}
            onQueryChange={(value) => {
              setComposer(`/${value}`)
            }}
            onPick={insertSkill}
          />
        ) : null}
        <textarea
          ref={textareaRef}
          id="agentInput"
          rows={2}
          placeholder={placeholder}
          spellCheck={false}
          value={composer}
          onPaste={(e) => {
            const item = [...(e.clipboardData?.items || [])].find((entry) => entry.type.startsWith('image/'))
            const file = item?.getAsFile()
            if (!file) return
            e.preventDefault()
            readAttachment(file)
          }}
          onChange={(e) => {
            setSlashDismissedValue(null)
            setComposer(e.target.value)
          }}
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
            if (e.key === 'Escape' && slashOpen) {
              e.preventDefault()
              setSlashDismissedValue(composer)
              return
            }
            if (slashOpen && slashItems.length > 0) {
              if (e.key === 'ArrowDown') { e.preventDefault(); setSlashActive((i) => (i + 1) % slashItems.length); return }
              if (e.key === 'ArrowUp') { e.preventDefault(); setSlashActive((i) => (i - 1 + slashItems.length) % slashItems.length); return }
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); insertSkill(slashItems[slashActive]); return }
            }
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAndRefocus() }
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
            for (const file of files.slice(0, 3)) readAttachment(file)
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
              title="智能推荐（Ctrl+K）"
              aria-label="智能推荐"
              aria-expanded={menu === 'quick'}
              aria-controls="agentQuickMenu"
              onClick={() => {
                if (slashOpen) setComposer('')
                setMenu(menu === 'quick' ? null : 'quick')
              }}
            >
              <Icon name="optimize" />
            </button>
          </div>
        ) : null}
        <div className="ai-menu-wrap">
        <button
          type="button"
          className={`agent-model-btn${usageTone}${showUsageRing ? ' has-usage' : ''}`}
          data-testid="agent-model-btn"
          title="选择模型"
          aria-label="选择模型"
          aria-expanded={menu === 'model'}
          style={showUsageRing ? { ['--model-usage-progress' as string]: String(contextUsage.ratio) } : undefined}
          onClick={() => setMenu(menu === 'model' ? null : 'model')}
        >
          {showUsageRing ? <span className="agent-model-usage-ring" aria-hidden="true" /> : null}
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
            onClick={() => {
              const next = menu === 'knowledge' ? null : 'knowledge'
              setMenu(next)
              if (next === 'knowledge') void loadKnowledge()
            }}
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
          className={`agent-go agent-send${isGenerating ? ' is-running' : ''}${composer.trim() || attachments.length ? ' is-ready' : ''}`}
          aria-label={isGenerating ? '停止生成' : '发送'}
        >
          <Icon name={isGenerating ? 'stop' : 'send'} />
        </button>
      </div>
      {attachments.length ? (
        <div className="agent-composer-attachments" data-testid="agent-attachments">
          {attachments.map((file) => (
            <div key={file.name} className={`agent-attachment${file.kind === 'image' && file.dataUrl ? ' is-image' : ''}`}>
              {file.kind === 'image' && file.dataUrl ? (
                <button
                  type="button"
                  className="agent-attachment-preview"
                  aria-label={`预览 ${file.name}`}
                  title="查看原图"
                  onClick={() => setPreviewImage({ name: file.name, dataUrl: file.dataUrl! })}
                >
                  <img src={file.dataUrl} alt={file.name} className="agent-attachment-thumb" />
                </button>
              ) : <span className="attachment-name">{file.name}</span>}
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
          providers={knowledgeProviders}
          refs={refs}
          onToggle={(path) => void toggleSessionKnowledge(path)}
          onClear={() => void clearSessionKnowledge()}
        />
      ) : null}
    </form>
    {previewImage ? (
      <div className="agent-image-preview" role="dialog" aria-modal="true" aria-label={`预览 ${previewImage.name}`} onClick={() => setPreviewImage(null)}>
        <button type="button" className="agent-image-preview-close" aria-label="关闭图片预览" onClick={() => setPreviewImage(null)}>×</button>
        <img src={previewImage.dataUrl} alt={previewImage.name} onClick={(event) => event.stopPropagation()} />
      </div>
    ) : null}
    </>
  )
}
