/**
 * workspace capability rail — rail 入口与 Hub overlay 路由契约
 */
const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')

describe('workspace capability rail', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace.html'), 'utf8')
  const js = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace.js'), 'utf8')
  const agentJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace-agent.js'), 'utf8')

  it('rail has one unified icon-only capability button with aria', () => {
    const at = html.indexOf('id="btnRailCapabilities"')
    const workbenchAt = html.indexOf('id="btnRailWorkbench"')
    const automationAt = html.indexOf('id="btnRailAutomation"')
    assert.ok(at > -1, 'unified capability button')
    assert.ok(at > workbenchAt, 'capability follows workbench')
    assert.ok(automationAt > at, 'automation follows capability')
    const slice = html.slice(at, at + 420)
    assert.ok(slice.includes('aria-label="能力：专家、技能与 MCP 连接器"'), 'capability aria-label')
    assert.ok(slice.includes('title="能力"'), 'capability title tooltip')
    assert.ok(slice.includes('data-icon="capabilityStack"'), 'unified capability stack icon')
    assert.ok(html.slice(at, automationAt).includes('aria-label="自动化中心"'), 'automation remains in separated toolbar')
    for (const legacyId of ['btnRailExperts', 'btnRailSkills', 'btnRailConnectors']) {
      assert.ok(!html.includes(`id="${legacyId}"`), `${legacyId} removed`)
    }
  })

  it('opens center overlay iframe with tab deep link', () => {
    assert.ok(js.includes('function openCapabilityHub'), 'openCapabilityHub')
    assert.ok(js.includes("kind: 'capability-hub'"), 'capability-hub drawer kind')
    assert.ok(js.includes('capability-hub.html?embedded=1&tab='), 'iframe src with tab')
    assert.ok(js.includes('capability-hub-frame'), 'iframe class')
    assert.ok(js.includes('window.openCapabilityHub = openCapabilityHub'), 'global opener')
  })

  it('renders capability tabs in the outer workspace top bar', () => {
    assert.ok(html.includes('class="drawer-capability-brand"'), 'outer capability brand')
    assert.ok(html.includes('data-capability-hub-tab="experts"'), 'outer experts tab')
    assert.ok(html.includes('data-capability-hub-tab="skills"'), 'outer skills tab')
    assert.ok(html.includes('data-capability-hub-tab="connectors"'), 'outer connectors tab')
    assert.ok(html.includes('.drawer.drawer-capability-hub .drawer-head'), 'capability top bar style')
    assert.ok(js.includes("querySelectorAll('[data-capability-hub-tab]')"), 'outer tab events and state sync')
  })

  it('syncs unified rail active state and preserves agent on close', () => {
    assert.ok(js.includes("drawerKind === 'capability-hub'"), 'hub drawer kind check')
    assert.ok(js.includes("getElementById('btnRailCapabilities')"), 'unified rail state target')
    assert.ok(js.includes("openCapabilityHub('experts')"), 'unified rail defaults to experts')
    assert.ok(js.includes("let capabilityHubTab = 'experts'"), 'experts default state')
    assert.ok(js.includes("'capability-hub-close'"), 'iframe close message')
    assert.ok(js.includes("e.key === 'Escape'") && js.includes("drawerKind === 'capability-hub'"), 'Esc close')
  })

  it('keeps capability access in rail and removes the empty-state CTA', () => {
    assert.ok(html.includes('id="btnRailCapabilities"'), 'unified rail capability entry')
    assert.ok(!html.includes('data-capability-hub='), 'static empty CTA removed')
    assert.ok(!agentJs.includes('data-capability-hub'), 'dynamic CTA and handler removed')
  })
})
