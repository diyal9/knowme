#!/usr/bin/env node
/**
 * Light JSDoc / checkJs gate via TypeScript compiler.
 * Advisory by default; TYPECHECK_STRICT=1 makes errors exit 1.
 */
'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const JSCONFIG = path.join(ROOT, 'jsconfig.json');
const TSC = path.join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');

function main() {
  const json = process.argv.includes('--json');
  const strict = process.env.TYPECHECK_STRICT === '1';

  if (!fs.existsSync(JSCONFIG)) {
    const report = { ok: false, error: 'jsconfig.json missing' };
    if (json) process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    else console.error(report.error);
    process.exit(strict ? 1 : 0);
  }

  if (!fs.existsSync(TSC)) {
    const report = {
      ok: false,
      error: 'typescript not installed (devDependency). Run: npm install',
    };
    if (json) process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    else console.error(report.error);
    process.exit(strict ? 1 : 0);
  }

  const r = spawnSync(
    process.execPath,
    [TSC, '-p', 'jsconfig.json', '--noEmit', '--pretty', 'false'],
    {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 180000,
      env: { ...process.env, FORCE_COLOR: '0' },
    }
  );

  const out = `${r.stdout || ''}\n${r.stderr || ''}`.trim();
  const lines = out.split(/\r?\n/).filter(Boolean);
  const errors = lines.filter((l) => / error TS\d+:/.test(l));
  const report = {
    ok: r.status === 0,
    status: r.status,
    error_count: errors.length,
    sample: errors.slice(0, 12),
    raw_tail: lines.slice(-8),
    advisory: !strict,
    strict,
  };

  if (json) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } else {
    console.log(
      `typecheck: ${report.ok ? 'OK' : 'HAS_ERRORS'} errors=${report.error_count}` +
        (strict ? ' (strict)' : ' (advisory)')
    );
    for (const s of report.sample) console.log(`  ${s}`);
    if (!report.ok && report.sample.length === 0) {
      for (const s of report.raw_tail) console.log(`  ${s}`);
    }
    if (errors.length > report.sample.length) {
      console.log(`  ... +${errors.length - report.sample.length} more`);
    }
  }

  if (strict && !report.ok) process.exit(1);
  process.exit(0);
}

main();
