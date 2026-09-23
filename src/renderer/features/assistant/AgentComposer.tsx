/**
 * 助手 composer：输入、附件、模型/知识库/快捷菜单与发送。
 * 不负责消息列表与流式气泡。
 */
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent as ReactClipboardEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { selectActiveAttachments, selectActiveComposer, useAppStore } from '../../app/store'
import { getSessionSlice } from './store-session'
import { buildContextUsageViewModel } from '../../../domain/agent-context-usage'
import { Icon } from '../../app/Icon'
import { getAtContext, insertAtReference } from './atContext'
import { getSlashContext, insertSlashSkill, removeSlashSkillMarker } from './slashContext'
import { getHashContext, insertHashAgent, removeHashAgentMarker } from './hashContext'
import { fileTitle, recentFileSuggestions } from './fileSuggestions'
import {
  AgentKnowledgeMenu,
  AgentModelMenu,
  AgentQuickMenu,
  AgentSlashMenu,
  buildAgentSlashMenuGroups,
  buildAgentSlashNavigationTargets,
  type AgentSlashNavigationTarget,
} from './AgentComposerMenus'
import { buildKnowledgeSelectionOptions } from '../../../shared/knowledge-selection'
import { SkillTokenEditor, type SkillTokenEditorHandle } from './SkillTokenEditor'
import type { CapabilityItem, ManagedAgentTarget } from '../../../shared/api'

const EMPTY_SKILL_REFS: string[] = []

