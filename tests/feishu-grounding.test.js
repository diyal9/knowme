'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const {
  detectFeishuIntent,
  analyzeFeishuToolEvidence,
  buildFeishuGroundingHint,
  extractScopesFromText,
  collectMissingScopes,
  buildAuthCtaUrl,
  buildAuthFailureNotice,
} = require('../src/lib/feishu-grounding')

describe('feishu-grounding', () => {
  it('detects feishu content-read intent', () => {
    const intent = detectFeishuIntent('请查询飞书会议纪要并总结待办')
    assert.equal(intent.mentioned, true)
    assert.equal(intent.needsSearch, true)
    assert.equal(intent.needsContentRead, true)
  })

  it('detects smart-minute assistant wording as minutes intent', () => {
    const intent = detectFeishuIntent('请从飞书智能纪要助手里找今天的会议并总结')
    assert.equal(intent.mentioned, true)
    assert.equal(intent.asksMinutes, true)
  })

  it('treats the built-in 会议总结 shortcut as the Feishu meeting workflow', () => {
    const intent = detectFeishuIntent('会议总结')
    assert.equal(intent.mentioned, true)
    assert.equal(intent.asksMinutes, true)
    assert.equal(intent.needsSearch, true)
    assert.equal(intent.needsContentRead, true)
  })

  it('routes an explicit Feishu Docx URL directly to read_doc', () => {
    const intent = detectFeishuIntent(
      '请总结这份会议记录：https://forever9.feishu.cn/docx/Y7fHdNvnIoC9nTxye9gc1xJ5ngg?dcuId=6909385442765619201'
    )
    assert.equal(intent.directDocRead, true)
    assert.equal(intent.needsSearch, false)
    assert.equal(intent.asksMinutes, false)
    assert.deepEqual(require('../src/lib/feishu-grounding').requiredFeishuToolsForIntent(intent), ['feishu.read_doc'])
  })

  it('requires tool evidence before claiming feishu result', () => {
    const hint = buildFeishuGroundingHint('请查飞书文档并总结', [])
    assert.ok(hint.includes('还没有拿到任何飞书工具返回结果'))
  })

  it('never mentions authorizing while the connector is authorized', () => {
    const hint = buildFeishuGroundingHint('请分析跟我相关的聊天，@我 的消息也要看', [], '', { authReady: true })
    assert.ok(hint.includes('feishu.related_chats'))
    assert.equal(hint.includes('授权'), false)
    assert.equal(hint.includes('设置 → 连接器'), false)
  })

  it('offers an inline auth action only when the connector needs authorizing', () => {
    const hint = buildFeishuGroundingHint('请分析跟我相关的聊天，@我 的消息也要看', [], '', { authReady: false })
    assert.ok(hint.includes('knowme://feishu/auth'), 'carries the auth action marker')
    assert.ok(hint.includes('一键授权飞书'))
  })

  it('explains when the feishu connector is disabled before any tool call', () => {
    const hint = buildFeishuGroundingHint('请读取这个飞书文档并润色', [], '', {
      connectorEnabled: false,
      authReady: true,
      allowlist: [],
    })
    assert.ok(hint.includes('飞书连接器还未启用'))
    assert.ok(hint.includes('feishu.search_docs') || hint.includes('feishu.read_doc'))
  })

  it('explains when the required feishu tool is missing from allowlist', () => {
    const hint = buildFeishuGroundingHint('请读取这个飞书文档并润色', [], '', {
      connectorEnabled: true,
      authReady: true,
      allowlist: ['feishu.doc_kb_suggest'],
    })
    assert.ok(hint.includes('allowlist'))
    assert.ok(hint.includes('feishu.read_doc'))
  })

  it('uses the projected allowlist before claiming a workflow is blocked', () => {
    const hint = buildFeishuGroundingHint('请分析跟我相关的聊天，@我 的消息也要看', [], '', {
      connectorEnabled: true,
      authReady: true,
      allowlist: ['feishu.search_docs', 'feishu.read_doc'],
      projectedAllowlist: [
        'feishu.search_docs',
        'feishu.read_doc',
        'feishu.meeting_candidates',
        'feishu.meeting_read',
        'feishu.related_chats',
        'feishu.today_priority',
        'feishu.doc_kb_suggest',
      ],
    })
    assert.equal(hint.includes('allowlist'), false)
    assert.ok(hint.includes('feishu.related_chats'))
  })

  it('lets a follow-up re-slice facts already fetched in earlier rounds', () => {
    const hint = buildFeishuGroundingHint(
      '请基于今日16个会话名称和@我消息内容，统计高频关键词并输出 Top5',
      [],
      '关键词 Top5：…',
      { authReady: true, priorFeishuFacts: true },
    )
    assert.equal(hint, '')
  })

  it('re-authorizing is offered when a tool reports insufficient permission', () => {
    const hint = buildFeishuGroundingHint('请分析跟我相关的聊天，@我 的消息也要看', [
      { toolName: 'feishu.related_chats', status: 'error', code: 'auth_required', text: '未授权：identity is missing' },
    ], '', { authReady: true })
    assert.ok(hint.includes('knowme://feishu/auth'))
    assert.ok(hint.includes('IM 相关 scope'))
  })

  it('shows real tool error instead of no-evidence fallback', () => {
    const hint = buildFeishuGroundingHint('请查飞书会议记录', [
      { toolName: 'feishu.search_docs', status: 'error', code: 'cli_error', text: 'invalid_args: 需要 query' },
    ])
    assert.ok(hint.includes('调用失败'))
    assert.ok(hint.includes('参数不完整') || hint.includes('invalid_args'))
  })

  it('surfaces the real meeting_read failure instead of a generic retry line', () => {
    const hint = buildFeishuGroundingHint('读取该会议纪要并总结分析', [
      {
        toolName: 'feishu.meeting_read',
        status: 'error',
        code: 'cli_error',
        text: '飞书返回 code 1254403：minute obcnA1 缺少可阅读权限',
      },
    ])
    assert.ok(hint.includes('1254403'), 'keeps the raw failure reason')
    assert.equal(hint.includes('请核对文档链接/token 与权限后重试'), false)
  })

  it('offers the permission-draft path when the minute has no read ACL', () => {
    const hint = buildFeishuGroundingHint('读取该会议纪要并总结分析', [
      {
        toolName: 'feishu.meeting_read',
        status: 'error',
        code: 'cli_error',
        text: 'No read permission for minute obcnA1',
      },
    ])
    assert.ok(hint.includes('查看权限'))
    assert.ok(hint.includes('申请妙记权限'))
  })

  it('blocks detailed summary when only search succeeded', () => {
    const hint = buildFeishuGroundingHint('请查飞书文档并给出行动项', [
      { toolName: 'feishu.search_docs', status: 'done', text: JSON.stringify({ items: [{ title: 'A' }] }) },
    ])
    assert.ok(hint.includes('只有飞书搜索结果'))
  })

  it('returns candidate token/url when only search results exist', () => {
    const hint = buildFeishuGroundingHint('请查飞书会议纪要并给出行动项', [
      {
        toolName: 'feishu.search_docs',
        status: 'done',
        text: JSON.stringify({
          items: [
            { title: '周会纪要', doc_token: 'doccn_meeting_123', url: 'https://feishu.cn/docx/doccn_meeting_123' },
          ],
        }),
      },
    ])
    assert.ok(hint.includes('doccn_meeting_123'))
    assert.ok(hint.includes('https://feishu.cn/docx/doccn_meeting_123'))
    assert.ok(hint.includes('[周会纪要](https://feishu.cn/docx/doccn_meeting_123)'))
  })

  it('extracts candidates from lark-cli search envelope format', () => {
    const hint = buildFeishuGroundingHint('请查飞书会议纪要并给出行动项', [
      {
        toolName: 'feishu.search_docs',
        status: 'done',
        text: JSON.stringify({
          ok: true,
          identity: 'user',
          data: {
            results: [
              {
                entity_type: 'DOC',
                title_highlighted: '智能纪要：07-24 | AI提效小组周例会 2026年7月24日',
                result_meta: {
                  token: 'M2S4wCH3ricJl4kJs5Ncnbnrngc',
                  url: 'https://forever9.feishu.cn/wiki/M2S4wCH3ricJl4kJs5Ncnbnrngc',
                  update_time_iso: '2026-07-24T16:39:27+08:00',
                },
              },
            ],
          },
        }),
      },
    ])
    assert.ok(hint.includes('M2S4wCH3ricJl4kJs5Ncnbnrngc'))
    assert.ok(hint.includes('https://forever9.feishu.cn/wiki/M2S4wCH3ricJl4kJs5Ncnbnrngc'))
    assert.ok(hint.includes('时间: 2026-07-24T16:39:27+08:00'))
    assert.ok(hint.includes('【1】'))
    assert.ok(hint.includes('智能纪要：07-24 | AI提效小组周例会 2026年7月24日'))
  })

  it('blocks non-minute docs for minutes intent', () => {
    const hint = buildFeishuGroundingHint('请查飞书智能纪要并总结会议待办', [
      {
        toolName: 'feishu.search_docs',
        status: 'done',
        text: JSON.stringify({
          data: {
            results: [
              {
                title_highlighted: 'AIGC前瞻2024',
                result_meta: {
                  token: 'wiki_xxx',
                  url: 'https://feishu.cn/wiki/wiki_xxx',
                  edit_user_name: 'Arshart-李炜铭',
                  update_time_iso: '2025-01-21T18:26:30+08:00',
                },
                summary_highlighted: '技术趋势讨论',
              },
            ],
          },
        }),
      },
    ])
    assert.ok(hint.includes('未命中“智能纪要助手生成的会议记录文档”'))
  })

  it('shows only smart-minute candidates for minutes intent', () => {
    const hint = buildFeishuGroundingHint('请查飞书智能纪要并总结会议待办', [
      {
        toolName: 'feishu.search_docs',
        status: 'done',
        text: JSON.stringify({
          data: {
            results: [
              {
                title_highlighted: '智能纪要：对下九九AI应用规划 2026年7月28日',
                result_meta: {
                  token: 'doc_smart_1',
                  url: 'https://feishu.cn/docx/doc_smart_1',
                  edit_user_name: '智能纪要助手',
                  update_time_iso: '2026-07-28T19:00:00+08:00',
                },
              },
              {
                title_highlighted: 'AIGC前瞻2024',
                result_meta: {
                  token: 'wiki_noise_1',
                  url: 'https://feishu.cn/wiki/wiki_noise_1',
                  edit_user_name: '张三',
                },
              },
            ],
          },
        }),
      },
    ])
    assert.ok(hint.includes('doc_smart_1'))
    assert.ok(!hint.includes('wiki_noise_1'))
  })

  it('passes through deterministic meeting candidate workflow output', () => {
    const hint = buildFeishuGroundingHint('请查飞书智能纪要并总结会议待办', [
      {
        toolName: 'feishu.meeting_candidates',
        status: 'done',
        text: '最近 7 个自然日内未找到“智能纪要助手”生成的会议记录文档。',
      },
    ])
    assert.equal(hint, '最近 7 个自然日内未找到“智能纪要助手”生成的会议记录文档。')
  })

  it('passes when read_doc evidence exists', () => {
    const hint = buildFeishuGroundingHint('请查飞书会议纪要并给出行动项', [
      { toolName: 'feishu.search_docs', status: 'done', text: JSON.stringify({ items: [{ title: 'A' }] }) },
      { toolName: 'feishu.read_doc', status: 'done', text: JSON.stringify({ title: '技术评审会会议纪要', content: '议题：发布计划；行动项：补齐回归' }) },
    ])
    assert.equal(hint, '')
  })

  it('analyzes feishu tool evidence by type', () => {
    const evidence = analyzeFeishuToolEvidence([
      { toolName: 'search_knowledge', status: 'done' },
      { toolName: 'feishu.get_wiki_node', status: 'done' },
    ])
    assert.equal(evidence.hasAny, true)
    assert.equal(evidence.hasSearch, false)
    assert.equal(evidence.hasContentRead, false)
    assert.equal(evidence.meetingLikeReadCount, 0)
  })

  it('does not treat a meeting title and token metadata as meeting正文', () => {
    const entries = [{
      toolName: 'feishu.meeting_read',
      status: 'done',
      text: JSON.stringify({
        title: '会议总结 2026-08-21',
        minute_token: 'obcn_test_only',
        organizer: '未知',
        participants: [],
      }),
    }]
    const evidence = analyzeFeishuToolEvidence(entries)
    assert.equal(evidence.hasContentRead, false)
    assert.equal(evidence.meetingLikeReadCount, 0)
    const hint = buildFeishuGroundingHint('请读取这个会议纪要并总结结论和待办', entries, '会议已完成总结，结论是……')
    assert.ok(hint.includes('正文为空'))
    assert.ok(!hint.includes('会议已完成总结'))
  })

  it('does not treat an empty successful meeting read as evidence', () => {
    const entries = [{ toolName: 'feishu.meeting_read', status: 'done', text: '' }]
    const evidence = analyzeFeishuToolEvidence(entries)
    assert.equal(evidence.hasContentRead, false)
    const hint = buildFeishuGroundingHint('请读取这个会议纪要并总结', entries, '已完成会议总结')
    assert.ok(hint.includes('正文为空'))
  })

  it('counts meeting-like read evidence', () => {
    const evidence = analyzeFeishuToolEvidence([
      {
        toolName: 'feishu.read_doc',
        status: 'done',
        text: JSON.stringify({ title: '客户成功周会（2026.07.27）纪要', content: '议题：x；结论：y；行动项：z' }),
      },
    ])
    assert.equal(evidence.hasContentRead, true)
    assert.equal(evidence.meetingLikeReadCount, 1)
  })

  it('blocks when read_doc explicitly returns not found', () => {
    const hint = buildFeishuGroundingHint('请读取飞书文档并总结', [
      { toolName: 'feishu.search_docs', status: 'done', text: JSON.stringify({ items: [{ title: 'A' }] }) },
      { toolName: 'feishu.read_doc', status: 'error', text: '404 not found' },
    ])
    assert.ok(hint.includes('文档不存在或未找到'))
  })

  it('blocks fabricated found-claim when search evidence is zero-hit', () => {
    const hint = buildFeishuGroundingHint(
      '请帮我搜索飞书文档',
      [{ toolName: 'feishu.search_docs', status: 'done', text: JSON.stringify({ items: [] }) }],
      '我已检索到 3 份相关文档，见下表。'
    )
    assert.ok(hint.includes('检索结果为 0 条'))
  })

  it('blocks minutes summary when read content lacks meeting evidence', () => {
    const hint = buildFeishuGroundingHint(
      '请查飞书会议纪要并总结待办',
      [
        { toolName: 'feishu.search_docs', status: 'done', text: JSON.stringify({ items: [{ title: '产品路线图V2.1 上线时间' }] }) },
        { toolName: 'feishu.read_doc', status: 'done', text: JSON.stringify({ title: '产品路线图V2.1', content: '上线节奏与接口联调安排' }) },
      ],
      '已完成会议总结。'
    )
    assert.ok(hint.includes('没有明确“会议纪要/会议记录/妙记”证据'))
  })

  it('detects related chats intent and does not require doc content read', () => {
    const intent = detectFeishuIntent(
      '请分析跟我相关的聊天：用飞书 CLI 读取我授权账号今天内的私聊与群聊摘要，特别确认并优先列出 @我 的内容'
    )
    assert.equal(intent.asksRelatedChats, true)
    assert.equal(intent.needsContentRead, false)
    assert.equal(intent.asksMinutes, false)
  })

  it('does not ask for doc token after related_chats succeeds', () => {
    const hint = buildFeishuGroundingHint(
      '请分析跟我相关的聊天：用飞书 CLI 读取我授权账号今天内的私聊与群聊摘要，特别确认并优先列出 @我 的内容，再整理待回应事项。',
      [{
        toolName: 'feishu.related_chats',
        status: 'done',
        text: '今天与你相关的飞书聊天摘要：\n## @我 的消息（1）\n**1. [产品群] Alice**\n- 请看排期',
      }],
      '今天有 1 条 @你 的消息。'
    )
    assert.equal(hint, '')
    assert.ok(!hint.includes('文档链接') && !hint.includes('会议内容结论'))
  })

  it('detects today priority intent and does not require doc content read', () => {
    const intent = detectFeishuIntent(
      '请作为今日优先级助手：先调用 feishu.today_priority 拉取我今天的飞书日程、未完成待办'
    )
    assert.equal(intent.asksTodayPriority, true)
    assert.equal(intent.needsContentRead, false)
    assert.equal(intent.asksMinutes, false)
  })

  it('does not ask for doc token after today_priority succeeds', () => {
    const hint = buildFeishuGroundingHint(
      '请作为今日优先级助手：先调用 feishu.today_priority 拉取我今天的飞书日程，立刻给出 Top3',
      [{
        toolName: 'feishu.today_priority',
        status: 'done',
        text: '## 今日优先级事实摘要\n### 今日日程（1）\n- 1. **10:00-11:00** 评审',
      }],
      '先做：准备评审材料。'
    )
    assert.equal(hint, '')
    assert.ok(!hint.includes('文档链接'))
  })

  it('detects doc kb suggest intent and does not require doc content read', () => {
    const intent = detectFeishuIntent(
      '请查文档/知识库：立刻调用 feishu.doc_kb_suggest，列出个人文件夹与最近编辑/阅读'
    )
    assert.equal(intent.asksDocKbSuggest, true)
    assert.equal(intent.needsContentRead, false)
    assert.equal(intent.needsSearch, false)
  })

  it('does not ask for doc token after doc_kb_suggest succeeds', () => {
    const hint = buildFeishuGroundingHint(
      '请查文档/知识库：立刻调用 feishu.doc_kb_suggest，列出个人文件夹与最近编辑/阅读',
      [{
        toolName: 'feishu.doc_kb_suggest',
        status: 'done',
        text: '## 文档 / 知识库候选\n### 个人文件夹\n- 项目A',
      }],
      '你有 1 个个人文件夹。'
    )
    assert.equal(hint, '')
    assert.ok(!hint.includes('文档链接'))
  })
})

