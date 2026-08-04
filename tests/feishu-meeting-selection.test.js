'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const {
  extractFeishuSearchCandidatesFromText,
  rewriteFeishuCandidateSelection,
  rewriteMinutePermissionRequest,
  parseSelectionIndex,
} = require('../src/lib/feishu-meeting-selection')
const { formatMinuteBodyForSummary } = require('../src/lib/connectors/feishu-cli')

describe('feishu meeting selection rewrite', () => {
  const meetingList = `最近 **3** 个自然日内找到 **2** 场你参与的会议：

[1. 架构组周会｜2026-07-27 15:01｜组织者：mikoto-吴晓波](https://forever9.feishu.cn/minutes/obcnA1)

[2. 对下九九AI应用规划｜2026-07-28 16:50｜组织者：Viola](https://forever9.feishu.cn/minutes/mtB2)

回复序号（如「1」），我来读取对应纪要并做总结与简要分析。`

  it('parses pure index replies', () => {
    assert.equal(parseSelectionIndex('1'), 1)
    assert.equal(parseSelectionIndex('第2条'), 2)
    assert.equal(parseSelectionIndex('总结第1个'), 1)
  })

  it('extracts minute_token from the single visible minutes card', () => {
    const candidates = extractFeishuSearchCandidatesFromText(meetingList)
    assert.equal(candidates.length, 2)
    assert.equal(candidates[0].index, 1)
    assert.equal(candidates[0].title, '架构组周会')
    assert.equal(candidates[0].minuteToken, 'obcnA1')
    assert.match(candidates[0].url, /\/minutes\/obcnA1$/)
    assert.equal(candidates[0].time, '2026-07-27 15:01')
    assert.equal(candidates[0].organizer, 'mikoto-吴晓波')
  })

  it('rewrites index reply to feishu.meeting_read with analysis sections', () => {
    const rewritten = rewriteFeishuCandidateSelection('1', meetingList)
    assert.match(rewritten, /feishu\.meeting_read/)
    assert.match(rewritten, /minute_token=obcnA1/)
    assert.match(rewritten, /简要分析/)
    assert.equal(rewritten.includes('feishu.read_doc'), false)
  })

  it('rewrites index 2 to the second meeting minute token', () => {
    const rewritten = rewriteFeishuCandidateSelection('2', meetingList)
    assert.match(rewritten, /feishu\.meeting_read/)
    assert.match(rewritten, /minute_token=mtB2/)
    assert.match(rewritten, /对下九九AI应用规划/)
  })

  it('rewrites a short permission ask into a confirmed draft call', () => {
    const aclNotice = '飞书返回「没有这份妙记的查看权限」。这份妙记（obcnA1）当前授权用户没有查看权限。'
    const rewritten = rewriteMinutePermissionRequest('申请妙记权限', aclNotice)
    assert.match(rewritten, /feishu\.draft_minute_permission/)
    assert.match(rewritten, /minute_token=obcnA1/)
    assert.match(rewritten, /等我明确确认后才可发送/)
  })

  it('leaves unrelated prompts untouched', () => {
    const src = '帮我把这次会议的待办同步给张三并申请下周的会议室使用权限'
    assert.equal(rewriteMinutePermissionRequest(src, '妙记（obcnA1）'), src)
  })

  it('keeps legacy doc token path on old search lists', () => {
    const docList = `【1】报销制度
token: dokABC123
url: https://forever9.feishu.cn/docx/dokABC123`
    const rewritten = rewriteFeishuCandidateSelection('1', docList)
    assert.match(rewritten, /feishu\.read_doc/)
    assert.match(rewritten, /dokABC123/)
  })

  it('falls back to meeting_candidates when card text has no token/url', () => {
    const cardOnly = `飞书妙记 · 第2场
对下九九AI应用规划
回复序号（如「1」），我来读取对应纪要并做总结与简要分析。`
    const rewritten = rewriteFeishuCandidateSelection('2', cardOnly)
    assert.match(rewritten, /feishu\.meeting_candidates/)
    assert.match(rewritten, /feishu\.meeting_read/)
    assert.match(rewritten, /第2场会议/)
  })
})

describe('formatMinuteBodyForSummary', () => {
  it('renders summary todo and chapter sections', () => {
    const text = formatMinuteBodyForSummary({
      title: '架构组周会',
      minute_token: 'obcnA1',
      artifacts: {
        summary: '会议纪要：讨论了 RAG 落地节奏。',
        todo: '- 张三：下周完成 PoC',
        chapter: '1. 开场\n2. 方案评审',
      },
    })
    assert.match(text, /架构组周会/)
    assert.match(text, /minute_token: obcnA1/)
    assert.match(text, /## 摘要/)
    assert.match(text, /## 待办/)
    assert.match(text, /## 章节/)
    assert.match(text, /RAG 落地/)
  })
})
