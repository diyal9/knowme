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

  it('rail has one unified labeled capability button with aria', () => {
    const at = html.indexOf('id="btnRailCapabilities"')
    const workbenchAt = html.indexOf('id="btnRailWorkbench"')
    const automationAt = html.indexOf('id="btnRailAutomation"')
    assert.ok(at > -1, 'unified capability button')
    assert.ok(at > workbenchAt, 'capability follows workbench')
    assert.ok(automationAt > at, 'automation follows capability')
    const slice = html.slice(at, at + 420)
    assert.ok(slice.includes('aria-label="专家库：专家、技能与 MCP 连接器"'), 'capability aria-label')
    assert.ok(slice.includes('title="专家库"'), 'capability title tooltip')
    assert.ok(slice.includes('data-icon="capabilityStack"'), 'unified capability stack icon')
    assert.ok(slice.includes('<span class="rail-label">专家库</span>'), 'visible expert-library label')
    assert.ok(html.slice(at, automationAt).includes('aria-label="自动化中心"'), 'automation remains in separated toolbar')
    for (const legacyId of ['btnRailExperts', 'btnRailSkills', 'btnRailConnectors']) {
      assert.ok(!html.includes(`id="${legacyId}"`), `${legacyId} removed`)
    }
  })

  it('opens center overlay iframe with tab deep link', () => {
    assert.ok(js.includes('function openCapabilityHub'), 'openCapabilityHub')
    assert.ok(js.includes("kind: 'capability-hub'"), 'capability-hub drawer kind')
    assert.ok(js.includes('function buildCapabilityHubSrc'), 'builds hub src with query params')
    assert.ok(js.includes("embedded: '1'"), 'iframe embedded flag')
    assert.ok(js.includes("params.set('expertId', id)"), 'supports expertId deep link')
    assert.ok(js.includes("surface: surface === 'workbench' ? 'workbench' : 'capability'"), 'supports surface deep link')
    assert.ok(js.includes('capability-hub-frame'), 'iframe class')
    assert.ok(js.includes('window.openCapabilityHub = openCapabilityHub'), 'global opener')
  })

  it('parks and reuses the capability hub iframe across open/close', () => {
    assert.ok(js.includes('function parkCapabilityHubFrame'), 'park helper')
    assert.ok(js.includes('function getParkedCapabilityHubFrame'), 'reuse lookup')
    assert.ok(js.includes('function resumeCapabilityHubFrame'), 'resume helper')
    assert.ok(js.includes("type: 'capability-hub-resume'"), 'resume message')
    assert.ok(
      js.includes("if (drawerKind === 'capability-hub') parkCapabilityHubFrame()")
        || /if \(isCapabilityHubDrawerKind\(\)\) parkCapabilityHubFrame\(\)/.test(js),
      'close parks hub',
    )
    assert.ok(js.includes('parkCapabilityHubFrame()'), 'park is invoked before other surfaces overwrite body')
    assert.ok(js.includes('getParkedCapabilityHubFrame()'), 'open prefers parked frame')
    assert.ok(js.includes('resumeCapabilityHubFrame(reused'), 'reused frame is resumed')
  })

  it('renders capability tabs without repeating rail branding', () => {
    assert.match(html, /\.drawer\.drawer-capability-hub \.drawer-capability-brand\s*\{\s*display:none/, 'outer capability brand hidden')
    assert.match(html, /\.drawer\.open:not\(\.secondary-dialog\) \.drawer-title\s*\{\s*display:none/, 'knowledge and settings titles hidden')
    assert.match(html, /\.drawer\.open:not\(\.secondary-dialog\) \.drawer-close\s*\{\s*margin-left:auto/, 'close action remains right aligned')
    assert.ok(js.includes('drawerTitle.hidden = true'), 'center surfaces hide duplicate drawer title')
    assert.ok(js.includes('drawerTitle.hidden = false'), 'secondary dialogs restore contextual title')
    assert.ok(html.includes('data-capability-hub-tab="experts"'), 'outer experts tab')
    assert.ok(html.includes('data-capability-hub-tab="skills"'), 'outer skills tab')
    assert.ok(html.includes('data-capability-hub-tab="connectors"'), 'outer connectors tab')
    assert.ok(html.includes('.drawer.drawer-capability-hub .drawer-head'), 'capability top bar style')
    assert.match(html, /\.drawer\.drawer-capability-hub \.drawer-head\s*\{[^}]*height:52px;[^}]*min-height:52px/s, 'capability top bar matches workbench 52px')
    assert.match(html, /\.drawer\.drawer-capability-hub \.drawer-capability-tabs\s*\{[^}]*height:52px;/s, 'capability tabs fill 52px top bar')
    assert.match(html, /\.drawer\.drawer-capability-hub \.drawer-capability-tabs\s*\{[^}]*border:0;[^}]*background:transparent;[^}]*box-shadow:none/s, 'capability tab group is flat')
    assert.match(html, /\.drawer-capability-tab::after\s*\{[^}]*height:2px;[^}]*transform:scaleX\(0\)/s, 'capability tab uses underline indicator')
    assert.match(html, /\.drawer-capability-tab\.active\s*\{[^}]*background:transparent;[^}]*box-shadow:none/s, 'active capability tab has no filled capsule')
    assert.match(html, /\.drawer-capability-tab\.active::after\s*\{\s*transform:scaleX\(1\)/, 'active capability underline is visible')
    assert.ok(js.includes("querySelectorAll('[data-capability-hub-tab]')"), 'outer tab events and state sync')
  })

  it('syncs unified rail active state and preserves agent on close', () => {
    assert.ok(js.includes("drawerKind === 'capability-hub'"), 'hub drawer kind check')
    assert.ok(js.includes("getElementById('btnRailCapabilities')"), 'unified rail state target')
    assert.ok(js.includes("openCapabilityHub('experts')"), 'unified rail defaults to experts')
    assert.ok(js.includes("let capabilityHubTab = 'experts'"), 'experts default state')
    assert.ok(js.includes("'capability-hub-close'"), 'iframe close message')
    assert.ok(js.includes("d.reason === 'detail-dismiss'"), 'detail-dismiss only closes workbench overlay')
    assert.ok(js.includes("drawerKind === 'capability-hub-detail'"), 'detail-dismiss checks detail drawer kind')
    assert.ok(js.includes('capabilityHubSrcMismatch') || js.includes('reloadIfMismatch'), 'hub iframe src reloads when deep-link params drift')
    assert.ok(js.includes("e.key === 'Escape'") && js.includes("drawerKind === 'capability-hub'"), 'Esc close')
  })

  it('accepts expert start intents only from the active Hub frame', () => {
    assert.ok(js.includes("d.type === 'capability-hub-start-expert'"), 'expert start message')
    assert.ok(js.includes('e.source === capabilityFrame.contentWindow'), 'message source is verified')
    assert.ok(js.includes('WorkspaceAgent?.startExpertChat?.(expertId)'), 'capability surface still starts assistant expert chat')
    assert.ok(js.includes('Workbench.startExpertTaskDirect({ expertId })'), 'workbench surface starts task room')
    assert.ok(js.includes('capability-hub-start-expert-result'), 'workspace reports success or failure')
    assert.ok(js.includes('setTimeout(openAgentChat, 0)'), 'capability path opens assistant only after success')
    assert.ok(js.includes("setTimeout(() => document.getElementById('agentInput')?.focus(), 150)"), 'composer reclaims focus after the Hub handles its result')
  })

  it('accepts add-to-workbench intents only from the active Hub frame', () => {
    assert.ok(js.includes("d.type === 'capability-hub-add-expert-to-workbench'"), 'workbench add message')
    assert.ok(js.includes('if (!isCapabilityHubSource) return'), 'message source is verified')
    assert.ok(js.includes('window.api?.workbenchModeBindExpert'), 'workspace delegates to the mode owner')
    assert.ok(js.includes('window.Workbench?.refreshModes?.()'), 'team refreshes after binding')
    assert.ok(js.includes('capability-hub-add-expert-to-workbench-result'), 'workspace reports success or failure')
    assert.ok(js.includes("requestId.length > 160"), 'request ids are bounded')
  })

  it('keeps capability access in rail and removes the empty-state CTA', () => {
    assert.ok(html.includes('id="btnRailCapabilities"'), 'unified rail capability entry')
    assert.ok(!html.includes('data-capability-hub='), 'static empty CTA removed')
    assert.ok(!agentJs.includes('data-capability-hub'), 'dynamic CTA and handler removed')
  })
})
