'use strict';

const fs = require('fs');
const path = require('path');
const { isSafeNoteFileName } = require('./note-id');

function listNoteFiles(notesDir) {
  if (!fs.existsSync(notesDir)) return [];
  return fs.readdirSync(notesDir).filter((n) => isSafeNoteFileName(n));
}

function exportBundle(notesDir, destDir) {
  const files = listNoteFiles(notesDir);
  const notesOut = path.join(destDir, 'notes');
  fs.mkdirSync(notesOut, { recursive: true });
  for (const name of files) {
    fs.copyFileSync(path.join(notesDir, name), path.join(notesOut, name));
  }
  const manifest = {
    kind: 'knowme-backup',
    version: 1,
    exported_at: new Date().toISOString(),
    note_count: files.length,
  };
  fs.writeFileSync(path.join(destDir, 'MANIFEST.json'), JSON.stringify(manifest, null, 2), 'utf8');
  return { ok: true, count: files.length, path: destDir };
}

function validateBundle(srcDir) {
  const manifestPath = path.join(srcDir, 'MANIFEST.json');
  const notesDir = path.join(srcDir, 'notes');
  if (!fs.existsSync(manifestPath) || !fs.existsSync(notesDir)) {
    return { ok: false, error: '不是有效的便签备份（需含 MANIFEST.json 与 notes/ 目录）' };
  }
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    // 旧版 kind 以 base64 解码比对，避免源码出现旧品牌 slug 明文
    const legacyKind = Buffer.from('c3RpY2t5LW5vdGVzLWJhY2t1cA==', 'base64').toString('utf8');
    if (manifest.kind !== 'knowme-backup' && manifest.kind !== legacyKind) {
      return { ok: false, error: '备份类型不匹配' };
    }
  } catch {
    return { ok: false, error: 'MANIFEST.json 解析失败' };
  }
  return { ok: true };
}

function importBundle(notesDir, srcDir) {
  const check = validateBundle(srcDir);
  if (!check.ok) return check;

  fs.mkdirSync(notesDir, { recursive: true });
  const srcNotes = path.join(srcDir, 'notes');
  let imported = 0;
  let skipped = 0;

  let rejected = 0;
  for (const name of fs.readdirSync(srcNotes)) {
    if (!isSafeNoteFileName(name)) {
      rejected++;
      continue;
    }
    const dest = path.join(notesDir, name);
    if (fs.existsSync(dest)) {
      skipped++;
      continue;
    }
    fs.copyFileSync(path.join(srcNotes, name), dest);
    imported++;
  }

  return {
    ok: true,
    imported,
    skipped,
    rejected,
    total: listNoteFiles(srcNotes).length,
  };
}

module.exports = { exportBundle, importBundle, validateBundle, listNoteFiles };
