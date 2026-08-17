'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MAX_WORKING = 500;
const PROMPT_THRESHOLD = 3;
const DEFAULT_CONFIG = Object.freeze({ learningEnabled: true });

/** Kinds that may become pattern candidates (preference signal). */
const PREFERENCE_KINDS = new Set([
  'correction',
  'preference',
  'workflow_choice',
  'product',
]);

/** Kinds that are usage telemetry only. */
const TELEMETRY_KINDS = new Set(['telemetry', 'usage']);

/** Summaries that must never become habits or stable context. */
const GARBAGE_SUMMARY_RES = [
  /^完成一次 AI 对话$/,
  /^AI 生成[：:]/,
  /^复制提示词[：:]/,
  /^(收藏|取消收藏)[：:]/,
  /^导入 prompt_space/,
  /^本地整理旧数据分类/,
  /^完成一次工作流$/,
  /^(你好|什么|hello|hi|hey)$/i,
];

function ensureMemory(memoryDir) {
  const dirs = [
    'episodes',
    'working',
    'patterns',
    'summaries/daily',
    'summaries/weekly',
    'summaries/monthly',
  ];
  for (const d of dirs) {
    fs.mkdirSync(path.join(memoryDir, d), { recursive: true });
  }
  const index = path.join(memoryDir, 'index.md');
  if (!fs.existsSync(index)) {
    fs.writeFileSync(
      index,
      '# KnowMe Memory\n\n本地使用记忆（不入云、可随应用数据目录备份）。\n',
      'utf8'
    );
  }
  const patterns = path.join(memoryDir, 'patterns', 'registry.json');
  if (!fs.existsSync(patterns)) {
    fs.writeFileSync(patterns, '{"patterns":[]}\n', 'utf8');
  }
  migratePatterns(memoryDir);
  return memoryDir;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function loadConfig(memoryDir) {
  const file = path.join(memoryDir, 'config.json');
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function saveConfig(memoryDir, patch = {}) {
  ensureMemory(memoryDir);
  const next = {
    ...loadConfig(memoryDir),
    learningEnabled: patch.learningEnabled !== false,
  };
  fs.writeFileSync(
    path.join(memoryDir, 'config.json'),
    JSON.stringify(next, null, 2) + '\n',
    'utf8'
  );
  return next;
}

function appendJsonl(file, record) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(record) + '\n', 'utf8');
}

function trimJsonl(file, max) {
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
  if (lines.length > max) {
    fs.writeFileSync(file, lines.slice(-max).join('\n') + '\n', 'utf8');
  }
}

function fingerprint(kind, summary, meta = {}) {
  const blob = kind + '|' + JSON.stringify(meta) + '|' + summary.slice(0, 200);
  return crypto.createHash('sha256').update(blob).digest('hex').slice(0, 16);
}

function isGarbageSummary(summary) {
  const text = String(summary || '').trim();
  if (!text || text.length < 4) return true;
  return GARBAGE_SUMMARY_RES.some((re) => re.test(text));
}

function resolveEventSignal(event = {}) {
  if (event.signal === 'telemetry' || event.signal === 'preference') {
    return event.signal;
  }
  if (TELEMETRY_KINDS.has(event.kind)) return 'telemetry';
  if (PREFERENCE_KINDS.has(event.kind)) return 'preference';
  // Legacy kinds: habit/workflow were over-promoted; treat as telemetry by default.
  if (event.kind === 'habit' || event.kind === 'workflow') return 'telemetry';
  if (event.kind === 'correction' || event.kind === 'product') return 'preference';
  return 'telemetry';
}

function isPatternEligible(event = {}) {
  if (resolveEventSignal(event) !== 'preference') return false;
  const summary = String(event.summary || '').trim();
  if (isGarbageSummary(summary)) return false;
  return true;
}

function isPatternEntryEligible(entry = {}) {
  if (entry.eligibility === 'ineligible') return false;
  if (isGarbageSummary(entry.summary)) return false;
  if (entry.signal === 'telemetry') return false;
  if (PREFERENCE_KINDS.has(entry.kind)) return true;
  // Legacy entries without signal: only keep if not garbage and kind hints preference.
  if (entry.kind === 'correction' || entry.kind === 'product') return true;
  if (entry.kind === 'preference' || entry.kind === 'workflow_choice') return true;
  return false;
}

