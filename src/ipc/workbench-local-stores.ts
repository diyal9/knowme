'use strict'

const { enrichExternalWorkflowPackage } = require('../lib/external-workflow-recipes')

/**
 * Workbench local stores: todo / task draft / task / workflow-package.
 */
function registerWorkbenchLocalStoresIpc(ipcMain, deps) {
  const {
    getWorkbenchTodoStore,
    getWorkbenchTaskDraftStore,
    getWorkbenchTaskStore,
    getWorkbenchWorkflowPackageStore,
  } = deps

  ipcMain.handle('workbench-todo-list', () => getWorkbenchTodoStore().list())
  ipcMain.handle('workbench-todo-add', (_e, text) =>
    getWorkbenchTodoStore().add(String(text || '')))
  ipcMain.handle('workbench-todo-toggle', (_e, id) =>
    getWorkbenchTodoStore().toggle(String(id || '')))
  ipcMain.handle('workbench-todo-remove', (_e, id) =>
    getWorkbenchTodoStore().remove(String(id || '')))
  ipcMain.handle('workbench-todo-clear-done', () => getWorkbenchTodoStore().clearDone())
  ipcMain.handle('workbench-todo-import-legacy', (_e, items) =>
    getWorkbenchTodoStore().importLegacy(Array.isArray(items) ? items : []))

  ipcMain.handle('workbench-task-draft-get', () => getWorkbenchTaskDraftStore().get())
  ipcMain.handle('workbench-task-draft-save', (_e, patch = {}) =>
    getWorkbenchTaskDraftStore().save(patch))
  ipcMain.handle('workbench-task-draft-clear', () => getWorkbenchTaskDraftStore().clear())
  ipcMain.handle('workbench-task-list', () => getWorkbenchTaskStore().list())
  ipcMain.handle('workbench-task-get', (_e, id = '') => getWorkbenchTaskStore().get(id))
  ipcMain.handle('workbench-task-create', (_e, input = {}) =>
    getWorkbenchTaskStore().create(input || {}))
  ipcMain.handle('workbench-task-update', (_e, payload = {}) =>
    getWorkbenchTaskStore().update(payload?.id, payload?.patch || {}))
  ipcMain.handle('workbench-task-archive', (_e, id = '') =>
    getWorkbenchTaskStore().archive(id))

  ipcMain.handle('workbench-workflow-package-list', (_e, filter = {}) => {
    const result = getWorkbenchWorkflowPackageStore().list(filter || {})
    return result?.ok && Array.isArray(result.packages)
      ? { ...result, packages: result.packages.map(enrichExternalWorkflowPackage) }
      : result
  })
  ipcMain.handle('workbench-workflow-package-get', (_e, id) => {
    try {
      const result = getWorkbenchWorkflowPackageStore().get(String(id || ''))
      return result?.ok && result.package
        ? { ...result, package: enrichExternalWorkflowPackage(result.package) }
        : result
    } catch (error) {
      return { ok: false, error: (error && error.message) || '无法读取流程' }
    }
  })
  ipcMain.handle('workbench-workflow-package-save', (_e, payload = {}) =>
    getWorkbenchWorkflowPackageStore().save(payload.package || payload, {
      supportedBackends: ['local-team', 'daemon', 'legacy-local'],
    }))
  ipcMain.handle('workbench-workflow-package-fork', (_e, id, options = {}) => {
    const store = getWorkbenchWorkflowPackageStore()
    const packageId = String(id || '')
    if (!store.get(packageId).ok && options?.package) {
      const seeded = store.save({
        ...options.package,
        id: packageId,
        source: options.package.source === 'team' ? 'team' : 'official',
        status: 'published',
      }, { allowOfficial: true })
      if (!seeded.ok) return seeded
    }
    return store.fork(packageId, options || {})
  })
  ipcMain.handle('workbench-workflow-package-archive', (_e, id) =>
    getWorkbenchWorkflowPackageStore().archive(String(id || '')))
}

module.exports = { registerWorkbenchLocalStoresIpc }
