/**
 * 编排 Studio 与管理工作流：进入画布必须带上目标 package，禁止复用空白草稿。
 */
import type { WorkbenchSurface } from '../../../domain/rail'
import type { WorkbenchAutomationTemplate } from '../../../shared/api'
import { normalizeStudioIoList } from '../../../domain/studio-io'
import { studioLayoutPositions } from '../../../domain/studio-canvas'
import {
  addStudioAgent as addStudioAgentDraft,
  addStudioNode as addStudioNodeDraft,
  addStudioNodeOfKind,
  applyStudioNodePositions,
  connectStudioNodes as connectStudioNodesDraft,
  createStudioDraft,
  disconnectStudioEdge as disconnectStudioEdgeDraft,
  ensureStudioFreeGraph,
  inspectStudioDraft,
  removeStudioNode as removeStudioNodeDraft,
  studioBusinessNodes,
  studioDraftFromGraph,
  studioDraftToComposition,
  STUDIO_END_ID,
  STUDIO_START_ID,
  updateStudioDraft,
  updateStudioNode,
  updateStudioNodePosition,
  validateStudioDraft,
  type StudioDraft,
} from '../../../domain/studio'
import { api, type StoreGet, type StoreSet } from '../../app/store-types'

const PALETTE_LABELS: Record<string, string> = {
  llm: '大模型',
  tool: '工具',
  knowledge: '知识库',
  condition: '条件判断',
  join: '汇合',
  gate: '人工确认',
  agent: '专家节点',
}

function needsLeaveStudioConfirm(draft: StudioDraft | null): boolean {
  const bizNodes = studioBusinessNodes(draft)
  return Boolean(draft?.dirty && bizNodes.length)
}

function captureStudioReturn(set: StoreSet, get: StoreGet, source: WorkbenchSurface) {
  if (source === 'studio' || source === 'run') return
  set({
    studioReturnSurface: source,
    studioReturnManagePanel: source === 'manage' ? 'workflows' : null,
  })
}

function finishLeaveStudio(set: StoreSet, get: StoreGet): boolean {
  const target = get().studioReturnSurface || 'manage'
  const panel = get().studioReturnManagePanel || 'workflows'
  const workbenchSurface = target === 'run' ? 'taskhome' : target
  set({
    studioDraft: null,
    studioIssues: [],
    studioReturnSurface: null,
    studioReturnManagePanel: null,
    workbenchSurface,
    managePanel: workbenchSurface === 'manage' ? panel : get().managePanel,
    route: 'workbench',
  })
  return true
}

function openDirtyLeaveConfirm(
  get: StoreGet,
  onDiscard: () => void,
  onSaveLeave: () => void | Promise<void>,
) {
  get().openConfirm({
    title: '这条工作流还没保存',
    body: '离开后未保存的步骤与设置会丢失。',
    confirmLabel: '放弃修改',
    onConfirm: onDiscard,
    altLabel: '保存后离开',
    onAlt: onSaveLeave,
  })
}

function blankStudioDraft(): StudioDraft {
  return ensureStudioFreeGraph(createStudioDraft({ name: '我的专家协作' }), false)
}

/** 把已保存的 Workflow Package 还原成可编辑草稿（dirty=false）。 */
function draftFromPackage(pkg: Record<string, unknown>): StudioDraft {
  const graph = pkg.graph && typeof pkg.graph === 'object' ? pkg.graph as Record<string, unknown> : {}
  const graphGoal = typeof graph.goal === 'string' ? graph.goal : ''
  const draft = ensureStudioFreeGraph(studioDraftFromGraph(graph, {
    id: `draft-${String(pkg.id || '')}`,
    name: String(pkg.name || '我的专家协作'),
    goal: String(graphGoal || pkg.description || pkg.goal || ''),
    sourceWorkflowId: String(pkg.id || ''),
    inputs: pkg.inputs || graph.inputs,
    outputs: pkg.outputs || graph.outputs,
  }), false)
  draft.dirty = false
  return draft
}

async function resolveWorkflowPackage(
  get: StoreGet,
  workflowId: string,
): Promise<Record<string, unknown> | null> {
  const card = get().shelfCards.find((item) => item.id === workflowId)
  const fromCard = card?.graph
    ? {
        id: card.id,
        name: card.name,
        description: card.description,
        graph: card.graph,
      }
    : null
  try {
    const result = await api()?.workbenchWorkflowPackageGet?.(workflowId)
    if (result?.ok && result.package) return result.package
  } catch (err) {
    console.warn('[studio] package get failed', workflowId, err)
  }
  if (fromCard) return fromCard
  try {
    const listed = await api()?.workbenchWorkflowPackageList?.() as {
      packages?: Record<string, unknown>[]
      items?: Record<string, unknown>[]
    } | undefined
    const packs = listed?.packages || listed?.items || []
    const found = packs.find((item) => String(item?.id || '') === workflowId)
    if (found) return found
  } catch {
    /* ignore */
  }
  return null
}

