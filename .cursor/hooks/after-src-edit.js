#!/usr/bin/env node
/**
 * afterFileEdit — src/ 变更后提示跑 test/lint
 */
'use strict';

const { readHookInput, emit } = require('../scripts/hook-utils.js');

const input = readHookInput();
const filePath = String(input.file_path || input.path || '');

if (/[/\\]src[/\\]/.test(filePath) && /\.(js|html|css)$/.test(filePath)) {
  emit({
    additional_context:
      `[Harness] \`${filePath}\` 已修改。开发完成前请运行 \`npm test\` 与 \`npm run lint\`，并更新 change 的 dev-self-test 证据。`,
  });
} else {
  emit({});
}
