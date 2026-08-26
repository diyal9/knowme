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
    productMemory, normalizeAssistantOutput, agentProcessTools, logger, contextEngine,
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
      ctxBundle: { contextInfo, taskFrame: groundingTaskFrame },
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
        const feishuGroundingContext = await getFeishuGroundingContext()
        // The meeting-candidates tool is a deterministic intermediate step.
        // Always surface its own returned list (including an explicit empty
        // result) before asking the model to compose a final answer. This
        // prevents a model's generic "no evidence" sentence from replacing a
        // valid candidate response during FINALIZE/grounding.
        const latestMeetingCandidates = [...(Array.isArray(toolMsgs) ? toolMsgs : [])]
          .reverse()
          .find(item => item?.toolName === 'feishu.meeting_candidates' && item?.status === 'done')
        const hasMeetingRead = (Array.isArray(toolMsgs) ? toolMsgs : [])
          .some(item => item?.toolName === 'feishu.meeting_read' && item?.status === 'done')
        if (latestMeetingCandidates && !hasMeetingRead && String(latestMeetingCandidates.text || '').trim()) {
          return String(latestMeetingCandidates.text).trim()
        }
        if (resolveGroundingRuntimeMode() === 'legacy') {
          const feishuHint = feishuGrounding.buildFeishuGroundingHint(prompt, toolMsgs, fullText, {
            ...feishuGroundingContext,
            priorFeishuFacts: hasPriorFeishuFacts(sess),
          })
          if (feishuHint) return feishuHint
        } else {
          const feishuHint = feishuGroundingAdapter.buildLegacyPostProcessHint(prompt, toolMsgs, fullText, {
            ...feishuGroundingContext,
            priorFeishuFacts: hasPriorFeishuFacts(sess),
          })
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
        // Keep the configured name available to the final output gate. It is
        // identity metadata, never a required response prefix.
        assistantDisplayName: effectivePersonalization.agentDisplayName || '',
      }, ports, emit)
      const failed = Boolean(kernelResult.error && (kernelResult.terminal === 'ERROR' || kernelResult.terminal === 'FAILED'))
      env.settleAdoptedRun = null
      teamRuntime.manager.completeAdoptedRun(runId, {
        terminal: kernelResult.cancelled ? 'cancelled' : (failed ? 'failed' : 'completed'),
        status: kernelResult.cancelled ? 'cancelled' : (failed ? 'failed' : 'completed'),
        ok: !failed && !kernelResult.cancelled,
        cancelled: kernelResult.cancelled === true,
        summary: kernelResult.text || String(kernelResult.error || ''),
        report: kernelResult.report,
        metrics: kernelResult.metrics,
        stopReason: (failed || kernelResult.cancelled)
          ? String(kernelResult.error || kernelResult.terminal || '')
          : null,
      })
      if (kernelResult.cancelled) {
        return {
          error: String(kernelResult.error || '请求已取消'),
          cancelled: true,
          runId,
        }
      }
      if (failed) {
        return fail(kernelResult.error)
      }
      const finalSession = ports._state?.session || session
      return {
        streamed: kernelResult.streamed, runId, sessionId: finalSession.id,
        artifacts: finalSession?.run?.artifacts || [],
        toolCalls: kernelResult.metrics?.toolCalls || 0, compacted: false,
        metrics: kernelResult.metrics, protocolVersion: kernelResult.protocolVersion || null,
        answerHash: kernelResult.answerHash || null, terminal: kernelResult.terminal || null,
        text: String(kernelResult.text || ''),
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
