'use strict'

/**
 * AI assist IPC: title suggestion、连通探测、run 取消。
 */
const agentProcessTools = require('../lib/agent-process-tools')
const agentOrchestration = require('../lib/agent-orchestration')
const { probeLlmConnection } = require('../lib/main-llm-bridge')

function registerAiAssistIpc(ipcMain, deps) {
  const {
    loadSettings,
    chatCompletionOnce,
    cleanSuggestedTitle,
    localTitleFromParagraph,
    activeAgentRuns,
    getAgentTeamRuntime,
  } = deps

  ipcMain.handle('ai-suggest-title', async (_e, { content }) => {
    const trimmed = (content || '').trim()
    if (trimmed.length < 8) return { title: '' }

    const blank = trimmed.search(/\n\s*\n/)
    const para = (blank >= 0 ? trimmed.slice(0, blank) : trimmed).trim().slice(0, 600)
    if (para.length < 8) return { title: '' }

    const s = loadSettings()
    if (!s.apiKey || !s.apiEndpoint) {
      return { title: localTitleFromParagraph(para), local: true }
    }

    const result = await chatCompletionOnce(s, [
      {
        role: 'system',
        content: '根据用户提供的内容第一段，提炼一个简洁标题（不超过20字）。语言与内容一致。只输出标题本身，不要引号、标点装饰或解释。',
      },
      { role: 'user', content: para },
    ], 60)

    if (result.error || !result.text) {
      return { title: localTitleFromParagraph(para), local: true, error: result.error }
    }
    return { title: cleanSuggestedTitle(result.text) }
  })

  ipcMain.handle('llm-probe', async (_e, payload = {}) => {
    const saved = loadSettings()
    const overlay = payload && typeof payload === 'object' ? payload : {}
    const s = {
      ...saved,
      apiEndpoint: String(overlay.apiEndpoint || saved.apiEndpoint || '').trim() || saved.apiEndpoint,
      model: String(overlay.model || saved.model || '').trim() || saved.model,
      llmProvider: String(overlay.llmProvider || saved.llmProvider || '').trim() || saved.llmProvider,
    }
    if (overlay.apiKey) s.apiKey = String(overlay.apiKey)
    return probeLlmConnection(s)
  })

  ipcMain.handle('ai-cancel-run', async (_e, runId = '') => {
    const id = String(runId || '')
    const controller = activeAgentRuns.get(id)
    const runtime = getAgentTeamRuntime()
    if (!controller && !runtime?.manager?.getRun(id)?.ok) return { ok: false, code: 'run_not_found' }
    controller?.abort()
    const runtimeCancellation = runtime
      ? await runtime.manager.cancelRun(id, 'user_cancelled').catch(() => null)
      : null
    agentProcessTools.cancelProcessesForRun(id)

    const cancelSubRun = (subRunId) => {
      const childId = String(subRunId || '')
      if (!childId) return
      try { activeAgentRuns.get(childId)?.abort() } catch { /* ignore */ }
      if (runtime?.manager?.cancelRun) {
        Promise.resolve(runtime.manager.cancelRun(childId, 'user_cancelled')).catch(() => {})
      }
    }
    const orchCancel = await Promise.resolve(
      agentOrchestration.cancelAllSubRuns(id, {
        cancelSubRun,
        runManager: runtime?.manager || null,
        reason: 'user_cancelled',
      }),
    ).catch(() => null)

    const cancellationAccepted = Boolean(controller) || Boolean(runtimeCancellation?.ok)
    return {
      ok: cancellationAccepted,
      ...(!cancellationAccepted
        ? {
            code: runtimeCancellation?.code || 'cancel_failed',
            message: runtimeCancellation?.message || 'Run 取消未被权威运行时接受',
          }
        : {}),
      runtimeCancelled: Boolean(runtimeCancellation?.ok),
      cancelledChildren: [
        ...(runtimeCancellation?.cancelledChildren || []),
        ...(orchCancel?.cancelled || []),
        ...(orchCancel?.runtimeCancelled || []),
      ],
      elapsedMs: Math.max(runtimeCancellation?.elapsedMs || 0, orchCancel?.elapsedMs || 0),
      withinBudget: runtimeCancellation?.withinBudgetMs !== false
        && orchCancel?.withinBudget !== false,
    }
  })
}

module.exports = { registerAiAssistIpc }
