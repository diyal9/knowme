'use strict'
// 从 workspace-agent.js 抽取真实 CSS 与真实数据，生成可截图的验证页，
// 避免用手写样式冒充实际渲染结果。
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '../../../..')
const source = fs.readFileSync(path.join(ROOT, 'src/workspace-agent.js'), 'utf8')

const cssMatch = source.match(/style\.id = 'agentWorkHintsStyle'\s*\n\s*style\.textContent = `([\s\S]*?)`/)
if (!cssMatch) throw new Error('未能从 workspace-agent.js 抽取工作提示条样式')
const css = cssMatch[1]

const escHtml = s => String(s).replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
))

// 用真实的 buildWorkHints 产出渲染，避免验证页与实际行为脱节
const memory = require(path.join(ROOT, 'src/lib/product-memory'))
const consolidation = require(path.join(ROOT, 'src/lib/memory-consolidation'))
const TMP = fs.mkdtempSync(path.join(require('os').tmpdir(), 'knowme-harness-'))
try {
  const pref = { kind: 'preference', summary: '会议总结优先给待办', meta: {} }
  for (let i = 0; i < 3; i++) memory.capture(TMP, pref)
  const pattern = memory.overview(TMP, { consolidate: false }).patterns[0]
  memory.reviewPattern(TMP, pattern.id, 'accepted')
  memory.capture(TMP, { kind: 'workflow_choice', summary: '会议纪要先出待办再出邮件', meta: {} })
  consolidation.consolidate(TMP)
  var items = memory.buildWorkHints(TMP, {
    topic: '会议',
    label: '会议总结',
    userProfile: { userPrompt: '先给结论，再给依据' },
  }).hints
} finally {
  fs.rmSync(TMP, { recursive: true, force: true })
}

// 与 workspace-agent.js 的 renderWorkHints 保持一致的标记结构
const chips = items.map((item, index) => {
  const on = !!item.defaultOn
  const detailId = `agentWorkHintDetail${index}`
  const detail = String(item.detail || item.text || '').trim()
  const basis = String(item.reason || item.source?.text || '基于当前工作上下文').trim()
  return `<label class="agent-work-hint${on ? ' is-on' : ''}"><input class="agent-work-hint-check" type="checkbox" data-work-hint-index="${index}"${on ? ' checked' : ''} aria-describedby="${detailId}"><span class="agent-work-hint-label">${escHtml(item.label)}</span><span class="agent-work-hint-detail" id="${detailId}" role="tooltip"><span class="agent-work-hint-detail-row"><span class="agent-work-hint-detail-title">具体内容</span><span class="agent-work-hint-detail-copy">${escHtml(detail)}</span></span><span class="agent-work-hint-detail-row"><span class="agent-work-hint-detail-title">为什么推荐</span><span class="agent-work-hint-detail-copy">${escHtml(basis)}</span></span></span></label>`
}).join('')

const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>本轮上下文开关</title>
<style>
body{margin:0;padding:150px 28px 28px;background:#faf9f7;font:13px/1.5 system-ui,sans-serif}
.wrap{width:560px}
.composer{border:1px solid rgba(61,58,54,0.16);border-radius:12px;background:#fffefb;padding:12px 14px;min-height:78px;color:#a9a199}
.meta{margin-top:8px;color:#8a8178;font-size:11px}
${css}
</style></head>
<body><div class="wrap">
<div class="agent-work-hints"><span class="agent-work-hints-title">本轮带上</span>${chips}<button type="button" class="agent-work-hint-dismiss" aria-label="隐藏本轮上下文">隐藏</button></div>
<div class="composer">帮我把今天的会议纪要整理成给团队的同步邮件</div>
<div class="meta">准备发送 · Enter 发送 · 已带上 1 条上下文</div>
</div></body></html>`

const out = path.join(__dirname, 'harness.html')
fs.writeFileSync(out, html, 'utf8')
process.stdout.write(`${out}\n`)
