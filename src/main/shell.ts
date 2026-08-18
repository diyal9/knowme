'use strict'

/**
 * 窗口句柄、notes 数据兼容 stub、工作台/设置/记忆/日志窗。
 * 不负责图标路径（见 icons.ts）或知识检索。
 */

/** 挂载窗口与托盘相关胶水；须在 icons.create 之后。 */
function create(ctx) {
ctx.noteWins = new Map();
ctx.delPending = new Set();
ctx.tray = null, ctx.settingsWin = null, ctx.listWin = null, ctx.memoryWin = null, ctx.workspaceWin = null, ctx.logViewerWin = null;
ctx.taskbarHooked = new WeakSet();
ctx.APP_DISPLAY_NAME = 'KnowMe';
ctx.isQuitting = false;
ctx.lastClosedNoteId = null;
ctx.noteLabelForMenu = function noteLabelForMenu(n) {
    if (!n)
        return '未命名';
    const title = (n.project || '').trim();
    if (title)
        return title.slice(0, 28);
    const line = (n.content || '').split('\n')[0].trim();
    return (line || '未命名').slice(0, 28);
};
ctx.hasOtherVisibleNotes = function hasOtherVisibleNotes(exceptId) {
    for (const [id, w] of ctx.noteWins) {
        if (exceptId && id === exceptId)
            continue;
        if (w && !w.isDestroyed() && w.isVisible())
            return true;
    }
    return false;
};
ctx.sendListHighlight = function sendListHighlight() {
    return;
};
ctx.resumeAfterNoteHide = function resumeAfterNoteHide() {
    return;
};
ctx.isAnyWindowVisible = function isAnyWindowVisible() {
    const wins = [ctx.workspaceWin, ctx.settingsWin, ctx.listWin, ...ctx.noteWins.values()];
    return wins.some(w => w && !w.isDestroyed() && w.isVisible());
};
ctx.restoreAppWindows = function restoreAppWindows() {
    if (ctx.workspaceWin && !ctx.workspaceWin.isDestroyed()) {
        if (!ctx.workspaceWin.isVisible())
            ctx.workspaceWin.show();
        ctx.workspaceWin.focus();
        return;
    }
    if (ctx.settingsWin && !ctx.settingsWin.isDestroyed() && ctx.settingsWin.isVisible()) {
        ctx.bringSettingsToFront();
        return;
    }
    ctx.createWorkspaceWindow();
};
ctx.minimizeNoteToTray = function minimizeNoteToTray(noteId) {
    if (noteId && ctx.readNote(noteId)) {
        ctx.lastClosedNoteId = noteId;
        ctx.updateTray();
    }
    ctx.hideAllWindows();
    ctx.updateTaskbarAnchor();
};
ctx.hideAllWindows = function hideAllWindows() {
    if (ctx.workspaceWin && !ctx.workspaceWin.isDestroyed())
        ctx.workspaceWin.hide();
    ctx.noteWins.forEach(w => { if (!w.isDestroyed())
        w.hide(); });
    if (ctx.listWin && !ctx.listWin.isDestroyed())
        ctx.listWin.hide();
    if (ctx.settingsWin && !ctx.settingsWin.isDestroyed())
        ctx.settingsWin.hide();
    if (ctx.memoryWin && !ctx.memoryWin.isDestroyed())
        ctx.memoryWin.hide();
    ctx.updateTray();
};
ctx.toggleAppVisibility = function toggleAppVisibility() {
    if (ctx.isAnyWindowVisible())
        ctx.hideAllWindows();
    else
        ctx.restoreAppWindows();
};
ctx.requestAppQuit = function requestAppQuit() {
    ctx.isQuitting = true;
    ctx.app.quit();
};
ctx.hookTaskbarRestore = function hookTaskbarRestore(win) {
    if (process.platform !== 'win32' || !win || win.isDestroyed() || ctx.taskbarHooked.has(win))
        return;
    ctx.taskbarHooked.add(win);
    // WM_INITMENU — 任务栏图标被点击时触发（窗口处于 hide 状态时）
    win.hookWindowMessage(278, () => {
        if (!win.isDestroyed() && !ctx.isAnyWindowVisible())
            ctx.restoreAppWindows();
    });
};
ctx.updateTaskbarAnchor = function updateTaskbarAnchor() {
    const notes = ctx.loadAllNotes();
    let anchor = null;
    const visibleList = ctx.listWin && !ctx.listWin.isDestroyed() && ctx.listWin.isVisible() ? listWin: null;
    const visibleNotes = [...ctx.noteWins.values()].filter(w => !w.isDestroyed() && w.isVisible());
    if (visibleList)
        anchor = ctx.listWin;
    else if (visibleNotes.length === 1)
        anchor = visibleNotes[0];
    else if (ctx.listWin && !ctx.listWin.isDestroyed() && notes.length > 1)
        anchor = ctx.listWin;
    else if (notes.length === 1)
        anchor = ctx.noteWins.get(notes[0].id) || null;
    else if (ctx.noteWins.size === 1)
        anchor = [...ctx.noteWins.values()][0];
    ctx.noteWins.forEach(w => { if (!w.isDestroyed())
        w.setSkipTaskbar(w !== anchor); });
    if (ctx.listWin && !ctx.listWin.isDestroyed())
        ctx.listWin.setSkipTaskbar(ctx.listWin !== anchor);
    if (anchor && !anchor.isDestroyed()) {
        // 透明无边框窗口在任务栏偶发回退到默认图标，显式重设品牌图标
        try {
            anchor.setIcon(ctx.getAppIconImage());
        }
        catch { /* noop */ }
        ctx.hookTaskbarRestore(anchor);
    }
};
ctx.clampNoteToWorkArea = function clampNoteToWorkArea(note) {
    const displays = ctx.screen.getAllDisplays();
    const primary = ctx.screen.getPrimaryDisplay();
    const fallback = {
        x: primary.workArea.x + Math.round(primary.workArea.width * 0.18),
        y: primary.workArea.y + Math.round(primary.workArea.height * 0.14),
    };
    let x = Number.isFinite(note?.x) ? note.x : fallback.x;
    let y = Number.isFinite(note?.y) ? note.y : fallback.y;
    const w = Number.isFinite(note?.w) ? note.w : 360;
    const h = Number.isFinite(note?.h) ? note.h : 490;
    const target = displays.find(d => {
        const wa = d.workArea;
        return x >= wa.x && x <= wa.x + wa.width && y >= wa.y && y <= wa.y + wa.height;
    }) || primary;
    const wa = target.workArea;
    const maxX = wa.x + Math.max(0, wa.width - Math.min(w, wa.width));
    const maxY = wa.y + Math.max(0, wa.height - Math.min(h, wa.height));
    const clampedX = Math.min(Math.max(x, wa.x), maxX);
    const clampedY = Math.min(Math.max(y, wa.y), maxY);
    return {
        x: Math.round(clampedX),
        y: Math.round(clampedY),
        changed: Math.round(clampedX) !== x || Math.round(clampedY) !== y,
    };
};
ctx.loadRecentIds = function loadRecentIds() {
    try {
        const data = JSON.parse(ctx.fs.readFileSync(ctx.RECENT_FILE, 'utf8'));
        return Array.isArray(data.ids) ? data.ids : [];
    }
    catch {
        return [];
    }
};
ctx.saveRecentIds = function saveRecentIds(ids) {
    ctx.fs.writeFileSync(ctx.RECENT_FILE, JSON.stringify({ ids: ids.slice(0, 12) }), 'utf8');
};
ctx.getRecentNotes = function getRecentNotes() {
    const map = new Map(ctx.loadAllNotes().map(n => [n.id, n]));
    const ids = ctx.loadRecentIds();
    const ordered = ids.map(id => map.get(id)).filter(Boolean);
    if (ordered.length)
        return ordered;
    return ctx.loadAllNotes().slice(0, 8);
};
ctx.touchRecentNote = function touchRecentNote(id) {
    if (!id || !ctx.readNote(id))
        return;
    const ids = ctx.loadRecentIds().filter(x => x !== id);
    ids.unshift(id);
    ctx.saveRecentIds(ids);
};
ctx.jumpListArgs = function jumpListArgs(extra) {
    return process.defaultApp ? `. ${extra}` : extra;
};
ctx.parseLaunchArgs = function parseLaunchArgs(argv) {
    const args = (argv || process.argv).filter(a => typeof a === 'string');
    const openArg = args.find(a => a.startsWith('--open-note='));
    if (openArg)
        return { action: 'open-note', id: openArg.slice('--open-note='.length) };
    if (args.includes('--new-note'))
        return { action: 'new-note' };
    if (args.includes('--open-list'))
        return { action: 'open-list' };
    return null;
};
ctx.handleLaunchArgs = function handleLaunchArgs(argv) {
    const launch = ctx.parseLaunchArgs(argv);
    if (!launch)
        return false;
    if (launch.action === 'open-note' && launch.id) {
        ctx.showNote(launch.id);
        return true;
    }
    if (launch.action === 'new-note') {
        ctx.newNote();
        return true;
    }
    if (launch.action === 'open-list') {
        ctx.createWorkspaceWindow();
        return true;
    }
    return false;
};
ctx.updateJumpList = function updateJumpList() {
    if (process.platform !== 'win32')
        return;
    const iconPath = ctx.jumpIconPath;
    const recentItems = ctx.getRecentNotes().slice(0, 8).map(n => ({
        type: 'task',
        title: ((n.title || n.project || '').trim() || '未命名').slice(0, 64),
        description: (n.content?.split('\n')[0]?.trim() || '(空)').slice(0, 128),
        program: process.execPath,
        args: ctx.jumpListArgs(`--open-note=${n.id}`),
        iconPath,
        iconIndex: 0,
    }));
    const categories = [];
    if (recentItems.length) {
        categories.push({ type: 'custom', name: '最近使用', items: recentItems });
    }
    categories.push({
        type: 'tasks',
        items: [
            { type: 'task', title: '显示工作台', program: process.execPath, args: ctx.jumpListArgs('--open-list'), iconPath, iconIndex: 0 },
            { type: 'task', title: '显示工作台', program: process.execPath, args: ctx.jumpListArgs('--open-list'), iconPath, iconIndex: 0 },
        ],
    });
    try {
        ctx.app.setJumpList(categories);
    }
    catch { }
};
ctx.notePath = id => ctx.noteId.resolveNoteFile(ctx.DATA_DIR, id);
ctx.saveNote = note => {
    if (!note || !ctx.noteId.isSafeNoteId(note.id))
        return false;
    const file = ctx.notePath(note.id);
    if (!file)
        return false;
    note.updatedAt = new Date().toISOString();
    ctx.fs.writeFileSync(file, JSON.stringify(note, null, 2), 'utf8');
    return true;
};
ctx.readNote = id => {
    const file = ctx.notePath(id);
    if (!file)
        return null;
    try {
        return JSON.parse(ctx.fs.readFileSync(file, 'utf8'));
    }
    catch {
        return null;
    }
};
ctx.deleteNoteF = id => {
    const file = ctx.notePath(id);
    if (!file)
        return;
    try {
        ctx.fs.unlinkSync(file);
    }
    catch { }
};
ctx.isNoteEmpty = function isNoteEmpty(n) {
    if (!n)
        return false;
    if (n.favorite)
        return false;
    if ((n.content || '').trim())
        return false;
    if ((n.project || '').trim())
        return false;
    return true;
};
ctx.purgeEmptyClosedNotes = function purgeEmptyClosedNotes() {
    if (!ctx.fs.existsSync(ctx.DATA_DIR))
        return 0;
    let removed = 0;
    for (const f of ctx.fs.readdirSync(ctx.DATA_DIR)) {
        if (!ctx.noteId.isSafeNoteFileName(f))
            continue;
        const id = f.slice(0, -'.json'.length);
        if (ctx.noteWins.has(id))
            continue;
        let n = null;
        try {
            n = JSON.parse(ctx.fs.readFileSync(ctx.path.join(ctx.DATA_DIR, f), 'utf8'));
        }
        catch {
            continue;
        }
        if (ctx.isNoteEmpty(n)) {
            ctx.deleteNoteF(id);
            removed++;
        }
    }
    return removed;
};

ctx.loadAllNotes = () => {
    // 仅 notesCompat IPC 兼容路径；冷启动 workspace-init 勿调用。
    if (!ctx.fs.existsSync(ctx.DATA_DIR))
        return [];
    return ctx.fs.readdirSync(ctx.DATA_DIR).filter(f => ctx.noteId.isSafeNoteFileName(f)).map(f => {
        try {
            const n = JSON.parse(ctx.fs.readFileSync(ctx.path.join(ctx.DATA_DIR, f), 'utf8'));
            let dirty = false;
            if (n.project === undefined) {
                n.project = '';
                dirty = true;
            }
            if (n.version === undefined) {
                n.version = '0.1';
                dirty = true;
            }
            if (n.favorite === undefined) {
                n.favorite = false;
                dirty = true;
            }
            if (n.tags === undefined) {
                n.tags = [];
                dirty = true;
            }
            if (n.copyCount === undefined) {
                n.copyCount = 0;
                dirty = true;
            }
            if (n.projectManual === undefined) {
                n.projectManual = !!n.project?.trim();
                dirty = true;
            }
            if (n.title === undefined) {
                n.title = String(n.project || '').trim();
                const cat = String(n.category || '').trim();
                n.project = cat || '';
                dirty = true;
            }
            else if ((n.category || '').trim() && !(n.project || '').trim()) {
                n.project = String(n.category).trim();
                dirty = true;
            }
            if (ctx.promptSections.migrateNoteFields(n))
                dirty = true;
            if (dirty)
                ctx.saveNote(n);
            return n;
        }
        catch {
            return null;
        }
    }).filter(Boolean).sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
};

ctx.walkPromptFiles = function walkPromptFiles(dir, acc = []) {
    if (!ctx.fs.existsSync(dir))
        return acc;
    for (const name of ctx.fs.readdirSync(dir)) {
        const full = ctx.path.join(dir, name);
        const stat = ctx.fs.statSync(full);
        if (stat.isDirectory())
            ctx.walkPromptFiles(full, acc);
        else {
            const ext = ctx.path.extname(name).toLowerCase();
            if (['.txt', '.md'].includes(ext) || !ext)
                acc.push(full);
        }
    }
    return acc;
};
ctx.getImportedPromptMeta = function getImportedPromptMeta(file) {
    const rel = ctx.path.relative(ctx.PROMPT_SPACE_DIR, file);
    const parts = rel.split(ctx.path.sep);
    const base = ctx.path.basename(file, ctx.path.extname(file));
    const parent = parts.length > 1 ? parts[parts.length - 2] : '';
    const versionMatch = base.match(/^v(\d+(?:\.\d+)*)/i);
    const version = versionMatch ? versionMatch[1] : '0.1';
    const name = versionMatch && parent ? parent : base;
    return {
        name,
        version,
        group: parts.slice(0, -1).join('/'),
        tags: parts.slice(0, Math.max(1, parts.length - 1)).filter(Boolean),
        rel
    };
};
ctx.importPromptSpace = function importPromptSpace() {
    if (!ctx.PROMPT_SPACE_DIR || !ctx.fs.existsSync(ctx.PROMPT_SPACE_DIR)) {
        return { ok: false, error: ctx.PROMPT_SPACE_DIR ? `目录不存在：${ctx.PROMPT_SPACE_DIR}`
                : '未配置 KNOWME_PROMPT_SPACE_DIR 环境变量' };
    }
    const existing = new Set(ctx.loadAllNotes().map(n => n.sourcePath).filter(Boolean).map(p => ctx.path.normalize(p).toLowerCase()));
    const files = ctx.walkPromptFiles(ctx.PROMPT_SPACE_DIR);
    let imported = 0, skipped = 0, failed = 0;
    for (const file of files) {
        const key = ctx.path.normalize(file).toLowerCase();
        if (existing.has(key)) {
            skipped++;
            continue;
        }
        try {
            const content = ctx.fs.readFileSync(file, 'utf8');
            const meta = ctx.getImportedPromptMeta(file);
            const id = `n_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
            const pos = ctx.getNewNotePos(imported);
            const note = {
                id,
                content,
                project: meta.name,
                version: meta.version,
                favorite: false,
                tags: meta.tags,
                promptGroup: meta.group,
                sourcePath: file,
                sourceRelPath: meta.rel,
                copyCount: 0,
                ...pos,
                w: 440,
                h: 580,
                pinned: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            ctx.saveNote(note);
            existing.add(key);
            imported++;
        }
        catch {
            failed++;
        }
    }
    ctx.updateTray();
    if (ctx.listWin && !ctx.listWin.isDestroyed())
        ctx.listWin.webContents.send('init-list', ctx.loadAllNotes());
    ctx.productMemory.capture(ctx.MEMORY_DIR, {
        kind: 'telemetry',
        summary: `导入 prompt_space：${imported} 张卡片`,
        meta: { action: 'import-prompt-space', imported, skipped, failed },
    });
    return { ok: true, imported, skipped, failed, total: files.length };
};
ctx.getNewNotePos = function getNewNotePos(idx = 0) {
    const d = ctx.screen.getPrimaryDisplay();
    const { x: wx, y: wy, width: ww, height: wh } = d.workArea;
    const offset = (idx % 12) * 26;
    return {
        x: wx + Math.round(ww * 0.18) + offset,
        y: wy + Math.round(wh * 0.14) + offset
    };
};
ctx.updateTray = function updateTray() {
    ctx.applyTrayMenu(ctx.tray, { createWorkspaceWindow: ctx.createWorkspaceWindow, openSettings: ctx.openSettings, requestAppQuit: ctx.requestAppQuit });
    ctx.updateJumpList();
};
ctx.createNoteWindow = function createNoteWindow() {
    return null;
};
ctx.layoutSize = function layoutSize(aiOpen) {
    return aiOpen ? LAYOUT.aiSplit : LAYOUT.note;
};
ctx.applyNoteLayout = function applyNoteLayout(win, n) {
    const size = ctx.layoutSize(!!n.aiOpen);
    if (win.isDestroyed())
        return { ...size, aiOpen: !!n.aiOpen };
    layoutApplying.add(win);
    win.setMinimumSize(n.aiOpen ? 800 : 280, n.aiOpen ? 500 : 260);
    win.setSize(size.w, size.h, false);
    n.w = size.w;
    n.h = size.h;
    n.expanded = true;
    ctx.saveNote(n);
    setImmediate(() => layoutApplying.delete(win));
    const state = { aiOpen: !!n.aiOpen, w: size.w, h: size.h };
    win.webContents.send('layout-changed', state);
    return state;
};
ctx.notifyWorkspaceRefresh = function notifyWorkspaceRefresh() {
    if (ctx.workspaceWin && !ctx.workspaceWin.isDestroyed())
        ctx.workspaceWin.webContents.send('workspace-refresh');
};
ctx.notifyWorkbenchAuthChanged = function notifyWorkbenchAuthChanged(auth) {
    if (!ctx.workspaceWin || ctx.workspaceWin.isDestroyed())
        return;
    ctx.workspaceWin.webContents.send('workbench-auth-changed', auth || null);
};
ctx.openWorkspaceNote = function openWorkspaceNote(noteId) {
    ctx.createWorkspaceWindow();
    const send = () => {
        if (ctx.workspaceWin && !ctx.workspaceWin.isDestroyed() && noteId) {
            ctx.workspaceWin.webContents.send('workspace-open-note', noteId);
        }
    };
    if (ctx.workspaceWin.webContents.isLoading())
        ctx.workspaceWin.webContents.once('did-finish-load', send);
    else
        send();
};
ctx.newNote = function newNote() {
    ctx.createWorkspaceWindow();
};
ctx.newVersion = function newVersion(noteId) {
    const orig = ctx.readNote(noteId);
    if (!orig)
        return;
    const parts = (orig.version || '0.1').split('.').map(Number);
    parts[parts.length - 1] += 1;
    const id = `n_${Date.now()}`;
    const note = {
        ...orig, id,
        version: parts.join('.'),
        parentNoteId: orig.id,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    ctx.saveNote(note);
    ctx.notifyWorkspaceRefresh();
    ctx.openWorkspaceNote(id);
    ctx.updateTray();
};
ctx.duplicateNote = function duplicateNote(noteId) {
    const orig = ctx.readNote(noteId);
    if (!orig)
        return;
    const id = `n_${Date.now()}`;
    const note = {
        ...orig, id, favorite: false, parentNoteId: null, copyCount: 0,
        title: orig.title ? `${orig.title} 副本` : '',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    ctx.saveNote(note);
    ctx.notifyWorkspaceRefresh();
    ctx.openWorkspaceNote(id);
    ctx.updateTray();
};
ctx.showNote = function showNote() {
    ctx.createWorkspaceWindow();
};
ctx.createWorkspaceWindow = function createWorkspaceWindow() {
    if (ctx.workspaceWin && !ctx.workspaceWin.isDestroyed()) {
        if (!ctx.workspaceWin.isVisible())
            ctx.workspaceWin.show();
        ctx.workspaceWin.focus();
        return ctx.workspaceWin;
    }
    const d = ctx.screen.getPrimaryDisplay();
    const { width: ww, height: wh } = d.workArea;
    // 窗口壳色与工作台左侧 rail 对齐（L 形 chrome：顶栏 + 侧栏同色）
    const WORKSPACE_CHROME_BG = '#ebeae7';
    const workspaceOpts = {
        width: Math.min(1280, ww - 80), height: Math.min(820, wh - 60),
        minWidth: 900, minHeight: 560, center: true,
        frame: true, autoHideMenuBar: true, backgroundColor: WORKSPACE_CHROME_BG,
        title: ctx.APP_DISPLAY_NAME,
        icon: ctx.getWindowIconOption(),
        webPreferences: {
            preload: ctx.path.join(__dirname, '..', 'preload.js'),
            contextIsolation: true,
            sandbox: false,
            // 编辑器 pane 以 iframe 承载，需让 preload 在子框架内也注入，否则 iframe 里 window.api 为 undefined
            nodeIntegrationInSubFrames: true,
            // 右侧文档预览使用内嵌 webview 打开外链
            webviewTag: true,
        },
    };
    // Win/mac：隐藏系统标题字、客户区上延，顶栏用与侧栏相同的壳色
    if (process.platform === 'win32' || process.platform === 'darwin') {
        workspaceOpts.titleBarStyle = 'hidden';
    }
    if (process.platform === 'win32') {
        workspaceOpts.titleBarOverlay = {
            color: WORKSPACE_CHROME_BG,
            symbolColor: '#5c5c5c',
            height: 36,
        };
    }
    ctx.workspaceWin = new ctx.BrowserWindow(workspaceOpts);
    void ctx.loadRendererEntry(ctx.workspaceWin, {
        legacyFile: 'workspace.html',
        viteEntry: 'workspace',
        viteDevPath: '/workspace/',
    }).catch((err) => {
        console.error('[workspace-load-reject]', err && err.message || err);
    });
    ctx.workspaceWin.webContents.on('will-attach-webview', (event, webPreferences, params) => {
        delete webPreferences.preload;
        webPreferences.nodeIntegration = false;
        webPreferences.contextIsolation = true;
        webPreferences.sandbox = true;
        const src = String(params?.src || '');
        let protocol = '';
        try {
            protocol = new URL(src).protocol;
        }
        catch {
            protocol = '';
        }
        if (protocol !== 'http:' && protocol !== 'https:') {
            event.preventDefault();
        }
    });
    ctx.workspaceWin.webContents.on('did-fail-load', (_event, code, desc, url, isMainFrame) => {
        const { shouldIgnoreRendererLoadFail, shouldRetryRendererLoadFail } = require('../lib/renderer-load-fail');
        if (shouldIgnoreRendererLoadFail({ code, isMainFrame }))
            return;
        const gpuFallbackActive = Boolean(ctx.windowsGpuPolicy && ctx.windowsGpuPolicy.disableGpu);
        ctx._workspaceLoadFailRetries = Number(ctx._workspaceLoadFailRetries || 0);
        if (shouldRetryRendererLoadFail({
            code,
            gpuFallbackActive,
            retryCount: ctx._workspaceLoadFailRetries,
        })) {
            ctx._workspaceLoadFailRetries += 1;
            setTimeout(() => {
                try {
                    if (!ctx.workspaceWin || ctx.workspaceWin.isDestroyed())
                        return;
                    void ctx.loadRendererEntry(ctx.workspaceWin, {
                        legacyFile: 'workspace.html',
                        viteEntry: 'workspace',
                        viteDevPath: '/workspace/',
                    }).catch((err) => {
                        console.error('[workspace-load-retry-reject]', err && err.message || err);
                    });
                }
                catch (err) {
                    console.error('[workspace-load-retry-fail]', err && err.message || err);
                }
            }, 280);
            return;
        }
        const target = String(url || 'workspace.html');
        console.error('[workspace-load-fail]', { code, desc, url: target });
        const html = [
            '<!doctype html><meta charset="utf-8">',
            '<title>KnowMe 启动失败</title>',
            '<style>body{font-family:Segoe UI,Arial,sans-serif;background:#f6f5f2;color:#1f2937;padding:24px}h1{font-size:20px;margin:0 0 10px}pre{white-space:pre-wrap;background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:12px}</style>',
            '<h1>页面加载失败</h1>',
            '<p>请重启应用；若仍失败，把下方信息发给开发同学。</p>',
            `<pre>code: ${String(code)}\ndesc: ${String(desc || 'unknown')}\nurl: ${target}</pre>`,
        ].join('');
        void ctx.workspaceWin.webContents.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    });
    ctx.workspaceWin.webContents.on('console-message', (_event, level, message, line, sourceId) => {
        const text = String(message || '');
        if (level >= 2 || text.includes('[kb-debug]') || text.includes('[settings-debug]') || text.includes('[center-surface]')) {
            console.log(`[workspace-console:${level}] ${text} (${sourceId || 'workspace'}:${line || 0})`);
        }
    });
    ctx.workspaceWin.webContents.on('render-process-gone', (_event, details) => {
        console.error('[workspace-render-gone]', details);
        if (details?.reason === 'clean-exit')
            return;
        setTimeout(() => {
            try {
                if (!ctx.workspaceWin || ctx.workspaceWin.isDestroyed())
                    return;
                ctx.workspaceWin.webContents.reloadIgnoringCache();
            }
            catch (err) {
                console.error('[workspace-render-reload-fail]', err?.message || err);
            }
        }, 280);
    });
    ctx.workspaceWin.on('close', e => {
        if (ctx.isQuitting)
            return;
        e.preventDefault();
        ctx.workspaceWin.hide();
        ctx.updateTray();
    });
    ctx.workspaceWin.on('closed', () => { ctx.workspaceWin = null; });
    return ctx.workspaceWin;
};
ctx.bringSettingsToFront = function bringSettingsToFront() {
    if (!ctx.settingsWin || ctx.settingsWin.isDestroyed())
        return;
    // 工作台等常驻窗可能 alwaysOnTop；设置窗须临时抬升以免被盖住
    ctx.settingsWin.setAlwaysOnTop(true);
    if (ctx.settingsWin.isMinimized())
        ctx.settingsWin.restore();
    ctx.settingsWin.show();
    ctx.settingsWin.focus();
    ctx.settingsWin.moveTop();
};
ctx.openSettings = function openSettings(tab = '') {
    // 托盘 MenuItem.click 会传入 (menuItem, browserWindow, event)，不能当 tab 用
    const tabId = typeof tab === 'string' ? tab : '';
    if (ctx.workspaceWin && !ctx.workspaceWin.isDestroyed()) {
        ctx.workspaceWin.show();
        ctx.workspaceWin.focus();
        ctx.workspaceWin.webContents.send('workspace-open-settings', tabId);
        if (ctx.settingsWin && !ctx.settingsWin.isDestroyed())
            ctx.settingsWin.close();
        return;
    }
    ctx.openSettingsWindow(tabId);
};
ctx.openSettingsWindow = function openSettingsWindow(tab = '') {
    const tabId = typeof tab === 'string' ? tab : '';
    if (ctx.settingsWin && !ctx.settingsWin.isDestroyed()) {
        ctx.bringSettingsToFront();
        if (tabId)
            ctx.settingsWin.webContents.send('select-settings-tab', tabId);
        return;
    }
    ctx.settingsWin = new ctx.BrowserWindow({ width: 520, height: 720, minWidth: 480, minHeight: 560,
        title: 'KnowMe — 设置', center: true, resizable: true,
        frame: true, autoHideMenuBar: true, backgroundColor: '#f8f7f4',
        alwaysOnTop: true,
        icon: ctx.getWindowIconOption(),
        webPreferences: { preload: ctx.path.join(__dirname, '..', 'preload.js'), contextIsolation: true, sandbox: false }
    });
    void ctx.loadRendererEntry(ctx.settingsWin, { legacyFile: 'settings.html', viteEntry: 'settings', viteDevPath: '/settings/' });
    ctx.settingsWin.webContents.on('did-finish-load', () => {
        ctx.settingsWin.webContents.send('init-settings', JSON.parse(JSON.stringify(ctx.settingsSecure.publicSettings(ctx.loadSettings(), { includeSecrets: true }))));
        if (tabId)
            ctx.settingsWin.webContents.send('select-settings-tab', tabId);
    });
    ctx.settingsWin.on('closed', () => { ctx.settingsWin = null; });
    ctx.bringSettingsToFront();
};
ctx.toggleListWin = function toggleListWin() {
    ctx.createWorkspaceWindow();
};
ctx.openMemoryPanel = function openMemoryPanel() {
    if (ctx.memoryWin && !ctx.memoryWin.isDestroyed()) {
        ctx.memoryWin.show();
        ctx.memoryWin.focus();
        ctx.memoryWin.webContents.send('init-memory', ctx.productMemory.getRecent(ctx.MEMORY_DIR, 50));
        return;
    }
    const d = ctx.screen.getPrimaryDisplay();
    const { x: wx, y: wy, width: ww } = d.workArea;
    ctx.memoryWin = new ctx.BrowserWindow({
        x: wx + ww - 440, y: wy + 80,
        width: 400, height: 520,
        frame: false, transparent: true,
        alwaysOnTop: true, skipTaskbar: false, resizable: true,
        icon: ctx.getWindowIconOption(),
        webPreferences: { preload: ctx.path.join(__dirname, '..', 'preload.js'), contextIsolation: true, sandbox: false },
    });
    void ctx.loadRendererEntry(ctx.memoryWin, { legacyFile: 'memory.html', viteEntry: 'memory', viteDevPath: '/memory/' });
    ctx.memoryWin.webContents.on('did-finish-load', () => {
        ctx.memoryWin.webContents.send('init-memory', ctx.productMemory.getRecent(ctx.MEMORY_DIR, 50));
    });
    ctx.memoryWin.on('close', e => {
        if (ctx.isQuitting)
            return;
        e.preventDefault();
        ctx.memoryWin.hide();
    });
    ctx.memoryWin.on('closed', () => { ctx.memoryWin = null; });
};

ctx.openLogViewer = function openLogViewer() {
    if (ctx.logViewerWin && !ctx.logViewerWin.isDestroyed()) {
        if (ctx.logViewerWin.isMinimized())
            ctx.logViewerWin.restore();
        ctx.logViewerWin.show();
        ctx.logViewerWin.focus();
        return ctx.logViewerWin;
    }
    const d = ctx.screen.getPrimaryDisplay();
    const { width: ww, height: wh } = d.workArea;
    ctx.logViewerWin = new ctx.BrowserWindow({
        width: Math.min(1080, ww - 80), height: Math.min(760, wh - 80),
        minWidth: 760, minHeight: 480, center: true,
        frame: true, autoHideMenuBar: true, backgroundColor: '#0f1419',
        title: 'KnowMe - 日志中心',
        icon: ctx.getWindowIconOption(),
        webPreferences: { preload: ctx.path.join(__dirname, '..', 'preload.js'), contextIsolation: true, sandbox: false },
    });
    ctx.logViewerWin.webContents.on('did-fail-load', (_event, code, desc, url, isMainFrame) => {
        const { shouldIgnoreRendererLoadFail } = require('../lib/renderer-load-fail');
        if (shouldIgnoreRendererLoadFail({ code, isMainFrame }))
            return;
        if (!isMainFrame)
            return;
        const message = `日志页面加载失败\ncode: ${String(code)}\ndesc: ${String(desc || 'unknown')}\nurl: ${String(url || 'log-viewer.html')}`;
        console.error('[log-viewer-load-fail]', message);
        const html = [
            '<!doctype html><meta charset="utf-8">',
            '<title>KnowMe 日志中心</title>',
            '<style>body{font-family:Segoe UI,Microsoft YaHei,sans-serif;background:#0e1420;color:#e7edf7;padding:28px}h1{font-size:20px}pre{white-space:pre-wrap;background:#161f2e;border:1px solid #2b3951;border-radius:8px;padding:14px;color:#f4b549}</style>',
            '<h1>日志中心加载失败</h1>',
            '<p>日志文件仍然保存在 KnowMe\\logs 目录。</p>',
            `<pre>${message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`,
        ].join('');
        void ctx.logViewerWin.webContents.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    });
    ctx.logViewerWin.webContents.on('console-message', (_event, level, message, line, sourceId) => {
        if (level >= 2) {
            console.error(`[log-viewer-console:${level}] ${String(message || '')} (${sourceId || 'log-viewer'}:${line || 0})`);
        }
    });
    ctx.logViewerWin.webContents.on('render-process-gone', (_event, details) => {
        console.error('[log-viewer-render-gone]', details);
    });
    void ctx.loadRendererEntry(ctx.logViewerWin, {
        legacyFile: 'log-viewer.html',
        viteEntry: 'log-viewer',
        viteDevPath: '/log-viewer/',
    });
    ctx.logViewerWin.on('closed', () => { ctx.logViewerWin = null; });
    ctx.logger.operation('open-log-viewer', '打开日志中心窗口');
    return ctx.logViewerWin;
};
}

module.exports = { create }