async function openStudioSurface(
  set: StoreSet,
  get: StoreGet,
  source: WorkbenchSurface,
  workflowId?: string,
): Promise<void> {
  let draft: StudioDraft
  try {
    if (workflowId) {
      const pkg = await resolveWorkflowPackage(get, workflowId)
      if (!pkg) {
        get().showToast('无法打开该工作流')
        return
      }
      draft = draftFromPackage(pkg)
    } else {
      draft = blankStudioDraft()
    }
  } catch (err) {
    console.warn('[studio] open draft failed', workflowId || '(new)', err)
    get().showToast('无法打开该工作流')
    return
  }
  captureStudioReturn(set, get, source)
  set({
    studioDraft: draft,
    studioIssues: [],
    route: 'workbench',
    workbenchSurface: 'studio',
  })
  void get().loadStudioKnowledgeProviders()
  void get().loadHubCapabilities()
  void get().loadWorkbenchModes()
}

function parseAutomationTemplates(raw: unknown): WorkbenchAutomationTemplate[] {
  if (!Array.isArray(raw)) return []
  const out: WorkbenchAutomationTemplate[] = []
  for (const item of raw) {
    const rec = item && typeof item === 'object' ? item as Record<string, unknown> : {}
    const id = String(rec.id || '').trim()
    if (!id) continue
    out.push({
      id,
      title: String(rec.title || rec.name || id),
      description: String(rec.description || ''),
      prompt: String(rec.prompt || ''),
    })
  }
  return out
}

