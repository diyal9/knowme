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
    assert.ok(html.includes('class="agent-tab-scroll"'), 'session tab scroll container')
    assert.match(html, /\.agent-tab-scroll\s*\{[^}]*scrollbar-width:none;/, 'hides visible tab scrollbar')
    assert.ok(html.includes('.agent-tab-scroll::-webkit-scrollbar { display:none; }'), 'hides webkit tab scrollbar')
    assert.ok(!html.includes('scrollbar-width:thin;\n}\n.agent-session-tabs'), 'does not keep thin tab scrollbar')
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
    assert.ok(!html.includes('开始一个新任务'), 'launch state omits the redundant hero heading')
    assert.ok(html.includes('把你的问题或任务交给 KnowMe'), 'launch-state product guidance')
    assert.ok(!html.includes('agent-launch-mark'), 'launch title omits the decorative assistant icon')
    assert.ok(html.includes('data-agent-composer-mount'), 'launch state reserves the real Composer mount')
    assert.ok(html.includes('开始使用'), 'launch state labels the shortcut section')
    assert.match(html, /\.agent-launch-intro\s*\{[^}]*align-items:center;[^}]*text-align:center;/, 'launch intro is centered')
    assert.doesNotMatch(
      html,
      /\.agent-home-composer-mount \.agent-go#agentSend\s*\{/,
      'launch state reuses the conversation send-button styling'
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
    assert.ok(html.includes('懂你的专家搭档'), 'brand empty slogan')
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
      'assistant message shell keeps the shared reading track'
    )
    assert.match(
      html,
      /\.agent-bubble\.user\s*\{[^}]*width:fit-content;[^}]*max-width:min\(76%, 720px\);[^}]*align-self:flex-end;/,
      'user messages shrink to content and align right'
    )
    assert.match(
      html,
      /\.agent-bubble\.assistant\s*\{[^}]*background:transparent;[^}]*border:1px solid transparent;/,
      'assistant replies use the quiet left reading surface'
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
    assert.match(html, /\.agent-chat-log\s*\{[^}]*padding:20px 16px 10px;/, 'chat log keeps a compact bottom inset')
    assert.match(html, /\.agent-col-foot\s*\{[^}]*padding:6px 16px 14px;/, 'footer separates the Composer from the final response')
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

  it('keeps four home recommendations and separates workflow intake', () => {
    assert.ok(agent.includes('partitionPackHomeCards(cards, 4)'), 'Pack home uses a bounded partition')
    assert.ok(agent.includes('home.recommendations') && agent.includes('.map(card => renderEmptyActionCard'), 'only recommended cards enter the grid')
    assert.ok(agent.includes('class="agent-empty-act agent-workflow-entry"'), 'workflow intake has a separate entry')
    assert.ok(agent.includes('<small>启动工作流</small>'), 'workflow entry communicates its execution level')
    assert.ok(agent.includes('cards.slice(0, 4).map'), 'generic modes also cap recommendation cards')
    assert.ok(html.includes('.agent-workflow-entry {'), 'workflow entry has dedicated styling')
  })

  it('moves one real Composer between launch and conversation states', () => {
    assert.ok(agent.includes('function dockComposerAfterChat()'), 'conversation dock helper exists')
    assert.ok(agent.includes('function mountComposerInLaunchState()'), 'launch mount helper exists')
    assert.ok(agent.includes("chatLog.querySelector('[data-agent-composer-mount]')"), 'launch state finds its Composer mount')
    assert.ok(agent.includes("chatLog.insertAdjacentElement('afterend', agentFoot)"), 'Composer is rescued before chat HTML replacement')
    assert.ok(agent.includes("agentCol.classList.add('agent-launch-state')"), 'empty Session exposes launch layout state')
    assert.ok(agent.includes("agentCol.classList.remove('agent-launch-state')"), 'conversation Session clears launch layout state')
    assert.match(
      agent,
      /agentCol\.classList\.remove\('agent-launch-state'\)[\s\S]{0,300}?resizeAiInput\(\)/,
      'conversation docking remeasures textarea after leaving the larger launch state'
    )
    assert.equal((html.match(/id="agentComposer"/g) || []).length, 1, 'only one Composer exists')
    assert.equal((html.match(/id="agentInput"/g) || []).length, 1, 'only one Agent textarea exists')
  })

  it('offers explainable continuation without composer work-hint chips', () => {
    assert.ok(agent.includes('async function resumeSession(sessionId)'), 'workbench/agent resume remains outside the fab')
    // 通知 FAB：零 resumeSession；只做通知与快捷处理
    const fabScript = html.match(/\(function initKnowMeFab\(\) \{[\s\S]*?\}\)\(\)/)?.[0] || ''
    assert.ok(fabScript, 'notification fab bootstrap exists')
    assert.ok(!/resumeSession|agentSessionList|km-fab-resume|data-fab-resume|继续工作/.test(fabScript), 'fab script has no session-resume capability')
    assert.ok(!html.includes('id="km-fab-resume"'), 'notification fab does not host session resume card')
    assert.ok(!html.includes('data-fab-resume'), 'notification fab has no session resume CTA')
    assert.ok(!html.includes('继续工作'), 'notification fab does not show continue-work copy')
    assert.ok(html.includes('aria-label="通知"'), 'fab panel is labeled as notifications')
    assert.ok(html.includes('提醒与快捷入口'), 'fab copy stays notification + quick-action scoped')
    assert.match(html, /#km-fab-root\s*\{[^}]*right:\s*6px;[^}]*bottom:\s*6px;/, 'fab defaults to a tight bottom-right corner')
    // 产品尚未定清「意图推荐 / 记忆开关」之前，输入框上方不展示记忆勾选条
    assert.ok(!agent.includes('agent-work-hints'), 'composer work-hint bar is parked')
    assert.ok(!agent.includes('本轮带上'), 'per-turn context chips are not shown')
    assert.ok(!agent.includes('已填入基于记忆的下一步'), 'memory fill-into-composer is gone')
    // 静默个性化：回复旁可解释，不恢复勾选条
    assert.ok(agent.includes('function renderPersonalizationMeta'), 'personalization explain row helper exists')
    assert.ok(agent.includes('本轮沿用了'), 'assistant bubble can explain applied habits')
    assert.ok(agent.includes('effectivePersonalization?.promptBlock'), 'shortcuts reuse effective personalization')
    assert.ok(html.includes('.agent-personalization'), 'personalization styles are present')
    assert.ok(!agent.includes('renderResumeCard()'), 'empty state does not render a resume card')
  })

  it('uses industry placeholder examples when Feishu facts are empty', () => {
    assert.ok(agent.includes('允许给出最多 3 条**行业占位示例**'), 'empty priority facts allow industry placeholders')
    assert.ok(agent.includes('禁止把示例写成推荐任务'), 'placeholders must not become recommendations')
    assert.ok(agent.includes('禁止输出“选一项”列表、按钮选项'), 'empty priority facts forbid suggestion choices')
    assert.ok(agent.includes('function hasEmptyTodayPriorityFacts'), 'empty priority facts have a deterministic UI guard')
    assert.ok(agent.includes('emptyTodayPriorityBody()'), 'empty priority facts use deterministic industry body')
    assert.ok(agent.includes('const bar = emptyTodayPriority ? null : (presetBar || parsed.bar)'), 'empty priority facts hide generated choices')
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

  it('shows quick actions as a searchable command panel without covering content', () => {
    assert.ok(html.includes('.agent-quick-menu {'), 'quick actions use a dedicated panel')
    assert.ok(html.includes('id="agentQuickSearch"'), 'launcher has a dedicated search input')
    assert.ok(html.includes('placeholder="搜索任务、技能或结果…"'), 'search copy is task-oriented')
    assert.ok(html.includes('id="agentQuickItems"'), 'launcher has a dynamic result host')
    assert.ok(html.includes('id="agentQuickEmpty"'), 'launcher has an explicit empty result state')
    assert.ok(!html.includes('id="agentQuickCats"'), 'launcher no longer exposes category navigation')
    assert.ok(!html.includes('快捷大类') && !html.includes('快捷子项'), 'internal category copy is removed')
    assert.ok(html.includes('.agent-command-item {'), 'results use command rows')
    assert.ok(html.includes('max-height:0') && html.includes('.agent-quick-menu.show'), 'panel expands in document flow')
    assert.ok(html.includes('max-height:min(420px, 56vh)'), 'open panel stays bounded across result counts')
    assert.ok(html.includes('background:var(--bg-card)') && html.includes('box-shadow:0 10px 30px'), 'panel has visual separation')
    assert.ok(html.includes('prefers-reduced-motion: reduce'), 'panel respects reduced motion')
    assert.ok(agent.includes('setQuickMenuOpen'), 'trigger synchronizes expanded state')
    assert.ok(agent.includes('const QUICK_MENU_PROFILES = {'), 'quick menu profiles are role-aware')
    assert.ok(agent.includes('renderQuickMenuForAgent(activeAgentId)'), 'quick menu re-renders by active assistant')
    assert.ok(agent.includes('filterQuickCommands'), 'quick menu filters task records')
    assert.ok(agent.includes('data-steward'), 'quick actions support steward-only workflows')
    assert.ok(agent.includes('function handleQuickMenuKeydown'), 'quick menu has dedicated keyboard handler')
    assert.ok(agent.includes("e.key === 'ArrowDown'"), 'down arrow moves through filtered results')
    assert.ok(agent.includes("e.key === 'ArrowUp'"), 'up arrow moves through filtered results')
    assert.ok(agent.includes('requestAnimationFrame(() => quickSearchInput?.focus())'), 'launcher focuses search without changing the draft')
    assert.ok(agent.includes('quickSearchInput?.addEventListener(\'input\''), 'search updates results immediately')
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
    assert.ok(html.includes('--agent-reading-track: min(780px, 100%)'), 'ordinary answers use a narrower reading track')
    assert.ok(html.includes('max-width:var(--agent-message-track)'), 'message width inherits shared track')
    assert.match(
      html,
      /\.agent-bubble\.assistant:not\(\.related-chats-result\) > \.agent-response-body,[\s\S]*?width:var\(--agent-reading-track\);/,
      'ordinary assistant body is constrained without narrowing specialized results'
    )
    assert.match(html, /\.agent-md p\s*\{\s*margin:0 0 0\.72em;/, 'paragraphs use a calmer vertical rhythm')
    assert.match(html, /\.agent-md hr\s*\{[^}]*background:rgba\(61,58,54,\.1\);/, 'markdown dividers stay quiet')
    assert.match(html, /\.agent-suggest\s*\{[^}]*border-radius:12px;[^}]*background:rgba\(61,58,54,\.025\);/, 'choices form a distinct light action region')
    assert.match(
      html,
      /\.agent-suggest-item \.sug-desc\s*\{[^}]*white-space:normal;[^}]*overflow-wrap:anywhere;/,
      'long choice descriptions wrap instead of truncating'
    )
    assert.match(html, /\.agent-composer\s*\{[^}]*min-height:108px;/, 'conversation Composer starts compact')
    assert.match(html, /\.agent-input-wrap textarea\s*\{[^}]*min-height:66px;[^}]*max-height:198px;/, 'conversation textarea can still grow')
    assert.match(html, /\.agent-home-composer-mount \.agent-composer\s*\{[^}]*min-height:148px;/, 'launch Composer keeps its larger task-entry size')
    assert.match(html, /\.agent-home-composer-mount \.agent-input-wrap textarea\s*\{[^}]*min-height:92px;/, 'launch textarea remains spacious')
    assert.ok(html.includes('box-shadow:0 1px 2px'), 'message surface treatment')
    assert.ok(html.includes('padding:20px 16px 10px'), 'conversation uses a compact bottom inset')
  })

  it('uses Cursor-style multi session tabs with independent transcripts', () => {
    assert.ok(agent.includes('agentSessionList'), 'loads persisted sessions')
    assert.ok(agent.includes('agentSessionNew'), 'creates a new Agent session')
    assert.ok(agent.includes('agentSessionFork'), 'fork continues in new Agent')
    assert.ok(agent.includes('agentSessionCloseTab'), 'closes tab without deleting')
    assert.ok(agent.includes('sessionId: runSessionId || activeSession?.id'), 'sends session id')
    assert.ok(agent.includes('openSessionIds'), 'tracks open tabs')
    assert.ok(agent.includes('createNewAgent'), 'New Agent action')
    assert.ok(agent.includes('contextmenu'), 'tab right-click menu')
    assert.ok(agent.includes("addEventListener('wheel'"), 'wheel pans overflowing session tabs')
    assert.ok(agent.includes('sessionTabScrollEl.scrollLeft'), 'wheel updates tab strip scrollLeft')
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

  it('starts a dedicated expert session with identity and degraded capability guidance', () => {
    assert.ok(agent.includes('async function startExpertChat(expertIdOrOptions)'), 'public expert start path accepts task context')
    assert.ok(agent.includes('const created = await createNewAgent({'), 'reuses the durable session creator')
    assert.ok(agent.includes('knowledgeRefs,') && agent.includes('taskRef: options.taskRef || null'), 'session creator receives scoped task context')
    assert.ok(agent.includes('activeSession.expertName'), 'expert identity labels the session')
    assert.ok(agent.includes('function renderExpertEmptyState'), 'expert welcome surface')
    assert.ok(agent.includes('renderLaunchIntroHtml(expert.name,'), 'expert identity is visible in launch metadata')
    assert.ok(agent.includes('data-expert-config'), 'limited connector has a configuration action')
    assert.ok(agent.includes("window.openCapabilityHub('connectors')"), 'configuration action opens connectors')
    assert.ok(html.includes('.agent-expert-capability.limited'), 'limited dependency state is styled')
  })

  it('leads the expert welcome surface with the agent identity', () => {
    assert.ok(agent.includes('function renderExpertIdentityHtml(expert)'), 'identity block exists')
    assert.ok(agent.includes('${renderExpertIdentityHtml(expert)}'), 'identity renders before the composer')
    assert.ok(agent.includes('window.AgentIdentity'), 'shares icon semantics with the workbench card')
    assert.ok(agent.includes('identityAvatarSrc'), 'prefers packaged preset photos when resolvable')
    assert.ok(agent.includes('function agentAvatarMarkHtml'), 'session tabs and pops share avatar marks')
    assert.ok(agent.includes('function agentMarkPayload'), 'builtin modes map onto preset keys')
    
    assert.ok(agent.includes('agent-expert-identity-photo'), 'identity mark can render an img')
    assert.ok(agent.includes('agent-expert-identity-badge'), 'source badge tells which shelf the agent came from')
    assert.ok(agent.includes('告诉「${expert.name}」你的目标…'), 'composer placeholder names the active agent')
    assert.ok(!agent.includes("avatar || '🧩'"), 'no emoji avatar is rendered')
    assert.ok(html.includes('.agent-expert-identity-mark'), 'identity block is styled')
    assert.ok(html.includes('.agent-expert-identity-photo'), 'photo crop styles exist')
    assert.ok(html.includes('lib/agent-identity.js'), 'identity module is loaded in the workspace')
  })

  it('lets a degraded expert start talking instead of blocking the entry', () => {
    // 渲染层缓存加载失败会被静默置空，拿它当准入判据会造成「卡片看得见、点了没反应」
    assert.ok(!agent.includes("return { ok: false, error: '专家不存在或尚未安装' }"), 'renderer cache no longer vetoes start')
    assert.ok(agent.includes("catalogExperts.find(item => String(item.id || '') === id) || null"), 'catalog is display-only')
    assert.ok(agent.includes('surfaceMode = previousSurface'), 'failed start does not leave a half-switched surface')
    assert.ok(agent.includes('notified: true'), 'failure is reported once')
    assert.ok(agent.includes('仍可直接对话'), 'degraded dependencies explicitly permit conversation')
    assert.ok(html.includes('.agent-expert-degraded'), 'degraded note is styled')
  })

  it('keeps Agent and workbench tab collections separate', () => {
    assert.ok(agent.includes('knowme.agent.surfaceUi.v2'), 'persists per-surface tab state')
    assert.ok(agent.includes('openIds: [...new Set(openSessionIds)]'), 'stores each surface open tabs')
    assert.ok(agent.includes('surfaceUi[surfaceMode]'), 'updates only the active surface')
    assert.ok(agent.includes('function paintSurfaceTabs'), 'sync paints target surface tabs')
    assert.ok(agent.includes('openSessionIds = (state.openIds || []).filter'), 'restores only target surface tabs')
    assert.ok(agent.includes('if (sessionsLoaded && switched) paintSurfaceTabs(surfaceMode)'), 'paints tabs before async activate')
    assert.ok(agent.includes('updateCurrentSurfaceUi(activeSession.id)'), 'new tabs remain on current surface')
    assert.ok(agent.includes('function isWorkbenchOwnedSession'), 'classifies workbench-owned sessions')
    assert.ok(agent.includes('relocateWorkbenchSessionsFromAgentSurface'), 'migrates polluted assistant tabs')
    assert.ok(agent.includes("options.surface === 'workbench'"), 'expert chat can target workbench surface')
    assert.ok(agent.includes('if (sessionsLoaded && switched) return activateSurfaceSession(surfaceMode)'), 'both surfaces restore their own tabs')
    assert.ok(/\/\^工作台\\s\*\[·\\-—–\]/.test(agent), 'recognizes hyphenated workbench title variants')
    assert.ok(agent.includes("surfaceMode === 'agent') setDaemonProcessFeed(null)"), 'clears daemon process feed when entering assistant')
    assert.ok(agent.includes("surfaceMode !== 'workbench' || !transcript"), 'never paints process feed off workbench surface')
    assert.ok(agent.includes("surfaceMode !== 'workbench' || !daemonProcessCache"), 'restore skips process feed off workbench')
  })

  it('preserves inflight assistant chat across surface switches', () => {
    assert.ok(agent.includes('inflightChatBySession'), 'tracks inflight chat histories by session')
    assert.ok(agent.includes('inflightChatBySession.set(runSessionId, chatHistory)'), 'registers history when a run starts')
    assert.ok(agent.includes('inflightChatBySession.delete(runSessionId)'), 'releases inflight history when the run ends')
    assert.ok(agent.includes('const inflightHistory = inflightChatBySession.get(sessionId)'), 'activate prefers inflight history')
    assert.ok(agent.includes('chatHistory = inflightHistory'), 'restores the same array after surface return')
    assert.ok(agent.includes('for (const hist of inflightChatBySession.values())'), 'stream lookup searches inflight histories')
    assert.ok(agent.includes('if (chatHistory[messageIdx] !== message) return true'), 'off-screen stream events skip DOM render')
    assert.ok(agent.includes('const targetSessionId = runSessionId || result.sessionId || activeSession?.id || \'\''), 'completion updates the run session, not the switched activeSession')
    assert.ok(agent.includes('sessionId: runSessionId || activeSession?.id'), 'aiGenerate keeps the originating session id')
  })

  it('shows a thinking indicator before the first stream chunk', () => {
    assert.ok(agent.includes('正在处理'), 'thinking copy')
    assert.ok(agent.includes('streaming thinking'), 'thinking bubble class')
    assert.ok(agent.includes('thinking-dots'), 'thinking animation markup')
    assert.ok(html.includes('@keyframes thinking-bounce'), 'thinking animation css')
    assert.ok(html.includes('.agent-bubble.thinking'), 'thinking bubble style')
  })

  it('strips thinking protocol from legacy hydration without rendering cards', () => {
    assert.ok(agent.includes('stripDisplayProtocolText'), 'uses shared strip helper for legacy hydration')
    assert.ok(!agent.includes('function renderThinkingBlock'), 'thinking json cards removed')
    assert.ok(!agent.includes('agent-thinking-json'), 'thinking card markup removed')
  })

  it('shows run-scoped stages and tool execution timeline', () => {
    assert.ok(agent.includes('onAiStreamEvent'), 'subscribes to structured stream events')
    assert.ok(agent.includes('event.runId !== runId'), 'ignores events from other runs')
    assert.ok(agent.includes('function applyV2StreamEvent'), 'handles v2 output events via reducer')
    assert.ok(agent.includes('function upsertAssistantTrace'), 'updates stable trace rows')
    assert.ok(agent.includes('function renderExecutionTimeline'), 'renders execution timeline')
    assert.ok(agent.includes("type === 'tool.started'"), 'handles tool start via v2 reducer path')
    assert.ok(agent.includes("type === 'tool.completed'"), 'handles tool completion via v2 reducer path')
    assert.ok(agent.includes("type === 'tool.failed'"), 'handles tool failure via v2 reducer path')
    assert.ok(html.includes('.agent-execution'), 'execution timeline styles')
    assert.ok(html.includes('.agent-trace-pulse'), 'running step indicator')
    assert.ok(agent.includes('执行进度'), 'uses a stable summary instead of duplicating the active step')
    assert.ok(!agent.includes('statusLabel ='), 'does not duplicate status with technical pills')
    assert.ok(html.includes('.agent-execution-meta'), 'separates elapsed time from current activity')
    assert.ok(html.includes('.agent-trace-row.pending'), 'visually focuses the active step')
    assert.ok(agent.includes('formatElapsed'), 'shows elapsed thinking time')
    assert.ok(html.includes('border-left:1px solid rgba(129,123,115,.22)'), 'draws a quiet continuous step rail')
    assert.ok(agent.includes('const timelineHtml = renderExecutionTimeline(m)'), 'renders the waiting timeline once')
    assert.ok(agent.includes('const hasExecution = Boolean(timelineHtml)'), 'uses the actual execution surface as the status source of truth')
    assert.ok(agent.includes("bubble.querySelector('[data-thinking-status]')?.remove()"), 'removes the standalone waiting status when the first timeline arrives')
    assert.ok(agent.includes('class="agent-trace-meta"'), 'groups result actions and step timing into one metadata region')
    assert.ok(html.includes('.agent-trace-meta'), 'aligns secondary step metadata consistently')
    assert.ok(html.includes('.agent-execution-summary:focus-visible'), 'keeps the execution disclosure keyboard visible')
    assert.ok(html.includes('.agent-trace-row summary:focus-visible'), 'keeps result disclosures keyboard visible')
    assert.ok(html.includes('@media (max-width:720px)'), 'stacks step metadata safely on narrow windows')
    assert.ok(!html.includes('max-height:238px'), 'avoids a nested timeline scrollbar')
    assert.ok(agent.includes("sources.length ? `查看 ${sources.length} 条资料` : '查看结果'"), 'labels collapsed tool results')
    assert.ok(agent.includes('const keepExpanded = running || pendingReview'), 'collapses completed timelines unless approval is pending')
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
    assert.ok(agent.includes('可先问助手要补充什么；准备好答案后点卡片「提交澄清」'), 'unclear clarification routes ask to assistant')
    assert.ok(agent.includes('shouldAutoSubmitDaemonClarification'), 'clarification auto-submit is gated')
    assert.ok(agent.includes('data-daemon-hitl-clarify-submit'), 'explicit submit clarification button')
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

  it('coalesces stream paints and buffers incomplete content outside visible DOM', () => {
    assert.ok(agent.includes('function splitStreamingMarkdown'), 'streaming split helper')
    assert.ok(agent.includes('requestAnimationFrame'), 'raf coalesce')
    assert.ok(agent.includes('scrollChatToBottomIfNeeded'), 'conditional scroll')
    assert.ok(agent.includes('md-stream-pending'), 'fixed pending state is visible')
    assert.ok(!agent.includes('md-stream-tail'), 'raw tail is never rendered')
    assert.ok(!agent.includes('escHtml(tail)'), 'raw model tail does not enter html')
    assert.ok(html.includes('agent-stream-visibility.js'), 'visibility boundary loads before renderer')
    assert.ok(html.includes('contain:layout style') || html.includes('contain: layout style'), 'streaming contain')
    assert.ok(html.includes('table-layout:fixed') || html.includes('table-layout: fixed'), 'fixed table during stream')
  })

  it('builds priorHistory before calling aiGenerate', () => {
    assert.ok(agent.includes('const priorHistory = ((runSessionId && inflightChatBySession.get(runSessionId)) || chatHistory)'), 'defines priorHistory from inflight or current chat')
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
    assert.ok(agent.includes('PROMPT_TO_TASK.get(prompt)'), 'quick menu reuses prompt->task preflight map')
    assert.ok(agent.includes('data-task-id'), 'quick menu exposes dynamic task identity')
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

  it('hosts task attention notifications without session resume', () => {
    const workbench = fs.readFileSync(path.join(__dirname, '..', 'src', 'workbench.js'), 'utf8')
    assert.ok(html.includes('id="km-fab-notify"'), 'fab hosts attention list')
    assert.ok(html.includes('knowme-needs-attention'), 'fab listens for attention events')
    assert.ok(html.includes('needs-attention'), 'fab has attention pulse class hook')
    assert.ok(html.includes('km-fab-attention-pulse'), 'intermittent bell animation exists')
    assert.ok(!html.includes('id="km-fab-resume"'), 'session resume card stays removed')
    assert.ok(workbench.includes('publishTaskAttention'), 'workbench publishes attention events')
    assert.ok(workbench.includes('attentionNotify'), 'workbench routes background attention to desktop')
  })

  it('uses an outlined bell for the floating assistant trigger', () => {
    const fabButton = html.match(/<button[^>]*id="km-fab-btn"[\s\S]*?<\/button>/)?.[0] || ''
    const panelAvatar = html.match(/<span class="km-fab-avatar"[\s\S]*?<\/span>/)?.[0] || ''

    assert.ok(fabButton, 'floating assistant trigger exists')
    assert.ok(fabButton.includes('class="km-fab-bell"'), 'trigger uses a dedicated bell glyph')
    assert.ok(fabButton.includes('viewBox="0 0 24 24"'), 'bell uses the compact 24px viewBox')
    assert.ok(!fabButton.includes('km-fab-mark-'), 'trigger no longer uses the connected brand mark')
    assert.ok(panelAvatar.includes('km-fab-mark-line'), 'assistant panel keeps the KnowMe brand mark')
    assert.ok(!html.includes('km-fab-mark-node-center'), 'legacy center-node mark styles are removed')
    assert.match(
      html,
      /#km-fab-btn \.km-fab-glyph svg\s*\{[^}]*width:\s*19px;[^}]*fill:\s*none;[^}]*stroke:\s*currentColor;[^}]*stroke-width:\s*1\.8;/,
      'bell stays compact and uses a single theme-aware outline',
    )
    assert.equal((html.match(/id="km-fab-badge"/g) || []).length, 1, 'notification badge node is reserved once')
    assert.match(
      html,
      /#km-fab-btn \.km-fab-badge\s*\{[^}]*top:\s*2px;\s*right:\s*2px;\s*left:\s*auto;/,
      'status indicator hugs the bell upper-right edge',
    )
    assert.ok(fabButton.includes('aria-label="通知"'), 'trigger is labeled as notifications')
    assert.ok(fabButton.includes('aria-haspopup="true"'), 'existing popup interaction contract is preserved')
    assert.ok(html.includes('RIGHT_MARGIN = 6'), 'drag placement keeps the tight right margin')
    assert.ok(html.includes("const POS_KEY = 'knowme.fab.pos.v2'"), 'existing drag position storage is preserved')
  })

  it('draws the assistant panel avatar with the application icon geometry', () => {
    const master = fs.readFileSync(
      path.join(__dirname, '..', 'assets', 'brand-src', 'knowme-icon.svg'),
      'utf8',
    )
    const panelAvatar = html.match(/<span class="km-fab-avatar"[\s\S]*?<\/span>/)?.[0] || ''

    const paths = source => (source.match(/\sd="([^"]+)"/g) || [])
      .map(item => item.replace(/\sd="|"$/g, '').replace(/\s+/g, ' ').trim())
      .sort()
    const circles = source => (source.match(/<circle[^>]*>/g) || [])
      .map(item => ['cx', 'cy', 'r'].map(key => item.match(new RegExp(`${key}="([^"]+)"`))?.[1]).join(','))
      .sort()

    assert.deepEqual(paths(panelAvatar), paths(master), 'avatar connection path matches the icon master')
    assert.deepEqual(circles(panelAvatar), circles(master), 'avatar node coordinates match the icon master')
    assert.equal(
      (panelAvatar.match(/km-fab-mark-origin/g) || []).length,
      1,
      'exactly one node carries the coral memory origin',
    )
    assert.ok(
      panelAvatar.includes('cx="173" cy="190"') && panelAvatar.includes('class="km-fab-mark-origin"'),
      'the coral origin sits at the path origin rather than the path center',
    )
    assert.match(html, /\.km-fab-mark-origin \{ fill: #f05d4e; \}/, 'origin node uses the brand coral')
    assert.match(
      html,
      /#km-fab-panel \.km-fab-avatar \{[^}]*background: #172535;/,
      'avatar carrier uses the brand navy',
    )
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

