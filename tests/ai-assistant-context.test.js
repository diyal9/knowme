/**
 * ai-assistant-context — 分层 system + 多轮 messages
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  assembleCorePrompt,
  capPromptText,
} = require('../src/lib/knowme-system-prompt')
const {
  ASSISTANT_BASE_PROMPT,
  LEGACY_DEFAULT_SYSTEM_PROMPT,
  isLegacyDefaultSystemPrompt,
  resolveUserPrompt,
  buildSystemContent,
  buildChatMessages,
} = require('../src/lib/ai-assistant-context');

describe('ai-assistant-context', () => {
  it('keeps chat-tier core shorter than the full KnowMe base prompt', () => {
    const chat = assembleCorePrompt({ tier: 'chat', toolsEnabled: false })
    const full = assembleCorePrompt({ tier: 'assist', toolsEnabled: true })
    assert.ok(chat.includes('你是用户的智能工作伙伴（KnowMe/知我）'))
    assert.ok(chat.includes('禁止幻觉'))
    assert.ok(!chat.includes('feishu.search_docs'))
    assert.ok(!chat.includes('```suggestion'))
    assert.ok(full.includes('feishu.search_docs'))
    assert.ok(chat.length < full.length)
  })

  it('caps oversized user preferences', () => {
    const long = '偏好'.repeat(300)
    const capped = capPromptText(long, 400)
    assert.ok(capped.length < long.length)
    assert.ok(capped.includes('用户偏好已按预算截断'))
  })

  it('positions the assistant as a work partner instead of a prompt tool', () => {
    assert.ok(ASSISTANT_BASE_PROMPT.includes('你是用户的智能工作伙伴（KnowMe/知我）'));
    assert.ok(ASSISTANT_BASE_PROMPT.includes('不得自称“WorkBuddy”'));
    assert.ok(ASSISTANT_BASE_PROMPT.includes('推动工作真正完成'));
    assert.ok(ASSISTANT_BASE_PROMPT.includes('普通问候、宽泛意图和默认建议中禁止主动推荐提示词'));
    assert.ok(ASSISTANT_BASE_PROMPT.includes('只有用户明确要求生成或优化提示词时才处理该能力'));
    assert.ok(ASSISTANT_BASE_PROMPT.includes('规划任务、分析问题、创作内容、推进工作或检索知识'));
    assert.ok(ASSISTANT_BASE_PROMPT.includes('feishu.search_docs'));
    assert.ok(ASSISTANT_BASE_PROMPT.includes('禁止声称'));
    assert.ok(ASSISTANT_BASE_PROMPT.includes('作者、权限、金额、日期、数量'));
  });

  it('routes external links to fetch_web_page and feishu links to read_doc', () => {
    assert.ok(ASSISTANT_BASE_PROMPT.includes('fetch_web_page'));
    assert.ok(ASSISTANT_BASE_PROMPT.includes('feishu.cn / larksuite.com 链接用 feishu.read_doc'));
    assert.ok(ASSISTANT_BASE_PROMPT.includes('其余外部网页一律用 fetch_web_page 读取'));
    assert.ok(ASSISTANT_BASE_PROMPT.includes('禁止拿外部链接或其片段去调 feishu.search_docs'));
  });

  it('forbids denying web access when a fetch tool exists', () => {
    assert.ok(ASSISTANT_BASE_PROMPT.includes('没有联网能力'));
    assert.ok(ASSISTANT_BASE_PROMPT.includes('手动复制粘贴网页正文'));
    assert.ok(ASSISTANT_BASE_PROMPT.includes('我没有访问外部网页的能力'));
  });

  it('requires autonomous grounded research for current public information', () => {
    assert.ok(ASSISTANT_BASE_PROMPT.includes('search_web'));
    assert.ok(ASSISTANT_BASE_PROMPT.includes('MUST 直接搜索'));
    assert.ok(ASSISTANT_BASE_PROMPT.includes('搜索摘要只是发现线索'));
    assert.ok(ASSISTANT_BASE_PROMPT.includes('区分来源发布时间与本次检索时间'));
    assert.ok(ASSISTANT_BASE_PROMPT.includes('禁止生成只有一个项目'));
    assert.ok(ASSISTANT_BASE_PROMPT.includes('来源选项只能来自本轮明确列出的真实可用工具'));
  });

  it('detects legacy default system prompt fingerprint', () => {
    assert.equal(isLegacyDefaultSystemPrompt(LEGACY_DEFAULT_SYSTEM_PROMPT), true);
    assert.equal(isLegacyDefaultSystemPrompt(ASSISTANT_BASE_PROMPT), true);
    assert.equal(isLegacyDefaultSystemPrompt('我是游戏数值策划'), false);
    assert.equal(isLegacyDefaultSystemPrompt(''), false);
  });

  it('resolves userPrompt from new field', () => {
    const r = resolveUserPrompt({ userPrompt: ' 领域：策划 ', systemPrompt: 'ignored' });
    assert.equal(r.userPrompt, '领域：策划');
    assert.equal(r.migratedFromLegacyDefault, false);
  });

  it('migrates legacy default systemPrompt to empty preference', () => {
    const r = resolveUserPrompt({ systemPrompt: LEGACY_DEFAULT_SYSTEM_PROMPT });
    assert.equal(r.userPrompt, '');
    assert.equal(r.migratedFromLegacyDefault, true);
  });

  it('keeps custom legacy systemPrompt as user preference', () => {
    const r = resolveUserPrompt({ systemPrompt: '专业领域：提示词工程；简洁列表' });
    assert.equal(r.userPrompt, '专业领域：提示词工程；简洁列表');
    assert.equal(r.migratedFromLegacyDefault, false);
  });

  it('builds system without empty user preference block', () => {
    const sys = buildSystemContent({
      userPrompt: '  ',
      dynamicContext: '## 用户知识库摘要\n（空）',
    });
    assert.ok(sys.startsWith(ASSISTANT_BASE_PROMPT));
    assert.ok(!sys.includes('## 用户偏好'));
    assert.ok(sys.includes('用户知识库摘要'));
  });

  it('appends user preference after base', () => {
    const sys = buildSystemContent({
      userPrompt: '语气专业克制',
      dynamicContext: '',
    });
    assert.ok(sys.includes('## 用户偏好\n语气专业克制'));
    const baseIdx = sys.indexOf(ASSISTANT_BASE_PROMPT);
    const prefIdx = sys.indexOf('## 用户偏好');
    assert.ok(baseIdx === 0);
    assert.ok(prefIdx > baseIdx);
  });

  it('assembles scene, user, and skill layers in stable order', () => {
    const sys = buildSystemContent({
      scenePrompt: '场景：工作伙伴',
      userPrompt: '语气专业克制',
      skillPrompt: '技能：会议总结',
    });
    const coreIdx = sys.indexOf(ASSISTANT_BASE_PROMPT);
    const sceneIdx = sys.indexOf('## 场景策略');
    const userIdx = sys.indexOf('## 用户偏好');
    const skillIdx = sys.indexOf('## 技能策略');
    assert.ok(coreIdx === 0);
    assert.ok(coreIdx < sceneIdx);
    assert.ok(sceneIdx < userIdx);
    assert.ok(userIdx < skillIdx);
  });

  it('builds multi-turn messages with note context', () => {
    const messages = buildChatMessages({
      systemContent: 'BASE',
      contextMessage: 'DYN',
      history: [
        { role: 'user', text: '第一问' },
        { role: 'assistant', text: '第一答' },
        { role: 'loading', text: '...' },
      ],
      prompt: '第二问',
      noteContext: '便签正文',
    });
    assert.equal(messages[0].role, 'system');
    assert.equal(messages[0].content, 'BASE');
    assert.equal(messages[1].role, 'system');
    assert.equal(messages[1].content, 'DYN');
    assert.equal(messages[2].role, 'user');
    assert.equal(messages[2].content, '第一问');
    assert.equal(messages[3].role, 'assistant');
    assert.equal(messages[3].content, '第一答');
    assert.equal(messages[4].role, 'user');
    assert.ok(messages[4].content.includes('便签正文'));
    assert.ok(messages[4].content.includes('参考文件正文'));
    assert.ok(messages[4].content.includes('第二问'));
    assert.ok(!messages[4].content.includes('需求：'));
  });

  it('sends plain greeting without demand prefix', () => {
    const messages = buildChatMessages({
      systemContent: 'S',
      history: [],
      prompt: '你好',
      noteContext: null,
    });
    assert.equal(messages[1].role, 'user');
    assert.equal(messages[1].content, '你好');
  });

  it('default maxTurns allows more than 6 turns', () => {
    const history = [];
    for (let i = 0; i < 10; i++) {
      history.push({ role: 'user', text: `u${i}` });
      history.push({ role: 'assistant', text: `a${i}` });
    }
    const messages = buildChatMessages({
      systemContent: 'S',
      history,
      prompt: 'now',
    });
    // system + 20 history (10 turns) + current — default maxTurns=12 keeps all 10
    assert.equal(messages.length, 22);
    assert.equal(messages[1].content, 'u0');
  });

  it('truncates history to maxTurns', () => {
    const history = [];
    for (let i = 0; i < 10; i++) {
      history.push({ role: 'user', text: `u${i}` });
      history.push({ role: 'assistant', text: `a${i}` });
    }
    const messages = buildChatMessages({
      systemContent: 'S',
      history,
      prompt: 'now',
      maxTurns: 2,
    });
    // system + 4 history + current user
    assert.equal(messages.length, 6);
    assert.equal(messages[1].content, 'u8');
    assert.equal(messages[4].content, 'a9');
  });
});
