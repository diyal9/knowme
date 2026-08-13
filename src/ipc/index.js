'use strict'

/**
 * Core IPC registration (strangler entry).
 * Add new domain modules here; keep main.js as composition root.
 */

const { registerOpenExternalIpc } = require('./open-external')
const { registerSettingsIpc } = require('./settings')
const { registerSourcesIpc } = require('./sources')
const { registerMemoryIpc } = require('./memory')
const { registerProductKnowledgeIpc } = require('./product-knowledge')
const { registerNotesBackupIpc } = require('./notes-backup')
const { registerKnowledgeOsIpc } = require('./knowledge-os')
const { registerKnowledgeStewardIpc } = require('./knowledge-steward')
const { registerKnowledgeProviderIpc } = require('./knowledge-provider')
const { registerFabricIpc } = require('./fabric')
const { registerConnectorsIpc } = require('./connectors')
const { registerWorkbenchAuthIpc } = require('./workbench-auth')
const { registerWorkbenchLocalStoresIpc } = require('./workbench-local-stores')
const { registerWorkbenchLaunchIpc } = require('./workbench-launch')
const { registerWorkbenchModeIpc } = require('./workbench-mode')
const { registerWorkbenchAutomationIpc } = require('./workbench-automation')
const { registerWorkbenchBootstrapIpc } = require('./workbench-bootstrap')
const { registerWorkbenchDaemonIpc } = require('./workbench-daemon')
const { registerWorkbenchLoadIpc } = require('./workbench-load')
const { registerWorkbenchAgentGraphIpc } = require('./workbench-agent-graph')
const { registerAgentRunControlIpc } = require('./agent-run-control')
const { registerWorkbenchDispatchIpc } = require('./workbench-dispatch')
const { registerNotesIpc } = require('./notes')
const { registerGameIpc } = require('./game')
const { registerCapabilityPackIpc } = require('./capability-pack')
const { registerAgentProfileIpc } = require('./agent-profile')
const { registerAgentSessionIpc } = require('./agent-session')
const { registerAgentSessionUiIpc } = require('./agent-session-ui')
const { registerAppShellIpc } = require('./app-shell')
const { registerLogsIpc } = require('./logs')
const { registerSkillsIpc } = require('./skills')
const { registerAppInfoIpc } = require('./app-info')
const { registerWorkspaceStateIpc } = require('./workspace-state')
const { registerWorkspaceInitIpc } = require('./workspace-init')
const { registerBuildFinalPromptIpc } = require('./build-final-prompt')
const { registerNoteLayoutIpc } = require('./note-layout')
const { registerNoteContextMenuIpc } = require('./note-context-menu')
const { registerAiAssistIpc } = require('./ai-assist')
const { registerAgentOutputFixtureIpc } = require('./agent-output-fixture')
const { registerAiGenerateIpc } = require('./ai-generate')
const { registerAttentionNotifyIpc } = require('./attention-notify')

function registerCoreIpc(ipcMain, deps) {
  registerOpenExternalIpc(ipcMain, deps)
  registerSettingsIpc(ipcMain, deps)
  registerSourcesIpc(ipcMain, deps)
  registerMemoryIpc(ipcMain, deps)
  registerProductKnowledgeIpc(ipcMain, deps)
  registerNotesBackupIpc(ipcMain, deps)
  registerKnowledgeOsIpc(ipcMain, deps)
  registerKnowledgeStewardIpc(ipcMain, deps)
  registerKnowledgeProviderIpc(ipcMain, deps)
  registerFabricIpc(ipcMain, deps)
  registerConnectorsIpc(ipcMain, deps)
  registerWorkbenchAuthIpc(ipcMain, deps)
  registerWorkbenchLocalStoresIpc(ipcMain, deps)
  registerWorkbenchLaunchIpc(ipcMain, deps)
  registerWorkbenchModeIpc(ipcMain, deps)
  registerWorkbenchAutomationIpc(ipcMain, deps)
  registerWorkbenchBootstrapIpc(ipcMain, deps)
  registerWorkbenchDaemonIpc(ipcMain, deps)
  registerWorkbenchLoadIpc(ipcMain, deps)
  registerWorkbenchAgentGraphIpc(ipcMain, deps)
  registerAgentRunControlIpc(ipcMain, deps)
  registerWorkbenchDispatchIpc(ipcMain, deps)
  registerNotesIpc(ipcMain, deps)
  registerGameIpc(ipcMain, deps)
  registerCapabilityPackIpc(ipcMain, deps)
  registerAgentProfileIpc(ipcMain, deps)
  registerAgentSessionIpc(ipcMain, deps)
  registerAgentSessionUiIpc(ipcMain, deps)
  registerAppShellIpc(ipcMain, deps)
  registerLogsIpc(ipcMain, deps)
  registerSkillsIpc(ipcMain, deps)
  registerAppInfoIpc(ipcMain, deps)
  registerWorkspaceStateIpc(ipcMain, deps)
  registerWorkspaceInitIpc(ipcMain, deps)
  registerBuildFinalPromptIpc(ipcMain, deps)
  registerNoteLayoutIpc(ipcMain, deps)
  registerNoteContextMenuIpc(ipcMain, deps)
  registerAiAssistIpc(ipcMain, deps)
  registerAgentOutputFixtureIpc(ipcMain)
  registerAiGenerateIpc(ipcMain, deps)
  registerAttentionNotifyIpc(ipcMain, deps)
}

module.exports = {
  registerCoreIpc,
  registerOpenExternalIpc,
  registerSettingsIpc,
  registerSourcesIpc,
  registerMemoryIpc,
  registerProductKnowledgeIpc,
  registerNotesBackupIpc,
  registerKnowledgeOsIpc,
  registerKnowledgeStewardIpc,
  registerKnowledgeProviderIpc,
  registerFabricIpc,
  registerConnectorsIpc,
  registerWorkbenchAuthIpc,
  registerWorkbenchLocalStoresIpc,
  registerWorkbenchLaunchIpc,
  registerWorkbenchModeIpc,
  registerWorkbenchAutomationIpc,
  registerWorkbenchBootstrapIpc,
  registerWorkbenchDaemonIpc,
  registerWorkbenchLoadIpc,
  registerWorkbenchAgentGraphIpc,
  registerAgentRunControlIpc,
  registerWorkbenchDispatchIpc,
  registerNotesIpc,
  registerGameIpc,
  registerCapabilityPackIpc,
  registerAgentProfileIpc,
  registerAgentSessionIpc,
  registerAgentSessionUiIpc,
  registerAppShellIpc,
  registerLogsIpc,
  registerSkillsIpc,
  registerAppInfoIpc,
  registerWorkspaceStateIpc,
  registerWorkspaceInitIpc,
  registerBuildFinalPromptIpc,
  registerNoteLayoutIpc,
  registerNoteContextMenuIpc,
  registerAiAssistIpc,
  registerAgentOutputFixtureIpc,
  registerAiGenerateIpc,
}
