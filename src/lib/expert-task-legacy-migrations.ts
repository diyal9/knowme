'use strict'

// Historical task repair lives behind an explicit boot-time boundary. New
// expert execution must never import behavior from this module by identity.
const IMAGE_FILE_PATTERN = /\.(?:avif|gif|jpe?g|png|svg|webp)(?:$|[?#])/i

function text(value, max = 2000) {
  return String(value == null ? '' : value).trim().slice(0, max)
}

function hasLegacyArtifactEvidence(task) {
  return (task?.executionEvidence || []).some(entry => (
    (entry?.toolCalls || []).some(call => call?.name === 'generate_image' && call?.status === 'ok')
  ))
}

function recoveredImageArtifact(deps, task) {
  if (task?.expertId !== 'image-producer') return null
  const successfulRun = [...(task.executionEvidence || [])].reverse().find((entry) => (
    (entry?.toolCalls || []).some(call => call?.name === 'generate_image' && call?.status === 'ok')
  ))
  const runId = text(successfulRun?.runId, 160)
  const userData = deps?.app?.getPath?.('userData')
  if (!runId || !userData || !deps?.fs || !deps?.path) return null
  const safeRunId = runId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100)
  const directory = deps.path.join(userData, 'generated-images', safeRunId)
  try {
    const file = deps.fs.readdirSync(directory, { withFileTypes: true })
      .filter(entry => entry?.isFile?.() && IMAGE_FILE_PATTERN.test(entry.name))
      .sort((a, b) => a.name.localeCompare(b.name))[0]
    if (!file) return null
    const targetPath = deps.path.join(directory, file.name)
    return {
      id: `recovered_${safeRunId}_${file.name}`.slice(0, 300),
      type: 'image',
      kind: 'image',
      title: '生成图片',
      targetPath,
      path: targetPath,
      meta: { provider: 'pango', recovered: true, sourceRunId: runId },
      executionEvidence: successfulRun,
    }
  } catch {
    return null
  }
}

function reconcileLegacyExpertArtifacts({ deps, store, task, snapshot, helpers }) {
  if (task?.expertId !== 'image-producer') return task
  const { expertAttention, expertProgress, hydrateBriefContracts } = helpers
  const imageDeliverables = (task.deliverables || []).filter(item => item.type === 'image')
  const hasImage = imageDeliverables.length > 0
  const hasTextOnlyDeliverables = imageDeliverables.length !== (task.deliverables || []).length
  const shouldReopen = !hasImage && ['review', 'completed'].includes(task.status)
  const migrationRecorded = task.events?.some(event => event.type === 'image_delivery_reconciled')
  const recovered = recoveredImageArtifact(deps, task)
  // Do not turn a failed revision into a new pending version on restart. In
  // particular, keep its feedback and prior-version association for a retry.
  if (recovered?.executionEvidence?.verificationPassed === false
    || recovered?.executionEvidence?.gateStatus === 'blocked') return task
  const recoveredRunId = text(recovered?.executionEvidence?.runId, 160)
  const latestImageIsRepresented = recoveredRunId && imageDeliverables.some(item => (
    text(item.executionRef, 240) === `agent-run:${recoveredRunId}`
  ))
  if (recovered && !latestImageIsRepresented) {
    const ensured = deps.ensureAgentSession(task.execRef?.id, task.expertId, {
      surface: 'workbench', ephemeral: true, expertId: task.expertId,
      taskRef: { id: task.id, kind: 'expert-task' },
    })
    let session = ensured.session
    const existing = (session?.run?.artifacts || []).find(item => item.id === recovered.id)
    if (!existing) {
      session = deps.agentRun.addArtifact(session, {
        ...recovered,
        body: `![${recovered.title}](${recovered.targetPath})`,
        status: 'draft',
        meta: { ...recovered.meta, taskId: task.id, deliverableId: 'generated-image' },
      })
    }
    deps.saveAgentSessions(ensured.sessions.map(item => item.id === session.id ? session : item))
    const sourceEvidence = recovered.executionEvidence || {}
    // Finding bytes does not overturn a failed execution contract. Preserve the
    // original verdict and violations; recovery is a storage event, not a test.
    const sourceBlocked = sourceEvidence.verificationPassed === false || sourceEvidence.gateStatus === 'blocked'
    const migrated = store.update(task.id, {
      status: sourceBlocked ? 'needs_input' : 'review',
      attention: sourceBlocked ? task.attention : null,
      progress: expertProgress(sourceBlocked ? 'blocked' : 'review', sourceBlocked ? '图片已恢复，执行校验仍未通过' : '已恢复生成图片，等待验收'),
      resultSummary: sourceBlocked ? '已恢复上一轮图片文件，但原执行校验尚未通过，失败记录已保留。' : '已恢复上一轮生成的图片，请查看后接受成果或提出修改。',
      deliverables: [{
        deliverableId: 'generated-image',
        title: recovered.title,
        type: 'image',
        required: true,
        version: Math.max(1, ...imageDeliverables.map(item => Number(item.version) || 0)) + (hasImage ? 1 : 0),
        previousVersionId: hasImage ? text(imageDeliverables.at(-1)?.artifactRef, 300) : '',
        artifactRef: `${session.id}#${recovered.id}`,
        artifactRefs: [`${session.id}#${recovered.id}`],
        executionRef: `agent-run:${sourceEvidence.runId || ''}`,
        evidenceStatus: sourceBlocked ? 'blocked' : 'verified',
        acceptanceStatus: 'pending',
      }],
      executionEvidence: [...(task.executionEvidence || []), {
        ...sourceEvidence,
        recoveredAt: new Date().toISOString(),
      }],
      events: [...task.events, { type: 'image_delivery_recovered', summary: sourceBlocked ? '已恢复图片文件；原执行校验结果保持不变。' : '已恢复历史任务生成的真实图片，等待用户验收。' }],
    })
    return migrated.ok ? migrated.task : task
  }
  if ((hasTextOnlyDeliverables || shouldReopen) && !migrationRecorded) {
    const migrated = store.update(task.id, {
      status: shouldReopen ? 'needs_input' : task.status,
      attention: shouldReopen ? expertAttention('retryable_failure', 'retry', {
        title: '需要重新生成真实图片', item: '真实图片',
        detail: '旧版任务只有方案文字，没有可验收的图片。无需重复补充需求，可按原方案重新生成。',
      }) : task.attention,
      progress: shouldReopen ? expertProgress('blocked', '等待重新生成', { detail: '原方案已经保留。' }) : task.progress,
      brief: hydrateBriefContracts(task.brief, snapshot),
      deliverables: imageDeliverables,
      events: [...task.events, {
        type: 'image_delivery_reconciled',
        summary: shouldReopen
          ? '旧版只有方案文字，没有真实图片；已恢复协作，请确认方案后重新生成。'
          : '已移除对话中重复展示的文字成果，只保留真实生成图片。',
      }],
    })
    return migrated.ok ? migrated.task : task
  }
  return task
}

module.exports = { hasLegacyArtifactEvidence, reconcileLegacyExpertArtifacts }