export function AgentComposer({
  extraClass = '',
  surface = 'assistant',
  launchEmpty = false,
  placeholder: placeholderOverride,
  onSubmit,
  allowSubmitWhileGenerating = false,
  allowEmptySubmit = false,
  agentTargets = [],
  selectedAgentTarget = null,
  onAgentTargetChange,
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
  /** 专家任务执行中允许继续提交补充；普通对话仍保留“发送即停止”的原有行为。 */
  allowSubmitWhileGenerating?: boolean
  /** 某些任务流需要把空提交交给业务层做即时校验（例如成果修改意见）。 */
  allowEmptySubmit?: boolean
  /** 能力管家任务房通过 # 在输入区选择本次训练或优化的 Agent。 */
  agentTargets?: ManagedAgentTarget[]
  selectedAgentTarget?: ManagedAgentTarget | null
  onAgentTargetChange?: (target: ManagedAgentTarget | null) => void | Promise<void>
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
  const selectedSkillRefs = useAppStore(surface === 'workbench'
    ? (s) => s.workbenchDialogue.skillRefs || EMPTY_SKILL_REFS
    : (s) => getSessionSlice(s.sessionStates, s.activeSessionId).skillRefs || EMPTY_SKILL_REFS)
  const setSelectedSkillRefs = useAppStore(surface === 'workbench'
    ? (s) => s.setWorkbenchSkillRefs
    : (s) => s.setComposerSkillRefs)
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
  const skillIdsByExpert = useAppStore((s) => s.assistantSkillIdsByExpert)
  const knowledgeProviders = useAppStore((s) => s.knowledgeProviders)
  const loadKnowledge = useAppStore((s) => s.loadKnowledge)
  const sessions = useAppStore((s) => s.sessions)
  const activeSessionId = useAppStore((s) => s.activeSessionId)
  const toggleSessionKnowledge = useAppStore((s) => s.toggleSessionKnowledge)
  const textareaRef = useRef<SkillTokenEditorHandle>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [composerCaret, setComposerCaret] = useState<number | null>(null)
  const [atActive, setAtActive] = useState(0)
  const [slashActiveTarget, setSlashActiveTarget] = useState<AgentSlashNavigationTarget | null>(null)
  const [slashExpandedCategory, setSlashExpandedCategory] = useState('')
  const [slashDismissedValue, setSlashDismissedValue] = useState<string | null>(null)
  const [slashMenuQuery, setSlashMenuQuery] = useState<string | null>(null)
  const [hashActiveTarget, setHashActiveTarget] = useState<AgentSlashNavigationTarget | null>(null)
  const [hashExpandedCategory, setHashExpandedCategory] = useState('')
  const [hashDismissedValue, setHashDismissedValue] = useState<string | null>(null)
  const [hashMenuQuery, setHashMenuQuery] = useState<string | null>(null)
  const [menu, setMenu] = useState<'model' | 'knowledge' | 'quick' | null>(null)
  const [previewImage, setPreviewImage] = useState<{ name: string; dataUrl: string } | null>(null)
  const allowQuickMenu = surface === 'assistant'
  const active = sessions.find((item) => item.id === activeSessionId)
  const recommendationContext = useAppStore((s) => {
    const messages = getSessionSlice(s.sessionStates, s.activeSessionId).messages
    return messages.slice(-4).map((item) => `${item.role === 'assistant' ? '助手' : '用户'}：${String(item.text || '')}`).join('\n').slice(-8000)
  })
  // 空白新对话也需要能先选知识库；知识库列表在点击入口时按需刷新。
  const showKnowledgeToolbar = surface === 'assistant' && Boolean(active)
  const assistantPlaceholder = 'Ctrl + k智能推荐, / 调用技能'
  const placeholder = placeholderOverride || (surface === 'workbench'
    ? '补充任务要求或材料… @ 选文件'
    : launchEmpty ? assistantPlaceholder : assistantPlaceholder)

  const knowledgeProviderOptions = useMemo(
    () => buildKnowledgeSelectionOptions(knowledgeProviders),
    [knowledgeProviders],
  )
  const refs = active?.knowledgeRefs || []
  const selectedKnowledgeNames = knowledgeProviderOptions
    .filter((item) => refs.includes(item.id))
    .map((item) => item.name)
  const knowledgeTitle = selectedKnowledgeNames.length
    ? `已选知识库：${selectedKnowledgeNames.join('、')}`
    : '选择本次对话知识库'

  const atContext = useMemo(() => {
    const caret = composerCaret ?? composer.length
    return getAtContext(composer, caret)
  }, [composer, composerCaret])
  const atSuggestions = useMemo(() => {
    if (!atContext) return []
    return recentFileSuggestions(fileCatalog, atContext.query)
  }, [atContext, fileCatalog])
  const slashContext = useMemo(() => {
    const caret = composerCaret ?? composer.length
    return getSlashContext(composer, caret)
  }, [composer, composerCaret])
  const slashOpen = Boolean(slashContext) && composer !== slashDismissedValue
  const slashQuery = slashOpen ? slashMenuQuery ?? slashContext?.query ?? '' : ''
  const slashInstalledItems = skills.filter((item) => item.installed !== false && item.enabled !== false)
  const selectedSkills = selectedSkillRefs.map((id) => {
    const item = slashInstalledItems.find((candidate) => candidate.id === id)
    return { id, name: item?.name || id }
  })
  const activeExpertId = String(active?.expertId || '').trim()
  const activeExpertSkillIds = new Set(activeExpertId ? skillIdsByExpert[activeExpertId] || [] : [])
  const slashCategoryOrder = new Map<string, number>()
  slashInstalledItems.forEach((item) => {
    const category = String(item.category || '').trim() || '其他'
    if (!slashCategoryOrder.has(category)) slashCategoryOrder.set(category, slashCategoryOrder.size)
  })
  const slashItems = slashInstalledItems.filter((item) => {
    if (!slashQuery) return item.favorite === true || activeExpertSkillIds.has(item.id)
    return `${item.name || ''} ${item.id} ${item.description || ''} ${item.category || ''}`.toLowerCase().includes(slashQuery)
  }).sort((a, b) => {
    const aCategory = String(a.category || '').trim() || '其他'
    const bCategory = String(b.category || '').trim() || '其他'
    return (slashCategoryOrder.get(aCategory) ?? 0) - (slashCategoryOrder.get(bCategory) ?? 0)
  })
  const slashGroups = buildAgentSlashMenuGroups(slashItems)
  const slashDefaultCategory = slashGroups[0]?.category || ''
  const effectiveSlashExpandedCategory = slashGroups.some((group) => group.category === slashExpandedCategory)
    ? slashExpandedCategory
    : slashDefaultCategory
  const slashNavigationTargets = buildAgentSlashNavigationTargets(slashGroups, effectiveSlashExpandedCategory)
  const slashResolvedActiveTarget = slashNavigationTargets.find((target) => (
    target.kind === slashActiveTarget?.kind
    && target.category === slashActiveTarget.category
    && (target.kind === 'category' || target.itemIndex === (slashActiveTarget.kind === 'item' ? slashActiveTarget.itemIndex : -1))
  )) || slashNavigationTargets[1] || slashNavigationTargets[0] || null
  const slashItemsKey = slashItems.map((item) => `${item.id}:${String(item.category || '')}`).join('\u0000')
  const hashContext = useMemo(() => {
    if (!agentTargets.length) return null
    const caret = composerCaret ?? composer.length
    return getHashContext(composer, caret)
  }, [agentTargets.length, composer, composerCaret])
  const hashOpen = Boolean(hashContext) && composer !== hashDismissedValue
  const hashQuery = hashOpen ? hashMenuQuery ?? hashContext?.query ?? '' : ''
  const hashItems = useMemo<CapabilityItem[]>(() => agentTargets
    .filter((item) => !hashQuery || `${item.name} ${item.id} ${item.source}`.toLowerCase().includes(hashQuery.toLowerCase()))
    .map((item) => ({
      id: item.id,
      kind: 'expert',
      name: item.name,
      installed: true,
      source: item.source,
      version: item.version,
      category: item.ownership === 'system' ? '系统 Agent'
        : item.ownership === 'organization' ? '组织 Agent' : '我的 Agent',
      description: `${item.id}${item.version ? ` · v${item.version}` : ''}`,
    })), [agentTargets, hashQuery])
  const hashGroups = buildAgentSlashMenuGroups(hashItems)
  const hashDefaultCategory = hashGroups[0]?.category || ''
  const effectiveHashExpandedCategory = hashGroups.some((group) => group.category === hashExpandedCategory)
    ? hashExpandedCategory
    : hashDefaultCategory
  const hashNavigationTargets = buildAgentSlashNavigationTargets(hashGroups, effectiveHashExpandedCategory)
  const hashResolvedActiveTarget = hashNavigationTargets.find((target) => (
    target.kind === hashActiveTarget?.kind
    && target.category === hashActiveTarget.category
    && (target.kind === 'category' || target.itemIndex === (hashActiveTarget.kind === 'item' ? hashActiveTarget.itemIndex : -1))
  )) || hashNavigationTargets[1] || hashNavigationTargets[0] || null
  const hashItemsKey = hashItems.map((item) => `${item.id}:${String(item.category || '')}`).join('\u0000')
  const selectedAgentTokens = selectedAgentTarget ? [{ id: selectedAgentTarget.id, name: selectedAgentTarget.name }] : []
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
  useEffect(() => { setSlashMenuQuery(null) }, [slashContext?.start, slashContext?.end, slashContext?.query])
  useEffect(() => { setHashMenuQuery(null) }, [hashContext?.start, hashContext?.end, hashContext?.query])
  useEffect(() => {
    const firstGroup = slashGroups[0]
    setSlashExpandedCategory(firstGroup?.category || '')
    setSlashActiveTarget(firstGroup?.items[0]
      ? { kind: 'item', category: firstGroup.category, itemIndex: firstGroup.items[0].index }
      : firstGroup
        ? { kind: 'category', category: firstGroup.category }
        : null)
  }, [slashQuery, slashItemsKey])
  useEffect(() => {
    const firstGroup = hashGroups[0]
    setHashExpandedCategory(firstGroup?.category || '')
    setHashActiveTarget(firstGroup?.items[0]
      ? { kind: 'item', category: firstGroup.category, itemIndex: firstGroup.items[0].index }
      : firstGroup
        ? { kind: 'category', category: firstGroup.category }
        : null)
  }, [hashQuery, hashItemsKey])
  useEffect(() => {
    // `/技能` 与 `#Agent` 都由输入驱动；出现时关闭其他菜单，保持单弹窗。
    if ((slashOpen || hashOpen) && menu) setMenu(null)
  }, [slashOpen, hashOpen, menu])

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
    if (!slashOpen && !hashOpen) return
    function onPointerDown(event: PointerEvent) {
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest('.agent-slash-menu') || target.closest('#agentInput')) return
      if (slashOpen) setSlashDismissedValue(composer)
      if (hashOpen) setHashDismissedValue(composer)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [slashOpen, hashOpen, composer])

  function pickFile(note: { id: string; title?: string; preview?: string }) {
    if (!atContext) return
    const title = fileTitle(note)
    const { next, caret } = insertAtReference(composer, atContext, title)
    setComposerCaret(caret)
    setComposer(next)
    requestAnimationFrame(() => {
      const el = textareaRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(caret, caret)
    })
  }

  function insertSkill(item: { id: string; name?: string }) {
    if (!slashContext) return
    const id = String(item.id || '').trim()
    if (!id) return
    const name = String(item.name || id).trim()
    const { next, caret } = insertSlashSkill(composer, slashContext, name)
    if (!selectedSkillRefs.includes(id)) setSelectedSkillRefs([...selectedSkillRefs, id])
    setComposerCaret(caret)
    setComposer(next)
    setSlashDismissedValue(null)
    setSlashMenuQuery(null)
    setMenu(null)
    requestAnimationFrame(() => {
      const node = textareaRef.current
      node?.focus()
      node?.setSelectionRange(caret, caret)
    })
  }

  function removeSkill(skill: { id: string; name: string }) {
    setSelectedSkillRefs(selectedSkillRefs.filter((id) => id !== skill.id))
    const { next, caret } = removeSlashSkillMarker(composer, skill.name)
    setComposerCaret(caret)
    if (next !== composer) setComposer(next)
    setSlashDismissedValue(null)
    setSlashMenuQuery(null)
    requestAnimationFrame(() => {
      const node = textareaRef.current
      node?.focus()
      node?.setSelectionRange(caret, caret)
    })
  }

  function insertAgentTarget(item: CapabilityItem) {
    if (!hashContext) return
    const target = agentTargets.find((candidate) => candidate.id === item.id)
    if (!target) return
    const { next, caret } = insertHashAgent(composer, hashContext, target.name)
    setComposerCaret(caret)
    setComposer(next)
    setHashDismissedValue(null)
    setHashMenuQuery(null)
    setMenu(null)
    void onAgentTargetChange?.(target)
    requestAnimationFrame(() => {
      const node = textareaRef.current
      node?.focus()
      node?.setSelectionRange(caret, caret)
    })
  }

  function removeAgentTarget(agent: { id: string; name: string }) {
    const { next, caret } = removeHashAgentMarker(composer, agent.name)
    setComposerCaret(caret)
    if (next !== composer) setComposer(next)
    setHashDismissedValue(null)
    setHashMenuQuery(null)
    void onAgentTargetChange?.(null)
    requestAnimationFrame(() => {
      const node = textareaRef.current
      node?.focus()
      node?.setSelectionRange(caret, caret)
    })
  }

  function activateSlashCategory(category: string) {
    setSlashExpandedCategory(category)
    setSlashActiveTarget({ kind: 'category', category })
  }

  function handleSlashNavigationKey(key: string): boolean {
    if (!slashOpen || !slashResolvedActiveTarget || !slashNavigationTargets.length) return false
    const currentIndex = Math.max(0, slashNavigationTargets.findIndex((target) => (
      target.kind === slashResolvedActiveTarget.kind
      && target.category === slashResolvedActiveTarget.category
      && (target.kind === 'category' || target.itemIndex === (slashResolvedActiveTarget.kind === 'item' ? slashResolvedActiveTarget.itemIndex : -1))
    )))

    if (key === 'ArrowDown' || key === 'ArrowUp') {
      const delta = key === 'ArrowDown' ? 1 : -1
      const nextIndex = (currentIndex + delta + slashNavigationTargets.length) % slashNavigationTargets.length
      setSlashActiveTarget(slashNavigationTargets[nextIndex])
      return true
    }

    if (key === 'ArrowRight') {
      if (slashResolvedActiveTarget.kind === 'category') {
        if (effectiveSlashExpandedCategory !== slashResolvedActiveTarget.category) {
          activateSlashCategory(slashResolvedActiveTarget.category)
        } else {
          const firstItem = slashGroups.find((group) => group.category === slashResolvedActiveTarget.category)?.items[0]
          if (firstItem) setSlashActiveTarget({ kind: 'item', category: slashResolvedActiveTarget.category, itemIndex: firstItem.index })
        }
      }
      return true
    }

    if (key === 'ArrowLeft') {
      if (slashResolvedActiveTarget.kind === 'item') {
        setSlashActiveTarget({ kind: 'category', category: slashResolvedActiveTarget.category })
      }
      return true
    }

    if (key === 'Enter') {
      if (slashResolvedActiveTarget.kind === 'category') {
        activateSlashCategory(slashResolvedActiveTarget.category)
      } else {
        const item = slashItems[slashResolvedActiveTarget.itemIndex]
        if (item) insertSkill(item)
      }
      return true
    }

    return false
  }

  function activateHashCategory(category: string) {
    setHashExpandedCategory(category)
    setHashActiveTarget({ kind: 'category', category })
  }

  function handleHashNavigationKey(key: string): boolean {
    if (!hashOpen || !hashResolvedActiveTarget || !hashNavigationTargets.length) return false
    const currentIndex = Math.max(0, hashNavigationTargets.findIndex((target) => (
      target.kind === hashResolvedActiveTarget.kind
      && target.category === hashResolvedActiveTarget.category
      && (target.kind === 'category' || target.itemIndex === (hashResolvedActiveTarget.kind === 'item' ? hashResolvedActiveTarget.itemIndex : -1))
    )))

    if (key === 'ArrowDown' || key === 'ArrowUp') {
      const delta = key === 'ArrowDown' ? 1 : -1
      const nextIndex = (currentIndex + delta + hashNavigationTargets.length) % hashNavigationTargets.length
      setHashActiveTarget(hashNavigationTargets[nextIndex])
      return true
    }

    if (key === 'ArrowRight') {
      if (hashResolvedActiveTarget.kind === 'category') {
        if (effectiveHashExpandedCategory !== hashResolvedActiveTarget.category) {
          activateHashCategory(hashResolvedActiveTarget.category)
        } else {
          const firstItem = hashGroups.find((group) => group.category === hashResolvedActiveTarget.category)?.items[0]
          if (firstItem) setHashActiveTarget({ kind: 'item', category: hashResolvedActiveTarget.category, itemIndex: firstItem.index })
        }
      }
      return true
    }

    if (key === 'ArrowLeft') {
      if (hashResolvedActiveTarget.kind === 'item') {
        setHashActiveTarget({ kind: 'category', category: hashResolvedActiveTarget.category })
      }
      return true
    }

    if (key === 'Enter') {
      if (hashResolvedActiveTarget.kind === 'category') {
        activateHashCategory(hashResolvedActiveTarget.category)
      } else {
        const item = hashItems[hashResolvedActiveTarget.itemIndex]
        if (item) insertAgentTarget(item)
      }
      return true
    }

    return false
  }

  function sendAndRefocus() {
    if (onSubmit) {
      if (!allowEmptySubmit && !composer.trim() && !attachments.length) return
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

  function handleComposerChange(nextComposer: string, caret = nextComposer.length) {
    setSlashDismissedValue(null)
    setSlashMenuQuery(null)
    setHashDismissedValue(null)
    setHashMenuQuery(null)
    setComposerCaret(caret)
    setComposer(nextComposer)
  }

  function handleComposerPaste(event: ReactClipboardEvent<HTMLElement>) {
    const item = [...(event.clipboardData?.items || [])].find((entry) => entry.type.startsWith('image/'))
    const file = item?.getAsFile()
    if (!file) return
    event.preventDefault()
    readAttachment(file)
  }

  function handleComposerKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (atContext && atSuggestions.length > 0) {
      if (event.key === 'ArrowDown') { event.preventDefault(); setAtActive((i) => (i + 1) % atSuggestions.length); return }
      if (event.key === 'ArrowUp') { event.preventDefault(); setAtActive((i) => (i - 1 + atSuggestions.length) % atSuggestions.length); return }
      if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); pickFile(atSuggestions[atActive]); return }
      if (event.key === 'Escape') {
        event.preventDefault()
        setComposer(composer.slice(0, atContext.start) + composer.slice(atContext.end))
        return
      }
    }
    if (event.key === 'Escape' && slashOpen) {
      event.preventDefault()
      setSlashDismissedValue(composer)
      return
    }
    if (event.key === 'Escape' && hashOpen) {
      event.preventDefault()
      setHashDismissedValue(composer)
      return
    }
    if (hashOpen && (event.key !== 'Enter' || !event.shiftKey) && handleHashNavigationKey(event.key)) {
      event.preventDefault()
      return
    }
    if (slashOpen && (event.key !== 'Enter' || !event.shiftKey) && handleSlashNavigationKey(event.key)) {
      event.preventDefault()
      return
    }
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendAndRefocus() }
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
      onSubmit={(e) => {
        e.preventDefault()
        if (isGenerating && !allowSubmitWhileGenerating) stopGenerate()
        else sendAndRefocus()
      }}
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
            activeTarget={slashResolvedActiveTarget}
            expandedCategory={effectiveSlashExpandedCategory}
            onActiveTargetChange={setSlashActiveTarget}
            onExpandedCategoryChange={activateSlashCategory}
            onNavigateKey={handleSlashNavigationKey}
            onQueryChange={setSlashMenuQuery}
            onPick={insertSkill}
          />
        ) : null}
        {hashOpen ? (
          <AgentSlashMenu
            mode="agent"
            items={hashItems}
            query={hashQuery}
            activeTarget={hashResolvedActiveTarget}
            expandedCategory={effectiveHashExpandedCategory}
            onActiveTargetChange={setHashActiveTarget}
            onExpandedCategoryChange={activateHashCategory}
            onNavigateKey={handleHashNavigationKey}
            onQueryChange={setHashMenuQuery}
            onPick={insertAgentTarget}
          />
        ) : null}
        <SkillTokenEditor
          ref={textareaRef}
          value={composer}
          skills={selectedSkills}
          agents={selectedAgentTokens}
          placeholder={placeholder}
          onChange={handleComposerChange}
          onKeyDown={handleComposerKeyDown}
          onPaste={handleComposerPaste}
          onRemoveSkill={removeSkill}
          onRemoveAgent={removeAgentTarget}
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
                if (slashOpen && slashContext) {
                  setComposerCaret(slashContext.start)
                  setComposer(composer.slice(0, slashContext.start) + composer.slice(slashContext.end))
                  setSlashMenuQuery(null)
                }
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
          <span className="agent-model-caret" aria-hidden="true" />
        </button>
        </div>
        {showKnowledgeToolbar ? (
          <button
            type="button"
            className="agent-knowledge-btn"
            id="agentSessionKnowledgeBtn"
            title={knowledgeTitle}
            aria-label={refs.length ? `已选 ${refs.length} 个知识库，点击调整` : '选择本次对话知识库'}
            aria-expanded={menu === 'knowledge'}
            aria-controls="agentSessionKnowledgeMenu"
            onClick={() => {
              const next = menu === 'knowledge' ? null : 'knowledge'
              setMenu(next)
              if (next === 'knowledge') void loadKnowledge()
            }}
          >
            <Icon name="bookOpen" />
            {refs.length ? <span className="agent-knowledge-count" aria-hidden="true">{refs.length}</span> : null}
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
          className={`agent-go agent-send${isGenerating && !allowSubmitWhileGenerating ? ' is-running' : ''}${composer.trim() || attachments.length ? ' is-ready' : ''}`}
          aria-label={isGenerating && !allowSubmitWhileGenerating ? '停止生成' : '发送'}
        >
          <Icon name={isGenerating && !allowSubmitWhileGenerating ? 'stop' : 'send'} />
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
          knowledge={[]}
          providers={knowledgeProviderOptions}
          options={knowledgeProviderOptions}
          refs={refs}
          onToggle={(path) => void toggleSessionKnowledge(path)}
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
