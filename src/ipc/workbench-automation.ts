'use strict'

/**
 * Workbench automation CRUD + Feishu target lookup.
 */
function registerWorkbenchAutomationIpc(ipcMain, deps) {
  const {
    getWorkbenchAutomationStore,
    getConnectorsApi,
    ensureFeishuConnectorReady,
    toTargetItems,
    feishuCli,
  } = deps

  ipcMain.handle('workbench-automation-list', () => getWorkbenchAutomationStore().list())
  ipcMain.handle('workbench-automation-create', (_e, payload = {}) =>
    getWorkbenchAutomationStore().create(payload))
  ipcMain.handle('workbench-automation-update', (_e, id, patch = {}) =>
    getWorkbenchAutomationStore().update(String(id || ''), patch))
  ipcMain.handle('workbench-automation-delete', (_e, id) =>
    getWorkbenchAutomationStore().remove(String(id || '')))
  ipcMain.handle('workbench-automation-toggle', (_e, id, enabled) =>
    getWorkbenchAutomationStore().toggle(String(id || ''), enabled === true))

  ipcMain.handle('workbench-automation-feishu-targets', async (_e, payload = {}) => {
    const mode = String(payload.mode || 'chat').trim() === 'user' ? 'user' : 'chat'
    const query = String(payload.query || '').trim()
    const limit = Math.max(1, Math.min(30, Number(payload.limit || 20)))
    const statusRes = await getConnectorsApi().getConnectorStatus('feishu')
    if (!statusRes || !statusRes.ok) {
      return { ok: false, error: '读取飞书连接器状态失败' }
    }
    const gate = ensureFeishuConnectorReady(statusRes.connector)
    if (!gate.ok) return gate
    if (mode === 'user') {
      const res = await feishuCli.listFeishuUsers({ query, page_size: limit })
      if (!res.ok) {
        const msg = String(res.message || '').trim()
        if (/权限不足|forbidden|unauthorized|401|403|scope|permission/i.test(msg)) {
          return { ok: false, error: '飞书权限不足，无法获取用户列表。请补齐通讯录读取权限并重新授权。' }
        }
        return { ok: false, error: msg || '读取飞书联系人失败' }
      }
      return { ok: true, mode, items: toTargetItems(res.items, 'user') }
    }
    const res = await feishuCli.listFeishuChats({ query, page_size: limit })
    if (!res.ok) {
      const msg = String(res.message || '').trim()
      if (/权限不足|forbidden|unauthorized|401|403|scope|permission/i.test(msg)) {
        return { ok: false, error: '飞书权限不足，无法获取群会话列表。请补齐会话列表读取权限并重新授权。' }
      }
      return { ok: false, error: msg || '读取飞书群列表失败' }
    }
    return { ok: true, mode, items: toTargetItems(res.items, 'chat') }
  })

  ipcMain.handle('workbench-automation-run-now', (_e, id) =>
    getWorkbenchAutomationStore().runNow(String(id || '')))
}

module.exports = { registerWorkbenchAutomationIpc }
