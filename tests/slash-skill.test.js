/**
 * Slash skill refs + custom skills
 */
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const productKnowledge = require('../src/lib/product-knowledge');

const TMP = path.join(os.tmpdir(), `sticky-slash-skill-${Date.now()}`);

describe('slash-skill-ref', () => {
  const knowledgeDir = path.join(TMP, 'knowledge');
  const seedDir = path.join(__dirname, '..', 'src', 'assets', 'knowledge-seed');

  beforeEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
    fs.mkdirSync(knowledgeDir, { recursive: true });
    productKnowledge.ensureKnowledge(knowledgeDir, seedDir);
  });

  afterEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
  });

  it('parses slash tokens from prompt', () => {
    assert.deepEqual(productKnowledge.parseSlashTokens('/review 优化这段'), ['review']);
    assert.deepEqual(
      productKnowledge.parseSlashTokens('请用 /code-review 和 /en 处理'),
      ['code-review', 'en']
    );
    assert.deepEqual(productKnowledge.parseSlashTokens('path/to/file'), []);
  });

  it('creates custom skill with slash', () => {
    const r = productKnowledge.createSkill(knowledgeDir, {
      title: '代码审查',
      slash: 'review',
      body: '## 用途\n审查 PR',
    });
    assert.ok(r.ok, r.error);
    assert.equal(r.slash, 'review');
    const skills = productKnowledge.listSkills(knowledgeDir);
    assert.ok(skills.some((s) => s.slash === 'review'));
    const ctx = productKnowledge.getSkillContext(knowledgeDir, {
      slashRefs: ['review'],
    });
    assert.ok(ctx.includes('/review'));
    assert.ok(ctx.includes('审查 PR') || ctx.includes('用途'));
  });

  it('allocates unique slash on collision', () => {
    const a = productKnowledge.createSkill(knowledgeDir, {
      title: 'A',
      slash: 'dup',
      body: 'body a long enough',
    });
    const b = productKnowledge.createSkill(knowledgeDir, {
      title: 'B',
      slash: 'dup',
      body: 'body b long enough',
    });
    assert.ok(a.ok && b.ok);
    assert.equal(a.slash, 'dup');
    assert.equal(b.slash, 'dup-2');
  });

  it('settings keeps skill management out of personal memory', () => {
    const html = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'settings.html'),
      'utf8'
    );
    assert.ok(html.includes('data-tab="memory"'), 'personal memory tab present');
    assert.ok(!html.includes('btnCreateSkill'), 'skill management belongs outside settings');
    assert.ok(!html.includes('openCreateSkillDrawer'), 'legacy skill drawer removed');
  });
});
