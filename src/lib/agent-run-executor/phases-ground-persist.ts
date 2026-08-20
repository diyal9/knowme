'use strict'

const agentRun = require('../agent-run')
const { normalizeAssistantOutput, enforceAssistantOutputGate } = require('../assistant-output-style')
const { resolveGroundingRuntimeMode } = require('../agent-run-ports')
const groundingRuntime = require('../agent-grounding-runtime')
const { EventType } = require('../agent-output-protocol')
const { mergeArtifactRefs } = require('./hints')
const {
  mergeExecutionContracts,
  validateExecutionCompletion,
} = require('../agent-execution-contract')

/**
 * GROUND + VERIFY_CLAIMS + PERSIST + DONE：依据核对、规范化输出与会话持久化。
 * 不负责 MODEL↔TOOL 循环。
 */

async function runGroundAndPersist(deps) {
  const {
    input,
    ports,
    runStartedAt,
    RunPhase,
    OUTPUT_PROTOCOL_VERSION,
    enterPhase,
    stage,
    emitV2,
    commitCanonicalAnswer,
    buildResult,
    emitTerminal,
    runPhases,
    metrics,
    planEval,
    setTerminal,
    trace,
    ctxBundle,
    fullText: initialFullText,
    session: initialSession,
    toolMessages,
    toolCallCount,
    streamed,
    artifactRefs,
    referenceState: initialReferenceState,
    evidenceLedger: initialEvidenceLedger,
    toolLedger: initialToolLedger,
    finalizeResponse,
    loopState,
    modelRound,
  } = deps

  let fullText = initialFullText
  let session = initialSession
  let referenceState = initialReferenceState
  let evidenceLedger = initialEvidenceLedger
  let toolLedger = initialToolLedger
  let verification = null
  let outputGateStatus = 'not_required'
  const groundingMode = resolveGroundingRuntimeMode()

  if (ports.hooks?.postProcess) {
    fullText = await ports.hooks.postProcess({ fullText, toolMessages, session, input }) || fullText
  }

  if (groundingMode === 'runtime') {
    enterPhase(RunPhase.GROUND)
    stage('stage_ground', '正在核对依据…', 'pending', { runPhase: RunPhase.GROUND })
    const merged = groundingRuntime.mergeToolResultsIntoLedgers({
      toolLedger: groundingRuntime.createToolLedger(),
      evidenceLedger: groundingRuntime.createEvidenceLedger({ runId: input.runId || 'run' }),
      toolMessages,
    })
    toolLedger = merged.toolLedger
    evidenceLedger = merged.evidenceLedger
    ports.grounding?.setLedgers?.({ evidenceLedger, toolLedger })
    session.referenceState = groundingRuntime.serializeReferenceState(referenceState)
    stage('stage_ground', '依据核对完成', 'done', { runPhase: RunPhase.GROUND })

    enterPhase(RunPhase.VERIFY_CLAIMS)
    stage('stage_verify_claims', '正在验证输出依据…', 'pending', { runPhase: RunPhase.VERIFY_CLAIMS })
    const taskFrame = mergeExecutionContracts([
      referenceState.taskFrame,
      ctxBundle.taskFrame,
      input.executionContract,
    ])
    if (taskFrame?.requiredTools?.length || taskFrame?.requiredEvidence?.length || taskFrame?.completionConditions?.length) {
      referenceState = groundingRuntime.setTaskFrame(referenceState, taskFrame)
    }
    verification = groundingRuntime.verifyClaims({
      text: fullText,
      evidenceLedger,
      toolLedger,
      referenceState,
      taskFrame,
    })
    const contractAssessment = validateExecutionCompletion(taskFrame, {
      executionEvidence: {
        toolCalls: (toolLedger?.calls || []).map(item => ({ name: item.name, status: item.status })),
        evidence: evidenceLedger?.entries || [],
      },
      artifactRefs: mergeArtifactRefs(
        Array.isArray(session?.run?.artifacts)
          ? session.run.artifacts.map(artifact => ({
              id: artifact.id,
              kind: artifact.type || artifact.kind || 'artifact',
              type: artifact.type || artifact.kind || 'artifact',
            }))
          : [],
        artifactRefs,
      ),
    })
    if (!contractAssessment.ok) {
      verification = {
        ...verification,
        passed: false,
        violations: [...(verification?.violations || []), ...contractAssessment.violations],
      }
    }
    let gate = groundingRuntime.applyOutputGate({ text: fullText, verification, taskFrame, regenUsed: false })
    if (!gate.allowed && gate.regenSuggested && loopState.finalizationUsed !== true) {
      const regen = await finalizeResponse('grounding')
      if (regen?.snapshot?.content) fullText = regen.snapshot.content
      verification = groundingRuntime.verifyClaims({
        text: fullText,
        evidenceLedger,
        toolLedger,
        referenceState,
        taskFrame,
      })
      gate = groundingRuntime.applyOutputGate({ text: fullText, verification, taskFrame, regenUsed: true })
    }
    if (!gate.allowed) fullText = gate.refusal || gate.text
    outputGateStatus = gate.allowed ? 'verified' : 'blocked'
    const groundingStatus = groundingRuntime.buildGroundingStatus(verification, { evidenceLedger, toolLedger })
    emitV2({ type: 'grounding-status', ...groundingStatus, runPhase: RunPhase.VERIFY_CLAIMS })
    stage('stage_verify_claims', gate.blocked ? '输出已阻断未验证声明' : '输出验证通过', gate.blocked ? 'error' : 'done', {
      runPhase: RunPhase.VERIFY_CLAIMS,
      summary: gate.blocked ? (gate.refusal || '').slice(0, 200) : '',
    })
  }

  const outputGate = enforceAssistantOutputGate(fullText, {
    allowRawJson: /原始\s*json|json\s*原文|原始数据/i.test(String(input.prompt || '')),
  })
  fullText = normalizeAssistantOutput(outputGate.text)

  const committed = commitCanonicalAnswer(fullText)
  fullText = committed.text

  enterPhase(RunPhase.PERSIST)
  for (const item of trace) session = agentRun.upsertStep(session, item)
  session.messages = session.messages || []
  session.messages.push(...toolMessages, {
    role: 'assistant',
    text: fullText.slice(0, 12000),
    trace,
    protocolVersion: OUTPUT_PROTOCOL_VERSION,
    answerHash: committed.hash,
    ui: committed.ui,
  })
  session.updatedAt = new Date().toISOString()
  ports.session.set?.(session)

  const persistedArtifactRefs = mergeArtifactRefs(
    Array.isArray(session?.run?.artifacts)
      ? session.run.artifacts.map(artifact => ({
          id: artifact.id,
          kind: artifact.type || artifact.kind || 'artifact',
          title: artifact.title || artifact.id,
          status: artifact.status || null,
        }))
      : [],
    artifactRefs,
  )

  await ports.session.persist?.({
    session,
    fullText,
    trace,
    toolMessages,
    metrics,
    input,
    emit: emitV2,
    answerHash: committed.hash,
    protocolVersion: OUTPUT_PROTOCOL_VERSION,
    ui: committed.ui,
    artifactRefs: persistedArtifactRefs,
    evidenceRefs: Array.isArray(evidenceLedger?.entries)
      ? evidenceLedger.entries.slice(-32).map(entry => ({
        id: entry.id,
        refId: entry.refId,
        status: entry.status,
        digest: entry.digest,
        provenance: entry.provenance,
      }))
      : [],
  })

  enterPhase(RunPhase.DONE)
  setTerminal(RunPhase.DONE)
  if (!runPhases.includes(RunPhase.DONE)) runPhases.push(RunPhase.DONE)

  metrics.totalMs = (ports.clock?.now?.() || Date.now()) - runStartedAt
  emitTerminal(EventType.RUN_COMPLETED, {
    title: '执行完成',
    toolCalls: toolCallCount,
    metrics,
    answerHash: committed.hash,
  }, RunPhase.DONE)

  return buildResult({
    text: fullText,
    streamed,
    terminal: RunPhase.DONE,
    runPhases,
    metrics,
    planEval,
    session,
    toolCallCount,
    runStartedAt,
    ports,
    answerHash: committed.hash,
    protocolVersion: OUTPUT_PROTOCOL_VERSION,
    ui: committed.ui,
    artifactRefs: persistedArtifactRefs,
    executionEvidence: {
      gateStatus: outputGateStatus,
      verificationPassed: verification ? verification.passed === true : true,
      violations: (verification?.violations || []).slice(0, 16).map(item => ({
        code: String(item.code || ''),
        message: String(item.message || '').slice(0, 500),
        missingTools: Array.isArray(item.missingTools) ? item.missingTools.slice(0, 32).map(String) : [],
      })),
      toolCalls: (toolLedger?.calls || []).slice(-64).map(item => ({
        id: String(item.id || ''),
        name: String(item.name || ''),
        status: item.status === 'ok' ? 'ok' : 'fail',
        resultRef: item.resultRef || null,
        error: item.error || null,
        durationMs: item.durationMs || null,
      })),
      evidence: (evidenceLedger?.entries || []).slice(-64).map(item => ({
        id: String(item.id || ''),
        status: String(item.status || ''),
        digest: String(item.digest || '').slice(0, 500),
        provenance: item.provenance && typeof item.provenance === 'object' ? item.provenance : {},
      })),
    },
  })
}

module.exports = {
  runGroundAndPersist,
}