function loadPatterns(memoryDir) {
  const p = path.join(memoryDir, 'patterns', 'registry.json');
  try {
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    return Array.isArray(data.patterns) ? data.patterns : [];
  } catch {
    return [];
  }
}

function savePatterns(memoryDir, patterns) {
  const p = path.join(memoryDir, 'patterns', 'registry.json');
  fs.writeFileSync(p, JSON.stringify({ patterns }, null, 2) + '\n', 'utf8');
}

function migratePatterns(memoryDir) {
  const patterns = loadPatterns(memoryDir);
  let changed = 0;
  const now = new Date().toISOString();
  for (const entry of patterns) {
    if (!isPatternEntryEligible(entry)) {
      if (entry.prompt_state === 'pending' || entry.prompt_state === 'accepted') {
        if (entry.prompt_state === 'pending') {
          entry.prompt_state = 'ineligible';
          entry.eligibility = 'ineligible';
          entry.migrated_at = now;
          changed++;
        } else if (entry.prompt_state === 'accepted' && isGarbageSummary(entry.summary)) {
          entry.eligibility = 'ineligible';
          entry.migrated_at = now;
          changed++;
        }
      }
    } else if (!entry.signal && PREFERENCE_KINDS.has(entry.kind)) {
      entry.signal = 'preference';
      changed++;
    }
  }
  if (changed) savePatterns(memoryDir, patterns);
  return { migrated: changed };
}

function bumpPattern(memoryDir, event) {
  const { kind, summary, meta = {} } = event;
  const fp = fingerprint(kind, summary, meta);
  const patterns = loadPatterns(memoryDir);
  const now = new Date().toISOString();
  let entry = patterns.find((p) => p.fingerprint === fp);
  if (entry) {
    entry.count = (entry.count || 0) + 1;
    entry.last_seen = now;
    entry.signal = 'preference';
  } else {
    entry = {
      id: `pat_${fp.slice(0, 8)}`,
      kind,
      signal: 'preference',
      eligibility: 'eligible',
      fingerprint: fp,
      count: 1,
      summary: summary.slice(0, 300),
      meta,
      first_seen: now,
      last_seen: now,
      prompt_state: 'pending',
    };
    patterns.push(entry);
  }
  savePatterns(memoryDir, patterns);
  if (
    entry.count >= PROMPT_THRESHOLD &&
    entry.prompt_state === 'pending' &&
    isPatternEntryEligible(entry)
  ) {
    appendJsonl(path.join(memoryDir, 'patterns', 'pending_prompts.jsonl'), {
      ts: now,
      pattern_id: entry.id,
      kind: entry.kind,
      count: entry.count,
      summary: entry.summary,
    });
  }
  return entry;
}

function capture(memoryDir, event) {
  ensureMemory(memoryDir);
  if (!loadConfig(memoryDir).learningEnabled) {
    return { skipped: true, reason: 'learning-disabled' };
  }
  const signal = resolveEventSignal(event);
  const id = crypto.randomUUID();
  const record = {
    id,
    ts: new Date().toISOString(),
    kind: event.kind || 'telemetry',
    signal,
    summary: (event.summary || '').slice(0, 500),
    meta: event.meta || {},
  };
  const dayDir = path.join(memoryDir, 'episodes', today());
  appendJsonl(path.join(dayDir, 'app.jsonl'), record);

  // Recent transparency log: all captured events.
  const working = path.join(memoryDir, 'working', 'recent.jsonl');
  appendJsonl(working, record);
  trimJsonl(working, MAX_WORKING);

  if (isPatternEligible(event) && record.summary) {
    bumpPattern(memoryDir, record);
  }
  return record;
}

