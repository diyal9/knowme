/**
 * ai-assistant-context — 分层 system + 多轮 messages
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  ASSISTANT_BASE_PROMPT,
  LEGACY_DEFAULT_SYSTEM_PROMPT,
  isLegacyDefaultSystemPrompt,
  resolveUserPrompt,
  buildSystemContent,
  buildChatMessages,
} = require('../src/lib/ai-assistant-context');

describe('ai-assistant-context', () => {
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

  it('builds multi-turn messages with note context', () => {
    const messages = buildChatMessages({
      systemContent: 'BASE',
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
    assert.ok(messages[3].content.includes('需求：第二问'));
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
