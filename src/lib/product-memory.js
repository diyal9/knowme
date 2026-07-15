'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MAX_WORKING = 500;
const PROMPT_THRESHOLD = 3;

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
      '# Sticky-Notes Memory\n\n本地使用记忆（不入云、可随应用数据目录备份）。\n',
      'utf8'
    );
  }
  const patterns = path.join(memoryDir, 'patterns', 'registry.json');
  if (!fs.existsSync(patterns)) {
    fs.writeFileSync(patterns, '{"patterns":[]}\n', 'utf8');
  }
  return memoryDir;
}

function today() {
  return new Date().toISOString().slice(0, 10);
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

function bumpPattern(memoryDir, kind, summary, meta = {}) {
  const fp = fingerprint(kind, summary, meta);
  const patterns = loadPatterns(memoryDir);
  const now = new Date().toISOString();
  let entry = patterns.find((p) => p.fingerprint === fp);
  if (entry) {
    entry.count = (entry.count || 0) + 1;
    entry.last_seen = now;
  } else {
    entry = {
      id: `pat_${fp.slice(0, 8)}`,
      kind,
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
  if (entry.count >= PROMPT_THRESHOLD && entry.prompt_state === 'pending') {
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
  const id = crypto.randomUUID();
  const record = {
    id,
    ts: new Date().toISOString(),
    kind: event.kind || 'habit',
    summary: (event.summary || '').slice(0, 500),
    meta: event.meta || {},
  };
  const dayDir = path.join(memoryDir, 'episodes', today());
  appendJsonl(path.join(dayDir, 'app.jsonl'), record);
  if (['correction', 'habit', 'workflow', 'product'].includes(record.kind)) {
    const working = path.join(memoryDir, 'working', 'recent.jsonl');
    appendJsonl(working, record);
    trimJsonl(working, MAX_WORKING);
  }
  if (record.summary) {
    bumpPattern(memoryDir, record.kind, record.summary, record.meta);
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

function getContextForAI(memoryDir, knowledgeSnippet = '') {
  const recent = getRecent(memoryDir, 10);
  const parts = [];
  parts.push(
    '## 用户知识库摘要\n' +
      (knowledgeSnippet
        ? knowledgeSnippet
        : '（知识库为空，暂无任何条目。若用户询问知识库相关内容，请如实告知"知识库暂无相关内容"，不要编造任何条目。）')
  );
  if (recent.length) {
    parts.push(
      '## 近期使用记忆（仅为软件使用统计，非笔记内容，禁止当作事实引用或据此编造笔记）\n' +
        recent.map((r) => `- [${r.kind}] ${r.summary}`).join('\n')
    );
  }
  const pending = path.join(memoryDir, 'patterns', 'pending_prompts.jsonl');
  if (fs.existsSync(pending)) {
    const last = fs.readFileSync(pending, 'utf8').split('\n').filter(Boolean).slice(-3);
    if (last.length) {
      parts.push(
        '## 重复模式（仅为使用频率统计，非笔记内容，禁止引用为事实）\n' +
          last
            .map((l) => {
              try {
                const p = JSON.parse(l);
                return `- ×${p.count} ${p.summary}`;
              } catch {
                return '';
              }
            })
            .filter(Boolean)
            .join('\n')
      );
    }
  }
  return parts.join('\n\n').slice(0, 3500);
}

function status(memoryDir) {
  ensureMemory(memoryDir);
  const patterns = loadPatterns(memoryDir);
  const recent = getRecent(memoryDir, 1);
  return {
    path: memoryDir,
    recentCount: fs.existsSync(path.join(memoryDir, 'working', 'recent.jsonl'))
      ? fs.readFileSync(path.join(memoryDir, 'working', 'recent.jsonl'), 'utf8').split('\n').filter(Boolean).length
      : 0,
    patternsCount: patterns.length,
    pendingPromotions: patterns.filter((p) => p.count >= PROMPT_THRESHOLD && p.prompt_state === 'pending').length,
    lastActivity: recent[0]?.ts || null,
  };
}

module.exports = {
  ensureMemory,
  capture,
  getRecent,
  getContextForAI,
  status,
  PROMPT_THRESHOLD,
};
