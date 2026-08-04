#!/usr/bin/env node
/**
 * stop — 有活跃 change 时提醒门禁
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { readHookInput, emit } = require('../scripts/hook-utils.js');

readHookInput();

const changesDir = path.resolve(__dirname, '..', '..', 'openspec', 'changes');
let active = [];
if (fs.existsSync(changesDir)) {
  // 与 harness listActiveChanges 一致：带 .archived 的残桩/tombstone 不算活跃
  active = fs.readdirSync(changesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== 'archive')
    .filter((d) => !fs.existsSync(path.join(changesDir, d.name, '.archived')))
    .map((d) => d.name);
}

if (active.length === 0) {
  emit({});
  process.exit(0);
}

emit({
  followup_message:
    `活跃 change: ${active.join(', ')}。Story 完成前须：开发自测 → 制作人验收 → 测试 QA → \`/gate-check\` → \`/story-done\`。`,
});
