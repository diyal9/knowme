'use strict'

const { describe, it, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const {
  buildReadArgs,
  sanitizeCliArgs,
  isReadTool,
  normalizeRelativeDateQuery,
  sanitizeCliQuery,
  normalizeQueryArgForPlatform,
  softenQueryForRetry,
  buildDraftWrite,
  buildDraftMinutePermission,
  applyFeishuWrite,
  executeFeishuRead,
  executeMeetingCandidates,
  executeMeetingRead,
  executeRelatedChats,
  executeTodayPriority,
  executeDocKbSuggest,
  buildCalendarAgendaArgs,
  buildTaskMyTasksArgs,
  listFeishuUsers,
  listFeishuChats,
  parseMissingScopeError,
  describeMissingScopes,
  getGrantedUserScopes,
  FEISHU_READ_TOOL_DEFS,
} = require('../src/lib/connectors/feishu-cli')
const {
  buildConnectorToolSurface,
  approveFeishuDraft,
  rememberDraft,
} = require('../src/lib/connectors/tool-runtime')
const store = require('../src/lib/connectors/store')

// Emit a JSON (or raw string) CLI response chosen per-argv by `handler`.
function spawnJson(handler) {
  return (_bin, argv) => {
    const { EventEmitter } = require('events')
    const child = new EventEmitter()
    child.stdout = new EventEmitter()
    child.stderr = new EventEmitter()
    queueMicrotask(() => {
      const payload = handler(argv)
      const text = typeof payload === 'string' ? payload : JSON.stringify(payload)
      child.stdout.emit('data', Buffer.from(text))
      child.emit('close', 0)
    })
    return child
  }
}

const IDENTITY_ME = { identities: { user: { openId: 'ou_me', userName: '尹艳龙' } } }

/** Build a vc +detail payload row for a meeting. */
function vcDetail(row) {
  return { data: { meetings: [row] } }
}

/**
 * Route lark-cli argv for the vc/minutes-based meeting workflow.
 * handler.onVcSearch(argv, callCount) supplies vc +search payloads;
 * handler.detailForId(meetingId) supplies vc +detail payloads.
 */
function meetingWorkflowSpawn(handler = {}) {
  const {
    identity = IDENTITY_ME,
    onVcSearch,
    detailForId = (id) => vcDetail({ meeting_id: id, topic: `会议-${id}`, start_time: '2026-07-28 16:50', note_id: `note_${id}`, minute_token: `mt_${id}` }),
  } = handler
  let vcSearchCalls = 0
  return spawnJson((argv) => {
    if (argv.includes('auth') && argv.includes('status')) {
      return identity || { identities: {} }
    }
    if (argv[0] === 'vc' && argv[1] === '+search') {
      vcSearchCalls += 1
      if (typeof onVcSearch === 'function') return onVcSearch(argv, vcSearchCalls)
      return { data: { items: [] } }
    }
    if (argv[0] === 'vc' && argv[1] === '+detail') {
      const idIdx = argv.indexOf('--meeting-ids')
      return detailForId(String(argv[idIdx + 1] || ''))
    }
    return { data: {} }
  })
}

describe('feishu-cli allowlist builders', () => {
  it('marks read tools', () => {
    assert.equal(isReadTool('feishu.search_docs'), true)
    assert.equal(isReadTool('feishu.apply_write_doc'), false)
  })

  it('builds search args', () => {
    const built = buildReadArgs('feishu.search_docs', { query: '报销' })
    assert.ok(built.args.includes('+search'))
    assert.ok(built.args.includes('报销'))
    assert.equal(built.args.includes('--page-all'), false)
  })

  it('strips legacy page-all from docs search at execution boundary', () => {
    assert.deepEqual(
      sanitizeCliArgs(['docs', '+search', '--query', '会议记录', '--page-all', '--format', 'json']),
      ['docs', '+search', '--query', '会议记录', '--format', 'json']
    )
    assert.deepEqual(
      sanitizeCliArgs(['wiki', '+node-list', '--page-all']),
      ['wiki', '+node-list', '--page-all']
    )
  })

  it('normalizes relative date keywords to absolute local dates', () => {
    const normalized = normalizeRelativeDateQuery('架构组 昨天 会议记录', new Date('2026-07-28T00:00:00+08:00'))
    assert.ok(normalized.includes('2026-07-27（昨天）'))
    assert.ok(normalized.includes('架构组'))
  })

  it('keeps query unchanged when absolute date already exists', () => {
    const query = '架构组 2026-07-27 会议记录'
    assert.equal(normalizeRelativeDateQuery(query, new Date('2026-07-28T00:00:00+08:00')), query)
  })

  it('sanitizes dangerous quote tokens for Windows cli parsing', () => {
    const query = '"2026-07-25..2026-07-27" "参会人:我" OR "主持人:我" OR "记录人:我"'
    assert.equal(
      sanitizeCliQuery(query),
      '2026-07-25..2026-07-27 参会人:我 OR 主持人:我 OR 记录人:我'
    )
  })

  it('sanitizes search_docs query before building argv', () => {
    const built = buildReadArgs('feishu.search_docs', {
      query: '"会议纪要" OR "会议记录" OR "会议总结" "site:feishu.cn"',
    })
    const queryValue = built.args[built.args.indexOf('--query') + 1]
    assert.equal(queryValue, normalizeQueryArgForPlatform('会议纪要 OR 会议记录 OR 会议总结 site:feishu.cn'))
  })

  it('softens bool-style query for positional retry fallback', () => {
    const src = '2026-07-25 OR 2026-07-26 OR 2026-07-27 AND (会议纪要 OR 会议记录 OR 会议总结 OR action OR 待办)'
    assert.equal(
      softenQueryForRetry(src),
      '2026-07-25 2026-07-26 2026-07-27 会议纪要 会议记录 会议总结 action 待办'
    )
  })

  it('normalizes query arg to comma tokens on win32', () => {
    assert.equal(
      normalizeQueryArgForPlatform('a b c', 'win32'),
      'a,b,c'
    )
    assert.equal(
      normalizeQueryArgForPlatform('a b c', 'linux'),
      'a b c'
    )
  })

  it('rejects empty search', () => {
    const built = buildReadArgs('feishu.search_docs', { query: '  ' })
    assert.ok(built.error)
  })

  it('uses user identity for docs and v2 for document fetch', () => {
    const search = buildReadArgs('feishu.search_docs', { query: '知识库' })
    const fetch = buildReadArgs('feishu.read_doc', { doc_token: 'docx123' })
    assert.deepEqual(search.args.slice(0, 5), ['docs', '+search', '--as', 'user', '--query'])
    assert.ok(fetch.args.includes('--api-version'))
    assert.ok(fetch.args.includes('v2'))
    assert.ok(fetch.args.includes('--as'))
    assert.ok(fetch.args.includes('user'))
  })

  it('validates read_doc locator as feishu doc/wiki link or token', () => {
    const docx = buildReadArgs('feishu.read_doc', { url: 'https://xx.feishu.cn/docx/abc123' })
    const wiki = buildReadArgs('feishu.read_doc', { url: 'https://xx.feishu.cn/wiki/wikcn123' })
    const token = buildReadArgs('feishu.read_doc', { doc_token: 'docxXYZ' })
    const invalid = buildReadArgs('feishu.read_doc', { url: 'https://kdocs.cn/l/c123456' })
    assert.equal(docx.error, undefined)
    assert.equal(wiki.error, undefined)
    assert.equal(token.error, undefined)
    assert.match(String(invalid.error || ''), /仅支持飞书文档/)
  })

  it('builds wiki read-only args', () => {
    assert.deepEqual(
      buildReadArgs('feishu.list_wiki_spaces', {}).args,
      ['wiki', '+space-list', '--as', 'user', '--format', 'json']
    )
    assert.deepEqual(
      buildReadArgs('feishu.list_wiki_nodes', { space_id: 'my_library' }).args,
      ['wiki', '+node-list', '--as', 'user', '--space-id', 'my_library', '--format', 'json']
    )
    assert.deepEqual(
      buildReadArgs('feishu.get_wiki_node', { node_token: 'wikcn123' }).args,
      ['wiki', '+node-get', '--as', 'user', '--node-token', 'wikcn123', '--format', 'json']
    )
    assert.deepEqual(
      buildReadArgs('feishu.list_chats', {}).args,
      ['im', '+chat-list', '--as', 'user', '--types', 'group', '--page-size', '20', '--format', 'json']
    )
    assert.deepEqual(
      buildReadArgs('feishu.search_chats', { query: '研发群' }).args,
      ['im', '+chat-search', '--as', 'user', '--query', '研发群', '--chat-modes', 'group', '--page-size', '20', '--format', 'json']
    )
    assert.deepEqual(
      buildReadArgs('feishu.search_users', { user_ids: 'me' }).args,
      ['contact', '+search-user', '--as', 'user', '--user-ids', 'me', '--page-size', '20', '--format', 'json']
    )
  })

  it('exports read tool defs', () => {
    assert.ok(FEISHU_READ_TOOL_DEFS.some((d) => d.function.name === 'feishu.read_doc'))
    assert.ok(FEISHU_READ_TOOL_DEFS.some((d) => d.function.name === 'feishu.meeting_candidates'))
    assert.ok(FEISHU_READ_TOOL_DEFS.some((d) => d.function.name === 'feishu.meeting_read'))
    assert.ok(FEISHU_READ_TOOL_DEFS.some((d) => d.function.name === 'feishu.related_chats'))
    assert.ok(FEISHU_READ_TOOL_DEFS.some((d) => d.function.name === 'feishu.today_priority'))
    assert.ok(FEISHU_READ_TOOL_DEFS.some((d) => d.function.name === 'feishu.doc_kb_suggest'))
  })

  it('summarizes doc/kb suggestions with folders spaces edited opened and memory', async () => {
    const memDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-mem-'))
    const productMemory = require('../src/lib/product-memory')
    productMemory.ensureMemory(memDir)
    productMemory.capture(memDir, {
      kind: 'habit',
      summary: '打开产品路线图讨论纪要',
      meta: { action: 'open' },
    })
    const calls = []
    const result = await executeDocKbSuggest({ days: 30 }, {
      memoryDir: memDir,
      spawnImpl: spawnJson((argv) => {
        calls.push(argv.slice())
        if (argv.includes('auth') && argv.includes('status')) {
          return IDENTITY_ME
        }
        if (argv[0] === 'drive' && argv[1] === 'files' && argv[2] === 'list') {
          return {
            data: {
              files: [
                { name: '个人项目', token: 'fld_personal', type: 'folder' },
                { name: '旧文档.docx', token: 'doc_old', type: 'docx' },
              ],
            },
          }
        }
        if (argv[0] === 'wiki' && argv[1] === '+space-list') {
          return {
            data: {
              items: [{ space_id: 'sp_1', name: '研发 Wiki' }],
            },
          }
        }
        if (argv[0] === 'drive' && argv[1] === '+search') {
          if (argv.includes('--edited-since')) {
            return {
              data: {
                items: [{ title: '编辑中的方案', token: 'tok_edit', url: 'https://feishu.cn/docx/tok_edit', edit_time: '2026-07-28' }],
              },
            }
          }
          if (argv.includes('--opened-since')) {
            return {
              data: {
                items: [{ title: '刚读过的手册', token: 'tok_open', url: 'https://feishu.cn/docx/tok_open', open_time: '2026-07-27' }],
              },
            }
          }
          return {
            data: {
              items: [{ title: '产品路线图', token: 'tok_need', url: 'https://feishu.cn/docx/tok_need' }],
            },
          }
        }
        return { data: {} }
      }),
    })
    assert.equal(result.ok, true)
    assert.equal(result.meta.workflow, 'doc_kb_suggest')
    assert.equal(result.meta.days, 30)
    assert.equal(result.meta.folders.length, 1)
    assert.equal(result.meta.folders[0].name, '个人项目')
    assert.equal(result.meta.spaces[0].name, '研发 Wiki')
    assert.equal(result.meta.edited.length, 1)
    assert.equal(result.meta.opened.length, 1)
    assert.ok(result.meta.needed.length >= 1)
    assert.ok(result.text.includes('个人文件夹'))
    assert.ok(result.text.includes('知识库空间'))
    assert.ok(result.text.includes('可能需要的文件'))
    assert.ok(result.text.includes('最近自己编辑的文件'))
    assert.ok(result.text.includes('最近自己阅读的文件'))
    assert.ok(calls.some(a => a[0] === 'drive' && a[1] === 'files'))
    assert.ok(calls.some(a => a.includes('--edited-since')))
    assert.ok(calls.some(a => a.includes('--opened-since')))
    try { fs.rmSync(memDir, { recursive: true, force: true }) } catch { /* ignore */ }
  })

  // Returning ok:true here would hide the authorization gap from the grounding
  // layer, which then cannot render the "补齐授权并继续" CTA that auto-resumes.
  it('fails with structured missing_scope when every doc/kb section is permission-blocked', async () => {
    const result = await executeDocKbSuggest({ days: 30 }, {
      memoryDir: path.join(os.tmpdir(), 'knowme-mem-absent'),
      spawnImpl: (_bin, argv) => {
        const { EventEmitter } = require('events')
        const child = new EventEmitter()
        child.stdout = new EventEmitter()
        child.stderr = new EventEmitter()
        const authStatus = argv.includes('auth') && argv.includes('status')
        queueMicrotask(() => {
          child.stdout.emit('data', Buffer.from(authStatus ? JSON.stringify(IDENTITY_ME) : MISSING_SCOPE_STDOUT))
          child.emit('close', authStatus ? 0 : 3)
        })
        return child
      },
    })
    assert.equal(result.ok, false)
    assert.equal(result.code, 'missing_scope')
    assert.deepEqual(result.missingScopes, ['space:document:retrieve'])
    assert.ok(String(result.text || '').includes('space:document:retrieve'))
  })

  it('keeps partial doc/kb results and flags the permission-blocked sections', async () => {
    const result = await executeDocKbSuggest({ days: 30 }, {
      memoryDir: path.join(os.tmpdir(), 'knowme-mem-absent'),
      spawnImpl: (_bin, argv) => {
        const { EventEmitter } = require('events')
        const child = new EventEmitter()
        child.stdout = new EventEmitter()
        child.stderr = new EventEmitter()
        const authStatus = argv.includes('auth') && argv.includes('status')
        const wikiSpaces = argv[0] === 'wiki' && argv[1] === '+space-list'
        queueMicrotask(() => {
          if (authStatus) {
            child.stdout.emit('data', Buffer.from(JSON.stringify(IDENTITY_ME)))
            child.emit('close', 0)
            return
          }
          if (wikiSpaces) {
            child.stdout.emit('data', Buffer.from(JSON.stringify({ data: { items: [{ space_id: 'sp_1', name: '研发 Wiki' }] } })))
            child.emit('close', 0)
            return
          }
          child.stdout.emit('data', Buffer.from(MISSING_SCOPE_STDOUT))
          child.emit('close', 3)
        })
        return child
      },
    })
    assert.equal(result.ok, true)
    assert.equal(result.meta.permissionBlocked, true)
    assert.equal(result.meta.spaces[0].name, '研发 Wiki')
    assert.ok(result.text.includes('权限受限'))
  })

  it('builds today priority agenda and task argv', () => {
    const agenda = buildCalendarAgendaArgs({
      start: '2026-07-29T00:00:00+08:00',
      end: '2026-07-29T23:59:59+08:00',
    })
    assert.equal(agenda[0], 'calendar')
    assert.equal(agenda[1], '+agenda')
    assert.ok(agenda.includes('--start'))
    assert.ok(agenda.includes('--end'))
    const tasks = buildTaskMyTasksArgs({ dueEnd: '2026-08-05T23:59:59+08:00', pageLimit: 2 })
    assert.equal(tasks[0], 'task')
    assert.equal(tasks[1], '+get-my-tasks')
    assert.ok(tasks.includes('--complete=false'))
    assert.ok(tasks.includes('--due-end'))
  })

  it('summarizes today priority from calendar + tasks + @me', async () => {
    const calls = { agenda: 0, tasks: 0, mentions: 0 }
    const result = await executeTodayPriority({}, {
      spawnImpl: spawnJson((argv) => {
        if (argv.includes('auth') && argv.includes('status')) return IDENTITY_ME
        if (argv[0] === 'calendar' && argv[1] === '+agenda') {
          calls.agenda += 1
          return {
            data: {
              events: [{
                summary: '产品评审',
                start_time: { timestamp: '1753750800' },
                end_time: { timestamp: '1753754400' },
                self_rsvp_status: 'accept',
              }],
            },
          }
        }
        if (argv[0] === 'task' && argv[1] === '+get-my-tasks') {
          calls.tasks += 1
          assert.ok(argv.includes('--complete=false'))
          return {
            data: {
              items: [
                { summary: '提交上线材料', due: { timestamp: String(Math.floor(Date.now() / 1000) - 3600) }, url: 'https://feishu.cn/t/1' },
                { summary: '整理周报', due: { timestamp: String(Math.floor(Date.now() / 1000) + 86400 * 2) } },
              ],
            },
          }
        }
        if (argv[0] === 'im' && argv[1] === '+messages-search') {
          calls.mentions += 1
          return {
            data: {
              messages: [{
                message_id: 'om_p1',
                chat_id: 'oc_p1',
                chat_name: '交付群',
                sender_name: 'PM',
                body: { text: '@我 今晚前确认方案' },
              }],
            },
          }
        }
        return { data: {} }
      }),
    })
    assert.equal(result.ok, true)
    assert.equal(result.meta.workflow, 'today_priority')
    assert.equal(calls.agenda, 1)
    assert.equal(calls.tasks, 1)
    assert.equal(calls.mentions, 1)
    assert.ok(result.text.includes('今日优先级事实摘要'))
    assert.ok(result.text.includes('产品评审'))
    assert.ok(result.text.includes('提交上线材料'))
    assert.ok(result.text.includes('已过期') || result.meta.tasks.some(t => t.overdue))
    assert.ok(result.text.includes('@我'))
    assert.ok(result.text.includes('立刻'))
    assert.ok(!/先用最多 3 个问题/.test(result.text))
  })

  it('degrades when mentions fail but calendar/tasks succeed', async () => {
    const result = await executeTodayPriority({}, {
      spawnImpl: (_bin, argv) => {
        const { EventEmitter } = require('events')
        const child = new EventEmitter()
        child.stdout = new EventEmitter()
        child.stderr = new EventEmitter()
        queueMicrotask(() => {
          if (argv.includes('auth') && argv.includes('status')) {
            child.stdout.emit('data', Buffer.from(JSON.stringify(IDENTITY_ME)))
            child.emit('close', 0)
            return
          }
          if (argv[0] === 'calendar' && argv[1] === '+agenda') {
            child.stdout.emit('data', Buffer.from(JSON.stringify({ data: { events: [{ summary: '站会', start_time: '09:30', end_time: '09:45' }] } })))
            child.emit('close', 0)
            return
          }
          if (argv[0] === 'task' && argv[1] === '+get-my-tasks') {
            child.stdout.emit('data', Buffer.from(JSON.stringify({ data: { items: [] } })))
            child.emit('close', 0)
            return
          }
          if (argv[0] === 'im') {
            child.stderr.emit('data', Buffer.from('scope missing'))
            child.emit('close', 1)
            return
          }
          child.stdout.emit('data', Buffer.from('{"data":{}}'))
          child.emit('close', 0)
        })
        return child
      },
    })
    assert.equal(result.ok, true)
    assert.equal(result.meta.degraded.mentions, true)
    assert.ok(result.text.includes('站会'))
    assert.ok(result.text.includes('数据降级说明'))
  })

  it('summarizes related chats with @me search and chat list', async () => {
    const searches = []
    const chatLists = []
    const result = await executeRelatedChats({ days: 1 }, {
      spawnImpl: spawnJson((argv) => {
        if (argv.includes('auth') && argv.includes('status')) {
          return IDENTITY_ME
        }
        if (argv[0] === 'im' && argv[1] === '+messages-search') {
          searches.push(argv.slice())
          assert.ok(argv.includes('--is-at-me'))
          assert.ok(argv.includes('--start'))
          assert.ok(argv.includes('--end'))
          return {
            data: {
              messages: [{
                message_id: 'om_1',
                chat_id: 'oc_group_1',
                chat_name: '产品周会群',
                sender_name: 'Alice',
                create_time: '2026-07-28 10:00',
                body: { text: '@我 请看下本周排期' },
              }],
            },
          }
        }
        if (argv[0] === 'im' && argv[1] === '+chat-list') {
          chatLists.push(argv.slice())
          return {
            data: {
              items: [
                { chat_id: 'oc_p2p_1', name: 'Bob', chat_mode: 'p2p' },
                { chat_id: 'oc_group_1', name: '产品周会群', chat_mode: 'group' },
              ],
            },
          }
        }
        return { data: {} }
      }),
    })
    assert.equal(result.ok, true)
    assert.equal(result.meta.workflow, 'related_chats')
    assert.equal(result.meta.days, 1)
    assert.equal(result.meta.mentions.length, 1)
    assert.ok(result.text.includes('@我 的消息'))
    assert.ok(result.text.includes('产品周会群'))
    assert.ok(result.text.includes('请看下本周排期'))
    assert.ok(result.text.includes('私聊'))
    assert.ok(result.text.includes('applink.feishu.cn/client/chat/open?openChatId=oc_group_1'))
    assert.ok(result.text.includes('applink.feishu.cn/client/chat/open?openChatId=oc_p2p_1'))
    assert.ok(result.text.includes('主题：'))
    assert.ok(result.text.includes('建议处理：'))
    assert.equal(result.text.includes('<at'), false)
    assert.ok(result.meta.mentions[0].theme)
    assert.ok(result.meta.mentions[0].openUrl.includes('openChatId=oc_group_1'))
    assert.ok(searches.length >= 1)
    assert.ok(chatLists[0].includes('--types'))
    assert.ok(String(chatLists[0][chatLists[0].indexOf('--types') + 1]).includes('p2p'))
    assert.ok(chatLists[0].includes('--sort'))
    assert.equal(chatLists[0][chatLists[0].indexOf('--sort') + 1], 'active_time')
  })

  it('defaults related chats workflow to today with empty mentions', async () => {
    const result = await executeRelatedChats({}, {
      spawnImpl: spawnJson((argv) => {
        if (argv.includes('auth') && argv.includes('status')) return IDENTITY_ME
        if (argv[0] === 'im' && argv[1] === '+messages-search') return { data: { messages: [] } }
        if (argv[0] === 'im' && argv[1] === '+chat-list') return { data: { items: [] } }
        return { data: {} }
      }),
    })
    assert.equal(result.ok, true)
    assert.equal(result.meta.days, 1)
    assert.ok(/今天与你相关的飞书聊天摘要/.test(result.text))
    assert.ok(result.text.includes('未找到明确 @你 的消息'))
  })

  it('sanitizes mention markup and suggests handling for related chats', async () => {
    const { sanitizeImMessageText, inferMentionTheme, inferHandlingSuggestion, buildFeishuChatOpenUrl } = require('../src/lib/connectors/feishu-cli')
    const raw = '大家好 <at user_id="all"></at> :Lark_Emoji_Love_0: <u>篮球报名</u> 今晚截止'
    const cleaned = sanitizeImMessageText(raw)
    assert.equal(cleaned.includes('<at'), false)
    assert.equal(cleaned.includes('Lark_Emoji'), false)
    assert.ok(cleaned.includes('篮球报名'))
    assert.ok(inferMentionTheme(raw).includes('篮球报名') || inferMentionTheme(raw).includes('大家好'))
    assert.match(inferHandlingSuggestion(raw, raw), /参与|截止|回复/)
    assert.equal(
      buildFeishuChatOpenUrl('oc_abc'),
      'https://applink.feishu.cn/client/chat/open?openChatId=oc_abc'
    )
    assert.equal(buildFeishuChatOpenUrl('bad'), '')
  })

  it('lists meetings via vc +search then hydrates with vc +detail', async () => {
    const searches = []
    const result = await executeMeetingCandidates({ days: 7 }, {
      spawnImpl: meetingWorkflowSpawn({
        onVcSearch: (argv) => {
          searches.push(argv.slice())
          return {
            data: {
              items: [{
                id: '7667497829643946937',
                display_info: '对下九九AI应用规划\n录制：对下九九AI应用规划；云文档：智能纪要：对下九九AI应用规划\n昨天 16:50 | 组织者：Viola-聂希 | ID: 286 798 478',
                meta_data: { app_link: 'https://applink.feishu.cn/m1' },
              }],
            },
          }
        },
        detailForId: (id) => vcDetail({
          meeting_id: id,
          topic: '对下九九AI应用规划',
          start_time: '2026-07-28 16:50',
          note_id: 'note_1',
          minute_token: 'mt_1',
        }),
      }),
    })
    assert.equal(result.ok, true)
    assert.equal(result.meta.candidates.length, 1)
    assert.equal(result.meta.candidates[0].minuteToken, 'mt_1')
    assert.ok(result.text.includes('对下九九AI应用规划'))
    assert.equal(result.text.includes('minute_token:'), false)
    assert.equal(result.text.includes('- url:'), false)
    assert.equal((result.text.match(/https:\/\/forever9\.feishu\.cn\/minutes\/mt_1/g) || []).length, 1)
    assert.match(result.text, /\[1\. 对下九九AI应用规划｜2026-07-28 16:50｜组织者：Viola-聂希\]\(/)
    assert.equal(result.text.includes('**1. 对下九九AI应用规划**'), false)
    // The vc app_link (applink.feishu.cn/client/vctab) is not openable in the
    // Feishu desktop client, so the surfaced link must be the /minutes/<token> page.
    assert.match(result.meta.candidates[0].url, /\/minutes\/mt_1$/)
    assert.equal(result.text.includes('applink.feishu.cn'), false)
    // vc +search uses a time range, NOT the broken --participant-ids filter.
    assert.ok(searches.some(argv => argv.includes('--start') && argv.includes('--end')))
    assert.equal(searches.some(argv => argv.includes('--participant-ids')), false)
  })

  it('defaults meeting candidate workflow to three natural days', async () => {
    const searches = []
    const result = await executeMeetingCandidates({}, {
      spawnImpl: meetingWorkflowSpawn({
        onVcSearch: (argv) => {
          searches.push(argv.slice())
          return { data: { items: [] } }
        },
      }),
    })
    assert.equal(result.ok, true)
    assert.equal(result.meta.days, 3)
    assert.ok(/最近\s*\*?\*?3\*?\*?\s*个自然日/.test(result.text))
    assert.ok(searches.some(argv => argv.includes('--start') && argv.includes('--end')))
  })

  it('paginates meeting workflow with the CLI page-token flag', async () => {
    const seen = []
    const result = await executeMeetingCandidates({ days: 7 }, {
      spawnImpl: meetingWorkflowSpawn({
        onVcSearch: (argv, call) => {
          seen.push(argv.slice())
          if (call === 1) {
            return { data: { has_more: true, page_token: 'next-page-token', items: [] } }
          }
          return {
            data: {
              has_more: false,
              items: [{
                id: 'page_meeting_1',
                display_info: 'AI提效小组周例会\n昨天 15:41 | 组织者：吴晓波',
                meta_data: {},
              }],
            },
          }
        },
        detailForId: (id) => vcDetail({ meeting_id: id, topic: 'AI提效小组周例会', start_time: '2026-07-24 15:41', minute_token: 'mt_page' }),
      }),
    })
    assert.equal(result.ok, true)
    assert.ok(result.text.includes('AI提效小组周例会'))
    assert.ok(seen.some(argv => argv.includes('--page-token')))
    assert.ok(seen.some(argv => argv.includes('next-page-token')))
  })

  it('uses vc +detail topic and start time for candidate rows', async () => {
    const result = await executeMeetingCandidates({ days: 7 }, {
      spawnImpl: meetingWorkflowSpawn({
        onVcSearch: () => ({
          data: { items: [{ id: 'm2', display_info: '周例会\n昨天 15:01 | 组织者：吴晓波', meta_data: {} }] },
        }),
        detailForId: (id) => vcDetail({ meeting_id: id, topic: '架构组周会', start_time: '2026-07-27 15:01', minute_token: 'mt_2' }),
      }),
    })
    assert.equal(result.ok, true)
    assert.ok(result.text.includes('架构组周会'))
    assert.ok(result.text.includes('2026-07-27 15:01'))
  })

  it('never offers the unopenable vc app_link when no minutes exist', async () => {
    const result = await executeMeetingCandidates({ days: 7 }, {
      spawnImpl: meetingWorkflowSpawn({
        onVcSearch: () => ({
          data: {
            items: [{
              id: 'm3',
              display_info: '临时沟通\n今天 10:00 | 组织者：吴晓波',
              meta_data: { app_link: 'https://applink.feishu.cn/client/vctab/open?meetingId=m3' },
            }],
          },
        }),
        detailForId: (id) => vcDetail({ meeting_id: id, topic: '临时沟通', start_time: '2026-07-29 10:00' }),
      }),
    })
    assert.equal(result.ok, true)
    assert.equal(result.meta.candidates[0].url, '')
    assert.equal(result.text.includes('applink.feishu.cn'), false)
    assert.ok(result.text.includes('未生成智能纪要'))
  })

  it('reads a meeting body via minute_token', async () => {
    const result = await executeMeetingRead({ minute_token: 'mt_1' }, {
      spawnImpl: spawnJson((argv) => {
        if (argv[0] === 'minutes' && argv[1] === '+detail') {
          assert.ok(argv.includes('--minute-tokens'))
          return { data: { minutes: [{ minute_token: 'mt_1', title: '产品周会', artifacts: { summary: '会议纪要：讨论了产品排期，结论是下周上线。' } }] } }
        }
        return { data: {} }
      }),
    })
    assert.equal(result.ok, true)
    assert.equal(result.meta.kind, 'minute')
    assert.ok(result.text.includes('会议纪要'))
    assert.ok(result.text.includes('## 摘要'))
    assert.ok(result.text.includes('产品周会'))
    assert.equal(result.text.trim().startsWith('{'), false)
  })

  it('meeting workflow rejects non-meeting minute body', async () => {
    const result = await executeMeetingRead({ minute_token: 'mt_x' }, {
      spawnImpl: spawnJson((argv) => {
        if (argv[0] === 'minutes' && argv[1] === '+detail') {
          return { data: { minutes: [{ artifacts: { summary: '产品介绍与市场分析' } }] } }
        }
        return { data: {} }
      }),
    })
    assert.equal(result.ok, false)
    assert.equal(result.code, 'not_meeting_document')
  })

  it('explains a per-minute ACL failure instead of blaming app scopes', async () => {
    const result = await executeMeetingRead({ minute_token: 'obcn_denied' }, {
      spawnImpl: (_bin, argv) => {
        const { EventEmitter } = require('events')
        const child = new EventEmitter()
        child.stdout = new EventEmitter()
        child.stderr = new EventEmitter()
        queueMicrotask(() => {
          if (argv[0] === 'minutes' && argv[1] === '+detail') {
            child.stdout.emit('data', Buffer.from(JSON.stringify({
              ok: false,
              data: { minutes: [{ minute_token: 'obcn_denied', error: 'No read permission for minute obcn_denied' }] },
            })))
            child.emit('close', 1)
            return
          }
          child.stdout.emit('data', Buffer.from('{}'))
          child.emit('close', 0)
        })
        return child
      },
    })
    assert.equal(result.ok, false)
    assert.ok(String(result.message || '').includes('obcn_denied'))
    assert.ok(String(result.message || '').includes('申请'))
    assert.equal(String(result.message || '').includes('minutes:minutes.search:read'), false)
  })

  it('normalizes missing user identity error', async () => {
    const result = await executeFeishuRead(
      'feishu.search_docs',
      { query: '报销' },
      {
        spawnImpl: () => {
          const { EventEmitter } = require('events')
          const child = new EventEmitter()
          child.stdout = new EventEmitter()
          child.stderr = new EventEmitter()
          queueMicrotask(() => {
            child.stderr.emit('data', Buffer.from('User identity is missing'))
            child.emit('close', 1)
          })
          return child
        },
      }
    )
    assert.equal(result.ok, false)
    assert.ok(String(result.message || '').includes('未授权'))
  })

  it('retries search_docs with softened query on positional-arg errors', async () => {
    const seen = []
    const result = await executeFeishuRead(
      'feishu.search_docs',
      { query: '2026-07-25 OR 2026-07-26 OR 2026-07-27 AND (会议纪要 OR 会议记录)' },
      {
        spawnImpl: (_bin, argv) => {
          const { EventEmitter } = require('events')
          seen.push(argv.slice())
          const child = new EventEmitter()
          child.stdout = new EventEmitter()
          child.stderr = new EventEmitter()
          queueMicrotask(() => {
            if (seen.length === 1) {
              child.stderr.emit('data', Buffer.from('positional arguments are not supported (got [\"OR\"])'))
              child.emit('close', 1)
            } else {
              child.stdout.emit('data', Buffer.from('{"ok":true,"items":[]}\n'))
              child.emit('close', 0)
            }
          })
          return child
        },
      }
    )
    assert.equal(result.ok, true)
    assert.equal(seen.length, 2)
    const retryArgv = seen[1]
    const queryValue = retryArgv[retryArgv.indexOf('--query') + 1]
    assert.equal(
      queryValue,
      normalizeQueryArgForPlatform('2026-07-25 2026-07-26 2026-07-27 会议纪要 会议记录')
    )
  })

  it('normalizes feishu user/chat options from CLI payload', async () => {
    const spawnImpl = (_bin, argv) => {
      const { EventEmitter } = require('events')
      const child = new EventEmitter()
      child.stdout = new EventEmitter()
      child.stderr = new EventEmitter()
      queueMicrotask(() => {
        if (argv.includes('+search-user')) {
          child.stdout.emit('data', Buffer.from(JSON.stringify({
            users: [{ open_id: 'ou_1', name: '张三', p2p_chat_id: 'oc_p2p_1' }],
          })))
        } else {
          child.stdout.emit('data', Buffer.from(JSON.stringify({
            items: [{ chat_id: 'oc_1', name: '研发群' }],
          })))
        }
        child.emit('close', 0)
      })
      return child
    }
    const users = await listFeishuUsers({ query: '张三' }, { spawnImpl })
    const chats = await listFeishuChats({ query: '研发' }, { spawnImpl })
    assert.equal(users.ok, true)
    assert.equal(chats.ok, true)
    assert.equal(users.items[0].id, 'ou_1')
    assert.equal(chats.items[0].id, 'oc_1')
  })
})

describe('feishu draft write review', () => {
  let dir
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-feishu-'))
  })
  afterEach(() => {
    try { fs.rmSync(dir, { recursive: true, force: true }) } catch { /* ignore */ }
  })

  it('draft does not call cli apply', () => {
    const built = buildDraftWrite({ title: '纪要', body: '内容' })
    assert.equal(built.ok, true)
    assert.equal(built.draft.status, 'pending_review')
  })

  it('approve can dry-run without writing', async () => {
    const built = buildDraftWrite({ title: '纪要', body: '内容' })
    rememberDraft(dir, built.draft)
    const result = await approveFeishuDraft(dir, built.draft.id, { dryRun: true })
    assert.equal(result.ok, true)
    assert.equal(result.dryRun, true)
  })

  it('reject marks draft rejected', async () => {
    const built = buildDraftWrite({ title: '纪要', body: '内容' })
    rememberDraft(dir, built.draft)
    const result = await approveFeishuDraft(dir, built.draft.id, { reject: true })
    assert.equal(result.ok, true)
    assert.equal(result.rejected, true)
    const retry = await approveFeishuDraft(dir, built.draft.id, { dryRun: true })
    assert.equal(retry.ok, false)
    assert.equal(retry.code, 'not_pending')
  })

  it('projects feishu tools when allowlisted', async () => {
    store.upsertConnector(dir, {
      id: 'feishu',
      type: 'feishu',
      enabled: true,
      allowlist: ['feishu.search_docs', 'feishu.draft_write_doc'],
    })
    const runtime = await buildConnectorToolSurface(dir, {
      feishu: {
        spawnImpl: () => {
          throw new Error('should not spawn for definition build')
        },
      },
    })
    const names = runtime.surface.getToolDefinitions().map((d) => d.function.name)
    assert.ok(names.includes('search_knowledge'))
    assert.ok(names.includes('feishu.search_docs'))
    assert.ok(names.includes('feishu.draft_write_doc'))
    assert.ok(!names.includes('feishu.read_doc'))
    await runtime.close()
  })

  it('projects deterministic meeting workflow when base read tools are allowlisted', async () => {
    store.upsertConnector(dir, {
      id: 'feishu',
      type: 'feishu',
      enabled: true,
      allowlist: ['feishu.search_docs', 'feishu.read_doc'],
    })
    const runtime = await buildConnectorToolSurface(dir, {
      feishu: { spawnImpl: () => { throw new Error('should not spawn for definition build') } },
    })
    const names = runtime.surface.getToolDefinitions().map((d) => d.function.name)
    assert.ok(names.includes('feishu.meeting_candidates'))
    assert.ok(names.includes('feishu.meeting_read'))
    assert.ok(names.includes('feishu.related_chats'))
    assert.ok(names.includes('feishu.today_priority'))
    assert.ok(names.includes('feishu.doc_kb_suggest'))
    // ACL recovery must be reachable from the same workflow.
    assert.ok(names.includes('feishu.draft_minute_permission'))
    await runtime.close()
  })

  it('minute permission draft needs a token and stays pending', () => {
    assert.equal(buildDraftMinutePermission({}).ok, false)
    const fromUrl = buildDraftMinutePermission({ url: 'https://forever9.feishu.cn/minutes/obcnA1' })
    assert.equal(fromUrl.ok, true)
    assert.equal(fromUrl.draft.action, 'apply_minute_permission')
    assert.equal(fromUrl.draft.minuteToken, 'obcnA1')
    assert.equal(fromUrl.draft.perm, 'view')
    assert.equal(fromUrl.draft.status, 'pending_review')
  })

  it('applies minute permission only after approval', async () => {
    const built = buildDraftMinutePermission({ minute_token: 'obcnA2', perm: 'view' })
    rememberDraft(dir, built.draft)
    let seen = null
    const spawnImpl = (bin, argv) => {
      seen = argv
      const { EventEmitter } = require('events')
      const child = new EventEmitter()
      child.stdout = new EventEmitter()
      child.stderr = new EventEmitter()
      queueMicrotask(() => {
        child.stdout.emit('data', Buffer.from('{"ok":true}\n'))
        child.emit('close', 0)
      })
      return child
    }
    const dry = await approveFeishuDraft(dir, built.draft.id, { dryRun: true, spawnImpl })
    assert.equal(dry.ok, true)
    assert.equal(dry.dryRun, true)
    assert.equal(seen, null)

    const applied = await approveFeishuDraft(dir, built.draft.id, { spawnImpl })
    assert.equal(applied.ok, true)
    assert.ok(seen.includes('+apply-permission'))
    assert.ok(seen.includes('--minute-token'))
    assert.ok(seen.includes('obcnA2'))
    assert.ok(seen.includes('--perm'))
    assert.ok(seen.includes('view'))
  })

  it('rejected permission draft never reaches the cli', async () => {
    const built = buildDraftMinutePermission({ minute_token: 'obcnA3' })
    rememberDraft(dir, built.draft)
    let spawned = false
    const result = await approveFeishuDraft(dir, built.draft.id, {
      reject: true,
      spawnImpl: () => { spawned = true; throw new Error('must not spawn') },
    })
    assert.equal(result.ok, true)
    assert.equal(result.rejected, true)
    assert.equal(spawned, false)
  })

  it('applyFeishuWrite builds create argv', async () => {
    let seen = null
    const result = await applyFeishuWrite(
      { action: 'create_doc', title: 'T', body: 'B' },
      {
        spawnImpl: (bin, argv) => {
          seen = { bin, argv }
          const { EventEmitter } = require('events')
          const child = new EventEmitter()
          child.stdout = new EventEmitter()
          child.stderr = new EventEmitter()
          queueMicrotask(() => {
            child.stdout.emit('data', Buffer.from('{"ok":true}\n'))
            child.emit('close', 0)
          })
          return child
        },
      }
    )
    assert.equal(result.ok, true)
    assert.equal(seen.argv[0], 'docs')
    assert.equal(seen.argv[1], '+create')
  })
})

