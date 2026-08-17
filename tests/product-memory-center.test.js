const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { currentPage } = require('./helpers/current-src');
const memory = require('../src/lib/product-memory');
const { readMainIpcBundle, readMainEntryBundle } = require('./helpers/main-ipc-bundle');

const TMP = path.join(os.tmpdir(), `knowme-product-memory-${Date.now()}`);

describe('personal memory center', () => {
  beforeEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
    memory.ensureMemory(TMP);
  });

  afterEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
  });

  it('pauses and resumes automatic capture', () => {
    memory.saveConfig(TMP, { learningEnabled: false });
    const skipped = memory.capture(TMP, {
      kind: 'telemetry',
      summary: '复制常用模板',
      meta: { action: 'copy' },
    });
    assert.equal(skipped.skipped, true);
    assert.equal(memory.status(TMP).recentCount, 0);

    memory.saveConfig(TMP, { learningEnabled: true });
    memory.capture(TMP, {
      kind: 'telemetry',
      summary: '复制常用模板',
      meta: { action: 'copy' },
    });
    assert.equal(memory.status(TMP).recentCount, 1);
  });

  it('only injects accepted inferred patterns', () => {
    const event = {
      kind: 'preference',
      summary: '偏好简洁列表',
      meta: { action: 'format-list' },
    };
    memory.capture(TMP, event);
    memory.capture(TMP, event);
    memory.capture(TMP, event);

    const pending = memory.overview(TMP).patterns[0];
    assert.equal(pending.prompt_state, 'pending');
    assert.ok(!memory.getContextForAI(TMP).includes('用户已确认的使用偏好'));

    const reviewed = memory.reviewPattern(TMP, pending.id, 'accepted');
    assert.equal(reviewed.ok, true);
    assert.ok(memory.getContextForAI(TMP).includes('偏好简洁列表'));
  });

  it('allows editing and restoring an inferred pattern', () => {
    const event = {
      kind: 'preference',
      summary: '偏好简洁列表',
      meta: { action: 'format-list' },
    };
    memory.capture(TMP, event);
    memory.capture(TMP, event);
    memory.capture(TMP, event);
    const pattern = memory.overview(TMP).patterns[0];

    const dismissed = memory.reviewPattern(TMP, pattern.id, 'dismissed', '偏好先给结论');
    assert.equal(dismissed.pattern.summary, '偏好先给结论');
    assert.equal(dismissed.pattern.prompt_state, 'dismissed');

    const restored = memory.reviewPattern(TMP, pattern.id, 'pending');
    assert.equal(restored.pattern.prompt_state, 'pending');
    assert.ok(!memory.getContextForAI(TMP).includes('偏好先给结论'));
  });

  it('clears automatic memory while preserving learning config', () => {
    memory.saveConfig(TMP, { learningEnabled: false });
    memory.saveConfig(TMP, { learningEnabled: true });
    memory.capture(TMP, {
      kind: 'telemetry',
      summary: '完成一次工作流',
      meta: { action: 'workflow' },
    });

    assert.equal(memory.clear(TMP).ok, true);
    const overview = memory.overview(TMP);
    assert.equal(overview.stats.recentCount, 0);
    assert.equal(overview.stats.patternsCount, 0);
    assert.equal(overview.config.learningEnabled, true);
  });

  it('settings surface exists separately from memory APIs', () => {
    const html = currentPage('settings.html')
    assert.match(html, /设置/)
  });

  it('does not retain raw AI prompts in the capture summary', () => {
    const adapter = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'agent-run-kernel-adapter.ts'), 'utf8')
    assert.ok(adapter.includes("summary: '完成一次 AI 对话'"));
    assert.ok(!adapter.includes('summary: `AI 生成：${prompt.slice'));
  });

  it('tray settings click does not pass MenuItem as settings tab', () => {
    const main = readMainEntryBundle();
    assert.ok(main.includes('openSettings'))
    assert.ok(main.includes("typeof tab === 'string'"));
  });
});

