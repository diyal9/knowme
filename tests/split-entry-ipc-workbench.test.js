'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const { shelfProvenanceLabel } = require('../src/workbench/provenance')
const { runPhaseFromStatus } = require('../src/workbench/run-phase')
const { escapeHtml } = require('../src/workbench/escape')

describe('workbench provenance', () => {
  it('maps source labels', () => {
    assert.equal(shelfProvenanceLabel('personal'), '我的')
    assert.equal(shelfProvenanceLabel('forked'), '我的')
    assert.equal(shelfProvenanceLabel('official'), '官方')
    assert.equal(shelfProvenanceLabel('daemon'), '共享')
  })
})

describe('workbench run-phase', () => {
  it('maps statuses', () => {
    assert.equal(runPhaseFromStatus('idle'), 'idle')
    assert.equal(runPhaseFromStatus('running'), 'running')
    assert.equal(runPhaseFromStatus('done'), 'completed')
    assert.equal(runPhaseFromStatus('failed'), 'failed')
    assert.equal(runPhaseFromStatus('queued', 'daemon', 'success'), 'running')
    assert.equal(runPhaseFromStatus('x', 'daemon', 'success'), 'completed')
  })
})

describe('workbench escape', () => {
  it('escapes html', () => {
    assert.equal(escapeHtml('<a&b>'), '&lt;a&amp;b&gt;')
  })
})

