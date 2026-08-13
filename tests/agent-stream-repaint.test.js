/**
 * 流式重绘增量化：执行过程时间线与正文 Markdown 不再整块重建
 */
const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')

describe('agent stream repaint stays incremental', () => {
  const agent = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace-agent.js'), 'utf8')

  it('stamps diffable signatures on trace rows, round labels and plan items', () => {
    assert.ok(agent.includes('function withSig(html)'), 'signature helper exists')
    assert.ok(agent.includes('function quickHash(str)'), 'hash helper exists')
    assert.match(agent, /withSig\(`<li class="agent-plan-item/, 'plan items carry a signature')
    assert.match(agent, /withSig\(`<div class="agent-trace-round"/, 'round labels carry a signature')
    assert.match(agent, /withSig\(`<details class="agent-trace-row tool/, 'tool rows carry a signature')
    assert.match(agent, /withSig\(`<div class="agent-trace-row \$\{item\.kind\}/, 'stage rows carry a signature')
  })

  it('patches the execution timeline in place instead of replacing the whole details node', () => {
    assert.ok(agent.includes('function patchExecutionTimeline(current, next)'), 'in-place patch exists')
    assert.ok(agent.includes('function reconcileKeyedChildren(parent, nextParent)'), 'keyed child reconcile exists')
    assert.ok(agent.includes("elementSignature(cur) === elementSignature(next)"), 'unchanged rows are skipped')
    assert.ok(
      agent.includes('if (!timeline || !patchExecutionTimeline(timeline, next))'),
      'refresh prefers patching and only falls back to replaceWith'
    )
    assert.ok(!agent.includes('if (timeline) timeline.replaceWith(next)\n      else {'), 'unconditional replace path removed')
    const patchBody = agent.slice(
      agent.indexOf('function patchExecutionTimeline(current, next)'),
      agent.indexOf('function updateThinkingStatus')
    )
    assert.ok(!patchBody.includes("setAttribute('open'"), 'streaming patches do not force the execution card back open')
  })

  it('reconciles streaming markdown per child without exposing the raw tail', () => {
    assert.ok(agent.includes('function reconcileStreamChildren(container, nextContainer)'), 'child-level diff exists')
    assert.ok(agent.includes('function isStreamPending(node)'), 'pending node detector exists')
    assert.ok(agent.includes('md-stream-pending'), 'fixed pending state replaces raw tail')
    assert.ok(!agent.includes('md-stream-tail'), 'raw stream tail path is removed')
    assert.ok(!agent.includes('escHtml(tail)'), 'buffered model tail never enters visible html')
    assert.ok(agent.includes('reconcileStreamChildren(textEl, next)'), 'paint uses the diff')
    assert.ok(!agent.includes('textEl.replaceWith(next)'), 'no longer replaces the whole chat-text container')
  })

  it('upgrades the thinking bubble in place when the first token arrives', () => {
    assert.ok(agent.includes('function upgradeThinkingBubble(bubble, m, html)'), 'in-place upgrade exists')
    assert.ok(agent.includes('upgradeThinkingBubble(bubble, m, firstHtml)'), 'paint tries the upgrade before renderChat')
    assert.ok(agent.includes("bubble.classList.remove('thinking', 'has-execution')"), 'thinking state is cleared')
  })

  it('does not clear and replay a single non-empty stream flush for legacy only', () => {
    assert.ok(agent.includes('let gotNonEmptyStream = false'), 'tracks whether visible stream content arrived')
    assert.ok(agent.includes('protocolVersion === 2'), 'v2 missing answer uses readable error')
    assert.ok(agent.includes('revealTypewriter(assistantRef.idx, finalText'), 'legacy executor may still typewriter')
    assert.ok(!agent.includes('streamedButSingleFlush'), 'single flush is not treated as missing stream content')
    assert.ok(!agent.includes('streamUpdateCount <= 1'), 'chunk count no longer triggers replay')
  })

  it('completes the current assistant bubble without replacing the chat log', () => {
    assert.ok(agent.includes('function completeAssistantBubble(idx)'), 'local completion path exists')
    assert.ok(agent.includes('completeAssistantBubble(assistantRef.idx)'), 'successful runs use local completion')
    assert.ok(agent.includes('function reconcileCompletedAssistantBody(current, next)'), 'completed markdown reconciles locally')
    assert.ok(agent.includes('data-assistant-body="1"'), 'assistant body has a stable completion target')
    assert.ok(agent.includes("bubble.querySelector(':scope > .stream-cursor')?.remove()"), 'cursor is removed locally')
  })

  it('drops an unfinished legacy tail when generation is cancelled', () => {
    assert.ok(agent.includes('function settleCancelledAssistantText(message)'), 'cancelled stream sanitizer exists')
    assert.ok(
      agent.includes('const { stable } = splitStreamingMarkdown(safeStreamText)'),
      'cancelled stream keeps only stable display content',
    )
    const cancelBranch = agent.slice(
      agent.indexOf('if (result.cancelled)'),
      agent.indexOf("setPresenceState('error')", agent.indexOf('if (result.cancelled)')),
    )
    assert.ok(cancelBranch.includes('settleCancelledAssistantText(assistantRef.message)'))
    assert.ok(cancelBranch.indexOf('settleCancelledAssistantText') < cancelBranch.indexOf('streaming = false'))
  })

  it('collapses completed execution in place but keeps pending review visible', () => {
    assert.ok(agent.includes('function hasPendingReview(message)'), 'pending review detector exists')
    assert.ok(agent.includes("if (hasPendingReview(message)) timeline.setAttribute('open', '')"), 'approval keeps timeline open')
    assert.ok(agent.includes("else timeline.removeAttribute('open')"), 'completed timeline collapses locally')
    assert.ok(agent.includes('requiresApproval: Boolean(event.requiresApproval)'), 'trace preserves approval state')
    assert.ok(agent.includes('draftId: event.draftId'), 'trace preserves the approval draft target')
  })

  it('consumes v2 protocol without chunk fallback in normal path', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace.html'), 'utf8')
    assert.ok(agent.includes('function applyV2StreamEvent'), 'v2 stream reducer bridge exists')
    assert.ok(agent.includes('protocolVersion: 2'), 'new assistant runs declare protocol v2')
    assert.ok(html.includes('agent-message-state.js'), 'workspace html loads message reducer')
    assert.ok(!agent.includes('onAiStreamChunk('), 'workspace does not subscribe to chunk channel')
    assert.ok(agent.includes('if (!assistantRef.message.v2AnswerCommitted)'), 'invoke result cannot overwrite committed answer')
    assert.ok(agent.includes('data-assistant-body="1"'), 'waiting bubble mounts fixed body shell')
    assert.ok(agent.includes('Boolean(bodyBefore && bodyAfter && bodyBefore === bodyAfter)'), 'fixture body identity is strict')
  })

  it('upgradeThinkingBubble reuses mounted body shell', () => {
    assert.ok(agent.includes('let body = bubble.querySelector(\'[data-assistant-body="1"]\')'))
    assert.ok(agent.includes('body.replaceChildren(textNode)'))
  })
})
