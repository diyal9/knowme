'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

function gitAvailable() {
  try {
    const r = spawnSync('git', ['--version'], { encoding: 'utf8', windowsHide: true });
    return r.status === 0;
  } catch {
    return false;
  }
}

function normalizeHost(host) {
  let h = String(host || '').trim().replace(/\/+$/, '');
  if (!h) return '';
  if (!/^https?:\/\//i.test(h)) h = `https://${h}`;
  return h;
}

function buildRemoteUrl(host, projectPath) {
  const h = normalizeHost(host);
  const p = String(projectPath || '').trim().replace(/^\/+|\/+$/g, '').replace(/\.git$/i, '');
  if (!h || !p) return null;
  return `${h}/${p}.git`;
}

function repoCacheDir(userData, host, projectPath) {
  const key = crypto
    .createHash('sha1')
    .update(`${normalizeHost(host)}|${String(projectPath || '').trim().toLowerCase()}`)
    .digest('hex')
    .slice(0, 16);
  const safe = String(projectPath || 'repo')
    .replace(/[^\w.-]+/g, '_')
    .slice(0, 40);
  return path.join(userData, 'repos', `${safe}_${key}`);
}

function authRemoteUrl(remoteUrl, token) {
  const u = new URL(remoteUrl);
  u.username = 'oauth2';
  u.password = token;
  return u.toString();
}

function authRemoteUrlForProvider(remoteUrl, token, provider = 'gitlab') {
  const t = String(token || '').trim();
  if (!t) return remoteUrl;
  if (provider === 'github') {
    const u = new URL(remoteUrl);
    u.username = 'x-access-token';
    u.password = t;
    return u.toString();
  }
  return authRemoteUrl(remoteUrl, t);
}

function runGit(args, cwd) {
  const r = spawnSync('git', args, {
    cwd: cwd || undefined,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 8 * 1024 * 1024,
  });
  return {
    ok: r.status === 0,
    status: r.status,
    stdout: (r.stdout || '').trim(),
    stderr: (r.stderr || '').trim(),
  };
}

/**
 * Clone GitLab project into userData/repos.
 * @returns {{ ok, rootPath?, remoteUrl?, error? }}
 */
function cloneProject({ userData, host, projectPath, branch, token }) {
  if (!gitAvailable()) {
    return { ok: false, error: '未检测到 git，请先安装 Git 并加入 PATH' };
  }
  const t = String(token || '').trim();
  if (!t) return { ok: false, error: '请先配置 GitLab Token' };
  const remoteUrl = buildRemoteUrl(host, projectPath);
  if (!remoteUrl) return { ok: false, error: 'GitLab 地址或项目路径无效' };

  const dest = repoCacheDir(userData, host, projectPath);
  if (fs.existsSync(path.join(dest, '.git'))) {
    const pull = pullRepo(dest, token);
    if (!pull.ok) return pull;
    return { ok: true, rootPath: dest, remoteUrl, reused: true };
  }
  if (fs.existsSync(dest)) {
    try {
      fs.rmSync(dest, { recursive: true, force: true });
    } catch {
      return { ok: false, error: '无法清理旧工作副本目录' };
    }
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });

  const authUrl = authRemoteUrl(remoteUrl, t);
  const b = String(branch || 'main').trim() || 'main';
  const args = ['clone', '--depth', '1', '--branch', b, authUrl, dest];
  const r = runGit(args);
  if (!r.ok) {
    // fallback without branch (default HEAD)
    const r2 = runGit(['clone', '--depth', '1', authUrl, dest]);
    if (!r2.ok) {
      return {
        ok: false,
        error: r2.stderr || r.stderr || 'git clone 失败',
      };
    }
  }
  return { ok: true, rootPath: dest, remoteUrl, reused: false };
}

function stripAuthFromUrl(raw) {
  try {
    let s = String(raw || '').trim();
    if (s.startsWith('git@')) {
      const m = s.match(/^git@([^:]+):(.+)$/);
      if (m) s = `https://${m[1]}/${m[2]}`;
    }
    const u = new URL(s);
    u.username = '';
    u.password = '';
    return u.toString();
  } catch {
    return String(raw || '').replace(/\/\/[^/@]+@/, '//');
  }
}

