/**
 * StickyNotes smoke tests — 门禁硬项 npm test
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

describe('project structure', () => {
  it('main entry exists', () => {
    const main = path.join(__dirname, '..', 'src', 'main.js');
    assert.ok(fs.existsSync(main), 'src/main.js must exist');
  });

  it('package.json has required scripts', () => {
    const pkg = require('../package.json');
    assert.ok(pkg.scripts.start, 'start script required');
    assert.ok(pkg.scripts.test, 'test script required');
    assert.ok(pkg.scripts.lint, 'lint script required');
  });
});

describe('preload security', () => {
  it('preload exposes limited API', () => {
    const preload = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'preload.js'),
      'utf8'
    );
    assert.ok(preload.includes('contextBridge'), 'should use contextBridge');
    assert.ok(!preload.includes('nodeIntegration: true'), 'no nodeIntegration in preload');
  });
});

describe('OKF knowledge bundle', () => {
  it('knowledge index exists with okf_version', () => {
    const index = path.join(__dirname, '..', 'brain', 'knowledge', 'index.md');
    assert.ok(fs.existsSync(index));
    const content = fs.readFileSync(index, 'utf8');
    assert.ok(content.includes('okf_version'), 'index should declare okf_version');
  });

  it('kb:lint passes on default bundle', () => {
    const { lintBundle } = require('../scripts/okf-lib.js');
    const report = lintBundle(path.join(__dirname, '..', 'brain', 'knowledge'));
    assert.ok(report.ok, `OKF lint errors: ${JSON.stringify(report.errors)}`);
  });
});
