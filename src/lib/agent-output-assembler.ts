'use strict'

const {
  parseSuggestionBlock,
  hasIncompleteSuggestionFence,
} = require('./agent-suggestion')
const { stableHash } = require('./agent-output-protocol')

const DEFAULT_MAX_TEXT = 12000
const MAX_DIAGNOSTICS = 12
const MAX_UI_ITEMS = 6

function createAssembler(options = {}) {
  return {
    roundDraft: '',
    candidate: null,
    maxTextLength: options.maxTextLength || DEFAULT_MAX_TEXT,
    diagnostics: [],
  }
}

function pushDiagnostic(state, entry) {
  if (!state) return
  state.diagnostics = state.diagnostics || []
  state.diagnostics.push({
    at: Date.now(),
    ...entry,
  })
  if (state.diagnostics.length > MAX_DIAGNOSTICS) {
    state.diagnostics = state.diagnostics.slice(-MAX_DIAGNOSTICS)
  }
}

function boundText(text, maxLen) {
  const raw = String(text || '')
  if (raw.length <= maxLen) return raw
  return raw.slice(0, maxLen)
}

/**
 * Apply cumulative provider snapshot; non-prefix revisions replace the draft.
 */
function ingestSnapshot(state, content) {
  const text = boundText(content, state.maxTextLength)
  if (!text) return state
  const prev = String(state.roundDraft || '')
  if (!prev || text.startsWith(prev)) {
    state.roundDraft = text
    return state
  }
  pushDiagnostic(state, { code: 'non_prefix_revision', prevLength: prev.length, nextLength: text.length })
  state.roundDraft = text
  return state
}

function setRoundDraft(state, text) {
  state.roundDraft = boundText(text, state.maxTextLength)
  return state
}

function clearRoundDraft(state) {
  state.roundDraft = ''
  return state
}

function setCandidate(state, text) {
  const next = boundText(text, state.maxTextLength)
  state.candidate = next.trim() ? next : null
  return state
}

function clearCandidate(state) {
  state.candidate = null
  return state
}

function getCandidate(state) {
  return state.candidate != null ? state.candidate : (state.roundDraft || '')
}

function stripMalformedSuggestionBlocks(text, state) {
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
        pushDiagnostic(state, { code: 'incomplete_suggestion_stripped' })
      }
    }
  }

  const fencedInvalid = /```suggestion[\s\S]*?```/gi
  out = out.replace(fencedInvalid, (block) => {
    const bar = parseSuggestionBlock(block).bar
    if (bar) return ''
    pushDiagnostic(state, { code: 'invalid_suggestion_stripped' })
    return ''
  })

  return out.replace(/\n{3,}/g, '\n\n').trim()
}

function buildUiFromBar(bar) {
  if (!bar || !Array.isArray(bar.items) || !bar.items.length) return []
  const items = bar.items.slice(0, MAX_UI_ITEMS).map((item) => ({
    id: item.id,
    label: item.label,
    description: item.description || '',
    action: item.action,
    payload: item.payload || '',
  }))
  return [{
    kind: 'choice',
    title: bar.title || '',
    items,
  }]
}

function isThinkingProtocolData(data, lang = '') {
  const langTag = String(lang || '').toLowerCase()
  if (/(thinking|reasoning|analysis|thought|思考|推理)/i.test(langTag)) return true
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false
  const typeLike = `${data.type || ''} ${data.kind || ''} ${data.stage || ''} ${data.category || ''}`
  if (/(thinking|reasoning|analysis|thought|思考|推理|分析)/i.test(typeLike)) return true
  const keys = Object.keys(data).map(key => key.toLowerCase())
  const markers = new Set([
    'thinking', 'reasoning', 'analysis', 'thought', 'thoughts',
    'steps', 'assumptions', 'risks', 'observations', 'next_action', 'nextstep',
  ])
  return keys.reduce((count, key) => count + (markers.has(key) ? 1 : 0), 0) >= 2
}

function stripThinkingProtocolBlocks(text, state) {
  const src = String(text || '')
  return src.replace(/```([a-zA-Z0-9_:+\-]*)[ \t]*\r?\n([\s\S]*?)```/g, (block, lang, inner) => {
    let data = null
    try { data = JSON.parse(String(inner || '').trim()) } catch { /* explicit thinking tags still strip */ }
    if (!isThinkingProtocolData(data, lang)) return block
    pushDiagnostic(state, { code: 'thinking_protocol_stripped' })
    return ''
  }).replace(/\n{3,}/g, '\n\n').trim()
}

/**
 * Strip suggestion blocks and produce canonical answer metadata.
 * @param {string} text
 * @param {object} [state]
 */
function canonicalize(text, state) {
  const src = boundText(text, state?.maxTextLength || DEFAULT_MAX_TEXT)
  const parsed = parseSuggestionBlock(src)
  let body = parsed.bodyWithoutBlock

  if (!parsed.bar) {
    body = stripMalformedSuggestionBlocks(body, state)
    if (hasIncompleteSuggestionFence(body)) {
      body = stripMalformedSuggestionBlocks(body, state)
      pushDiagnostic(state, { code: 'residual_incomplete_suggestion' })
    }
    if (body.includes('```suggestion') || /\{\s*"title"\s*:\s*"/.test(body)) {
      const retry = parseSuggestionBlock(body)
      if (retry.bar) {
        body = retry.bodyWithoutBlock
      } else if (body.includes('```suggestion')) {
        body = stripMalformedSuggestionBlocks(body, state)
        pushDiagnostic(state, { code: 'invalid_suggestion_removed' })
      }
    }
  }

  body = stripThinkingProtocolBlocks(body, state)
  body = body.replace(/\n{3,}/g, '\n\n').trim()
  const ui = buildUiFromBar(parsed.bar)
  const hash = stableHash(body)

  if (parsed.bar && ui.length === 0) {
    pushDiagnostic(state, { code: 'suggestion_parse_empty' })
  }
  const diagnostics = state?.diagnostics ? [...state.diagnostics] : []

  return {
    text: body,
    hash,
    ui,
    diagnostics,
  }
}

module.exports = {
  DEFAULT_MAX_TEXT,
  MAX_UI_ITEMS,
  createAssembler,
  ingestSnapshot,
  setRoundDraft,
  clearRoundDraft,
  setCandidate,
  clearCandidate,
  getCandidate,
  canonicalize,
  stripMalformedSuggestionBlocks,
  stripThinkingProtocolBlocks,
  buildUiFromBar,
}
