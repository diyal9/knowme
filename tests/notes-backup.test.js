/**
 * Notes backup bundle tests
 */
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const notesBackup = require('../src/lib/notes-backup.js');

describe('notes backup', () => {
  let tmp;
  let notesDir;
  let exportDir;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sn-backup-'));
    notesDir = path.join(tmp, 'notes-src');
    exportDir = path.join(tmp, 'export');
    fs.mkdirSync(notesDir, { recursive: true });
    fs.writeFileSync(
      path.join(notesDir, 'n_test1.json'),
      JSON.stringify({ id: 'n_test1', content: 'hello' }),
      'utf8'
    );
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('exports bundle with manifest', () => {
    const r = notesBackup.exportBundle(notesDir, exportDir);
    assert.ok(r.ok);
    assert.equal(r.count, 1);
    assert.ok(fs.existsSync(path.join(exportDir, 'MANIFEST.json')));
    assert.ok(fs.existsSync(path.join(exportDir, 'notes', 'n_test1.json')));
  });

  it('imports into empty notes dir', () => {
    notesBackup.exportBundle(notesDir, exportDir);
    const dest = path.join(tmp, 'notes-dest');
    fs.mkdirSync(dest, { recursive: true });
    const r = notesBackup.importBundle(dest, exportDir);
    assert.ok(r.ok);
    assert.equal(r.imported, 1);
    assert.ok(fs.existsSync(path.join(dest, 'n_test1.json')));
  });

  it('skips existing note ids on import', () => {
    notesBackup.exportBundle(notesDir, exportDir);
    const r = notesBackup.importBundle(notesDir, exportDir);
    assert.ok(r.ok);
    assert.equal(r.imported, 0);
    assert.equal(r.skipped, 1);
  });

  it('rejects invalid backup folder', () => {
    const bad = path.join(tmp, 'bad');
    fs.mkdirSync(bad);
    const r = notesBackup.importBundle(notesDir, bad);
    assert.equal(r.ok, false);
    assert.ok(r.error);
  });
});
