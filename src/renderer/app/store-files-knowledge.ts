import type { CapabilityItem, CapabilityKind } from '../../shared/api'
import {
  mergeSourceChildren,
  sourceDirKey,
  fileCatalogFromTree,
  type ContentSource,
  type FileTreeNode,
} from '../../domain/file-tree'
import { api, type StoreGet, type StoreSet } from './store-types'

export function createFilesKnowledgeSlice(set: StoreSet, get: StoreGet) {
  return {
    setFileTreeQuery: (fileTreeQuery: string) => set({ fileTreeQuery }),

    selectSource: async (id: string) => {
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
        const list = await api()?.sourcesList?.()
        const sources = (list?.sources || []) as ContentSource[]
        const activeSourceId = list?.activeSourceId || sources[0]?.id || null
        if (!activeSourceId) {
          set({
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
        const list = await api()?.sourcesList?.()
        const sources = list?.sources || []
        const activeId = list?.activeSourceId || sources[0]?.id
        if (!activeId) {
          set({ fileCatalog: [] })
          return
        }
        const tree = await api()?.sourcesTree?.(activeId)
        const project = sources.find((s) => s.id === activeId)?.displayName || ''
        set({ fileCatalog: fileCatalogFromTree(tree?.nodes || [], project) })
      } catch {
        set({ fileCatalog: [] })
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
        get().showToast('请先添加内容源')
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
        get().showToast('请先添加内容源')
        return
      }
      try {
        await api()?.sourcesOpenRoot?.(sourceId)
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
