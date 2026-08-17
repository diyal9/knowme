'use strict';

const fs = require('fs');
const path = require('path');
const okf = require('./okf-lib.js');

function copyDir(src, dest) {
  okf.copyDir(src, dest);
}

function ensureKnowledge(knowledgeDir, seedDir) {
  const index = path.join(knowledgeDir, 'index.md');
  if (fs.existsSync(index)) {
    return { seeded: false, path: knowledgeDir };
  }
  fs.mkdirSync(knowledgeDir, { recursive: true });
  if (fs.existsSync(seedDir)) {
    copyDir(seedDir, knowledgeDir);
  } else {
    fs.writeFileSync(
      index,
      '---\nokf_version: "0.1"\n---\n\n# Knowledge Bundle\n',
      'utf8'
    );
    fs.writeFileSync(path.join(knowledgeDir, 'log.md'), '# Log\n', 'utf8');
  }
  return { seeded: true, path: knowledgeDir };
}

function lint(knowledgeDir) {
  return okf.lintBundle(knowledgeDir);
}

const CATEGORY_LABELS = {
  concepts: '概念',
  processes: '流程',
  decisions: '决策',
  references: '参考',
  templates: '模板',
  skills: '技能包',
};

function writeManifest(destDir, concepts, extra = {}) {
  const manifest = {
    okf_version: '0.1',
    exported_at: new Date().toISOString(),
    source: 'knowme',
    concepts,
    ...extra,
  };
  fs.writeFileSync(
    path.join(destDir, 'MANIFEST.json'),
    JSON.stringify(manifest, null, 2),
    'utf8'
  );
}

