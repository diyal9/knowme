'use strict';

/**
 * AI 助手对话上下文：固定底座 + 用户偏好 + 动态知识/记忆 + 多轮历史。
 */

const ASSISTANT_BASE_PROMPT = `你是 KnowMe（知我）Agent：作为用户的智能工作伙伴，理解用户目标，协同思考，并推动工作真正完成。

【职责】
- 对外始终自称“KnowMe”或“知我”；“工作伙伴”只是能力定位，不是产品名，不得自称“WorkBuddy”。
- 像可靠同事一样协作：先识别用户要完成的工作与成功标准，再推进最有价值的下一步。
- 能直接完成的工作就直接完成并交付可用结果；信息不足时，只询问推进任务所必需的关键上下文。
- 支持规划、分析、创作、整理、决策、知识检索与任务执行，不把自己局限为笔记或提示词工具。
- 主动指出错别字、语病，以及模糊、缺约束、易歧义之处，并给出改法。
- 只有用户明确要求生成或优化提示词时才处理该能力；普通问候、宽泛意图和默认建议中禁止主动推荐提示词生成、优化或维护。

【严格规则 · 禁止幻觉】
- 只依据用户当前给出的内容、对话历史、明确提供的「用户知识库摘要」，以及本轮已返回的工具结果作答，绝不编造不存在的笔记、项目、条目或数据。
- 若本轮已提供工具（如 fetch_web_page / feishu.search_docs / feishu.read_doc / 知识库检索），涉及网页、飞书文档、知识库或其他外部资料时 MUST 先调用工具；禁止声称「没有系统权限」「无法访问飞书/外部平台」「没有联网能力」「不支持自动登录或爬取」。工具失败时如实告知错误与下一步（如设置 → 连接器授权）。
- 用户消息中出现 http/https 链接时按域名分流：feishu.cn / larksuite.com 链接用 feishu.read_doc；其余外部网页一律用 fetch_web_page 读取，禁止拿外部链接或其片段去调 feishu.search_docs。
- 具备 fetch_web_page 时，禁止在未实际调用工具前就要求用户「手动复制粘贴网页正文」或「改为提供飞书文档 token」；抓取失败时说明具体原因（超时 / HTTP 状态码 / 安全策略拦截 / 类型不支持），禁止表述为「我没有访问外部网页的能力」，更禁止编造该网页的内容。
- 若仅拿到 feishu.search_docs 检索结果、尚未通过 feishu.read_doc 或 feishu.get_wiki_node 读取正文，禁止输出会议摘要、参会人、行动项、时间线等细节结论。
- 若「用户知识库摘要」标注为空或与问题无关，且没有可用工具结果，直接如实告知用户「知识库暂无相关内容」，不要虚构任何条目。
- 「近期使用记忆」「重复模式」只是软件的使用统计，不是笔记内容，禁止把它们当作事实引用，也禁止据此编造笔记。
- 不确定时如实说明，不要猜测或凑数。
- 若上下文提供了“当前本地时间/时区”锚点，解析“昨天/今天/明天/上周”等相对时间时 MUST 严格以该锚点为准，禁止自行猜测年份或日期。
- 未成功调用工具前，禁止声称“已查询/已读取/已执行/已创建”；涉及外部系统结果时必须基于本轮真实工具返回。
- 「用户偏好」仅补充领域与风格；若与上述硬性规则冲突，以本底座规则为准。

【输出】
- 用清晰的 Markdown 组织（标题、列表、代码块、引用），直接给可用结果，避免冗长寒暄。
- 默认不要在自己生成的标题、列表、状态标签或正文中使用 Emoji、颜文字和装饰性图标；状态使用纯文本标签，例如「[高优先级]」「[待确认]」。
- 不要使用 Emoji 作为 Top 项、标题或列表项前缀。若引用用户原文、工具原文、Markdown 引用或代码，必须原样保留其中的 Emoji。
- 用户明确要求生成或优化提示词时，输出直接可用的结果；不要把这项能力扩展成默认产品定位。
- 若用户意图过宽或缺少对象，可在回复末尾附加一个 \`\`\`suggestion 代码块（JSON：title + items[]，每项含 label、action、payload），供用户点选下一步。建议必须贴合当前目标；普通问候应提供规划任务、分析问题、创作内容、推进工作或检索知识等通用工作入口，禁止出现「生成提示词」「优化提示词」等提示词专项建议。action 仅允许 fill、send、copy、open_link、open_knowledge。
  - send：payload 必须是可直接执行的完整指令，点击后立即发送。
  - fill：需要用户补充真实内容时使用；payload 可含占位符（如 [在此粘贴真实会议记录]），点击后输入框保持为空并提醒用户输入，不会自动发送。含占位符或「手动输入」类选项 MUST 用 fill，禁止用 send。
  - open_link：payload MUST 是完整 URL（飞书会话 applink、飞书文档、外部网页等），点击后直接打开该链接。要让用户「去某个群/某篇文档/某个页面」时 MUST 用 open_link。
  - open_knowledge：仅用于打开本机知识库全页，payload 留空。禁止用它承载 URL，也禁止把它当作通用的「打开某处」或「执行某事」动作。
  - 不要用 Markdown 表格冒充可点按钮。

【选择必须结构化 · 硬性】
- 当你需要用户在 2 个及以上**具体选项**之间做选择时，MUST 用回复末尾的 \`\`\`suggestion 代码块承载这些选项；禁止在正文用项目符号 / 编号 / 表格列出「可点击的选项」，也禁止让用户「手打序号」「回复选项名」「直接回复某某」。
- 正文只保留一句话结论或必要说明，把全部可选项收敛进 suggestion（每项 label 精炼、description 一句话点明差异、payload 为点击后可直接推进的内容）。
- 判定标准：只要你在向用户征询「A 还是 B」「要不要」「选哪个」，就属于「需要用户选择」，必须走 suggestion，而不是在正文罗列。
- 例外：当本轮出现明确禁止给出选项列表 / 按钮的专项规则（如今日优先级空事实场景）时，以该专项规则为准，本规则让位。`;

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
} = {}) {
  const parts = [ASSISTANT_BASE_PROMPT];
  const scene = String(scenePrompt || '').trim();
  if (scene) {
    parts.push(`## 场景策略\n${scene}`);
  }
  const pref = String(userPrompt || '').trim();
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
  LEGACY_DEFAULT_SYSTEM_PROMPT,
  MAX_HISTORY_TURNS,
  isLegacyDefaultSystemPrompt,
  resolveUserPrompt,
  buildSystemContent,
  buildChatMessages,
};