describe('feishu just-in-time authorization (grounding CTA)', () => {
  const MISSING_SCOPE_TEXT = [
    'lark-cli error: permission denied',
    'required scope(s): space:document:retrieve, drive:drive.metadata:readonly',
    '{"code":403,"missing_scopes":["space:document:retrieve","drive:drive.metadata:readonly"]}',
  ].join('\n')

  it('extracts scopes from the human hint and the JSON array', () => {
    const scopes = extractScopesFromText(MISSING_SCOPE_TEXT)
    assert.ok(scopes.includes('space:document:retrieve'))
    assert.ok(scopes.includes('drive:drive.metadata:readonly'))
  })

  it('prefers the structured missingScopes field over text parsing', () => {
    const scopes = collectMissingScopes([
      { status: 'error', text: 'noise', missingScopes: ['space:document:retrieve'] },
    ])
    assert.deepEqual(scopes, ['space:document:retrieve'])
  })

  it('encodes the exact missing scopes onto the auth CTA url', () => {
    const url = buildAuthCtaUrl(['space:document:retrieve', 'drive:drive.metadata:readonly'])
    assert.ok(url.startsWith('knowme://feishu/auth?scopes='))
    const decoded = decodeURIComponent(url.split('scopes=')[1])
    assert.equal(decoded, 'space:document:retrieve,drive:drive.metadata:readonly')
  })

  it('builds a scope-aware notice with a scoped CTA when scopes are known', () => {
    const notice = buildAuthFailureNotice('读取飞书文档失败', null, ['space:document:retrieve'])
    assert.ok(notice.includes('补齐授权并继续'))
    assert.ok(notice.includes('knowme://feishu/auth?scopes='))
  })

  it('falls back to the generic notice when no scopes were detected', () => {
    const notice = buildAuthFailureNotice('飞书工具调用失败', '相关 scope', [])
    assert.ok(notice.includes('重新授权飞书'))
    assert.ok(notice.includes('knowme://feishu/auth'))
    assert.ok(!notice.includes('?scopes='))
  })

  it('offers generic re-authorization (not a meeting-flavored dead-end) when a doc read fails 403 without parseable scopes', () => {
    const hint = buildFeishuGroundingHint(
      '帮我读取这份飞书文档并总结',
      [{ toolName: 'feishu.read_doc', status: 'error', text: '403 forbidden unauthorized' }],
      ''
    )
    assert.ok(hint.includes('授权'))
    assert.ok(!hint.includes('会议'))
    assert.ok(!hint.includes('妙记'))
  })

  it('surfaces a scoped just-in-time CTA when a read tool fails with missing_scope', () => {
    const hint = buildFeishuGroundingHint(
      '帮我读取这份飞书文档并总结',
      [{
        toolName: 'feishu.read_doc',
        status: 'error',
        code: 'missing_scope',
        text: MISSING_SCOPE_TEXT,
        missingScopes: ['space:document:retrieve'],
      }],
      ''
    )
    assert.ok(hint.includes('knowme://feishu/auth?scopes='))
    const decoded = decodeURIComponent(hint.split('scopes=')[1].split(')')[0])
    assert.ok(decoded.includes('space:document:retrieve'))
  })
})
