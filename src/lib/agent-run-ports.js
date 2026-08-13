'use strict'

/**
 * RunPorts — AgentRunExecutor 依赖注入契约。
 * 生产环境由 main adapter 绑定；Eval 使用 mock replay ports。
 */

const groundingRuntime = require('./agent-grounding-runtime')
const feishuAdapter = require('./agent-grounding-feishu-adapter')

const RunPhase = Object.freeze({
  PREPARE: 'PREPARE',
  CONTEXT: 'CONTEXT',
  MODEL: 'MODEL',
  TOOL: 'TOOL',
  ORCHESTRATE: 'ORCHESTRATE',
  RECOVER: 'RECOVER',
  GROUND: 'GROUND',
  VERIFY: 'VERIFY',
  VERIFY_CLAIMS: 'VERIFY_CLAIMS',
  FINALIZE: 'FINALIZE',
  PERSIST: 'PERSIST',
  DONE: 'DONE',
  ERROR: 'ERROR',
  CANCELLED: 'CANCELLED',
})

/** @returns {'legacy'|'runtime'} */
function resolveGroundingRuntimeMode() {
  return groundingRuntime.resolveGroundingRuntimeMode()
}

/** @returns {'legacy'|'kernel'} */
function resolveAgentExecutorMode() {
  const raw = String(process.env.KNOWME_AGENT_EXECUTOR || 'kernel').trim().toLowerCase()
  if (raw === 'legacy') return 'legacy'
  return 'kernel'
}

function validateRunPorts(ports) {
  const required = ['settings', 'context', 'llm', 'tools', 'session', 'clock']
  for (const key of required) {
    if (!ports || typeof ports !== 'object' || ports[key] == null) {
      throw new Error(`RunPorts missing required port: ${key}`)
    }
  }
}

/**
 * Optional RunPorts hooks (orchestration / runtime / checkpoint) — absent in legacy/eval fixtures.
 * @param {object} ports
 * @returns {{ orchestration?: object, runtime?: object, checkpoint?: object }}
 */
function getOptionalRunPortHooks(ports = {}) {
  return {
    orchestration: ports.orchestration || null,
    runtime: ports.runtime || null,
    checkpoint: ports.checkpoint || null,
  }
}

/**
 * 从 eval fixture 构造 mock ports（按 LLM call index replay）。
 * @param {object} fixture
 * @param {AbortSignal} [signal]
 */
