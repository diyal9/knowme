'use strict'

/**
 * Content sources IPC (local / gitlab / github / web).
 *
 * @param {import('electron').IpcMain} ipcMain
 * @param {object} deps
 */
function registerSourcesIpc(ipcMain, deps) {
  const {
    BrowserWindow,
    dialog,
    shell,
    app,
    sourcesLib,
    gitlabSource,
    webSource,
    loadSourcesStore,
    saveSourcesStore,
    findSource,
    loadSettings,
    saveSettings_,
    notifyWorkspaceRefresh,
  } = deps

  ipcMain.handle('sources-list', () => {
    const store = loadSourcesStore()
    return { ok: true, ...store, gitAvailable: gitlabSource.gitAvailable() }
  })

  ipcMain.handle('sources-set-active', (_e, id) => {
    const cur = loadSourcesStore()
    const r = sourcesLib.setActive(cur, id)
    if (!r.ok) return r
    const saved = saveSourcesStore(r.store)
    notifyWorkspaceRefresh()
    return { ok: true, ...saved }
  })

  ipcMain.handle('sources-add-local', async (e) => {
    const parent = BrowserWindow.fromWebContents(e.sender)
    const opts = {
      title: '选择本地内容文件夹',
      properties: ['openDirectory'],
    }
    const { canceled, filePaths } = parent
      ? await dialog.showOpenDialog(parent, opts)
      : await dialog.showOpenDialog(opts)
    if (canceled || !filePaths?.[0]) return { ok: false, canceled: true }
    const cur = loadSourcesStore()
    const r = sourcesLib.addLocal(cur, filePaths[0])
    if (!r.ok) return r
    const saved = saveSourcesStore(r.store)
    notifyWorkspaceRefresh()
    return { ok: true, source: r.source, ...saved }
  })

  ipcMain.handle('sources-add-gitlab', async (_e, payload = {}) => {
    const s = loadSettings()
    const host = gitlabSource.normalizeHost(payload.host || s.gitlabHost)
    const token = String(payload.token != null ? payload.token : s.gitlabToken || '').trim()
    const projectPath = String(payload.projectPath || '').trim()
    const branch = String(payload.branch || 'main').trim() || 'main'
    if (!host || !projectPath) return { ok: false, error: '请填写 GitLab 地址与项目路径' }
    if (payload.token != null || payload.host) {
      saveSettings_({ ...s, gitlabHost: host, gitlabToken: payload.token != null ? token : s.gitlabToken })
    }
    const cloned = gitlabSource.cloneProject({
      userData: app.getPath('userData'),
      host,
      projectPath,
      branch,
      token: token || loadSettings().gitlabToken,
    })
    if (!cloned.ok) return cloned
    const cur = loadSourcesStore()
    const r = sourcesLib.addGitlab(cur, {
      rootPath: cloned.rootPath,
      displayName: projectPath,
      remoteUrl: cloned.remoteUrl,
      projectPath,
      branch,
      host,
      lastSyncAt: new Date().toISOString(),
    })
    if (!r.ok) return r
    const saved = saveSourcesStore(r.store)
    notifyWorkspaceRefresh()
    return { ok: true, source: r.source, reused: !!cloned.reused, ...saved }
  })

  ipcMain.handle('sources-add-github', async (_e, payload = {}) => {
    const s = loadSettings()
    const remoteUrl = String(payload.remoteUrl || '').trim().replace(/\.git$/i, '')
    const branch = String(payload.branch || 'main').trim() || 'main'
    const token = String(payload.token != null ? payload.token : s.githubToken || '').trim()
    if (!/^https?:\/\/github\.com\/[^/]+\/[^/]+/i.test(remoteUrl)) {
      return { ok: false, error: '请填写 GitHub 仓库地址，例如 https://github.com/org/repo' }
    }
    if (payload.token != null) saveSettings_({ ...s, githubToken: token })
    const ownerRepo = remoteUrl
      .replace(/^https?:\/\/github\.com\//i, '')
      .replace(/\/+$/, '')
      .replace(/\.git$/i, '')
    const cloned = gitlabSource.cloneRemoteRepo({
      userData: app.getPath('userData'),
      remoteUrl: `${remoteUrl}.git`,
      branch,
      token: token || loadSettings().githubToken,
      provider: 'github',
    })
    if (!cloned.ok) return cloned
    const cur = loadSourcesStore()
    const r = sourcesLib.addGithub(cur, {
      rootPath: cloned.rootPath,
      displayName: ownerRepo,
      remoteUrl: cloned.remoteUrl,
      ownerRepo,
      branch,
      host: 'https://github.com',
      lastSyncAt: new Date().toISOString(),
    })
    if (!r.ok) return r
    const saved = saveSourcesStore(r.store)
    notifyWorkspaceRefresh()
    return { ok: true, source: r.source, reused: !!cloned.reused, ...saved }
  })

  ipcMain.handle('sources-add-web', async (_e, payload = {}) => {
    const pageUrl = String(payload.pageUrl || '').trim()
    if (!pageUrl) return { ok: false, error: '请填写网页地址' }
    let snapshot
    try {
      snapshot = await webSource.fetchPageSnapshot({ userData: app.getPath('userData'), pageUrl })
    } catch (err) {
      return { ok: false, error: String(err?.message || err || '网页抓取失败') }
    }
    if (!snapshot?.ok) return snapshot
    const cur = loadSourcesStore()
    const r = sourcesLib.addWeb(cur, {
      rootPath: snapshot.rootPath,
      pageUrl: snapshot.pageUrl,
      title: snapshot.title,
      lastSyncAt: new Date().toISOString(),
    })
    if (!r.ok) return r
    const saved = saveSourcesStore(r.store)
    notifyWorkspaceRefresh()
    return { ok: true, source: r.source, ...saved }
  })

  ipcMain.handle('sources-remove', (_e, id) => {
    const cur = loadSourcesStore()
    const r = sourcesLib.removeSource(cur, id)
    if (!r.ok) return r
    const saved = saveSourcesStore(r.store)
    notifyWorkspaceRefresh()
    return { ok: true, ...saved }
  })

  ipcMain.handle('sources-sync', async (_e, id) => {
    const src = findSource(id)
    if (!src) return { ok: false, error: '源不存在' }
    const settings = loadSettings()
    let syncResult = { ok: true }
    if (src.type === 'gitlab') {
      syncResult = gitlabSource.pullRepo(src.rootPath, settings.gitlabToken || '')
    } else if (src.type === 'github') {
      syncResult = gitlabSource.pullRemoteRepo(src.rootPath, {
        token: settings.githubToken || '',
        provider: 'github',
      })
    } else if (src.type === 'web') {
      try {
        syncResult = await webSource.fetchPageSnapshot({
          userData: app.getPath('userData'),
          pageUrl: src.pageUrl || src.remoteUrl,
        })
      } catch (err) {
        syncResult = { ok: false, error: String(err?.message || err || '网页刷新失败') }
      }
    } else {
      return { ok: false, error: '当前内容源不支持同步' }
    }
    if (!syncResult.ok) return syncResult
    const cur = loadSourcesStore()
    const sources = cur.sources.map(s => (
      s.id === id
        ? {
            ...s,
            rootPath: src.type === 'web' ? (syncResult.rootPath || s.rootPath) : s.rootPath,
            remoteUrl: src.type === 'web' ? (syncResult.pageUrl || s.remoteUrl) : s.remoteUrl,
            pageUrl: src.type === 'web' ? (syncResult.pageUrl || s.pageUrl) : s.pageUrl,
            displayName: src.type === 'web' ? (syncResult.title || s.displayName) : s.displayName,
            lastSyncAt: new Date().toISOString(),
          }
        : s
    ))
    const saved = saveSourcesStore({ ...cur, sources })
    notifyWorkspaceRefresh()
    return { ok: true, ...saved }
  })

  ipcMain.handle('sources-tree', (_e, sourceId) => {
    const src = findSource(sourceId || loadSourcesStore().activeSourceId)
    if (!src) return { ok: false, error: '未选择内容源', nodes: [] }
    return sourcesLib.listTree(src.rootPath, { maxDepth: 0 })
  })

  ipcMain.handle('sources-tree-children', (_e, payload = {}) => {
    const src = findSource(payload.sourceId || loadSourcesStore().activeSourceId)
    if (!src) return { ok: false, error: '未选择内容源', nodes: [] }
    return sourcesLib.listChildren(src.rootPath, payload.path || '')
  })

  ipcMain.handle('sources-read-file', (_e, payload = {}) => {
    const src = findSource(payload.sourceId)
    if (!src) return { ok: false, error: '源不存在' }
    return sourcesLib.readFileUnder(src.rootPath, payload.path)
  })

  ipcMain.handle('sources-write-file', (_e, payload = {}) => {
    const src = findSource(payload.sourceId)
    if (!src) return { ok: false, error: '源不存在' }
    const r = sourcesLib.writeFileUnder(src.rootPath, payload.path, payload.content)
    if (r.ok) notifyWorkspaceRefresh()
    return r
  })

  ipcMain.handle('sources-open-root', (_e, id) => {
    const src = findSource(id)
    if (!src) return { ok: false, error: '源不存在' }
    if (src.type === 'web' && /^https?:\/\//i.test(src.pageUrl || src.remoteUrl || '')) {
      shell.openExternal(src.pageUrl || src.remoteUrl)
      return { ok: true }
    }
    shell.openPath(src.rootPath)
    return { ok: true }
  })
}

module.exports = { registerSourcesIpc }