function getRecent(memoryDir, n = 15) {
  const working = path.join(memoryDir, 'working', 'recent.jsonl');
  if (!fs.existsSync(working)) return [];
  const lines = fs.readFileSync(working, 'utf8').split('\n').filter(Boolean);
  return lines
    .slice(-n)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function getAcceptedPatterns(memoryDir) {
  migratePatterns(memoryDir);
  return loadPatterns(memoryDir)
    .filter(
      (p) =>
        p.prompt_state === 'accepted' &&
        isPatternEntryEligible(p) &&
        String(p.summary || '').trim()
    )
    .sort((a, b) => (b.count || 0) - (a.count || 0));
}

function getVisiblePatterns(memoryDir) {
  migratePatterns(memoryDir);
  return loadPatterns(memoryDir).filter(
    (p) => p.prompt_state !== 'ineligible' && isPatternEntryEligible(p)
  );
}

function getContextForAI(memoryDir, knowledgeSnippet = '', options = {}) {
  const includeRecent = options.includeRecent === true;
  const workContext = String(options.workContext || '').trim();
  const accepted = getAcceptedPatterns(memoryDir).slice(0, 8);
  const parts = [];
  parts.push(
    '## 用户知识库摘要\n' +
      (knowledgeSnippet
        ? knowledgeSnippet
        : '（知识库为空，暂无任何条目。若用户询问知识库相关内容，请如实告知"知识库暂无相关内容"，不要编造任何条目。）')
  );
  if (accepted.length) {
    parts.push(
      '## 用户已确认的使用偏好（长期记忆，可据此调整协作方式）\n' +
        accepted.map((p) => `- ${p.summary}`).join('\n')
    );
  }
  if (includeRecent && workContext) {
    const consolidation = lazyConsolidation();
    const workMemory = consolidation.formatForContext(
      consolidation.loadConsolidated(memoryDir)
    );
    if (workMemory) {
      parts.push(
        '## 工作记忆整合（来自近期活动与已确认偏好，不是项目知识库事实）\n' +
          workMemory
      );
    } else {
      const recent = getRecent(memoryDir, 5).filter(
        (r) => resolveEventSignal(r) === 'telemetry'
      );
      if (recent.length) {
        parts.push(
          '## 近期工作活动（仅供参考，不是用户偏好或事实，禁止当作知识引用）\n' +
            recent.map((r) => `- ${r.summary}`).join('\n')
        );
      }
    }
  }
  return parts.join('\n\n').slice(0, 3500);
}

function lazyConsolidation() {
  return require('./memory-consolidation');
}

function buildMemoryInsights(memoryDir, userProfile = {}) {
  migratePatterns(memoryDir);
  const accepted = getAcceptedPatterns(memoryDir).slice(0, 12);
  const profile = String(userProfile.about || userProfile.userProfile || '').trim();
  const promptPref = String(userProfile.prompt || userProfile.userPrompt || '').trim();
  const collaborationLines = [];
  if (promptPref) {
    collaborationLines.push(`用户主动填写的协作偏好：${promptPref.slice(0, 400)}`);
  }
  for (const p of accepted.slice(0, 6)) {
    collaborationLines.push(`已确认习惯：${p.summary}`);
  }
  const collaborationPrompt = collaborationLines.length
    ? [
        '【KnowMe 已确认协作提示】',
        '以下信息来自用户主动填写或已确认习惯，可据此更快给出建议；不得扩展或编造未列出的事实。',
        ...collaborationLines.map((line) => `- ${line}`),
      ].join('\n')
    : '';
  // 供界面展示：只给人读得懂的偏好条目，不暴露注入用的指令框架
  const collaborationDetail = collaborationLines.join('\n');
  // 供界面展示协作偏好的实际内容，而不是「协作偏好」这类分类名
  const collaborationSummary = [
    promptPref,
    ...accepted.slice(0, 6).map((p) => String(p.summary || '').trim()),
  ]
    .filter(Boolean)
    .join('；')
    .slice(0, 160);
  return {
    hasConfirmedPreferences: accepted.length > 0,
    confirmedCount: accepted.length,
    confirmedPreferences: accepted.map((p) => ({
      id: p.id,
      summary: p.summary,
      kind: p.kind,
      count: p.count || 1,
    })),
    profileSnippet: profile.slice(0, 300),
    collaborationPrompt,
    collaborationSummary,
    collaborationDetail,
  };
}

/**
 * 本轮生效个性化包：普通对话与快捷入口共用。
 * 仅含手填偏好与已确认习惯，不含 telemetry。
 */
function buildEffectivePersonalization(memoryDir, userProfile = {}, options = {}) {
  const limit = Math.max(1, Math.min(8, Number(options.limit) || 4));
  const includeUserPrompt = options.includeUserPrompt !== false;
  const insights = buildMemoryInsights(memoryDir, userProfile);
  const items = [];
  const promptPref = String(userProfile.prompt || userProfile.userPrompt || '').trim();

  if (includeUserPrompt && promptPref) {
    items.push({
      id: 'user_prompt',
      kind: 'user_prompt',
      text: promptPref.slice(0, 240),
      source: { type: 'settings', id: 'userPrompt', label: '协作偏好' },
    });
  }
  for (const pref of insights.confirmedPreferences) {
    const text = String(pref.summary || '').trim();
    if (!text) continue;
    items.push({
      id: `habit:${pref.id}`,
      kind: 'confirmed_habit',
      text: text.slice(0, 240),
      source: { type: 'pattern', id: pref.id, label: '已确认习惯' },
    });
  }

  const applied = items.slice(0, limit);
  const omitted = items.slice(limit).map((item) => ({
    id: item.id,
    text: item.text,
    reason: 'limit',
  }));

  const promptBlock = applied.length
    ? [
        '【本轮协作偏好】',
        '以下来自用户设置或已确认习惯；据此调整协作方式，不得编造未列出的事实。',
        ...applied.map((item) => `- ${item.text}`),
      ].join('\n')
    : '';

  return {
    items,
    applied,
    omitted,
    promptBlock,
    count: applied.length,
  };
}

function buildContextItems(memoryDir, {
  userProfile = {},
  workContext = {},
  sessionSummary = '',
} = {}) {
  const insights = buildMemoryInsights(memoryDir, userProfile)
  const consolidation = lazyConsolidation()
  const consolidated = consolidation.loadConsolidated(memoryDir)
  const items = []

  const profile = String(
    userProfile.userProfile || userProfile.about || ''
  ).trim()
  const prompt = String(
    userProfile.userPrompt || userProfile.prompt || ''
  ).trim()
  const industry = String(userProfile.industry || '').trim()
  if (industry) {
    let industryText = ''
    try {
      const industryProfile = require('./industry-profile')
      industryText = industryProfile.formatIndustryProfileText(industry)
    } catch {
      industryText = `用户所属行业：${industry}`
    }
    if (industryText) {
      items.push({
        id: 'profile:industry',
        type: 'profile',
        text: industryText,
        scope: 'global',
        confidence: 'explicit',
        source: { type: 'profile', id: 'user_industry', label: '行业' },
        reason: 'explicit_user_industry',
        sensitivity: 'local',
      })
    }
  }
  if (profile) {
    items.push({
      id: 'profile:user',
      type: 'profile',
      text: profile,
      scope: 'global',
      confidence: 'explicit',
      source: { type: 'profile', id: 'user_profile', label: '关于我' },
      reason: 'explicit_user_profile',
      sensitivity: 'local',
    })
  }
  if (prompt) {
    items.push({
      id: 'profile:collaboration',
      type: 'preference',
      text: prompt,
      scope: 'global',
      confidence: 'explicit',
      source: { type: 'profile', id: 'user_prompt', label: '协作偏好' },
      reason: 'explicit_collaboration_preference',
      sensitivity: 'local',
    })
  }
  for (const pref of insights.confirmedPreferences.slice(0, 8)) {
    items.push({
      id: `pattern:${pref.id}`,
      type: 'preference',
      text: pref.summary,
      scope: 'global',
      confidence: 'confirmed',
      source: { type: 'pattern', id: pref.id, label: '已确认习惯' },
      reason: 'confirmed_preference',
      sensitivity: 'local',
    })
  }

  const topic = String(
    workContext.topic || workContext.action || workContext.label || ''
  ).trim()
  const project = String(workContext.project || '').trim()
  for (const item of consolidated.items || []) {
    if (!item || (item.confidence === 'activity' && !topic && !project)) continue
    if (
      item.field !== 'preference' &&
      !consolidation.matchWorkContext(item, workContext)
    ) {
      continue
    }
    items.push({
      id: `work_memory:${item.id}`,
      type: 'work_memory',
      text: item.text,
      scope: project ? 'project' : 'session',
      confidence: item.confidence,
      source: {
        type: item.source?.type || 'work_memory',
        id: item.id,
        label: item.source?.summary || '工作记忆整合',
      },
      staleAt: item.staleAt || null,
      reason: topic || project ? 'matched_current_work' : 'current_work_memory',
      sensitivity: 'local',
    })
  }
  const session = String(sessionSummary || '').trim()
  if (session) {
    items.push({
      id: 'session:summary',
      type: 'session',
      text: session.slice(0, 3000),
      scope: 'session',
      confidence: 'derived',
      source: { type: 'session', id: 'active_session', label: '当前 Session 摘要' },
      reason: 'active_session',
      sensitivity: 'local',
    })
  }
  return items
}

const WORK_CONTEXT_LIMIT = 3;

const WORK_MEMORY_REASONS = {
  confirmed: '你已确认过的工作记忆。',
  activity: '来自最近的工作活动信号，尚未确认。',
  derived: '从近期工作内容推断，尚未确认。',
};

/**
 * 产出「本轮上下文开关」列表。每一项都携带真实内容（text），
 * 勾选与取消须分别改变发给模型的内容，因此不再产出 action/payload 模板句。
 */
function buildWorkHints(memoryDir, workContext = {}) {
  const consolidation = lazyConsolidation();
  const consolidated = consolidation.loadConsolidated(memoryDir);
  const insights = buildMemoryInsights(memoryDir, workContext.userProfile || {});
  const hints = [];
  const topic = String(workContext.topic || workContext.action || '').trim().toLowerCase();
  const seenIds = new Set();
  // 同一条习惯可能同时命中偏好与工作记忆，只按 id 去重会让用户看到重复选项
  const seenText = new Set();
  const normalize = (value) => String(value || '').replace(/\s+/g, '').toLowerCase();

  function pushHint(hint) {
    if (!hint.text || seenIds.has(hint.id)) return;
    const key = normalize(hint.text);
    if (key && seenText.has(key)) return;
    seenIds.add(hint.id);
    if (key) seenText.add(key);
    hints.push(hint);
  }

  // 协作偏好当前每轮都会注入，默认勾选以如实反映现状；取消勾选即本轮不注入
  if (insights.collaborationPrompt && insights.collaborationSummary) {
    pushHint({
      id: 'collab:prefs',
      type: 'collaboration_prefs',
      label: insights.collaborationSummary,
      text: insights.collaborationPrompt,
      detail: insights.collaborationDetail,
      defaultOn: true,
      reason: '这是你填写或已确认的协作偏好，当前每轮对话都会生效；取消勾选可让本轮不使用。',
      source: {
        type: 'profile',
        id: 'collaboration_prompt',
        text: insights.collaborationSummary,
      },
    });
    // 协作偏好已经涵盖这些习惯，避免它们再以独立选项重复出现
    for (const pref of insights.confirmedPreferences.slice(0, 6)) {
      seenText.add(normalize(pref.summary));
    }
  }

  for (const pref of insights.confirmedPreferences.slice(0, 4)) {
    const summary = String(pref.summary || '').trim();
    if (!summary) continue;
    if (!topic || !summary.toLowerCase().includes(topic)) continue;
    pushHint({
      id: `pattern:${pref.id}`,
      type: 'preference_match',
      label: summary,
      text: summary,
      defaultOn: false,
      reason: `与当前任务相关的已确认习惯，已出现 ${pref.count || 1} 次。`,
      source: {
        type: 'pattern',
        id: pref.id,
        text: summary,
      },
    });
  }

  for (const item of consolidated.items || []) {
    if (!consolidation.matchWorkContext(item, workContext)) continue;
    const text = String(item.text || '').trim();
    if (!text) continue;
    const fieldLabel = consolidation.FIELD_LABELS[item.field] || item.field;
    pushHint({
      id: `memory:${item.id}`,
      type: 'work_memory',
      label: `${fieldLabel}：${text.slice(0, 72)}`,
      text: text.slice(0, 240),
      defaultOn: false,
      reason: WORK_MEMORY_REASONS[item.confidence] || WORK_MEMORY_REASONS.derived,
      source: {
        type: item.source?.type || 'work_memory',
        id: item.id,
        text: item.source?.summary || text,
      },
    });
  }

  return {
    hints: hints.slice(0, WORK_CONTEXT_LIMIT),
    collaborationPrompt: insights.collaborationPrompt,
    consolidatedUpdatedAt: consolidated.updatedAt,
    source: 'product-memory',
  };
}

function reviewPattern(memoryDir, patternId, action, summary = '') {
  ensureMemory(memoryDir);
  if (!['pending', 'accepted', 'dismissed'].includes(action)) {
    return { ok: false, error: '无效操作' };
  }
  const patterns = loadPatterns(memoryDir);
  const entry = patterns.find((p) => p.id === patternId);
  if (!entry) return { ok: false, error: '模式不存在' };
  if (action === 'accepted' && !isPatternEntryEligible(entry)) {
    return { ok: false, error: '该推测不符合习惯候选条件，无法接受' };
  }
  const nextSummary = String(summary || '').trim().slice(0, 300);
  if (nextSummary) {
    if (isGarbageSummary(nextSummary)) {
      return { ok: false, error: '摘要内容不符合习惯候选条件' };
    }
    entry.summary = nextSummary;
    entry.eligibility = 'eligible';
  }
  entry.prompt_state = action;
  entry.reviewed_at = new Date().toISOString();
  savePatterns(memoryDir, patterns);
  return { ok: true, pattern: entry };
}

function overview(memoryDir, options = {}) {
  ensureMemory(memoryDir);
  const recentLimit = Math.max(1, Math.min(50, Number(options.recentLimit) || 20));
  const allPatterns = getVisiblePatterns(memoryDir);
  const patterns = allPatterns
    .sort((a, b) => {
      const stateOrder = { pending: 0, accepted: 1, dismissed: 2 };
      const stateDiff =
        (stateOrder[a.prompt_state] ?? 3) - (stateOrder[b.prompt_state] ?? 3);
      return stateDiff || (b.count || 0) - (a.count || 0);
    })
    .slice(0, 50);
  const recent = getRecent(memoryDir, recentLimit);
  const pendingEligible = patterns.filter((p) => p.prompt_state === 'pending');
  const consolidation = lazyConsolidation();
  if (options.consolidate !== false) {
    consolidation.consolidateIfStale(memoryDir);
  }
  const consolidated = consolidation.summaryForOverview(
    consolidation.loadConsolidated(memoryDir)
  );
  return {
    config: loadConfig(memoryDir),
    recent,
    patterns,
    consolidated,
    stats: {
      recentCount: status(memoryDir).recentCount,
      patternsCount: patterns.length,
      pendingCount: pendingEligible.length,
      acceptedCount: patterns.filter((p) => p.prompt_state === 'accepted').length,
      consolidatedCount: consolidated.total || 0,
      ineligibleHidden: loadPatterns(memoryDir).filter(
        (p) => p.prompt_state === 'ineligible' || !isPatternEntryEligible(p)
      ).length,
    },
  };
}

function clear(memoryDir) {
  ensureMemory(memoryDir);
  const config = loadConfig(memoryDir);
  lazyConsolidation().clearConsolidated(memoryDir);
  for (const name of ['episodes', 'working', 'patterns', 'summaries']) {
    fs.rmSync(path.join(memoryDir, name), { recursive: true, force: true });
  }
  ensureMemory(memoryDir);
  saveConfig(memoryDir, config);
  return { ok: true };
}

function status(memoryDir) {
  ensureMemory(memoryDir);
  const patterns = getVisiblePatterns(memoryDir);
  const recent = getRecent(memoryDir, 1);
  return {
    path: memoryDir,
    recentCount: fs.existsSync(path.join(memoryDir, 'working', 'recent.jsonl'))
      ? fs
          .readFileSync(path.join(memoryDir, 'working', 'recent.jsonl'), 'utf8')
          .split('\n')
          .filter(Boolean).length
      : 0,
    patternsCount: patterns.length,
    pendingPromotions: patterns.filter(
      (p) => p.count >= PROMPT_THRESHOLD && p.prompt_state === 'pending'
    ).length,
    lastActivity: recent[0]?.ts || null,
  };
}

function consolidateWorkMemory(memoryDir, options = {}) {
  ensureMemory(memoryDir);
  return lazyConsolidation().consolidate(memoryDir, options);
}

function getWorkMemorySummary(memoryDir, options = {}) {
  ensureMemory(memoryDir);
  const consolidation = lazyConsolidation();
  if (options.consolidate !== false) {
    consolidation.consolidateIfStale(memoryDir);
  }
  return consolidation.summaryForOverview(consolidation.loadConsolidated(memoryDir));
}

module.exports = {
  ensureMemory,
  capture,
  getRecent,
  getContextForAI,
  getAcceptedPatterns,
  getVisiblePatterns,
  buildMemoryInsights,
  buildEffectivePersonalization,
  buildContextItems,
  buildWorkHints,
  consolidateWorkMemory,
  getWorkMemorySummary,
  migratePatterns,
  resolveEventSignal,
  isPatternEligible,
  isPatternEntryEligible,
  isGarbageSummary,
  status,
  overview,
  loadConfig,
  saveConfig,
  reviewPattern,
  clear,
  PROMPT_THRESHOLD,
  PREFERENCE_KINDS,
  TELEMETRY_KINDS,
};
