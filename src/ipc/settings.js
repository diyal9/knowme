'use strict'

/**
 * Settings + remote-config + llm catalog IPC.
 *
 * @param {import('electron').IpcMain} ipcMain
 * @param {object} deps
 * @param {() => object} deps.loadSettings
 * @param {(s: object) => unknown} deps.saveSettings_
 * @param {() => import('electron').BrowserWindow | null} deps.getSettingsWin
 * @param {typeof import('../lib/settings-secure')} deps.settingsSecure
 * @param {(rc: object) => object} deps.normalizeRemoteConfig
 * @param {(enabled: object) => { fetchPublic: () => Promise<object> }} deps.createRemoteConfigClient
 * @param {(settings: object, config: object) => object} deps.mergeOrgPublicConfig
 * @param {typeof import('../lib/llm-model-catalog')} deps.llmModelCatalog
 */
function registerSettingsIpc(ipcMain, deps) {
  const {
    loadSettings,
    saveSettings_,
    getSettingsWin,
    settingsSecure,
    normalizeRemoteConfig,
    createRemoteConfigClient,
    mergeOrgPublicConfig,
    llmModelCatalog,
  } = deps

  function includeSecretsFor(sender) {
    const settingsWin = getSettingsWin()
    return !!(settingsWin && !settingsWin.isDestroyed() && sender
      && settingsWin.webContents.id === sender.id)
  }

  ipcMain.handle('save-settings', (_e, s) => saveSettings_(s))

  ipcMain.handle('remote-config-save-prefs', (_e, prefs = {}) => {
    const s = loadSettings()
    const rc = normalizeRemoteConfig({ ...s.remoteConfig, ...prefs })
    const next = { ...s, remoteConfig: rc }
    if (!rc.enabled) next.orgManaged = false
    saveSettings_(next)
    return { ok: true, remoteConfig: rc, orgManaged: next.orgManaged === true }
  })

  ipcMain.handle('remote-config-pull', async (e) => {
    const s = loadSettings()
    const rc = normalizeRemoteConfig(s.remoteConfig)
    if (!rc.enabled) {
      return { ok: false, code: 'disabled', remoteConfig: rc }
    }
    const client = createRemoteConfigClient({ enabled: true, endpoint: rc.endpoint })
    const result = await client.fetchPublic()
    const now = new Date().toISOString()
    if (!result.ok) {
      const nextRc = { ...rc, lastOk: false, lastError: result.error || '拉取失败', fetchedAt: now }
      saveSettings_({ ...s, remoteConfig: nextRc, orgManaged: false })
      return { ok: false, error: result.error, remoteConfig: nextRc }
    }
    const merged = mergeOrgPublicConfig(s, result.config)
    const nextRc = {
      ...rc,
      lastOk: true,
      lastError: '',
      updatedAt: result.updatedAt || now,
      fetchedAt: now,
    }
    saveSettings_({ ...merged, remoteConfig: nextRc, orgManaged: true })
    return {
      ok: true,
      remoteConfig: nextRc,
      settings: settingsSecure.publicSettings(loadSettings(), {
        includeSecrets: includeSecretsFor(e?.sender),
      }),
    }
  })

  ipcMain.handle('llm-profile', () => llmModelCatalog.publicProfile(loadSettings()))
  ipcMain.handle('llm-models', () => llmModelCatalog.listCatalog(loadSettings()))
  ipcMain.handle('llm-set-model', (_e, payload = {}) => {
    const settings = loadSettings()
    const model = String(payload.model || '').trim()
    if (!model) return { ok: false, error: '模型不能为空' }
    const provider = String(payload.provider || settings.llmProvider || '').trim()
    const preset = llmModelCatalog.getPreset(provider, model)
    const next = {
      ...settings,
      model,
      llmProvider: provider || settings.llmProvider,
      llmProfile: preset
        ? {
            contextWindow: preset.contextWindow,
            maxOutput: preset.maxOutput,
            supportsTools: preset.supportsTools !== false,
            parameter: preset.parameter || 'max_tokens',
          }
        : null,
    }
    saveSettings_(next)
    return { ok: true, profile: llmModelCatalog.publicProfile(next) }
  })

  ipcMain.on('get-settings', e => {
    e.returnValue = settingsSecure.publicSettings(loadSettings(), {
      includeSecrets: includeSecretsFor(e.sender),
    })
  })
}

module.exports = { registerSettingsIpc }
