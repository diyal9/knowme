import type { KnowledgePage } from '../../../domain/knowledge-surface'
import { normalizeKnowledgePage } from '../../../domain/knowledge-surface'
import { seedCollapsedKnowledgeDirs, type KnowledgeKindFilter } from '../../../domain/knowledge-tree'
import type { BrainNode, BrainNodeKind, KnowledgeProviderItem, PersonalAgentProposal, StewardTaskSummary } from '../../../shared/api'
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
      ...(knowledgeQuery.trim() ? {} : { knowledgeHits: [], brainQueryResult: [], knowledgeMessage: null }),
    }),

    setBrainPerspective: (brainPerspective: 'self' | 'work' | 'knowledge') => {
      set({ brainPerspective })
      const nodes = get().brainSnapshot?.nodes || []
      const root = brainPerspective === 'work'
        ? nodes.find((item) => item.kind === 'project')?.id || 'self:me'
        : brainPerspective === 'knowledge'
          ? nodes.find((item) => item.kind === 'concept' || item.kind === 'collection')?.id || 'self:me'
          : 'self:me'
      void get().focusBrainNode(root)
    },

    setBrainFilters: (patch: Partial<{ kinds: BrainNodeKind[]; statuses: import('../../../shared/api').BrainClaimStatus[] }>) => {
      set({ brainFilters: { ...get().brainFilters, ...patch } })
      void get().focusBrainNode(get().brainFocusedNodeId || 'self:me')
    },

    selectBrainNode: (brainSelectedNodeId: string | null) => set({ brainSelectedNodeId }),

    focusBrainNode: async (id: string) => {
      set({ brainLoading: true, brainError: null, brainFocusedNodeId: id, brainSelectedNodeId: id })
      try {
        const result = await api()?.brainNeighborhood?.({
          nodeId: id,
          depth: 2,
          limit: 100,
          kinds: get().brainFilters.kinds,
          statuses: get().brainFilters.statuses,
        })
        if (result?.ok === false) throw new Error(result.error || '无法展开关系')
        set({
          brainVisibleNodes: result?.nodes || [],
          brainVisibleClaims: result?.claims || [],
          brainLoading: false,
        })
      } catch (error) {
        set({ brainLoading: false, brainError: error instanceof Error ? error.message : 'Brain 图谱暂不可用' })
      }
    },

    loadBrain: async () => {
      set({ brainLoading: true, brainError: null })
      try {
        const snapshot = await api()?.brainSnapshot?.()
        if (!snapshot || snapshot.ok === false) throw new Error(snapshot?.error || 'Brain 加载失败')
        const nodes = snapshot.nodes || []
        const claims = snapshot.claims || []
        const root = nodes.find((item) => item.id === 'self:me')?.id || nodes[0]?.id || null
        const visibleNodes = nodes.slice(0, 100)
        const visibleNodeIds = new Set(visibleNodes.map((node) => node.id))
        set({
          brainSnapshot: snapshot,
          brainVisibleNodes: visibleNodes,
          brainVisibleClaims: claims.filter((claim) => visibleNodeIds.has(claim.subjectId)
            && (!claim.objectNodeId || visibleNodeIds.has(claim.objectNodeId))),
          brainFocusedNodeId: get().brainFocusedNodeId || root,
          brainSelectedNodeId: get().brainSelectedNodeId || root,
          brainProposals: snapshot.proposals || [],
          brainLoading: false,
        })
      } catch (error) {
        set({ brainLoading: false, brainError: error instanceof Error ? error.message : 'Brain 加载失败' })
      }
    },

    queryBrain: async () => {
      const text = get().knowledgeQuery.trim()
      if (!text) return
      set({ knowledgeSearching: true, brainError: null })
      try {
        const providers = get().knowledgeProviders
        const result = await api()?.brainQuery?.({
          text,
          mode: 'mixed',
          topK: 12,
          knowledgePolicy: {
            brainScopes: ['global', 'project', 'organization'],
            providers: providers.map((provider) => ({ providerId: provider.id, collectionIds: provider.collectionIds || [] })),
            allowPersonalMemory: true,
            allowRemoteQuery: true,
            allowPromotionProposal: false,
            allowDirectWrite: false,
          },
        })
        const hits = result?.hits || []
        set({ brainQueryResult: hits, knowledgeSearching: false, knowledgeMessage: hits.length ? null : result?.message || '没有找到相关理解或资料' })
        if (hits[0]?.nodeId) await get().focusBrainNode(hits[0].nodeId)
      } catch {
        set({ knowledgeSearching: false, brainError: 'Brain 搜索失败' })
      }
    },

    forgetBrainNode: async (id: string) => {
      const result = await api()?.brainForget?.(id)
      if (result?.ok === false) return get().showToast(result.error || '无法清除这项理解')
      get().showToast('已从稳定理解中移除，历史仍可审计')
      await get().loadBrain()
    },

    syncBrainProvider: async (id: string) => {
      const result = await api()?.brainProviderSync?.(id)
      if (result?.ok === false) return get().showToast(result.error || '知识源同步失败')
      get().showToast(`已刷新 ${result?.collections?.length || 0} 个知识库入口`)
      await get().loadBrain()
      await get().loadKnowledge()
    },

    saveBrainLayout: async (positions: Record<string, { x: number; y: number }>) => {
      const result = await api()?.brainLayoutSave?.(positions)
      if (result?.ok === false) return get().showToast(result.error || '图谱布局保存失败')
      const snapshot = get().brainSnapshot
      if (snapshot) set({ brainSnapshot: { ...snapshot, layout: result?.layout || { positions } } })
    },

    findBrainPath: async (fromId: string, toId: string) => {
      const result = await api()?.brainPath?.({ fromId, toId, maxDepth: 8 })
      return result || { ok: false, error: '关系链服务不可用', nodeIds: [], claimIds: [] }
    },

    undoBrainGrowth: async (id: string) => {
      const result = await api()?.brainGrowthUndo?.(id)
      if (result?.ok === false) return get().showToast(result.error || '无法撤销这项成长')
      get().showToast('已撤销这项成长，并保留审计记录')
      await get().loadKnowledgeIo()
      await get().loadBrain()
    },

    saveBrainReference: async (hit: import('../../../shared/api').BrainHit) => {
      const evidence = hit.evidence?.[0]
      const result = await api()?.brainReferenceSave?.({
        type: evidence?.type,
        ref: hit.ref,
        providerId: hit.providerId,
        collectionId: hit.collectionId,
        documentRef: evidence?.documentRef || hit.ref,
        title: hit.title,
        snippet: hit.snippet,
        authority: hit.authority,
      })
      if (result?.ok === false) return get().showToast(result.error || '收藏引用失败')
      get().showToast('已收藏来源引用，未复制正文')
      await get().loadBrain()
    },

    promoteBrainHit: async (hit: import('../../../shared/api').BrainHit) => {
      const key = `${hit.providerId || hit.sourceKind || 'local'}:${hit.ref || hit.title}`.replace(/[^a-zA-Z0-9:_-]/g, '_').slice(0, 160)
      const evidenceId = `promotion-evidence:${key}`
      const nodeId = `promotion-node:${key}`
      const sourceEvidence = hit.evidence?.[0]
      const result = await api()?.brainProposalCreate?.({
        id: `promotion:${key}`,
        kind: 'cognition',
        targetType: 'brain',
        summary: `将“${hit.title}”沉淀为长期理解`,
        rationale: `${hit.explanation || '本轮检索命中'}。确认后才会影响稳定个性化。`,
        evidenceRefs: [evidenceId],
        effects: [
          { op: 'upsert_evidence', value: { id: evidenceId, type: sourceEvidence?.type || 'remote_rag', providerId: hit.providerId, collectionId: hit.collectionId, documentRef: sourceEvidence?.documentRef || hit.ref, title: hit.title, snippet: hit.snippet, persistence: 'reference' } },
          { op: 'upsert_node', value: { id: nodeId, kind: 'concept', label: hit.title, summary: hit.snippet, tags: ['promoted'], authority: hit.authority || 2, external: !!hit.providerId, providerId: hit.providerId, collectionId: hit.collectionId } },
          { op: 'upsert_claim', value: { id: `promotion-claim:${key}`, subjectId: 'self:me', predicate: 'knows', objectNodeId: nodeId, status: 'confirmed', confidence: Math.min(.95, Number(hit.score || .6)), evidenceRefs: [evidenceId] } },
        ],
      }) as { ok?: boolean; error?: string; suppressed?: boolean } | undefined
      if (result?.ok === false) return get().showToast(result.error || '无法创建沉淀建议')
      get().showToast(result?.suppressed ? '这条建议已被你拒绝过，不会重复出现' : '已放入“待我确认”')
      await get().loadKnowledgeIo()
    },

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
        const [graph, steward, brain, growth, ledger] = await Promise.all([
          api()?.fabricGraph?.().catch(() => null),
          api()?.knowledgeStewardTaskList?.().catch(() => null),
          api()?.brainProposalList?.().catch(() => null),
          api()?.personalAgentGrowthList?.({ limit: 100 }).catch(() => null),
          api()?.brainGrowthList?.({ limit: 100 }).catch(() => null),
        ])
        const proposals = Array.isArray(steward?.proposals) ? steward.proposals : []
        const brainProposals = [
          ...(brain?.proposals || []).map((item) => ({ ...item, source: 'brain' as const })),
          ...((growth?.proposals || []) as PersonalAgentProposal[])
            .filter((item) => item.status === 'pending')
            .map((item) => ({
              id: item.id,
              kind: item.kind === 'capability' ? 'capability' : ['memory', 'knowledge'].includes(item.kind || '') ? 'cognition' : 'behavior',
              targetType: (item.targetType || (item.kind === 'capability' ? 'capability' : ['memory', 'knowledge'].includes(item.kind || '') ? 'brain' : 'partner_profile')) as 'brain' | 'partner_profile' | 'capability',
              status: 'pending' as const,
              summary: item.summary || '伙伴协作方式成长',
              rationale: '来自近期协作中反复出现的偏好，确认后会修改伙伴协作方式。',
              effects: item.patch ? [item.patch] : [],
              evidenceRefs: [],
              source: 'partner' as const,
              createdAt: item.createdAt,
            })),
        ]
        set({
          fabricStats: graph && typeof graph === 'object' ? {
            nodeCount: Number((graph as { nodeCount?: number }).nodeCount || 0),
            edgeCount: Number((graph as { edgeCount?: number }).edgeCount || 0),
            staleAnchors: Number((graph as { staleAnchors?: number }).staleAnchors || 0),
          } : null,
          stewardTasks: asTasks(steward),
          stewardProposals: proposals,
          brainProposals,
          brainGrowthEvents: ledger?.events || [],
          knowledgeSelectedProposalId: brainProposals.find((item) => item.status === 'pending')?.id
            || proposals.find((item) => item.status === 'draft')?.id
            || get().knowledgeSelectedProposalId,
          knowledgeIoLoading: false,
        })
      } catch {
        set({ fabricStats: null, stewardTasks: [], stewardProposals: [], brainProposals: [], brainGrowthEvents: [], knowledgeIoLoading: false })
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
        const brainProposal = get().brainProposals.find((item) => item.id === id)
        const fn = brainProposal?.source === 'partner'
          ? action === 'snooze'
            ? Promise.resolve({ ok: true })
            : api()?.personalAgentApplyProposal?.({ proposalId: id, action: action === 'accept' ? 'apply' : 'reject' })
          : brainProposal
            ? action === 'accept'
              ? api()?.brainProposalConfirm?.({ id, patch: content ? { summary: content } : undefined })
              : action === 'reject'
                ? api()?.brainProposalReject?.(id)
                : api()?.brainProposalSnooze?.(id)
            : action === 'accept'
              ? api()?.knowledgeStewardProposalAccept?.({ id, content })
              : action === 'reject'
                ? api()?.knowledgeStewardProposalReject?.(id)
                : api()?.knowledgeStewardProposalSnooze?.(id)
        const result = await fn as { ok?: boolean; error?: string } | undefined
        if (result?.ok === false) {
          get().showToast(result.error || '操作失败')
          return
        }
        get().showToast(action === 'accept'
          ? brainProposal?.targetType === 'partner_profile'
            ? '已确认并更新伙伴协作方式'
            : brainProposal?.targetType === 'capability'
              ? '已确认并更新能力中心'
              : '已确认并写入本地 Brain'
          : action === 'reject'
            ? '已拒绝，这项理解不会再次提示'
            : '已放到稍后处理')
        await get().loadKnowledgeIo()
        await get().loadBrain()
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
