'use strict';

const fs = require('fs');
const path = require('path');
const okf = require('./okf-lib.js');

function copyDir(src, dest) {
  okf.copyDir(src, dest);
}

function ensureKnowledge(knowledgeDir, seedDir) {
  const index = path.join(knowledgeDir, 'index.md');
  if (fs.existsSync(index)) {
    return { seeded: false, path: knowledgeDir };
  }
  fs.mkdirSync(knowledgeDir, { recursive: true });
  if (fs.existsSync(seedDir)) {
    copyDir(seedDir, knowledgeDir);
  } else {
    fs.writeFileSync(
      index,
      '---\nokf_version: "0.1"\n---\n\n# Knowledge Bundle\n',
      'utf8'
    );
    fs.writeFileSync(path.join(knowledgeDir, 'log.md'), '# Log\n', 'utf8');
  }
  return { seeded: true, path: knowledgeDir };
}

function lint(knowledgeDir) {
  return okf.lintBundle(knowledgeDir);
}

function exportBundle(knowledgeDir, destDir) {
  const report = lint(knowledgeDir);
  if (!report.ok) {
    return { ok: false, error: 'OKF lint failed', lint: report };
  }
  if (fs.existsSync(destDir)) {
    fs.rmSync(destDir, { recursive: true, force: true });
  }
  copyDir(knowledgeDir, destDir);
  const manifest = {
    okf_version: '0.1',
    exported_at: new Date().toISOString(),
    source: 'prompt-studio',
    concepts: report.concepts,
  };
  fs.writeFileSync(
    path.join(destDir, 'MANIFEST.json'),
    JSON.stringify(manifest, null, 2),
    'utf8'
  );
  return { ok: true, path: destDir, concepts: report.concepts };
}

function mergeImport(src, dest) {
  const files = okf
    .walkMdFiles(src, src)
    .filter((f) => okf.isConceptFile(f.rel) || f.name === 'index.md' || f.name === 'log.md');
  let imported = 0;
  let skipped = 0;
  for (const f of files) {
    const targetPath = path.join(dest, f.rel);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
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
      fs.copyFileSync(f.abs, path.join(path.dirname(targetPath), `${base}-imported.md`));
      imported++;
    } else {
      fs.copyFileSync(f.abs, targetPath);
      imported++;
    }
  }
  const logPath = path.join(dest, 'log.md');
  const entry = `\n## ${new Date().toISOString().slice(0, 10)}\n* **Import (merge)**: ${imported} files, ${skipped} skipped.\n`;
  if (fs.existsSync(logPath)) fs.appendFileSync(logPath, entry, 'utf8');
  return { imported, skipped };
}

function importBundle(knowledgeDir, srcDir) {
  const lintSrc = lint(srcDir);
  if (!lintSrc.ok) {
    return { ok: false, error: 'Source bundle fails OKF lint', lint: lintSrc };
  }
  fs.mkdirSync(knowledgeDir, { recursive: true });
  const stats = mergeImport(srcDir, knowledgeDir);
  const post = lint(knowledgeDir);
  return { ok: post.ok, stats, lint: { errors: post.errors.length, warnings: post.warnings.length } };
}

function listConcepts(knowledgeDir, limit = 50) {
  if (!fs.existsSync(knowledgeDir)) return [];
  return okf
    .walkMdFiles(knowledgeDir, knowledgeDir)
    .filter((f) => okf.isConceptFile(f.rel))
    .slice(0, limit)
    .map((f) => {
      const content = fs.readFileSync(f.abs, 'utf8');
      const { frontmatter } = okf.parseFrontmatter(content);
      return {
        id: okf.conceptId(f.rel),
        title: frontmatter?.title || f.rel,
        type: frontmatter?.type || 'Concept',
      };
    });
}

function getContextSnippet(knowledgeDir, maxChars = 2000) {
  const indexPath = path.join(knowledgeDir, 'index.md');
  if (!fs.existsSync(indexPath)) return '';
  const text = fs.readFileSync(indexPath, 'utf8');
  return text.length > maxChars ? text.slice(0, maxChars) + '…' : text;
}

module.exports = {
  ensureKnowledge,
  lint,
  exportBundle,
  importBundle,
  listConcepts,
  getContextSnippet,
};
