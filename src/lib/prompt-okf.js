'use strict';

const fs = require('fs');
const path = require('path');
const okf = require('./okf-lib.js');
const productKnowledge = require('./product-knowledge.js');
const { assembleContent } = require('./prompt-sections.js');

function slugify(text) {
  const base = (text || 'prompt')
    .trim()
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return base || 'prompt';
}

function uniqueConceptPath(knowledgeDir, slug) {
  const conceptsDir = path.join(knowledgeDir, 'concepts');
  fs.mkdirSync(conceptsDir, { recursive: true });
  let candidate = `${slug}.md`;
  let n = 1;
  while (fs.existsSync(path.join(conceptsDir, candidate))) {
    candidate = `${slug}-${n}.md`;
    n++;
  }
  return path.join('concepts', candidate);
}

function promoteNoteToConcept(knowledgeDir, note) {
  const title = (note.project || '').trim() || '未命名提示词';
  const slug = slugify(title);
  const rel = uniqueConceptPath(knowledgeDir, slug);
  const abs = path.join(knowledgeDir, rel);
  const body = (note.content || assembleContent(note.sections) || '').trim();
  const description = body.split('\n')[0]?.slice(0, 128) || '(空)';
  const tags = Array.isArray(note.okfTags) && note.okfTags.length
    ? note.okfTags
    : (Array.isArray(note.tags) ? note.tags : []);

  const frontmatter = [
    '---',
    'type: Concept',
    `title: ${title}`,
    `description: ${description.replace(/:/g, '：')}`,
    `tags: [${tags.map((t) => `"${String(t).replace(/"/g, '')}"`).join(', ')}]`,
    `source_note_id: ${note.id}`,
    `prompt_version: "${note.version || '0.1'}"`,
    `timestamp: ${new Date().toISOString()}`,
    '---',
    '',
  ].join('\n');

  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, frontmatter + body + '\n', 'utf8');

  const lint = productKnowledge.lint(knowledgeDir);
  if (!lint.ok) {
    return { ok: false, error: 'OKF lint failed after promote', lint, conceptId: okf.conceptId(rel) };
  }

  const logPath = path.join(knowledgeDir, 'log.md');
  const entry = `\n## ${new Date().toISOString().slice(0, 10)}\n* **Promote**: ${title} ← note ${note.id}\n`;
  if (fs.existsSync(logPath)) fs.appendFileSync(logPath, entry, 'utf8');

  return { ok: true, conceptId: okf.conceptId(rel), rel };
}

function readConcept(knowledgeDir, conceptId) {
  const rel = conceptId.endsWith('.md') ? conceptId : `${conceptId}.md`;
  const abs = path.join(knowledgeDir, rel);
  if (!fs.existsSync(abs)) return null;
  const content = fs.readFileSync(abs, 'utf8');
  const { frontmatter, body } = okf.parseFrontmatter(content);
  return { rel, abs, frontmatter, body: (body || '').trim() };
}

function instantiateConcept(knowledgeDir, conceptId) {
  const concept = readConcept(knowledgeDir, conceptId);
  if (!concept) return { ok: false, error: 'Concept 不存在' };

  const fm = concept.frontmatter || {};
  const note = {
    content: concept.body,
    project: fm.title || path.basename(concept.rel, '.md'),
    version: fm.prompt_version || '0.1',
    okfConceptId: okf.conceptId(concept.rel),
    category: '',
    okfTags: Array.isArray(fm.tags) ? fm.tags : [],
    tags: Array.isArray(fm.tags) ? [...fm.tags] : [],
    editorMode: 'free',
    sections: null,
    parentNoteId: null,
  };

  if (fm.source_note_id) {
    note.promotedFrom = fm.source_note_id;
  }

  return { ok: true, note };
}

module.exports = {
  promoteNoteToConcept,
  instantiateConcept,
  readConcept,
  slugify,
};
