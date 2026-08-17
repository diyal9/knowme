import type { KnowledgePage } from '../../../domain/knowledge-surface'
import { normalizeKnowledgePage } from '../../../domain/knowledge-surface'
import { seedCollapsedKnowledgeDirs, type KnowledgeKindFilter } from '../../../domain/knowledge-tree'
import type { KnowledgeProviderItem, StewardTaskSummary } from '../../../shared/api'
import type { StewardProposal } from '../../../shared/api-extended'
import { api, type StoreGet, type StoreSet } from '../../app/store-types'

function asTasks(steward: { items?: StewardTaskSummary[]; tasks?: StewardTaskSummary[] } | null | undefined): StewardTaskSummary[] {
  if (Array.isArray(steward?.tasks)) return steward.tasks
  if (Array.isArray(steward?.items)) return steward.items
  return []
}

export function createKnowledgeSlice(set: StoreSet, get: StoreGet) {
  return {
    setKnowledgePage: (page: KnowledgePage) => {
      set({ knowledgePage: normalizeKnowledgePage(page), knowledgeMoreOpen: false })
    },

    setKnowledgeFilter: (knowledgeFilter: KnowledgeKindFilter) => set({ knowledgeFilter }),

    toggleKnowledgeDir: (path: string) => {
      const collapsed = { ...get().knowledgeCollapsedDirs }
      if (collapsed[path]) delete collapsed[path]
      else collapsed[path] = true
      set({ knowledgeCollapsedDirs: collapsed })
    },

    setKnowledgeQuery: (knowledgeQuery: string) => set({
      knowledgeQuery,
      ...(knowledgeQuery.trim() ? {} : { knowledgeHits: [], knowledgeMessage: null }),
    }),

    loadKnowledge: async () => {
      set({ knowledgeLoading: true, knowledgeMessage: null })
      try {
        const [data, providers] = await Promise.all([
          api()?.knowledgeOsList?.(),
          api()?.knowledgeProviderList?.().catch(() => null),
        ])
        if (!data?.ok) {
          set({
            knowledgeWiki: [],
            knowledgeOkf: [],
            knowledgeWikiRoot: '',
            knowledgeLoading: false,
            knowledgeMessage: String((data as { error?: string })?.error || '知识库加载失败'),
          })
          return
        }
        const list = (providers?.providers || []) as KnowledgeProviderItem[]
        const wiki = data.wiki || []
        const okf = data.okf || []
        const nextRoot = data.wikiRoot || ''
        const hadEntries = get().knowledgeWiki.length + get().knowledgeOkf.length
        const shouldSeed = !get().knowledgeCollapsedSeeded
          || get().knowledgeWikiRoot !== nextRoot
          || (hadEntries === 0 && wiki.length + okf.length > 0)
        set({
          knowledgeWiki: wiki,
          knowledgeOkf: okf,
          knowledgeWikiRoot: nextRoot,
          knowledgeCollapsedDirs: shouldSeed ? seedCollapsedKnowledgeDirs([...wiki, ...okf]) : get().knowledgeCollapsedDirs,
          knowledgeCollapsedSeeded: true,
          knowledgeProviders: list.length ? list : [{ id: 'local-default', kind: 'local', displayName: '我的知识' }],
          knowledgeActiveProviderId: providers?.activeProviderId || list[0]?.id || 'local-default',
          knowledgeLoading: false,
          knowledgeHits: [],
          knowledgeMessage: null,
        })
      } catch {
        set({
          knowledgeWiki: [],
          knowledgeOkf: [],
          knowledgeLoading: false,
          knowledgeMessage: '知识库加载失败',
        })
      }
    },

    refreshKnowledge: async () => {
      try {
        const result = await api()?.knowledgeOsRefresh?.()
        if (result?.ok === false) {
          get().showToast(result.error || '重新读取失败')
          return
        }
        get().showToast(`已重新读取 ${result?.scanned || 0} 个条目`)
        await get().loadKnowledge()
      } catch {
        get().showToast('重新读取失败')
      }
    },

    searchKnowledge: async () => {
      const q = get().knowledgeQuery.trim()
      if (!q) {
        set({ knowledgeHits: [], knowledgeMessage: '请输入查询关键词' })
        return
      }
      set({ knowledgeSearching: true, knowledgeMessage: null })
      try {
        const data = await api()?.knowledgeSearch?.(q)
        const hits = data?.hits || []
        set({
          knowledgeHits: hits,
          knowledgeSearching: false,
          knowledgeMessage: hits.length ? null : (data?.message || '没有找到相关资料，可先添加资料或换个关键词'),
        })
      } catch {
        set({
          knowledgeHits: [],
          knowledgeSearching: false,
          knowledgeMessage: '检索失败',
        })
      }
    },

    exportKnowledge: async () => {
      try {
        const result = await api()?.knowledgeExport?.() as { ok?: boolean; error?: string } | undefined
        get().showToast(result?.ok === false ? (result.error || '导出失败') : '已导出知识包')
      } catch {
        get().showToast('导出失败')
      }
    },

    importKnowledge: async () => {
      try {
        const result = await api()?.knowledgeImport?.() as { ok?: boolean; error?: string } | undefined
        if (result?.ok === false) {
          get().showToast(result.error || '导入失败')
          return
        }
        get().showToast('已导入知识包')
        await get().loadKnowledge()
      } catch {
        get().showToast('导入失败')
      }
    },

    openKnowledgeEntry: async (entry: { kind?: string; path?: string }) => {
      const path = String(entry?.path || '').trim()
      if (!path) return
      try {
        const result = await api()?.knowledgeOsRead?.({ kind: entry.kind, path })
        if (!result?.ok) {
          set({
            knowledgeSelectedPath: path,
            knowledgeReader: {
              ok: false,
              path,
              kind: entry.kind,
              error: result?.error || '无法打开条目',
            },
          })
          return
        }
        set({ knowledgeSelectedPath: path, knowledgeReader: result })
      } catch {
        set({ knowledgeSelectedPath: path, knowledgeReader: { ok: false, path, kind: entry.kind, error: '无法打开条目' } })
      }
    },

    closeKnowledgeEntry: () => set({ knowledgeReader: null, knowledgeSelectedPath: null }),

    lintKnowledge: async () => {
      set({ knowledgeLinting: true, knowledgePage: 'health' })
      try {
        const result = await api()?.knowledgeOsLint?.()
        set({
          knowledgeLintIssues: result?.issues || [],
          knowledgeLinting: false,
          knowledgeMessage: result?.ok === false
            ? (result.error || '健康检查失败')
            : ((result?.issues || []).length ? `发现 ${(result?.issues || []).length} 个问题` : '知识库健康检查通过'),
        })
      } catch {
        set({ knowledgeLinting: false, knowledgeMessage: '健康检查失败' })
      }
    },

    organizeKnowledge: async (scope?: { mode?: string; topic?: string }) => {
      set({ knowledgeOrganizing: true })
      try {
        const result = await api()?.knowledgeStewardTaskCreate?.({ scope: scope || { mode: 'changed' } })
        if (result?.ok === false) {
          get().showToast(result.error || '整理任务创建失败')
        } else {
          const count = Array.isArray(result?.proposals) ? result.proposals.length : 0
          get().showToast(count ? `已生成 ${count} 条整理提案` : '整理任务已完成，暂无新提案')
          await get().loadKnowledgeIo()
          set({ knowledgePage: count ? 'review' : 'organize' })
        }
      } catch {
        get().showToast('整理任务创建失败')
      } finally {
        set({ knowledgeOrganizing: false })
      }
    },

    loadKnowledgeIo: async () => {
      set({ knowledgeIoLoading: true })
      try {
        const [graph, steward] = await Promise.all([
          api()?.fabricGraph?.().catch(() => null),
          api()?.knowledgeStewardTaskList?.().catch(() => null),
        ])
        const proposals = Array.isArray(steward?.proposals) ? steward.proposals : []
        set({
          fabricStats: graph && typeof graph === 'object' ? {
            nodeCount: Number((graph as { nodeCount?: number }).nodeCount || 0),
            edgeCount: Number((graph as { edgeCount?: number }).edgeCount || 0),
            staleAnchors: Number((graph as { staleAnchors?: number }).staleAnchors || 0),
          } : null,
          stewardTasks: asTasks(steward),
          stewardProposals: proposals,
          knowledgeSelectedProposalId: proposals.find((item) => item.status === 'draft')?.id
            || get().knowledgeSelectedProposalId,
          knowledgeIoLoading: false,
        })
      } catch {
        set({ fabricStats: null, stewardTasks: [], stewardProposals: [], knowledgeIoLoading: false })
      }
    },

    addKnowledgeMaterial: async (text: string, title?: string) => {
      const body = text.trim()
      if (!body) {
        get().showToast('先粘贴或写一点内容')
        return false
      }
      try {
        const ingest = api()?.knowledgeAddMaterial || api()?.knowledgeOsIngest
        const result = await ingest?.({ text: body, title })
        if (result?.ok === false) {
          get().showToast(result.error || '写入失败')
          return false
        }
        await api()?.knowledgeOsRefresh?.()
        await get().loadKnowledge()
        return true
      } catch {
        get().showToast('写入失败')
        return false
      }
    },

    selectKnowledgeProposal: (id: string | null) => set({ knowledgeSelectedProposalId: id }),

    decideKnowledgeProposal: async (action: 'accept' | 'reject' | 'snooze', content?: string) => {
      const id = get().knowledgeSelectedProposalId
      if (!id) return
      try {
        const fn = action === 'accept'
          ? api()?.knowledgeStewardProposalAccept?.({ id, content })
          : action === 'reject'
            ? api()?.knowledgeStewardProposalReject?.(id)
            : api()?.knowledgeStewardProposalSnooze?.(id)
        const result = await fn
        if (result?.ok === false) {
          get().showToast(result.error || '操作失败')
          return
        }
        get().showToast(action === 'accept' ? '提案已接受并写入知识库' : action === 'reject' ? '已拒绝提案' : '已稍后处理')
        await get().loadKnowledgeIo()
        await get().loadKnowledge()
      } catch {
        get().showToast('操作失败')
      }
    },

    setKnowledgeProvider: async (id: string) => {
      try {
        const result = await api()?.knowledgeProviderSetActive?.(id)
        if (result?.ok === false) {
          get().showToast(result.error || '切换失败')
          return
        }
        set({ knowledgeActiveProviderId: id })
        await get().loadKnowledge()
      } catch {
        get().showToast('切换失败')
      }
    },

    openObsidian: async () => {
      try {
        const result = await api()?.obsidianOpen?.()
        if (result?.ok === false) get().showToast(result.error || '无法打开 Obsidian')
      } catch {
        get().showToast('无法打开 Obsidian')
      }
    },

    setKnowledgeMoreOpen: (open: boolean) => set({ knowledgeMoreOpen: open }),
  }
}

export type { KnowledgePage, KnowledgeKindFilter }
