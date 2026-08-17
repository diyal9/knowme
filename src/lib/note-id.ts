'use strict';

const path = require('path');

/** Safe note id: single path segment, no traversal. Matches generated `n_<timestamp>` and legacy ids. */
const NOTE_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

function isSafeNoteId(id) {
  const s = String(id || '');
  if (!NOTE_ID_RE.test(s)) return false;
  if (s.includes('..') || s.includes('/') || s.includes('\\') || s.includes('\0')) return false;
  return true;
}

function isSafeNoteFileName(name) {
  const base = path.basename(String(name || ''));
  if (base !== name) return false;
  if (!base.endsWith('.json')) return false;
  const id = base.slice(0, -'.json'.length);
  return isSafeNoteId(id);
}

/** Absolute path to note JSON under notesDir, or null if id is invalid / escapes root. */
function resolveNoteFile(notesDir, id) {
  if (!isSafeNoteId(id)) return null;
  const file = path.join(notesDir, `${id}.json`);
  const resolved = path.resolve(file);
  const root = path.resolve(notesDir);
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (resolved !== root && !resolved.startsWith(rootWithSep)) return null;
  return resolved;
}

module.exports = { isSafeNoteId, isSafeNoteFileName, resolveNoteFile };
