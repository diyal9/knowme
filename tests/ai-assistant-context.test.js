/**
 * ai-assistant-context — 分层 system + 多轮 messages
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  assembleCorePrompt,
  corePromptBlockIds,
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
    assert.ok(chat.includes('你运行在 KnowMe（知我）中'))
    assert.ok(chat.includes('事实与权限'))
    assert.ok(!chat.includes('feishu.search_docs'))
    assert.ok(!chat.includes('结构化选择'))
    assert.ok(full.includes('feishu.search_docs'))
    assert.ok(chat.length < full.length)
    assert.ok(chat.length <= 1200)
    assert.ok(full.length <= 2200)
  })

  it('caps oversized user preferences', () => {
    const long = '偏好'.repeat(300)
    const capped = capPromptText(long, 400)
    assert.ok(capped.length < long.length)
    assert.ok(capped.includes('用户偏好已按预算截断'))
  })

  it('uses a neutral runtime identity that yields to the active expert', () => {
    assert.ok(ASSISTANT_BASE_PROMPT.includes('你运行在 KnowMe（知我）中'));
    assert.ok(ASSISTANT_BASE_PROMPT.includes('不得用通用“工作伙伴”身份覆盖当前专家'));
    assert.ok(ASSISTANT_BASE_PROMPT.includes('未指定身份时，可作为用户的智能工作伙伴协作'));
    assert.ok(ASSISTANT_BASE_PROMPT.includes('其他场景不要主动推荐提示词能力'));
    assert.ok(ASSISTANT_BASE_PROMPT.includes('feishu.search_docs'));
    assert.ok(ASSISTANT_BASE_PROMPT.includes('不得声称'));
    assert.ok(ASSISTANT_BASE_PROMPT.includes('作者、权限、金额、日期、数量'));
  });

  it('routes external links to fetch_web_page and feishu links to read_doc', () => {
    assert.ok(ASSISTANT_BASE_PROMPT.includes('fetch_web_page'));
    assert.ok(ASSISTANT_BASE_PROMPT.includes('feishu.cn、larksuite.com 链接交给 feishu.read_doc'));
    assert.ok(ASSISTANT_BASE_PROMPT.includes('普通 http/https 链接用 fetch_web_page'));
    assert.ok(ASSISTANT_BASE_PROMPT.includes('不要把外部网页链接拿去搜索飞书'));
  });

  it('forbids denying web access when a fetch tool exists', () => {
    assert.ok(ASSISTANT_BASE_PROMPT.includes('没有联网能力'));
    assert.ok(ASSISTANT_BASE_PROMPT.includes('要求用户手动复制正文'));
    assert.ok(ASSISTANT_BASE_PROMPT.includes('失败后说明实际错误'));
  });

  it('requires autonomous grounded research for current public information', () => {
    assert.ok(ASSISTANT_BASE_PROMPT.includes('search_web'));
    assert.ok(ASSISTANT_BASE_PROMPT.includes('先用 search_web 检索并用 fetch_web_page 读取原文'));
    assert.ok(ASSISTANT_BASE_PROMPT.includes('区分事件时间、发布时间和检索时间'));
    assert.ok(ASSISTANT_BASE_PROMPT.includes('不生成单项选择'));
    assert.ok(ASSISTANT_BASE_PROMPT.includes('选项只能来自本轮真实能力和上下文'));
  });

  it('loads capability protocols progressively', () => {
    assert.deepEqual(corePromptBlockIds({ tier: 'chat', toolsEnabled: false }), [
      'core.runtime', 'core.conversation', 'core.integrity', 'core.output',
    ])
    assert.deepEqual(corePromptBlockIds({
      tier: 'assist', toolsEnabled: true, capabilityIds: ['search_web'],
    }), ['core.runtime', 'core.conversation', 'core.integrity', 'core.output', 'tool.web'])
  })

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
    assert.equal(messages[1].role, 'user');
    assert.equal(messages[1].content, '第一问');
    assert.equal(messages[2].role, 'assistant');
    assert.equal(messages[2].content, '第一答');
    assert.equal(messages[3].role, 'user');
    assert.ok(messages[3].content.includes('便签正文'));
    assert.ok(messages[3].content.includes('DYN'));
    assert.ok(messages[3].content.includes('不可信参考数据'));
    assert.ok(messages[3].content.includes('第二问'));
    assert.ok(!messages[3].content.includes('需求：'));
  });

  it('keeps Context Engine data out of system messages', () => {
    const messages = buildChatMessages({
      systemMessages: [{ role: 'system', content: 'TRUSTED', _contextCritical: true }],
      dataMessages: [{ role: 'user', content: 'UNTRUSTED ATTACK' }],
      prompt: '当前问题',
    })
    assert.deepEqual(messages.filter(message => message.role === 'system').map(message => message.content), ['TRUSTED'])
    assert.match(messages.at(-1).content, /UNTRUSTED ATTACK[\s\S]*当前问题/)
  })

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
