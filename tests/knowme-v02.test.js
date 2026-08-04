/**
 * prompt-sections + note migration
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');

const promptSections = require('../src/lib/prompt-sections');
const noteVersions = require('../src/lib/note-versions');
const noteDiff = require('../src/lib/note-diff');

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
    assert.equal(note.editorMode, 'plain');
    assert.equal(note.mdView, 'edit');
    assert.equal(note.parentNoteId, null);
  });

  it('migrateNoteFields merges structured sections into content', () => {
    const note = {
      id: 'n_2',
      content: '',
      editorMode: 'structured',
      sections: { role: '助手', task: '写代码', context: '', output: '', criteria: '' },
    };
    const dirty = promptSections.migrateNoteFields(note);
    assert.equal(dirty, true);
    assert.equal(note.editorMode, 'plain');
    assert.equal(note.mdView, 'edit');
    assert.equal(note.sections, null);
    assert.ok(note.content.includes('## 角色'));
    assert.ok(note.content.includes('助手'));
    assert.ok(note.content.includes('写代码'));
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
