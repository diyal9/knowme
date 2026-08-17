'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const IGNORE_DIRS = new Set([
  '.git', 'node_modules', '.svn', '.hg', 'dist', 'dist-release',
  '__pycache__', '.cursor', '.idea', '.vscode',
]);
const TEXT_EXT = new Set([
  '.md', '.txt', '.json', '.js', '.ts', '.mjs', '.cjs', '.css', '.html', '.htm',
  '.yml', '.yaml', '.toml', '.xml', '.csv', '.py', '.go', '.rs', '.java',
  '.sh', '.bat', '.ps1', '.env', '.gitignore', '.editorconfig',
]);
const MAX_DEPTH = 4;
const MAX_NODES = 500;
/** 单层子项上限（按需展开时使用） */
const MAX_CHILDREN = 1000;

function newId() {
  return `src_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
}

function normalizeRoot(rootPath) {
  if (!rootPath || typeof rootPath !== 'string') return null;
  const abs = path.resolve(rootPath.trim());
  try {
    if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) return null;
  } catch {
    return null;
  }
  return abs;
}

/** Resolve relPath under root; reject traversal. Returns absolute path or null. */
function resolveUnderRoot(rootPath, relPath) {
  const root = path.resolve(rootPath);
  const rel = String(relPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!rel || rel.includes('\0')) return null;
  const parts = rel.split('/').filter(Boolean);
  if (parts.some((p) => p === '..')) return null;
  const full = path.resolve(root, ...parts);
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (full !== root && !full.startsWith(rootWithSep)) return null;
  return full;
}

function loadStore(file) {
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    const sources = Array.isArray(raw.sources) ? raw.sources.map(normalizeSource).filter(Boolean) : [];
    let activeSourceId = raw.activeSourceId || null;
    if (activeSourceId && !sources.some((s) => s.id === activeSourceId)) activeSourceId = null;
    if (!activeSourceId && sources[0]) activeSourceId = sources[0].id;
    return { sources, activeSourceId };
  } catch {
    return { sources: [], activeSourceId: null };
  }
}

function normalizeSource(s) {
  if (!s || !s.id || !s.type || !s.rootPath) return null;
  if (!['local', 'gitlab', 'github', 'web'].includes(s.type)) return null;
  return {
    id: String(s.id),
    type: s.type,
    displayName: String(s.displayName || path.basename(s.rootPath) || s.id),
    rootPath: String(s.rootPath),
    createdAt: s.createdAt || new Date().toISOString(),
    remoteUrl: s.remoteUrl || '',
    pageUrl: s.pageUrl || '',
    projectPath: s.projectPath || '',
    ownerRepo: s.ownerRepo || '',
    branch: s.branch || 'main',
    host: s.host || '',
    provider: s.provider || '',
    lastSyncAt: s.lastSyncAt || null,
  };
}

function saveStore(file, store) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const sources = (store.sources || []).map(normalizeSource).filter(Boolean);
  let activeSourceId = store.activeSourceId || null;
  if (activeSourceId && !sources.some((s) => s.id === activeSourceId)) {
    activeSourceId = sources[0] ? sources[0].id : null;
  }
  fs.writeFileSync(file, JSON.stringify({ sources, activeSourceId }, null, 2), 'utf8');
  return { sources, activeSourceId };
}

function addLocal(store, rootPath, displayName) {
  const root = normalizeRoot(rootPath);
  if (!root) return { ok: false, error: '无效的本地文件夹' };
  if (store.sources.some((s) => path.resolve(s.rootPath) === root)) {
    return { ok: false, error: '该文件夹已添加' };
  }
  const source = {
    id: newId(),
    type: 'local',
    displayName: (displayName || path.basename(root) || '本地文件夹').trim(),
    rootPath: root,
    createdAt: new Date().toISOString(),
  };
  const sources = [...store.sources, source];
  return {
    ok: true,
    store: { sources, activeSourceId: store.activeSourceId || source.id },
    source,
  };
}

function addGitlab(store, opts) {
  const root = normalizeRoot(opts.rootPath);
  if (!root) return { ok: false, error: '工作副本目录无效' };
  const source = {
    id: newId(),
    type: 'gitlab',
    displayName: (opts.displayName || opts.projectPath || path.basename(root)).trim(),
    rootPath: root,
    createdAt: new Date().toISOString(),
    remoteUrl: String(opts.remoteUrl || ''),
    projectPath: String(opts.projectPath || ''),
    branch: String(opts.branch || 'main'),
    host: String(opts.host || ''),
    lastSyncAt: opts.lastSyncAt || new Date().toISOString(),
  };
  const sources = [...store.sources, source];
  return {
    ok: true,
    store: { sources, activeSourceId: store.activeSourceId || source.id },
    source,
  };
}

function addGithub(store, opts) {
  const root = normalizeRoot(opts.rootPath);
  if (!root) return { ok: false, error: '工作副本目录无效' };
  const source = {
    id: newId(),
    type: 'github',
    displayName: (opts.displayName || opts.ownerRepo || path.basename(root)).trim(),
    rootPath: root,
    createdAt: new Date().toISOString(),
    remoteUrl: String(opts.remoteUrl || ''),
    ownerRepo: String(opts.ownerRepo || ''),
    branch: String(opts.branch || 'main'),
    host: String(opts.host || 'https://github.com'),
    provider: 'github',
    lastSyncAt: opts.lastSyncAt || new Date().toISOString(),
  };
  const sources = [...store.sources, source];
  return {
    ok: true,
    store: { sources, activeSourceId: store.activeSourceId || source.id },
    source,
  };
}

function addWeb(store, opts) {
  const root = normalizeRoot(opts.rootPath);
  if (!root) return { ok: false, error: '网页缓存目录无效' };
  const pageUrl = String(opts.pageUrl || opts.remoteUrl || '').trim();
  if (!pageUrl) return { ok: false, error: '网页地址无效' };
  const source = {
    id: newId(),
    type: 'web',
    displayName: (opts.displayName || opts.title || pageUrl).trim(),
    rootPath: root,
    createdAt: new Date().toISOString(),
    remoteUrl: pageUrl,
    pageUrl,
    provider: 'web',
    lastSyncAt: opts.lastSyncAt || new Date().toISOString(),
  };
  const sources = [...store.sources, source];
  return {
    ok: true,
    store: { sources, activeSourceId: store.activeSourceId || source.id },
    source,
  };
}

function removeSource(store, id) {
  const sources = store.sources.filter((s) => s.id !== id);
  let activeSourceId = store.activeSourceId;
  if (activeSourceId === id) activeSourceId = sources[0] ? sources[0].id : null;
  return { ok: true, store: { sources, activeSourceId } };
}

function setActive(store, id) {
  if (!store.sources.some((s) => s.id === id)) return { ok: false, error: '源不存在' };
  return { ok: true, store: { ...store, activeSourceId: id } };
}

function shouldSkipEntry(ent) {
  if (ent.name.startsWith('.') && ent.name !== '.env' && ent.name !== '.gitignore') {
    if (IGNORE_DIRS.has(ent.name)) return true;
    if (ent.isDirectory()) return true;
  }
  if (ent.isDirectory() && IGNORE_DIRS.has(ent.name)) return true;
  return false;
}

function readDirEntries(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  entries.sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
    return a.name.localeCompare(b.name, 'zh-CN');
  });
  return entries;
}

function readEntryTimes(absPath) {
  try {
    const st = fs.statSync(absPath);
    const createdAt = Number.isFinite(st.birthtimeMs) && st.birthtimeMs > 0
      ? new Date(st.birthtimeMs).toISOString()
      : null;
    const updatedAt = Number.isFinite(st.mtimeMs) && st.mtimeMs > 0
      ? new Date(st.mtimeMs).toISOString()
      : null;
    return { createdAt, updatedAt };
  } catch {
    return { createdAt: null, updatedAt: null };
  }
}

function listTree(rootPath, opts = {}) {
  const root = normalizeRoot(rootPath);
  if (!root) return { ok: false, error: '目录不存在', nodes: [] };
  const maxDepth = opts.maxDepth != null ? opts.maxDepth : MAX_DEPTH;
  const maxNodes = opts.maxNodes != null ? opts.maxNodes : MAX_NODES;
  const nodes = [];
  let truncated = false;

  function walk(dir, rel, depth) {
    if (nodes.length >= maxNodes) {
      truncated = true;
      return;
    }
    const entries = readDirEntries(dir);
    for (const ent of entries) {
      if (nodes.length >= maxNodes) {
        truncated = true;
        break;
      }
      if (shouldSkipEntry(ent)) continue;
      const childRel = rel ? `${rel}/${ent.name}` : ent.name;
      const times = readEntryTimes(path.join(dir, ent.name));
      if (ent.isDirectory()) {
        nodes.push({ type: 'dir', name: ent.name, path: childRel, depth, ...times });
        if (depth < maxDepth) walk(path.join(dir, ent.name), childRel, depth + 1);
      } else {
        const ext = path.extname(ent.name).toLowerCase();
        const ok = !ext || TEXT_EXT.has(ext) || !ent.name.includes('.');
        if (!ok) continue;
        nodes.push({ type: 'file', name: ent.name, path: childRel, depth, ...times });
      }
    }
  }

  walk(root, '', 0);
  return { ok: true, nodes, truncated, rootPath: root, lazy: maxDepth === 0 };
}

/** 只列出指定目录的直接子项（按需展开） */
function listChildren(rootPath, relPath = '', opts = {}) {
  const root = normalizeRoot(rootPath);
  if (!root) return { ok: false, error: '目录不存在', nodes: [] };
  const rel = String(relPath || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (rel.includes('\0') || rel.split('/').some((p) => p === '..')) {
    return { ok: false, error: '非法路径', nodes: [] };
  }
  const abs = rel ? resolveUnderRoot(root, rel) : root;
  if (!abs) return { ok: false, error: '非法路径', nodes: [] };
  try {
    if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
      return { ok: false, error: '目录不存在', nodes: [] };
    }
  } catch {
    return { ok: false, error: '目录不存在', nodes: [] };
  }

  const maxNodes = opts.maxNodes != null ? opts.maxNodes : MAX_CHILDREN;
  const depth = rel ? rel.split('/').filter(Boolean).length : 0;
  const nodes = [];
  let truncated = false;
  const entries = readDirEntries(abs);
  for (const ent of entries) {
    if (nodes.length >= maxNodes) {
      truncated = true;
      break;
    }
    if (shouldSkipEntry(ent)) continue;
    const childRel = rel ? `${rel}/${ent.name}` : ent.name;
    const times = readEntryTimes(path.join(abs, ent.name));
    if (ent.isDirectory()) {
      nodes.push({ type: 'dir', name: ent.name, path: childRel, depth, ...times });
    } else {
      const ext = path.extname(ent.name).toLowerCase();
      const ok = !ext || TEXT_EXT.has(ext) || !ent.name.includes('.');
      if (!ok) continue;
      nodes.push({ type: 'file', name: ent.name, path: childRel, depth, ...times });
    }
  }
  return { ok: true, nodes, truncated, rootPath: root, parentPath: rel };
}

/** 单文件同步读取上限，避免主进程被超大文件拖死 */
const MAX_READ_BYTES = 2 * 1024 * 1024;

function readFileUnder(rootPath, relPath) {
  const full = resolveUnderRoot(rootPath, relPath);
  if (!full) return { ok: false, error: '非法路径' };
  try {
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
      return { ok: false, error: '文件不存在' };
    }
    const size = fs.statSync(full).size;
    if (size > MAX_READ_BYTES) {
      return {
        ok: false,
        error: `文件过大（>${Math.round(MAX_READ_BYTES / 1024 / 1024)}MB），请缩小后再读`,
        code: 'too_large',
        size,
        maxBytes: MAX_READ_BYTES,
      };
    }
    const content = fs.readFileSync(full, 'utf8');
    return { ok: true, content, path: relPath, absPath: full, size };
  } catch (e) {
    return { ok: false, error: e.message || '读取失败' };
  }
}

function writeFileUnder(rootPath, relPath, content) {
  const full = resolveUnderRoot(rootPath, relPath);
  if (!full) return { ok: false, error: '非法路径' };
  try {
    const dir = path.dirname(full);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(full, String(content ?? ''), 'utf8');
    return { ok: true, path: relPath, absPath: full };
  } catch (e) {
    return { ok: false, error: e.message || '写入失败' };
  }
}

function encodeFsId(sourceId, relPath) {
  return `fs:${sourceId}:${String(relPath || '').replace(/\\/g, '/')}`;
}

function decodeFsId(id) {
  if (!id || typeof id !== 'string' || !id.startsWith('fs:')) return null;
  const rest = id.slice(3);
  const i = rest.indexOf(':');
  if (i < 0) return null;
  return { sourceId: rest.slice(0, i), relPath: rest.slice(i + 1) };
}

module.exports = {
  IGNORE_DIRS,
  TEXT_EXT,
  MAX_DEPTH,
  MAX_NODES,
  MAX_CHILDREN,
  MAX_READ_BYTES,
  newId,
  normalizeRoot,
  resolveUnderRoot,
  loadStore,
  saveStore,
  normalizeSource,
  addLocal,
  addGitlab,
  addGithub,
  addWeb,
  removeSource,
  setActive,
  listTree,
  listChildren,
  readFileUnder,
  writeFileUnder,
  encodeFsId,
  decodeFsId,
};
