'use strict'

/**
 * ai-generate IPC 壳：abort、stream、trace、失败收敛。
 * 生成编排在 executeAgentGenerate，本文件不组装工具/上下文。
 */

const { humanizeAgentError } = require('../lib/agent-error-humanize')
const { assertRequiredDeps } = require('../lib/ipc-assert-deps')
const { executeAgentGenerate } = require('../lib/agent-generate-execute')
const { buildTemporalAnchorContext } = require('../lib/temporal-anchor')
const { mergeExtraTools } = require('../lib/merge-extra-tools')
const { normalizeAssistantOutput } = require('../lib/assistant-output-style')

// 保留 require，避免拆文件后主进程打包/依赖图漏边。
void buildTemporalAnchorContext
void mergeExtraTools
void normalizeAssistantOutput

/** 缺任一项则拒绝注册 IPC。 */
const AI_GENERATE_REQUIRED_DEPS = [
  'activeAgentRuns',
  'loadSettings',
  'saveSettings_',
  'ensureAgentSession',
  'saveAgentSessions',
  'loadAgentSessions',
  'buildFabricCtx',
  'ensureFabricSeeded',
  'ensureCapabilityHub',
  'ensureAgentTeamRuntime',
  'readNote',
  'buildEmbedFn',
  'normalizeChatEndpoint',
  'requestAgentCompletion',
  'buildMissingResourceHint',
  'getFeishuGroundingContext',
  'hasPriorFeishuFacts',
  'resolveActiveProvider',
  'KNOWLEDGE_DIR',
  'MEMORY_DIR',
  'agentRuntimePortFactories',
  'loadSourcesStore',
  'getActiveSourceRoot',
  'kosSourcesCtx',
  'workbenchDaemon',
  'buildActiveSourceFileTools',
  'agentRuntimeOutputBridges',
]

/** 注册 `ai-generate`；返回前必须从 activeAgentRuns 摘掉 AbortController。 */
function registerAiGenerateIpc(ipcMain, deps) {
  assertRequiredDeps(deps, AI_GENERATE_REQUIRED_DEPS, 'ai-generate')
  const { activeAgentRuns } = deps
  ipcMain.handle('ai-generate', async (e, payload = {}) => {
    const { sessionId } = payload
    const webContents = e.sender
    const runId = String(payload.runId || `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`)
    const controller = new AbortController()
    const signal = controller.signal
    activeAgentRuns.set(runId, controller)
    const runStartedAt = Date.now()
    const metrics = { rounds: 0, toolCalls: 0, firstTokenMs: null }
    const trace = []
    const emit = event => {
      if (webContents.isDestroyed()) return
      webContents.send('ai-stream-event', { runId, sessionId, ...event })
    }
    const upsertTrace = event => {
      const index = trace.findIndex(item => item.id === event.id)
      const next = {
        id: event.id,
        kind: event.kind === 'tool' ? 'tool' : 'stage',
        title: event.title,
        status: event.status || 'done',
        summary: event.summary || '',
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        durationMs: event.durationMs,
      }
      if (index >= 0) trace[index] = { ...trace[index], ...next }
      else trace.push(next)
    }
    const stage = (id, title, status = 'pending', extra = {}) => {
      const event = { id, type: extra.fallback ? 'fallback' : 'stage', kind: 'stage', title, status, ...extra }
      upsertTrace(event)
      emit(event)
    }
    let settleAdoptedRun = null
    const fail = error => {
      const message = humanizeAgentError(error, { fallback: '暂时无法完成回复，请重试' })
      activeAgentRuns.delete(runId)
      if (settleAdoptedRun) {
        const settle = settleAdoptedRun
        settleAdoptedRun = null
        try { settle(message) } catch { /* 终态收敛不阻断错误返回 */ }
      }
      stage('stage_generate', '生成失败', 'error', { summary: message.slice(0, 500) })
      emit({ type: 'error', title: '生成失败', summary: message.slice(0, 500) })
      return { error: message, runId }
    }
    const env = {
      deps,
      payload,
      runId,
      signal,
      controller,
      metrics,
      runStartedAt,
      stage,
      emit,
      fail,
      get settleAdoptedRun() { return settleAdoptedRun },
      set settleAdoptedRun(value) { settleAdoptedRun = value },
    }
    return executeAgentGenerate(env)
  })
}

module.exports = { registerAiGenerateIpc, AI_GENERATE_REQUIRED_DEPS }
