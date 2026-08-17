'use strict';

function findVersionRoot(note, readNote) {
  let current = note;
  const seen = new Set();
  while (current?.parentNoteId && !seen.has(current.parentNoteId)) {
    seen.add(current.id);
    const parent = readNote(current.parentNoteId);
    if (!parent) break;
    current = parent;
  }
  return current.id;
}

function collectVersionChain(allNotes, rootId) {
  const byId = new Map(allNotes.map((n) => [n.id, n]));
  const children = new Map();
  for (const n of allNotes) {
    const pid = n.parentNoteId;
    if (!pid) continue;
    if (!children.has(pid)) children.set(pid, []);
    children.get(pid).push(n);
  }

  const result = [];
  const walk = (id) => {
    const n = byId.get(id);
    if (n) result.push(n);
    const kids = (children.get(id) || []).slice().sort(
      (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
    );
    for (const c of kids) walk(c.id);
  };
  walk(rootId);
  return result;
}

function getNoteVersions(noteId, allNotes, readNote) {
  const note = allNotes.find((n) => n.id === noteId) || readNote(noteId);
  if (!note) return [];
  const rootId = findVersionRoot(note, readNote);
  return collectVersionChain(allNotes, rootId);
}

module.exports = { findVersionRoot, collectVersionChain, getNoteVersions };
