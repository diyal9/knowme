'use strict'

const http = require('http')

function textFromMessage(message) {
  const content = message?.content
  if (typeof content === 'string') return content
  if (Array.isArray(content)) return content.map(item => item?.text || '').join('\n')
  return ''
}

function transcript(messages) {
  return (Array.isArray(messages) ? messages : [])
    .map(message => `${message?.role || ''}\n${textFromMessage(message)}\n${JSON.stringify(message?.tool_calls || '')}`)
    .join('\n')
}

function toolCall(name, args = {}) {
  return {
    id: `office-fixture-${name}-${Date.now()}`,
    type: 'function',
    function: { name, arguments: JSON.stringify(args) },
  }
}

function responseWithText(content) {
  return {
    id: `office-fixture-${Date.now()}`,
    object: 'chat.completion',
    choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
  }
}

function responseWithToolCall(call) {
  return {
    id: `office-fixture-${Date.now()}`,
    object: 'chat.completion',
    choices: [{ index: 0, message: { role: 'assistant', content: '', tool_calls: [call] }, finish_reason: 'tool_calls' }],
  }
}

function officeCandidate(prompt, route, toolText) {
  if (prompt.includes('冲突会议记录') || (prompt.includes('记录A') && prompt.includes('记录B'))) {
    return [
      '# 项目结论待确认整理',
      '',
      '## 已知原始记录',
      '- 记录 A：计划 9 月 12 日上线；接口验收状态写为“已通过”。',
      '- 记录 B：计划 9 月 19 日上线；接口验收状态写为“待补测”。',
      '',
      '## 冲突项',
      '上线日期存在 7 天差异，接口验收也存在“已通过/待补测”冲突。当前没有一条记录被证明是最终会议决议。',
      '',
      '## 待确认人与下一步',
      '请项目负责人确认最终上线日期，请接口验收负责人确认验收状态及补测范围。在确认前，本稿仅作为内部待确认草稿，不发送给任何人，也不把任一版本写成已决定。',
      '',
      `证据范围：${toolText ? '仅保留本轮回执，不扩展到未读取的消息。' : '本题未执行外部读取。'}`,
    ].join('\n')
  }
  if (prompt.includes('张三负责接口联调') || prompt.includes('原始行动项')) {
    return [
      '# 会议行动项清单',
      '',
      '| 负责人 | 行动项 | 截止时间 | 状态 |',
      '|---|---|---|---|',
      '| 张三 | 接口联调 | 9 月 15 日 | 待执行 |',
      '| 李四 | 验收用例 | 9 月 16 日 | 待执行 |',
      '',
      '风险：测试环境尚未稳定。以上日期、负责人和风险均沿用原始记录；本轮没有补充不存在的状态或负责人。',
      '这是整理结果，不代表任务已经执行或已完成。',
    ].join('\n')
  }
  if (prompt.includes('延期说明') || prompt.includes('第三方接口尚未验收')) {
    const windowLine = prompt.includes('9月12日前')
      ? '请于 9 月 12 日前确认新的联调窗口。'
      : '请协助确认后续联调窗口和新的上线安排。'
    return [
      '主题：项目延期说明（待发送草稿）',
      '',
      '合作方项目经理您好：',
      '',
      '由于第三方接口尚未完成验收，原定上线日期目前仍待确认。为避免在验收结论明确前做出不准确承诺，我们会在接口验收完成后同步新的排期。',
      '',
      windowLine,
      '',
      '感谢理解。以上为待发送草稿，尚未发送。',
    ].join('\n')
  }
  if (prompt.includes('王芳负责字段表') || prompt.includes('全量发布尚未决定')) {
    return [
      '# 项目行动项清单',
      '',
      '| 负责人 | 行动项/决策 | 截止时间 | 状态 |',
      '|---|---|---|---|',
      '| 王芳 | 负责字段表 | 9 月 8 日 | 待确认 |',
      '| — | 是否全量发布 | — | 尚未决定 |',
      '',
      '风险：接口验收未完成。以上内容仅供团队确认；“尚未决定”不是“已决定”，没有新增负责人或发布承诺。',
    ].join('\n')
  }
  if (prompt.includes('研发群') || prompt.includes('9月10日灰度')) {
    return [
      '研发同步稿（内部草稿）',
      '',
      '当前计划：9 月 10 日灰度。李明需在 9 月 8 日前提交接口字段表；王芳在字段表确认后开始联调。是否全量发布尚未决定，需待后续评审确认。',
      '',
      '以上沿用会议记录，不代表已完成或已对外发送。',
    ].join('\n')
  }
  if (prompt.includes('上一版同步稿') || prompt.includes('截止时间从9月8日改为9月9日')) {
    return [
      '研发同步稿（完整修订版）',
      '',
      '当前计划：9 月 10 日灰度。李明需在 9 月 9 日前提交接口字段表；王芳在字段表确认后开始联调。是否全量发布尚未决定，需待后续评审确认。',
      '',
      '仅按修改意见更新截止时间，其余事实和结构保持不变；这是内部草稿，不代表已发送。',
    ].join('\n')
  }
  if (route === 'today-priority') {
    return `# 今日优先级\n\n来源：feishu.today_priority 工具回执。\n\n${toolText ? '仅依据本轮读取到的日程、待办和相关消息整理；未回执的安排不纳入排序。' : '尚未取得真实读取回执，不能生成今日安排。'}`
  }
  if (route === 'meeting-summary') {
    return `# 飞书会议候选\n\n${toolText ? '以下仅为工具返回的候选列表，尚未读取任何会议正文，因此不生成会议纪要或结论。请选择具体会议后再读取。' : '尚未取得候选回执，不能生成会议内容。'}\n\n来源：feishu.meeting_candidates。`
  }
  if (route === 'doc-kb') {
    return `# 飞书文档/知识库候选\n\n${toolText ? '以下仅表示候选匹配，不等于已经读取正文；在正文读取成功前，不把标题写成验收标准。' : '尚未取得候选回执，不能编写文档结论。'}\n\n来源：feishu.doc_kb_suggest。`
  }
  if (route === 'related-chats') {
    return `# 相关聊天重点\n\n${toolText ? '仅整理本轮 feishu.related_chats 回执覆盖的用户、时间和消息范围，不使用模型记忆补写未读取内容。' : '尚未取得真实消息回执，不能声称已读取聊天。'}`
  }
  return '# 办公协作整理\n\n已按原始材料整理可确认内容，并明确区分草稿、已知事实、待确认项和未执行的外部动作。'
}