// Fixtures below are the real lark-cli 1.0.77 JSON output captured on 2026-08-03
// (`drive files list` scope failure + `auth status`), so the parser is verified
// against the authoritative envelope rather than an assumed shape.
const MISSING_SCOPE_STDOUT = JSON.stringify({
  ok: false,
  identity: 'user',
  error: {
    type: 'authorization',
    subtype: 'missing_scope',
    message: 'unauthorized: user authorization does not cover the required scope(s): space:document:retrieve',
    hint: 'run `lark-cli auth login --scope "space:document:retrieve"` to re-authorize the user with the updated scope set',
    missing_scopes: ['space:document:retrieve'],
    identity: 'user',
  },
  _notice: { update: { current: '1.0.77', latest: '1.0.81' } },
})

const AUTH_STATUS_STDOUT = JSON.stringify({
  appId: 'cli_x',
  identities: {
    bot: { status: 'ready', available: true },
    user: {
      status: 'ready',
      available: true,
      openId: 'ou_x',
      userName: 'tCloud-尹艳龙',
      tokenStatus: 'valid',
      scope: 'auth:user.id:read contact:user:search docx:document:readonly drive:file:download',
    },
  },
})

/** Spawn stub that emits `stdout` then closes with `code` (non-zero => CLI failure). */
function spawnRaw(stdout, code = 0) {
  return () => {
    const { EventEmitter } = require('events')
    const child = new EventEmitter()
    child.stdout = new EventEmitter()
    child.stderr = new EventEmitter()
    queueMicrotask(() => {
      child.stdout.emit('data', Buffer.from(stdout))
      child.emit('close', code)
    })
    return child
  }
}

