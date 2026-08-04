'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const {
  getRecent,
  getAcceptedPatterns,
  isGarbageSummary,
  resolveEventSignal,
} = require('./product-memory');

const CONSOLIDATED_FILE = 'working/consolidated.json';
const MAX_PER_FIELD = 5;
const MAX_TOTAL = 25;
const MAX_EVENTS = 200;
const STALE_MS = 60 * 60 * 1000;

const FIELD_LABELS = Object.freeze({
  currentProject: '当前项目',
  goal: '目标',
  openProblem: '待解决问题',
  decision: '决策',
  preference: '偏好',
});

const PROJECT_FROM_SUMMARY_RES = [
  /^复制提示词[：:]\s*(.+?)\s+v[\d.]+$/,
  /^(?:收藏|取消收藏)[：:]\s*(.+)$/,
];

const GOAL_KEYWORDS = /目标|计划|推进|完成|待办|todo/i;

const USELESS_TELEMETRY_RES = [
  /^完成一次 AI 对话$/,
  /^完成一次工作流$/,
  /^导入 prompt_space/,
  /^本地整理旧数据分类/,
];

function isUselessTelemetry(summary) {
  const text = String(summary || '').trim();
  if (!text) return true;
  return USELESS_TELEMETRY_RES.some((re) => re.test(text));
}

function consolidatedPath(memoryDir) {
  return path.join(memoryDir, CONSOLIDATED_FILE);
}

