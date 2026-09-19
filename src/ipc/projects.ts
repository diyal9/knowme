'use strict'

const path = require('path')
const projectsLib = require('../lib/projects')

/**
 * Product-level Project IPC. Content Source remains the physical connector layer.
 *
 * @param {import('electron').IpcMain} ipcMain
 * @param {object} deps
 */
function registerProjectsIpc(ipcMain, deps) {
  const {
    BrowserWindow,
    dialog,
    shell,
    app,
    sourcesLib,
    loadSourcesStore,
    saveSourcesStore,
    notifyWorkspaceRefresh,
  } = deps

  const projectsFile = path.join(app.getPath('userData'), 'projects.json')

  function loadProjects() {
    return projectsLib.loadStore(projectsFile, loadSourcesStore())
  }

  function saveProjects(store) {
    return projectsLib.saveStore(projectsFile, store, loadSourcesStore())
  }

  function publicStore(store) {
    const sources = loadSourcesStore().sources || []
    return {
      ok: true,
      version: store.version,
      activeProjectId: store.activeProjectId,
      projects: (store.projects || []).map(project => {
        const source = sources.find(item => item.id === project.workspaceSourceId) || null
        return {
          ...project,
          workspace: source ? {
            sourceId: source.id,
            type: source.type,
            displayName: source.displayName,
            rootPath: source.rootPath,
            branch: source.branch || '',
            repositoryRef: source.projectPath || source.ownerRepo || '',
          } : null,
        }
      }),
    }
  }

  function alignActiveSource(store) {
    const project = (store.projects || []).find(item => item.id === store.activeProjectId)
    if (!project) return
    const sourceStore = loadSourcesStore()
    if (!sourceStore.sources.some(source => source.id === project.workspaceSourceId)) return
    const result = sourcesLib.setActive(sourceStore, project.workspaceSourceId)
    if (result.ok) saveSourcesStore(result.store)
  }

  ipcMain.handle('projects-list', () => publicStore(loadProjects()))

  ipcMain.handle('projects-set-active', (_event, projectId) => {
    const result = projectsLib.setActive(loadProjects(), projectId)
    if (!result.ok) return result
    const saved = saveProjects(result.store)
    alignActiveSource(saved)
    notifyWorkspaceRefresh()
    return publicStore(saved)
  })

  ipcMain.handle('projects-update', (_event, projectId, patch = {}) => {
    const result = projectsLib.updateProject(loadProjects(), projectId, patch)
    if (!result.ok) return result
    const saved = saveProjects(result.store)
    alignActiveSource(saved)
    notifyWorkspaceRefresh()
    return { ...publicStore(saved), project: saved.projects.find(item => item.id === result.project.id) }
  })

  ipcMain.handle('projects-archive', (_event, projectId, archived = true) => {
    const result = projectsLib.updateProject(loadProjects(), projectId, {
      status: archived === false ? 'active' : 'archived',
    })
    if (!result.ok) return result
    const saved = saveProjects(result.store)
    alignActiveSource(saved)
    notifyWorkspaceRefresh()
    return publicStore(saved)
  })

  ipcMain.handle('projects-detach', (_event, projectId) => {
    const result = projectsLib.detachProject(loadProjects(), projectId)
    if (!result.ok) return result
    const saved = saveProjects(result.store)
    alignActiveSource(saved)
    notifyWorkspaceRefresh()
    return publicStore(saved)
  })

  ipcMain.handle('projects-context', (_event, projectId) => {
    const sourcesStore = loadSourcesStore()
    const store = projectsLib.loadStore(projectsFile, sourcesStore)
    return projectsLib.resolveProjectContext(store, sourcesStore, projectId)
  })

  ipcMain.handle('projects-open-root', (_event, projectId) => {
    const context = projectsLib.resolveProjectContext(loadProjects(), loadSourcesStore(), projectId)
    if (!context.ok || !context.workspace?.rootPath) return { ok: false, error: context.error || '项目目录不可用' }
    shell.openPath(context.workspace.rootPath)
    return { ok: true }
  })

  ipcMain.handle('projects-relink', async (event, projectId) => {
    const store = loadProjects()
    const project = store.projects.find(item => item.id === String(projectId || ''))
    if (!project) return { ok: false, error: '项目不存在' }
    const parent = BrowserWindow.fromWebContents(event.sender)
    const opts = { title: '重新定位项目工作目录', properties: ['openDirectory'] }
    const picked = parent ? await dialog.showOpenDialog(parent, opts) : await dialog.showOpenDialog(opts)
    if (picked.canceled || !picked.filePaths?.[0]) return { ok: false, canceled: true }
    const rootPath = sourcesLib.normalizeRoot(picked.filePaths[0])
    if (!rootPath) return { ok: false, error: '所选目录不可用' }
    const sourceStore = loadSourcesStore()
    const sourceIndex = sourceStore.sources.findIndex(source => source.id === project.workspaceSourceId)
    if (sourceIndex < 0) return { ok: false, error: '项目工作来源不存在' }
    const sources = [...sourceStore.sources]
    sources[sourceIndex] = { ...sources[sourceIndex], rootPath }
    saveSourcesStore({ ...sourceStore, sources })
    const saved = projectsLib.saveStore(projectsFile, store, { ...sourceStore, sources })
    notifyWorkspaceRefresh()
    return publicStore(saved)
  })
}

module.exports = { registerProjectsIpc }

