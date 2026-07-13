/**
 * Product OKF knowledge + memory (userData, not repo brain/)
 */
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const productKnowledge = require('../src/lib/product-knowledge');
const productMemory = require('../src/lib/product-memory');

const TMP = path.join(os.tmpdir(), `sticky-notes-product-test-${Date.now()}`);

describe('product knowledge OKF', () => {
  const knowledgeDir = path.join(TMP, 'knowledge');
  const seedDir = path.join(__dirname, '..', 'src', 'assets', 'knowledge-seed');

  beforeEach(() => {
    fs.mkdirSync(knowledgeDir, { recursive: true });
  });

  it('seeds from assets on first run', () => {
    const r = productKnowledge.ensureKnowledge(knowledgeDir, seedDir);
    assert.equal(r.seeded, true);
    assert.ok(fs.existsSync(path.join(knowledgeDir, 'index.md')));
    const lint = productKnowledge.lint(knowledgeDir);
    assert.ok(lint.ok, JSON.stringify(lint.errors));
  });

  it('export and import roundtrip', () => {
    productKnowledge.ensureKnowledge(knowledgeDir, seedDir);
    const exportDir = path.join(TMP, 'export-bundle');
    const ex = productKnowledge.exportBundle(knowledgeDir, exportDir);
    assert.ok(ex.ok, ex.error);

    const importDir = path.join(TMP, 'knowledge-imported');
    fs.mkdirSync(importDir, { recursive: true });
    const im = productKnowledge.importBundle(importDir, exportDir);
    assert.ok(im.ok, im.error);
  });

  it('lists knowledge categories from seed', () => {
    productKnowledge.ensureKnowledge(knowledgeDir, seedDir);
    const cats = productKnowledge.listCategories(knowledgeDir);
    assert.ok(cats.length >= 2, 'should have concepts + processes');
    const ids = cats.map((c) => c.id);
    assert.ok(ids.includes('concepts'));
    assert.ok(ids.includes('processes'));
    const concepts = cats.find((c) => c.id === 'concepts');
    assert.ok(concepts.count >= 1);
    assert.ok(concepts.items.some((i) => i.title));
    assert.equal(concepts.label, '概念');
  });
});

describe('product memory', () => {
  const memoryDir = path.join(TMP, 'memory');

  it('captures and returns context', () => {
    productMemory.ensureMemory(memoryDir);
    productMemory.capture(memoryDir, {
      kind: 'habit',
      summary: '测试复制提示词',
      meta: { test: true },
    });
    const recent = productMemory.getRecent(memoryDir, 5);
    assert.ok(recent.length >= 1);
    const ctx = productMemory.getContextForAI(memoryDir);
    assert.ok(ctx.includes('测试复制'));
    const st = productMemory.status(memoryDir);
    assert.ok(st.recentCount >= 1);
  });
});

afterEach(() => {
  try {
    fs.rmSync(TMP, { recursive: true, force: true });
  } catch {}
});
