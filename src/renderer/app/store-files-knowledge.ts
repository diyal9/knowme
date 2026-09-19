import type { CapabilityItem, CapabilityKind, ProjectRef, ProjectsListResult } from '../../shared/api'
import {
  mergeSourceChildren,
  sourceDirKey,
  fileCatalogFromTree,
  type ContentSource,
  type FileTreeNode,
} from '../../domain/file-tree'
import { api, type StoreGet, type StoreSet } from './store-types'

export function createFilesKnowledgeSlice(set: StoreSet, get: StoreGet) {
  function legacyProjects(sources: ContentSource[], activeSourceId: string | null): ProjectsListResult {
    const projects: ProjectRef[] = sources
      .filter((source) => source.type !== 'web')
      .map((source) => ({
        id: `legacy-project:${source.id}`,
        name: source.displayName || source.id,
        workspaceSourceId: source.id,
        referenceSourceIds: [],
        status: 'active',
        workspace: source,
      }))
    return {
      ok: true,
      projects,
      activeProjectId: projects.find((project) => project.workspaceSourceId === activeSourceId)?.id
        || projects[0]?.id
        || null,
    }
  }

  async function loadProjectAndSources() {
    const projectApi = api()?.projectsList
    const projectList = projectApi ? await projectApi() : null
    const sourceList = await api()?.sourcesList?.()
    const sources = (sourceList?.sources || []) as ContentSource[]
    const fallback = legacyProjects(sources, sourceList?.activeSourceId || null)
    const projects = ((projectList ? projectList.projects : fallback.projects) || []) as ProjectRef[]
    const activeProjectId = projectList
      ? (projectList.activeProjectId || projects.find((project) => project.status !== 'archived')?.id || null)
      : (fallback.activeProjectId || null)
    const activeProject = projects.find((project) => project.id === activeProjectId) || null
    const activeSourceId = activeProject?.workspaceSourceId
      || sourceList?.activeSourceId
      || sources[0]?.id
      || null
    return { projects, activeProjectId, sources, activeSourceId }
  }

  return {
    loadProjects: async () => {
      try {
        const { projects, activeProjectId, sources, activeSourceId } = await loadProjectAndSources()
        set({ projects, activeProjectId, sources, activeSourceId })
      } catch {
        set({ projects: [], activeProjectId: null })
      }
    },

    setFileTreeQuery: (fileTreeQuery: string) => set({ fileTreeQuery }),

    selectProject: async (id: string) => {
      const project = get().projects.find((item) => item.id === id)
      try {
        if (api()?.projectsSetActive) {
          await api()?.projectsSetActive?.(id)
        } else if (project?.workspaceSourceId) {
          await api()?.sourcesSetActive?.(project.workspaceSourceId)
        }
      } catch {
        /* still reload project tree */
      }
      await get().loadFileTree()
    },

    selectSource: async (id: string) => {
      const project = get().projects.find((item) => item.workspaceSourceId === id)
      if (project) {
        await get().selectProject(project.id)
        return
      }
      try {
        await api()?.sourcesSetActive?.(id)
      } catch {
        /* still reload tree */
      }
      await get().loadFileTree()
    },

    loadFileTree: async () => {
      set({ fileTreeLoading: true })
      try {
        const { projects, activeProjectId, sources, activeSourceId } = await loadProjectAndSources()
        if (!activeSourceId) {
          set({
            projects,
            activeProjectId,
            sources,
            activeSourceId: null,
            fileTreeNodes: [],
            fileTreeTruncated: false,
            fileTreeLoading: false,
            fileCatalog: [],
          })
          return
        }
        const tree = await api()?.sourcesTree?.(activeSourceId)
        const nodes = (tree?.nodes || []) as FileTreeNode[]
        const collapsed: Record<string, true> = {}
        for (const node of nodes) {
          if (node.type === 'dir') collapsed[sourceDirKey(activeSourceId, node.path)] = true
        }
        set({
          projects,
          activeProjectId,
          sources,
          activeSourceId,
          fileTreeNodes: nodes,
          fileTreeTruncated: !!tree?.truncated,
          fileTreeCollapsed: collapsed,
          fileTreeLoading: false,
        })
        void get().loadFileCatalog()
      } catch {
        set({
          projects: [],
          activeProjectId: null,
          sources: [],
          activeSourceId: null,
          fileTreeNodes: [],
          fileTreeTruncated: false,
          fileTreeLoading: false,
        })
      }
    },

    loadFileCatalog: async () => {
      try {
        const { projects, activeProjectId, sources, activeSourceId: activeId } = await loadProjectAndSources()
        if (!activeId) {
          set({ projects, activeProjectId, sources, activeSourceId: null, fileCatalog: [] })
          return
        }
        const tree = await api()?.sourcesTree?.(activeId)
        const projectName = projects.find((project) => project.id === activeProjectId)?.name
          || sources.find((source) => source.id === activeId)?.displayName
          || ''
        set({ projects, activeProjectId, sources, activeSourceId: activeId, fileCatalog: fileCatalogFromTree(tree?.nodes || [], projectName) })
      } catch {
        set({ fileCatalog: [] })
      }
    },

    archiveProject: async (id: string, archived = true) => {
      try {
        const result = await api()?.projectsArchive?.(id, archived)
        if (result?.ok === false) {
          get().showToast(result.error || '无法更新项目')
          return
        }
        get().showToast(archived ? '项目已归档，文件未删除' : '项目已恢复')
        await get().loadFileTree()
      } catch {
        get().showToast('无法更新项目')
      }
    },

    relinkProject: async (id: string) => {
      try {
        const result = await api()?.projectsRelink?.(id)
        if (result?.canceled) return
        if (result?.ok === false) {
          get().showToast(result.error || '无法重新定位项目')
          return
        }
        get().showToast('项目目录已重新定位')
        await get().loadFileTree()
      } catch {
        get().showToast('无法重新定位项目')
      }
    },

    toggleFileDir: async (sourceId: string, relPath: string) => {
      const key = sourceDirKey(sourceId, relPath)
      const collapsed = { ...get().fileTreeCollapsed }
      const isCollapsed = !!collapsed[key]
      if (isCollapsed) {
        delete collapsed[key]
        set({ fileTreeCollapsed: collapsed })
        try {
          const res = await api()?.sourcesTreeChildren?.({ sourceId, path: relPath })
          if (!res?.ok) return
          set((state) => ({
            fileTreeNodes: mergeSourceChildren(state.fileTreeNodes, relPath, (res.nodes || []) as FileTreeNode[]),
            fileTreeTruncated: state.fileTreeTruncated || !!res.truncated,
          }))
        } catch {
          /* ignore lazy load errors */
        }
      } else {
        collapsed[key] = true
        set({ fileTreeCollapsed: collapsed })
      }
    },

    createSourceFile: async () => {
      const sourceId = get().activeSourceId
      if (!sourceId) {
        get().showToast('请先打开或创建项目')
        return
      }
      const name = window.prompt('新文件名', '未命名.md')
      if (!name?.trim()) return
      const path = name.trim().replace(/^[/\\]+/, '')
      try {
        const result = await api()?.sourcesWriteFile?.({ sourceId, path, content: '' })
        if (result?.ok === false) {
          get().showToast(result.error || '创建文件失败')
          return
        }
        get().showToast('已创建文件')
        await get().loadFileTree()
      } catch {
        get().showToast('创建文件失败')
      }
    },

    collapseFileTree: () => {
      const sourceId = get().activeSourceId
      if (!sourceId) return
      const collapsed: Record<string, true> = { ...get().fileTreeCollapsed }
      for (const node of get().fileTreeNodes) {
        if (node.type === 'dir') collapsed[sourceDirKey(sourceId, node.path)] = true
      }
      set({ fileTreeCollapsed: collapsed })
    },

    openSourceRoot: async () => {
      const sourceId = get().activeSourceId
      if (!sourceId) {
        get().showToast('请先打开或创建项目')
        return
      }
      try {
        const projectId = get().activeProjectId
        if (projectId && api()?.projectsOpenRoot) await api()?.projectsOpenRoot?.(projectId)
        else await api()?.sourcesOpenRoot?.(sourceId)
      } catch {
        get().showToast('无法打开源目录')
      }
    },

    setHubTab: (hubTab: CapabilityKind) => {
      set({ hubTab })
      void get().loadHubCapabilities()
    },

    setHubQuery: (hubQuery: string) => set({ hubQuery }),

    loadHubCapabilities: async () => {
      set({ hubLoading: true })
      const kind = get().hubTab
      try {
        const data = await api()?.capabilityList?.({ kind })
        if (data?.items?.length) {
          set({ hubItems: data.items, hubLoading: false })
          return
        }
        const packs = await api()?.capabilityPackList?.()
        const fallback = ((packs as { items?: CapabilityItem[] })?.items || []) as CapabilityItem[]
        set({ hubItems: fallback.filter((item) => item.kind === kind), hubLoading: false })
      } catch {
        set({ hubItems: [], hubLoading: false })
      }
    },
  }
}
