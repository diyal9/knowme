/**
 * agent-rail-quick-entry — 左栏 Agent 与工作台入口回归
 */
const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')

describe('agent rail quick entry', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace.html'), 'utf8')
  const js = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace.js'), 'utf8')

  it('separates Agent chat and workbench buttons', () => {
    const agentAt = html.indexOf('id="btnRailAi"')
    const workbenchAt = html.indexOf('id="btnRailWorkbench"')
    const capabilityAt = html.indexOf('id="btnRailCapabilities"')
    const automationAt = html.indexOf('id="btnRailAutomation"')
    assert.ok(agentAt > -1, 'Agent rail button')
    assert.ok(workbenchAt > agentAt, 'workbench follows Agent')
    assert.ok(capabilityAt > workbenchAt, 'capability Hub follows workbench')
    assert.ok(automationAt > capabilityAt, 'automation follows capability Hub')
    assert.ok(html.slice(agentAt, workbenchAt).includes('data-icon="chat"'), 'Agent uses chat icon')
    assert.ok(html.slice(workbenchAt, capabilityAt).includes('data-icon="workbench"'), 'workbench uses workbench icon')
    assert.ok(html.slice(capabilityAt, automationAt).includes('data-icon="capabilityStack"'), 'capability Hub uses stack icon')
    assert.ok(html.slice(automationAt).includes('data-icon="automation"'), 'automation uses automation icon')
  })

  it('renders readable labels in a widened fixed-window rail', () => {
    for (const label of ['文件', '助理', '工作台', '专家库', '自动化', '知识网', '设置']) {
      assert.match(html, new RegExp(`<span class="rail-label">${label}</span>`), `${label} rail label`)
    }
    assert.match(html, /--rail-width:120px/)
    assert.match(html, /\.side-rail\s*\{[^}]*flex:0 0 var\(--rail-width\)[^}]*width:var\(--rail-width\)/s)
    assert.match(html, /\.app\.mode-center-surface \.drawer\.open\s*\{[\s\S]*?left:var\(--rail-width\) !important/)
    assert.match(js, /getPropertyValue\('--rail-width'\)/)
    assert.match(js, /drawer\.style\.left = railWidthCssValue\(shell\)/)
    assert.doesNotMatch(js, /drawer\.style\.left = '44px'/)
  })

  it('returns to Agent chat and focuses the composer', () => {
    assert.ok(js.includes('function openAgentChat()'), 'idempotent Agent navigation')
    assert.ok(js.includes("workspaceMode = 'agent'"), 'switches to Agent mode')
    assert.ok(js.includes('workbenchOn = false'), 'closes workbench')
    assert.ok(js.includes('setWorkbenchTaskView(false)'), 'exits workbench task-room before assistant')
    assert.ok(js.includes("document.getElementById('agentInput')?.focus()"), 'focuses Agent input')
    assert.ok(js.includes("document.getElementById('btnRailAi')?.addEventListener('click', openAgentChat)"), 'wires Agent button')
  })

  it('keeps workbench on a separate action and syncs exclusive state', () => {
    assert.ok(js.includes("document.getElementById('btnRailWorkbench')?.addEventListener('click'"), 'wires workbench button')
    assert.ok(js.includes("document.getElementById('btnRailAutomation')?.addEventListener('click'"), 'wires automation button')
    assert.ok(js.includes('const agentOn = workspaceMode === \'agent\' && !workbenchOn && !overlayOn'), 'Agent active state')
    assert.ok(js.includes('const workbenchActive = workbenchOn && !workbenchAutomationOn && !overlayOn'), 'workbench active state')
    assert.ok(js.includes('const automationActive = workbenchOn && workbenchAutomationOn && !overlayOn'), 'automation active state')
  })
})
