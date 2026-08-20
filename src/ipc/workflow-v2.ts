'use strict'

const { createWorkflowV2Runtime } = require('../lib/workflow-v2-runtime')

function registerWorkflowV2Ipc(ipcMain, deps) {
  const runtime = createWorkflowV2Runtime({
    userData: deps.DATA_DIR,
    workflowStore: deps.getWorkbenchWorkflowPackageStore(),
    actionCatalog: () => {
      const catalog = deps.ensureCapabilityHub?.().catalogApi?.listCatalog?.()
      return catalog?.items || []
    },
  })
  ipcMain.handle('workflow-action-catalog', () => runtime.actionCatalog())
  ipcMain.handle('workflow-validate', (_e, payload = {}) => runtime.validate(payload))
  ipcMain.handle('workflow-publish', (_e, payload = {}) => runtime.publish(payload))
  ipcMain.handle('workflow-run-start', (_e, payload = {}) => runtime.start(payload))
  ipcMain.handle('workflow-run-get', (_e, id) => runtime.get(id))
  ipcMain.handle('workflow-run-pause', (_e, payload = {}) => runtime.pause(payload.runId, payload))
  ipcMain.handle('workflow-run-resume', (_e, payload = {}) => runtime.resume(payload.runId, payload))
  ipcMain.handle('workflow-run-submit-human', (_e, payload = {}) => runtime.submitHuman(payload.runId, payload.nodeId, payload))
  ipcMain.handle('workflow-run-submit-gate', (_e, payload = {}) => runtime.submitGate(payload.runId, payload.nodeId, payload))
  ipcMain.handle('workflow-run-intervene', (_e, payload = {}) => runtime.intervene(payload.runId, payload))
  ipcMain.handle('workflow-run-rerun', (_e, payload = {}) => runtime.rerun(payload.runId, payload))
  ipcMain.handle('workflow-run-substitute', (_e, payload = {}) => runtime.substitute(payload.runId, payload))
  ipcMain.handle('workflow-run-comment', (_e, payload = {}) => runtime.comment(payload.runId, payload))
}

module.exports = { registerWorkflowV2Ipc }
