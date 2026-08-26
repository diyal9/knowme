'use strict'

/**
 * 工作台货架/mode、管线投影与 app.whenReady。
 * 不负责进程守卫（见 process-guards.ts）或渲染层 UI。
 */

/** 挂载工作台投影与 whenReady；进程守卫在其后单独 create。 */
function create(ctx) {
ctx.buildWorkflowShelf = function buildWorkflowShelf(input = {}) {
    const verticals = [
        ...ctx.officialWorkflows.listOfficialWorkflowPackages(),
        ...(Array.isArray(input.verticals) ? input.verticals : []),
    ];
    return ctx.workflowSupply.buildWorkflowSupply({
        repoWorkflows: input.workflows || [],
        daemon: input.daemon || {},
        personal: input.personal || [],
        verticals,
        agents: input.agents || [],
        repoActive: input.repoActive === true,
        localTeamEnabled: process.env.KNOWME_AGENT_TEAM_RUNTIME !== '0',
    });
};
ctx.getWorkbenchModeStore = function getWorkbenchModeStore() {
    if (!ctx.workbenchModes) {
        ctx.workbenchModes = ctx.workbenchModeStore.createStore({
            file: ctx.WORKBENCH_MODES_FILE,
            catalogProjector: (expertIds) => {
                const projected = new Map();
                for (const expertId of expertIds || []) {
                    const item = ctx.workbenchModeCatalog.get(expertId);
                    projected.set(expertId, item
                        ? {
                            label: item.name || expertId,
                            description: item.description || '',
                            status: item.enabled === true ? 'enabled' : 'disabled',
                        }
                        : {
                            label: expertId,
                            description: '',
                            status: 'missing',
                        });
                }
                return projected;
            },
            daemonProjector: () => ctx.workbenchModeDaemon,
        });
    }
    return ctx.workbenchModes;
};

ctx.modeNameFromDto = function modeNameFromDto(dto, modeId) {
    return (Array.isArray(dto?.modes) ? dto.modes : []).find(mode => mode.id === modeId)?.name || modeId;
};
ctx.refreshWorkbenchModeProjections = async function refreshWorkbenchModeProjections(daemonOverview = null) {
    const [catalogResult, daemon] = await Promise.all([
        ctx.ensureCapabilityHub().listCapabilities({ kind: 'expert' }).catch(error => ({
            ok: false,
            error: error?.message || String(error),
            items: [],
        })),
        daemonOverview
            ? Promise.resolve(daemonOverview)
            : ctx.loadWorkbenchDaemonOverview().catch(() => ({ online: false })),
    ]);
    ctx.workbenchModeCatalog = new Map((Array.isArray(catalogResult?.items) ? catalogResult.items : [])
        .filter(item => item?.kind === 'expert')
        .map(item => [String(item.id || ''), item]));
    ctx.workbenchModeDaemon = daemon && typeof daemon === 'object'
        ? { online: daemon.online === true }
        : { online: false };
    return ctx.getWorkbenchModeStore().list();
};
ctx.isExpertAvailableForWorkbench = function isExpertAvailableForWorkbench(expertId) {
    const item = ctx.workbenchModeCatalog.get(String(expertId || '').trim());
    const installed = ['installed', 'enabled', 'disabled'].includes(String(item?.status || '').toLowerCase());
    return Boolean(item && item.kind === 'expert' && installed && item.enabled === true);
};
ctx.normalizeAutomationTargetName = function normalizeAutomationTargetName(item = {}, fallback) {
    return String(item.name ||
        item.chat_name ||
        item.localized_name ||
        item.en_name ||
        fallback ||
        '').trim();
};
ctx.FEISHU_FACT_TOOLS = ['feishu.related_chats', 'feishu.today_priority', 'feishu.doc_kb_suggest'];
ctx.hasPriorFeishuFacts = function hasPriorFeishuFacts(session) {
    const list = Array.isArray(session?.messages) ? session.messages : [];
    return list.some(item => item
        && item.role === 'tool'
        && item.status === 'done'
        && ctx.FEISHU_FACT_TOOLS.includes(item.toolName));
};
ctx.getFeishuGroundingContext = 
/** Unknown status counts as ready: never invent an auth problem the user cannot verify. */
async function getFeishuGroundingContext() {
    try {
        const result = await ctx.getConnectorsApi().getConnectorStatus('feishu');
        const connector = result?.connector || null;
        const status = connector?.status || {};
        return {
            authReady: status.state === 'auth_required' ? false : status.userReady !== false,
            connectorEnabled: connector ? connector.enabled === true : null,
            allowlist: Array.isArray(connector?.allowlist) ? connector.allowlist.slice() : null,
            projectedAllowlist: Array.isArray(status?.projectedAllowlist) ? status.projectedAllowlist.slice() : null,
        };
    }
    catch {
        return {
            authReady: true,
            connectorEnabled: null,
            allowlist: null,
            projectedAllowlist: null,
        };
    }
};
ctx.ensureFeishuConnectorReady = function ensureFeishuConnectorReady(connector) {
    if (!connector || connector.enabled !== true) {
        return { ok: false, code: 'feishu_disabled', error: '飞书连接器未启用，请先在设置中启用并授权' };
    }
    const status = connector.status || {};
    if (status.state === 'auth_required' || status.userReady === false) {
        return { ok: false, code: 'feishu_auth_required', error: '飞书用户身份未授权，请先在设置中完成飞书登录授权' };
    }
    return { ok: true };
};
ctx.toTargetItems = function toTargetItems(list = [], kind = 'chat') {
    return (Array.isArray(list) ? list : [])
        .map(item => {
        const id = String(kind === 'chat'
            ? (item.id || item.chat_id || '')
            : (item.id || item.open_id || item.user_id || '')).trim();
        if (!id)
            return null;
        return {
            id,
            name: ctx.normalizeAutomationTargetName(item, id),
        };
    })
        .filter(Boolean);
};
ctx.loadWorkbenchDaemonOverview = async function loadWorkbenchDaemonOverview() {
    const settings = ctx.loadSettings();
    const installPath = ctx.workbenchBootstrap.resolveWorkbenchInstallPath(settings);
    const cursorApiKeyReady = ctx.detectCursorApiKeyReady(installPath);
    try {
        const result = await ctx.getWorkbenchDaemonClient().overview();
        const auth = ctx.publicWorkbenchAuthStatus(settings, result.health || null);
        const bootstrapStatus = ctx.workbenchBootstrap.buildPublicStatus(settings, {
            daemonOverview: result,
            tokenConfigured: Boolean(ctx.workbenchAuth.resolveToken(settings)),
        });
        const executor = result.executor || ctx.workbenchDaemon.assessExecutorFromHealth(result.health || {});
        const executorReady = result.executorReady === true || executor.ready === true;
        return {
            ...result,
            auth,
            bootstrap: bootstrapStatus,
            executor,
            executorReady,
            cursorApiKeyReady,
            installPath: installPath || '',
        };
    }
    catch (error) {
        const bootstrapStatus = ctx.workbenchBootstrap.buildPublicStatus(settings, {
            tokenConfigured: Boolean(ctx.workbenchAuth.resolveToken(settings)),
        });
        return {
            ...ctx.workbenchDaemon.normalizeError(error),
            online: false,
            workflows: [],
            tasks: [],
            agents: [],
            agentCatalogAvailable: false,
            auth: ctx.publicWorkbenchAuthStatus(settings),
            bootstrap: bootstrapStatus,
            executorReady: false,
            cursorApiKeyReady,
            installPath: installPath || '',
            hint: '请检查 Workbench 服务地址、网络连接和授权状态',
        };
    }
};
ctx.listLocalWorkbenchAgents = function listLocalWorkbenchAgents() {
    const hub = ctx.ensureCapabilityHub();
    let catalogById = new Map();
    try {
        const catalog = require('../lib/capability-catalog').listCatalog(ctx.app.getPath('userData'), {
            bundledRoot: ctx.CATALOG_ROOT,
        });
        catalogById = new Map((catalog.entries || [])
            .filter(entry => entry && entry.kind === 'expert' && entry.id)
            .map(entry => [String(entry.id), entry]));
    }
    catch { /* catalog optional for workbench list */ }
    return hub.expertRuntime().listExperts().map((expert) => {
        const profiles = ctx.getAgentProfileStore().list(expert.id).profiles || [];
        const profile = profiles.find(item => item.provenance?.scope === 'default-agent') || profiles[0] || null;
        const meta = catalogById.get(String(expert.id)) || {};
        // 与专家库同源：目录/安装表展示名优先于 EXPERT.md 原始 slug
        const name = String(meta.name || expert.name || expert.id).trim();
        const description = String(expert.description || meta.description || '').trim();
        const category = Array.isArray(meta.categories) && meta.categories[0]
            ? String(meta.categories[0])
            : '专家';
        const status = meta.installed
            ? (meta.enabled === true ? 'enabled' : 'disabled')
            : (meta.installStatus || 'available');
        return {
            ...expert,
            name,
            title: name,
            description,
            originName: String(expert.originName || meta.originName || '').trim(),
            version: String(meta.version || meta.installedVersion || expert.version || '1.0.0'),
            category,
            tags: Array.isArray(meta.tags) ? meta.tags : (Array.isArray(expert.tags) ? expert.tags : []),
            status,
            enabled: meta.installed ? meta.enabled === true : expert.enabled !== false,
            persona: {
                role: profile?.roleOverlay || name || expert.id,
                stance: '',
                behavior: '',
            },
            display: {
                summary: description,
                capabilities: Array.isArray(expert.skills) ? expert.skills.slice(0, 6) : [],
            },
            profileId: profile?.id || '',
            profile,
            source: String(meta.source || expert.source || 'local'),
            origin: 'local',
            editable: true,
        };
    });
};
ctx.recommendWorkbenchAgentMembers = function recommendWorkbenchAgentMembers(goal, experts) {
    const text = String(goal || '').toLowerCase();
    const signals = [
        ['product', '需求', '方案', '规划', 'proposal', 'plan'],
        ['research', '调研', '检索', '分析', 'research', 'query'],
        ['coding', '开发', '代码', '研发', '实现', 'code'],
        ['testing', '测试', '验收', 'qa', '回归', 'test'],
        ['writing', '写作', '文案', '纪要', 'writing'],
    ];
    const scored = (Array.isArray(experts) ? experts : []).map((expert, index) => {
        const haystack = [
            expert.id,
            expert.name,
            expert.description,
            ...(expert.skills || []),
        ].join(' ').toLowerCase();
        const score = signals.reduce((sum, group) => (sum + (group.some(token => text.includes(token) && haystack.includes(token)) ? 3 : 0)), 0);
        return { expert, index, score };
    });
    scored.sort((a, b) => b.score - a.score || a.index - b.index);
    const selected = scored.slice(0, Math.min(3, scored.length)).map(({ expert }) => ({
        id: expert.id,
        expertId: expert.id,
        agentPackageId: expert.id,
        role: expert.name || expert.id,
        intent: `围绕「${String(goal || '').slice(0, 160)}」完成${expert.name || expert.id}负责的步骤`,
    }));
    return selected;
};
ctx.compileWorkbenchAgentGraphPayload = function compileWorkbenchAgentGraphPayload(payload = {}) {
    const goal = String(payload.goal || '').trim();
    const listed = ctx.ensureCapabilityHub().expertRuntime().listExperts();
    const hasExplicitNodes = Array.isArray(payload.nodes) && payload.nodes.length > 0;
    const requestedMembers = Array.isArray(payload.members)
        ? payload.members
        : (hasExplicitNodes ? [] : ctx.recommendWorkbenchAgentMembers(goal, listed));
    const specialtyOnly = hasExplicitNodes
        && !requestedMembers.length
        && payload.nodes.some(node => ['llm', 'tool', 'knowledge'].includes(String(node.type || '')));
    const template = specialtyOnly || hasExplicitNodes
        ? (payload.template || null)
        : String(payload.template
            || (requestedMembers.length >= 3 ? 'parallel' : (requestedMembers.length === 2 ? 'serial' : 'single')));
    return ctx.workbenchAgentGraph.compileWorkbenchAgentGraph({
        ...payload,
        goal,
        template,
        members: requestedMembers,
        teamPackageId: payload.teamPackageId || `workbench-agent-graph-${Date.now().toString(36)}`,
        teamName: payload.teamName || 'KnowMe Agent 协作图',
    }, {
        resolveAgentPackage: ctx.resolveWorkbenchAgentPackage,
    });
};
ctx.extractResourceHintTarget = function extractResourceHintTarget(args = {}) {
    if (!args || typeof args !== 'object')
        return '';
    const candidates = [
        '_file_path',
        'file_path',
        'filePath',
        'filepath',
        'path',
        'url',
        'doc_token',
        'node_token',
        'space_id',
    ];
    for (const key of candidates) {
        const value = String(args[key] || '').trim();
        if (value)
            return value.slice(0, 240);
    }
    return '';
};
ctx.isMissingResourceText = function isMissingResourceText(text = '') {
    const raw = String(text || '').trim();
    if (!raw)
        return false;
    return /(enoent|no such file|not found|does not exist|404|找不到|未找到|不存在|路径无效|缺少资源)/i.test(raw);
};
ctx.buildMissingResourceHint = function buildMissingResourceHint(entries = []) {
    const list = Array.isArray(entries) ? entries : [];
    const failed = [...list].reverse().find(item => item?.status === 'error' && ctx.isMissingResourceText(item?.text));
    if (!failed)
        return '';
    const target = ctx.extractResourceHintTarget(failed.args);
    if (target) {
        return `我尝试读取目标内容，但未找到该资源：\`${target}\`。\n请先确认路径是否正确、文件是否已生成，再让我继续读取。`;
    }
    return '我尝试读取目标内容，但未找到对应资源。\n请先确认路径是否正确、文件是否已生成，再让我继续读取。';
};
ctx.showOpenDialogFor = async function showOpenDialogFor(sender, options) {
    const parent = (sender && ctx.BrowserWindow.fromWebContents(sender)) ||
        (ctx.settingsWin && !ctx.settingsWin.isDestroyed() ? settingsWin: null) ||
        ctx.BrowserWindow.getFocusedWindow();
    if (!parent || parent.isDestroyed()) {
        return ctx.dialog.showOpenDialog(options);
    }
    const wasOnTop = parent.isAlwaysOnTop();
    if (wasOnTop)
        parent.setAlwaysOnTop(false);
    try {
        return await ctx.dialog.showOpenDialog(parent, options);
    }
    finally {
        if (wasOnTop && !parent.isDestroyed()) {
            parent.setAlwaysOnTop(true);
            parent.focus();
        }
    }
};
// ── 启动 ──────────────────────────────────────────────────────────────────────
if (ctx.gotSingleInstanceLock) {
    ctx.app.on('second-instance', (_e, commandLine) => {
        if (!ctx.handleLaunchArgs(commandLine))
            ctx.restoreAppWindows();
    });
    ctx.app.on('activate', () => ctx.restoreAppWindows());
    ctx.app.whenReady().then(async () => {
        ctx.app.setName(ctx.APP_DISPLAY_NAME);
        if (process.platform !== 'darwin')
            ctx.Menu.setApplicationMenu(null);
        ctx.ensureBrandIcons();
        if (process.platform === 'darwin' && ctx.app.dock)
            ctx.app.dock.setIcon(ctx.getAppIconImage());
        ctx.productKnowledge.ensureKnowledge(ctx.KNOWLEDGE_DIR, ctx.KNOWLEDGE_SEED);
        try {
            const hub = ctx.ensureCapabilityHub();
            hub.migrateConnectorsIfNeeded();
            await ctx.productionCatalogMigration.migrateProductionCatalog({
                userData: ctx.app.getPath('userData'),
                hub,
                workflowStore: ctx.getWorkbenchWorkflowPackageStore(),
            });
            hub.backfillExpertDisplayNames();
            hub.registerIpcHandlers({ showOpenDialog: ctx.showOpenDialogFor });
            ctx.ensureCapabilityPackRuntime();
        }
        catch (err) {
            console.error('[capability-hub]', err?.stack || err);
        }
        try {
            ctx.knowledgeOs.ensureDirs(ctx.app.getPath('userData'));
        }
        catch { /* */ }
        ctx.productMemory.ensureMemory(ctx.MEMORY_DIR);
        ctx.purgeEmptyClosedNotes();
        const trayImage = ctx.makeTrayIcon();
        const traySize = !trayImage.isEmpty() ? trayImage.getSize() : null;
        console.log('[tray] create', { path: ctx.TRAY_ICON_PNG, empty: trayImage.isEmpty(), size: traySize });
        ctx.tray = new ctx.Tray(trayImage);
        ctx.tray.setToolTip(`${ctx.APP_DISPLAY_NAME}  左键显示/隐藏 · 右键菜单`);
        ctx.tray.on('click', ctx.toggleAppVisibility);
        ctx.tray.on('double-click', () => ctx.restoreAppWindows());
        ctx.updateTray();
        ctx.globalShortcut.register('CmdOrCtrl+Alt+N', () => ctx.createWorkspaceWindow());
        ctx.globalShortcut.register('CmdOrCtrl+Alt+L', () => ctx.createWorkspaceWindow());
        ctx.settingsSecure.stripPlaintextApiKey(ctx.SETTINGS_FILE);
        if (process.argv.includes('--dev') && ctx.PROMPT_SPACE_DIR && !ctx.fs.existsSync(ctx.PROMPT_SPACE_IMPORT_FLAG)) {
            const result = ctx.importPromptSpace();
            try {
                ctx.fs.writeFileSync(ctx.PROMPT_SPACE_IMPORT_FLAG, JSON.stringify(result, null, 2), 'utf8');
            }
            catch { }
        }
        if (!ctx.handleLaunchArgs(process.argv)) {
            ctx.createWorkspaceWindow();
        }
        ctx.updateTaskbarAnchor();
        ctx.updateJumpList();
        ctx.initAutoUpdate();
        ctx.startWorkbenchTaskScheduleTicker();
    });
}
}

module.exports = { create }