function completion(body) {
  const messages = Array.isArray(body?.messages) ? body.messages : []
  const full = transcript(messages)
  const prompt = [...messages]
    .reverse()
    .find(message => message?.role === 'user')
    ?.content
  const currentPrompt = typeof prompt === 'string'
    ? prompt
    : Array.isArray(prompt) ? prompt.map(item => item?.text || '').join('\n') : ''

  // The runtime's quality review is a separate strict JSON call. Keep the
  // fixture deterministic and never turn a review prompt into another tool loop.
  if (currentPrompt.includes('只返回一行严格 JSON')) {
    const criteriaCount = Math.max(1, currentPrompt.split('\n').filter(line => /^\d+\.\s+/.test(line)).length)
    return responseWithText(JSON.stringify({
      pass: true,
      userRequirements: {
        pass: true,
        evidence: '办公外部读取夹具已返回结构化工具回执。',
        reason: '仅验证 KnowMe 工具编排、来源边界和质量复核协议。',
        requiredChange: '',
      },
      checks: Array.from({ length: criteriaCount }, (_, index) => ({
        criterion: index + 1,
        pass: true,
        evidence: '本地飞书 CLI 夹具返回了可追溯的事实回执。',
        reason: '夹具不对真实办公专业语义作认证。',
        requiredChange: '',
      })),
    }))
  }

  const route = full.match(/本轮 SOP 路由：([^。\n]+)/)?.[1]?.trim() || ''
  const hasToolResult = messages.some(message => message?.role === 'tool')
  if (!hasToolResult) {
    if (route === 'today-priority') return responseWithToolCall(toolCall('feishu.today_priority', { include_mentions: true }))
    if (route === 'meeting-summary') return responseWithToolCall(toolCall('feishu.meeting_candidates', { days: 3 }))
    if (route === 'doc-kb') return responseWithToolCall(toolCall('feishu.doc_kb_suggest', { days: 30 }))
    if (route === 'related-chats') return responseWithToolCall(toolCall('feishu.related_chats', { days: 1 }))
  }

  const toolText = messages.filter(message => message?.role === 'tool').map(textFromMessage).join('\n')
  return responseWithText(officeCandidate(currentPrompt, route, toolText))
}

function json(res, body, status = 200) {
  const payload = JSON.stringify(body)
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) })
  res.end(payload)
}

function main() {
  const server = http.createServer(async (req, res) => {
    if (req.method !== 'POST') return json(res, { error: 'POST required' }, 405)
    let raw = ''
    req.setEncoding('utf8')
    req.on('data', chunk => { raw += chunk })
    req.on('end', () => {
      try { return json(res, completion(raw ? JSON.parse(raw) : {})) } catch (error) {
        return json(res, { error: String(error?.message || error) }, 400)
      }
    })
  })
  server.listen(0, '127.0.0.1', () => {
    process.stdout.write(JSON.stringify({ apiEndpoint: `http://127.0.0.1:${server.address().port}/v1/chat/completions` }) + '\n')
  })
  const close = () => server.close(() => process.exit(0))
  process.once('SIGINT', close)
  process.once('SIGTERM', close)
}

if (require.main === module) main()

module.exports = { completion, officeCandidate, transcript }
