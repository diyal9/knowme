/**
 * 助理空态首页：问候标题 + 快捷卡 + 底部 composer。
 * 不负责会话气泡与发送（见 AssistantPane / AgentComposer）。
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { PackEmptyGroup } from '../../../shared/api'
import { ASSISTANT_QUICK_COMMANDS } from '../../../domain/agent-quick-commands'
import {
  emptyShortcutIcon,
  modeSectionMeta,
  MODE_EMPTY_SHORTCUTS,
  resolveAssistantModeId,
  type AssistantModeId,
  type EmptyShortcutCard,
} from '../../../domain/assistant-modes'
import { useAppStore } from '../../app/store'
import { Icon } from '../../app/Icon'

const QUICK_ICONS: Record<string, string> = {
  meetingSummary: 'note',
  todayPriority: 'automation',
  docKbSuggest: 'bookOpen',
  relatedChats: 'chat',
}

/** 空态副标题比 Ctrl+K 更短，语义不变 */
const LAUNCH_SUBTITLES: Record<string, string> = {
  meetingSummary: '最近三天会议',
  todayPriority: '日程/待办 Top3',
  docKbSuggest: '文件夹 · 记忆 · 最近',
  relatedChats: '今日私聊/群聊 · @我',
}

function launchCardSubtitle(item: { id: string; subtitle: string }): string {
  return LAUNCH_SUBTITLES[item.id] || item.subtitle
}

function resolveModeCards(mode: AssistantModeId): EmptyShortcutCard[] {
  const modeCards = MODE_EMPTY_SHORTCUTS[mode]
  if (modeCards.length) return modeCards.slice(0, 4)
  return [...ASSISTANT_QUICK_COMMANDS]
}

export function AssistantEmptyHome({
  composer,
  modeId: modeIdProp,
  expertId,
}: {
  composer?: ReactNode
  modeId?: AssistantModeId
  expertId?: string
}) {
  const sessions = useAppStore((s) => s.sessions)
  const activeSessionId = useAppStore((s) => s.activeSessionId)
  const setComposer = useAppStore((s) => s.setComposer)
  const sendMessage = useAppStore((s) => s.sendMessage)
  const [packGroups, setPackGroups] = useState<PackEmptyGroup[]>([])

  const active = sessions.find((item) => item.id === activeSessionId)
  const modeId = modeIdProp || resolveAssistantModeId(active?.agentId || active?.expertId)
  const packGroup = useMemo(
    () => packGroups.find((group) => String(group.packId || '') === String(expertId || '')),
    [expertId, packGroups],
  )

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await window.api?.capabilityPackEmptyState?.()
        if (!cancelled) setPackGroups(Array.isArray(res?.groups) ? res.groups : [])
      } catch {
        if (!cancelled) setPackGroups([])
      }
    })()
    return () => { cancelled = true }
  }, [])

  const cards = useMemo(() => {
    if (packGroup?.scenes?.length) {
      return packGroup.scenes.slice(0, 4).map((scene) => ({
        id: scene.id,
        title: scene.title || '开始任务',
        subtitle: scene.subtitle || '说明你的目标，KnowMe 会继续推进',
        prompt: scene.prompt || '',
      }))
    }
    return resolveModeCards(modeId)
  }, [modeId, packGroup])

  function run(prompt: string) {
    const text = prompt.trim()
    if (!text) return
    setComposer(text)
    sendMessage(text)
  }

  const sectionMeta = packGroup?.kicker || packGroup?.hero || modeSectionMeta(modeId)
  const ariaLabel = packGroup ? `${sectionMeta}任务入口` : '任务入口'

  /* 短问句；四卡恢复改前面板（标题+副标题）；composer 粉圈不加重 CTA */
  return (
    <div className={`agent-empty-tips agent-empty-home${packGroup ? ' agent-empty-pack' : ''}`} aria-label={ariaLabel} data-testid="assistant-empty-home" data-pack-id={packGroup?.packId || undefined}>
      <div className="agent-launch-intro">
        <p className="agent-empty-sub">今天想让 KnowMe 做什么？</p>
      </div>
      <div className="agent-empty-actions">
        {cards.map((item) => (
          <button
            key={item.id}
            type="button"
            className="agent-empty-act"
            onClick={() => run(item.prompt)}
          >
            <span className="agent-empty-act-mark" aria-hidden="true">
              <Icon name={QUICK_ICONS[item.id] || emptyShortcutIcon(item.id)} />
            </span>
            <span className="agent-empty-act-copy">
              <strong>{item.title}</strong>
              <span>{launchCardSubtitle(item)}</span>
            </span>
          </button>
        ))}
      </div>
      {composer}
    </div>
  )
}
