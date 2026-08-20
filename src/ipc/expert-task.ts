'use strict'

const { createExpertTaskRuntime } = require('../lib/expert-task-runtime')

function registerExpertTaskIpc(ipcMain, deps) {
  const runtime = createExpertTaskRuntime(deps)
  ipcMain.handle('expert-task-create-start', (_event, payload = {}) => runtime.createStart(payload))
  ipcMain.handle('expert-task-provide-input', (_event, payload = {}) => runtime.provideInput(payload))
  ipcMain.handle('expert-task-review-deliverable', (_event, payload = {}) => runtime.reviewDeliverable(payload))
  ipcMain.handle('expert-task-cancel', (_event, id) => runtime.cancel(id))
  ipcMain.handle('expert-task-retry', (_event, id) => runtime.retry(id))
  ipcMain.handle('expert-task-get', (_event, id) => runtime.get(id))
  ipcMain.handle('expert-task-list', () => deps.getWorkbenchTaskStore().list())
}

module.exports = { registerExpertTaskIpc }
