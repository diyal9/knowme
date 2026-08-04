/**
 * Note id path safety
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const os = require('os');
const fs = require('fs');
const noteId = require('../src/lib/note-id');
const notesBackup = require('../src/lib/notes-backup');

describe('note-id', () => {
  it('accepts generated ids', () => {
    assert.ok(noteId.isSafeNoteId('n_1700000000000'));
    assert.ok(noteId.isSafeNoteFileName('n_1700000000000.json'));
  });

  it('rejects traversal and separators', () => {
    assert.ok(!noteId.isSafeNoteId('../etc'));
    assert.ok(!noteId.isSafeNoteId('n/evil'));
    assert.ok(!noteId.isSafeNoteFileName('..%2f..%2f.json'));
  });

  it('resolveNoteFile stays under notes root', () => {
    const root = path.join(os.tmpdir(), 'note-id-root');
    const ok = noteId.resolveNoteFile(root, 'n_1');
    assert.ok(ok);
    assert.ok(ok.startsWith(path.resolve(root)));
    assert.equal(noteId.resolveNoteFile(root, '../n_1'), null);
  });
});

describe('notes backup import safety', () => {
  it('skips unsafe filenames on import', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sn-import-'));
    const notesDir = path.join(tmp, 'dest');
    const bundle = path.join(tmp, 'bundle');
    const srcNotes = path.join(bundle, 'notes');
    fs.mkdirSync(srcNotes, { recursive: true });
    fs.writeFileSync(
      path.join(bundle, 'MANIFEST.json'),
      JSON.stringify({ kind: 'knowme-backup', version: 1 }),
      'utf8'
    );
    fs.writeFileSync(path.join(srcNotes, 'n_ok.json'), '{"id":"n_ok","content":"x"}', 'utf8');
    fs.writeFileSync(path.join(srcNotes, '..%2f..%2f.json'), '{"id":"bad"}', 'utf8');

    fs.mkdirSync(notesDir, { recursive: true });
    const r = notesBackup.importBundle(notesDir, bundle);
    assert.ok(r.ok);
    assert.equal(r.imported, 1);
    assert.equal(r.rejected, 1);
    assert.ok(fs.existsSync(path.join(notesDir, 'n_ok.json')));
    assert.ok(!fs.existsSync(path.join(notesDir, '..%2f..%2f.json')));

    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
