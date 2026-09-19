'use strict'

const http = require('http')

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.setEncoding('utf8')
    req.on('data', chunk => { raw += chunk })
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}) } catch (error) { reject(error) }
    })
    req.on('error', reject)
  })
}

function textFromMessage(message) {
  const content = message?.content
  if (typeof content === 'string') return content
  if (Array.isArray(content)) return content.map(item => item?.text || '').join('\n')
  return ''
}

function lastUserPrompt(messages) {
  return [...(Array.isArray(messages) ? messages : [])]
    .reverse()
    .find(message => message?.role === 'user')
    ?.content
    ? textFromMessage([...messages].reverse().find(message => message?.role === 'user')).slice(0, 8000)
    : 'qualification research fixture'
}

function transcript(messages) {
  return (Array.isArray(messages) ? messages : [])
    .map(message => `${message?.role || ''}\n${textFromMessage(message)}\n${JSON.stringify(message?.tool_calls || '')}`)
    .join('\n')
}

function researchCandidate(prompt, route, toolText, missingSource) {
  if (prompt.includes('采用情况') || prompt.includes('覆盖100家客户')) {
    return [
      '# 采用情况可比性审查',
      '',
      '## 已知事实',
      '- 官方公告称覆盖 100 家客户，但未说明覆盖、活跃和统计时间口径。',
      '- 第三方调研称 80 家付费客户，样本为 120 家；这不是对全部客户的同口径统计。',
      '- 样本选择：访谈覆盖 6 家且均为现有用户，存在明显选择偏差。',
      '',
      '## 不可直接合并的口径',
      '覆盖客户、付费客户、调研样本和访谈对象不是同一统计集合，不能计算统一采用率，也不能把 6 家访谈外推到总体。',
      '',
      '## 未知与边界',
      '需要补充各来源的时间范围、活跃定义、样本抽样方式、客户去重规则和来源独立性。本结论只来自用户提供的材料，未联网。',
    ].join('\n')
  }
  if (prompt.includes('三份研究材料') || prompt.includes('市场份额')) {
    return [
      '# 研究材料比较报告（修订版）',
      '',
      '## 来源事实',
      '逐条保留三份材料的原始数字、样本范围、研究日期和来源标识；来源之间的差异单独列出，不把样本结果外推为全市场结论。',
      '',
      '## 分析推断',
      '只在来源事实之上说明可能解释，并明确这是分析判断，不是来源原话。已删除市场份额推断，避免把有限样本写成总体占比。',
      '',
      '## 限制与证据分级',
      '保留原有来源、日期和证据等级；无法从材料确认的数字、时间和口径标记为待复核。本轮未联网。',
    ].join('\n')
  }
  if (prompt.includes('知识整理方案') || route === 'knowledge-curation') {
    return [
      '# 知识整理方案',
      '',
      '## 材料事实',
      '两份内容相同但负责人不同的文档中，一份已过期，当前没有明确权威来源。不能静默合并，也不能擅自选择负责人。',
      '',
      '## 整理规则',
      '1. 来源分级：原始制度/负责人确认材料高于转述和摘要；记录来源、版本、负责人和确认时间。',
      '2. 冲突保留：建立冲突项并并列保存不同负责人和原文，不覆盖旧版本。',
      '3. 过期标记：过期文档从默认检索结果降权或隔离，但保留可追溯归档关系。',
      '4. 责任确认：将权威负责人列为待确认任务，确认前不发布统一结论。',
      '5. 检索验证：导入前做重复/冲突检查，导入后用原文片段回检召回结果和版本过滤。',
      '',
      '以上是整理规则，不代表已经完成导入或检索测试。',
    ].join('\n')
  }
  if (route === 'public-fact-check' || route === 'public-web-research' || toolText) {
    return [
      '# 公开资料核验结果',
      '',
      '## 来源事实',
      '本轮先执行搜索，再读取关键页面；结论只引用实际读取的页面回执，不把搜索摘要或模型记忆当作原文。',
      '- Vendor A：官方产品页面，记录页面标题、发布者、访问日期和链接；能力/价格以页面实际内容为准。',
      '- Vendor B：官方产品页面，记录页面标题、发布者、访问日期和链接；能力/价格以页面实际内容为准。',
      '',
      '## 证据状态',
      missingSource
        ? '其中一个官方页面返回 404，相关能力或价格标记为待复核；没有用搜索摘要替代失效原文。'
        : '已读取的页面支持其页面中明确写出的事实；没有读取回执的字段标记为未确认。',
      '',
      `工具证据：${toolText ? '保留本轮 search_web/fetch_web_page 回执。' : '尚未取得真实读取回执。'}`,
      '访问日期和适用范围需要随实际回执展示，本夹具不补造页面之外的结论。',
    ].join('\n')
  }
  return [
    '# 研究分析结果',
    '',
    '已区分来源事实、分析推断、证据限制和待复核项；没有来源回执的内容不会被写成已确认事实。',
  ].join('\n')
}

function toolCall(name, args) {
  return {
    id: `fixture-${name}-${Date.now()}`,
    type: 'function',
    function: { name, arguments: JSON.stringify(args) },
  }
}