describe('feishu just-in-time authorization (route A detection layer)', () => {
  it('parses the authoritative missing_scopes envelope from lark-cli', () => {
    const parsed = parseMissingScopeError(MISSING_SCOPE_STDOUT)
    assert.ok(parsed)
    assert.deepEqual(parsed.missingScopes, ['space:document:retrieve'])
    assert.equal(parsed.identity, 'user')
    assert.match(parsed.hint, /auth login --scope/)
  })

  it('returns null for non-scope errors and non-JSON output', () => {
    const validation = JSON.stringify({ ok: false, error: { type: 'validation', subtype: 'invalid_argument', message: 'unknown flag' } })
    assert.equal(parseMissingScopeError(validation), null)
    assert.equal(parseMissingScopeError('some plain text error'), null)
    assert.equal(parseMissingScopeError(''), null)
  })

  it('describes exact missing scopes without the misleading docs/wiki wording', () => {
    const msg = describeMissingScopes(['space:document:retrieve'])
    assert.ok(msg.includes('space:document:retrieve'))
    assert.equal(/docs\/wiki 搜索读取权限/.test(msg), false)
    assert.ok(describeMissingScopes([]).length > 0)
  })

  it('surfaces structured missing_scope from executeFeishuRead instead of generic text', async () => {
    const result = await executeFeishuRead('feishu.search_docs', { query: '知识库' }, {
      spawnImpl: spawnRaw(MISSING_SCOPE_STDOUT, 3),
    })
    assert.equal(result.ok, false)
    assert.equal(result.code, 'missing_scope')
    assert.deepEqual(result.missingScopes, ['space:document:retrieve'])
    assert.equal(result.identity, 'user')
    // Root-cause fix: no longer collapses to the misleading catch-all message.
    assert.equal(/请补齐 docs\/wiki 搜索读取权限/.test(String(result.message || '')), false)
    assert.ok(String(result.message || '').includes('space:document:retrieve'))
  })

  it('humanizes Internal error for executeFeishuRead without dumping JSON/log_id', async () => {
    const envelope = JSON.stringify({
      ok: false,
      identity: 'user',
      error: {
        type: 'api',
        subtype: 'unknown',
        code: 1,
        message: 'Internal error. Please retry.',
        log_id: '20260803081835B1DF3557B80',
      },
    })
    const result = await executeFeishuRead('feishu.search_docs', { query: '会议' }, {
      spawnImpl: spawnRaw(envelope, 1),
      retries: 0,
      backoffMs: 0,
    })
    assert.equal(result.ok, false)
    assert.match(String(result.message || ''), /飞书接口暂时不可用|稍后/)
    assert.match(String(result.text || ''), /飞书接口暂时不可用|稍后/)
    assert.equal(/log_id|Internal error|"ok"\s*:\s*false/.test(String(result.text || '')), false)
  })

  it('humanizes Internal error for executeMeetingRead text surface', async () => {
    const envelope = JSON.stringify({
      ok: false,
      identity: 'user',
      error: { type: 'api', code: 1, message: 'Internal error. Please retry.', log_id: 'x' },
    })
    const result = await executeMeetingRead({ minute_token: 'mt_demo' }, {
      spawnImpl: spawnRaw(envelope, 1),
      retries: 0,
      backoffMs: 0,
    })
    assert.equal(result.ok, false)
    assert.equal(/log_id|Internal error/.test(String(result.text || '')), false)
    assert.match(String(result.text || ''), /飞书接口暂时不可用|稍后/)
  })

  it('reads granted user scopes from auth status as the authoritative held set', async () => {
    const status = await getGrantedUserScopes({ spawnImpl: spawnRaw(AUTH_STATUS_STDOUT, 0) })
    assert.equal(status.ok, true)
    assert.equal(status.tokenStatus, 'valid')
    assert.ok(status.scopes.includes('drive:file:download'))
    // The very scope that breaks 个人文件夹 is verifiably absent from the held set.
    assert.equal(status.scopes.includes('space:document:retrieve'), false)
  })
})