describe('ipc core modules', () => {
  it('exports registrars for core domains', () => {
    const ipc = require('../src/ipc')
    assert.equal(typeof ipc.registerCoreIpc, 'function')
    assert.equal(typeof ipc.registerMemoryIpc, 'function')
    assert.equal(typeof ipc.registerProductKnowledgeIpc, 'function')
    assert.equal(typeof ipc.registerNotesBackupIpc, 'function')
    assert.equal(typeof ipc.registerKnowledgeOsIpc, 'function')
    assert.equal(typeof ipc.registerKnowledgeStewardIpc, 'function')
    assert.equal(typeof ipc.registerKnowledgeProviderIpc, 'function')
    assert.equal(typeof ipc.registerFabricIpc, 'function')
    assert.equal(typeof ipc.registerConnectorsIpc, 'function')
    assert.equal(typeof ipc.registerWorkbenchAuthIpc, 'function')
    assert.equal(typeof ipc.registerWorkbenchLocalStoresIpc, 'function')
    assert.equal(typeof ipc.registerWorkbenchLaunchIpc, 'function')
    assert.equal(typeof ipc.registerWorkbenchModeIpc, 'function')
    assert.equal(typeof ipc.registerWorkbenchAutomationIpc, 'function')
    assert.equal(typeof ipc.registerWorkbenchBootstrapIpc, 'function')
    assert.equal(typeof ipc.registerWorkbenchDaemonIpc, 'function')
    assert.equal(typeof ipc.registerWorkbenchLoadIpc, 'function')
    assert.equal(typeof ipc.registerWorkbenchAgentGraphIpc, 'function')
    assert.equal(typeof ipc.registerAgentRunControlIpc, 'function')
    assert.equal(typeof ipc.registerWorkbenchDispatchIpc, 'function')
    assert.equal(typeof ipc.registerNotesIpc, 'function')
    assert.equal(typeof ipc.registerGameIpc, 'function')
    assert.equal(typeof ipc.registerCapabilityPackIpc, 'function')
    assert.equal(typeof ipc.registerAgentProfileIpc, 'function')
    assert.equal(typeof ipc.registerAgentSessionIpc, 'function')
    assert.equal(typeof ipc.registerAgentSessionUiIpc, 'function')
    assert.equal(typeof ipc.registerAppShellIpc, 'function')
    assert.equal(typeof ipc.registerLogsIpc, 'function')
    assert.equal(typeof ipc.registerSkillsIpc, 'function')
    assert.equal(typeof ipc.registerAppInfoIpc, 'function')
    assert.equal(typeof ipc.registerWorkspaceStateIpc, 'function')
    assert.equal(typeof ipc.registerWorkspaceInitIpc, 'function')
    assert.equal(typeof ipc.registerBuildFinalPromptIpc, 'function')
    assert.equal(typeof ipc.registerNoteLayoutIpc, 'function')
    assert.equal(typeof ipc.registerNoteContextMenuIpc, 'function')
    assert.equal(typeof ipc.registerAiAssistIpc, 'function')
    assert.equal(typeof ipc.registerAgentOutputFixtureIpc, 'function')
    assert.equal(typeof ipc.registerAiGenerateIpc, 'function')
  })

  it('notes CRUD lives in src/ipc/notes.js', () => {
    const notesIpc = fs.readFileSync(path.join(__dirname, '..', 'src', 'ipc', 'notes.js'), 'utf8')
    for (const ch of [
      "ipcMain.on('note-update'",
      "ipcMain.on('note-delete'",
      "ipcMain.on('new-note'",
      "ipcMain.handle('get-note'",
      "ipcMain.handle('workspace-new-note'",
      "ipcMain.handle('workspace-delete-note'",
      "ipcMain.handle('workspace-duplicate-note'",
      "ipcMain.on('note-toggle-favorite'",
      "ipcMain.on('note-increment-copy'",
      "ipcMain.handle('notes-batch-classify'",
      "ipcMain.handle('suggest-classification'",
    ]) {
      assert.ok(notesIpc.includes(ch), ch)
    }
  })

  it('game IPC lives in src/ipc/game.js', () => {
    const gameIpc = fs.readFileSync(path.join(__dirname, '..', 'src', 'ipc', 'game.js'), 'utf8')
    for (const ch of [
      "ipcMain.handle('game-studio-scenes'",
      "ipcMain.handle('game-requirement-build'",
      "ipcMain.handle('game-requirement-approve'",
      "ipcMain.handle('game-workbench-handoff'",
    ]) {
      assert.ok(gameIpc.includes(ch), ch)
    }
    assert.ok(!gameIpc.includes("ipcMain.handle('capability-pack-"), 'capability-pack handlers stay out of game module')
  })

  it('capability-pack IPC lives in src/ipc/capability-pack.js', () => {
    const packIpc = fs.readFileSync(path.join(__dirname, '..', 'src', 'ipc', 'capability-pack.js'), 'utf8')
    for (const ch of [
      "ipcMain.handle('capability-pack-list'",
      "ipcMain.handle('capability-pack-empty-state'",
      "ipcMain.handle('capability-pack-install'",
      "ipcMain.handle('capability-pack-enable'",
      "ipcMain.handle('capability-pack-disable'",
      "ipcMain.handle('capability-pack-uninstall'",
    ]) {
      assert.ok(packIpc.includes(ch), ch)
    }
  })

  it('agent-profile IPC lives in src/ipc/agent-profile.js', () => {
    const mod = fs.readFileSync(path.join(__dirname, '..', 'src', 'ipc', 'agent-profile.js'), 'utf8')
    for (const ch of [
      "ipcMain.handle('agent-profile-list'",
      "ipcMain.handle('agent-profile-get'",
      "ipcMain.handle('agent-profile-save'",
      "ipcMain.handle('agent-profile-remove'",
    ]) {
      assert.ok(mod.includes(ch), ch)
    }
  })

  it('agent-session IPC lives in src/ipc/agent-session.js', () => {
    const mod = fs.readFileSync(path.join(__dirname, '..', 'src', 'ipc', 'agent-session.js'), 'utf8')
    for (const ch of [
      "ipcMain.handle('agent-session-list'",
      "ipcMain.handle('agent-session-get'",
      "ipcMain.handle('agent-session-new'",
      "ipcMain.handle('agent-run-update'",
      "ipcMain.handle('agent-artifact-add'",
      "ipcMain.handle('agent-apply-log'",
    ]) {
      assert.ok(mod.includes(ch), ch)
    }
  })

  it('agent-session UI IPC lives in src/ipc/agent-session-ui.js', () => {
    const mod = fs.readFileSync(path.join(__dirname, '..', 'src', 'ipc', 'agent-session-ui.js'), 'utf8')
    for (const ch of [
      "ipcMain.handle('agent-session-set-ui'",
      "ipcMain.handle('agent-session-rename'",
      "ipcMain.handle('agent-session-fork'",
      "ipcMain.handle('agent-session-close-tab'",
    ]) {
      assert.ok(mod.includes(ch), ch)
    }
  })

  it('app-shell IPC lives in src/ipc/app-shell.js', () => {
    const mod = fs.readFileSync(path.join(__dirname, '..', 'src', 'ipc', 'app-shell.js'), 'utf8')
    for (const ch of [
      "ipcMain.on('open-settings'",
      "ipcMain.on('copy-to-clipboard'",
      "ipcMain.handle('import-prompt-space'",
    ]) {
      assert.ok(mod.includes(ch), ch)
    }
  })

  it('logs IPC lives in src/ipc/logs.js', () => {
    const mod = fs.readFileSync(path.join(__dirname, '..', 'src', 'ipc', 'logs.js'), 'utf8')
    for (const ch of [
      "ipcMain.on('app-log'",
      "ipcMain.handle('logs-query'",
      "ipcMain.handle('logs-clear'",
      "ipcMain.on('open-logs-window'",
    ]) {
      assert.ok(mod.includes(ch), ch)
    }
  })

  it('skills IPC lives in src/ipc/skills.js', () => {
    const mod = fs.readFileSync(path.join(__dirname, '..', 'src', 'ipc', 'skills.js'), 'utf8')
    for (const ch of [
      "ipcMain.handle('list-skills'",
      "ipcMain.handle('create-skill'",
    ]) {
      assert.ok(mod.includes(ch), ch)
    }
  })

  it('app-info IPC lives in src/ipc/app-info.js', () => {
    const mod = fs.readFileSync(path.join(__dirname, '..', 'src', 'ipc', 'app-info.js'), 'utf8')
    for (const ch of [
      "ipcMain.handle('app-info'",
      "ipcMain.handle('check-for-updates'",
    ]) {
      assert.ok(mod.includes(ch), ch)
    }
  })

  it('workspace-state IPC lives in src/ipc/workspace-state.js', () => {
    const mod = fs.readFileSync(path.join(__dirname, '..', 'src', 'ipc', 'workspace-state.js'), 'utf8')
    assert.ok(mod.includes("ipcMain.handle('get-workspace-state'"))
    assert.ok(mod.includes("ipcMain.on('save-workspace-state'"))
  })

  it('workspace-init IPC lives in src/ipc/workspace-init.js', () => {
    const mod = fs.readFileSync(path.join(__dirname, '..', 'src', 'ipc', 'workspace-init.js'), 'utf8')
    assert.ok(mod.includes("ipcMain.handle('workspace-init'"))
  })

  it('build-final-prompt IPC lives in src/ipc/build-final-prompt.js', () => {
    const mod = fs.readFileSync(path.join(__dirname, '..', 'src', 'ipc', 'build-final-prompt.js'), 'utf8')
    assert.ok(mod.includes("ipcMain.handle('build-final-prompt'"))
  })

  it('note-layout IPC lives in src/ipc/note-layout.js', () => {
    const mod = fs.readFileSync(path.join(__dirname, '..', 'src', 'ipc', 'note-layout.js'), 'utf8')
    assert.ok(mod.includes("ipcMain.handle('note-set-ai-mode'"))
  })

  it('note context menu IPC lives in src/ipc/note-context-menu.js', () => {
    const mod = fs.readFileSync(path.join(__dirname, '..', 'src', 'ipc', 'note-context-menu.js'), 'utf8')
    assert.ok(mod.includes("ipcMain.on('show-context-menu'"))
    assert.ok(mod.includes("ipcMain.on('show-list-context-menu'"))
  })

  it('ai-assist IPC lives in src/ipc/ai-assist.js', () => {
    const mod = fs.readFileSync(path.join(__dirname, '..', 'src', 'ipc', 'ai-assist.js'), 'utf8')
    assert.ok(mod.includes("ipcMain.handle('ai-suggest-title'"))
    assert.ok(mod.includes("ipcMain.handle('ai-cancel-run'"))
    assert.ok(!mod.includes("ipcMain.handle('ai-generate'"), 'ai-generate stays separate')
  })

  it('ai-generate IPC lives in src/ipc/ai-generate.js', () => {
    const mod = fs.readFileSync(path.join(__dirname, '..', 'src', 'ipc', 'ai-generate.js'), 'utf8')
    assert.ok(mod.includes("ipcMain.handle('ai-generate'"))
    assert.ok(!mod.includes("ipcMain.handle('ai-cancel-run'"), 'cancel-run stays in ai-assist')
  })

  it('main wires registerCoreIpc with no inline ipcMain handlers', () => {
    const main = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8')
    assert.ok(main.includes("require('./ipc')"))
    assert.ok(main.includes('registerCoreIpc(ipcMain'))
    assert.ok(!main.includes("ipcMain.handle('sources-list'"))
    assert.ok(!main.includes("ipcMain.handle('open-external'"))
    assert.ok(!main.includes("ipcMain.handle('memory-status'"))
    assert.ok(!main.includes("ipcMain.handle('notes-export'"))
    assert.ok(!main.includes("ipcMain.handle('knowledge-os-list'"))
    assert.ok(!main.includes("ipcMain.handle('knowledge-steward-task-list'"))
    assert.ok(!main.includes("ipcMain.handle('knowledge-provider-list'"))
    assert.ok(!main.includes("ipcMain.handle('fabric-graph'"))
    assert.ok(!main.includes("ipcMain.handle('kb-mount'"))
    assert.ok(!main.includes("ipcMain.handle('connectors-list'"))
    assert.ok(!main.includes("ipcMain.handle('tool-approve-draft'"))
    assert.ok(!main.includes("ipcMain.handle('workbench-todo-list'"))
    assert.ok(!main.includes("ipcMain.handle('workbench-launch-assess'"))
    assert.ok(!main.includes("ipcMain.handle('workbench-auth-status'"))
    assert.ok(!main.includes("ipcMain.handle('workbench-daemon-overview'"))
    assert.ok(!main.includes("ipcMain.handle('workbench-bootstrap-status'"))
    assert.ok(!main.includes("ipcMain.handle('workbench-load'"))
    assert.ok(!main.includes("ipcMain.handle('workbench-pick-files'"))
    assert.ok(!main.includes("ipcMain.handle('workbench-agent-graph-plan'"))
    assert.ok(!main.includes("ipcMain.handle('workbench-dispatch'"))
    assert.ok(!main.includes("ipcMain.handle('agent-run-tree'"))
    assert.ok(!main.includes("ipcMain.on('note-update'"))
    assert.ok(!main.includes("ipcMain.handle('workspace-new-note'"))
    assert.ok(!main.includes("ipcMain.on('note-toggle-favorite'"))
    assert.ok(!main.includes("ipcMain.handle('notes-batch-classify'"))
    assert.ok(!main.includes("ipcMain.handle('suggest-classification'"))
    assert.ok(!main.includes("ipcMain.handle('game-studio-scenes'"))
    assert.ok(!main.includes("ipcMain.handle('game-requirement-build'"))
    assert.ok(!main.includes("ipcMain.handle('game-workbench-handoff'"))
    assert.ok(!main.includes("ipcMain.handle('capability-pack-list'"))
    assert.ok(!main.includes("ipcMain.handle('capability-pack-install'"))
    assert.ok(!main.includes("ipcMain.handle('agent-profile-list'"))
    assert.ok(!main.includes("ipcMain.handle('agent-session-list'"))
    assert.ok(!main.includes("ipcMain.handle('agent-run-update'"))
    assert.ok(!main.includes("ipcMain.handle('list-skills'"))
    assert.ok(!main.includes("ipcMain.handle('logs-query'"))
    assert.ok(!main.includes("ipcMain.on('open-settings'"))
    assert.ok(!main.includes("ipcMain.handle('app-info'"))
    assert.ok(!main.includes("ipcMain.handle('workspace-init'"))
    assert.ok(!main.includes("ipcMain.handle('build-final-prompt'"))
    assert.ok(!main.includes("ipcMain.handle('get-workspace-state'"))
    assert.ok(!main.includes("ipcMain.handle('note-set-ai-mode'"))
    assert.ok(!main.includes("ipcMain.on('show-context-menu'"))
    assert.ok(!main.includes("ipcMain.handle('ai-suggest-title'"))
    assert.ok(!main.includes("ipcMain.handle('ai-generate'"))
    assert.ok(!main.match(/ipcMain\.(handle|on)\('/), 'no inline ipcMain handlers in main.js')
    assert.ok(main.includes('function ensureCapabilityPackRuntime'), 'pack runtime helper stays')
    assert.ok(main.includes('function buildFabricCtx'), 'fabric helpers stay in main')
    assert.ok(main.includes('getConnectorsApi,'), 'connectors deps wired')
    assert.ok(main.includes('loadWorkbenchDaemonOverview,'), 'daemon deps wired')
    assert.ok(main.includes('listLocalWorkbenchAgents,'), 'load deps wired')
    assert.ok(main.includes('compileWorkbenchAgentGraphPayload,'), 'agent-graph deps wired')
    assert.ok(main.includes('getAgentTeamRuntime:'), 'agent-run-control deps wired')
    assert.ok(main.includes('clearLastClosedIf:'), 'notes deps wired')
    assert.ok(main.includes('chatCompletionOnce,'), 'notes-classify deps wired')
    assert.ok(main.includes('gameWorkbenchHandoff,'), 'game deps wired')
    assert.ok(main.includes('ensureCapabilityPackRuntime,'), 'capability-pack deps wired')
    assert.ok(main.includes('getAgentProfileStore,'), 'agent-profile deps wired')
    assert.ok(main.includes('agentSessions,'), 'agent-session deps wired')
    assert.ok(main.includes('openLogViewer,'), 'logs deps wired')
    assert.ok(main.includes('checkForUpdatesManual,'), 'app-info deps wired')
    assert.ok(main.includes('applyNoteLayout,'), 'note-layout deps wired')
    assert.ok(main.includes('buildMissingResourceHint,'), 'ai-generate deps wired')
    assert.ok(main.includes('agentRuntimePortFactories,'), 'ai-generate runtime deps wired')
  })

  it('workspace loads workbench helpers before workbench.js', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace.html'), 'utf8')
    const order = [
      'workbench/provenance.js',
      'workbench/escape.js',
      'workbench/run-phase.js',
      'workbench/labels.js',
      'workbench.js',
    ]
    let last = -1
    for (const name of order) {
      const idx = html.indexOf(name)
      assert.ok(idx > last, name)
      last = idx
    }
  })

  it('workbench labels map backends and sources', () => {
    const { consoleSourceLabel, executionBackendLabel, workflowSourceLabel } = require('../src/workbench/labels')
    assert.equal(consoleSourceLabel('daemon'), '管线服务')
    assert.equal(executionBackendLabel({ executionSource: 'local-team' }), '本机专家团队')
    assert.equal(workflowSourceLabel('official'), '官方专业管线')
  })
})
