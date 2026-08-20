import { useEffect, useState } from 'react'
import { Icon } from '../../app/Icon'
import { useAppStore } from '../../app/store'

type ReplyRating = 'good' | 'bad' | null

function formatMessageTime(timestamp?: number) {
  if (!Number.isFinite(timestamp) || !timestamp || timestamp <= 0) return ''
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(timestamp))
}

export function AgentMessageActions({ text, timestamp }: { text: string; timestamp?: number }) {
  const [copied, setCopied] = useState(false)
  const [rating, setRating] = useState<ReplyRating>(null)
  const [forking, setForking] = useState(false)
  const activeSessionId = useAppStore((state) => state.activeSessionId)
  const forkSession = useAppStore((state) => state.forkSession)

  useEffect(() => {
    if (!copied) return undefined
    const timer = window.setTimeout(() => setCopied(false), 1600)
    return () => window.clearTimeout(timer)
  }, [copied])

  async function copyAnswer() {
    try {
      if (window.navigator.clipboard?.writeText) {
        await window.navigator.clipboard.writeText(text)
      } else {
        const node = document.createElement('textarea')
        node.value = text
        node.style.position = 'fixed'
        node.style.opacity = '0'
        document.body.appendChild(node)
        node.select()
        document.execCommand('copy')
        node.remove()
      }
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  async function branchToNewChat() {
    if (!activeSessionId || forking) return
    setForking(true)
    try {
      await forkSession(activeSessionId)
    } finally {
      setForking(false)
    }
  }

  return (
    <div className="agent-message-actions" aria-label="回答操作">
      <button
        type="button"
        className={copied ? 'is-active' : undefined}
        onClick={() => void copyAnswer()}
        aria-label={copied ? '已复制回答' : '复制'}
        title={copied ? '已复制' : '复制'}
      >
        <Icon name="copy" />
      </button>
      <button
        type="button"
        onClick={() => setRating((current) => current === 'good' ? null : 'good')}
        aria-label="回复优秀"
        aria-pressed={rating === 'good'}
        title="回复优秀"
      >
        <Icon name="thumbsUp" />
      </button>
      <button
        type="button"
        onClick={() => setRating((current) => current === 'bad' ? null : 'bad')}
        aria-label="回复不佳"
        aria-pressed={rating === 'bad'}
        title="回复不佳"
      >
        <Icon name="thumbsDown" />
      </button>
      <button
        type="button"
        onClick={() => void branchToNewChat()}
        aria-label={forking ? '正在分支到新聊天' : '分支到新聊天'}
        title={forking ? '正在分支…' : '分支到新聊天'}
        disabled={!activeSessionId || forking}
      >
        <Icon name="gitFork" />
      </button>
      {formatMessageTime(timestamp) ? <time className="agent-message-time">{formatMessageTime(timestamp)}</time> : null}
    </div>
  )
}
