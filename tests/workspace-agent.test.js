/**
 * 工作区 Agent：独立对话与 @ 文件引用静态冒烟
 */
const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')

describe('workspace agent independent chat', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace.html'), 'utf8')
  const agent = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace-agent.js'), 'utf8')
  const workspace = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace.js'), 'utf8')

  it('allows a standalone conversation without requiring an editor file', () => {
    assert.ok(agent.includes('if (!ctx.ok && ctx.error)'), 'only real context errors block sending')
    assert.ok(workspace.includes('noteId: null, content: \'\''), 'empty editor context is valid')
  })

  it('offers @ file selection and opens the file in the single editor pane', () => {
    assert.ok(html.includes('id="agentAtMenu"'), '@ menu markup')
    assert.ok(agent.includes('getAtContext'), '@ trigger parser')
    assert.ok(agent.includes('openReferencedFile(note.id)'), 'selection opens referenced file')
    assert.ok(workspace.includes("openFile(id, 'left')"), 'referenced file uses editor pane')
    assert.ok(workspace.includes('Agent 与文件预览已经是工作台的两列'), 'does not nest another split')
  })

  it('groups @ suggestions into recent files and expandable folders', () => {
    assert.ok(agent.includes('function recentFiles()'), 'recent file section')
    assert.ok(agent.includes('slice(0, 3)'), 'only three recent files')
    assert.ok(agent.includes('function fileGroups()'), 'folder grouping')
    assert.ok(agent.includes('agent-at-folder'), 'expandable folder rows')
    assert.ok(agent.includes('atExpanded.has(group.key)'), 'folder expansion state')
  })

  it('uses icon-first Agent tabs and icon-only message roles', () => {
    assert.ok(html.includes('说说你想做什么，或问公司约定'), 'friendly composer placeholder')
    assert.ok(html.includes('id="agentSessionTabs"'), 'session tab list')
    assert.ok(!html.includes('id="agentNewAgent"'), 'left New Agent button removed')
    assert.ok(!html.includes('id="agentTabPlus"'), 'standalone plus button merged into expert entry')
    assert.match(html, /id="agentExpertBtn"[^>]*>\s*<span class="ico" data-icon="plus"><\/span>\s*<\/button>/, 'expert entry uses plus icon')
    assert.ok(!html.includes('id="agentExpertLabel"'), 'expert selector omits current expert text')
    assert.ok(html.includes('id="agentHistoryBtn"'), 'history button')
    assert.ok(html.includes('id="agentMoreBtn"'), 'more menu button')
    assert.ok(html.includes('id="agentTabCtxPop"'), 'tab context menu')
    assert.ok(html.includes('.agent-session-tab.active'), 'active session tab style')
    assert.ok(!html.includes('id="agentAgentList"'), 'old agent type list removed')
    assert.ok(!html.includes('id="agentSessionSelect"'), 'no session dropdown')
    assert.ok(!html.includes('.agent-bubble.user::before'), 'no textual user label')
    assert.ok(!html.includes('.agent-bubble.assistant::before'), 'no textual assistant label')
    assert.ok(html.includes('class="agent-empty-tips agent-empty-home"'), 'compact office-home empty state')
    assert.ok(html.includes('会议总结'), 'office partner meeting summary action')
    assert.ok(html.includes('为我总结最近三天的会议'), 'meeting summary subtitle')
    assert.ok(html.includes('今日优先级'), 'office partner priority action')
    assert.ok(html.includes('查文档/知识库'), 'office partner docs action')
    assert.ok(html.includes('分析跟我相关的聊天'), 'office partner related chats action')
    assert.ok(!html.includes('公司智能办公搭档'), 'old company hero removed')
    assert.ok(!html.includes('飞书办公规划'), 'old office planning card removed')
    assert.ok(!html.includes('agent-empty-hints'), 'home empty state omits shortcut hint rows')
    assert.ok(html.includes('智能办公搭档'), 'office-partner empty hero')
    assert.match(
      html,
      /\.agent-empty-home \.agent-empty-hero,\s*\.agent-empty-home \.agent-empty-sub \{[^}]*text-align:center/,
      'home empty-state heading and subtitle are centered'
    )
    assert.match(html, /\.agent-empty-act \{[^}]*text-align:left/, 'action-card copy remains left aligned')
    assert.ok(html.includes('data-auto-send="1"'), 'office cards are auto-send shortcuts')
    assert.ok(agent.includes("agentId === 'steward'"), 'steward keeps knowledge empty state')
    assert.ok(agent.includes('data-steward="lint"'), 'steward lint template retained')
    assert.ok(agent.includes('data-steward="remote-rag"'), 'steward remote RAG template present')
    assert.ok(agent.includes('检索远程知识库'), 'remote RAG card title')
    assert.ok(agent.includes('MCP 读取 RAG 知识库'), 'remote RAG card subtitle')
    assert.ok(agent.includes('ragflow_retrieval'), 'remote RAG prompts MCP retrieval')
    assert.ok(
      agent.includes('class="agent-empty-tips agent-empty-home agent-empty-steward"'),
      'steward reuses the office-home empty layout'
    )
    const stewardEmpty = agent.slice(
      agent.indexOf("if (activeSession?.agentId === 'steward')"),
      agent.indexOf('return `<div class="agent-empty-tips agent-empty-home" aria-label="任务入口">')
    )
    assert.ok(!stewardEmpty.includes('class="agent-empty-tip"'), 'steward omits legacy shortcut hint rows')
    assert.ok(html.includes('懂你的智能体搭档'), 'brand empty slogan')
    assert.ok(agent.includes('feishu.related_chats'), 'related chats shortcut prompts workflow')
    assert.ok(agent.includes('feishu.today_priority'), 'today priority shortcut prompts workflow')
    assert.ok(agent.includes('enrichTodayPriorityShortcutPrompt'), 'today priority prompt enrichment')
    assert.ok(agent.includes('基于飞书日程/待办直接出 Top3'), 'priority subtitle emphasizes grounded Top3')
    assert.ok(!agent.includes('先用最多 3 个问题快速澄清'), 'priority no longer asks three clarifying questions first')
    assert.ok(agent.includes('enrichRelatedChatsShortcutPrompt'), 'related chats prompt enrichment')
    assert.ok(agent.includes('enrichDocKbShortcutPrompt'), 'doc kb prompt enrichment')
    assert.ok(agent.includes('feishu.doc_kb_suggest'), 'doc kb workflow tool')
    assert.ok(agent.includes('normalizeRelatedChatsResultMarkdown'), 'related chats result normalizes visual headings')
    assert.ok(agent.includes('looksLikeRelatedChatsMarkdown'), 'related chats layout also detects by content')
    assert.ok(agent.includes('related-chats-result'), 'related chats result gets a dedicated layout class')
    assert.ok(html.includes('.agent-bubble.related-chats-result'), 'related chats result uses a readable-width surface')
    assert.match(html, /--agent-message-track:\s*min\(920px,\s*100%\)/, 'defines one Agent message track')
    assert.match(
      html,
      /\.agent-bubble\s*\{\s*width:var\(--agent-message-track\);\s*max-width:var\(--agent-message-track\);/,
      'all Agent bubbles use the same message track'
    )
    assert.match(
      html,
      /\.agent-composer\s*\{[^}]*width:var\(--agent-message-track\);\s*max-width:var\(--agent-message-track\);/,
      'Agent composer uses the same message track'
    )
    assert.match(
      html,
      /\.agent-quick-menu\s*\{[^}]*width:var\(--agent-message-track\);\s*max-width:var\(--agent-message-track\);/,
      'quick panel uses the same message track'
    )
    assert.match(html, /\.agent-chat-log\s*\{[^}]*padding:18px 16px 8px;/, 'chat log keeps a compact bottom inset')
    assert.match(html, /\.agent-col-foot\s*\{[^}]*padding:4px 16px 12px;/, 'footer keeps matching horizontal and compact top inset')
    assert.doesNotMatch(html, /\.agent-col-foot\s*\{[^}]*border-top:/, 'composer footer has no top divider')
    assert.match(html, /\.agent-composer\s*\{[^}]*border:1px solid rgba\(0,0,0,0\.10\)/, 'composer keeps its own border')
    assert.doesNotMatch(
      html,
      /\.agent-bubble\.related-chats-result\s*\{[^}]*\b(?:width|max-width):/,
      'specialized results do not override the shared message track'
    )
    assert.match(
      html,
      /\.related-chats-result \.agent-md\s*\{[^}]*width:100%;/,
      'related chats content fills the shared message track instead of a narrower inner cap'
    )
    assert.ok(html.includes('.related-chats-result .agent-md > p:first-child'), 'related chats intro is visually separated')
    assert.ok(html.includes('.related-chats-result .agent-md li:nth-child(odd)'), 'long chat lists have scan-friendly row rhythm')
  })

  it('runs office shortcuts immediately after click', () => {
    assert.ok(agent.includes('function runOfficeShortcut'), 'has dedicated office shortcut runner')
    assert.ok(agent.includes('await dispatchAgentAction({'), 'shortcut submits through the action dispatcher')
    assert.ok(agent.includes('hideAiMenus()'), 'shortcut closes quick panel before execution')
    assert.ok(agent.includes('.agent-empty-act[data-auto-send="1"]'), 'click handler targets auto-send cards')
    assert.ok(agent.includes('function runQuickAction(btn)'), 'quick menu actions share one dispatcher')
    assert.ok(agent.includes('if (btn) runQuickAction(btn)'), 'quick menu click runs directly')
    assert.ok(agent.includes('function mergeShortcutPromptWithComposer'), 'shortcut send keeps current composer material')
    assert.ok(agent.includes('以下是我当前提供的材料或链接，请直接基于它继续：'), 'shortcut merge block preserves pasted links and drafts')
    assert.ok(agent.includes('写需求文档'), 'writing mode shortcut exposes requirement docs')
    assert.ok(agent.includes('写办公文档'), 'writing mode shortcut exposes office docs')
    assert.ok(agent.includes('按提纲成稿'), 'writing mode shortcut exposes outline drafting')
    assert.ok(agent.includes('排版定稿'), 'writing mode shortcut exposes final formatting')
    assert.ok(agent.includes('润色去 AI 味'), 'writing mode quick menu exposes humanizer action')
  })

  it('offers explainable continuation without composer work-hint chips', () => {
    assert.ok(agent.includes('async function resumeSession(sessionId)'), 'resume action is session-scoped')
    assert.ok(html.includes('依据：已有 Session 摘要'), 'resume suggestion shows its basis')
    // 产品尚未定清「意图推荐 / 记忆开关」之前，输入框上方不展示记忆勾选条
    assert.ok(!agent.includes('agent-work-hints'), 'composer work-hint bar is parked')
    assert.ok(!agent.includes('本轮带上'), 'per-turn context chips are not shown')
    assert.ok(!agent.includes('已填入基于记忆的下一步'), 'memory fill-into-composer is gone')
    // 静默个性化：回复旁可解释，不恢复勾选条
    assert.ok(agent.includes('function renderPersonalizationMeta'), 'personalization explain row helper exists')
    assert.ok(agent.includes('本轮沿用了'), 'assistant bubble can explain applied habits')
    assert.ok(agent.includes('effectivePersonalization?.promptBlock'), 'shortcuts reuse effective personalization')
    assert.ok(html.includes('.agent-personalization'), 'personalization styles are present')
    assert.ok(html.includes('id="km-fab-resume"'), 'resume suggestion lives in the floating assistant')
    assert.ok(html.includes('data-fab-resume'), 'floating assistant resume action is session-scoped')
    assert.ok(!agent.includes('renderResumeCard()'), 'empty state does not render a resume card')
  })

  it('uses industry placeholder examples when Feishu facts are empty', () => {
    assert.ok(agent.includes('允许给出最多 3 条**行业占位示例**'), 'empty priority facts allow industry placeholders')
    assert.ok(agent.includes('禁止把示例写成推荐任务'), 'placeholders must not become recommendations')
    assert.ok(agent.includes('禁止输出“选一项”列表、按钮选项'), 'empty priority facts forbid suggestion choices')
    assert.ok(agent.includes('function hasEmptyTodayPriorityFacts'), 'empty priority facts have a deterministic UI guard')
    assert.ok(agent.includes('emptyTodayPriorityBody()'), 'empty priority facts use deterministic industry body')
    assert.ok(agent.includes('const bar = emptyTodayPriority ? null : parsed.bar'), 'empty priority facts hide generated choices')
  })

  it('shows the quick action as an icon on the left side of the toolbar', () => {
    assert.equal((html.match(/id="agentQuickBtn"/g) || []).length, 1, 'one quick action button')
    assert.ok(html.includes('id="agentQuickBtn" type="button" title="快捷操作（Ctrl+K）"'), 'quick action uses shortcut label')
    assert.ok(html.includes('class="agent-menu-trigger icon-only" id="agentQuickBtn"'), 'quick action uses icon-only trigger')
    assert.ok(!html.includes('<span>快捷操作</span>'), 'quick action does not repeat text beside icon')
    assert.ok(html.includes('.agent-menu { position:absolute; left:0;'), 'quick menu opens from the left')
    assert.ok(html.includes('id="agentMoreBtn"'), 'agent more menu lives in tab chrome')
    assert.ok(html.includes('id="agentMorePop"'), 'agent more popover')
  })

  it('shows quick actions as an animated inline panel without covering content', () => {
    assert.ok(html.includes('.agent-quick-menu {'), 'quick actions use a dedicated panel')
    assert.ok(html.includes('grid-template-columns:170px minmax(240px, 1fr)'), 'quick panel uses two-step columns')
    assert.ok(html.includes('.agent-quick-col {'), 'quick actions support grouped columns')
    assert.ok(html.includes('.agent-quick-col-title'), 'quick actions render group titles')
    assert.ok(html.includes('id="agentQuickCats"'), 'left column uses dynamic category host')
    assert.ok(html.includes('id="agentQuickItems"'), 'right column uses dynamic item host')
    assert.ok(html.includes('.agent-quick-menu.quick-focus-cats'), 'focus mode styles category column')
    assert.ok(html.includes('.agent-quick-menu.quick-focus-items'), 'focus mode styles item column')
    assert.ok(html.includes('max-height:0') && html.includes('.agent-quick-menu.show'), 'panel expands in document flow')
    assert.ok(html.includes('height:166px') && html.includes('max-height:166px'), 'open panel keeps a fixed height across categories')
    assert.ok(html.includes('background:var(--bg-card)') && html.includes('box-shadow:0 6px 18px'), 'panel has visual separation')
    assert.ok(html.includes('prefers-reduced-motion: reduce'), 'panel respects reduced motion')
    assert.ok(agent.includes('setQuickMenuOpen'), 'trigger synchronizes expanded state')
    assert.ok(agent.includes('const QUICK_MENU_PROFILES = {'), 'quick menu profiles are role-aware')
    assert.ok(agent.includes('renderQuickMenuForAgent(activeAgentId)'), 'quick menu re-renders by active assistant')
    assert.ok(agent.includes('data-steward'), 'quick actions support steward-only workflows')
    assert.ok(agent.includes('function handleQuickMenuKeydown'), 'quick menu has dedicated keyboard handler')
    assert.ok(agent.includes("quickFocus = 'cats'"), 'quick menu opens with category focus')
    assert.ok(agent.includes("e.key === 'ArrowLeft'"), 'left arrow moves to category column')
    assert.ok(agent.includes("e.key === 'ArrowRight'"), 'right arrow moves to item column')
    assert.ok(agent.includes("if (aiQuickMenu?.classList.contains('show')) setQuickMenuOpen(false)"), 'Ctrl+K toggles the quick panel closed')
  })

  it('provides a local text-file attachment flow for the composer', () => {
    assert.ok(html.includes('id="agentAttach"'), 'attachment button')
    assert.ok(html.includes('id="agentFileInput"'), 'file input')
    assert.ok(!html.includes('id="agentAttachment"'), 'composer does not render a separate file row')
    assert.ok(agent.includes('file.text()'), 'reads selected text file')
    assert.ok(agent.includes('attachedContext'), 'sends attachment content as context')
    assert.ok(agent.includes('attachmentName'), 'keeps attachment visible in chat history')
  })

  it('uses the composer outline as a context-size progress indicator', () => {
    assert.ok(html.includes('--model-usage-progress'), 'context progress variable')
    assert.ok(html.includes('conic-gradient'), 'progress outline')
    assert.ok(agent.includes('CONTEXT_LIMIT_TOKENS'), 'context budget')
    assert.ok(agent.includes('updateContextMeter'), 'context meter updates')
  })

  it('keeps the conversation readable as a bounded message stream', () => {
    assert.ok(html.includes('--agent-message-track: min(920px, 100%)'), 'bounded shared message track')
    assert.ok(html.includes('max-width:var(--agent-message-track)'), 'message width inherits shared track')
    assert.ok(html.includes('box-shadow:0 1px 2px'), 'message surface treatment')
    assert.ok(html.includes('padding:18px 16px 8px'), 'conversation uses a compact bottom inset')
  })

  it('uses Cursor-style multi session tabs with independent transcripts', () => {
    assert.ok(agent.includes('agentSessionList'), 'loads persisted sessions')
    assert.ok(agent.includes('agentSessionNew'), 'creates a new Agent session')
    assert.ok(agent.includes('agentSessionFork'), 'fork continues in new Agent')
    assert.ok(agent.includes('agentSessionCloseTab'), 'closes tab without deleting')
    assert.ok(agent.includes('sessionId: activeSession?.id'), 'sends session id')
    assert.ok(agent.includes('openSessionIds'), 'tracks open tabs')
    assert.ok(agent.includes('createNewAgent'), 'New Agent action')
    assert.ok(agent.includes('contextmenu'), 'tab right-click menu')
    assert.ok(agent.includes('复制对话记录'), 'copy transcript action')
    assert.ok(agent.includes('管理对话'), 'manage conversation action')
    assert.ok(agent.includes('关闭左侧'), 'close-left action')
    assert.ok(agent.includes('关闭右侧'), 'close-right action')
    assert.ok(agent.includes('关闭其他'), 'close-others action')
    assert.ok(agent.includes('closeSessionTabs('), 'batch close handler')
    assert.ok(agent.includes('agentSessionPin'), 'pin session')
    assert.ok(agent.includes('复制当前总结'), 'copy summary menu')
    assert.ok(agent.includes('在新对话继续'), 'continue in new conversation')
    assert.ok(!agent.includes('每个 Agent 固定一个对话'), 'no longer one conversation per agent type')
    assert.ok(!agent.includes('agentNewAgent'), 'left New Agent button unbound')
  })

  it('keeps Agent and workbench tab collections separate', () => {
    assert.ok(agent.includes('knowme.agent.surfaceUi.v2'), 'persists per-surface tab state')
    assert.ok(agent.includes('openIds: [...new Set(openSessionIds)]'), 'stores each surface open tabs')
    assert.ok(agent.includes('surfaceUi[surfaceMode]'), 'updates only the active surface')
    assert.ok(agent.includes('openSessionIds = state.openIds.filter'), 'restores only target surface tabs')
    assert.ok(agent.includes('updateCurrentSurfaceUi(activeSession.id)'), 'new tabs remain on current surface')
  })

  it('shows a thinking indicator before the first stream chunk', () => {
    assert.ok(agent.includes('正在处理'), 'thinking copy')
    assert.ok(agent.includes('streaming thinking'), 'thinking bubble class')
    assert.ok(agent.includes('thinking-dots'), 'thinking animation markup')
    assert.ok(html.includes('@keyframes thinking-bounce'), 'thinking animation css')
    assert.ok(html.includes('.agent-bubble.thinking'), 'thinking bubble style')
  })

  it('renders json thinking blocks as a dedicated card', () => {
    assert.ok(agent.includes('function parseThinkingBlocks'), 'parses dedicated thinking blocks')
    assert.ok(agent.includes('function renderThinkingBlock'), 'renders thinking block component')
    assert.ok(html.includes('.agent-thinking-json'), 'thinking block styles exist')
    assert.ok(html.includes('.agent-thinking-badge'), 'thinking card badge style')
  })

  it('shows run-scoped stages and tool execution timeline', () => {
    assert.ok(agent.includes('onAiStreamEvent'), 'subscribes to structured stream events')
    assert.ok(agent.includes('event.runId !== runId'), 'ignores events from other runs')
    assert.ok(agent.includes('function upsertAssistantTrace'), 'updates stable trace rows')
    assert.ok(agent.includes('function renderExecutionTimeline'), 'renders execution timeline')
    assert.ok(agent.includes("event.type === 'tool.started'"), 'handles tool start')
    assert.ok(agent.includes("event.type === 'tool.completed'"), 'handles tool completion')
    assert.ok(agent.includes("event.type === 'tool.failed'"), 'handles tool failure')
    assert.ok(html.includes('.agent-execution'), 'execution timeline styles')
    assert.ok(html.includes('.agent-trace-pulse'), 'running step indicator')
    assert.ok(agent.includes('执行进度'), 'uses a stable summary instead of duplicating the active step')
    assert.ok(!agent.includes('statusLabel ='), 'does not duplicate status with technical pills')
    assert.ok(html.includes('.agent-execution-meta'), 'separates elapsed time from current activity')
    assert.ok(html.includes('.agent-trace-row.pending'), 'visually focuses the active step')
    assert.ok(agent.includes('formatElapsed'), 'shows elapsed thinking time')
    assert.ok(html.includes('border-left:1px solid #e1ddd7'), 'draws a quiet continuous step rail')
    assert.ok(!html.includes('max-height:238px'), 'avoids a nested timeline scrollbar')
    assert.ok(agent.includes("sources.length ? `查看 ${sources.length} 条资料` : '查看结果'"), 'labels collapsed tool results')
    assert.ok(agent.includes('const keepExpanded = pending || m.streaming'), 'collapses the timeline after completion')
    assert.ok(!agent.includes("status !== 'error' || sources.length > 0"), 'does not auto-expand raw tool output')
    assert.ok(html.includes('.agent-trace-result-label'), 'styles the on-demand result affordance')
    assert.ok(agent.includes('function renderAssistantEmptyResultFallback'), 'adds fallback copy when result body is empty')
    assert.ok(agent.includes('处理已完成，但这次没有返回可展示正文'), 'avoids blank assistant bubbles after trace-only completion')
    assert.ok(html.includes('prefers-reduced-motion:reduce'), 'respects reduced motion')
  })

  it('removes composer helper row and keeps meta updates optional', () => {
    assert.ok(!html.includes('id="agentComposerMeta"'), 'composer helper row removed')
    assert.ok(agent.includes('if (!aiComposerMeta || !aiInput) return'), 'composer meta updates are safely guarded')
  })

  it('aligns workbench composer styling and task completion copy', () => {
    assert.ok(html.includes('border:1px solid rgba(0,0,0,0.10)'), 'composer has the shared input border baseline')
    assert.ok(html.includes('box-shadow:0 0 0 3px rgba(61,58,54,0.07)'), 'composer has the shared focus baseline')
    assert.ok(agent.includes("补充任务要求或材料；进度与审批请看右侧流程… @ 选文件"), 'workbench keeps task-specific placeholder')
    assert.ok(agent.includes('function workbenchTaskDone()'), 'workbench task completion state is explicit')
    assert.ok(agent.includes('任务已完成 · 可继续补充问题或开始新任务'), 'completed task uses task-specific helper copy')
    assert.ok(!html.includes(':has(#wbRunner:not([hidden])) .agent-col'), 'runner state must not reopen chat on the workbench home')
  })

  it('renders structured choices via reusable component', () => {
    assert.ok(html.includes('lib/structured-choice.js'), 'loads structured choice component script')
    assert.ok(agent.includes('window.StructuredChoice.render'), 'delegates rendering to structured choice component')
    assert.ok(agent.includes('window.StructuredChoice.parseSelectionButton'), 'delegates click parsing to component')
    assert.ok(agent.includes('function isWorkflowReturnChoice'), 'guards mismatched workflow return suggestions')
    assert.ok(agent.includes("toastFn('请在右侧流程面板继续操作')"), 'workflow return guard keeps user on task panel')
  })

  it('renders the feishu auth action as an inline button that resumes the ask', () => {
    assert.ok(agent.includes('knowme:\\/\\/feishu\\/auth'), 'consumes the knowme auth marker')
    assert.ok(agent.includes('data-feishu-auth-cta'), 'renders a clickable auth button')
    assert.ok(agent.includes('connectorsFeishuAuthStart'), 'starts auth from chat')
    assert.ok(agent.includes('feishu-auth-qr'), 'shows the auth QR inline')
    assert.ok(agent.includes('function waitForFeishuAuth'), 'polls connector status')
    assert.ok(agent.includes('sourcePrompt'), 'stores raw ask for auth resume')
    assert.ok(agent.includes('const sourcePrompt = String(item.sourcePrompt || \'\').trim()'), 'resume prefers raw ask')
    assert.ok(agent.includes('runAI({ promptText: pendingPrompt })'), 'resumes the original ask')
    assert.ok(html.includes('.feishu-auth-cta'), 'styles the auth button')
  })

  it('coalesces stream paints and holds incomplete tables in plain tail', () => {
    assert.ok(agent.includes('function splitStreamingMarkdown'), 'streaming split helper')
    assert.ok(agent.includes('requestAnimationFrame'), 'raf coalesce')
    assert.ok(agent.includes('scrollChatToBottomIfNeeded'), 'conditional scroll')
    assert.ok(agent.includes('md-stream-tail'), 'plain stream tail')
    assert.ok(html.includes('contain:layout style') || html.includes('contain: layout style'), 'streaming contain')
    assert.ok(html.includes('table-layout:fixed') || html.includes('table-layout: fixed'), 'fixed table during stream')
  })

  it('builds priorHistory before calling aiGenerate', () => {
    assert.ok(agent.includes('const priorHistory = chatHistory.slice(0, -2)'), 'defines priorHistory')
    assert.ok(agent.includes('history: priorHistory'), 'passes priorHistory to aiGenerate')
  })

  it('gates apply-to-file behind a menu; replace requires editor_patch auth', () => {
    assert.ok(agent.includes('data-act="apply-menu"'), 'apply submenu trigger')
    assert.ok(agent.includes('应用到文件'), 'apply menu label')
    assert.ok(agent.includes('function proposeReplace'), 'replace proposes artifact')
    assert.ok(agent.includes("type: 'editor_patch'"), 'editor_patch artifact')
    assert.ok(agent.includes('function applyLowRisk'), 'insert/append one-click')
    assert.ok(agent.includes('agentApplyLog'), 'records apply trail')
    assert.ok(agent.includes("role: 'system-note'"), 'system-note trail')
    assert.ok(agent.includes('允许写入'), 'patch accept label')
    assert.ok(agent.includes('res.editorPatch'), 'accept applies editor patch')
    assert.ok(!/\ndata-act="replace"[^>]*>替换正文/.test(agent), 'no flat replace primary')
  })

  it('routes artifacts to work surface review', () => {
    assert.ok(agent.includes('在右侧预览'), 'summary open action')
    assert.ok(agent.includes('syncWorkSurface'), 'syncs work surface')
    assert.ok(agent.includes("data-art-act=\"open\""), 'open art act')
    assert.ok(agent.includes('workSurface'), 'workSurface host wiring')
    assert.ok(workspace.includes('写入当前编辑器'), 'review surface exposes editor write action')
    assert.ok(workspace.includes('生成飞书文档草稿'), 'review surface exposes feishu draft action')
    assert.ok(agent.includes('connectorsCreateDocDraft'), 'review action can create pending Feishu drafts')
  })

  it('gates task cards behind a deterministic preflight that asks one line when content is missing', () => {
    // 配置与反查表
    assert.ok(agent.includes('const TASK_PREFLIGHT'), 'defines task preflight config')
    assert.ok(agent.includes('const PROMPT_TO_TASK'), 'defines prompt->task reverse map')
    // 三类必需内容
    assert.ok(agent.includes("need: 'feishuAuth'"), 'feishu tasks require authorization')
    assert.ok(agent.includes("need: 'material'"), 'writing/coding tasks require material')
    // 判定与询问/执行入口
    assert.ok(agent.includes('function shortcutHasMaterial'), 'material check helper')
    assert.ok(agent.includes('async function taskContextReady'), 'deterministic readiness check')
    assert.ok(agent.includes('function askForTaskContent'), 'one-line ask helper')
    assert.ok(agent.includes('async function runTaskCard'), 'unified card entry with preflight')
    // 缺内容时不调用 LLM：只推 system-note + 聚焦输入框
    assert.ok(/askForTaskContent[\s\S]*chatHistory\.push\(\{ role: 'system-note'/.test(agent), 'ask pushes a system-note without calling the model')
    // 暂存 + 补齐素材后自动续跑
    assert.ok(agent.includes('let pendingShortcut'), 'stores pending shortcut when material missing')
    assert.ok(agent.includes('promptText = pendingShortcut.prompt'), 'runAI resumes the pending task after material is provided')
    // 空态卡片与快捷菜单统一走 runTaskCard
    assert.ok(agent.includes('runTaskCard(shortcutId'), 'empty-state cards route through runTaskCard')
    assert.ok(agent.includes('const taskId = PROMPT_TO_TASK.get(prompt)'), 'quick menu reuses the same preflight')
    // 知识管家 remote-rag 缺主题一句话询问
    assert.ok(agent.includes('请用一句话告诉我要在远程知识库里检索什么主题'), 'remote-rag asks for a query when composer is empty')
    // 回归：卡片确定性发送必须直接走 runAI，避免执行策略里的【…】被 send→fill 改判成"请补充内容后发送"
    assert.ok(/async function runOfficeShortcut[\s\S]*?await runAI\(\{ promptText: text, displayPrompt \}\)/.test(agent), 'office shortcut sends via runAI, not the suggestion dispatcher')
    assert.ok(/async function runQuickStarter[\s\S]*?await runAI\(\{ promptText: text, displayPrompt \}\)/.test(agent), 'quick starter sends via runAI directly')
  })

  it('rewrites meeting candidate selection through FeishuMeetingSelection', () => {
    assert.ok(html.includes('feishu-meeting-selection.js'), 'selection helper script')
    assert.ok(agent.includes('FeishuMeetingSelection'), 'uses shared selection rewriter')
    assert.ok(agent.includes('简要分析'), 'meeting summary prompt asks for brief analysis')
    assert.ok(agent.includes('feishu.meeting_read'), 'second stage uses meeting_read')
    assert.ok(agent.includes('feishu-meeting-card'), 'renders one complete meeting card')
    assert.ok(agent.includes('feishu-link-meta'), 'renders meeting time and organizer inside card')
  })

  it('adapts composer and followups for all four assistant modes', () => {
    assert.ok(agent.includes('MODE_INPUT_EXPERIENCE'), 'mode-specific composer copy is defined')
    assert.ok(agent.includes("general: {"), 'general mode config exists')
    assert.ok(agent.includes("steward: {"), 'steward mode config exists')
    assert.ok(agent.includes("writing: {"), 'writing mode config exists')
    assert.ok(agent.includes("coding: {"), 'coding mode config exists')
    assert.ok(agent.includes('MODE_FOLLOWUP_PRESETS'), 'mode-specific followups are defined')
    assert.ok(agent.includes('renderModeFollowups'), 'renders contextual followup actions')
    assert.ok(agent.includes('data-followup-prompt'), 'followup actions are clickable')
    assert.ok(agent.includes("action: 'send'"), 'followup uses direct send semantics')
    assert.ok(agent.includes('dispatchAgentAction'), 'followup routes through dispatcher')
    assert.ok(html.includes('.agent-followups'), 'followup container styles exist')
    assert.ok(html.includes('.agent-followup-btn'), 'followup button styles exist')
  })

  it('adds low-distraction companion presence states with a local opt-out', () => {
    assert.ok(html.includes('lib/agent-presence.js'), 'presence controller is loaded')
    assert.ok(html.includes('data-presence-state="thinking"'), 'thinking presence style')
    assert.ok(html.includes('km-fab-presence-idle'), 'idle presence animation')
    assert.ok(html.includes('prefers-reduced-motion'), 'presence respects reduced motion')
    assert.ok(agent.includes('classifyPresenceInput'), 'input signal classification')
    assert.ok(agent.includes('setPresenceState(\'thinking\')'), 'run starts thinking presence')
    assert.ok(agent.includes('setPresenceState(\'success\')'), 'successful run presence')
    assert.ok(agent.includes('setPresenceState(\'error\')'), 'failed run presence')
    assert.ok(agent.includes('data-more="toggle-presence"'), 'presence toggle in more menu')
    assert.ok(agent.includes('已开启动作表现'), 'presence toggle feedback')
  })
})

