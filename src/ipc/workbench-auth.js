'use strict'

/**
 * Workbench auth status / login / logout.
 */
function registerWorkbenchAuthIpc(ipcMain, deps) {
  const {
    loadSettings,
    saveSettings_,
    getWorkbenchDaemonClient,
    publicWorkbenchAuthStatus,
    workbenchAuth,
    notifyWorkbenchAuthChanged,
  } = deps

  ipcMain.handle('workbench-auth-status', async () => {
    const settings = loadSettings()
    let health = null
    try {
      health = await getWorkbenchDaemonClient().overview().then(res => res.health || null)
    } catch {
      health = null
    }
    return { ok: true, auth: publicWorkbenchAuthStatus(settings, health) }
  })

  ipcMain.handle('workbench-auth-login', async (_e, payload = {}) => {
    const endpoint = String(payload.endpoint || loadSettings().workbenchAuth?.endpoint || '').trim()
      || 'http://127.0.0.1:8010'
    const result = await workbenchAuth.login({
      endpoint,
      key: payload.key,
      tenantId: payload.tenantId,
    })
    if (!result.ok) return result
    const current = loadSettings()
    const saved = saveSettings_({
      ...current,
      workbenchToken: result.token,
      workbenchAuth: {
        ...(current.workbenchAuth || {}),
        endpoint,
        tenantId: result.tenantId || '',
        tier: result.tier || '',
        user: result.user || '',
        configuredAt: new Date().toISOString(),
      },
    })
    if (!saved.ok) {
      return { ok: false, code: 'storage_unavailable', error: saved.warning || '无法安全保存 Workbench 授权' }
    }
    const auth = publicWorkbenchAuthStatus(loadSettings(), { auth_enabled: true })
    notifyWorkbenchAuthChanged(auth)
    return { ok: true, auth }
  })

  ipcMain.handle('workbench-auth-logout', () => {
    const current = loadSettings()
    const patch = workbenchAuth.clearedAuthPatch()
    saveSettings_({ ...current, ...patch })
    const auth = publicWorkbenchAuthStatus(loadSettings())
    notifyWorkbenchAuthChanged(auth)
    return { ok: true, auth }
  })
}

module.exports = { registerWorkbenchAuthIpc }
