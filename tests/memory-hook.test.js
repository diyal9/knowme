/**
 * KnowMe agent memory hook smoke tests
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const HOOKS = path.join(ROOT, '.cursor', 'hooks');

function py(args, input) {
  return spawnSync('python', ['-X', 'utf8', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    input: input || '',
    env: { ...process.env, STICKY_MEMORY: '1' },
  });
}

describe('sticky-agent-memory hooks', () => {
  it('memory_paths resolves root under knowme', () => {
    const r = py([
      '-c',
      "import sys; sys.path.insert(0,'.cursor/hooks'); import memory_paths as m; print(m.memory_root())",
    ]);
    assert.equal(r.status, 0, r.stderr);
    assert.ok(r.stdout.includes('knowme'), r.stdout);
    assert.ok(r.stdout.includes('memory'), r.stdout);
  });

  it('memory_cursor_hook sessionStart returns JSON', () => {
    const hook = path.join(HOOKS, 'memory_cursor_hook.py');
    assert.ok(fs.existsSync(hook));
    const r = py([hook, 'sessionStart'], '{}');
    assert.equal(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout.trim() || '{}');
    assert.ok(typeof out === 'object');
  });

  it('dangerous command still allowed for npm test', () => {
    const r = spawnSync('node', ['.cursor/hooks/dangerous-command-guard.js'], {
      cwd: ROOT,
      encoding: 'utf8',
      input: JSON.stringify({ command: 'npm test' }),
    });
    assert.equal(r.status, 0);
    const out = JSON.parse(r.stdout);
    assert.equal(out.permission, 'allow');
  });
});
