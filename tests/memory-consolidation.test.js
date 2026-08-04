'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const memory = require('../src/lib/product-memory');
const consolidation = require('../src/lib/memory-consolidation');

const TMP = path.join(os.tmpdir(), `knowme-memory-consolidation-${Date.now()}`);

describe('memory consolidation and work hints', () => {
  beforeEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
    memory.ensureMemory(TMP);
    memory.saveConfig(TMP, { learningEnabled: true });
  });

  afterEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
  });

  it('filters garbage events from consolidation', () => {
    memory.capture(TMP, {
      kind: 'telemetry',
      summary: '完成一次 AI 对话',
      meta: { action: 'ai-generate' },
    });
    memory.capture(TMP, {
      kind: 'correction',
      summary: '总结格式不对，应先列待办',
      meta: {},
    });

    const result = consolidation.consolidate(TMP);
    assert.equal(result.ok, true);
    const fields = result.consolidated.items.map((item) => item.field);
    assert.ok(!fields.includes('preference'));
    assert.ok(result.consolidated.items.some((item) => item.field === 'openProblem'));
  });

  it('extracts current project from telemetry activity', () => {
    memory.capture(TMP, {
      kind: 'telemetry',
      summary: '复制提示词：KnowMe v0.2',
      meta: { action: 'copy' },
    });

    const result = consolidation.consolidate(TMP);
    const project = result.consolidated.items.find((item) => item.field === 'currentProject');
    assert.ok(project);
    assert.equal(project.text, 'KnowMe');
    assert.equal(project.confidence, 'activity');
  });

  it('includes confirmed preferences as confirmed work memory', () => {
    const event = { kind: 'preference', summary: '会议总结优先给待办', meta: {} };
    for (let i = 0; i < 3; i++) memory.capture(TMP, event);
    const pattern = memory.overview(TMP, { consolidate: false }).patterns[0];
    memory.reviewPattern(TMP, pattern.id, 'accepted');

    const result = consolidation.consolidate(TMP);
    const pref = result.consolidated.items.find(
      (item) => item.field === 'preference' && item.confidence === 'confirmed'
    );
    assert.ok(pref);
    assert.equal(pref.source.type, 'pattern');
  });

  it('deduplicates items on re-consolidation', () => {
    memory.capture(TMP, {
      kind: 'correction',
      summary: '应先列待办再写背景',
      meta: {},
    });
    consolidation.consolidate(TMP);
    memory.capture(TMP, {
      kind: 'correction',
      summary: '应先列待办再写背景',
      meta: {},
    });
    const second = consolidation.consolidate(TMP);
    const problems = second.consolidated.items.filter((item) => item.field === 'openProblem');
    assert.equal(problems.length, 1);
  });

  it('clears consolidated file with memory clear', () => {
    memory.capture(TMP, {
      kind: 'correction',
      summary: '标题层级不对',
      meta: {},
    });
    consolidation.consolidate(TMP);
    assert.ok(fs.existsSync(path.join(TMP, 'working', 'consolidated.json')));

    memory.clear(TMP);
    assert.ok(!fs.existsSync(path.join(TMP, 'working', 'consolidated.json')));
  });

  it('buildWorkHints returns source and empty without basis', () => {
    memory.capture(TMP, {
      kind: 'telemetry',
      summary: '完成一次 AI 对话',
      meta: {},
    });
    consolidation.consolidate(TMP);

    const emptyHints = memory.buildWorkHints(TMP, { topic: '会议' });
    assert.deepEqual(emptyHints.hints, []);

    const event = { kind: 'preference', summary: '会议总结优先给待办', meta: {} };
    for (let i = 0; i < 3; i++) memory.capture(TMP, event);
    const pattern = memory.overview(TMP, { consolidate: false }).patterns[0];
    memory.reviewPattern(TMP, pattern.id, 'accepted');
    consolidation.consolidate(TMP);

    const hints = memory.buildWorkHints(TMP, { topic: '会议', label: '会议总结' });
    assert.ok(hints.hints.length >= 1);
    assert.ok(hints.hints[0].source);
    assert.ok(hints.hints[0].reason);
  });

  it('injects consolidated work memory into AI context when workContext set', () => {
    memory.capture(TMP, {
      kind: 'workflow_choice',
      summary: '选择先写 QA 计划再开发',
      meta: {},
    });
    consolidation.consolidate(TMP);

    const ctx = memory.getContextForAI(TMP, '', {
      includeRecent: true,
      workContext: 'workbench',
    });
    assert.ok(ctx.includes('工作记忆整合'));
    assert.ok(ctx.includes('决策'));
  });

  it('overview includes consolidated summary', () => {
    memory.capture(TMP, {
      kind: 'correction',
      summary: '回复太长，需要更短',
      meta: {},
    });
    const overview = memory.overview(TMP);
    assert.ok(overview.consolidated);
    assert.ok(overview.stats.consolidatedCount >= 1);
  });

  it('builds traceable context items without promoting activity to preference', () => {
    memory.capture(TMP, {
      kind: 'telemetry',
      summary: '复制提示词：KnowMe v0.2',
      meta: { action: 'copy' },
    });
    consolidation.consolidate(TMP);
    const items = memory.buildContextItems(TMP, {
      userProfile: {
        userProfile: '独立开发者',
        userPrompt: '先给结论',
      },
      workContext: { topic: 'KnowMe' },
    });
    assert.equal(items[0].type, 'profile');
    assert.ok(items.some(item => item.type === 'preference' && item.confidence === 'explicit'));
    assert.ok(items.some(item => item.type === 'work_memory' && item.confidence === 'activity'));
    assert.ok(items.every(item => item.source && item.reason));
    assert.equal(items.some(item => item.type === 'preference' && item.confidence === 'activity'), false);
  });

  it('exposes work hints as context toggles carrying real content', () => {
    const event = { kind: 'preference', summary: '会议总结优先给待办', meta: {} };
    for (let i = 0; i < 3; i++) memory.capture(TMP, event);
    const pattern = memory.overview(TMP, { consolidate: false }).patterns[0];
    memory.reviewPattern(TMP, pattern.id, 'accepted');
    const hints = memory.buildWorkHints(TMP, { topic: '会议', label: '会议总结' });
    const first = hints.hints[0];
    assert.ok(first.id, 'toggle needs a stable id');
    assert.ok(first.text, 'toggle carries the content it will contribute');
    assert.equal(typeof first.defaultOn, 'boolean');
    assert.equal(first.action, undefined, 'no fill action remains');
    assert.equal(first.payload, undefined, 'no template payload remains');
    assert.ok(hints.hints.every(hint => hint.type !== 'collaboration'), 'hollow collaboration hint removed');
  });

  it('shows one habit once instead of repeating it across toggle types', () => {
    const event = { kind: 'preference', summary: '会议总结优先给待办', meta: {} };
    for (let i = 0; i < 3; i++) memory.capture(TMP, event);
    const pattern = memory.overview(TMP, { consolidate: false }).patterns[0];
    memory.reviewPattern(TMP, pattern.id, 'accepted');
    consolidation.consolidate(TMP);
    const hints = memory.buildWorkHints(TMP, {
      topic: '会议',
      label: '会议总结',
      userProfile: { userPrompt: '先给结论，再给依据' },
    }).hints;
    const texts = hints.map(hint => hint.text.replace(/\s+/g, ''));
    assert.equal(new Set(texts).size, texts.length, 'toggles carry distinct content');
    assert.equal(
      hints.filter(hint => hint.label.includes('会议总结优先给待办')).length,
      1,
      'the same confirmed habit surfaces once',
    );
  });

  it('marks collaboration preferences as default-on and shows their real text', () => {
    const hints = memory.buildWorkHints(TMP, {
      topic: '会议',
      label: '会议总结',
      userProfile: { userPrompt: '先给结论，再给依据' },
    });
    const prefs = hints.hints.find(hint => hint.type === 'collaboration_prefs');
    assert.ok(prefs, 'collaboration preferences surface as a toggle');
    assert.equal(prefs.defaultOn, true, 'reflects that it is already applied every turn');
    assert.ok(prefs.label.includes('先给结论'), 'label shows the actual preference, not a category name');
  });
});
