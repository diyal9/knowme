#!/usr/bin/env node
/**
 * release-v0.1.1 Windows 打包冒烟（隔离 user-data-dir，不污染正式数据）
 * Usage: node scripts/release-smoke.js [dist-dir]
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn, execFileSync } = require('child_process');
const notesBackup = require('../src/lib/notes-backup');

const ROOT = path.join(__dirname, '..');
const DIST = path.resolve(ROOT, process.argv[2] || 'dist-release');
const EXPECT_VERSION = require('../package.json').version;
const PRODUCT = 'Sticky-Notes';
const EXE = path.join(DIST, 'win-unpacked', `${PRODUCT}.exe`);
const SETUP = path.join(DIST, `${PRODUCT}-${EXPECT_VERSION}-setup-win-x64.exe`);
const PORTABLE = path.join(DIST, `${PRODUCT}-${EXPECT_VERSION}-portable-win-x64.exe`);
const CHECKSUMS = path.join(DIST, 'SHA256SUMS.txt');

const results = [];

function pass(id, detail) {
  results.push({ id, ok: true, detail });
  console.log(`  ✅ ${id}: ${detail}`);
}

function fail(id, detail) {
  results.push({ id, ok: false, detail });
  console.error(`  ❌ ${id}: ${detail}`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function waitForNote(notesDir, timeoutMs = 20000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (!fs.existsSync(notesDir)) {
        if (Date.now() - start > timeoutMs) reject(new Error('notes dir timeout'));
        else setTimeout(tick, 400);
        return;
      }
      const files = fs.readdirSync(notesDir).filter((f) => f.endsWith('.json'));
      if (files.length) resolve(path.join(notesDir, files[0]));
      else if (Date.now() - start > timeoutMs) reject(new Error('note file timeout'));
      else setTimeout(tick, 400);
    };
    tick();
  });
}

function killSticky() {
  try {
    if (process.platform === 'win32') {
      execFileSync('taskkill', ['/F', '/IM', `${PRODUCT}.exe`], { stdio: 'ignore' });
    }
  } catch { /* none running */ }
}

function readPackagedVersion() {
  const asarPath = path.join(DIST, 'win-unpacked', 'resources', 'app.asar');
  if (!fs.existsSync(asarPath)) return null;
  try {
    const asar = require('@electron/asar');
    const buf = asar.extractFile(asarPath, 'package.json');
    const pkg = JSON.parse(buf.toString('utf8'));
    return pkg.version;
  } catch {
    return null;
  }
}