function completion(body) {
  const messages = Array.isArray(body?.messages) ? body.messages : []
  const prompt = lastUserPrompt(messages)
  const full = transcript(messages)
  const toolMessages = messages.filter(message => message?.role === 'tool')

  // The runtime performs a second model call for its same-model quality
  // guardrail.  That call has a strict JSON contract and must never be
  // mistaken for a new research request, otherwise the fixture starts a
  // second tool loop while the runtime is trying to validate the first one.
  if (prompt.includes('只返回一行严格 JSON')) {
    const criteriaCount = Math.max(1, prompt.split('\n').filter(line => /^\d+\.\s+/.test(line)).length)
    const checks = Array.from({ length: criteriaCount }, (_, index) => ({
      criterion: index + 1,
      pass: true,
      evidence: '本地确定性夹具仅验证质量复核协议和运行时闭环。',
      reason: '夹具不对专业语义作真实判断。',
      requiredChange: '',
    }))
    return responseWithText(JSON.stringify({
      pass: true,
      userRequirements: {
        pass: true,
        evidence: '候选答复已提交质量复核。',
        reason: '仅验证质量复核 JSON 合同。',
        requiredChange: '',
      },
      checks,
    }))
  }

  const route = prompt.match(/本轮 SOP 路由：([^。\n]+)/)?.[1]?.trim() || ''
  const needsResearch = route !== 'provided-material' && !/不要联网|不联网|不搜索/.test(prompt)

  if (needsResearch && !toolMessages.length) {
    return responseWithToolCall(toolCall('search_web', {
      query: '两家指定厂商官方产品能力和公开价格',
      mode: 'web',
      limit: 5,
    }))
  }

  if (needsResearch && toolMessages.length === 1) {
    return responseWithToolCall(toolCall('fetch_web_page', {
      url: 'https://example.com/vendor-a/product',
    }))
  }

  if (needsResearch && toolMessages.length === 2 && !/404/.test(full)) {
    return responseWithToolCall(toolCall('fetch_web_page', {
      url: 'https://example.com/vendor-b/product',
    }))
  }

  const missingSource = /404/.test(full)
  if (!needsResearch) {
    return responseWithText(researchCandidate(prompt, route, toolMessages.map(textFromMessage).join('\n'), missingSource))
  }
  return responseWithText(researchCandidate(prompt, route, toolMessages.map(textFromMessage).join('\n'), missingSource))
}

function responseWithToolCall(call) {
  return {
    id: `research-fixture-${Date.now()}`,
    object: 'chat.completion',
    choices: [{ index: 0, message: { role: 'assistant', content: '', tool_calls: [call] }, finish_reason: 'tool_calls' }],
  }
}

function responseWithText(content) {
  return {
    id: `research-fixture-${Date.now()}`,
    object: 'chat.completion',
    choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
  }
}

function rss() {
  const now = new Date().toUTCString()
  return `<?xml version="1.0"?><rss version="2.0"><channel><title>Research fixture</title>`
    + `<item><title>Vendor A official product page</title><link>https://example.com/vendor-a/product</link><description>Official product and public pricing page for Vendor A.</description><pubDate>${now}</pubDate><source>example.com</source></item>`
    + `<item><title>Vendor B official product page</title><link>https://example.com/vendor-b/product</link><description>Official product and public pricing page for Vendor B.</description><pubDate>${now}</pubDate><source>example.com</source></item>`
    + '</channel></rss>'
}

function pageFor(url) {
  if (/404/.test(url)) return { status: 404, body: '<html><title>Not Found</title><body>404</body></html>' }
  const vendor = /vendor-b/.test(url) ? 'Vendor B' : 'Vendor A'
  return {
    status: 200,
    body: `<html><head><title>${vendor} Official</title></head><body><h1>${vendor} Official Product</h1><p>Official product capability and public pricing information.</p><p>Updated 2026-09-08.</p></body></html>`,
  }
}

function json(res, body, status = 200) {
  const payload = JSON.stringify(body)
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) })
  res.end(payload)
}

function createServer() {
  return http.createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url?.startsWith('/search')) {
        res.writeHead(200, { 'Content-Type': 'application/rss+xml' })
        return res.end(rss())
      }
      if (req.method === 'GET' && req.url?.startsWith('/page')) {
        const url = new URL(req.url, 'http://127.0.0.1').searchParams.get('url') || ''
        const page = pageFor(url)
        res.writeHead(page.status, { 'Content-Type': 'text/html', 'Content-Length': Buffer.byteLength(page.body) })
        return res.end(page.body)
      }
      if (req.method === 'POST' && req.url?.startsWith('/v1/chat/completions')) {
        const body = await readBody(req)
        return json(res, completion(body))
      }
      return json(res, { error: 'not found' }, 404)
    } catch (error) {
      return json(res, { error: String(error?.message || error) }, 400)
    }
  })
}

async function main() {
  const server = createServer()
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const port = server.address().port
  process.stdout.write(JSON.stringify({
    apiEndpoint: `http://127.0.0.1:${port}/v1/chat/completions`,
    webFixtureEndpoint: `http://127.0.0.1:${port}`,
  }) + '\n')
  const close = () => new Promise(resolve => server.close(() => resolve()))
  process.once('SIGINT', () => close().finally(() => process.exit(0)))
  process.once('SIGTERM', () => close().finally(() => process.exit(0)))
}

if (require.main === module) main().catch(error => {
  process.stderr.write(`${error?.stack || error}\n`)
  process.exitCode = 1
})

module.exports = { completion, pageFor, researchCandidate, rss }
