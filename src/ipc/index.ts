'use strict'

/**
 * Core IPC registration. Receives createIpcGroups() and pick()s per channel.
 * Add new domain modules here; keep main as composition root.
 */

const { registerOpenExternalIpc } = require('./open-external')
const { registerSettingsIpc } = require('./settings')
const { registerSourcesIpc } = require('./sources')
const { registerMemoryIpc } = require('./memory')
const { registerProductKnowledgeIpc } = require('./product-knowledge')
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
const { registerGameIpc } = require('./game')
const { registerCapabilityPackIpc } = require('./capability-pack')
const { registerAgentProfileIpc } = require('./agent-profile')
const { registerPersonalAgentIpc } = require('./personal-agent')
const { registerExpertTaskIpc } = require('./expert-task')
const { registerWorkflowV2Ipc } = require('./workflow-v2')
const { registerAgentSessionIpc } = require('./agent-session')
const { registerAgentSessionUiIpc } = require('./agent-session-ui')
const { registerAppShellIpc } = require('./app-shell')
const { registerLogsIpc } = require('./logs')
const { registerSkillsIpc } = require('./skills')
const { registerAppInfoIpc } = require('./app-info')
const { registerWorkspaceStateIpc } = require('./workspace-state')
const { registerWorkspaceInitIpc } = require('./workspace-init')
const { registerBuildFinalPromptIpc } = require('./build-final-prompt')
const { registerAiAssistIpc } = require('./ai-assist')
const { registerAgentOutputFixtureIpc } = require('./agent-output-fixture')
const { registerAiGenerateIpc } = require('./ai-generate')
const { registerAttentionNotifyIpc } = require('./attention-notify')

/** 从 createIpcGroups 的结果里挑域，拼成 registrar 仍认识的扁平袋。 */
function pick(groups, ...names) {
  const out = {}
  for (const name of names) {
    Object.assign(out, groups[name] || {})
  }
  return out
}

const ALL_DOMAINS = ['electron', 'paths', 'knowledge', 'workbench', 'agent', 'notesCompat', 'shell']

function registerCoreIpc(ipcMain, groups) {
  registerOpenExternalIpc(ipcMain, pick(groups, 'electron'))
  registerSettingsIpc(ipcMain, pick(groups, 'electron', 'paths', 'knowledge', 'shell'))
  registerSourcesIpc(ipcMain, pick(groups, 'electron', 'paths', 'knowledge', 'shell'))
  registerMemoryIpc(ipcMain, pick(groups, 'electron', 'paths', 'knowledge'))
  registerProductKnowledgeIpc(ipcMain, pick(groups, 'electron', 'paths', 'knowledge', 'shell'))
  registerKnowledgeOsIpc(ipcMain, pick(groups, 'electron', 'paths', 'knowledge'))
  registerKnowledgeStewardIpc(ipcMain, pick(groups, 'electron', 'paths', 'knowledge', 'agent'))
  registerKnowledgeProviderIpc(ipcMain, pick(groups, 'electron', 'paths', 'knowledge'))
  registerFabricIpc(ipcMain, pick(groups, 'electron', 'paths', 'knowledge'))
  registerConnectorsIpc(ipcMain, pick(groups, 'electron', 'paths', 'knowledge', 'agent'))
  registerWorkbenchAuthIpc(ipcMain, pick(groups, 'paths', 'workbench'))
  registerWorkbenchLocalStoresIpc(ipcMain, pick(groups, 'workbench'))
  registerWorkbenchLaunchIpc(ipcMain, pick(groups, 'workbench'))
  registerWorkbenchModeIpc(ipcMain, pick(groups, 'workbench', 'agent'))
  registerWorkbenchAutomationIpc(ipcMain, pick(groups, 'workbench', 'agent'))
  registerWorkbenchBootstrapIpc(ipcMain, pick(groups, 'paths', 'workbench'))
  registerWorkbenchDaemonIpc(ipcMain, pick(groups, 'electron', 'paths', 'knowledge', 'workbench'))
  registerWorkbenchLoadIpc(ipcMain, pick(groups, ...ALL_DOMAINS))
  registerWorkbenchAgentGraphIpc(ipcMain, pick(groups, 'electron', 'paths', 'workbench', 'agent'))
  registerAgentRunControlIpc(ipcMain, pick(groups, 'agent'))
  registerWorkbenchDispatchIpc(ipcMain, pick(groups, 'electron', 'paths', 'knowledge', 'agent'))
  registerGameIpc(ipcMain, pick(groups, 'knowledge', 'workbench', 'agent'))
  registerCapabilityPackIpc(ipcMain, pick(groups, 'agent'))
  registerAgentProfileIpc(ipcMain, pick(groups, 'knowledge', 'agent'))
  registerPersonalAgentIpc(ipcMain, pick(groups, 'paths', 'knowledge', 'workbench', 'agent'))
  registerExpertTaskIpc(ipcMain, pick(groups, 'paths', 'knowledge', 'workbench', 'agent'))
  registerWorkflowV2Ipc(ipcMain, pick(groups, 'paths', 'workbench', 'agent'))
  registerAgentSessionIpc(ipcMain, pick(groups, ...ALL_DOMAINS))
  registerAgentSessionUiIpc(ipcMain, pick(groups, 'agent'))
  registerAppShellIpc(ipcMain, pick(groups, 'electron', 'paths', 'shell'))
  registerLogsIpc(ipcMain, pick(groups, 'electron', 'paths', 'shell'))
  registerSkillsIpc(ipcMain, pick(groups, 'paths', 'knowledge', 'agent'))
  registerAppInfoIpc(ipcMain, pick(groups, 'electron', 'shell'))
  registerWorkspaceStateIpc(ipcMain, pick(groups, 'paths'))
  registerWorkspaceInitIpc(ipcMain, pick(groups, ...ALL_DOMAINS))
  registerBuildFinalPromptIpc(ipcMain, pick(groups, 'paths', 'notesCompat'))
  registerAiAssistIpc(ipcMain, pick(groups, ...ALL_DOMAINS))
  registerAgentOutputFixtureIpc(ipcMain)
  registerAiGenerateIpc(ipcMain, pick(groups, ...ALL_DOMAINS))
  registerAttentionNotifyIpc(ipcMain, pick(groups, 'electron', 'shell'))
}

module.exports = {
  registerCoreIpc,
  pick,
  registerOpenExternalIpc,
  registerSettingsIpc,
  registerSourcesIpc,
  registerMemoryIpc,
  registerProductKnowledgeIpc,
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
  registerGameIpc,
  registerCapabilityPackIpc,
  registerAgentProfileIpc,
  registerPersonalAgentIpc,
  registerExpertTaskIpc,
  registerWorkflowV2Ipc,
  registerAgentSessionIpc,
  registerAgentSessionUiIpc,
  registerAppShellIpc,
  registerLogsIpc,
  registerSkillsIpc,
  registerAppInfoIpc,
  registerWorkspaceStateIpc,
  registerWorkspaceInitIpc,
  registerBuildFinalPromptIpc,
  registerAiAssistIpc,
  registerAgentOutputFixtureIpc,
  registerAiGenerateIpc,
}