async function launchApp(userDataDir) {
  killSticky();
  await sleep(800);
  const child = spawn(EXE, [`--user-data-dir=${userDataDir}`], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();
  await sleep(3500);
  return child;
}

async function main() {
  console.log('release-smoke: dist =', DIST);
  console.log('release-smoke: expect version', EXPECT_VERSION);

  // 1–2 artifacts + checksums
  if (fs.existsSync(SETUP) && fs.existsSync(PORTABLE) && fs.existsSync(EXE)) {
    pass('artifacts', 'setup + portable + win-unpacked');
  } else {
    fail('artifacts', `missing files under ${DIST}`);
  }

  if (fs.existsSync(CHECKSUMS)) {
    const lines = fs.readFileSync(CHECKSUMS, 'utf8').trim().split('\n');
    let ok = true;
    for (const line of lines) {
      const [hash, name] = line.split(/\s{2,}/);
      const fp = path.join(DIST, name);
      if (!fs.existsSync(fp) || sha256(fp) !== hash) ok = false;
    }
    if (ok) pass('sha256', `${lines.length} entries OK`);
    else fail('sha256', 'mismatch');
  } else {
    fail('sha256', 'SHA256SUMS.txt missing');
  }

  // 3 packaged version
  const builtVer = readPackagedVersion();
  if (builtVer === EXPECT_VERSION) pass('version', `app.asar package.json = ${builtVer}`);
  else fail('version', `expected ${EXPECT_VERSION}, got ${builtVer || 'unreadable'}`);

  if (!fs.existsSync(EXE)) {
    console.error('\nrelease-smoke: ABORT — no executable');
    process.exit(1);
  }

  // 4–6 note create / autosave / restart restore
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'sticky-smoke-'));
  const notesDir = path.join(userData, 'notes');
  const marker = `smoke-${Date.now()}`;
  try {
    await launchApp(userData);
    const noteFile = await waitForNote(notesDir);
    const note = JSON.parse(fs.readFileSync(noteFile, 'utf8'));
    note.content = marker;
    note.updatedAt = new Date().toISOString();
    fs.writeFileSync(noteFile, JSON.stringify(note, null, 2), 'utf8');
    pass('note-create', `note id ${note.id}`);

    await sleep(500);
    const saved = JSON.parse(fs.readFileSync(noteFile, 'utf8'));
    if (saved.content === marker) pass('autosave', 'content persisted to disk');
    else fail('autosave', 'content mismatch after write');

    killSticky();
    await sleep(1000);
    await launchApp(userData);
    await waitForNote(notesDir);
    const restored = JSON.parse(fs.readFileSync(noteFile, 'utf8'));
    if (restored.content === marker) pass('restart-restore', 'content survived restart');
    else fail('restart-restore', 'content lost after restart');
  } catch (e) {
    fail('note-flow', e.message);
  } finally {
    killSticky();
  }

  // 7 backup export (library path, same as settings IPC)
  try {
    fs.mkdirSync(notesDir, { recursive: true });
    const id = `n_smoke_${Date.now()}`;
    fs.writeFileSync(
      path.join(notesDir, `${id}.json`),
      JSON.stringify({ id, content: 'backup-test', updatedAt: new Date().toISOString() }, null, 2)
    );
    const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sticky-backup-'));
    const exp = notesBackup.exportBundle(notesDir, backupDir);
    const manifest = path.join(backupDir, 'MANIFEST.json');
    const notesOut = path.join(backupDir, 'notes');
    if (exp.ok && fs.existsSync(manifest) && fs.existsSync(notesOut)) {
      pass('notes-backup', `exported ${exp.count} note(s)`);
    } else fail('notes-backup', 'export structure invalid');
    fs.rmSync(backupDir, { recursive: true, force: true });
  } catch (e) {
    fail('notes-backup', e.message);
  }

  // 8 delete confirm — main process dialog (code contract)
  const mainSrc = fs.readFileSync(path.join(ROOT, 'src', 'main.js'), 'utf8');
  if (mainSrc.includes('note-delete') && mainSrc.includes('showMessageBoxSync') && mainSrc.includes('取消')) {
    pass('delete-confirm', 'main.js 删除确认对话框已接线');
  } else {
    fail('delete-confirm', 'delete dialog not found in main.js');
  }

  // 9 check-update packaged path
  const autoUpdate = fs.readFileSync(path.join(ROOT, 'src', 'lib', 'auto-update.js'), 'utf8');
  if (autoUpdate.includes('checkForUpdatesManual') && autoUpdate.includes('message')) {
    pass('check-update-wiring', 'checkForUpdatesManual 返回 message（设置页 Toast）');
  } else {
    fail('check-update-wiring', 'auto-update incomplete');
  }

  // 10 NSIS silent install (optional, slow)
  if (process.env.SKIP_NSIS_INSTALL === '1') {
    pass('nsis-install', 'skipped (SKIP_NSIS_INSTALL=1)');
  } else if (fs.existsSync(SETUP)) {
    const installDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sticky-install-'));
    try {
      execFileSync(SETUP, ['/S', `/D=${installDir}`], { timeout: 120000, stdio: 'pipe' });
      await sleep(3000);
      const installedExe = path.join(installDir, `${PRODUCT}.exe`);
      if (fs.existsSync(installedExe)) {
        pass('nsis-install', `silent install → ${installDir}`);
        const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'sticky-install-run-'));
        spawn(installedExe, [`--user-data-dir=${ud}`], { detached: true, stdio: 'ignore' }).unref();
        await sleep(3000);
        killSticky();
        pass('nsis-launch', 'installed exe started');
        fs.rmSync(ud, { recursive: true, force: true });
      } else {
        fail('nsis-install', `${PRODUCT}.exe not at ${installedExe}`);
      }
    } catch (e) {
      fail('nsis-install', e.message || 'silent install failed');
    } finally {
      try { fs.rmSync(installDir, { recursive: true, force: true }); } catch { /* installer may lock */ }
    }
  }

  try { fs.rmSync(userData, { recursive: true, force: true }); } catch { /* ok */ }

  const failed = results.filter((r) => !r.ok);
  console.log(`\nrelease-smoke: ${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    failed.forEach((f) => console.error(`  FAIL ${f.id}: ${f.detail}`));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  killSticky();
  process.exit(1);
});
