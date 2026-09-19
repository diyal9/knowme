'use strict'

/**
 * 生成主路径：prepare → 工具面 → kernel。仅支持 kernel executor。
 * 终态必须 completeAdoptedRun，并清掉 ports/abort/连接器。
 */

const L = require('./agent-generate-libs')
const { prepareAgentGenerate } = require('./agent-generate-prepare')
const { buildRunToolSurface } = require('./agent-generate-tool-surface')
const { createChildRunPortFactory, makeOrchestrationPort } = require('./agent-generate-child-ports')

/** IPC 壳传入的 env；返回流式结果或 `{ error, runId }`。 */
async function executeAgentGenerate(env) {
  const {
    AgentRunExecutor, buildProductionRunPorts, resolveAgentExecutorMode, resolveGroundingRuntimeMode,
    feishuGrounding, feishuGroundingAdapter, agentVerify, agentRun, writingWorkflow, llmUsage,
    productMemory, brainService, app, normalizeAssistantOutput, agentProcessTools, logger, contextEngine,
  } = L
  const {
    loadSettings, saveSettings_, loadAgentSessions, saveAgentSessions, getFeishuGroundingContext,
    hasPriorFeishuFacts, MEMORY_DIR, agentRuntimePortFactories, agentRuntimeOutputBridges,
    activeAgentRuns,
  } = env.deps
  const { payload, runId, signal, stage, emit, fail, metrics, runStartedAt } = env

  try {
    const prepared = await prepareAgentGenerate(env)
    if (prepared.early) return prepared.early

    const surface = await buildRunToolSurface(env, prepared)
    if (surface.early) return surface.early
    env.settleAdoptedRun = surface.settleAdoptedRun
    prepared.session = surface.session
    prepared.apiMessages = surface.apiMessages
    prepared.groundingTaskFrame = surface.groundingTaskFrame
    prepared.contextInfo = surface.contextInfo

    if (resolveAgentExecutorMode() !== 'kernel') {
      return fail(new Error('legacy agent executor is no longer supported'))
    }

    const {
      s, url, routedModel, policy, promptCachePolicy, tokenCalKey, tokenCalBefore, modelProfile,
      tier, session, ctxRole, writingTask, prompt, effectivePersonalization, groundingTaskFrame,
      contextInfo, apiMessages,
    } = prepared
    const {
      teamRuntime, toolSurface, toolExecutor, connectorRuntime, resolvedSurface, feishuIntent,
      systemFeishuEnabled,
    } = surface

    const suppressStreamForFeishuGuard = !!(
      feishuIntent &&
      feishuIntent.mentioned &&
      (feishuIntent.needsSearch || feishuIntent.needsContentRead || feishuIntent.asksMinutes)
    )
    void suppressStreamForFeishuGuard

    const orchestrationPort = makeOrchestrationPort(env, teamRuntime, runId)
    agentRuntimePortFactories.set(runId, createChildRunPortFactory(env, prepared, surface))

    const ports = buildProductionRunPorts({
      settings: s,
      signal,
      url,
      runId,
      routedModel,
      policy,
      promptCachePolicy,
      tokenCalKey,
      toolSurface,
      toolExecutor,
      tier,
      apiMessages,
      session,
      toolsEnabled: contextEngine.isToolExecutionAllowed(prepared.executionPolicy)
        && tier !== 'chat'
        && modelProfile.supportsTools !== false,
      requestAgentCompletion: env.deps.requestAgentCompletion,
      onStreamChunk: null,
      runStartedAt,
      effectivePersonalization,
      ctxBundle: { contextInfo, taskFrame: groundingTaskFrame, providedMaterials: prepared.providedMaterials },
      taskRef: payload.taskRef,
      workbenchTaskId: payload.workbenchTaskId,
      loadAgentSessions,
      saveAgentSessions,
      productMemoryCapture: productMemory.capture,
      memoryDir: MEMORY_DIR,
      normalizeAssistantOutput,
      orchestration: orchestrationPort(runId),
      governancePolicy: resolvedSurface.governancePolicy,
      budget: session?.run?.budget || payload.budget || null,
      persistRunCheckpoint: checkpoint => teamRuntime.manager.saveCheckpoint(runId, 'latest', checkpoint),
      cancelProcessesForRun: agentProcessTools.cancelProcessesForRun,
      recordReceipt: receipt => teamRuntime.store.writeReceipt(
        runId,
        receipt.idempotencyKey || receipt.auditId || `receipt_${Date.now()}`,
        { result: receipt.envelope || receipt },
      ),
      writingArtifactHook: (sess, fullText) => {
        if (ctxRole === 'writing' && writingWorkflow.shouldCreateWritingArtifact(fullText, writingTask)) {
          return agentRun.addArtifact(sess, writingWorkflow.buildWritingArtifact(fullText, writingTask))
        }
        return sess
      },
      persistTokenCalibration: (runMetrics, calKey) => {
        const calNow = llmUsage.getCalibration(calKey)
        if (calNow.samples > tokenCalBefore.samples) {
          try {
            const latest = loadSettings()
            saveSettings_({
              ...latest,
              tokenCalibrations: llmUsage.exportCalibrations(),
            })
          } catch { /* ignore */ }
        }
      },
      postProcessHooks: async ({ fullText, toolMessages: toolMsgs, session: sess }) => {
        // Expert planning/discussion deliberately runs without tools. It is a
        // conversation about the task, not an attempted Feishu read. Do not
        // probe Feishu or replace the expert's planning answer with the
        // generic "没有拿到工具返回" guard in this phase.
        const collaborationOnly = payload.conversationMode === 'expert-planning'
          || payload.conversationMode === 'expert-discussion'
        const formalExecution = payload.conversationMode === 'expert-execution'
        // Formal obligations come from structured contracts, never from the
        // display label, task ID, SOP, or source material. Runtime GROUND keeps
        // its independent strict gate; legacy needs the same declared-receipt
        // check here because it skips that phase. Neither path guesses intent.
        if (formalExecution && resolveGroundingRuntimeMode() === 'legacy') {
          feishuGroundingAdapter.assertDeclaredExecutionEvidence([
            sess?.referenceState?.taskFrame,
            groundingTaskFrame,
            payload.executionContract,
          ], toolMsgs, sess)
        }
        if (!collaborationOnly && !formalExecution) {
          const discoveredFeishuContext = await getFeishuGroundingContext()
          const feishuGroundingContext = systemFeishuEnabled && discoveredFeishuContext.connectorEnabled === false
            ? {
                ...discoveredFeishuContext,
                // The built-in surface is already projected for this explicit
                // request. Do not tell the model the connector is absent just
                // because the Expert has no per-agent binding or the default
                // connector record is disabled; lark-cli auth is checked when
                // the projected tool actually runs.
                connectorEnabled: true,
                allowlist: null,
                projectedAllowlist: null,
              }
            : discoveredFeishuContext
          const feishuHint = feishuGroundingAdapter.buildChatPostProcessHint(
            prepared.contextDraft?.prompt || prompt, toolMsgs, fullText, {
              ...feishuGroundingContext,
              referenceState: ports.grounding?.getReferenceState?.() || sess?.referenceState,
              priorFeishuFacts: hasPriorFeishuFacts(sess),
            },
          )
          if (feishuHint) return feishuHint
        }
        const planPartial = agentVerify.buildPartialFinalizeNote(
          agentVerify.evaluatePlanCompletion(sess?.run?.plan, {
            canExpand: false,
            budgetExhausted: true,
          }),
        )
        if (planPartial && !String(fullText).includes('计划尚未全部完成')) {
          return `${String(fullText || '').trim()}\n\n---\n${planPartial}`.trim()
        }
        return fullText
      },
    })
    try {
      const kernelResult = await AgentRunExecutor.run({
        ...payload,
        providedMaterials: prepared.providedMaterials,
        // Keep the configured name available to the final output gate. It is
        // identity metadata, never a required response prefix.
        assistantDisplayName: effectivePersonalization.agentDisplayName || '',
      }, ports, emit)
      const failed = Boolean(kernelResult.error && (kernelResult.terminal === 'ERROR' || kernelResult.terminal === 'FAILED'))
      const evidenceBlocked = kernelResult.terminal === 'ERROR'
        && (kernelResult.executionEvidence?.gateStatus === 'blocked'
          || kernelResult.executionEvidence?.verificationPassed === false)
      const unsuccessful = failed || evidenceBlocked
      env.settleAdoptedRun = null
      teamRuntime.manager.completeAdoptedRun(runId, {
        terminal: kernelResult.cancelled ? 'cancelled' : (unsuccessful ? 'failed' : 'completed'),
        status: kernelResult.cancelled ? 'cancelled' : (unsuccessful ? 'failed' : 'completed'),
        ok: !unsuccessful && !kernelResult.cancelled,
        cancelled: kernelResult.cancelled === true,
        summary: kernelResult.text || String(kernelResult.error || ''),
        report: kernelResult.report,
        metrics: kernelResult.metrics,
        stopReason: (unsuccessful || kernelResult.cancelled)
          ? String(kernelResult.error || kernelResult.executionEvidence?.violations?.[0]?.message || kernelResult.terminal || '')
          : null,
      })
      if (kernelResult.cancelled) {
        contextEngine.recordContextOutcome({
          status: 'cancelled',
          scene: contextInfo?.contextManifest?.scene,
          promptVersion: contextInfo?.contextManifest?.promptPackVersion,
          model: modelProfile.model,
        })
        return {
          error: String(kernelResult.error || '请求已取消'),
          cancelled: true,
          runId,
        }
      }
      if (failed) {
        contextEngine.recordContextOutcome({
          status: 'failed',
          scene: contextInfo?.contextManifest?.scene,
          promptVersion: contextInfo?.contextManifest?.promptPackVersion,
          model: modelProfile.model,
        })
        // Keep the humanized public error while preserving typed kernel
        // diagnostics. Expert tasks and qualification harnesses need the
        // actual review findings and budget metrics; collapsing this to
        // `{ error, runId }` made every professional rejection look alike.
        const projectedFailure = fail(kernelResult.error)
        return {
          ...projectedFailure,
          code: kernelResult.code || kernelResult.errorInfo?.code || kernelResult.report?.error?.code || null,
          errorInfo: kernelResult.errorInfo || kernelResult.report?.error || null,
          metrics: kernelResult.metrics || null,
          report: kernelResult.report || null,
          executionEvidence: kernelResult.executionEvidence || null,
          terminal: kernelResult.terminal || null,
          protocolVersion: kernelResult.protocolVersion || null,
        }
      }
      const finalSession = ports._state?.session || session
      try {
        if (brainService && app && typeof brainService.observeConversation === 'function') {
          brainService.observeConversation(app.getPath('userData'), {
            text: prompt,
            sessionId: finalSession?.id,
            runId,
            taskId: finalSession?.taskRef?.id,
            projectId: finalSession?.projectId,
            agentId: finalSession?.agentId || payload.agentId || 'personal',
            ephemeral: finalSession?.ephemeral === true || payload.ephemeral === true,
            allowPromotionProposal: payload.knowledgePolicy?.allowPromotionProposal,
            sourceLabel: '你在伙伴对话中的明确表达',
          }, { memoryDir: MEMORY_DIR })
        }
      } catch { /* cognition observation must never block the completed answer */ }
      contextEngine.recordContextOutcome({
        text: kernelResult.text,
        identity: contextInfo?.contextManifest?.identity,
        identityAsked: /你叫什么|你的名字|你是谁|自我介绍|what(?:'s| is) your name|who are you|introduce yourself/i.test(String(prompt || '')),
        toolCalls: kernelResult.metrics?.toolCalls || 0,
        retries: kernelResult.metrics?.retries || 0,
        status: kernelResult.cancelled ? 'cancelled' : (evidenceBlocked ? 'failed' : 'completed'),
        scene: contextInfo?.contextManifest?.scene,
        promptVersion: contextInfo?.contextManifest?.promptPackVersion,
        model: modelProfile.model,
      })
      return {
        streamed: kernelResult.streamed, runId, sessionId: finalSession.id,
        artifacts: finalSession?.run?.artifacts || [],
        // Tool-owned artifacts may not be materialized into the generic session
        // artifact store. Preserve their refs so expert runtimes can promote a
        // generated image URL/data block into a reviewable deliverable.
        artifactRefs: Array.isArray(kernelResult.artifactRefs) ? kernelResult.artifactRefs : [],
        toolCalls: kernelResult.metrics?.toolCalls || 0, compacted: false,
        metrics: kernelResult.metrics, protocolVersion: kernelResult.protocolVersion || null,
        answerHash: kernelResult.answerHash || null, terminal: kernelResult.terminal || null,
        text: String(kernelResult.text || ''),
        attention: kernelResult.attention || null,
        executionEvidence: kernelResult.executionEvidence || {
          gateStatus: 'not_required', verificationPassed: true, toolCalls: [], evidence: [], violations: [],
        },
        personalization: {
          applied: effectivePersonalization.applied.map(item => ({
            id: item.id, kind: item.kind, text: item.text,
          })),
          omitted: effectivePersonalization.omitted,
        },
      }
    } catch (err) {
      env.settleAdoptedRun = null
      teamRuntime.manager.completeAdoptedRun(runId, {
        terminal: 'failed',
        status: 'failed',
        ok: false,
        error: String(err?.message || err),
        summary: String(err?.message || err),
        stopReason: String(err?.message || err || 'run_failed').slice(0, 200),
      })
      return {
        error: String(err?.message || err || '生成失败'),
        runId,
        protocolVersion: 2,
      }
    } finally {
      await teamRuntime.manager.cancelAllChildren(runId, 'parent_terminal').catch(() => {})
      agentRuntimePortFactories.delete(runId)
      agentRuntimeOutputBridges.delete(runId)
      activeAgentRuns.delete(runId)
      try { await connectorRuntime.close() } catch { /* ignore */ }
    }
  } catch (err) {
    try {
      logger.error(
        'system',
        'ai-generate-unhandled',
        String(err?.message || err || '').slice(0, 300),
        { runId, stack: String(err?.stack || '').slice(0, 1500) },
      )
    } catch { /* logging must not mask original failure */ }
    return fail(err)
  }
}

module.exports = { executeAgentGenerate }
