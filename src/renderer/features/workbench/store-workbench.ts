import type { WorkbenchTask } from '../../../shared/api'
import type { ReviewTabId } from '../../../domain/daemon-review-tabs'
import { shelfLockHint, toShelfCard, type ShelfCardModel, type ShelfLayout } from '../../../domain/shelf'
import {
  formatDaemonReview,
  nextRunPhase,
  parseDaemonArtifacts,
  parseDaemonLogs,
  parseLaunchSlug,
} from '../../../domain/run-telemetry'
import {
  parseRunProjection,
  parseTaskListResponse,
  parsePendingClarifyNode,
  rosterLabelsFromPackage,
  runPhaseFromTaskStatus,
} from '../../../domain/run-projection'
import { workbenchRunReturnSurface } from '../../../domain/workbench-task-room'
import { api, type ExpertRoomState, type StoreGet, type StoreSet } from '../../app/store-types'
import { createWorkbenchDialogueActions } from './store-workbench-dialogue'
import {
  emptyRun,
  loadInputAgents,
  parseReviewChangesFromRaw,
  parseReviewEventsFromRaw,
  workflowGraphPayload,
  workflowRunProjection,
} from './store-workbench-helpers'

export function createWorkbenchSlice(set: StoreSet, get: StoreGet) {
  return {
    ...createWorkbenchDialogueActions(set, get),
    taskManageOpen: false,
    setShelfLayout: (shelfLayout: ShelfLayout) => set({ shelfLayout }),

    loadWorkbench: async () => {
      set({ shelfLoading: true })
      try {
        const data = await api()?.workbenchLoad?.()
        const raw = ([
          ...(data?.workflowPackages || []),
          ...(data?.workflows || []),
        ] as Parameters<typeof toShelfCard>[0][])
        const cards = raw.filter((w) => w && w.id).map(toShelfCard)
        set({
          shelfCards: cards,
          shelfLoading: false,
          shelfDaemonOnline: data?.daemon?.online ?? null,
        })
        await get().loadTasks()
      } catch {
        set({ shelfLoading: false, shelfCards: [], shelfDaemonOnline: null })
      }
    },

    loadWorkbenchModes: async () => {
      try {
        const result = await api()?.workbenchModeList?.()
        if (result && result.ok === false) return
        set({
          modes: result?.modes || [],
          activeModeId: result?.activeModeId || '',
        })
      } catch {
        /* keep last modes */
      }
    },

    loadTasks: async () => {
      try {
        const data = await api()?.workbenchTaskList?.()
        set({ tasks: parseTaskListResponse(data) })
      } catch {
        set({ tasks: [] })
      }
    },

    launchWorkflow: async (
      card: ShelfCardModel,
      payload: { goal: string; inputs: Record<string, string> },
    ) => {
      const lock = shelfLockHint(get().shelfDaemonOnline)
      if (lock || card.blocked) {
        get().showToast(lock || '该工作流已锁定，暂不可启动')
        return false
      }
      const brief = payload.goal.trim()
      const inputs = Object.fromEntries(
        Object.entries(payload.inputs || {})
          .map(([key, value]) => [String(key).trim(), String(value || '').trim()] as const)
          .filter(([key, value]) => key && value),
      )
      if (!brief) {
        get().showToast('请填写本次运行目标')
        return false
      }
      inputs.goal = brief

      try {
        const packageResult = await api()?.workbenchWorkflowPackageGet?.(card.id)
        const pkg = packageResult?.package
        if (!pkg) throw new Error(packageResult?.error || '工作流配置不存在')
        const persisted = await api()?.workflowRunStart?.({
          workflowId: card.id,
          input: inputs,
          enforceProductBoundary: true,
        })
        if (persisted?.ok === false) {
          const issues = Array.isArray(persisted.issues)
            ? persisted.issues.map((item) => String((item as Record<string, unknown>)?.message || '')).filter(Boolean)
            : []
          throw new Error(issues[0] || String(persisted.error || '工作流校验失败'))
        }
        const persistedRun = persisted?.run && typeof persisted.run === 'object'
          ? persisted.run as Record<string, unknown>
          : {}
        const started = await api()?.workbenchAgentGraphStart?.({
          ...workflowGraphPayload(pkg, brief || card.name),
          inputs,
        })
        if (!started || started.ok === false) throw new Error(String(started?.error || '工作流启动失败'))

        const rootRunId = String(started.rootRunId || '')
        if (!rootRunId) throw new Error('工作流启动后未返回运行标识')
        const inputAgents = rosterLabelsFromPackage(pkg)
        set({
          route: 'workbench',
          workbenchSurface: 'run',
          run: {
            ...emptyRun(card, brief, rootRunId, 'running'),
            lane: 'workflow',
            launchInputs: inputs,
            inputAgents,
            workflowRunId: String(persistedRun.runId || ''),
            workflowPackage: pkg,
            dialogueMessages: [{ id: `wu-brief-${Date.now()}`, role: 'user', text: brief }],
            log: ['正在启动工作流…', '工作流已按编排开始执行'],
          },
        })
        const createdTaskResult = await api()?.workbenchTaskCreate?.({
          kind: 'workflow',
          title: brief || card.name,
          goal: brief,
          status: 'running',
          workflowId: card.id,
          workflowName: card.name,
          execRef: { kind: 'run', id: rootRunId },
        }).catch(() => null)
        const createdTaskId = String(createdTaskResult?.task?.id || '')
        const launchedRun = get().run
        if (launchedRun && launchedRun.lane === 'workflow' && launchedRun.slug === rootRunId) {
          set({ run: { ...launchedRun, taskId: createdTaskId } })
        }
        await get().refreshRunTelemetry()
        await get().loadTasks()
        return true
      } catch (error) {
        get().showToast(error instanceof Error ? error.message : '工作流启动失败')
        return false
      }
    },

    reopenTaskRun: async (task: WorkbenchTask, opts?: { lane?: 'workflow' | 'pipeline' }) => {
      const workflowId = String(task.workflowId || '').trim()
      if (!workflowId) {
        get().openExpertRoom({ id: task.id, name: task.title || task.id })
        return
      }
      const slug = String(task.execRef?.id || workflowId).trim()
      const phase = runPhaseFromTaskStatus(task.status)
      const lane = opts?.lane || 'workflow'
      set({
        route: 'workbench',
        workbenchSurface: 'run',
        run: {
          ...emptyRun(
            { id: workflowId, name: task.workflowName || task.title || workflowId },
            task.goal || '',
            slug,
            phase,
          ),
          taskId: task.id,
          lane,
          brief: task.goal || '',
        },
      })
      await get().refreshRunTelemetry()
    },

    setRunBrief: (brief: string) => {
      const run = get().run
      if (!run) return
      set({ run: { ...run, brief } })
    },

    setRunReviewTab: (reviewTab: ReviewTabId) => {
      const run = get().run
      if (!run) return
      set({ run: { ...run, reviewTab } })
      if (reviewTab === 'events' || reviewTab === 'changes') {
        void get().refreshRunTelemetry()
      }
    },

    confirmLaunch: async () => {
      const run = get().run
      if (!run) return
      const brief = run.brief.trim()
      const alreadySeeded = run.dialogueMessages.some((item) => item.role === 'user' && item.text === brief)
      set({
        run: {
          ...run,
          phase: 'running',
          log: [...run.log, run.lane === 'workflow' ? '正在启动工作流…' : '正在启动管线…'],
          dialogueMessages: brief && !alreadySeeded
            ? [...run.dialogueMessages, { id: `wu-brief-${Date.now()}`, role: 'user', text: brief }]
            : run.dialogueMessages,
        },
      })
      try {
        if (run.lane === 'workflow') {
          const packageResult = await api()?.workbenchWorkflowPackageGet?.(run.workflowId)
          const pkg = packageResult?.package
          if (!pkg) throw new Error(packageResult?.error || '工作流配置不存在')
          const persisted = await api()?.workflowRunStart?.({
            workflowId: run.workflowId,
            input: { ...run.launchInputs, goal: brief },
            enforceProductBoundary: true,
          })
          if (persisted?.ok === false) {
            const issues = Array.isArray(persisted.issues)
              ? persisted.issues.map((item) => String((item as Record<string, unknown>)?.message || '')).filter(Boolean)
              : []
            throw new Error(issues[0] || String(persisted.error || '工作流校验失败'))
          }
          const persistedRun = persisted?.run && typeof persisted.run === 'object'
            ? persisted.run as Record<string, unknown>
            : {}
          const started = await api()?.workbenchAgentGraphStart?.({
            ...workflowGraphPayload(pkg, brief || run.workflowName),
            inputs: { ...run.launchInputs, goal: brief },
          })
          if (!started || started.ok === false) {
            throw new Error(String(started?.error || '工作流启动失败'))
          }
          const rootRunId = String(started.rootRunId || '')
          const current = get().run
          if (!current) return
          set({
            run: {
              ...current,
              slug: rootRunId,
              workflowRunId: String(persistedRun.runId || ''),
              workflowPackage: pkg,
              log: [...current.log, '工作流已按编排开始执行'],
            },
          })
          const createdTaskResult = await api()?.workbenchTaskCreate?.({
            kind: 'workflow',
            title: brief || run.workflowName,
            goal: brief,
            status: 'running',
            workflowId: run.workflowId,
            workflowName: run.workflowName,
            execRef: { kind: 'run', id: rootRunId },
          }).catch(() => null)
          const createdTaskId = String(createdTaskResult?.task?.id || '')
          const launchedRun = get().run
          if (launchedRun && launchedRun.lane === 'workflow' && launchedRun.slug === rootRunId) {
            set({ run: { ...launchedRun, taskId: createdTaskId } })
          }
          await get().refreshRunTelemetry()
          await get().loadTasks()
          return
        }
        const result = await api()?.workbenchLaunchStart?.({
          intent: { resourceType: 'pipeline', resourceId: run.workflowId, brief: run.brief },
          allowRelaunch: false,
        })
        const record = result && typeof result === 'object' ? result as Record<string, unknown> : {}
        if (record.ok === false) {
          get().showToast(String(record.error || '启动失败'))
          set({ run: { ...get().run!, phase: 'input' } })
          return
        }
        const slug = parseLaunchSlug(result, run.workflowId)
        set({
          run: {
            ...get().run!,
            slug,
            log: [...(get().run?.log || []), '管线已启动'],
          },
        })
        await get().refreshRunTelemetry()
      } catch (error) {
        get().showToast(error instanceof Error ? error.message : '启动失败')
        const current = get().run
        if (current) set({ run: { ...current, phase: 'input' } })
      }
    },

    refreshRunTelemetry: async () => {
      const run = get().run
      if (!run || run.phase === 'input') return
      try {
        if (run.lane === 'workflow') {
          if (!run.slug) return
          const [tree, persisted, packageResult] = await Promise.all([
            api()?.workbenchAgentRunTree?.(run.slug),
            run.workflowRunId ? api()?.workflowRunGet?.(run.workflowRunId) : Promise.resolve(null),
            run.workflowPackage ? Promise.resolve(null) : api()?.workbenchWorkflowPackageGet?.(run.workflowId),
          ])
          const latest = get().run
          if (!latest || latest.lane !== 'workflow') return
          if (!tree || typeof tree !== 'object' || (tree as Record<string, unknown>).ok === false) return
          const packageRecord = packageResult && typeof packageResult === 'object'
            ? packageResult as Record<string, unknown>
            : {}
          const recoveredPackage = latest.workflowPackage
            || (packageRecord.package && typeof packageRecord.package === 'object'
              ? packageRecord.package as Record<string, unknown>
              : null)
          const projection = workflowRunProjection(recoveredPackage, tree)
          const workflowRecord = persisted && typeof persisted === 'object'
            ? persisted as Record<string, unknown>
            : {}
          const persistedRun = workflowRecord.run && typeof workflowRecord.run === 'object'
            ? workflowRecord.run as Record<string, unknown>
            : {}
          const normalizedStatus = String(projection.status || '').toLowerCase()
          const taskStatus = projection.phase === 'hitl'
            ? 'review'
            : projection.phase === 'done'
              ? (['failed', 'error'].includes(normalizedStatus)
                  ? 'failed'
                  : ['cancelled', 'canceled'].includes(normalizedStatus) ? 'cancelled' : 'completed')
              : 'running'
          const resultSummary = projection.artifacts
            .map((item) => item && typeof item === 'object' ? item as Record<string, unknown> : {})
            .map((item) => String(item.title || item.name || item.path || '').trim())
            .find(Boolean)
            || [...projection.graphNodes].reverse().map((node) => node.outputLabel.trim()).find(Boolean)
            || (projection.phase === 'done' ? '工作流已完成' : '')
          set({
            run: {
              ...latest,
              phase: projection.phase,
              graphNodes: projection.graphNodes,
              currentOwner: projection.currentOwner,
              gateNode: projection.pendingGate,
              gateTitle: projection.pendingGate ? '节点产出需要你确认' : null,
              log: projection.log.length ? projection.log : latest.log,
              processLogsText: projection.log.join('\n') || latest.processLogsText,
              progressText: projection.phase === 'hitl'
                ? '等待我处理'
                : projection.phase === 'done' ? '运行结束' : '工作流执行中',
              daemonStatus: String(persistedRun.status || projection.status || ''),
              workflowPackage: recoveredPackage,
              artifacts: projection.artifacts.map((item, index) => {
                const artifact = item && typeof item === 'object' ? item as Record<string, unknown> : {}
                return {
                  id: String(artifact.id || index),
                  name: String(artifact.title || artifact.name || artifact.path || `产物 ${index + 1}`),
                }
              }),
            },
          })
          if (latest.taskId && projection.phase !== latest.phase) {
            await api()?.workbenchTaskUpdate?.(latest.taskId, {
              status: taskStatus,
              resultSummary,
            }).catch(() => null)
            await get().loadTasks()
          }
          return
        }
        const [logsRaw, artsRaw, taskRaw, progressRaw, eventsRaw, changesRaw] = await Promise.all([
          api()?.workbenchDaemonLogs?.(run.slug),
          api()?.workbenchDaemonArtifacts?.(run.slug),
          api()?.workbenchDaemonTask?.(run.slug),
          api()?.workbenchDaemonProgress?.(run.slug),
          run.reviewTab === 'events' ? api()?.workbenchDaemonEvents?.(run.slug, { limit: 120 }) : Promise.resolve(null),
          run.reviewTab === 'changes' ? api()?.workbenchDaemonChanges?.(run.slug) : Promise.resolve(null),
        ])
        const latest = get().run
        if (!latest || latest.phase === 'input') return
        const logs = parseDaemonLogs(logsRaw)
        const artifacts = parseDaemonArtifacts(artsRaw)
        const projection = parseRunProjection(taskRaw)
        const progressRecord = progressRaw && typeof progressRaw === 'object'
          ? progressRaw as Record<string, unknown>
          : {}
        const progressText = String(progressRecord.text || logs.progress || latest.progressText || '').trim()
        const phase = nextRunPhase(latest.phase, logs.status, logs.gate)
        const reviewEvents = parseReviewEventsFromRaw(eventsRaw, latest.reviewEvents)
        const reviewChanges = parseReviewChangesFromRaw(changesRaw, latest.reviewChanges)
        set({
          run: {
            ...latest,
            phase,
            log: logs.lines.length ? logs.lines : latest.log,
            processLogsText: logs.lines.join('\n') || latest.processLogsText,
            progressText,
            gateNode: logs.gate?.node || latest.gateNode,
            clarifyNode: parsePendingClarifyNode(taskRaw),
            gateTitle: logs.gate?.title || latest.gateTitle,
            artifacts: artifacts.length ? artifacts : latest.artifacts,
            agents: projection?.agents?.length
              ? projection.agents.map((name, index) => ({ id: `agent-${index}`, name }))
              : latest.agents,
            graphNodes: projection?.graphNodes || latest.graphNodes,
            currentOwner: projection?.currentOwner || latest.currentOwner,
            projectionDegraded: projection?.degraded ?? latest.projectionDegraded,
            projectionDegradedReason: projection?.degradedReason || latest.projectionDegradedReason,
            daemonStatus: logs.status || latest.daemonStatus,
            reviewEvents,
            reviewChanges,
          },
        })
      } catch {
        /* keep last snapshot */
      }
    },

    hitlDecide: (accept: boolean) => {
      const run = get().run
      if (!run) return
      if (run.lane === 'workflow') {
        if (!run.gateNode) return
        set({ run: { ...run, phase: 'running', log: [...run.log, accept ? '已批准节点交付，继续执行' : '已退回节点交付'] } })
        void api()?.workbenchAgentRunDecision?.({
          rootRunId: run.slug,
          nodeId: run.gateNode,
          decision: accept ? 'approve' : 'reject',
        }).then(() => get().refreshRunTelemetry()).catch(() => get().showToast('提交处理决定失败'))
        if (run.workflowRunId) {
          void api()?.workflowRunSubmitGate?.({
            runId: run.workflowRunId,
            nodeId: run.gateNode,
            approved: accept,
          }).catch(() => null)
        }
        return
      }
      set({
        run: {
          ...run,
          phase: 'done',
          log: [...run.log, accept ? '已确认，继续执行' : '已拒绝，结束本轮'],
        },
      })
      if (run.gateNode) {
        void api()?.workbenchDaemonGate?.(run.slug, {
          node: run.gateNode,
          decision: accept ? 'approve' : 'reject',
        }).catch(() => null)
      }
    },

    returnToShelf: () => {
      const surface = workbenchRunReturnSurface(get().run?.lane)
      set({
        route: 'workbench',
        workbenchSurface: surface,
        managePanel: surface === 'manage' ? 'daemon' : get().managePanel,
        run: null,
      })
    },

    rerun: () => {
      const run = get().run
      if (!run) return
      if (run.lane === 'workflow') {
        const card = get().shelfCards.find((item) => item.id === run.workflowId)
        if (!card) {
          get().showToast('未找到原工作流，请返回工作流列表后重试')
          return
        }
        void get().launchWorkflow(card, { goal: run.brief, inputs: run.launchInputs })
        return
      }
      set({
        run: {
          ...emptyRun({ id: run.workflowId, name: run.workflowName }, run.brief),
          lane: run.lane,
        },
      })
      void loadInputAgents(run.workflowId).then((inputAgents) => {
        const current = get().run
        if (!current || current.workflowId !== run.workflowId) return
        set({ run: { ...current, inputAgents } })
      })
    },

    toggleProcessLog: () => {
      const run = get().run
      if (!run) return
      set({ run: { ...run, showProcess: !run.showProcess } })
    },

    openWorkflowManage: () => {
      set({ route: 'workbench', workbenchSurface: 'manage', managePanel: 'workflows' })
      void get().loadWorkbench()
    },

    archiveWorkflow: async (workflowId: string) => {
      try {
        const result = await api()?.workbenchWorkflowPackageArchive?.(workflowId)
        if (result && result.ok === false) {
          get().showToast(String(result.error || '删除失败'))
          return
        }
        get().showToast('工作流已删除')
        await get().loadWorkbench()
      } catch {
        get().showToast('删除失败')
      }
    },

    openTaskManage: () => set({ taskManageOpen: true }),
    closeTaskManage: () => set({ taskManageOpen: false }),

    archiveTasks: async (ids: string[]) => {
      for (const id of ids) {
        await api()?.workbenchTaskArchive?.(id).catch(() => null)
      }
      set({ taskManageOpen: false })
      await get().loadTasks()
      get().showToast('已从任务列表清理，相关文件未删除')
    },

    openAutomationCenter: () => {
      set({ route: 'automation', workbenchSurface: 'manage', managePanel: 'automation' })
      void get().loadManage()
    },

    openWorkbenchRail: () => {
      /* 自动化复用 manage 面；进入工作台必须清掉旧面板状态，回到专家协作首页。 */
      set({ route: 'workbench', workbenchSurface: 'taskhome', managePanel: 'daemon' })
    },

    openExpertRoom: (room: { id: string; name: string; goal?: string }) => {
      const goal = String(room.goal || '').trim()
      const intro = goal
        ? `已进入与「${room.name}」的协作：${goal}`
        : `已进入与「${room.name}」的协作`
      set({
        route: 'workbench',
        workbenchSurface: 'run',
        workbenchDialogue: { composer: '', attachments: [] },
        expertRoom: {
          id: room.id,
          name: room.name,
          goal,
          log: [intro],
          messages: [{ id: `sys-${Date.now()}`, role: 'assistant', text: intro }],
          skills: [],
          connectors: [],
          knowledgeRefs: [],
        },
      })
      void get().loadHubCapabilities()
    },

    closeExpertRoom: () => set({ expertRoom: null, workbenchSurface: 'taskhome' }),

    setExpertRoomGoal: (goal: string) => {
      const room = get().expertRoom
      if (!room) return
      set({ expertRoom: { ...room, goal } })
    },

    patchExpertRoomBindings: (patch: Partial<Pick<ExpertRoomState, 'skills' | 'connectors' | 'knowledgeRefs'>>) => {
      const room = get().expertRoom
      if (!room) return
      set({ expertRoom: { ...room, ...patch } })
    },

    startExpertCollab: async () => {
      const room = get().expertRoom
      if (!room) return
      const goal = room.goal.trim() || `与${room.name}协作`
      try {
        await api()?.workbenchTaskCreate?.({
          title: goal,
          expertId: room.id,
        })
        set({
          expertRoom: {
            ...room,
            log: [...room.log, `已创建协作：${goal}`],
            messages: [
              ...room.messages,
              { id: `sys-${Date.now()}`, role: 'assistant', text: `已创建协作：${goal}` },
            ],
          },
        })
        await get().loadTasks()
      } catch {
        get().showToast('创建协作失败')
      }
    },

    openDaemonReview: async (jobName: string) => {
      try {
        const overview = await api()?.workbenchDaemonOverview?.()
        get().openDrawer({ title: jobName || '管线详情', body: formatDaemonReview(overview) })
      } catch {
        get().openDrawer({ title: jobName || '管线详情', body: '无法读取管线详情。' })
      }
    },

    openDaemonTaskSlug: async (slug: string, meta?: { name?: string }) => {
      const key = String(slug || '').trim()
      if (!key) return
      const name = String(meta?.name || key).trim() || key
      set({
        route: 'workbench',
        workbenchSurface: 'run',
        managePanel: 'daemon',
        run: {
          ...emptyRun({ id: key, name }, '', key, 'running'),
          lane: 'pipeline',
        },
      })
      await get().refreshRunTelemetry()
    },
  }
}
