'use strict';

/**
 * AI 助手对话上下文：固定底座 + 用户偏好 + 动态知识/记忆 + 多轮历史。
 */

const ASSISTANT_BASE_PROMPT = `你是 StickyNotes 的笔记助手，一名专业的笔记整理与 AI 提示词优化专家。

【职责】
- 帮用户整理、润色、结构化笔记与提示词。
- 优化 AI 提示词：补全角色定义、背景约束、工作流程、待产出内容、成功标准。
- 主动指出用户输入里的错别字、语病，以及提示词中含糊、缺约束、易产生歧义的问题，并给出修改建议。

【严格规则 · 禁止幻觉】
- 只依据用户当前给出的笔记内容、对话历史，以及明确提供的「用户知识库摘要」作答，绝不编造不存在的笔记、项目、条目或数据。
- 若「用户知识库摘要」标注为空或与问题无关，直接如实告知用户「知识库暂无相关内容」，不要虚构任何条目。
- 「近期使用记忆」「重复模式」只是软件的使用统计，不是笔记内容，禁止把它们当作事实引用，也禁止据此编造笔记。
- 不确定时如实说明，不要猜测或凑数。
- 「用户偏好」仅补充领域与风格；若与上述硬性规则冲突，以本底座规则为准。

【输出】
- 用简洁的 Markdown 组织（标题、列表、代码块），直接给可用结果，避免冗长寒暄。
- 用户要「生成提示词」时，输出直接可用的提示词正文即可。`;

/** 历史版本中写入 settings.json 的整段默认 systemPrompt（用于迁移指纹） */
const LEGACY_DEFAULT_SYSTEM_PROMPT = `你是 StickyNotes 的笔记助手，一名专业的笔记整理与 AI 提示词优化专家。

【职责】
- 帮用户整理、润色、结构化笔记与提示词。
- 优化 AI 提示词：补全角色定义、背景约束、工作流程、待产出内容、成功标准。
- 主动指出用户输入里的错别字、语病，以及提示词中含糊、缺约束、易产生歧义的问题，并给出修改建议。

【严格规则 · 禁止幻觉】
- 只依据用户当前给出的笔记内容和明确提供的"用户知识库摘要"作答，绝不编造不存在的笔记、项目、条目或数据。
- 若"用户知识库摘要"标注为空或与问题无关，直接如实告知用户"知识库暂无相关内容"，不要虚构任何条目。
- "近期使用记忆""重复模式"只是软件的使用统计，不是笔记内容，禁止把它们当作事实引用，也禁止据此编造笔记。
- 不确定时如实说明，不要猜测或凑数。

【输出】
- 用简洁的 Markdown 组织（标题、列表、代码块），直接给可用结果，避免冗长寒暄。
- 用户要"生成提示词"时，输出直接可用的提示词正文即可。`;

const MAX_HISTORY_TURNS = 6;
const MAX_MESSAGE_CHARS = 4000;
const MAX_NOTE_CONTEXT_CHARS = 6000;

function normalizeFingerprint(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/[“”「」]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function isLegacyDefaultSystemPrompt(text) {
  if (!text || !String(text).trim()) return false;
  const a = normalizeFingerprint(text);
  const b = normalizeFingerprint(LEGACY_DEFAULT_SYSTEM_PROMPT);
  const c = normalizeFingerprint(ASSISTANT_BASE_PROMPT);
  return a === b || a === c;
}

/**
 * 从磁盘原始设置解析用户偏好（含旧 systemPrompt 迁移）。
 * @returns {{ userPrompt: string, migratedFromLegacyDefault: boolean }}
 */
function resolveUserPrompt(raw = {}) {
  if (Object.prototype.hasOwnProperty.call(raw, 'userPrompt')) {
    return {
      userPrompt: String(raw.userPrompt || '').trim(),
      migratedFromLegacyDefault: false,
    };
  }
  const legacy = String(raw.systemPrompt || '').trim();
  if (!legacy) {
    return { userPrompt: '', migratedFromLegacyDefault: false };
  }
  if (isLegacyDefaultSystemPrompt(legacy)) {
    return { userPrompt: '', migratedFromLegacyDefault: true };
  }
  return { userPrompt: legacy, migratedFromLegacyDefault: false };
}

function buildSystemContent({ userPrompt = '', dynamicContext = '' } = {}) {
  const parts = [ASSISTANT_BASE_PROMPT];
  const pref = String(userPrompt || '').trim();
  if (pref) {
    parts.push(`## 用户偏好\n${pref}`);
  }
  const dyn = String(dynamicContext || '').trim();
  if (dyn) {
    parts.push(dyn);
  }
  return parts.join('\n\n---\n\n');
}

function truncate(text, max) {
  const s = String(text || '');
  if (s.length <= max) return s;
  return `${s.slice(0, max)}\n…（已截断）`;
}

/**
 * @param {object} opts
 * @param {string} opts.systemContent
 * @param {Array<{role: string, content?: string, text?: string}>} [opts.history]
 * @param {string} opts.prompt
 * @param {string|null} [opts.noteContext]
 * @param {number} [opts.maxTurns]
 */
function buildChatMessages({
  systemContent,
  history = [],
  prompt,
  noteContext = null,
  maxTurns = MAX_HISTORY_TURNS,
} = {}) {
  const messages = [{ role: 'system', content: systemContent }];

  const cleaned = (Array.isArray(history) ? history : [])
    .map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : m.role === 'user' ? 'user' : null,
      content: truncate(m.content != null ? m.content : m.text, MAX_MESSAGE_CHARS),
    }))
    .filter((m) => m.role && m.content && m.content.trim());

  const maxMsgs = Math.max(0, maxTurns) * 2;
  const slice = cleaned.length > maxMsgs ? cleaned.slice(-maxMsgs) : cleaned;
  for (const m of slice) {
    messages.push({ role: m.role, content: m.content.trim() });
  }

  const userParts = [];
  const ctx = noteContext != null ? String(noteContext).trim() : '';
  if (ctx) {
    userParts.push(
      `当前便签正文：\n"""\n${truncate(ctx, MAX_NOTE_CONTEXT_CHARS)}\n"""`
    );
  }
  userParts.push(`需求：${String(prompt || '').trim()}`);
  messages.push({ role: 'user', content: userParts.join('\n\n') });

  return messages;
}

module.exports = {
  ASSISTANT_BASE_PROMPT,
  LEGACY_DEFAULT_SYSTEM_PROMPT,
  MAX_HISTORY_TURNS,
  isLegacyDefaultSystemPrompt,
  resolveUserPrompt,
  buildSystemContent,
  buildChatMessages,
};
