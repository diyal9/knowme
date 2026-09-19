'use strict'

const contextEngine = require('./context-engine')
const llmRuntime = require('./llm-runtime')
const { buildCoreContextBlocks } = require('./knowme-system-prompt')
const { buildChatMessages } = require('./ai-assistant-context')
const {
  buildToolRuntimeInstruction,
  buildToolCapabilityManifest,
  buildToolCapabilityIndex,
  TOOL_RUNTIME_PROTOCOL_VERSION,
} = require('./agent-tool-runtime')

function researchContextBlock(researchRoute = {}) {
  const content = String(researchRoute?.context || '').trim()
  if (!researchRoute?.active || !content) return null
  return {
    id: 'scene.research-runtime',
    kind: 'scene_instruction',
    authority: 'scene',
    sourceTrust: 'bundled',
    priority: 96,
    maxTokens: 1200,
    cachePolicy: 'turn',
    content,
    source: { type: 'research-routing', id: researchRoute?.intent?.mode || 'research', version: '2' },
  }
}

function buildContextInfo(draft = {}, fitted = {}, assembly = {}, modelProfile = {}) {
  return {
    ...(draft.infoBase || {}),
    usedTokens: fitted.usedTokens,
    contextWindow: modelProfile.contextWindow,
    inputBudget: draft.inputBudget,
    omittedTurns: fitted.omittedTurns,
    omittedMessages: fitted.omittedMessages,
    historyCompaction: fitted.historyCompaction || null,
    contextManifest: assembly.manifest,
    contextEngineMetrics: contextEngine.contextEngineMetricsSnapshot(contextEngine.semanticRuntimeStats()),
  }
}

function finalizeAgentContext({ prepared = {}, toolRecords = [], researchRoute = null } = {}) {
  const draft = prepared.contextDraft
  if (!draft) {
    return {
      apiMessages: Array.isArray(prepared.apiMessages) ? prepared.apiMessages : [],
      contextInfo: prepared.contextInfo || {},
      contextAssembly: null,
      capabilityIds: [],
    }
  }
  const capabilityIds = contextEngine.deriveCapabilityIdsFromToolRecords(
    toolRecords,
    draft.staticCapabilityIds || ['suggestion'],
  )
  const toolsEnabled = draft.executionPolicy === 'tools-allowed'
    && prepared.modelProfile?.supportsTools !== false
    && toolRecords.length > 0
  const contextPolicy = contextEngine.resolveContextPolicy({
    ...(draft.policyInput || {}),
    toolsEnabled,
    executionPolicy: draft.executionPolicy,
    capabilityIds,
  })
  const blocks = [
    ...buildCoreContextBlocks({
      tier: draft.tier,
      toolsEnabled,
      capabilityIds,
      locale: contextPolicy.locale,
    }),
    ...(toolsEnabled
      ? [buildToolRuntimeInstruction(toolRecords, { locale: contextPolicy.locale })].filter(Boolean)
      : []),
    ...(Array.isArray(draft.blocks) ? draft.blocks : []),
    researchContextBlock(researchRoute),
  ].filter(Boolean)
  const estimate = llmRuntime.createTokenEstimator({
    model: prepared.modelProfile?.model,
    calibrationFactor: draft.tokenCalibrationFactor,
    tokenizer: draft.tokenizer,
  })
  const startedAt = Date.now()
  const contextAssembly = contextEngine.assembleContext({
    policy: contextPolicy,
    blocks,
    query: draft.query,
    optionalTopK: draft.optionalTopK,
    budget: draft.contextBudget,
    vectorScores: draft.vectorScores,
    semanticSelection: draft.semanticSelection,
    tokenEstimator: estimate,
  })
  contextEngine.recordContextAssembly(contextAssembly.manifest, Date.now() - startedAt)
  const rawMessages = buildChatMessages({
    systemMessages: contextAssembly.messages.filter(message => message.role === 'system'),
    dataMessages: contextAssembly.messages.filter(message => message.role === 'user'),
    history: draft.history,
    prompt: draft.prompt,
    noteContext: draft.noteContext,
    imageAttachments: draft.imageAttachments,
  })
  const fitted = llmRuntime.fitConversation(rawMessages, draft.inputBudget, {
    tokenEstimator: estimate,
    preserveHistorySummary: true,
  })
  const contextInfo = buildContextInfo(draft, fitted, contextAssembly, prepared.modelProfile || {})
  contextInfo.toolRuntime = {
    protocolVersion: TOOL_RUNTIME_PROTOCOL_VERSION,
    enabled: toolsEnabled,
    mode: toolsEnabled ? 'progressive' : 'disabled',
    toolCount: Array.isArray(toolRecords) ? toolRecords.length : 0,
    capabilityIndex: buildToolCapabilityIndex(toolRecords),
    promptProjection: toolsEnabled ? 'capability-index' : 'none',
    tools: buildToolCapabilityManifest(toolRecords),
  }
  return {
    apiMessages: fitted.messages,
    contextInfo,
    contextAssembly,
    contextPolicy,
    capabilityIds,
  }
}

module.exports = { researchContextBlock, buildContextInfo, finalizeAgentContext }
