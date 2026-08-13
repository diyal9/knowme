/**
 * Cursor project hook configuration contracts.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const hooksConfig = JSON.parse(
  fs.readFileSync(path.join(ROOT, '.cursor', 'hooks.json'), 'utf8')
);

describe('Cursor project hooks', () => {
  it('does not turn ordinary agent stops into visible gate-reminder turns', () => {
    const stopHooks = Array.isArray(hooksConfig.hooks?.stop)
      ? hooksConfig.hooks.stop
      : [];
    const commands = stopHooks.map(item => String(item?.command || ''));

    assert.ok(
      commands.includes('python -X utf8 .cursor/hooks/memory_cursor_hook.py stop'),
      'the memory finalizer should remain registered'
    );
    assert.ok(
      commands.every(command => !command.includes('stop-gate-reminder.js')),
      'the visible follow-up reminder must not run on every stop'
    );
  });
});
