'use strict'

const { createExpertTaskRuntime } = require('../lib/expert-task-runtime')

function registerExpertTaskIpc(ipcMain, deps) {
  const runtime = createExpertTaskRuntime(deps)
  queueMicrotask(() => { void runtime.recoverQueuedTasks() })
  ipcMain.handle('expert-task-prepare-plan-confirmation', (_event, payload = {}) => runtime.preparePlanConfirmation(payload))
  ipcMain.handle('expert-task-create-start', (_event, payload = {}) => runtime.createStart(payload))
  ipcMain.handle('expert-task-provide-input', (_event, payload = {}) => runtime.provideInput(payload))
  ipcMain.handle('expert-task-review-deliverable', (_event, payload = {}) => runtime.reviewDeliverable(payload))
  ipcMain.handle('expert-task-cancel', (_event, id) => runtime.cancel(id))
  ipcMain.handle('expert-task-retry', (_event, id) => runtime.retry(id))
  // Opening or polling a room is a read path. Runtime reconciliation can scan
  // capability packages, restore sessions, and validate artifacts synchronously;
  // keeping that work out of this IPC prevents it from stalling Electron's main
  // thread every time the expert room refreshes.
  ipcMain.handle('expert-task-get', (_event, id) => deps.getWorkbenchTaskStore().get(id))
  ipcMain.handle('expert-task-list', () => deps.getWorkbenchTaskStore().list())
}

module.exports = { registerExpertTaskIpc }
