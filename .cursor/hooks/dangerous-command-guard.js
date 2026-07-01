#!/usr/bin/env node
/**
 * beforeShellExecution — 危险命令须用户确认
 */
'use strict';

const { readHookInput, emit } = require('../scripts/hook-utils.js');

const DENY = [
  /\brm\s+-[^\s]*r[^\s]*f|\brm\s+-[^\s]*f[^\s]*r/i,
  /\bgit\s+reset\s+--hard\b/i,
  /\bgit\s+clean\s+-[^\s]*f/i,
  /\bgit\s+checkout\s+--\s/i,
  /\bgit\s+push\b[^\n]*(--force\b|--force-with-lease\b|\s-f\b)/i,
  /\bgit\s+commit\b[^\n]*--amend\b/i,
  /\bRemove-Item\b[^\n]*-Recurse\b[^\n]*-Force\b/i,
  /\b(shutdown|reboot|halt|poweroff|format\s+[a-z]:)\b/i,
  /\bdel\s+\/f\s+\/s\b/i,
  /\brmdir\s+\/s\s+\/q\b/i,
];

const ASK = [
  /\bnpm\s+publish\b/i,
  /\belectron-builder\b/i,
  /\bcurl\b[^\n]*\|\s*(bash|sh)\b/i,
];

const input = readHookInput();
const command = String(input.command || '');

if (process.env.STICKY_GUARD_DISABLE === '1') {
  emit({ permission: 'allow' });
  process.exit(0);
}

for (const re of DENY) {
  if (re.test(command)) {
    emit({
      permission: 'ask',
      user_message: '该命令具有破坏性，需您确认后才能执行。',
      agent_message: `Hook 拦截危险命令: ${command.slice(0, 120)}`,
    });
    process.exit(0);
  }
}

for (const re of ASK) {
  if (re.test(command)) {
    emit({
      permission: 'ask',
      user_message: '该命令可能发布或构建产物，请确认后继续。',
      agent_message: `Hook 提示确认: ${command.slice(0, 120)}`,
    });
    process.exit(0);
  }
}

emit({ permission: 'allow' });
