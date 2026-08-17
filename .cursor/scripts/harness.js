#!/usr/bin/env node
/**
 * KnowMe Agent Harness
 *
 *   check      只读健康检查（--json）
 *   preflight  会话前轻量预检（--json）
 *   gate       Story 完成硬门禁：npm test + npm run lint（--json）
 *   doctor     诊断 + 修复建议（--json）
 */
'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OPENSPEC = path.join(ROOT, 'openspec');
const CHANGES = path.join(OPENSPEC, 'changes');

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function exists(p) {
  return fs.existsSync(p);
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    timeout: opts.timeout || 120000,
    env: { ...process.env, FORCE_COLOR: '0' },
  });
  return {
    ok: r.status === 0,
    status: r.status,
    stdout: (r.stdout || '').trim(),
    stderr: (r.stderr || '').trim(),
  };
}

function npmScript(name) {
  return run('npm', ['run', name, '--silent']);
}

function listActiveChanges() {
  if (!exists(CHANGES)) return [];
  return fs.readdirSync(CHANGES, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== 'archive')
    .filter((d) => !exists(path.join(CHANGES, d.name, '.archived')))
    .map((d) => d.name);
}

function checkSoftArtifacts(changeName) {
  const base = path.join(CHANGES, changeName);
  const qaPlan = path.join(base, 'qa-plan.md');
  const codeReview = path.join(base, 'code-review.md');
  const issues = [];

  if (!exists(qaPlan)) {
    issues.push({ id: 'QA-PLAN-MISSING', path: qaPlan, level: 'advisory' });
  } else {
    const content = fs.readFileSync(qaPlan, 'utf8');
    if (!/Smoke Scope/i.test(content) || !/- \[ \]|- \[x\]/i.test(content)) {
      issues.push({ id: 'SMOKE-SCOPE-EMPTY', path: qaPlan, level: 'advisory' });
    }
  }

  if (!exists(codeReview)) {
    issues.push({ id: 'CODE-REVIEW-MISSING', path: codeReview, level: 'advisory' });
  }

  return issues;
}

function buildCheckReport() {
  const required = [
    'package.json',
    'src/main.js',
    'src/preload.js',
    'AGENTS.md',
    'openspec/config.yaml',
    'brain/knowledge/index.md',
    'brain/wiki/index.md',
    '.cursor/hooks.json',
    '.cursor/scripts/harness.js',
  ];

  const missing = required.filter((f) => !exists(path.join(ROOT, f)));
  const node = run('node', ['--version']);
  const npm = run('npm', ['--version']);

  return {
    ok: missing.length === 0 && node.ok && npm.ok,
    project: 'knowme',
    root: ROOT,
    node: node.stdout || null,
    npm: npm.stdout || null,
    missing_files: missing,
    openspec: exists(OPENSPEC),
    knowledge: exists(path.join(ROOT, 'brain', 'knowledge', 'index.md')),
    wiki: exists(path.join(ROOT, 'brain', 'wiki', 'index.md')),
    active_changes: listActiveChanges(),
    scripts: {
      test: exists(path.join(ROOT, 'tests')),
      lint: exists(path.join(ROOT, 'scripts', 'lint.js')),
    },
  };
}

function buildGateReport(changeName) {
  const hard = [];
  const test = npmScript('test');
  hard.push({
    id: 'npm-test',
    level: 'blocking',
    ok: test.ok,
    detail: test.ok ? 'pass' : (test.stderr || test.stdout || `exit ${test.status}`),
  });

  const lint = npmScript('lint');
  hard.push({
    id: 'npm-lint',
    level: 'blocking',
    ok: lint.ok,
    detail: lint.ok ? 'pass' : (lint.stderr || lint.stdout || `exit ${lint.status}`),
  });

  const renderer = npmScript('test:renderer');
  hard.push({
    id: 'test-renderer',
    level: 'blocking',
    ok: renderer.ok,
    detail: renderer.ok ? 'pass' : (renderer.stderr || renderer.stdout || `exit ${renderer.status}`),
  });

  const libTypes = npmScript('typecheck:lib');
  hard.push({
    id: 'typecheck-lib',
    level: 'blocking',
    ok: libTypes.ok,
    detail: libTypes.ok ? 'pass' : (libTypes.stderr || libTypes.stdout || `exit ${libTypes.status}`),
  });

  const soft = [];
  const changes = changeName ? [changeName] : listActiveChanges();
  for (const c of changes) {
    for (const issue of checkSoftArtifacts(c)) {
      soft.push({ ...issue, change: c });
    }
  }

  const blockingFailed = hard.some((h) => !h.ok);
  return {
    gate: 'Story 完成门禁',
    ok: !blockingFailed,
    blocking: blockingFailed,
    hard,
    soft,
    evidence: {
      test_report: 'openspec/changes/<name>/evidence/test-report.md',
      screenshots: 'openspec/changes/<name>/evidence/screenshots/',
    },
  };
}

