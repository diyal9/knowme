'use strict'

/**
 * Capability pack discover / install / enable / disable / uninstall IPC.
 * Runtime helper stays in main via deps.
 */
function registerCapabilityPackIpc(ipcMain, deps) {
  const { ensureCapabilityPackRuntime } = deps

  ipcMain.handle('capability-pack-list', () => {
    const rt = ensureCapabilityPackRuntime()
    return { ok: true, packs: rt.discoverPacks() }
  })

  ipcMain.handle('capability-pack-empty-state', () => {
    const rt = ensureCapabilityPackRuntime()
    return { ok: true, groups: rt.listEmptyStateGroups() }
  })

  ipcMain.handle('capability-pack-install', (_e, payload = {}) => {
    const rt = ensureCapabilityPackRuntime()
    const packId = String(payload.packId || payload.id || '').trim()
    if (!packId) return { ok: false, error: '缺少 packId' }
    return rt.installPack(packId, payload.source || 'bundled')
  })

  ipcMain.handle('capability-pack-enable', (_e, payload = {}) => {
    const rt = ensureCapabilityPackRuntime()
    const packId = String(payload.packId || payload.id || '').trim()
    if (!packId) return { ok: false, error: '缺少 packId' }
    return rt.enablePack(packId)
  })

  ipcMain.handle('capability-pack-disable', (_e, payload = {}) => {
    const rt = ensureCapabilityPackRuntime()
    const packId = String(payload.packId || payload.id || '').trim()
    if (!packId) return { ok: false, error: '缺少 packId' }
    return rt.disablePack(packId)
  })

  ipcMain.handle('capability-pack-uninstall', (_e, payload = {}) => {
    const rt = ensureCapabilityPackRuntime()
    const packId = String(payload.packId || payload.id || '').trim()
    if (!packId) return { ok: false, error: '缺少 packId' }
    return rt.uninstallPack(packId)
  })
}

module.exports = { registerCapabilityPackIpc }
