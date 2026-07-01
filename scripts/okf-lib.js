#!/usr/bin/env node
/**
 * OKF v0.1 utilities — parse, validate, walk bundle
 * @see https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md
 */
'use strict';

const fs = require('fs');
const path = require('path');

const RESERVED = new Set(['index.md', 'log.md']);
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

function parseFrontmatter(content) {
  const m = content.match(FRONTMATTER_RE);
  if (!m) return { frontmatter: null, body: content, error: 'missing frontmatter' };

  const raw = m[1];
  const body = m[2];
  const fm = {};

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf(':');
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if (val.startsWith('[') && val.endsWith(']')) {
      val = val.slice(1, -1).split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, ''));
    } else {
      val = val.replace(/^['"]|['"]$/g, '');
    }
    fm[key] = val;
  }

  return { frontmatter: fm, body, error: null };
}

function walkMdFiles(dir, base = dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      results.push(...walkMdFiles(full, base));
    } else if (name.endsWith('.md')) {
      results.push({
        abs: full,
        rel: path.relative(base, full).replace(/\\/g, '/'),
        name,
      });
    }
  }
  return results;
}

function conceptId(relPath) {
  return relPath.replace(/\.md$/, '');
}

function isConceptFile(relPath) {
  const base = path.basename(relPath);
  return base.endsWith('.md') && !RESERVED.has(base);
}

function extractLinks(body) {
  const links = [];
  const re = /\[([^\]]*)\]\(([^)]+)\)/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    links.push({ text: m[1], href: m[2] });
  }
  return links;
}

function resolveBundleLink(href, fromRel, bundleRoot) {
  if (href.startsWith('http://') || href.startsWith('https://')) return { external: true, href };
  if (href.endsWith('/')) return { dir: true, href };

  let target;
  if (href.startsWith('/')) {
    target = href.slice(1);
  } else {
    target = path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), href));
  }

  if (!target.endsWith('.md')) target += '.md';
  const abs = path.join(bundleRoot, target);
  return { external: false, rel: target.replace(/\\/g, '/'), exists: fs.existsSync(abs) };
}

function validateConcept(filePath, relPath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const { frontmatter, error } = parseFrontmatter(content);
  const issues = [];

  if (error) issues.push({ level: 'error', code: 'OKF_NO_FRONTMATTER', message: error });
  else if (!frontmatter.type || String(frontmatter.type).trim() === '') {
    issues.push({ level: 'error', code: 'OKF_MISSING_TYPE', message: 'frontmatter.type is required' });
  }

  if (!frontmatter?.title) {
    issues.push({ level: 'warn', code: 'OKF_MISSING_TITLE', message: 'recommended: title' });
  }
  if (!frontmatter?.description) {
    issues.push({ level: 'warn', code: 'OKF_MISSING_DESCRIPTION', message: 'recommended: description' });
  }

  return { relPath, conceptId: conceptId(relPath), frontmatter, issues };
}

function lintBundle(bundleRoot) {
  const files = walkMdFiles(bundleRoot, bundleRoot);
  const concepts = files.filter((f) => isConceptFile(f.rel));
  const conceptSet = new Set(concepts.map((c) => c.rel));
  const idSet = new Set(concepts.map((c) => conceptId(c.rel)));

  const report = {
    bundle: bundleRoot,
    okf_version: '0.1',
    concepts: concepts.length,
    errors: [],
    warnings: [],
    orphans: [],
    broken_links: [],
  };

  const inbound = new Map();
  for (const id of idSet) inbound.set(id, 0);

  for (const f of concepts) {
    const v = validateConcept(f.abs, f.rel);
    for (const issue of v.issues) {
      const item = { file: f.rel, ...issue };
      if (issue.level === 'error') report.errors.push(item);
      else report.warnings.push(item);
    }

    const content = fs.readFileSync(f.abs, 'utf8');
    const { body } = parseFrontmatter(content);
    const links = extractLinks(body || content);

    for (const link of links) {
      const resolved = resolveBundleLink(link.href, f.rel, bundleRoot);
      if (resolved.external || resolved.dir) continue;
      if (!resolved.exists) {
        report.broken_links.push({
          from: f.rel,
          href: link.href,
          text: link.text,
        });
      } else {
        const targetId = conceptId(resolved.rel);
        inbound.set(targetId, (inbound.get(targetId) || 0) + 1);
      }
    }
  }

  for (const [id, count] of inbound) {
    if (count === 0 && !id.startsWith('references/')) {
      report.orphans.push({ conceptId: id, inbound: 0 });
    }
  }

  report.ok = report.errors.length === 0;
  return report;
}

function copyDir(src, dest, filter = () => true) {
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src, name);
    const d = path.join(dest, name);
    if (!filter(s, name)) continue;
    if (fs.statSync(s).isDirectory()) copyDir(s, d, filter);
    else fs.copyFileSync(s, d);
  }
}

module.exports = {
  RESERVED,
  parseFrontmatter,
  walkMdFiles,
  conceptId,
  isConceptFile,
  extractLinks,
  resolveBundleLink,
  validateConcept,
  lintBundle,
  copyDir,
};
