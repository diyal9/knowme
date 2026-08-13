/**
 * Agent chat suggestion / action bar (whitelist actions only).
 * Node tests: require('./lib/agent-suggestion')
 * Browser: <script src="lib/agent-suggestion.js"> → window.AgentSuggestion
 */
;(function (root, factory) {
  const api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  if (root) root.AgentSuggestion = api
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict'

  const ALLOWED = new Set(['fill', 'send', 'copy', 'open_link', 'open_knowledge'])
  const MAX_ITEMS = 6
  const OPEN_URL_RE = /^(?:https?:\/\/|mailto:|file:\/\/|knowme:\/\/)/i

  function normalizeSuggestionShape(data) {
    if (!data || typeof data !== 'object') return null
    if (Array.isArray(data)) {
      // 1) Bare action array: [{label, action, payload}, ...]
      const hasDirectActions = data.some(it => it && typeof it === 'object'
        && String(it.action || '').trim()
        && String(it.label || '').trim())
      if (hasDirectActions) return data
      // 2) Wrapped suggestion object array: [{title, items:[...]}]
      const wrapped = data.find(it => it && typeof it === 'object' && Array.isArray(it.items))
      return wrapped || null
    }
    return data
  }

  function parseSuggestionJson(raw) {
    const text = String(raw || '').trim()
    if (!text) return null
    const candidates = [text]
    if (
      ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'")))
      && text.length >= 2
    ) {
      candidates.push(text.slice(1, -1))
    }
    for (const item of candidates) {
      try {
        let data = JSON.parse(item)
        if (typeof data === 'string') {
          try { data = JSON.parse(data) } catch { /* keep original string */ }
        }
        return data
      } catch { /* try next */ }
    }
    return null
  }

  function findSuggestionFence(src) {
    const text = String(src || '')
    const lower = text.toLowerCase()
    const marker = '```suggestion'
    const start = lower.indexOf(marker)
    if (start < 0) return null
    let contentStart = start + marker.length
    while (contentStart < text.length && /[ \t]/.test(text[contentStart])) contentStart++
    if (text[contentStart] === '\r') contentStart++
    if (text[contentStart] === '\n') contentStart++
    const end = text.indexOf('```', contentStart)
    if (end < 0) return {
      start,
      end: -1,
      inner: text.slice(contentStart),
    }
    return {
      start,
      end: end + 3,
      inner: text.slice(contentStart, end),
    }
  }

  // Extract whitelisted items from either { items: [...] } or a bare array.
  function extractItems(data) {
    const normalized = normalizeSuggestionShape(data)
    const rawItems = Array.isArray(normalized)
      ? normalized
      : (Array.isArray(normalized?.items) ? normalized.items : [])
    const items = []
    for (const it of rawItems) {
      if (!it || typeof it !== 'object') continue
      const action = String(it.action || '').trim()
      if (!ALLOWED.has(action)) continue
      const label = String(it.label || '').trim()
      if (!label) continue
      items.push({
        id: String(it.id || `s${items.length + 1}`),
        label,
        description: String(it.description || '').trim(),
        action,
        payload: String(it.payload != null ? it.payload : ''),
      })
      if (items.length >= MAX_ITEMS) break
    }
    return items
  }

  function buildBar(inner) {
    const data = normalizeSuggestionShape(parseSuggestionJson(inner))
    if (!data || typeof data !== 'object') return null
    const items = extractItems(data)
    if (!items.length) return null
    const title = Array.isArray(data) ? '' : String(data?.title || '').trim()
    return { title, items }
  }

  function stripRange(src, start, end) {
    return `${src.slice(0, start)}${src.slice(end)}`
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  // Fallback: models sometimes emit suggestions as a plain ```json (or generic)
  // fence containing an array/object of whitelist actions instead of the
  // dedicated ```suggestion fence. Detect the last such fence conservatively.
  function isSuggestionData(data) {
    const normalized = normalizeSuggestionShape(data)
    if (!normalized || typeof normalized !== 'object') return false
    return extractItems(normalized).length > 0
  }

  function findFallbackSuggestionFence(src) {
    // Language tag only (e.g. json). Supports:
    //   ```json\n{...}\n```
    //   ```json {...}\n```
    const re = /```[a-zA-Z0-9_+-]*[ \t]*\r?\n?([\s\S]*?)```/g
    let m
    let match = null
    while ((m = re.exec(src))) {
      const inner = String(m[1] || '').trim()
      if (!inner) continue
      let data
      try {
        data = JSON.parse(inner)
      } catch {
        continue
      }
      if (!isSuggestionData(data)) continue
      const bar = buildBar(inner)
      if (bar) match = { start: m.index, end: m.index + m[0].length, bar }
    }
    return match
  }

  // Last-resort: model dumps a suggestion object/array with no code fence.
  function findBareSuggestionJson(src) {
    const text = String(src || '')
    const trimmedEnd = text.replace(/\s+$/, '')
    const candidates = []
    for (let i = 0; i < trimmedEnd.length; i++) {
      const ch = trimmedEnd[i]
      if ((ch === '{' || ch === '[') && (i === 0 || trimmedEnd[i - 1] === '\n')) {
        candidates.push(i)
      }
    }
    for (let i = candidates.length - 1; i >= 0; i--) {
      const start = candidates[i]
      const slice = trimmedEnd.slice(start)
      let data
      try {
        data = JSON.parse(slice)
      } catch {
        continue
      }
      if (!isSuggestionData(data)) continue
      const bar = buildBar(slice)
      if (!bar) continue
      return { start, end: trimmedEnd.length, bar }
    }
    return null
  }

  function parseSuggestionBlock(text) {
    const src = String(text || '')
    const fence = findSuggestionFence(src)
    if (fence) {
      if (fence.end < 0) {
        // 消息已完成但模型漏了结尾 ``` 时，仍尝试提取建议，避免 JSON 外露到聊天正文。
        const bar = buildBar(fence.inner)
        if (!bar) return { bodyWithoutBlock: src, bar: null }
        let start = fence.start
        if (start > 0 && (src[start - 1] === '"' || src[start - 1] === "'")) {
          const prev = src[start - 2]
          if (start - 1 === 0 || prev === '\n' || prev === '\r' || /\s/.test(prev || '')) {
            start -= 1
          }
        }
        return { bodyWithoutBlock: stripRange(src, start, src.length), bar }
      }
      const bar = buildBar(fence.inner)
      // Explicit but malformed suggestion fence keeps original body verbatim.
      if (!bar) return { bodyWithoutBlock: src, bar: null }
      return { bodyWithoutBlock: stripRange(src, fence.start, fence.end), bar }
    }

    const fallback = findFallbackSuggestionFence(src)
    if (fallback) {
      return { bodyWithoutBlock: stripRange(src, fallback.start, fallback.end), bar: fallback.bar }
    }

    const bare = findBareSuggestionJson(src)
    if (bare) {
      return { bodyWithoutBlock: stripRange(src, bare.start, bare.end), bar: bare.bar }
    }

    return { bodyWithoutBlock: src, bar: null }
  }

  function hasIncompleteSuggestionFence(text) {
    const src = String(text || '')
    const fence = findSuggestionFence(src)
    if (!fence) return false
    return fence.end < 0
  }

  /**
   * Detect template slots that still need the user to paste/type real content.
   * Used to keep fill/send from auto-sending placeholder payloads.
   */
  function payloadNeedsUserEdit(payload) {
    const s = String(payload || '')
    if (!s.trim()) return false
    if (/在此(?:粘贴|填写|输入|补充)|请(?:粘贴|填写|输入|补充)|待填写|占位/.test(s)) return true
    if (/\b(?:TODO|PLACEHOLDER|TBD|FIXME)\b/i.test(s)) return true
    if (/\[[^\]]{2,}\]/.test(s) && /在此|粘贴|填写|输入|paste|insert|your|here|example|示例|真实/i.test(s)) {
      return true
    }
    if (/【[^】]{2,}】/.test(s)) return true
    if (/<(?:YOUR_|在此|PASTE_|INSERT_)[^>]*>/i.test(s)) return true
    return false
  }

  /**
   * Split the two "open" actions into a link target vs the local knowledge page.
   * Models keep reaching for open_knowledge as a generic "open this", so a URL
   * payload wins over the action name. Protocol safety stays with FeishuLink.
   */
  function resolveOpenTarget(action, payload) {
    const act = String(action || '')
    const url = String(payload || '').trim()
    const isUrl = OPEN_URL_RE.test(url)
    if (act === 'open_link') return isUrl ? { kind: 'link', url } : { kind: 'invalid', url: '' }
    if (act === 'open_knowledge') return isUrl ? { kind: 'link', url } : { kind: 'knowledge', url: '' }
    return { kind: 'none', url: '' }
  }

  /**
   * Merge user-typed content into a suggestion payload without showing the
   * template in the composer. Prefer replacing the first bracket/slot; otherwise
   * return the user text as-is (conversation already carries the chosen intent).
   */
  function applyUserInputToPayload(payload, userText) {
    const user = String(userText || '').trim()
    const tpl = String(payload || '')
    if (!user) return ''
    if (!tpl.trim() || !payloadNeedsUserEdit(tpl)) return user
    let out = tpl
    if (/\[[^\]]{2,}\]/.test(out)) out = out.replace(/\[[^\]]{2,}\]/, user)
    else if (/【[^】]{2,}】/.test(out)) out = out.replace(/【[^】]{2,}】/, user)
    else if (/<(?:YOUR_|在此|PASTE_|INSERT_)[^>]*>/i.test(out)) {
      out = out.replace(/<(?:YOUR_|在此|PASTE_|INSERT_)[^>]*>/i, user)
    } else {
      return user
    }
    return out.trim()
  }

  function isThinkingProtocolData(data, lang = '') {
    const langTag = String(lang || '').toLowerCase()
    if (/(thinking|reasoning|analysis|thought|思考|推理)/i.test(langTag)) return true
    if (!data || typeof data !== 'object') return false
    if (Array.isArray(data)) return data.some(item => isThinkingProtocolData(item))
    const typeLike = `${data.type || ''} ${data.kind || ''} ${data.stage || ''} ${data.category || ''}`
    if (/(thinking|reasoning|analysis|thought|思考|推理|分析)/i.test(typeLike)) return true
    const keys = Object.keys(data).map(key => key.toLowerCase())
    const strongMarkers = new Set([
      'thinking', 'reasoning', 'thought', 'thoughts', 'chain_of_thought', 'internal_reasoning',
    ])
    if (keys.some(key => strongMarkers.has(key))) return true
    const markers = new Set([
      'thinking', 'reasoning', 'analysis', 'thought', 'thoughts',
      'steps', 'assumptions', 'risks', 'observations', 'next_action', 'nextstep',
    ])
    return keys.reduce((count, key) => count + (markers.has(key) ? 1 : 0), 0) >= 2
  }

  function stripThinkingProtocolBlocks(text) {
    const src = String(text || '')
    let out = src.replace(/```([a-zA-Z0-9_:+\-]*)[ \t]*\r?\n([\s\S]*?)```/g, (block, lang, inner) => {
      let data = null
      try { data = JSON.parse(String(inner || '').trim()) } catch { /* explicit thinking tags still strip */ }
      if (!isThinkingProtocolData(data, lang)) return block
      return ''
    })

    const incomplete = /```(?:thinking|reasoning|analysis|thought|思考|推理)[^\r\n]*\r?\n?[\s\S]*$/i
    out = out.replace(incomplete, '')

    const trimmedEnd = out.replace(/\s+$/, '')
    const candidates = []
    for (let i = 0; i < trimmedEnd.length; i++) {
      const ch = trimmedEnd[i]
      if ((ch === '{' || ch === '[') && (i === 0 || trimmedEnd[i - 1] === '\n')) {
        candidates.push(i)
      }
    }
    for (let i = candidates.length - 1; i >= 0; i--) {
      const start = candidates[i]
      let data = null
      const candidate = trimmedEnd.slice(start)
      try { data = JSON.parse(candidate) } catch {
        const hasStrongKey = /"(?:thinking|reasoning|thought|thoughts|chain_of_thought|internal_reasoning)"\s*:/i.test(candidate)
        const hasTypedMarker = /"(?:type|kind|stage|category)"\s*:\s*"(?:thinking|reasoning|analysis|thought|思考|推理|分析)/i.test(candidate)
        if (!hasStrongKey && !hasTypedMarker) continue
        out = stripRange(trimmedEnd, start, trimmedEnd.length)
        break
      }
      if (!isThinkingProtocolData(data)) continue
      out = stripRange(trimmedEnd, start, trimmedEnd.length)
      break
    }

    return out.replace(/\n{3,}/g, '\n\n').trim()
  }

  function stripMalformedSuggestionBlocks(text) {
    let out = String(text || '')
    if (!out) return out

    if (hasIncompleteSuggestionFence(out)) {
      const parsed = parseSuggestionBlock(out)
      if (parsed.bar) {
        out = parsed.bodyWithoutBlock
      } else {
        const lower = out.toLowerCase()
        const marker = '```suggestion'
        const start = lower.indexOf(marker)
        if (start >= 0) {
          let stripStart = start
          if (stripStart > 0 && (out[stripStart - 1] === '"' || out[stripStart - 1] === "'")) {
            const prev = out[stripStart - 2]
            if (stripStart - 1 === 0 || prev === '\n' || prev === '\r' || /\s/.test(prev || '')) {
              stripStart -= 1
            }
          }
          out = `${out.slice(0, stripStart)}`.replace(/\n{3,}/g, '\n\n').trim()
        }
      }
    }

    const fencedInvalid = /```suggestion[\s\S]*?```/gi
    out = out.replace(fencedInvalid, (block) => {
      const bar = parseSuggestionBlock(block).bar
      if (bar) return ''
      return ''
    })

    return out.replace(/\n{3,}/g, '\n\n').trim()
  }

  /** Strip thinking/reasoning protocol and malformed suggestion fences for display. */
  function stripDisplayProtocolText(text) {
    let body = stripMalformedSuggestionBlocks(String(text || ''))
    body = stripThinkingProtocolBlocks(body)
    return body.replace(/\n{3,}/g, '\n\n').trim()
  }

  return {
    ALLOWED,
    MAX_ITEMS,
    parseSuggestionBlock,
    hasIncompleteSuggestionFence,
    resolveOpenTarget,
    payloadNeedsUserEdit,
    applyUserInputToPayload,
    stripDisplayProtocolText,
    stripThinkingProtocolBlocks,
    stripMalformedSuggestionBlocks,
  }
})
