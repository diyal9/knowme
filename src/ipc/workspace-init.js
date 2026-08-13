'use strict'

/**
 * Workspace bootstrap IPC (notes list, sources, file tree).
 */
function registerWorkspaceInitIpc(ipcMain, deps) {
  const {
    loadAllNotes,
    sourcesLib,
    SOURCES_FILE,
    workspaceNoteBrief,
    groupNotesByProject,
    loadSettings,
  } = deps

  ipcMain.handle('workspace-init', () => {
    const notes = loadAllNotes()
    const srcStore = sourcesLib.loadStore(SOURCES_FILE)
    const active = srcStore.sources.find(s => s.id === srcStore.activeSourceId) || null
    let fileTree = null
    if (active) {
      fileTree = sourcesLib.listTree(active.rootPath, { maxDepth: 0 })
    }
    return {
      notes: notes.map(workspaceNoteBrief),
      groups: groupNotesByProject(notes),
      state: loadSettings().workspaceState || null,
      sources: srcStore.sources,
      activeSourceId: srcStore.activeSourceId,
      fileTree,
    }
  })
}

module.exports = { registerWorkspaceInitIpc }