describe('memory signal layering (P3)', () => {
  beforeEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
    memory.ensureMemory(TMP);
  });

  afterEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
  });

  it('treats AI chat completion as telemetry without pattern promotion', () => {
    for (let i = 0; i < 5; i++) {
      memory.capture(TMP, {
        kind: 'telemetry',
        summary: '完成一次 AI 对话',
        meta: { action: 'ai-generate' },
      });
    }
    const overview = memory.overview(TMP);
    assert.equal(overview.stats.recentCount, 5);
    assert.equal(overview.stats.pendingCount, 0);
    assert.equal(overview.patterns.length, 0);
  });

  it('rejects garbage AI output summaries for pattern eligibility', () => {
    for (let i = 0; i < 3; i++) {
      memory.capture(TMP, {
        kind: 'preference',
        summary: 'AI 生成：你好',
        meta: { action: 'ai-output' },
      });
    }
    assert.equal(memory.overview(TMP).patterns.length, 0);
  });

  it('does not promote legacy habit/workflow events by default', () => {
    const event = {
      kind: 'habit',
      summary: '复制提示词：demo v0.1',
      meta: { action: 'copy' },
    };
    for (let i = 0; i < 3; i++) memory.capture(TMP, event);
    assert.equal(memory.overview(TMP).patterns.length, 0);
    assert.equal(memory.getRecent(TMP, 5).length, 3);
  });

  it('migrates old garbage pending patterns on overview', () => {
    const registry = path.join(TMP, 'patterns', 'registry.json');
    fs.writeFileSync(
      registry,
      JSON.stringify({
        patterns: [
          {
            id: 'pat_old001',
            kind: 'workflow',
            fingerprint: 'abc',
            count: 5,
            summary: '完成一次 AI 对话',
            prompt_state: 'pending',
          },
          {
            id: 'pat_old002',
            kind: 'habit',
            fingerprint: 'def',
            count: 4,
            summary: 'AI 生成：什么',
            prompt_state: 'pending',
          },
        ],
      }) + '\n',
      'utf8'
    );
    const overview = memory.overview(TMP);
    assert.equal(overview.patterns.length, 0);
    assert.ok(overview.stats.ineligibleHidden >= 2);
    const raw = JSON.parse(fs.readFileSync(registry, 'utf8')).patterns;
    assert.ok(raw.every((p) => p.prompt_state === 'ineligible'));
  });

  it('excludes telemetry from default AI context', () => {
    memory.capture(TMP, {
      kind: 'telemetry',
      summary: '完成一次 AI 对话',
      meta: { action: 'ai-generate' },
    });
    const ctx = memory.getContextForAI(TMP);
    assert.ok(!ctx.includes('近期使用记忆'));
    assert.ok(!ctx.includes('完成一次 AI 对话'));
  });

  it('builds memory insights from confirmed preferences only', () => {
    const event = { kind: 'preference', summary: '偏好先给结论再展开', meta: {} };
    for (let i = 0; i < 3; i++) memory.capture(TMP, event);
    const pattern = memory.overview(TMP).patterns[0];
    memory.reviewPattern(TMP, pattern.id, 'accepted');

    const insights = memory.buildMemoryInsights(TMP, {
      userPrompt: '回复用中文，简洁',
    });
    assert.equal(insights.hasConfirmedPreferences, true);
    assert.ok(insights.collaborationPrompt.includes('偏好先给结论再展开'));
    assert.ok(insights.collaborationPrompt.includes('回复用中文'));
    assert.equal(insights.confirmedCount, 1);
  });

  it('buildEffectivePersonalization unifies prompt + habits and respects limit', () => {
    const event = { kind: 'preference', summary: '偏好先给结论再展开', meta: {} };
    for (let i = 0; i < 3; i++) memory.capture(TMP, event);
    const pattern = memory.overview(TMP).patterns[0];
    memory.reviewPattern(TMP, pattern.id, 'accepted');

    const pack = memory.buildEffectivePersonalization(TMP, {
      userPrompt: '回复用中文，简洁',
    }, { limit: 1 });

    assert.equal(pack.applied.length, 1);
    assert.equal(pack.omitted.length, 1);
    assert.equal(pack.applied[0].kind, 'user_prompt');
    assert.equal(pack.omitted[0].reason, 'limit');
    assert.ok(pack.promptBlock.includes('【本轮协作偏好】'));
    assert.ok(pack.promptBlock.includes('回复用中文'));
    assert.ok(!pack.promptBlock.includes('完成一次 AI 对话'));

    const withoutPrompt = memory.buildEffectivePersonalization(TMP, {
      userPrompt: '回复用中文，简洁',
    }, { limit: 4, includeUserPrompt: false });
    assert.equal(withoutPrompt.applied.length, 1);
    assert.equal(withoutPrompt.applied[0].kind, 'confirmed_habit');
    assert.ok(withoutPrompt.promptBlock.includes('偏好先给结论再展开'));
  });

  it('buildEffectivePersonalization returns empty when nothing confirmed', () => {
    memory.capture(TMP, {
      kind: 'telemetry',
      summary: '完成一次 AI 对话',
      meta: {},
    });
    const pack = memory.buildEffectivePersonalization(TMP, {});
    assert.equal(pack.count, 0);
    assert.equal(pack.promptBlock, '');
    assert.deepEqual(pack.applied, []);
  });

  it('buildWorkHints matches confirmed preference topics without inventing facts', () => {
    const event = { kind: 'preference', summary: '会议总结优先给待办', meta: {} };
    for (let i = 0; i < 3; i++) memory.capture(TMP, event);
    const pattern = memory.overview(TMP).patterns[0];
    memory.reviewPattern(TMP, pattern.id, 'accepted');

    const hints = memory.buildWorkHints(TMP, {
      topic: '会议',
      label: '会议总结',
    });
    assert.ok(hints.hints.length >= 1);
    assert.equal(hints.source, 'product-memory');
    assert.ok(hints.hints[0].label.includes('会议'));
    assert.ok(hints.hints[0].source);
    assert.ok(hints.hints[0].reason);
  });

  it('returns empty insights when no confirmed preferences exist', () => {
    memory.capture(TMP, {
      kind: 'telemetry',
      summary: '完成一次 AI 对话',
      meta: {},
    });
    const insights = memory.buildMemoryInsights(TMP, {});
    assert.equal(insights.hasConfirmedPreferences, false);
    assert.equal(insights.collaborationPrompt, '');
    assert.deepEqual(insights.confirmedPreferences, []);
  });

  it('blocks accepting ineligible patterns', () => {
    const registry = path.join(TMP, 'patterns', 'registry.json');
    fs.writeFileSync(
      registry,
      JSON.stringify({
        patterns: [
          {
            id: 'pat_bad001',
            kind: 'workflow',
            fingerprint: 'xyz',
            count: 3,
            summary: '完成一次 AI 对话',
            prompt_state: 'pending',
          },
        ],
      }) + '\n',
      'utf8'
    );
    memory.migratePatterns(TMP);
    const result = memory.reviewPattern(TMP, 'pat_bad001', 'accepted');
    assert.equal(result.ok, false);
  });
});