export function createStudioManageSlice(set: StoreSet, get: StoreGet) {
  return {
    setWorkbenchSurface: (workbenchSurface: WorkbenchSurface) => {
      const current = get()
      if (current.workbenchSurface === 'studio' && workbenchSurface !== 'studio') {
        const applySurface = () => {
          set({
            studioDraft: null,
            studioIssues: [],
            studioReturnSurface: null,
            studioReturnManagePanel: null,
            workbenchSurface,
            route: 'workbench',
            managePanel: workbenchSurface === 'manage' || current.managePanel === 'automation' ? 'daemon' : current.managePanel,
            expertRoom: workbenchSurface === 'taskhome' ? current.expertRoom : null,
          })
        }
        if (needsLeaveStudioConfirm(current.studioDraft)) {
          openDirtyLeaveConfirm(get, applySurface, async () => {
            const saved = await get().saveStudio()
            if (saved) applySurface()
          })
          return
        }
        applySurface()
        return
      }
      set({
            workbenchSurface,
            route: 'workbench',
            managePanel: workbenchSurface === 'manage' || current.managePanel === 'automation' ? 'daemon' : current.managePanel,
            expertRoom: workbenchSurface === 'taskhome' ? current.expertRoom : null,
      })
    },

    updateStudioNodeFields: (nodeId: string, patch: Record<string, unknown>) => {
      const draft = get().studioDraft
      if (!draft) return
      set({ studioDraft: updateStudioNode(draft, nodeId, patch), studioIssues: [] })
    },

    enterStudio: (from?: WorkbenchSurface, workflowId?: string) => {
      const current = get()
      const source = from || current.workbenchSurface
      const sameOpen = Boolean(workflowId && current.studioDraft?.sourceWorkflowId === workflowId)
      if (!sameOpen && needsLeaveStudioConfirm(current.studioDraft)) {
        openDirtyLeaveConfirm(
          get,
          () => { void openStudioSurface(set, get, source, workflowId) },
          async () => {
            const saved = await get().saveStudio()
            if (saved) void openStudioSurface(set, get, source, workflowId)
          },
        )
        return
      }
      if (sameOpen) {
        captureStudioReturn(set, get, source)
        set({ route: 'workbench', workbenchSurface: 'studio' })
        return
      }
      void openStudioSurface(set, get, source, workflowId)
    },

    forkWorkflow: async (workflowId: string) => {
      try {
        const card = get().shelfCards.find((item) => item.id === workflowId)
        if (!card) {
          get().showToast('未找到该流程')
          return
        }
        const result = await api()?.workbenchWorkflowPackageFork?.(workflowId, {
          name: `${card.name || workflowId}（我的版本）`,
          package: {
            id: card.id,
            name: card.name,
            description: card.description,
            source: card.source,
            graph: card.graph,
          },
        })
        if (!result?.ok) {
          get().showToast(String(result?.error || '复制流程失败'))
          return
        }
        get().showToast('已复制为我的流程，可继续配置专家与 Graph')
        await get().loadWorkbench()
      } catch {
        get().showToast('复制失败')
      }
    },

    leaveStudio: () => {
      if (needsLeaveStudioConfirm(get().studioDraft)) {
        openDirtyLeaveConfirm(
          get,
          () => { finishLeaveStudio(set, get) },
          async () => {
            const saved = await get().saveStudio()
            if (saved) finishLeaveStudio(set, get)
          },
        )
        return false
      }
      return finishLeaveStudio(set, get)
    },

    initStudio: () => {
      if (get().studioDraft) return
      const draft = blankStudioDraft()
      set({ studioDraft: draft, studioIssues: [] })
      void get().loadStudioKnowledgeProviders()
      void get().loadHubCapabilities()
      void get().loadWorkbenchModes()
    },

    addStudioNode: () => {
      const draft = get().studioDraft
      if (!draft) return
      set({ studioDraft: addStudioNodeDraft(draft), studioIssues: [] })
    },

    addStudioNodeFromPalette: (kind: string) => {
      const draft = get().studioDraft
      if (!draft) return
      if (kind === 'start' || kind === 'end' || kind === 'agent') return
      const seed: Record<string, unknown> = {
        kind,
        name: PALETTE_LABELS[kind] || kind,
      }
      if (kind === 'llm') {
        seed.config = { modelName: 'auto', prompt: '', temperature: '0.2' }
      }
      set({ studioDraft: addStudioNodeOfKind(draft, seed), studioIssues: [] })
    },

    addStudioAgent: (agent: { id: string; name?: string; description?: string }) => {
      const draft = get().studioDraft
      if (!draft || !agent.id) return
      set({
        studioDraft: addStudioAgentDraft(draft, {
          id: agent.id,
          name: agent.name,
          description: agent.description,
        }),
        studioIssues: [],
      })
    },

    autoLayoutStudio: () => {
      const draft = get().studioDraft
      if (!draft) return
      const free = draft.graphMode === 'free' ? draft : ensureStudioFreeGraph(draft, true)
      const positions = studioLayoutPositions(free)
      if (!positions.length) {
        get().showToast('画布上还没有可对齐的节点')
        return
      }
      set({ studioDraft: applyStudioNodePositions(free, positions), studioIssues: [] })
      get().showToast('已一键对齐')
    },

    inspectStudio: () => {
      const draft = get().studioDraft
      if (!draft) return null
      const result = inspectStudioDraft(draft)
      set({ studioIssues: result.issues })
      return result
    },

    disconnectStudioEdge: (edgeId: string) => {
      const draft = get().studioDraft
      if (!draft || !edgeId) return
      set({ studioDraft: disconnectStudioEdgeDraft(draft, edgeId), studioIssues: [] })
    },

    updateStudioDraftName: (name: string) => {
      const draft = get().studioDraft
      if (!draft) return
      const trimmed = name.trim() || draft.name
      set({ studioDraft: updateStudioDraft(draft, { name: trimmed }) })
    },

    updateStudioDraftGoal: (goal: string) => {
      const draft = get().studioDraft
      if (!draft) return
      set({ studioDraft: updateStudioDraft(draft, { goal: goal.slice(0, 2000) }) })
    },

    updateStudioDraftIo: (kind: 'inputs' | 'outputs', rows: unknown[]) => {
      const draft = get().studioDraft
      if (!draft) return
      const normalized = normalizeStudioIoList(rows, kind === 'outputs' ? 'output' : 'input')
      set({
        studioDraft: updateStudioDraft(draft, {
          [kind]: normalized,
        }),
      })
    },

    loadStudioKnowledgeProviders: async () => {
      try {
        const raw = await api()?.knowledgeProviderList?.()
        const record = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
        const providersRaw = Array.isArray(record.providers) ? record.providers : []
        const providers = providersRaw.map((item) => {
          const rec = item && typeof item === 'object' ? item as Record<string, unknown> : {}
          return {
            id: String(rec.id || rec.knowledgeId || ''),
            name: String(rec.displayName || rec.name || rec.title || rec.id || ''),
            kind: String(rec.kind || rec.type || ''),
          }
        }).filter((item) => item.id)
        set({ studioKnowledgeProviders: providers })
      } catch {
        set({ studioKnowledgeProviders: [] })
      }
    },

    moveStudioNode: (nodeId: string, x: number, y: number) => {
      const draft = get().studioDraft
      if (!draft) return
      set({ studioDraft: updateStudioNodePosition(draft, nodeId, x, y), studioIssues: [] })
    },

    connectStudioNodes: (fromId: string, toId: string, branch = '') => {
      const draft = get().studioDraft
      if (!draft) return
      const branchKey = branch === 'true' || branch === 'false' ? branch : ''
      const label = branchKey === 'true' ? '成立' : branchKey === 'false' ? '不成立' : ''
      let next = connectStudioNodesDraft(draft, fromId, toId, { branch: branchKey, label })
      const fromNode = next.nodes.find((node) => node.id === fromId)
      // 新连线默认顺序执行，便于串联关系在属性里可改
      if (fromNode && !fromNode.relation) {
        next = updateStudioNode(next, fromId, { relation: 'serial' })
      }
      set({ studioDraft: next, studioIssues: [] })
    },

    removeStudioNode: (nodeId: string) => {
      const draft = get().studioDraft
      if (!draft) return
      if (nodeId === STUDIO_START_ID || nodeId === STUDIO_END_ID) return
      set({ studioDraft: removeStudioNodeDraft(draft, nodeId), studioIssues: [] })
    },

    saveStudio: async () => {
      const draft = get().studioDraft
      if (!draft) return false
      const validation = validateStudioDraft(draft)
      if (!validation.ok) {
        set({ studioIssues: validation.issues })
        return false
      }
      set({ studioSaving: true, studioIssues: [] })
      try {
        const composition = studioDraftToComposition(draft)
        const packageId = draft.sourceWorkflowId || `my-${Date.now().toString(36)}`
        const result = await api()?.workbenchWorkflowPackageSave?.({
          package: {
            id: packageId,
            name: draft.name || '我的专家协作',
            description: draft.goal || '',
            source: 'personal',
            status: 'draft',
            version: '1.0.0',
            goalTypes: ['general'],
            graph: composition,
            executionBackends: ['local-team'],
            provenance: {
              kind: 'agent-composition',
              sourceWorkflowId: draft.sourceWorkflowId || '',
            },
          },
        })
        if (!result?.ok || !result.package) {
          set({ studioIssues: [{ code: 'save_failed', message: result?.error || '保存个人工作流失败' }] })
          return false
        }
        const saved = studioDraftFromGraph(result.package.graph || composition, {
          id: `draft-${result.package.id}`,
          name: result.package.name || draft.name,
          sourceWorkflowId: result.package.id,
        })
        saved.dirty = false
        set({ studioDraft: saved, studioIssues: [] })
        await get().loadWorkbench()
        return true
      } catch {
        set({ studioIssues: [{ code: 'save_failed', message: '保存个人工作流失败' }] })
        return false
      } finally {
        set({ studioSaving: false })
      }
    },

    loadManage: async () => {
      set({ manageLoading: true })
      try {
        const [modeRes, autoRes] = await Promise.all([
          api()?.workbenchModeList?.(),
          api()?.workbenchAutomationList?.(),
        ])
        set({
          modes: modeRes?.modes || [],
          activeModeId: modeRes?.activeModeId || modeRes?.modes?.[0]?.id || '',
          automationJobs: autoRes?.jobs || [],
          automationTemplates: parseAutomationTemplates(autoRes?.templates),
          manageLoading: false,
        })
      } catch {
        set({ modes: [], automationJobs: [], automationTemplates: [], manageLoading: false })
      }
    },

    selectMode: async (modeId: string) => {
      try {
        const result = await api()?.workbenchModeSelect?.(modeId)
        if (result?.ok === false) return
        set({
          modes: result?.modes || get().modes,
          activeModeId: result?.activeModeId || modeId,
        })
      } catch {
        /* ignore */
      }
    },

    saveAutomation: async (payload: Record<string, unknown>, id?: string) => {
      try {
        const result = id
          ? await api()?.workbenchAutomationUpdate?.(id, payload)
          : await api()?.workbenchAutomationCreate?.(payload)
        const record = result && typeof result === 'object' ? result as Record<string, unknown> : {}
        if (record.ok === false) {
          get().showToast(String(record.error || '保存自动化失败'))
          return false
        }
        await get().loadManage()
        return true
      } catch {
        get().showToast('保存自动化失败')
        return false
      }
    },

    deleteAutomation: async (id: string) => {
      try {
        await api()?.workbenchAutomationDelete?.(id)
        await get().loadManage()
      } catch {
        get().showToast('删除自动化失败')
      }
    },

    runAutomationNow: async (id: string) => {
      try {
        await api()?.workbenchAutomationRunNow?.(id)
        get().showToast('已触发立即执行')
        await get().loadManage()
      } catch {
        get().showToast('立即执行失败')
      }
    },
  }
}
