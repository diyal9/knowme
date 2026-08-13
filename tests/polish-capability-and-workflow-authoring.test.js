'use strict'

/**
 * polish-capability-and-workflow-authoring —
 * 专家库的「Agent 即 Skill」闭环与工作台编排界面的静态契约。
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const src = path.join(__dirname, '..', 'src')
const hubJs = fs.readFileSync(path.join(src, 'capability-hub.js'), 'utf8')
const hubHtml = fs.readFileSync(path.join(src, 'capability-hub.html'), 'utf8')
const hubCss = fs.readFileSync(path.join(src, 'capability-hub.css'), 'utf8')
const workspaceHtml = fs.readFileSync(path.join(src, 'workspace.html'), 'utf8')
const workspaceJs = fs.readFileSync(path.join(src, 'workspace.js'), 'utf8')
const workspaceAgentJs = fs.readFileSync(path.join(src, 'workspace-agent.js'), 'utf8')
const workbenchJs = fs.readFileSync(path.join(src, 'workbench.js'), 'utf8')
const workbenchCss = fs.readFileSync(path.join(src, 'workbench-console.css'), 'utf8')

describe('capability hub — skill closed loop', () => {
  it('confirms destructive and risky actions in-app instead of native dialogs', () => {
    assert.ok(!/\bwindow\.confirm\(/.test(hubJs), 'no native confirm')
    assert.ok(!/\bwindow\.prompt\(/.test(hubJs), 'no native prompt')
    assert.match(hubJs, /function askConfirm\(/, 'shared in-app confirm')
    assert.ok(hubHtml.includes('id="hubConfirmDialog"'), 'confirm dialog shell exists')
    assert.ok(hubJs.includes('confirmRiskyCapability'), 'risk confirmation reuses the shared dialog')
  })

  it('lists what a skill can do and lets the user try it from the drawer', () => {
    assert.match(hubJs, /function skillTaskSection\(/, 'skill task section')
    assert.ok(hubJs.includes('tasksForSkill'), 'tasks filtered by skill id')
    assert.ok(hubJs.includes("data-act=\"trySkill\""), 'try action per task')
    assert.ok(hubJs.includes('capability-hub-start-skill'), 'skill trial intent')
    assert.ok(hubJs.includes('requestSkillStart'), 'trial request helper')
    assert.ok(hubJs.includes('hub-task-flag'), 'preflight requirement is surfaced before the trial')
    assert.ok(hubCss.includes('.hub-task-row'), 'task row styling')
  })

  it('installs or enables a skill before starting the trial', () => {
    const trial = hubJs.slice(hubJs.indexOf("} else if (act === 'trySkill') {"))
    assert.ok(trial.indexOf('capabilityInstall') < trial.indexOf('requestSkillStart'), 'install precedes trial')
    assert.ok(trial.includes('capabilityEnable'), 'disabled skill is enabled first')
    assert.ok(trial.includes('confirmInstallPrecheck'), 'trial keeps the install precheck')
  })

  it('cross-links experts and skills through their composition', () => {
    assert.match(hubJs, /function expertCompositionSection\(/, 'expert shows assembled capabilities')
    assert.match(hubJs, /function skillUsageSection\(/, 'skill shows the experts using it')
    assert.ok(hubJs.includes('data-hub-goto'), 'composition chips navigate')
    assert.match(hubJs, /async function gotoCapability\(/, 'cross-tab navigation')
  })

  it('prefills the composer instead of auto-sending the trial prompt', () => {
    assert.ok(workspaceJs.includes("d.type === 'capability-hub-start-skill'"), 'workspace handles the trial intent')
    assert.ok(workspaceJs.includes('startSkillChat'), 'workspace delegates to the agent surface')
    assert.match(workspaceAgentJs, /async function startSkillChat\(/, 'agent surface exposes the trial entry')
    const start = workspaceAgentJs.slice(workspaceAgentJs.indexOf('async function startSkillChat('))
    assert.ok(!start.slice(0, start.indexOf('return { ok: true')).includes('sendAi('), 'trial never auto-sends')
  })
})

describe('workbench studio — workflow authoring', () => {
  it('guards unsaved drafts on every exit path', () => {
    assert.ok(workspaceHtml.includes('id="wbLeaveModal"'), 'leave dialog shell exists')
    assert.match(workbenchJs, /async function confirmLeaveStudio\(/, 'leave guard')
    assert.ok(workbenchJs.includes("data-leave-choice=\"save\""), 'save-and-leave is the default focus')
    const leaveCalls = (workbenchJs.match(/await (?:confirmLeaveStudio|leaveStudioToShelf)\(\)/g) || []).length
    assert.ok(leaveCalls >= 3, 'back, workflow switch and tab switch are all guarded')
    assert.ok(workbenchJs.includes("leaveChoiceResolve('cancel')"), 'Escape cancels the leave dialog')
    assert.ok(workbenchJs.includes("markDirty: false"), 'canvas normalize does not force dirty')
    assert.ok(workbenchJs.includes("node.kind !== 'start' && node.kind !== 'end'"), 'leave guard ignores system-only nodes')
  })

  it('configures step skills inside the inspector and writes them to the node profile', () => {
    assert.match(workbenchJs, /function studioSkillPicker\(/, 'inspector skill picker')
    assert.ok(workbenchJs.includes('data-studio-skill='), 'each skill is a checkbox')
    assert.ok(workbenchJs.includes('readStudioSkillSelection'), 'selection is read back')
    assert.ok(
      workbenchJs.includes('skillRefs') && workbenchJs.includes('studioNodeProfile(node)'),
      'selection lands in the node profile',
    )
    assert.ok(workbenchJs.includes('data-studio-skill-count'), 'selected count stays visible')
    assert.ok(workbenchCss.includes('.wb-studio-skill-list'), 'skill picker styling')
  })

  it('supports keyboard reordering and keeps focus on the moved step', () => {
    assert.match(workbenchJs, /function moveStudioNode\(/, 'single reorder path')
    assert.match(workbenchJs, /function focusStudioNode\(/, 'focus is restored after re-render')
    assert.ok(workbenchJs.includes("event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')"), 'Alt+Arrow reorders')
    assert.ok(workbenchJs.includes('tabindex="0" role="button"'), 'step cards are focusable')
    assert.ok(workbenchJs.includes("index === 0 ? ' disabled' : ''"), 'first step cannot move up')
    assert.ok(workbenchJs.includes("index === nodes.length - 1 ? ' disabled' : ''"), 'last step cannot move down')
    assert.ok(workbenchCss.includes('.wb-studio-node:focus-visible'), 'keyboard focus is visible')
  })

  it('keeps the inspector reachable on narrow windows', () => {
    const narrow = workbenchCss.slice(workbenchCss.indexOf('@media (max-width: 1100px)'))
    const block = narrow.slice(0, narrow.indexOf('@media', 1))
    assert.ok(!/\.wb-studio-inspector\s*\{[^}]*display:\s*none/.test(block), 'inspector is never hidden at 1100px')
  })

  it('does not keep dead element references in the renderer', () => {
    for (const name of ['elModeSelect', 'elGoalInput', 'elConsoleRuns', 'elConsolePipelines', 'elGoalTaskList']) {
      assert.ok(!workbenchJs.includes(name), `${name} is removed`)
    }
  })
})
