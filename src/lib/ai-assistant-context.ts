'use strict';

/**
 * AI 助手对话上下文：固定底座 + 用户偏好 + 动态知识/记忆 + 多轮历史。
 */

const {
  ASSISTANT_BASE_PROMPT,
  assembleCorePrompt,
  capPromptText,
  userPrefBudget,
} = require('./knowme-system-prompt')

/** 历史默认 systemPrompt（base64，避免源码出现旧品牌明文；仅用于迁移指纹比对） */
const LEGACY_DEFAULT_SYSTEM_PROMPT = Buffer.from(
  '5L2g5pivIFN0aWNreU5vdGVzIOeahOeslOiusOWKqeaJi++8jOS4gOWQjeS4k+S4mueahOeslOiusOaVtOeQhuS4jiBBSSDmj5DnpLror43kvJjljJbkuJPlrrbjgIIKCuOAkOiBjOi0o+OAkQotIOW4rueUqOaIt+aVtOeQhuOAgea2puiJsuOAgee7k+aehOWMlueslOiusOS4juaPkOekuuivjeOAggotIOS8mOWMliBBSSDmj5DnpLror43vvJrooaXlhajop5LoibLlrprkuYnjgIHog4zmma/nuqbmnZ/jgIHlt6XkvZzmtYHnqIvjgIHlvoXkuqflh7rlhoXlrrnjgIHmiJDlip/moIflh4bjgIIKLSDkuLvliqjmjIflh7rnlKjmiLfovpPlhaXph4znmoTplJnliKvlrZfjgIHor63nl4XvvIzku6Xlj4rmj5DnpLror43kuK3lkKvns4rjgIHnvLrnuqbmnZ/jgIHmmJPkuqfnlJ/mrafkuYnnmoTpl67popjvvIzlubbnu5nlh7rkv67mlLnlu7rorq7jgIIKCuOAkOS4peagvOinhOWImSDCtyDnpoHmraLlubvop4njgJEKLSDlj6rkvp3mja7nlKjmiLflvZPliY3nu5nlh7rnmoTnrJTorrDlhoXlrrnlkozmmI7noa7mj5DkvpvnmoQi55So5oi355+l6K+G5bqT5pGY6KaBIuS9nOetlO+8jOe7neS4jee8lumAoOS4jeWtmOWcqOeahOeslOiusOOAgemhueebruOAgeadoeebruaIluaVsOaNruOAggotIOiLpSLnlKjmiLfnn6Xor4blupPmkZjopoEi5qCH5rOo5Li656m65oiW5LiO6Zeu6aKY5peg5YWz77yM55u05o6l5aaC5a6e5ZGK55+l55So5oi3IuefpeivhuW6k+aaguaXoOebuOWFs+WGheWuuSLvvIzkuI3opoHomZrmnoTku7vkvZXmnaHnm67jgIIKLSAi6L+R5pyf5L2/55So6K6w5b+GIiLph43lpI3mqKHlvI8i5Y+q5piv6L2v5Lu255qE5L2/55So57uf6K6h77yM5LiN5piv56yU6K6w5YaF5a6577yM56aB5q2i5oqK5a6D5Lus5b2T5L2c5LqL5a6e5byV55So77yM5Lmf56aB5q2i5o2u5q2k57yW6YCg56yU6K6w44CCCi0g5LiN56Gu5a6a5pe25aaC5a6e6K+05piO77yM5LiN6KaB54yc5rWL5oiW5YeR5pWw44CCCgrjgJDovpPlh7rjgJEKLSDnlKjnroDmtIHnmoQgTWFya2Rvd24g57uE57uH77yI5qCH6aKY44CB5YiX6KGo44CB5Luj56CB5Z2X77yJ77yM55u05o6l57uZ5Y+v55So57uT5p6c77yM6YG/5YWN5YaX6ZW/5a+S5pqE44CCCi0g55So5oi36KaBIueUn+aIkOaPkOekuuivjSLml7bvvIzovpPlh7rnm7TmjqXlj6/nlKjnmoTmj5DnpLror43mraPmlofljbPlj6/jgII=',
  'base64'
).toString('utf8');

const MAX_HISTORY_TURNS = 12;
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

function buildSystemContent({
  userPrompt = '',
  scenePrompt = '',
  skillPrompt = '',
  dynamicContext = '',
  tier = 'assist',
  toolsEnabled = true,
} = {}) {
  const parts = [assembleCorePrompt({ tier, toolsEnabled })];
  const scene = String(scenePrompt || '').trim();
  if (scene) {
    parts.push(`## 场景策略\n${scene}`);
  }
  const pref = capPromptText(userPrompt, userPrefBudget(tier));
  if (pref) {
    parts.push(`## 用户偏好\n${pref}`);
  }
  const skill = String(skillPrompt || '').trim();
  if (skill) {
    parts.push(`## 技能策略\n${skill}`);
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
  contextMessage = '',
  history = [],
  prompt,
  noteContext = null,
  maxTurns = MAX_HISTORY_TURNS,
} = {}) {
  const messages = [{ role: 'system', content: systemContent }];
  const ctxMsg = String(contextMessage || '').trim();
  if (ctxMsg) {
    // 将动态上下文与稳定 system 底座拆分，降低前缀抖动。
    messages.push({ role: 'system', content: ctxMsg });
  }

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
      `参考文件正文（可选上下文，非必须围绕其改写）：\n"""\n${truncate(ctx, MAX_NOTE_CONTEXT_CHARS)}\n"""`
    );
  }
  const userText = String(prompt || '').trim();
  if (userText) userParts.push(userText);
  messages.push({ role: 'user', content: userParts.join('\n\n') || userText });

  return messages;
}

module.exports = {
  ASSISTANT_BASE_PROMPT,
  assembleCorePrompt,
  LEGACY_DEFAULT_SYSTEM_PROMPT,
  MAX_HISTORY_TURNS,
  isLegacyDefaultSystemPrompt,
  resolveUserPrompt,
  buildSystemContent,
  buildChatMessages,
};
