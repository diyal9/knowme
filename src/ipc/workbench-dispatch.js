'use strict'

/**
 * Workbench one-shot dispatch LLM stream (no session side effects).
 */
function registerWorkbenchDispatchIpc(ipcMain, deps) {
  const {
    https,
    http,
    loadSettings,
    llmModelCatalog,
    normalizeChatEndpoint,
    parseSseLines,
    extractChatText,
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
    const body = JSON.stringify({
      model: routedModel.model || 'gpt-4o-mini',
      messages,
      max_tokens: 2000,
      temperature: chatTemp,
      stream: true,
    })

    const pushChunk = (fullText) => {
      if (!webContents.isDestroyed()) webContents.send('workbench-stream-chunk', { dispatchId, text: fullText })
    }

    return new Promise(resolve => {
      const lib = url.protocol === 'https:' ? https : http
      const port = url.port || (url.protocol === 'https:' ? 443 : 80)
      const req = lib.request({
        hostname: url.hostname, port, method: 'POST',
        path: url.pathname + url.search,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${s.apiKey}`,
          'Content-Length': Buffer.byteLength(body),
        },
      }, res => {
        let raw = ''
        let sseBuf = ''
        let fullText = ''
        let streamed = false
        if (res.statusCode !== 200) {
          res.on('data', c => { raw += c })
          res.on('end', () => {
            try {
              const j = JSON.parse(raw)
              resolve({ error: `HTTP ${res.statusCode}: ${j.error?.message || j.message || raw.slice(0, 200)}` })
            } catch { resolve({ error: `HTTP ${res.statusCode}: ${raw.slice(0, 200)}` }) }
          })
          return
        }
        res.on('data', chunk => {
          const piece = chunk.toString()
          raw += piece
          try {
            sseBuf = parseSseLines(sseBuf + piece, delta => { fullText += delta; streamed = true; pushChunk(fullText) })
          } catch (err) { req.destroy(); resolve({ error: err.message || '流式响应解析失败' }) }
        })
        res.on('end', () => {
          if (sseBuf.trim()) {
            try { parseSseLines(sseBuf + '\n', delta => { fullText += delta; streamed = true; pushChunk(fullText) }) } catch { /* ignore trailing parse */ }
          }
          if (!fullText) {
            try {
              const j = JSON.parse(raw)
              if (j.error) { resolve({ error: j.error.message || '响应异常' }); return }
              fullText = extractChatText(j)
              if (fullText && !streamed) pushChunk(fullText)
            } catch { /* ignore non-json fallback */ }
          }
          if (!fullText) { resolve({ error: `响应格式异常 (${res.statusCode})` }); return }
          resolve({ text: fullText, streamed })
        })
      })
      req.setTimeout(120000, () => { req.destroy(); resolve({ error: '请求超时（120s）' }) })
      req.on('error', err => resolve({ error: `连接失败: ${err.message}` }))
      req.write(body)
      req.end()
    })
  })
}

module.exports = { registerWorkbenchDispatchIpc }