function createMockRunPorts(fixture, signal) {
  let llmCallIndex = 0
  let toolCallIndex = 0
  const llmScript = Array.isArray(fixture.llmScript) ? fixture.llmScript : []
  const toolScript = fixture.toolScript && typeof fixture.toolScript === 'object' && !Array.isArray(fixture.toolScript)
    ? fixture.toolScript
    : null
  const toolScriptArray = Array.isArray(fixture.toolScript) ? fixture.toolScript : []
  const input = fixture.input || {}
  const sessionState = {
    session: fixture.session || {
      id: 'eval_session',
      messages: [],
      run: fixture.plan ? { plan: fixture.plan } : {},
      referenceState: fixture.referenceState || null,
    },
  }
  if (fixture.referenceState && !sessionState.session.referenceState) {
    sessionState.session.referenceState = fixture.referenceState
  }

  let referenceState = groundingRuntime.deserializeReferenceState(
    sessionState.session.referenceState || fixture.referenceState || {},
  )
  let evidenceLedger = groundingRuntime.createEvidenceLedger({ runId: fixture.name || 'eval' })
  let toolLedger = groundingRuntime.createToolLedger()

  const abortAt = fixture.abortAt
  const abortController = typeof AbortController !== 'undefined' ? new AbortController() : null
  const ctrl = signal || abortController?.signal || { aborted: false }

  const checkAbort = () => {
    if (ctrl.aborted) return true
    return false
  }

  return {
    signal: ctrl,
    clock: { now: () => Date.now() },
    settings: {
      load: () => {
        if (fixture.settingsError === 'no-api-key') {
          return { apiKey: '', apiEndpoint: 'https://mock.example/v1/chat/completions' }
        }
        return fixture.settings || { apiKey: 'mock-key', apiEndpoint: 'https://mock.example/v1/chat/completions' }
      },
    },
    context: {
      build: async () => {
        if (checkAbort()) return { aborted: true }
        const tier = input.tier || 'chat'
        const grounding = fixture.grounding || null
        let effectivePrompt = input.prompt || ''
        if (resolveGroundingRuntimeMode() === 'runtime') {
          const resolved = feishuAdapter.resolveUserPromptWithReferenceState(
            referenceState,
            effectivePrompt,
            { bindRefId: input.bindRef },
          )
          referenceState = resolved.referenceState
          sessionState.session.referenceState = groundingRuntime.serializeReferenceState(referenceState)
          if (resolved.needsClarification) {
            return {
              tier,
              messages: [{ role: 'user', content: effectivePrompt }],
              session: sessionState.session,
              toolsEnabled: false,
              groundingBlocked: true,
              blockedText: resolved.clarification,
              policy: { inputBudget: 8000, outputTokens: 2000, parameter: 'max_tokens', maxOutput: 2400, temperature: 0.7 },
              budget: fixture.budget || null,
              model: 'mock-model',
              promptCachePolicy: { enabled: false },
              tokenCalKey: 'mock:mock-model',
              effectivePersonalization: { applied: [], omitted: 0 },
              grounding,
              contextBuilt: true,
            }
          }
          effectivePrompt = resolved.prompt
          input._resolvedPrompt = effectivePrompt
          input._binding = resolved.binding
          input._intent = resolved.intent
        }
        return {
          tier,
          messages: [{ role: 'user', content: effectivePrompt }],
          session: sessionState.session,
          toolsEnabled: tier !== 'chat' || (fixture.forceTools === true),
          policy: { inputBudget: 8000, outputTokens: 2000, parameter: 'max_tokens', maxOutput: 2400, temperature: 0.7 },
          budget: fixture.budget || null,
          model: 'mock-model',
          promptCachePolicy: { enabled: false },
          tokenCalKey: 'mock:mock-model',
          effectivePersonalization: { applied: [], omitted: 0 },
          grounding,
          contextBuilt: true,
          taskFrame: referenceState.taskFrame || fixture.taskFrame || null,
        }
      },
    },
    llm: {
      complete: async () => {
        if (abortAt && abortAt.phase === 'MODEL' && llmCallIndex >= (abortAt.afterLlmCall || 0)) {
          abortController?.abort()
          return { cancelled: true }
        }
        if (checkAbort()) return { cancelled: true }
        if (llmCallIndex >= llmScript.length) {
          return {
            snapshot: { content: '已整理最终答复。', toolCalls: [], usage: { prompt_tokens: 5, completion_tokens: 3 } },
            streamed: false,
          }
        }
        const script = llmScript[llmCallIndex]
        llmCallIndex += 1
        if (script.error) return { error: script.error }
        if (script.cancel) return { cancelled: true }
        const resp = script.response || {}
        const toolCalls = Array.isArray(resp.toolCalls)
          ? resp.toolCalls.map((tc, i) => ({
            id: tc.id || `call_${llmCallIndex}_${i}`,
            name: tc.name,
            arguments: typeof tc.arguments === 'string' ? tc.arguments : JSON.stringify(tc.arguments || {}),
          }))
          : []
        return {
          snapshot: {
            content: resp.text || '',
            toolCalls,
            usage: resp.usage || { prompt_tokens: 10, completion_tokens: 5 },
          },
          streamed: false,
        }
      },
    },
    tools: {
      surface: {
        getToolDefinitions: () => [{ type: 'function', function: { name: 'search_knowledge', description: 'mock' } }],
        validateToolCall: (name, args) => ({ ok: true, args: typeof args === 'string' ? JSON.parse(args || '{}') : (args || {}) }),
      },
      execute: async (toolCall) => {
        const name = toolCall.name || 'unknown_tool'
        let script
        if (toolScript && toolScript[name]) {
          script = toolScript[name]
        } else {
          script = toolScriptArray[toolCallIndex] || toolScriptArray[toolScriptArray.length - 1] || { ok: true, text: 'mock result' }
        }
        toolCallIndex += 1
        if (script.fail) {
          const failResult = { ok: false, code: script.code || 'network', message: script.message || 'mock failure', text: script.text || script.message || 'mock failure' }
          toolLedger = groundingRuntime.recordToolCall(toolLedger, { id: toolCall.id, name, status: 'fail' })
          evidenceLedger = groundingRuntime.appendEvidence(evidenceLedger, { source: 'tool', toolCallId: toolCall.id, status: 'fail', digest: failResult.text, provenance: { tool: name, callId: toolCall.id } })
          return failResult
        }
        const result = {
          ok: script.ok !== false,
          text: script.text || 'mock tool result',
          preview: script.preview || script.text || 'mock tool result',
          sources: script.sources || [],
          artifactRefs: Array.isArray(script.artifactRefs) ? script.artifactRefs : [],
          truncated: script.truncated === true,
          meta: script.meta || {},
        }
        if (name === 'feishu.meeting_candidates') {
          referenceState = feishuAdapter.applyMeetingCandidatesToReferenceState(referenceState, result.text)
          sessionState.session.referenceState = groundingRuntime.serializeReferenceState(referenceState)
        }
        if (name === 'feishu.meeting_read') {
          result.meta = { ...(result.meta || {}), workflow: 'meeting_read' }
        }
        const quality = groundingRuntime.classifyToolResultQuality(name, result)
        toolLedger = groundingRuntime.recordToolCall(toolLedger, { id: toolCall.id, name, status: quality.status === 'fail' ? 'fail' : 'ok', truncated: quality.truncated })
        evidenceLedger = groundingRuntime.appendEvidence(evidenceLedger, {
          source: 'tool',
          toolCallId: toolCall.id,
          status: quality.status,
          digest: result.text,
          provenance: { tool: name, callId: toolCall.id },
        })
        return result
      },
    },
    grounding: {
      getReferenceState: () => referenceState,
      setReferenceState: (next) => {
        referenceState = groundingRuntime.deserializeReferenceState(next)
        sessionState.session.referenceState = groundingRuntime.serializeReferenceState(referenceState)
      },
      getEvidenceLedger: () => evidenceLedger,
      getToolLedger: () => toolLedger,
      setLedgers: ({ evidenceLedger: el, toolLedger: tl }) => {
        if (el) evidenceLedger = groundingRuntime.createEvidenceLedger(el)
        if (tl) toolLedger = groundingRuntime.createToolLedger(tl)
      },
    },
    session: {
      get: () => sessionState.session,
      set: (next) => { sessionState.session = next },
      checkpoint: async () => {},
      persist: async ({ session, fullText, trace, toolMessages, metrics }) => {
        if (fixture.persistError) throw fixture.persistError
        sessionState.session = session
        sessionState.persisted = { fullText, trace, toolMessages, metrics }
      },
    },
    hooks: fixture.hooks || {},
    _eval: { get referenceState() { return referenceState }, get evidenceLedger() { return evidenceLedger }, get toolLedger() { return toolLedger } },
  }
}

module.exports = {
  RunPhase,
  resolveAgentExecutorMode,
  resolveGroundingRuntimeMode,
  validateRunPorts,
  getOptionalRunPortHooks,
  createMockRunPorts,
}
