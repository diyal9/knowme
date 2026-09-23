import {
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  type ClipboardEvent as ReactClipboardEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'

export interface SkillTokenEditorSkill {
  id: string
  name: string
}

export interface SkillTokenEditorAgent {
  id: string
  name: string
}

export interface SkillTokenEditorHandle {
  focus: () => void
  setSelectionRange: (start: number, end: number) => void
}

interface TextPart {
  kind: 'text'
  text: string
  key: string
}

interface SkillPart {
  kind: 'skill'
  skill: SkillTokenEditorSkill
  marker: string
  key: string
}

interface AgentPart {
  kind: 'agent'
  agent: SkillTokenEditorAgent
  marker: string
  key: string
}

type EditorPart = TextPart | SkillPart | AgentPart
type TokenCandidate =
  | { kind: 'skill'; skill: SkillTokenEditorSkill; marker: string }
  | { kind: 'agent'; agent: SkillTokenEditorAgent; marker: string }

function isBoundary(value: string, index: number): boolean {
  return index < 0 || index >= value.length || /\s/.test(value[index] || '')
}

function tokenizeComposerText(
  value: string,
  skills: SkillTokenEditorSkill[],
  agents: SkillTokenEditorAgent[],
): EditorPart[] {
  if ((!skills.length && !agents.length) || !value) return [{ kind: 'text', text: value, key: 'text-0' }]
  const candidates: TokenCandidate[] = [
    ...skills.map((skill) => ({ kind: 'skill' as const, skill, marker: `/${skill.name.trim()}` })),
    ...agents.map((agent) => ({ kind: 'agent' as const, agent, marker: `#${agent.name.trim()}` })),
  ]
    .filter((item) => item.marker !== '/' && item.marker !== '#')
    .sort((a, b) => b.marker.length - a.marker.length)
  const parts: EditorPart[] = []
  let cursor = 0
  let partIndex = 0

  while (cursor < value.length) {
    let match: (TokenCandidate & { index: number }) | null = null
    for (const candidate of candidates) {
      let index = value.indexOf(candidate.marker, cursor)
      while (index >= 0 && (!isBoundary(value, index - 1) || !isBoundary(value, index + candidate.marker.length))) {
        index = value.indexOf(candidate.marker, index + candidate.marker.length)
      }
      if (index >= 0 && (!match || index < match.index || (index === match.index && candidate.marker.length > match.marker.length))) {
        match = { ...candidate, index }
      }
    }
    if (!match) break
    if (match.index > cursor) {
      parts.push({ kind: 'text', text: value.slice(cursor, match.index), key: `text-${partIndex++}` })
    }
    if (match.kind === 'skill') {
      parts.push({ kind: 'skill', skill: match.skill, marker: match.marker, key: `skill-${match.skill.id}-${partIndex++}` })
    } else {
      parts.push({ kind: 'agent', agent: match.agent, marker: match.marker, key: `agent-${match.agent.id}-${partIndex++}` })
    }
    cursor = match.index + match.marker.length
  }

  if (cursor < value.length || !parts.length) {
    parts.push({ kind: 'text', text: value.slice(cursor), key: `text-${partIndex}` })
  }
  return parts
}

export function tokenizeSkillText(value: string, skills: SkillTokenEditorSkill[]): Array<TextPart | SkillPart> {
  return tokenizeComposerText(value, skills, []) as Array<TextPart | SkillPart>
}

function tokenMarker(node: Node): string | null {
  return node instanceof HTMLElement ? node.dataset.composerMarker || node.dataset.skillMarker || null : null
}

function serializedText(node: Node): string {
  const marker = tokenMarker(node)
  if (marker) return marker
  if (node.nodeType === Node.TEXT_NODE) return node.textContent || ''
  if (node instanceof HTMLBRElement) return '\n'
  let text = ''
  node.childNodes.forEach((child) => { text += serializedText(child) })
  return text
}

export function readSkillTokenEditor(root: HTMLElement): string {
  let text = ''
  root.childNodes.forEach((child) => { text += serializedText(child) })
  return text.replace(/\u00a0/g, ' ')
}

function serializedLength(node: Node): number {
  return serializedText(node).length
}

function readSerializedCaret(root: HTMLElement): number {
  const selection = window.getSelection()
  const anchor = selection?.anchorNode
  if (!anchor || !root.contains(anchor)) return readSkillTokenEditor(root).length
  const anchorOffset = selection?.anchorOffset || 0
  let total = 0
  let found = false

  function visit(node: Node) {
    if (found) return
    if (node === anchor) {
      if (node.nodeType === Node.TEXT_NODE) {
        total += Math.min(anchorOffset, node.textContent?.length || 0)
      } else {
        const children = [...node.childNodes].slice(0, anchorOffset)
        total += children.reduce((sum, child) => sum + serializedLength(child), 0)
      }
      found = true
      return
    }
    const marker = tokenMarker(node)
    if (marker || node.nodeType === Node.TEXT_NODE || node instanceof HTMLBRElement) {
      total += serializedLength(node)
      return
    }
    node.childNodes.forEach(visit)
  }

  visit(root)
  return total
}

function placeSerializedCaret(root: HTMLElement, offset: number) {
  const target = Math.max(0, offset)
  let consumed = 0
  let point: { node: Node; offset: number } | null = null

  function visit(node: Node) {
    if (point) return
    const marker = tokenMarker(node)
    if (marker) {
      const parent = node.parentNode
      if (parent && target <= consumed + marker.length) {
        const index = Array.from<Node>(parent.childNodes).indexOf(node)
        point = { node: parent, offset: index + (target === consumed ? 0 : 1) }
        return
      }
      consumed += marker.length
      return
    }
    if (node.nodeType === Node.TEXT_NODE) {
      const length = node.textContent?.length || 0
      if (target <= consumed + length) {
        point = { node, offset: Math.max(0, target - consumed) }
        return
      }
      consumed += length
      return
    }
    if (node instanceof HTMLBRElement) {
      consumed += 1
      return
    }
    node.childNodes.forEach(visit)
  }

  root.childNodes.forEach(visit)
  const resolvedPoint = point as { node: Node; offset: number } | null
  const selection = window.getSelection()
  if (!selection) return
  const range = document.createRange()
  if (resolvedPoint) {
    range.setStart(resolvedPoint.node, resolvedPoint.offset)
    range.collapse(true)
  } else {
    range.selectNodeContents(root)
    range.collapse(false)
  }
  selection.removeAllRanges()
  selection.addRange(range)
}

function renderedTokenKeys(root: HTMLElement): string[] {
  return Array.from(root.querySelectorAll<HTMLElement>('[data-skill-id], [data-agent-id]'))
    .map((node) => node.dataset.skillId ? `skill:${node.dataset.skillId}` : `agent:${node.dataset.agentId || ''}`)
    .filter(Boolean)
}

function renderEditorParts(root: HTMLElement, parts: EditorPart[]) {
  const fragment = document.createDocumentFragment()
  for (const part of parts) {
    if (part.kind === 'text') {
      if (part.text) fragment.append(document.createTextNode(part.text))
      continue
    }

    const button = document.createElement('button')
    button.type = 'button'
    const isSkill = part.kind === 'skill'
    const item = isSkill ? part.skill : part.agent
    button.className = `agent-skill-toggle${isSkill ? '' : ' agent-target-toggle'}`
    button.contentEditable = 'false'
    button.dataset.composerMarker = part.marker
    if (isSkill) {
      button.dataset.skillId = item.id
      button.dataset.skillMarker = part.marker
      button.dataset.testid = `agent-selected-skill-${item.id}`
    } else {
      button.dataset.agentId = item.id
      button.dataset.testid = `agent-selected-agent-${item.id}`
    }
    button.setAttribute('aria-pressed', 'true')
    button.setAttribute('aria-label', `已选择${isSkill ? '技能' : ' Agent'} ${item.name}，点击移除`)
    button.title = isSkill ? '点击取消本轮技能' : '点击取消本次 Agent 对象'

    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    icon.classList.add('agent-skill-toggle-icon')
    icon.setAttribute('viewBox', '0 0 24 24')
    icon.setAttribute('fill', 'none')
    icon.setAttribute('stroke', 'currentColor')
    icon.setAttribute('stroke-width', '1.8')
    icon.setAttribute('stroke-linecap', 'round')
    icon.setAttribute('stroke-linejoin', 'round')
    icon.setAttribute('aria-hidden', 'true')
    const shell = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    const ridge = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    if (isSkill) {
      shell.setAttribute('d', 'm12 2.75 7 4.05v8.4l-7 4.05-7-4.05V6.8l7-4.05Z')
      ridge.setAttribute('d', 'm5.4 6.95 6.6 3.8 6.6-3.8M12 10.75v8.05')
    } else {
      shell.setAttribute('d', 'M12 12.25a4.25 4.25 0 1 0 0-8.5 4.25 4.25 0 0 0 8.5Z')
      ridge.setAttribute('d', 'M4.75 20.25c.55-3.55 3.1-5.5 7.25-5.5s6.7 1.95 7.25 5.5')
    }
    icon.append(shell, ridge)
    const name = document.createElement('strong')
    name.textContent = item.name
    button.append(icon, name)
    fragment.append(button)
  }
  root.replaceChildren(fragment)
}

export const SkillTokenEditor = forwardRef<SkillTokenEditorHandle, {
  value: string
  skills: SkillTokenEditorSkill[]
  agents?: SkillTokenEditorAgent[]
  placeholder: string
  onChange: (value: string, caret: number) => void
  onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void
  onPaste: (event: ReactClipboardEvent<HTMLElement>) => void
  onRemoveSkill: (skill: SkillTokenEditorSkill) => void
  onRemoveAgent?: (agent: SkillTokenEditorAgent) => void
}>(function SkillTokenEditor({ value, skills, agents = [], placeholder, onChange, onKeyDown, onPaste, onRemoveSkill, onRemoveAgent }, forwardedRef) {
  const rootRef = useRef<HTMLDivElement>(null)
  const pendingCaretRef = useRef<number | null>(null)
  const bridgedValueRef = useRef(value)
  bridgedValueRef.current = value
  const parts = useMemo(() => tokenizeComposerText(value, skills, agents), [value, skills, agents])

  useImperativeHandle(forwardedRef, () => ({
    focus() {
      const root = rootRef.current
      if (!root) return
      // Chromium may inject a filler <br> into an empty contentEditable after
      // it is cleared. Remove that browser-owned node before restoring focus,
      // otherwise the editor looks blank but no longer matches its empty model.
      if (!bridgedValueRef.current) root.replaceChildren()
      root.focus()
      if (!bridgedValueRef.current) placeSerializedCaret(root, 0)
    },
    setSelectionRange(start) {
      pendingCaretRef.current = start
      if (rootRef.current) placeSerializedCaret(rootRef.current, start)
    },
  }), [])

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    root.setAttribute('placeholder', placeholder)
    Object.defineProperty(root, 'value', {
      configurable: true,
      get: () => bridgedValueRef.current,
      set: (nextValue: unknown) => {
        const next = String(nextValue ?? '')
        bridgedValueRef.current = next
        pendingCaretRef.current = next.length
      },
    })
    const handleBridgeChange = () => {
      const next = bridgedValueRef.current
      onChange(next, next.length)
    }
    root.addEventListener('change', handleBridgeChange)
    return () => {
      root.removeEventListener('change', handleBridgeChange)
      delete (root as HTMLDivElement & { value?: string }).value
    }
  }, [onChange, placeholder])

  useLayoutEffect(() => {
    const root = rootRef.current
    const caret = pendingCaretRef.current
    if (!root) return
    const desiredTokenKeys = parts.flatMap((part) => part.kind === 'skill'
      ? [`skill:${part.skill.id}`]
      : part.kind === 'agent' ? [`agent:${part.agent.id}`] : [])
    const currentTokenKeys = renderedTokenKeys(root)
    const tokensMatch = desiredTokenKeys.length === currentTokenKeys.length
      && desiredTokenKeys.every((key, index) => key === currentTokenKeys[index])
    const needsSync = readSkillTokenEditor(root) !== value || !tokensMatch

    // contentEditable owns ordinary keystrokes. Rebuilding its React children after
    // every input duplicates browser-created text nodes and can crash the renderer.
    // Only synchronize when the serialized model or its atomic Skill tokens differ.
    if (needsSync) renderEditorParts(root, parts)
    if (caret != null && needsSync) placeSerializedCaret(root, caret)
    pendingCaretRef.current = null
  }, [value, parts])

  return (
    <div
      ref={rootRef}
      id="agentInput"
      className="agent-rich-input"
      role="textbox"
      aria-multiline="true"
      aria-label={placeholder}
      data-placeholder={placeholder}
      data-empty={value.length === 0 ? 'true' : 'false'}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      onInput={(event) => {
        const root = event.currentTarget
        const caret = readSerializedCaret(root)
        onChange(readSkillTokenEditor(root), caret)
      }}
      onFocus={(event) => {
        const root = event.currentTarget
        if (!value && readSkillTokenEditor(root).replace(/\n/g, '') === '') {
          root.replaceChildren()
          placeSerializedCaret(root, 0)
        }
      }}
      onMouseDown={(event) => {
        const target = event.target
        if (target instanceof Element && target.closest('[data-skill-id], [data-agent-id]')) event.preventDefault()
      }}
      onClick={(event) => {
        const target = event.target
        if (!(target instanceof Element)) return
        const token = target.closest<HTMLElement>('[data-skill-id], [data-agent-id]')
        const skill = skills.find((item) => item.id === token?.dataset.skillId)
        if (skill) {
          onRemoveSkill(skill)
          return
        }
        const agent = agents.find((item) => item.id === token?.dataset.agentId)
        if (agent) onRemoveAgent?.(agent)
      }}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
    />
  )
})