function runAdvisoryScript(relScript, args = ['--json']) {
  const scriptPath = path.join(ROOT, relScript);
  if (!exists(scriptPath)) return { available: false };
  const r = run('node', [scriptPath, ...args], { timeout: 180000 });
  let parsed = null;
  try {
    parsed = JSON.parse(r.stdout || '{}');
  } catch {
    parsed = null;
  }
  return {
    available: true,
    ok: r.ok && (parsed ? parsed.ok !== false : true),
    status: r.status,
    report: parsed,
    detail: parsed
      ? null
      : (r.stderr || r.stdout || '').slice(0, 400),
  };
}

function buildDoctorReport() {
  const check = buildCheckReport();
  const fixes = [];
  const advisories = [];

  if (check.missing_files.length) {
    fixes.push({ action: 'restore_files', files: check.missing_files });
  }
  if (!check.openspec) {
    fixes.push({ action: 'run', command: 'npx @fission-ai/openspec@latest init --tools cursor --force' });
  }
  if (!check.scripts.test) {
    fixes.push({ action: 'run', command: 'npm test' });
  }

  const daemonDocs = runAdvisoryScript(path.join('scripts', 'check-daemon-docs-sync.js'));
  if (daemonDocs.available) {
    advisories.push({
      id: 'daemon-docs-sync',
      level: 'advisory',
      ok: daemonDocs.ok,
      error_count: daemonDocs.report?.errors?.length || 0,
      advisory_count: daemonDocs.report?.advisories?.length || 0,
      local_version: daemonDocs.report?.local?.api_version || null,
    });
    if (!daemonDocs.ok) {
      fixes.push({ action: 'run', command: 'npm run daemon:docs-check' });
    }
  }

  const typecheck = runAdvisoryScript(path.join('scripts', 'check-jsdoc.js'));
  if (typecheck.available) {
    advisories.push({
      id: 'typecheck-jsdoc',
      level: 'advisory',
      ok: typecheck.ok,
      error_count: typecheck.report?.error_count ?? null,
    });
    if (!typecheck.ok) {
      fixes.push({ action: 'run', command: 'npm run typecheck' });
    }
  }

  return {
    ok: check.ok,
    check,
    advisories,
    fixes,
    hints: [
      'Read AGENTS.md at session start',
      'Run: node .cursor/scripts/harness.js preflight --json',
      'Before story-done: node .cursor/scripts/harness.js gate --json',
      'Optional: npm run daemon:docs-check / npm run typecheck (advisory)',
    ],
  };
}

function output(data, json) {
  if (json) {
    process.stdout.write(JSON.stringify(data, null, 2) + '\n');
  } else {
    const lines = [];
    if (data.gate) {
      lines.push(`Gate: ${data.gate} — ${data.ok ? 'PASS' : 'FAIL'}`);
      for (const h of data.hard || []) {
        lines.push(`  [${h.level}] ${h.id}: ${h.ok ? 'PASS' : 'FAIL'} — ${h.detail}`);
      }
      for (const s of data.soft || []) {
        lines.push(`  [${s.level}] ${s.id} (${s.change}): WARN`);
      }
    } else if (data.check) {
      lines.push(`Doctor: ${data.ok ? 'OK' : 'NEEDS ATTENTION'}`);
      for (const a of data.advisories || []) {
        lines.push(
          `  [advisory] ${a.id}: ${a.ok ? 'OK' : 'WARN'}` +
            (a.error_count != null ? ` errors=${a.error_count}` : '')
        );
      }
    } else {
      lines.push(`Check: ${data.ok ? 'OK' : 'FAIL'}`);
      if (data.missing_files?.length) lines.push(`  missing: ${data.missing_files.join(', ')}`);
      if (data.active_changes?.length) lines.push(`  changes: ${data.active_changes.join(', ')}`);
    }
    process.stdout.write(lines.join('\n') + '\n');
  }
}

function main() {
  const args = process.argv.slice(2);
  const cmd = args[0] || 'check';
  const json = args.includes('--json');
  const changeIdx = args.indexOf('--change');
  const changeName = changeIdx >= 0 ? args[changeIdx + 1] : null;

  let report;
  switch (cmd) {
    case 'check':
      report = buildCheckReport();
      break;
    case 'preflight':
      report = { ...buildCheckReport(), preflight: true, needs_fix: false };
      if (report.missing_files.length) report.needs_fix = true;
      break;
    case 'gate':
      report = buildGateReport(changeName);
      break;
    case 'doctor':
      report = buildDoctorReport();
      break;
    default:
      process.stderr.write(`Unknown command: ${cmd}\n`);
      process.exit(2);
  }

  output(report, json);
  const exitCode = report.ok === false || report.blocking || report.needs_fix ? 1 : 0;
  process.exit(exitCode);
}

if (require.main === module) main();

module.exports = { buildCheckReport, buildGateReport, buildDoctorReport, ROOT };