function pullRepo(rootPath, token) {
  if (!gitAvailable()) {
    return { ok: false, error: '未检测到 git，请先安装 Git 并加入 PATH' };
  }
  if (!rootPath || !fs.existsSync(path.join(rootPath, '.git'))) {
    return { ok: false, error: '工作副本不存在' };
  }
  const getUrl = runGit(['remote', 'get-url', 'origin'], rootPath);
  if (!getUrl.ok) return { ok: false, error: getUrl.stderr || '无法读取 remote' };
  const cleanOrigin = stripAuthFromUrl(getUrl.stdout);
  try {
    if (token) {
      runGit(['remote', 'set-url', 'origin', authRemoteUrl(cleanOrigin, token)], rootPath);
    }
    const pull = runGit(['pull', '--ff-only'], rootPath);
    if (!pull.ok) return { ok: false, error: pull.stderr || 'git pull 失败' };
    return { ok: true, rootPath };
  } finally {
    runGit(['remote', 'set-url', 'origin', cleanOrigin], rootPath);
  }
}

function repoCacheDirForRemote(userData, remoteUrl) {
  const clean = stripAuthFromUrl(remoteUrl).replace(/\.git$/i, '');
  const key = crypto.createHash('sha1').update(clean.toLowerCase()).digest('hex').slice(0, 16);
  let safe = 'repo';
  try {
    const u = new URL(clean);
    safe = `${u.hostname}_${u.pathname.replace(/^\/+/, '').replace(/[^\w.-]+/g, '_')}`.slice(0, 48);
  } catch {
    safe = String(clean).replace(/[^\w.-]+/g, '_').slice(0, 48) || 'repo';
  }
  return path.join(userData, 'repos', `${safe}_${key}`);
}

function cloneRemoteRepo({ userData, remoteUrl, branch, token, provider = 'gitlab' }) {
  if (!gitAvailable()) {
    return { ok: false, error: '未检测到 git，请先安装 Git 并加入 PATH' };
  }
  const cleanRemote = stripAuthFromUrl(remoteUrl);
  if (!/^https?:\/\//i.test(cleanRemote)) return { ok: false, error: '仓库地址无效' };
  const dest = repoCacheDirForRemote(userData, cleanRemote);
  if (fs.existsSync(path.join(dest, '.git'))) {
    const pull = pullRemoteRepo(dest, { token, provider });
    if (!pull.ok) return pull;
    return { ok: true, rootPath: dest, remoteUrl: cleanRemote, reused: true };
  }
  if (fs.existsSync(dest)) {
    try {
      fs.rmSync(dest, { recursive: true, force: true });
    } catch {
      return { ok: false, error: '无法清理旧工作副本目录' };
    }
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const authUrl = authRemoteUrlForProvider(cleanRemote, token, provider);
  const b = String(branch || 'main').trim() || 'main';
  const r = runGit(['clone', '--depth', '1', '--branch', b, authUrl, dest]);
  if (!r.ok) {
    const r2 = runGit(['clone', '--depth', '1', authUrl, dest]);
    if (!r2.ok) return { ok: false, error: r2.stderr || r.stderr || 'git clone 失败' };
  }
  return { ok: true, rootPath: dest, remoteUrl: cleanRemote, reused: false };
}

function pullRemoteRepo(rootPath, { token, provider = 'gitlab' } = {}) {
  if (!gitAvailable()) {
    return { ok: false, error: '未检测到 git，请先安装 Git 并加入 PATH' };
  }
  if (!rootPath || !fs.existsSync(path.join(rootPath, '.git'))) {
    return { ok: false, error: '工作副本不存在' };
  }
  const getUrl = runGit(['remote', 'get-url', 'origin'], rootPath);
  if (!getUrl.ok) return { ok: false, error: getUrl.stderr || '无法读取 remote' };
  const cleanOrigin = stripAuthFromUrl(getUrl.stdout);
  try {
    if (token) {
      runGit(['remote', 'set-url', 'origin', authRemoteUrlForProvider(cleanOrigin, token, provider)], rootPath);
    }
    const pull = runGit(['pull', '--ff-only'], rootPath);
    if (!pull.ok) return { ok: false, error: pull.stderr || 'git pull 失败' };
    return { ok: true, rootPath };
  } finally {
    runGit(['remote', 'set-url', 'origin', cleanOrigin], rootPath);
  }
}

module.exports = {
  gitAvailable,
  normalizeHost,
  buildRemoteUrl,
  repoCacheDir,
  repoCacheDirForRemote,
  cloneProject,
  pullRepo,
  cloneRemoteRepo,
  pullRemoteRepo,
};
