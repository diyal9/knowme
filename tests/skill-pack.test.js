/**
 * Skill pack: theme ≥3 → OKF skills/ one-to-one
 */
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const skillPack = require('../src/lib/skill-pack');
const productKnowledge = require('../src/lib/product-knowledge');

const TMP = path.join(os.tmpdir(), `sticky-skill-pack-${Date.now()}`);

function note(id, category, content, extra = {}) {
  return {
    id,
    category,
    content,
    project: extra.project || `Note ${id}`,
    version: '0.1',
    tags: extra.tags || [],
    okfTags: extra.okfTags || [],
    ...extra,
  };
}

describe('skill-pack', () => {
  const knowledgeDir = path.join(TMP, 'knowledge');
  const memoryDir = path.join(TMP, 'memory');
  const seedDir = path.join(__dirname, '..', 'src', 'assets', 'knowledge-seed');

  beforeEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
    fs.mkdirSync(knowledgeDir, { recursive: true });
    fs.mkdirSync(memoryDir, { recursive: true });
    productKnowledge.ensureKnowledge(knowledgeDir, seedDir);
  });

  afterEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
  });

  it('suggests when same theme reaches threshold', () => {
    const notes = [
      note('a', 'nine_skills', 'prompt one long enough'),
      note('b', 'nine_skills', 'prompt two long enough'),
      note('c', 'nine_skills', 'prompt three long enough'),
      note('d', 'other', 'other theme content xx'),
    ];
    const s = skillPack.scanSuggestions(notes, memoryDir, (t) => t);
    assert.equal(s.length, 1);
    assert.equal(s[0].theme, 'nine_skills');
    assert.equal(s[0].count, 3);
  });

  it('ignores empty and already packed notes', () => {
    const notes = [
      note('a', 't', 'content aaa aaa'),
      note('b', 't', 'x'),
      note('c', 't', 'content ccc ccc', { skillPackConceptId: 'skills/x' }),
      note('d', 't', 'content ddd ddd'),
    ];
    const s = skillPack.scanSuggestions(notes, memoryDir);
    assert.equal(s.length, 0);
  });

  it('writes one skill concept per note and updates settings-readable category', () => {
    const n = note('n1', 'nine_skills', '请用 {{lang}} 写代码审查', {
      project: '代码审查助手',
      okfTags: ['review'],
    });
    const body = skillPack.localSkillBody(n, 'nine_skills');
    const w = skillPack.writeSkillConcept(knowledgeDir, n, body, 'nine_skills');
    assert.ok(w.ok, w.error);
    assert.ok(w.conceptId.startsWith('skills/'));
    const cats = productKnowledge.listCategories(knowledgeDir);
    const skills = cats.find((c) => c.id === 'skills');
    assert.ok(skills);
    assert.ok(skills.count >= 1);
    assert.equal(skills.label, '技能包');
    const read = productKnowledge.readConcept(knowledgeDir, w.conceptId);
    assert.ok(read.body.includes('提示词模板'));
    assert.ok(
      read.frontmatter.skill_pack === true ||
        read.frontmatter.skill_pack === 'true'
    );
  });

  it('updates concept via writeConcept', () => {
    const n = note('n2', 'tools', 'tool prompt content here');
    const w = skillPack.writeSkillConcept(
      knowledgeDir,
      n,
      skillPack.localSkillBody(n, 'tools'),
      'tools'
    );
    assert.ok(w.ok, w.error);
    const upd = productKnowledge.writeConcept(knowledgeDir, {
      id: w.conceptId,
      title: '更新后的技能',
      body: '## 新正文\n改过了',
    });
    assert.ok(upd.ok, upd.error);
    const read = productKnowledge.readConcept(knowledgeDir, w.conceptId);
    assert.equal(read.title, '更新后的技能');
    assert.ok(read.body.includes('改过了'));
  });

  it('getSkillContext returns skill section', () => {
    const n = note('n3', 'writing', '写作提示词内容足够长');
    skillPack.writeSkillConcept(
      knowledgeDir,
      n,
      skillPack.localSkillBody(n, 'writing'),
      'writing'
    );
    const ctx = productKnowledge.getSkillContext(knowledgeDir, { category: 'writing' });
    assert.ok(ctx.includes('技能包'));
    assert.ok(ctx.length > 10);
  });

  it('dismiss then require more eligible notes to re-prompt', () => {
    const notes = [
      note('a', 'x', 'content aaa aaa'),
      note('b', 'x', 'content bbb bbb'),
      note('c', 'x', 'content ccc ccc'),
    ];
    assert.equal(skillPack.scanSuggestions(notes, memoryDir).length, 1);
    skillPack.setThemeState(memoryDir, 'x', { state: 'dismissed', eligible_at_dismiss: 3 });
    assert.equal(skillPack.scanSuggestions(notes, memoryDir).length, 0);
    notes.push(note('d', 'x', 'content ddd ddd'));
    notes.push(note('e', 'x', 'content eee eee'));
    notes.push(note('f', 'x', 'content fff fff'));
    assert.equal(skillPack.scanSuggestions(notes, memoryDir).length, 1);
  });
});
