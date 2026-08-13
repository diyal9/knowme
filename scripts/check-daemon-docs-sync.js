#!/usr/bin/env node
/**
 * Compare KnowMe docs/daemon sync copy with optional upstream API.md.
 *
 * Exit: 0 = ok or advisory-only; 2 = strict failure (DAEMON_DOCS_STRICT=1)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const API = path.join(ROOT, 'docs', 'daemon', 'API.md');
const README = path.join(ROOT, 'docs', 'daemon', 'README.md');

function read(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

function extractVersion(md) {
  if (!md) return null;
  const m =
    md.match(/\*\*文档版本\*\*\s*\|\s*`([^`]+)`/) ||
    md.match(/当前同步版本\s*\|\s*`([^`]+)`/) ||
    md.match(/文档版本[^\n]*`([0-9]+\.[0-9]+\.[0-9]+[^`]*)`/);
  return m ? m[1].trim() : null;
}

function extractPublished(md) {
  if (!md) return null;
  const m =
    md.match(/\*\*发布时间\*\*\s*\|\s*`([^`]+)`/) ||
    md.match(/发布时间\s*`([^`]+)`/);
  return m ? m[1].trim() : null;
}

function extractUpstreamPath(readme) {
  if (!readme) return null;
  const env = process.env.DAEMON_API_UPSTREAM;
  if (env && env.trim()) return env.trim();
  const m = readme.match(/上游源文件\s*\|\s*`([^`]+)`/);
  return m ? m[1].trim() : null;
}

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function main() {
  const json = process.argv.includes('--json');
  const strict = process.env.DAEMON_DOCS_STRICT === '1';
  const issues = [];
  const apiText = read(API);
  const readmeText = read(README);

  if (!apiText) issues.push({ level: 'error', id: 'api-missing', message: 'docs/daemon/API.md missing' });
  if (!readmeText) issues.push({ level: 'error', id: 'readme-missing', message: 'docs/daemon/README.md missing' });

  const apiVersion = extractVersion(apiText);
  const readmeVersion = extractVersion(readmeText);
  const published = extractPublished(apiText);

  if (!apiVersion) issues.push({ level: 'error', id: 'api-version-missing', message: 'API.md 缺少文档版本' });
  if (!readmeVersion) {
    issues.push({ level: 'error', id: 'readme-version-missing', message: 'README.md 缺少当前同步版本' });
  } else if (apiVersion && readmeVersion && apiVersion !== readmeVersion) {
    issues.push({
      level: 'error',
      id: 'version-mismatch-local',
      message: `本地版本不一致: API.md=${apiVersion} README=${readmeVersion}`,
    });
  }

  const upstreamPath = extractUpstreamPath(readmeText);
  let upstream = null;
  if (upstreamPath) {
    const exists = fs.existsSync(upstreamPath);
    if (!exists) {
      issues.push({
        level: 'advisory',
        id: 'upstream-missing',
        message: `上游文件不存在（跳过比对）: ${upstreamPath}`,
      });
    } else {
      const upText = read(upstreamPath);
      const upVersion = extractVersion(upText);
      const localHash = apiText ? sha256(apiText) : null;
      const upHash = upText ? sha256(upText) : null;
      upstream = {
        path: upstreamPath,
        version: upVersion,
        hash_match: localHash && upHash ? localHash === upHash : null,
      };
      if (upVersion && apiVersion && upVersion !== apiVersion) {
        issues.push({
          level: 'error',
          id: 'version-mismatch-upstream',
          message: `与上游版本不一致: local=${apiVersion} upstream=${upVersion}`,
        });
      }
      if (localHash && upHash && localHash !== upHash) {
        issues.push({
          level: 'advisory',
          id: 'content-hash-diff',
          message: '本地 API.md 与上游内容哈希不同（可能仅空白/章节差）',
        });
      }
    }
  } else {
    issues.push({
      level: 'advisory',
      id: 'upstream-path-unset',
      message: '未配置上游路径（设 DAEMON_API_UPSTREAM 可启用比对）',
    });
  }

  const errors = issues.filter((i) => i.level === 'error');
  const advisories = issues.filter((i) => i.level === 'advisory');
  const report = {
    ok: errors.length === 0,
    local: { api_version: apiVersion, readme_version: readmeVersion, published },
    upstream,
    errors,
    advisories,
    strict,
  };

  if (json) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } else {
    console.log(
      `daemon-docs-sync: ${report.ok ? 'OK' : 'FAIL'} local=${apiVersion || '?'} ` +
        `(errors=${errors.length} advisories=${advisories.length})`
    );
    for (const i of issues) console.log(`  [${i.level}] ${i.id}: ${i.message}`);
  }

  if (strict && !report.ok) process.exit(2);
  process.exit(0);
}

main();
