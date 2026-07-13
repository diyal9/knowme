/**
 * note-classify — 旧数据启发式分类
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  slug,
  heuristicClassify,
  batchHeuristic,
  needsClassify,
} = require('../src/lib/note-classify');

describe('note-classify', () => {
  it('slugs path segments', () => {
    assert.equal(slug('Tools Skills'), 'tools-skills');
  });

  it('infers category from promptGroup', () => {
    const r = heuristicClassify({
      project: 'mem_soul',
      promptGroup: 'tools/tools_skills_agent_create/skills',
      category: '',
      okfTags: [],
      tags: [],
    });
    assert.equal(r.category, 'tools');
    assert.ok(r.okfTags.length >= 1);
    assert.ok(r.changed);
  });

  it('does not overwrite existing category', () => {
    const notes = [
      {
        id: '1',
        project: 'x',
        promptGroup: 'tools/a',
        category: 'coding',
        okfTags: ['keep'],
      },
      {
        id: '2',
        project: 'flow_chaos',
        promptGroup: 'workflows/chaos',
        category: '',
        okfTags: [],
        tags: [],
      },
    ];
    const report = batchHeuristic(notes);
    assert.equal(notes[0].category, 'coding');
    assert.deepEqual(notes[0].okfTags, ['keep']);
    assert.equal(notes[1].category, 'workflows');
    assert.ok(report.updated >= 1);
    assert.ok(report.changedIds.includes('2'));
  });

  it('needsClassify detects empty fields', () => {
    assert.equal(needsClassify({ category: '', okfTags: [] }), true);
    assert.equal(needsClassify({ category: 'coding', okfTags: ['a'] }), false);
  });
});
