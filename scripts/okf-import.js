#!/usr/bin/env node
/**
 * Import external OKF bundle into brain/knowledge/
 *
 *   npm run kb:import -- <path-to-bundle>
 *   npm run kb:import -- <path> --merge     # merge, don't replace
 *   npm run kb:import -- <path> --replace   # replace entire knowledge/ (default)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { lintBundle, copyDir, walkMdFiles, isConceptFile } = require('./okf-lib.js');

const ROOT = path.resolve(__dirname, '..');
const TARGET = path.join(ROOT, 'brain', 'knowledge');
const BACKUP = path.join(ROOT, 'brain', '.knowledge-backup');

function mergeBundles(src, dest) {
  const files = walkMdFiles(src, src).filter((f) => isConceptFile(f.rel) || f.name === 'index.md' || f.name === 'log.md');
  let imported = 0;
  let skipped = 0;

  for (const f of files) {
    const targetPath = path.join(dest, f.rel);
    const targetDir = path.dirname(targetPath);
    fs.mkdirSync(targetDir, { recursive: true });

    if (fs.existsSync(targetPath) && f.name !== 'log.md') {
      const existing = fs.readFileSync(targetPath, 'utf8');
      const incoming = fs.readFileSync(f.abs, 'utf8');
      if (existing === incoming) {
        skipped++;
        continue;
      }
      if (f.name === 'index.md') {
        fs.copyFileSync(f.abs, targetPath);
        imported++;
        continue;
      }
      const base = path.basename(f.rel, '.md');
      const alt = path.join(targetDir, `${base}-imported.md`);
      fs.copyFileSync(f.abs, alt);
      imported++;
    } else {
      fs.copyFileSync(f.abs, targetPath);
      imported++;
    }
  }

  return { imported, skipped };
}

function appendImportLog(mode, src, stats) {
  const logPath = path.join(TARGET, 'log.md');
  const date = new Date().toISOString().slice(0, 10);
  const entry = `\n## ${date}\n* **Import (${mode})**: from \`${src}\` — ${stats.imported} files, ${stats.skipped} skipped.\n`;
  if (fs.existsSync(logPath)) {
    const content = fs.readFileSync(logPath, 'utf8');
    const lines = content.split('\n');
    const headerEnd = lines.findIndex((l, i) => i > 0 && l.startsWith('## '));
    if (headerEnd > 0) {
      lines.splice(headerEnd, 0, entry.trim());
      fs.writeFileSync(logPath, lines.join('\n'), 'utf8');
    } else {
      fs.appendFileSync(logPath, entry, 'utf8');
    }
  }
}

function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--') || a === '--merge' || a === '--replace');
  const json = process.argv.includes('--json');
  const merge = process.argv.includes('--merge');
  const replace = process.argv.includes('--replace') || !merge;
  const srcArg = process.argv.slice(2).find((a) => !a.startsWith('--'));

  if (!srcArg) {
    console.error('Usage: kb:import <bundle-path> [--merge|--replace] [--json]');
    process.exit(2);
  }

  const src = path.resolve(srcArg);
  if (!fs.existsSync(src)) {
    console.error(`Bundle not found: ${src}`);
    process.exit(2);
  }

  const lint = lintBundle(src);
  if (!lint.ok) {
    console.error('Import blocked: source bundle fails OKF lint');
    for (const e of lint.errors) console.error(`  ${e.file}: ${e.message}`);
    process.exit(1);
  }

  if (replace && fs.existsSync(TARGET)) {
    if (fs.existsSync(BACKUP)) fs.rmSync(BACKUP, { recursive: true, force: true });
    copyDir(TARGET, BACKUP);
    fs.rmSync(TARGET, { recursive: true, force: true });
    copyDir(src, TARGET, (s, name) => name !== 'MANIFEST.json');
    appendImportLog('replace', src, { imported: lint.concepts, skipped: 0 });
  } else {
    fs.mkdirSync(TARGET, { recursive: true });
    const stats = mergeBundles(src, TARGET);
    appendImportLog('merge', src, stats);
  }

  const postLint = lintBundle(TARGET);
  const result = {
    ok: postLint.ok,
    mode: replace ? 'replace' : 'merge',
    source: src,
    target: TARGET,
    backup: replace ? BACKUP : null,
    lint: { errors: postLint.errors.length, warnings: postLint.warnings.length },
  };

  if (json) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`OKF import OK (${result.mode})`);
    console.log(`Target: ${TARGET}`);
    if (result.backup) console.log(`Backup: ${BACKUP}`);
    if (!postLint.ok) console.warn('Warning: post-import lint has issues');
  }

  process.exit(postLint.ok ? 0 : 1);
}

main();
