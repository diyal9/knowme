'use strict';

const fs = require('fs');
const path = require('path');
const okf = require('./okf-lib.js');
const productKnowledge = require('./product-knowledge.js');

const THEME_THRESHOLD = 3;
const MIN_CONTENT = 8;
const SKILLS_CATEGORY = 'skills';

function slugify(text) {
  const base = (text || 'skill')
    .trim()
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return base || 'skill';
}

function themeKey(note) {
  return String(note?.category || '').trim();
}

function noteContent(note) {
  return String(note?.content || '').trim();
}

function isEligibleNote(note, theme) {
  if (!note || themeKey(note) !== theme) return false;
  if (noteContent(note).length < MIN_CONTENT) return false;
  if (note.skillPackConceptId) return false;
  return true;
}

function loadThemeState(memoryDir) {
  const p = path.join(memoryDir, 'skills', 'theme-state.json');
  try {
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    return data && typeof data === 'object' && data.themes ? data : { themes: {} };
  } catch {
    return { themes: {} };
  }
}

function saveThemeState(memoryDir, state) {
  const dir = path.join(memoryDir, 'skills');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'theme-state.json'),
    JSON.stringify(state, null, 2) + '\n',
    'utf8'
  );
}

function setThemeState(memoryDir, theme, patch) {
  const state = loadThemeState(memoryDir);
  const prev = state.themes[theme] || {};
  state.themes[theme] = {
    ...prev,
    ...patch,
    updated_at: new Date().toISOString(),
  };
  saveThemeState(memoryDir, state);
  return state.themes[theme];
}

function groupEligibleByTheme(notes) {
  const map = new Map();
  for (const n of notes || []) {
    const theme = themeKey(n);
    if (!theme) continue;
    if (!isEligibleNote(n, theme)) continue;
    if (!map.has(theme)) map.set(theme, []);
    map.get(theme).push(n);
  }
  return map;
}

/**
 * @returns {Array<{ theme: string, count: number, noteIds: string[], label?: string }>}
 */
function scanSuggestions(notes, memoryDir, labelFn) {
  const state = loadThemeState(memoryDir);
  const groups = groupEligibleByTheme(notes);
  const out = [];
  for (const [theme, list] of groups) {
    if (list.length < THEME_THRESHOLD) continue;
    const st = state.themes[theme] || {};
    if (st.state === 'dismissed') {
      const dismissedAt = st.eligible_at_dismiss || 0;
      if (list.length < dismissedAt + THEME_THRESHOLD) continue;
    }
    out.push({
      theme,
      count: list.length,
      noteIds: list.map((n) => n.id),
      label: typeof labelFn === 'function' ? labelFn(theme) : theme,
    });
  }
  return out;
}

function localSkillBody(note, theme) {
  const title = (note.project || '').trim() || '未命名技能';
  const body = noteContent(note);
  const tags = Array.isArray(note.okfTags) && note.okfTags.length
    ? note.okfTags
    : Array.isArray(note.tags)
      ? note.tags
      : [];
  return [
    `# ${title}`,
    '',
    '## 用途',
    `主题「${theme}」下的可复用提示词技能。`,
    '',
    '## 适用场景',
    tags.length ? tags.map((t) => `- ${t}`).join('\n') : '- （待补充）',
    '',
    '## 提示词模板',
    '',
    '```',
    body,
    '```',
    '',
    '## 变量',
    '使用 `{{变量名}}` 作为占位（若原文含有）。',
    '',
    '## 注意事项',
    '- 由 Sticky-Notes 本地封装；可在设置 → 知识库中审阅修改。',
    '',
  ].join('\n');
}

function uniqueSkillPath(knowledgeDir, slug) {
  const skillsDir = path.join(knowledgeDir, SKILLS_CATEGORY);
  fs.mkdirSync(skillsDir, { recursive: true });
  let candidate = `${slug}.md`;
  let n = 1;
  while (fs.existsSync(path.join(skillsDir, candidate))) {
    candidate = `${slug}-${n}.md`;
    n++;
  }
  return path.join(SKILLS_CATEGORY, candidate).replace(/\\/g, '/');
}

function writeSkillConcept(knowledgeDir, note, body, theme) {
  const title = (note.project || '').trim() || '未命名技能';
  const slug = slugify(title);
  const rel = uniqueSkillPath(knowledgeDir, slug);
  const abs = path.join(knowledgeDir, rel);
  const cleanBody = String(body || '').trim() || localSkillBody(note, theme);
  const description =
    cleanBody
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l && !l.startsWith('#') && !l.startsWith('```'))
      ?.slice(0, 128) || '(技能包)';
  const tags = Array.isArray(note.okfTags) && note.okfTags.length
    ? note.okfTags
    : Array.isArray(note.tags)
      ? note.tags
      : [];

  const frontmatter = [
    '---',
    'type: Concept',
    `title: ${title.replace(/:/g, '：')}`,
    `description: ${String(description).replace(/:/g, '：')}`,
    `tags: [${tags.map((t) => `"${String(t).replace(/"/g, '')}"`).join(', ')}]`,
    'skill_pack: true',
    `slash: ${productKnowledge.allocateUniqueSlash(knowledgeDir, title)}`,
    `theme: ${theme}`,
    `source_note_id: ${note.id}`,
    `prompt_version: "${note.version || '0.1'}"`,
    `timestamp: ${new Date().toISOString()}`,
    '---',
    '',
  ].join('\n');

  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, frontmatter + cleanBody + '\n', 'utf8');

  productKnowledge.ensureIndexLink(
    knowledgeDir,
    '技能包',
    okf.conceptId(rel),
    title,
    rel
  );

  const logPath = path.join(knowledgeDir, 'log.md');
  const entry = `\n## ${new Date().toISOString().slice(0, 10)}\n* **Skill pack**: ${title} ← note ${note.id} (${theme})\n`;
  if (fs.existsSync(logPath)) fs.appendFileSync(logPath, entry, 'utf8');

  const lint = productKnowledge.lint(knowledgeDir);
  if (!lint.ok) {
    try {
      fs.unlinkSync(abs);
    } catch {
      /* ignore */
    }
    return { ok: false, error: 'OKF lint failed after skill write', lint };
  }

  return { ok: true, conceptId: okf.conceptId(rel), rel };
}

function stripAiFrontmatter(text) {
  let t = String(text || '').trim();
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:markdown|md)?\s*/i, '').replace(/```\s*$/i, '').trim();
  }
  if (t.startsWith('---')) {
    const m = t.match(/^---[\s\S]*?---\r?\n?([\s\S]*)$/);
    if (m) t = m[1].trim();
  }
  return t;
}

module.exports = {
  THEME_THRESHOLD,
  MIN_CONTENT,
  SKILLS_CATEGORY,
  themeKey,
  isEligibleNote,
  groupEligibleByTheme,
  scanSuggestions,
  loadThemeState,
  setThemeState,
  localSkillBody,
  writeSkillConcept,
  stripAiFrontmatter,
  slugify,
};