function normalizeText(text) {
  return String(text || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function itemFingerprint(field, text) {
  const blob = `${field}|${normalizeText(text)}`;
  return crypto.createHash('sha256').update(blob).digest('hex').slice(0, 12);
}

function makeItemId(field, text) {
  return `wmi_${itemFingerprint(field, text).slice(0, 10)}`;
}

function emptyConsolidated() {
  return {
    version: 1,
    updatedAt: null,
    items: [],
    stats: { byField: {} },
  };
}

function loadConsolidated(memoryDir) {
  const file = consolidatedPath(memoryDir);
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return {
      version: 1,
      updatedAt: data.updatedAt || null,
      items: Array.isArray(data.items) ? data.items : [],
      stats: data.stats || { byField: {} },
    };
  } catch {
    return emptyConsolidated();
  }
}

function saveConsolidated(memoryDir, data) {
  const file = consolidatedPath(memoryDir);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function extractProjectFromEvent(event) {
  const summary = String(event.summary || '').trim();
  if (!summary || isUselessTelemetry(summary)) return null;
  for (const re of PROJECT_FROM_SUMMARY_RES) {
    const match = summary.match(re);
    if (match && match[1] && match[1].trim() !== '未命名') {
      return match[1].trim();
    }
  }
  const project = String(event.meta?.project || '').trim();
  if (project && project !== '未命名') return project;
  return null;
}

function classifyPreferenceEvent(event) {
  const summary = String(event.summary || '').trim();
  if (!summary || isGarbageSummary(summary)) return null;
  const kind = event.kind;
  if (kind === 'correction') {
    return { field: 'openProblem', text: summary, confidence: 'derived' };
  }
  if (kind === 'workflow_choice') {
    return { field: 'decision', text: summary, confidence: 'derived' };
  }
  if (kind === 'preference' || kind === 'product') {
    if (GOAL_KEYWORDS.test(summary)) {
      return { field: 'goal', text: summary, confidence: 'derived' };
    }
    return null;
  }
  return null;
}

function buildDraftItems(memoryDir) {
  const events = getRecent(memoryDir, MAX_EVENTS);
  const drafts = [];
  const seen = new Set();

  function pushDraft(draft) {
    const fp = itemFingerprint(draft.field, draft.text);
    if (seen.has(fp)) return;
    seen.add(fp);
    drafts.push(draft);
  }

  for (const event of events) {
    const signal = resolveEventSignal(event);
    if (signal === 'telemetry') {
      if (isUselessTelemetry(event.summary)) continue;
      const project = extractProjectFromEvent(event);
      if (project) {
        pushDraft({
          field: 'currentProject',
          text: project,
          confidence: 'activity',
          source: {
            type: 'event',
            ids: [event.id].filter(Boolean),
            summary: event.summary,
          },
        });
      }
      continue;
    }

    const classified = classifyPreferenceEvent(event);
    if (classified) {
      pushDraft({
        ...classified,
        source: {
          type: 'event',
          ids: [event.id].filter(Boolean),
          summary: event.summary,
        },
      });
    }
  }

  for (const pattern of getAcceptedPatterns(memoryDir)) {
    const summary = String(pattern.summary || '').trim();
    if (!summary || isGarbageSummary(summary)) continue;
    pushDraft({
      field: 'preference',
      text: summary,
      confidence: 'confirmed',
      source: {
        type: 'pattern',
        ids: [pattern.id].filter(Boolean),
        summary: `已确认习惯（出现 ${pattern.count || 1} 次）`,
      },
    });
  }

  return drafts;
}

function trimItems(items) {
  const byField = {};
  const result = [];
  for (const item of items) {
    const count = byField[item.field] || 0;
    if (count >= MAX_PER_FIELD) continue;
    if (result.length >= MAX_TOTAL) break;
    byField[item.field] = count + 1;
    result.push(item);
  }
  const stats = { byField };
  for (const field of Object.keys(FIELD_LABELS)) {
    stats.byField[field] = stats.byField[field] || 0;
  }
  return { items: result, stats };
}

function mergeWithExisting(existing, drafts) {
  const confirmed = (existing.items || []).filter((item) => item.confidence === 'confirmed');
  const confirmedKeys = new Set(confirmed.map((item) => itemFingerprint(item.field, item.text)));
  const merged = [...confirmed];
  const seen = new Set(confirmedKeys);

  for (const draft of drafts) {
    const fp = itemFingerprint(draft.field, draft.text);
    if (seen.has(fp)) continue;
    seen.add(fp);
    merged.push({
      id: makeItemId(draft.field, draft.text),
      field: draft.field,
      text: draft.text.slice(0, 300),
      confidence: draft.confidence,
      source: draft.source,
      staleAt: draft.confidence === 'confirmed'
        ? null
        : new Date(Date.now() + STALE_MS).toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  const order = { confirmed: 0, derived: 1, activity: 2 };
  merged.sort(
    (a, b) =>
      (order[a.confidence] ?? 9) - (order[b.confidence] ?? 9) ||
      String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))
  );

  return trimItems(merged);
}

function consolidate(memoryDir, _options = {}) {
  const existing = loadConsolidated(memoryDir);
  const drafts = buildDraftItems(memoryDir);
  const { items, stats } = mergeWithExisting(existing, drafts);
  const now = new Date().toISOString();
  const next = {
    version: 1,
    updatedAt: now,
    items: items.map((item) => ({ ...item, updatedAt: item.updatedAt || now })),
    stats,
  };
  saveConsolidated(memoryDir, next);
  return {
    ok: true,
    consolidated: next,
    stats: {
      total: next.items.length,
      byField: next.stats.byField,
      eventCount: getRecent(memoryDir, MAX_EVENTS).length,
    },
  };
}

function isStale(memoryDir) {
  const data = loadConsolidated(memoryDir);
  if (!data.updatedAt) return true;
  const age = Date.now() - new Date(data.updatedAt).getTime();
  return age > STALE_MS;
}

function consolidateIfStale(memoryDir) {
  if (isStale(memoryDir)) return consolidate(memoryDir);
  return { ok: true, consolidated: loadConsolidated(memoryDir), stats: { skipped: true } };
}

function clearConsolidated(memoryDir) {
  const file = consolidatedPath(memoryDir);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

function formatForContext(consolidated) {
  const items = consolidated?.items || [];
  if (!items.length) return '';
  const groups = {};
  for (const item of items) {
    if (!groups[item.field]) groups[item.field] = [];
    groups[item.field].push(item);
  }
  const lines = [];
  for (const [field, label] of Object.entries(FIELD_LABELS)) {
    const rows = groups[field];
    if (!rows?.length) continue;
    lines.push(`### ${label}`);
    for (const row of rows.slice(0, 3)) {
      const tag =
        row.confidence === 'confirmed'
          ? '已确认'
          : row.confidence === 'activity'
            ? '活动信号'
            : '近期推断';
      lines.push(`- [${tag}] ${row.text}`);
    }
  }
  return lines.join('\n');
}

function summaryForOverview(consolidated) {
  const items = consolidated?.items || [];
  return {
    updatedAt: consolidated?.updatedAt || null,
    total: items.length,
    byField: consolidated?.stats?.byField || {},
    preview: items.slice(0, 6).map((item) => ({
      id: item.id,
      field: item.field,
      fieldLabel: FIELD_LABELS[item.field] || item.field,
      text: item.text,
      confidence: item.confidence,
      sourceSummary: item.source?.summary || '',
    })),
  };
}

function matchWorkContext(item, workContext = {}) {
  const topic = normalizeText(workContext.topic || workContext.action || workContext.label);
  const project = normalizeText(workContext.project);
  const hay = normalizeText(item.text);
  if (topic && hay.includes(topic)) return true;
  if (project && hay.includes(project)) return true;
  if (item.field === 'currentProject' && project && normalizeText(item.text) === project) {
    return true;
  }
  return false;
}

module.exports = {
  FIELD_LABELS,
  MAX_PER_FIELD,
  MAX_TOTAL,
  STALE_MS,
  loadConsolidated,
  consolidate,
  consolidateIfStale,
  clearConsolidated,
  formatForContext,
  summaryForOverview,
  matchWorkContext,
  itemFingerprint,
};
