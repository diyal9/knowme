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
    assert.ok(
      !/patchExecutionTimeline[\s\S]*?setAttribute\('open'/.test(agent),
      'patching does not force the execution card back open'
    )
  })

  it('reconciles streaming markdown per child and updates the tail text in place', () => {
    assert.ok(agent.includes('function reconcileStreamChildren(container, nextContainer)'), 'child-level diff exists')
    assert.ok(agent.includes('function isStreamTail(node)'), 'tail node detector exists')
    assert.ok(agent.includes('reconcileStreamChildren(textEl, next)'), 'paint uses the diff')
    assert.ok(!agent.includes('textEl.replaceWith(next)'), 'no longer replaces the whole chat-text container')
  })

  it('upgrades the thinking bubble in place when the first token arrives', () => {
    assert.ok(agent.includes('function upgradeThinkingBubble(bubble, m, html)'), 'in-place upgrade exists')
    assert.ok(agent.includes('upgradeThinkingBubble(bubble, m, firstHtml)'), 'paint tries the upgrade before renderChat')
    assert.ok(agent.includes("bubble.classList.remove('thinking', 'has-execution')"), 'thinking state is cleared')
  })
})
