'use strict'

/**
 * Workspace bootstrap IPC (sources, file tree, workspace state).
 * 冷启动不扫 notes 目录；notes/groups 返回空（产品面已退役，preload 保留字段形状）。
 */
function registerWorkspaceInitIpc(ipcMain, deps) {
  const {
    sourcesLib,
    SOURCES_FILE,
    loadSettings,
  } = deps

  ipcMain.handle('workspace-init', () => {
    const srcStore = sourcesLib.loadStore(SOURCES_FILE)
    const active = srcStore.sources.find(s => s.id === srcStore.activeSourceId) || null
    let fileTree = null
    if (active) {
      fileTree = sourcesLib.listTree(active.rootPath, { maxDepth: 0 })
    }
    return {
      notes: [],
      groups: [],
      state: loadSettings().workspaceState || null,
      sources: srcStore.sources,
      activeSourceId: srcStore.activeSourceId,
      fileTree,
    }
  })
}

module.exports = { registerWorkspaceInitIpc }
