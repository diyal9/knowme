/**
 * KnowMe smoke tests — 门禁硬项 npm test
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const { readPreload } = require('./helpers/current-src');

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
    const preload = readPreload();
    assert.ok(preload.includes('contextBridge'), 'should use contextBridge');
    assert.ok(!preload.includes('nodeIntegration: true'), 'no nodeIntegration in preload');
  });
});

describe('release materials', () => {
  it('LICENSE exists', () => {
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'LICENSE')));
  });

  it('PRIVACY.md exists', () => {
    const privacy = path.join(__dirname, '..', 'PRIVACY.md');
    assert.ok(fs.existsSync(privacy));
    const content = fs.readFileSync(privacy, 'utf8');
    assert.ok(content.includes('API Key'), 'privacy should cover API Key');
    assert.ok(content.includes('KnowMe'), 'privacy should name the product');
  });

  it('package version matches release target', () => {
    const pkg = require('../package.json');
    assert.equal(pkg.version, '0.3.0');
  });

  it('release workflow runs test and lint', () => {
    const wf = fs.readFileSync(
      path.join(__dirname, '..', '.github', 'workflows', 'release.yml'),
      'utf8'
    );
    assert.ok(wf.includes('npm test'));
    assert.ok(wf.includes('npm run lint'));
    assert.ok(wf.includes('needs: test'));
  });
});
describe('knowme v0.2', () => {
  it('prompt-sections module exists', () => {
    const mod = require('../src/lib/prompt-sections');
    assert.ok(typeof mod.assembleContent === 'function');
    assert.ok(typeof mod.migrateNoteFields === 'function');
  });

  it('preload exposes v0.2 IPC', () => {
    const preload = readPreload();
    assert.ok(preload.includes('workspaceInit'));
    assert.ok(preload.includes('buildFinalPrompt'));
    assert.ok(preload.includes('knowledgeWriteConcept'));
    assert.ok(preload.includes('listSkills'));
    assert.ok(preload.includes('createSkill'));
    assert.ok(preload.includes('knowledgeProviderList'), 'dual knowledge base provider bridge');
    assert.ok(preload.includes('knowledgeProviderQuery'), 'provider query bridge');
    assert.ok(preload.includes('sourcesTree'), 'content source tree for @ catalog');
    assert.ok(!preload.includes('getNoteVersions'), 'retired note version bridge');
    assert.ok(!preload.includes('promoteToOkf'), 'legacy note→OKF bridge removed');
  });

  it('React memory entry exists', () => {
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'src', 'renderer', 'memory', 'main.tsx')));
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
    const { lintBundle } = require('../src/lib/okf-lib.ts');
    const report = lintBundle(path.join(__dirname, '..', 'brain', 'knowledge'));
    assert.ok(report.ok, `OKF lint errors: ${JSON.stringify(report.errors)}`);
  });
});
