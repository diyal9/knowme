'use strict'

/**
 * Workbench one-shot dispatch LLM stream（无会话副作用）。
 * HTTP 只走 requestAgentCompletion，不另开 Node HTTPS 套接字。
 */
const { applyProviderCompat } = require('../lib/main-llm-bridge')

function registerWorkbenchDispatchIpc(ipcMain, deps) {
  const {
    loadSettings,
    llmModelCatalog,
    normalizeChatEndpoint,
    requestAgentCompletion,
  } = deps

  ipcMain.handle('workbench-dispatch', async (e, payload = {}) => {
    const webContents = e.sender
    const s = loadSettings()
    if (!s.apiKey) return { error: '未填写 API Key，请托盘右键 → API 设置' }
    if (!s.apiEndpoint) return { error: '未填写 API Endpoint，请托盘右键 → API 设置' }
    const prompt = String(payload.prompt || '').trim()
    if (!prompt) return { error: '空派单内容' }
    const dispatchId = String(payload.dispatchId || '')
    const routedModel = llmModelCatalog.resolveRuntimeModel(s, {
      tier: 'assist',
      prompt,
    })

    let url
    try { url = new URL(normalizeChatEndpoint(s.apiEndpoint)) } catch { return { error: `Endpoint 格式错误: ${s.apiEndpoint}` } }

    const messages = [
      { role: 'system', content: '你是 AgentTeams 工作流编排中的执行体（Worker）。严格按用户给出的角色人设与工作流节点规格产出该节点的成果，结构清晰、可执行；不越权、不臆造未提供的事实。' },
      { role: 'user', content: prompt.slice(0, 12000) },
    ]
    const chatTemp = (() => {
      const n = Number(s.temperature)
      if (!Number.isFinite(n)) return 0.6
      return Math.min(2, Math.max(0, n))
    })()
    const body = applyProviderCompat(url, {
      model: routedModel.model || 'gpt-4o-mini',
      messages,
      max_tokens: 2000,
      temperature: chatTemp,
      stream: true,
    }, s)

    const pushChunk = (fullText) => {
      if (!webContents.isDestroyed()) webContents.send('workbench-stream-chunk', { dispatchId, text: fullText })
    }

    const result = await requestAgentCompletion({
      url,
      settings: s,
      body,
      onSnapshot: (snapshot) => {
        if (snapshot?.content) pushChunk(snapshot.content)
      },
    })
    if (result.error) return { error: result.error }
    const text = result.snapshot?.content || ''
    if (!text) return { error: `响应格式异常 (${result.status || ''})`.trim() }
    return { text, streamed: result.streamed }
  })
}

module.exports = { registerWorkbenchDispatchIpc }
