'use strict'

const { runAgentGenerate } = require('./agent-generate-runner')
const { validateExecutionCompletion } = require('./agent-execution-contract')

function text(value, max = 2000) {
  return String(value == null ? '' : value).trim().slice(0, max)
}

function createExpertTaskRuntime(deps) {
  const controllers = new Map()

  function buildPrompt(task, snapshot, outputSpec, revision = null, transitionNote = '') {
    const materials = (task.brief?.materials || [])
      .map(item => `- ${item.title}${item.ref ? `（${item.ref}）` : ''}${item.content ? `\n${item.content}` : ''}`)
      .join('\n')
    const requiredTools = Array.isArray(outputSpec?.requiredTools) ? outputSpec.requiredTools : []
    return [
      `你是组织内专业 Agent「${task.expertName || task.expertId}」。`,
      snapshot?.persona?.systemPrompt || snapshot?.persona?.soul || '',
      '这是单 Agent 正式任务。禁止调用或模拟其他 Agent；信息不足时明确列出缺口，不得臆造。',
      `目标：${task.brief?.goal || task.goal}`,
      `当前时间：${new Date().toISOString()}`,
      `材料：\n${materials || '（无）'}`,
      `本轮交付物：${outputSpec?.title || '完整任务成果'}（${outputSpec?.type || 'document'}）`,
      outputSpec?.acceptanceCriteria?.length ? `验收标准：\n${outputSpec.acceptanceCriteria.map(item => `- ${item}`).join('\n')}` : '',
      requiredTools.length ? `本轮必须真实调用并成功完成：${requiredTools.join('、')}。没有工具证据时不得声称已执行。` : '',
      task.brief?.constraints?.length ? `约束：\n${task.brief.constraints.map(item => `- ${item}`).join('\n')}` : '',
      transitionNote ? `用户对上一阶段的确认或补充：\n${transitionNote}` : '',
      revision ? [
        `这是第 ${revision.version} 版修改。`,
        `用户验收意见：\n${revision.feedback}`,
        revision.previousBody ? `上一版交付物：\n${revision.previousBody}` : '',
        '请保留上一版中正确的内容，逐项落实验收意见，并直接输出修改后的完整交付物。',
      ].filter(Boolean).join('\n\n') : '',
      '只输出用户最终会阅读或使用的实际产物正文。不要输出“交付物 1”、类型、版本、Document 等内部元信息，也不要先解释你将输出什么。',
      '正文从真实的文档标题或内容开始。缺少姓名、日期、链接等信息时明确写“未提供”或“待确认”，不要使用方括号占位符，也不得编造。',
    ].filter(Boolean).join('\n\n').slice(0, 12000)
  }

  function manifestExecutionSpec(snapshot, deliverableId) {
    const execution = snapshot?.capabilityManifest?.metadata?.knowme?.execution
    const declared = execution?.deliverables
    if (Array.isArray(declared)) {
      return declared.find(item => String(item?.id || '') === String(deliverableId || '')) || {}
    }
    return declared && typeof declared === 'object' ? (declared[deliverableId] || {}) : {}
  }

  function hydrateBriefContracts(brief, snapshot) {
    const deliverables = (brief?.deliverables || []).map((item) => {
      const declared = manifestExecutionSpec(snapshot, item.id)
      return {
        ...item,
        requiredTools: [...new Set([
          ...(item.requiredTools || []),
          ...(declared.requiredTools || []),
        ].map(String).filter(Boolean))],
        requiredEvidence: declared.requiredEvidence || item.requiredEvidence || [],
        completionConditions: declared.completionConditions || item.completionConditions || [],
      }
    })
    return { ...(brief || {}), deliverables }
  }

  function assessExecutionContract(outputSpec, executionEvidence) {
    return validateExecutionCompletion(outputSpec, { executionEvidence })
  }

  function ensureCurrentSnapshot(store, task, expertRuntime) {
    let currentTask = task
    let snapshot = expertRuntime.readSessionSnapshot(task.execRef?.id)
    const needsUpgrade = !snapshot?.capabilityManifest
      || !task.assignmentSnapshot?.agentVersion
      || !snapshot.capabilityManifest?.version
    if (needsUpgrade && typeof expertRuntime.createSessionSnapshot === 'function') {
      const upgraded = expertRuntime.createSessionSnapshot(task.execRef?.id, task.expertId)
      if (upgraded?.ok && upgraded.snapshot) {
        snapshot = upgraded.snapshot
        const nextBrief = hydrateBriefContracts(task.brief, snapshot)
        const updated = store.update(task.id, {
          brief: nextBrief,
          assignmentSnapshot: {
            ...task.assignmentSnapshot,
            agentId: task.expertId,
            agentVersion: snapshot.capabilityManifest?.version,
            agentHash: snapshot.hashes?.expert || snapshot.capabilityManifest?.provenance?.contentHash,
            snapshotRef: `expert-snapshot:${task.execRef?.id}`,
          },
          events: [...task.events, { type: 'execution_contract_upgraded', summary: '已补齐当前专家的执行与证据契约' }],
        })
        if (updated.ok) currentTask = updated.task
      }
    } else {
      const nextBrief = hydrateBriefContracts(task.brief, snapshot)
      if (JSON.stringify(nextBrief.deliverables) !== JSON.stringify(task.brief?.deliverables || [])) {
        const updated = store.update(task.id, { brief: nextBrief })
        if (updated.ok) currentTask = updated.task
      }
    }
    return { task: currentTask, snapshot }
  }

  function reconcileTask(id) {
    const store = deps.getWorkbenchTaskStore()
    const loaded = store.get(id)
    if (!loaded.ok || loaded.task.kind !== 'expert') return loaded
    const expertRuntime = deps.ensureCapabilityHub().expertRuntime()
    const resolved = ensureCurrentSnapshot(store, loaded.task, expertRuntime)
    const task = resolved.task
    const invalidIds = new Set()
    const deliverables = (task.deliverables || []).map((item) => {
      const spec = (task.brief?.deliverables || []).find(value => value.id === item.deliverableId) || item
      if (!(spec.requiredTools?.length || spec.requiredEvidence?.length)) return item
      const evidence = (task.executionEvidence || []).filter(value => value.deliverableId === item.deliverableId).at(-1)
      const assessment = assessExecutionContract(spec, evidence)
      if (assessment.ok) return item
      invalidIds.add(item.deliverableId)
      return { ...item, evidenceStatus: 'blocked', acceptanceStatus: 'pending' }
    })
    if (!invalidIds.size) return { ok: true, task }
    const alreadyReconciled = task.status === 'needs_input'
      && deliverables.every((item, index) => item.evidenceStatus === task.deliverables[index]?.evidenceStatus)
    if (alreadyReconciled) return { ok: true, task }
    return store.update(task.id, {
      status: 'needs_input',
      deliverables,
      events: [...task.events, {
        type: 'execution_invalidated',
        summary: `发现未完成真实执行的交付物：${[...invalidIds].join('、')}，需要重新执行`,
      }],
    })
  }

  function resolveOutputSpec(task, snapshot) {
    const requested = task.brief?.deliverables?.length
      ? task.brief.deliverables
      : [{ id: 'primary', title: task.title, type: 'document', required: true }]
    const change = (task.deliverables || []).find(item => item.acceptanceStatus === 'changes_requested')
    const next = change
      ? requested.find(item => item.id === change.deliverableId)
      : requested.find(item => !(task.deliverables || []).some(deliverable => (
        deliverable.deliverableId === item.id && deliverable.acceptanceStatus === 'accepted'
      )))
    const base = next || requested.at(-1)
    const declared = manifestExecutionSpec(snapshot, base?.id)
    const singleOutputTools = requested.length === 1
      ? snapshot?.capabilityManifest?.permissions?.tools
      : []
    return {
      ...base,
      ...declared,
      requiredTools: [...new Set([
        ...(base?.requiredTools || []),
        ...(declared?.requiredTools || []),
        ...(Array.isArray(singleOutputTools) ? singleOutputTools : []),
      ].map(String).filter(Boolean))],
      requiredEvidence: declared?.requiredEvidence || base?.requiredEvidence || [],
      completionConditions: declared?.completionConditions || base?.completionConditions || [],
    }
  }

  function mergeDeliverable(deliverables, next) {
    const list = Array.isArray(deliverables) ? deliverables.slice() : []
    const index = list.findIndex(item => item.deliverableId === next.deliverableId)
    if (index >= 0) list[index] = next
    else list.push(next)
    return list
  }

  function appendTaskEvent(store, task, type, summary = '') {
    return store.update(task.id, {
      events: [...(task.events || []), { type, summary }],
    })
  }

  async function execute(taskId) {
    const store = deps.getWorkbenchTaskStore()
    const current = reconcileTask(taskId)
    if (!current.ok || ['cancelled', 'completed'].includes(current.task.status)) return current
    let task = current.task
    const settings = deps.loadSettings()
    if (!settings.apiKey || !settings.apiEndpoint) {
      return store.update(task.id, {
        status: 'needs_input',
        events: [...task.events, { type: 'needs_input', summary: '需要先配置 AI 接口' }],
      })
    }

    try { new URL(deps.normalizeChatEndpoint(settings.apiEndpoint)) } catch {
      return store.update(task.id, { status: 'failed', events: [...task.events, { type: 'failed', summary: 'AI Endpoint 格式错误' }] })
    }
    const controller = new AbortController()
    controllers.set(task.id, controller)
    store.update(task.id, { status: 'running', events: [...task.events, { type: 'started', summary: '专家已开始工作' }] })
    try {
      const expertRuntime = deps.ensureCapabilityHub().expertRuntime()
      const resolved = ensureCurrentSnapshot(store, task, expertRuntime)
      task = resolved.task
      const snapshot = resolved.snapshot
      const ensuredBeforeRun = deps.ensureAgentSession(task.execRef?.id, task.expertId, {
        surface: 'workbench',
        ephemeral: true,
        expertId: task.expertId,
        taskRef: { id: task.id, kind: 'expert-task' },
      })
      const outputSpec = resolveOutputSpec(task, snapshot)
      const previousDeliverable = (task.deliverables || []).find(item => (
        item.deliverableId === outputSpec.id && item.acceptanceStatus === 'changes_requested'
      )) || (task.deliverables || []).find(item => item.deliverableId === outputSpec.id)
      const previousArtifactId = text(previousDeliverable?.artifactRef, 300).split('#').at(-1)
      const previousArtifact = (ensuredBeforeRun.session?.run?.artifacts || []).find(item => item.id === previousArtifactId)
      const feedback = (previousDeliverable?.comments || []).at(-1)?.body || ''
      const revision = task.status === 'revising' || previousDeliverable?.acceptanceStatus === 'changes_requested'
        ? {
            version: Math.max(2, Number(previousDeliverable?.version || 1) + 1),
            feedback: text(feedback, 1000) || '请根据验收意见修改上一版成果。',
            previousBody: text(previousArtifact?.body || task.resultSummary, 12000),
          }
        : null
      const latestAccepted = (task.deliverables || []).filter(item => item.acceptanceStatus === 'accepted').at(-1)
      const transitionNote = latestAccepted?.comments?.at(-1)?.body || ''
      const prompt = buildPrompt(task, snapshot, outputSpec, revision, transitionNote)
      const generate = deps.runAgentGenerate || runAgentGenerate
      const runId = `expert_${task.id}_${Date.now().toString(36)}`
      const result = await generate(deps, {
        prompt,
        displayPrompt: task.brief?.goal || task.goal,
        sessionId: task.execRef?.id,
        agentId: task.expertId,
        expertId: task.expertId,
        role: 'expert',
        surface: 'workbench',
        // `taskId` is reserved by ai-generate for a Skill catalog task. A
        // formal workbench task is carried separately so it cannot be rejected
        // by Skill task-entry validation.
        workbenchTaskId: task.id,
        taskRef: { id: task.id, kind: 'expert-task' },
        runId,
        permissions: {
          ...(snapshot?.capabilityManifest?.permissions || {}),
          orchestration: { allowDelegate: false, maxSubRuns: 0, maxParallel: 0 },
        },
        executionContract: {
          requiredTools: outputSpec.requiredTools || [],
          requiredEvidence: outputSpec.requiredEvidence || [],
          completionConditions: outputSpec.completionConditions || [],
        },
      }, { controller })
      if (result.cancelled || controller.signal.aborted) return store.update(task.id, { status: 'cancelled' })
      if (result.error) throw new Error(result.error)
      const output = text(result.text, 24000)
      if (!output) throw new Error('专家没有返回交付物')

      const executionEvidence = {
        ...(result.executionEvidence || {}),
        runId: result.runId || runId,
        deliverableId: outputSpec.id || 'primary',
        createdAt: new Date().toISOString(),
      }
      const contractAssessment = assessExecutionContract(outputSpec, executionEvidence)
      if (!contractAssessment.ok) {
        executionEvidence.gateStatus = 'blocked'
        executionEvidence.verificationPassed = false
        executionEvidence.violations = [
          ...(executionEvidence.violations || []),
          ...contractAssessment.violations,
        ]
      }
      const latestBeforePersist = store.get(task.id)
      const existingEvidence = latestBeforePersist.ok ? latestBeforePersist.task.executionEvidence : task.executionEvidence
      if (executionEvidence.gateStatus === 'blocked' || executionEvidence.verificationPassed === false) {
        return store.update(task.id, {
          status: 'needs_input',
          executionEvidence: [...(existingEvidence || []), executionEvidence],
          events: [...(latestBeforePersist.ok ? latestBeforePersist.task.events : task.events), {
            type: 'execution_blocked',
            summary: executionEvidence.violations?.[0]?.message || '缺少真实工具执行证据',
          }],
        })
      }

      const ensuredAfterRun = deps.ensureAgentSession(task.execRef?.id, task.expertId, {
        surface: 'workbench', ephemeral: true, expertId: task.expertId,
        taskRef: { id: task.id, kind: 'expert-task' },
      })
      let session = ensuredAfterRun.session
      session = deps.agentRun.addArtifact(session, {
        type: outputSpec.type || 'document',
        title: outputSpec.title || task.title,
        body: output,
        status: 'draft',
        meta: { taskId: task.id, deliverableId: outputSpec.id || 'primary' },
      })
      deps.saveAgentSessions(ensuredAfterRun.sessions.map(item => item.id === session.id ? session : item))
      const artifact = session.run.artifacts.at(-1)
      const nextVersion = revision?.version || 1
      const latest = store.get(task.id)
      const latestEvents = latest.ok ? latest.task.events : task.events
      const deliverable = {
        ...(previousDeliverable || {}),
        deliverableId: outputSpec.id || 'primary',
        title: outputSpec.title || task.title,
        type: outputSpec.type || 'document',
        required: outputSpec.required !== false,
        version: nextVersion,
        previousVersionId: revision ? previousArtifactId : undefined,
        artifactRef: `${session.id}#${artifact.id}`,
        executionRef: `agent-run:${result.runId || runId}`,
        evidenceStatus: executionEvidence.gateStatus || 'not_required',
        acceptanceStatus: 'pending',
      }
      return store.update(task.id, {
        status: 'review',
        resultSummary: output.slice(0, 280),
        deliverables: mergeDeliverable(latest.ok ? latest.task.deliverables : task.deliverables, deliverable),
        executionEvidence: [...((latest.ok ? latest.task.executionEvidence : task.executionEvidence) || []), executionEvidence],
        events: [...latestEvents, { type: revision ? 'revision_ready' : 'deliverable_ready', summary: outputSpec.title || task.title }],
      })
    } catch (error) {
      const latest = store.get(task.id)
      if (!latest.ok || latest.task.status === 'cancelled') return latest
      return store.update(task.id, {
        status: 'failed',
        events: [...latest.task.events, { type: 'failed', summary: text(error?.message || error, 500) }],
      })
    } finally {
      controllers.delete(task.id)
    }
  }

  function createStart(input = {}) {
    const store = deps.getWorkbenchTaskStore()
    const expertId = text(input.expertId, 160)
    const goal = text(input.brief?.goal || input.goal)
    if (!expertId) return { ok: false, error: '请选择一位 Agent' }
    if (!goal) return { ok: false, error: '任务目标不能为空' }
    const requested = Array.isArray(input.brief?.deliverables || input.requestedDeliverables)
      ? (input.brief?.deliverables || input.requestedDeliverables)
      : [{ id: 'primary', title: input.deliverableTitle || '任务成果', type: 'document', required: true }]
    const created = store.create({
      ...input,
      kind: 'expert',
      visibility: 'private',
      status: 'starting',
      brief: { ...(input.brief || {}), goal, deliverables: requested },
      events: [{ type: 'created', summary: '已确认委托单并开始预检' }],
      scheduleEnabled: false,
    })
    if (!created.ok) return created
    const sessionId = `wb-expert-${created.task.id}`
    const ensured = deps.ensureAgentSession(sessionId, expertId, {
      surface: 'workbench',
      ephemeral: true,
      expertId,
      taskRef: { id: created.task.id, kind: 'expert-task' },
    })
    deps.saveAgentSessions(ensured.sessions)
    const snapshotResult = deps.ensureCapabilityHub().expertRuntime().createSessionSnapshot(sessionId, expertId)
    if (!snapshotResult.ok) {
      const failed = store.update(created.task.id, {
        status: 'failed',
        execRef: { kind: 'session', id: sessionId },
        events: [...created.task.events, { type: 'preflight_failed', summary: snapshotResult.message || snapshotResult.error }],
      })
      return { ...failed, started: false }
    }
    const snapshot = snapshotResult.snapshot || {}
    const hydratedBrief = hydrateBriefContracts(created.task.brief, snapshot)
    const prepared = store.update(created.task.id, {
      execRef: { kind: 'session', id: sessionId },
      assignmentSnapshot: {
        agentId: expertId,
        agentVersion: snapshot.capabilityManifest?.version,
        agentHash: snapshot.hashes?.expert || snapshot.capabilityManifest?.provenance?.contentHash,
        snapshotRef: `expert-snapshot:${sessionId}`,
      },
      brief: hydratedBrief,
      status: snapshotResult.degraded
        || (created.task.brief.requiresMaterials === true && !created.task.brief.materials.length)
        ? 'needs_input'
        : 'starting',
      events: [...created.task.events, {
        type: snapshotResult.degraded
          || (created.task.brief.requiresMaterials === true && !created.task.brief.materials.length)
          ? 'needs_input'
          : 'preflight_passed',
        summary: snapshotResult.degraded
          ? (snapshotResult.issues?.[0]?.message || '专家依赖尚未就绪')
          : (created.task.brief.requiresMaterials === true && !created.task.brief.materials.length ? '请补充任务材料' : '预检通过'),
      }],
    })
    if (prepared.task.status !== 'needs_input') void execute(prepared.task.id)
    return { ...prepared, started: prepared.task.status !== 'needs_input' }
  }

  function provideInput(input = {}) {
    const store = deps.getWorkbenchTaskStore()
    const current = store.get(input.taskId || input.id)
    if (!current.ok) return current
    const note = text(input.note, 1000)
    const materials = [
      ...(current.task.brief?.materials || []),
      ...(Array.isArray(input.materials) ? input.materials : []),
      ...(note ? [{ id: `user-input-${Date.now().toString(36)}`, type: 'text', title: '用户补充', content: note }] : []),
    ]
    const updated = store.update(current.task.id, {
      brief: { ...current.task.brief, materials },
      status: materials.length ? 'starting' : 'needs_input',
      events: [...current.task.events, { type: 'input_provided', summary: note.slice(0, 500) }],
    })
    if (updated.ok && updated.task.status === 'starting') void execute(updated.task.id)
    return updated
  }

  function reviewDeliverable(input = {}) {
    const store = deps.getWorkbenchTaskStore()
    const action = input.action === 'accept' ? 'accept' : 'changes_requested'
    if (action === 'accept') {
      const current = reconcileTask(input.taskId || input.id)
      if (!current.ok) return current
      const item = current.task.deliverables.find(value => value.deliverableId === input.deliverableId)
      if (item?.evidenceStatus === 'blocked') {
        return { ok: false, error: '该交付物尚未完成声明的真实工具执行，不能验收' }
      }
    }
    const reviewed = store.reviewDeliverable(input.taskId || input.id, input.deliverableId, {
      ...input,
      action,
      actorId: input.actorId || 'user',
    })
    const shouldContinue = reviewed.ok && (
      action === 'changes_requested'
      || (action === 'accept' && reviewed.task.status !== 'completed')
    )
    if (shouldContinue) void execute(reviewed.task.id)
    return { ...reviewed, started: shouldContinue }
  }

  function cancel(id) {
    const store = deps.getWorkbenchTaskStore()
    const current = store.get(id)
    if (!current.ok) return current
    controllers.get(current.task.id)?.abort()
    return store.update(current.task.id, {
      status: 'cancelled',
      events: [...current.task.events, { type: 'cancelled', summary: '用户取消任务' }],
    })
  }

  function retry(id) {
    const store = deps.getWorkbenchTaskStore()
    const current = store.get(id)
    if (!current.ok) return current
    if (!['failed', 'cancelled'].includes(current.task.status)) {
      return { ok: false, error: '当前任务不需要重新执行' }
    }
    const updated = store.update(current.task.id, {
      status: 'starting',
      events: [...current.task.events, { type: 'retried', summary: '用户重新执行任务' }],
    })
    if (updated.ok) void execute(updated.task.id)
    return { ...updated, started: Boolean(updated.ok) }
  }

  return { createStart, provideInput, reviewDeliverable, cancel, retry, execute, get: reconcileTask, controllers }
}

module.exports = { createExpertTaskRuntime }
