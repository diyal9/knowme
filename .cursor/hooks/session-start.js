#!/usr/bin/env node
/**
 * sessionStart — 注入团队上下文 + harness preflight 摘要
 */
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');
const { readHookInput, emit } = require('../scripts/hook-utils.js');

readHookInput();

const ROOT = path.resolve(__dirname, '..', '..');
const r = spawnSync(process.execPath, ['.cursor/scripts/harness.js', 'preflight', '--json'], {
  cwd: ROOT,
  encoding: 'utf8',
  shell: process.platform === 'win32',
  timeout: 15000,
});

let preflight = {};
try {
  preflight = JSON.parse(r.stdout || '{}');
} catch {
  preflight = { ok: false, parse_error: true };
}

const lines = [
  '## StickyNotes Agent Team',
  '- 读取 `AGENTS.md` 与 `team/charter.md`',
  '- 工作流：制作人 → 开发 → 测试；OpenSpec OPSX + ReACT',
  '- 知识库：`brain/knowledge/index.md`（OKF，可 `/kb-export` `/kb-import`）',
  '- 命令：`/team-run` `/kb-ingest` `/kb-lint` `/evolve` `/gate-check` `/story-done`',
  `- Harness preflight: ${preflight.ok ? 'OK' : 'NEEDS ATTENTION'}`,
];

if (preflight.active_changes?.length) {
  lines.push(`- 活跃 change: ${preflight.active_changes.join(', ')}`);
}
if (preflight.missing_files?.length) {
  lines.push(`- 缺失文件: ${preflight.missing_files.join(', ')}`);
}

emit({ additional_context: lines.join('\n') });
