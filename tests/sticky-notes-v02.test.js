/**
 * prompt-sections + prompt-okf + note migration
 */
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const promptSections = require('../src/lib/prompt-sections');
const promptOkf = require('../src/lib/prompt-okf');
const noteVersions = require('../src/lib/note-versions');
const noteDiff = require('../src/lib/note-diff');

const TMP = path.join(os.tmpdir(), `sticky-prompt-test-${Date.now()}`);

describe('prompt-sections', () => {
  it('assembles and parses five sections', () => {
    const sections = {
      role: '你是助手',
      context: '背景信息',
      task: '完成任务',
      output: 'JSON',
      criteria: '准确',
    };
    const content = promptSections.assembleContent(sections);
    assert.ok(content.includes('## 角色'));
    assert.ok(content.includes('你是助手'));
    const parsed = promptSections.parseSectionsFromContent(content);
    assert.equal(parsed.role, '你是助手');
    assert.equal(parsed.task, '完成任务');
  });

  it('migrateNoteFields adds v0.2 defaults', () => {
    const note = { id: 'n_1', content: 'hello' };
    const dirty = promptSections.migrateNoteFields(note);
    assert.equal(dirty, true);
    assert.equal(note.category, '');
    assert.deepEqual(note.okfTags, []);
    assert.equal(note.editorMode, 'free');
    assert.equal(note.parentNoteId, null);
  });
});

describe('note-diff', () => {
  it('diffs lines', () => {
    const hunks = noteDiff.diffLines('a\nb', 'a\nc');
    assert.ok(hunks.some(h => h.type === 'del' && h.line === 'b'));
    assert.ok(hunks.some(h => h.type === 'add' && h.line === 'c'));
  });
});

describe('note-versions', () => {
  it('collects version chain', () => {
    const notes = [
      { id: 'a', parentNoteId: null, version: '1.0', createdAt: '2026-01-01' },
      { id: 'b', parentNoteId: 'a', version: '1.1', createdAt: '2026-01-02' },
      { id: 'c', parentNoteId: 'b', version: '1.2', createdAt: '2026-01-03' },
    ];
    const chain = noteVersions.getNoteVersions('c', notes, (id) => notes.find(n => n.id === id));
    assert.equal(chain.length, 3);
    assert.equal(chain[0].id, 'a');
    assert.equal(chain[2].id, 'c');
  });
});

describe('prompt-okf', () => {
  const knowledgeDir = path.join(TMP, 'knowledge');

  beforeEach(() => {
    fs.mkdirSync(knowledgeDir, { recursive: true });
    fs.writeFileSync(
      path.join(knowledgeDir, 'index.md'),
      '---\nokf_version: "0.1"\n---\n\n# Knowledge\n',
      'utf8'
    );
    fs.writeFileSync(path.join(knowledgeDir, 'log.md'), '# Log\n', 'utf8');
  });

  afterEach(() => {
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch {}
  });

  it('promote and instantiate roundtrip', () => {
    const note = {
      id: 'n_test',
      project: '测试提示词',
      version: '1.0',
      content: '## 角色\n助手\n\n## 任务\n写代码',
      okfTags: ['coding'],
      tags: [],
    };
    const promoted = promptOkf.promoteNoteToConcept(knowledgeDir, note);
    assert.ok(promoted.ok, promoted.error);
    assert.ok(promoted.conceptId);

    const inst = promptOkf.instantiateConcept(knowledgeDir, promoted.conceptId);
    assert.ok(inst.ok, inst.error);
    assert.ok(inst.note.content.includes('写代码'));
    assert.equal(inst.note.okfConceptId, promoted.conceptId);
  });
});
