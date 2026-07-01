#!/usr/bin/env node
/**
 * OKF bundle linter — schema, orphans, broken links
 */
'use strict';

const path = require('path');
const { lintBundle } = require('./okf-lib.js');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_BUNDLE = path.join(ROOT, 'brain', 'knowledge');

function main() {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const bundleArg = args.find((a) => !a.startsWith('--'));
  const bundle = bundleArg ? path.resolve(bundleArg) : DEFAULT_BUNDLE;

  const report = lintBundle(bundle);

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    const status = report.ok ? 'PASS' : 'FAIL';
    console.log(`OKF Lint: ${status} (${report.concepts} concepts)`);
    if (report.errors.length) {
      console.log('\nErrors:');
      for (const e of report.errors) console.log(`  [${e.code}] ${e.file}: ${e.message}`);
    }
    if (report.warnings.length) {
      console.log('\nWarnings:');
      for (const w of report.warnings.slice(0, 20)) {
        console.log(`  [${w.code}] ${w.file}: ${w.message}`);
      }
      if (report.warnings.length > 20) console.log(`  ... +${report.warnings.length - 20} more`);
    }
    if (report.broken_links.length) {
      console.log('\nBroken links:');
      for (const b of report.broken_links) console.log(`  ${b.from} → ${b.href}`);
    }
    if (report.orphans.length) {
      console.log('\nOrphans (no inbound links):');
      for (const o of report.orphans) console.log(`  ${o.conceptId}`);
    }
  }

  process.exit(report.ok ? 0 : 1);
}

main();
