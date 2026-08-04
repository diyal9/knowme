#!/usr/bin/env node
/**
 * Export OKF knowledge bundle for sharing
 * Output: dist/kb-export/knowme-knowledge-<date>/
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { lintBundle, copyDir } = require('./okf-lib.js');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(ROOT, 'brain', 'knowledge');
const DIST = path.join(ROOT, 'dist', 'kb-export');

function main() {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const skipLint = args.includes('--skip-lint');
  const outIdx = args.indexOf('--out');
  const date = new Date().toISOString().slice(0, 10);
  const defaultName = `knowme-knowledge-${date}`;
  const outName = outIdx >= 0 ? args[outIdx + 1] : defaultName;
  const dest = path.join(DIST, outName);

  if (!skipLint) {
    const lint = lintBundle(SOURCE);
    if (!lint.ok) {
      console.error('Export blocked: OKF lint failed. Fix errors or use --skip-lint');
      if (json) console.log(JSON.stringify({ ok: false, lint }, null, 2));
      else {
        for (const e of lint.errors) console.error(`  ${e.file}: ${e.message}`);
      }
      process.exit(1);
    }
  }

  if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
  copyDir(SOURCE, dest);

  const manifest = {
    okf_version: '0.1',
    exported_at: new Date().toISOString(),
    source: 'knowme',
    bundle_path: dest,
    concepts: lintBundle(SOURCE).concepts,
    import_hint: 'npm run kb:import -- ' + path.relative(ROOT, dest),
  };

  fs.writeFileSync(path.join(dest, 'MANIFEST.json'), JSON.stringify(manifest, null, 2), 'utf8');

  const result = { ok: true, path: dest, manifest };
  if (json) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`OKF export OK → ${dest}`);
    console.log(`Share: zip the folder or git clone`);
    console.log(`Import: npm run kb:import -- ${path.relative(ROOT, dest)}`);
  }
}

main();
