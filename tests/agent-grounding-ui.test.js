'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const {
  captureGroundingDetailsOpenState,
  restoreGroundingDetailsOpenState,
  patchAssistantGroundingMeta,
  renderGroundingStatusMetaHtml,
} = require('../src/lib/agent-grounding-ui')

function makeDetails(open = false) {
  return { open, className: 'agent-grounding-sources' }
}

function makeBubble(idx, details) {
  return {
    getAttribute(name) {
      return name === 'data-idx' ? String(idx) : null
    },
    querySelector(sel) {
      if (sel === '.agent-grounding-sources') return details
      if (sel === '.agent-grounding-meta') return details._meta || null
      return null
    },
    insertAdjacentHTML() {},
  }
}

function makeRoot(bubbles) {
  return {
    querySelectorAll(sel) {
      if (sel === '.agent-bubble.assistant[data-idx]') return bubbles
      return []
    },
    querySelector(sel) {
      const m = sel.match(/data-idx="(\d+)"/)
      if (!m) return null
      return bubbles.find(b => b.getAttribute('data-idx') === m[1]) || null
    },
  }
}

describe('agent grounding ui details state', () => {
  it('captures and restores open grounding sources', () => {
    const details = makeDetails(true)
    const bubble = makeBubble(0, details)
    const root = makeRoot([bubble])
    const state = captureGroundingDetailsOpenState(root)
    assert.deepEqual(state, { 0: true })
    details.open = false
    restoreGroundingDetailsOpenState(root, state)
    assert.equal(details.open, true)
  })

  it('patchAssistantGroundingMeta preserves open state on meta replace', () => {
    const details = makeDetails(true)
    const meta = { outerHTML: '', className: 'agent-grounding-meta' }
    details._meta = meta
    const bubble = {
      querySelector(sel) {
        if (sel === '.agent-grounding-meta') return meta
        if (sel === '.agent-grounding-sources') return details
        return null
      },
      insertAdjacentHTML() {},
    }
    Object.defineProperty(meta, 'outerHTML', {
      set() {
        meta._meta = { className: 'agent-grounding-meta' }
        bubble.querySelector = (sel) => {
          if (sel === '.agent-grounding-meta') return meta._meta
          if (sel === '.agent-grounding-sources') return details
          return null
        }
      },
      get() { return '<div class="agent-grounding-meta"></div>' },
    })
    const gs = {
      status: 'verified',
      sources: [{ tool: 'feishu.meeting_read', status: 'ok' }],
      violations: [],
    }
    patchAssistantGroundingMeta(bubble, gs)
    assert.equal(details.open, true)
    const html = renderGroundingStatusMetaHtml(gs)
    assert.ok(!html.includes('feishu.meeting_read'))
    assert.ok(html.includes('查看来源（1）'))
  })

  it('styles grounding disclosure without browser default markers or bullets', () => {
    const lib = fs.readFileSync(path.join(__dirname, '../src/lib/agent-grounding-ui.ts'), 'utf8')
    assert.match(lib, /class="agent-grounding-sources"/)
    assert.match(lib, /<details class="agent-grounding-sources"><summary>查看来源/)
    assert.match(lib, /<ul>\$\{sourceItems\}<\/ul>/)
  })
})