function buildPartialIndex(selectedConcepts) {
  const byCat = new Map();
  for (const c of selectedConcepts) {
    if (!byCat.has(c.category)) byCat.set(c.category, []);
    byCat.get(c.category).push(c);
  }
  const lines = [
    '---',
    'okf_version: "0.1"',
    '---',
    '',
    '# KnowMe 知识库（部分导出）',
    '',
  ];
  for (const [cat, items] of byCat) {
    const label = CATEGORY_LABELS[cat] || (cat === '_root' ? '根目录' : cat);
    lines.push(`## ${label}`, '');
    for (const it of items) {
      const href = it.rel.replace(/\\/g, '/');
      lines.push(`* [${it.title}](${href})`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * @param {string} knowledgeDir
 * @param {string} destDir
 * @param {{ categories?: string[] }} [options]
 *   categories 未传/空/等于全部分类 → 整包导出；否则仅导出指定主题（分类目录）
 */
function exportBundle(knowledgeDir, destDir, options = {}) {
  const sourceLint = lint(knowledgeDir);
  if (!sourceLint.ok) {
    return { ok: false, error: 'OKF lint failed', lint: sourceLint };
  }

  const allCats = listCategories(knowledgeDir).map((c) => c.id);
  const hasFilter = Object.prototype.hasOwnProperty.call(options, 'categories');
  const requested = hasFilter
    ? (Array.isArray(options.categories) ? options.categories.filter(Boolean) : [])
    : null;

  if (hasFilter && requested.length === 0) {
    return { ok: false, error: '请先勾选要导出的主题' };
  }

  const exportAll =
    !hasFilter ||
    (allCats.length > 0 &&
      requested.length >= allCats.length &&
      allCats.every((id) => requested.includes(id)));

  if (fs.existsSync(destDir)) {
    fs.rmSync(destDir, { recursive: true, force: true });
  }
  fs.mkdirSync(destDir, { recursive: true });

  if (exportAll) {
    copyDir(knowledgeDir, destDir);
    writeManifest(destDir, sourceLint.concepts, { partial: false });
    return { ok: true, path: destDir, concepts: sourceLint.concepts, partial: false };
  }

  const selected = new Set(requested);
  const concepts = listConcepts(knowledgeDir, 10000).filter((c) => {
    if (c.category === '_root') return selected.has('_root');
    return selected.has(c.category);
  });

  if (!concepts.length) {
    return { ok: false, error: '所选主题下没有可导出的概念' };
  }

  for (const c of concepts) {
    const src = path.join(knowledgeDir, c.rel);
    const target = path.join(destDir, c.rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(src, target);
  }

  fs.writeFileSync(path.join(destDir, 'index.md'), buildPartialIndex(concepts), 'utf8');
  const logSrc = path.join(knowledgeDir, 'log.md');
  if (fs.existsSync(logSrc)) {
    fs.copyFileSync(logSrc, path.join(destDir, 'log.md'));
  } else {
    fs.writeFileSync(path.join(destDir, 'log.md'), '# Log\n', 'utf8');
  }
  const entry =
    `\n## ${new Date().toISOString().slice(0, 10)}\n` +
    `* **Partial export**: categories=${[...selected].join(',')}, concepts=${concepts.length}.\n`;
  fs.appendFileSync(path.join(destDir, 'log.md'), entry, 'utf8');

  const destLint = lint(destDir);
  if (!destLint.ok) {
    return { ok: false, error: '导出包校验失败', lint: destLint };
  }
  writeManifest(destDir, destLint.concepts, {
    partial: true,
    categories: [...selected],
  });
  return {
    ok: true,
    path: destDir,
    concepts: destLint.concepts,
    partial: true,
    categories: [...selected],
  };
}

function readConcept(knowledgeDir, conceptId) {
  const rel = String(conceptId || '').endsWith('.md')
    ? String(conceptId)
    : `${conceptId}.md`;
  const abs = path.join(knowledgeDir, rel);
  if (!fs.existsSync(abs)) return null;
  const content = fs.readFileSync(abs, 'utf8');
  const { frontmatter, body } = okf.parseFrontmatter(content);
  return {
    rel: rel.replace(/\\/g, '/'),
    title: frontmatter?.title || path.basename(rel, '.md'),
    type: frontmatter?.type || 'Concept',
    body: (body || '').trim(),
    frontmatter,
  };
}

function mergeImport(src, dest) {
  const files = okf
    .walkMdFiles(src, src)
    .filter((f) => okf.isConceptFile(f.rel) || f.name === 'index.md' || f.name === 'log.md');
  let imported = 0;
  let skipped = 0;
  for (const f of files) {
    const targetPath = path.join(dest, f.rel);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    if (fs.existsSync(targetPath) && f.name !== 'log.md') {
      const existing = fs.readFileSync(targetPath, 'utf8');
      const incoming = fs.readFileSync(f.abs, 'utf8');
      if (existing === incoming) {
        skipped++;
        continue;
      }
      if (f.name === 'index.md') {
        fs.copyFileSync(f.abs, targetPath);
        imported++;
        continue;
      }
      const base = path.basename(f.rel, '.md');
      fs.copyFileSync(f.abs, path.join(path.dirname(targetPath), `${base}-imported.md`));
      imported++;
    } else {
      fs.copyFileSync(f.abs, targetPath);
      imported++;
    }
  }
  const logPath = path.join(dest, 'log.md');
  const entry = `\n## ${new Date().toISOString().slice(0, 10)}\n* **Import (merge)**: ${imported} files, ${skipped} skipped.\n`;
  if (fs.existsSync(logPath)) fs.appendFileSync(logPath, entry, 'utf8');
  return { imported, skipped };
}

function importBundle(knowledgeDir, srcDir) {
  const lintSrc = lint(srcDir);
  if (!lintSrc.ok) {
    return { ok: false, error: 'Source bundle fails OKF lint', lint: lintSrc };
  }
  fs.mkdirSync(knowledgeDir, { recursive: true });
  const stats = mergeImport(srcDir, knowledgeDir);
  const post = lint(knowledgeDir);
  return { ok: post.ok, stats, lint: { errors: post.errors.length, warnings: post.warnings.length } };
}

function conceptMeta(f) {
  const content = fs.readFileSync(f.abs, 'utf8');
  const { frontmatter } = okf.parseFrontmatter(content);
  const parts = f.rel.split('/');
  const category = parts.length > 1 ? parts[0] : '_root';
  return {
    id: okf.conceptId(f.rel),
    title: frontmatter?.title || f.rel,
    type: frontmatter?.type || 'Concept',
    category,
    rel: f.rel,
  };
}

function listConcepts(knowledgeDir, limit = 50) {
  if (!fs.existsSync(knowledgeDir)) return [];
  return okf
    .walkMdFiles(knowledgeDir, knowledgeDir)
    .filter((f) => okf.isConceptFile(f.rel))
    .slice(0, limit)
    .map(conceptMeta);
}

/** 按顶层目录汇总知识分类（concepts / processes 等） */
function listCategories(knowledgeDir) {
  if (!fs.existsSync(knowledgeDir)) return [];
  const concepts = okf
    .walkMdFiles(knowledgeDir, knowledgeDir)
    .filter((f) => okf.isConceptFile(f.rel))
    .map(conceptMeta);

  const map = new Map();
  for (const c of concepts) {
    if (!map.has(c.category)) {
      map.set(c.category, {
        id: c.category,
        label: CATEGORY_LABELS[c.category] || (c.category === '_root' ? '根目录' : c.category),
        count: 0,
        items: [],
      });
    }
    const cat = map.get(c.category);
    cat.count += 1;
    cat.items.push({ id: c.id, title: c.title, type: c.type });
  }

  // 空目录也展示（用户可看到分类骨架）
  try {
    for (const name of fs.readdirSync(knowledgeDir)) {
      const full = path.join(knowledgeDir, name);
      if (!fs.statSync(full).isDirectory()) continue;
      if (name.startsWith('.')) continue;
      if (!map.has(name)) {
        map.set(name, {
          id: name,
          label: CATEGORY_LABELS[name] || name,
          count: 0,
          items: [],
        });
      }
    }
  } catch {
    /* ignore */
  }

  return [...map.values()].sort((a, b) => {
    if (a.id === '_root') return 1;
    if (b.id === '_root') return -1;
    return a.label.localeCompare(b.label, 'zh-CN');
  });
}

function getContextSnippet(knowledgeDir, maxChars = 2000) {
  const indexPath = path.join(knowledgeDir, 'index.md');
  if (!fs.existsSync(indexPath)) return '';
  const text = fs.readFileSync(indexPath, 'utf8');
  return text.length > maxChars ? text.slice(0, maxChars) + '…' : text;
}

/** 在 index.md 某节下追加链接（若尚不存在） */
function ensureIndexLink(knowledgeDir, sectionTitle, conceptId, title, rel) {
  const indexPath = path.join(knowledgeDir, 'index.md');
  const href = String(rel || `${conceptId}.md`).replace(/\\/g, '/');
  const line = `* [${title}](${href})`;
  let text = fs.existsSync(indexPath)
    ? fs.readFileSync(indexPath, 'utf8')
    : '---\nokf_version: "0.1"\n---\n\n# KnowMe 知识库\n';
  if (text.includes(`](${href})`) || text.includes(`](${conceptId}.md)`)) {
    return;
  }
  const heading = `## ${sectionTitle}`;
  if (!text.includes(heading)) {
    text = text.trimEnd() + `\n\n${heading}\n\n${line}\n`;
  } else {
    const idx = text.indexOf(heading);
    const after = text.slice(idx + heading.length);
    const nextH = after.search(/\n## /);
    const insertAt = nextH >= 0 ? idx + heading.length + nextH : text.length;
    const block = text.slice(idx, insertAt);
    if (!block.includes(line)) {
      text = text.slice(0, insertAt).trimEnd() + `\n${line}\n` + text.slice(insertAt);
    }
  }
  fs.writeFileSync(indexPath, text.endsWith('\n') ? text : text + '\n', 'utf8');
}

/**
 * 写入或覆盖概念文件。path 形如 skills/foo.md 或 conceptId。
 */
function writeConcept(knowledgeDir, { id, title, body, frontmatter = {} }) {
  const rel = String(id || '').endsWith('.md') ? String(id) : `${id}.md`;
  const abs = path.join(knowledgeDir, rel);
  if (!fs.existsSync(abs) && !frontmatter.type) {
    return { ok: false, error: '概念不存在' };
  }

  let existingFm = {};
  if (fs.existsSync(abs)) {
    const cur = fs.readFileSync(abs, 'utf8');
    existingFm = okf.parseFrontmatter(cur).frontmatter || {};
  }

  const fm = {
    ...existingFm,
    ...frontmatter,
    type: frontmatter.type || existingFm.type || 'Concept',
    title: title != null ? title : existingFm.title || path.basename(rel, '.md'),
  };
  if (!fm.description) {
    const first = String(body || '')
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l && !l.startsWith('#'));
    fm.description = (first || '(空)').slice(0, 128).replace(/:/g, '：');
  }

  const yamlLines = ['---'];
  for (const [k, v] of Object.entries(fm)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      yamlLines.push(
        `${k}: [${v.map((x) => `"${String(x).replace(/"/g, '')}"`).join(', ')}]`
      );
    } else if (typeof v === 'boolean') {
      yamlLines.push(`${k}: ${v}`);
    } else {
      yamlLines.push(`${k}: ${String(v).replace(/:/g, '：')}`);
    }
  }
  yamlLines.push('---', '');

  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, yamlLines.join('\n') + String(body || '').trim() + '\n', 'utf8');

  const lintResult = lint(knowledgeDir);
  if (!lintResult.ok) {
    return { ok: false, error: '保存后 OKF 校验失败', lint: lintResult };
  }

  const logPath = path.join(knowledgeDir, 'log.md');
  const entry = `\n## ${new Date().toISOString().slice(0, 10)}\n* **Update concept**: ${fm.title} (${okf.conceptId(rel)})\n`;
  if (fs.existsSync(logPath)) fs.appendFileSync(logPath, entry, 'utf8');

  return { ok: true, conceptId: okf.conceptId(rel), rel: rel.replace(/\\/g, '/') };
}

/** 助写用：按主题/标签/slash 引用拉取 skills */
function getSkillContext(knowledgeDir, { category = '', slashRefs = [], maxChars = 2400 } = {}) {
  const skills = listConcepts(knowledgeDir, 200).filter((c) => c.category === 'skills');
  if (!skills.length) return '';

  const theme = String(category || '').trim();
  const want = new Set(
    (Array.isArray(slashRefs) ? slashRefs : [])
      .map((s) => normalizeSlash(s))
      .filter(Boolean)
  );

  const ranked = skills
    .map((c) => {
      const full = readConcept(knowledgeDir, c.id);
      const fm = full?.frontmatter || {};
      const slash = resolveSlashForConcept(c, fm);
      let score = 1;
      if (want.has(slash)) score += 20;
      if (theme && (fm.theme === theme || String(fm.theme || '') === theme)) score += 5;
      if (theme && (c.title || '').includes(theme)) score += 2;
      return { c, full, slash, score };
    })
    .filter((x) => (want.size ? x.score >= 20 : true))
    .sort((a, b) => b.score - a.score)
    .slice(0, want.size ? Math.max(want.size, 4) : 4);

  if (!ranked.length && want.size) {
    // slash 未命中时仍回退主题相关
    return getSkillContext(knowledgeDir, { category, slashRefs: [], maxChars });
  }
  if (!ranked.length) return '';

  const parts = ['## 技能包（用户通过 /命令 引用或主题相关）'];
  for (const { c, full, slash } of ranked) {
    const body = (full?.body || '').slice(0, want.size ? 900 : 420);
    parts.push(`### /${slash} · ${c.title}\n${body}${body.length >= (want.size ? 900 : 420) ? '…' : ''}`);
  }
  return parts.join('\n\n').slice(0, maxChars);
}

function normalizeSlash(raw) {
  return String(raw || '')
    .trim()
    .replace(/^\//, '')
    .toLowerCase()
    .replace(/[^a-z0-9\-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

function resolveSlashForConcept(meta, fm = {}) {
  const fromFm = normalizeSlash(fm.slash);
  if (fromFm) return fromFm;
  const fromTitle = normalizeSlash(meta.title);
  if (fromTitle) return fromTitle;
  const base = String(meta.id || '')
    .split('/')
    .pop();
  return normalizeSlash(base) || 'skill';
}

function listSkills(knowledgeDir) {
  const used = new Set();
  return listConcepts(knowledgeDir, 200)
    .filter((c) => c.category === 'skills')
    .map((c) => {
      const full = readConcept(knowledgeDir, c.id);
      const fm = full?.frontmatter || {};
      let slash = resolveSlashForConcept(c, fm);
      let n = 1;
      const root = slash;
      while (used.has(slash)) {
        slash = `${root}-${n}`;
        n++;
      }
      used.add(slash);
      return {
        id: c.id,
        title: c.title,
        slash,
        description: String(fm.description || '').slice(0, 120),
        rel: c.rel,
      };
    })
    .sort((a, b) => a.slash.localeCompare(b.slash));
}

function allocateUniqueSlash(knowledgeDir, desired) {
  const base = normalizeSlash(desired) || 'skill';
  const existing = new Set(listSkills(knowledgeDir).map((s) => s.slash));
  if (!existing.has(base)) return base;
  let n = 2;
  while (existing.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

function createSkill(knowledgeDir, { title, slash, body } = {}) {
  const name = String(title || '').trim() || '未命名技能';
  const cmd = allocateUniqueSlash(knowledgeDir, slash || name);
  const fileSlug =
    normalizeSlash(name) ||
    `skill-${Date.now().toString(36).slice(-6)}`;
  let rel = `skills/${fileSlug}.md`;
  let i = 1;
  while (fs.existsSync(path.join(knowledgeDir, rel))) {
    rel = `skills/${fileSlug}-${i}.md`;
    i++;
  }
  const cleanBody =
    String(body || '').trim() ||
    `# ${name}\n\n## 用途\n\n（请补充）\n\n## 提示词模板\n\n\`\`\`\n\n\`\`\`\n`;

  const result = writeConcept(knowledgeDir, {
    id: rel.replace(/\.md$/, ''),
    title: name,
    body: cleanBody,
    frontmatter: {
      type: 'Concept',
      skill_pack: true,
      slash: cmd,
      description: cleanBody
        .split('\n')
        .map((l) => l.trim())
        .find((l) => l && !l.startsWith('#') && !l.startsWith('```'))
        ?.slice(0, 128)
        ?.replace(/:/g, '：') || '自定义技能',
      timestamp: new Date().toISOString(),
    },
  });
  if (result.ok) {
    ensureIndexLink(knowledgeDir, '技能包', result.conceptId, name, result.rel);
  }
  return result.ok ? { ...result, slash: cmd } : result;
}

/** 从用户输入解析 /slash 令牌 */
function parseSlashTokens(text) {
  const re = /(^|\s)\/([a-z0-9][a-z0-9\-]{0,31})\b/gi;
  const found = [];
  let m;
  while ((m = re.exec(String(text || ''))) !== null) {
    const s = normalizeSlash(m[2]);
    if (s && !found.includes(s)) found.push(s);
  }
  return found;
}

module.exports = {
  ensureKnowledge,
  lint,
  exportBundle,
  importBundle,
  listConcepts,
  listCategories,
  getContextSnippet,
  getSkillContext,
  listSkills,
  createSkill,
  normalizeSlash,
  parseSlashTokens,
  allocateUniqueSlash,
  readConcept,
  writeConcept,
  ensureIndexLink,
  CATEGORY_LABELS,
};
