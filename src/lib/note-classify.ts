/**
 * notes 兼容分类：启发式从 promptGroup / 路径 / 项目名推断 category 与 okfTags
 */
'use strict';

function slug(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[\s.]+/g, '-')
    .replace(/[^a-z0-9\u4e00-\u9fff_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);
}

function pathParts(note) {
  const raw = note.promptGroup || note.sourceRelPath || '';
  return String(raw)
    .split(/[/\\]/)
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => !/^\.+/.test(p));
}

function needsCategory(note) {
  return !(note.category || '').trim();
}

function needsTags(note) {
  const okf = Array.isArray(note.okfTags) ? note.okfTags.filter(Boolean) : [];
  return okf.length === 0;
}

function needsClassify(note) {
  return needsCategory(note) || needsTags(note);
}

/**
 * @returns {{ category: string, okfTags: string[], changed: boolean, reason: string }}
 */
function heuristicClassify(note) {
  const parts = pathParts(note);
  let category = (note.category || '').trim();
  let okfTags = Array.isArray(note.okfTags)
    ? note.okfTags.map((t) => String(t).trim()).filter(Boolean)
    : [];
  const reasons = [];

  if (!category && parts.length) {
    category = slug(parts[0]) || parts[0].slice(0, 32);
    reasons.push('path');
  }
  if (!category && note.project) {
    const m = String(note.project).match(/^([A-Za-z\u4e00-\u9fff][A-Za-z0-9\u4e00-\u9fff_-]{0,31})/);
    if (m) {
      category = slug(m[1]) || m[1].toLowerCase().slice(0, 32);
      reasons.push('project');
    }
  }

  if (!okfTags.length) {
    const fromTags = (Array.isArray(note.tags) ? note.tags : []).map(slug).filter(Boolean);
    const fromPath = parts.slice(1).map(slug).filter(Boolean);
    const fromName = slug(note.project || '');
    const merged = [];
    const seen = new Set();
    for (const t of [...fromTags, ...fromPath, fromName].filter(Boolean)) {
      if (t === category || seen.has(t)) continue;
      seen.add(t);
      merged.push(t);
      if (merged.length >= 5) break;
    }
    if (merged.length) {
      okfTags = merged;
      reasons.push('tags');
    }
  }

  const prevCat = (note.category || '').trim();
  const prevTags = Array.isArray(note.okfTags) ? note.okfTags.map(String) : [];
  const sameTags =
    prevTags.length === okfTags.length && prevTags.every((t, i) => t === okfTags[i]);
  const changed = category !== prevCat || !sameTags;

  return {
    category,
    okfTags,
    changed,
    reason: reasons.join('+') || 'none',
  };
}

function applyHeuristic(note) {
  const result = heuristicClassify(note);
  if (!result.changed) return { note, applied: false, result };
  if (needsCategory(note) && result.category) note.category = result.category;
  if (needsTags(note) && result.okfTags.length) {
    note.okfTags = result.okfTags;
    if (!Array.isArray(note.tags) || !note.tags.length) note.tags = [...result.okfTags];
  }
  const after = heuristicClassify({ ...note, category: note.category, okfTags: note.okfTags });
  // recompute changed against original intent
  const applied =
    (needsCategory({ category: '' }) && !!(note.category || '').trim()) ||
    (Array.isArray(note.okfTags) && note.okfTags.length > 0);
  return {
    note,
    applied: !!(note.category || '').trim() || (note.okfTags && note.okfTags.length),
    result: after,
  };
}

/** 批量：只填空字段，不覆盖已有 category/okfTags */
function batchHeuristic(notes) {
  const report = { updated: 0, skipped: 0, samples: [], changedIds: [] };
  for (const n of notes) {
    if (!needsClassify(n)) {
      report.skipped++;
      continue;
    }
    const beforeCat = (n.category || '').trim();
    const beforeTags = JSON.stringify(n.okfTags || []);
    const h = heuristicClassify(n);
    if (needsCategory(n) && h.category) n.category = h.category;
    if (needsTags(n) && h.okfTags.length) {
      n.okfTags = h.okfTags;
      if (!Array.isArray(n.tags) || !n.tags.length) n.tags = [...h.okfTags];
    }
    const changed =
      (n.category || '').trim() !== beforeCat || JSON.stringify(n.okfTags || []) !== beforeTags;
    if (changed) {
      report.updated++;
      report.changedIds.push(n.id);
      if (report.samples.length < 8) {
        report.samples.push({
          id: n.id,
          project: n.project || '',
          category: n.category,
          okfTags: n.okfTags,
          reason: h.reason,
        });
      }
    } else {
      report.skipped++;
    }
  }
  return report;
}

module.exports = {
  slug,
  pathParts,
  needsClassify,
  needsCategory,
  needsTags,
  heuristicClassify,
  applyHeuristic,
  batchHeuristic,
};
