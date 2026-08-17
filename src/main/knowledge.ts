'use strict'

/**
 * 内容源、语义索引、Fabric 上下文与 LLM Provider 解析。
 * 不负责开窗。
 */

/** 挂载内容源与 Provider 胶水；由组合根 create(ctx) 调用一次。 */
function create(ctx) {
ctx.workspaceNoteBrief = function workspaceNoteBrief(n) {
    return {
        id: n.id,
        title: n.title || '',
        project: n.project || '',
        category: n.category || '',
        version: n.version,
        favorite: !!n.favorite,
        parentNoteId: n.parentNoteId || null,
        okfTags: n.okfTags || [],
        updatedAt: n.updatedAt,
        preview: (n.content || '').split('\n').find(l => l.trim())?.slice(0, 80) || '',
    };
};
ctx.groupNotesByProject = function groupNotesByProject(notes) {
    const groups = new Map();
    for (const n of notes) {
        const key = (n.project || '').trim() || '__uncat__';
        if (!groups.has(key)) {
            groups.set(key, {
                key,
                label: key === '__uncat__' ? '未分类' : key,
                items: [],
            });
        }
        groups.get(key).items.push(ctx.workspaceNoteBrief(n));
    }
    return [...groups.values()].sort((a, b) => {
        if (a.key === '__uncat__')
            return 1;
        if (b.key === '__uncat__')
            return -1;
        return String(a.label).localeCompare(String(b.label), 'zh-CN');
    });
};
ctx.loadSourcesStore = function loadSourcesStore() {
    return ctx.sourcesLib.loadStore(ctx.SOURCES_FILE);
};
ctx.saveSourcesStore = function saveSourcesStore(store) {
    return ctx.sourcesLib.saveStore(ctx.SOURCES_FILE, store);
};
ctx.findSource = function findSource(id) {
    return ctx.loadSourcesStore().sources.find(s => s.id === id) || null;
};
ctx.mainLlmBridge = require('../lib/main-llm-bridge');
ctx.__bind_normalizeChatEndpoint_normalizeEmbedding = ctx.mainLlmBridge, ctx.normalizeChatEndpoint = ctx.__bind_normalizeChatEndpoint_normalizeEmbedding.normalizeChatEndpoint, ctx.normalizeEmbeddingsEndpoint = ctx.__bind_normalizeChatEndpoint_normalizeEmbedding.normalizeEmbeddingsEndpoint, ctx.buildEmbedFn = ctx.__bind_normalizeChatEndpoint_normalizeEmbedding.buildEmbedFn, ctx.parseSseLines = ctx.__bind_normalizeChatEndpoint_normalizeEmbedding.parseSseLines, ctx.extractChatText = ctx.__bind_normalizeChatEndpoint_normalizeEmbedding.extractChatText, ctx.requestAgentCompletion = ctx.__bind_normalizeChatEndpoint_normalizeEmbedding.requestAgentCompletion, ctx.cleanSuggestedTitle = ctx.__bind_normalizeChatEndpoint_normalizeEmbedding.cleanSuggestedTitle, ctx.localTitleFromParagraph = ctx.__bind_normalizeChatEndpoint_normalizeEmbedding.localTitleFromParagraph, ctx.chatCompletionOnce = ctx.__bind_normalizeChatEndpoint_normalizeEmbedding.chatCompletionOnce;


ctx.semanticIndexCache = new Map();
ctx.SEMANTIC_INDEX_MAX_ROOTS = 8;
ctx.SEMANTIC_INDEX_DISK_MAX_FILES = 32;
ctx.hashKey = function hashKey(text = '') {
    return ctx.crypto.createHash('sha1').update(String(text)).digest('hex');
};
ctx.semanticDiskCacheFile = function semanticDiskCacheFile(cacheKey) {
    const name = `${ctx.hashKey(cacheKey)}.json`;
    return ctx.path.join(ctx.SEMANTIC_INDEX_CACHE_DIR, name);
};
ctx.loadSemanticIndexFromDisk = function loadSemanticIndexFromDisk(cacheKey, stamp) {
    try {
        const file = ctx.semanticDiskCacheFile(cacheKey);
        if (!ctx.fs.existsSync(file))
            return null;
        const raw = JSON.parse(ctx.fs.readFileSync(file, 'utf8'));
        if (!raw || raw.stamp !== stamp || !raw.index)
            return null;
        return raw.index;
    }
    catch {
        return null;
    }
};
ctx.saveSemanticIndexToDisk = function saveSemanticIndexToDisk(cacheKey, stamp, index) {
    try {
        ctx.fs.mkdirSync(ctx.SEMANTIC_INDEX_CACHE_DIR, { recursive: true });
        const file = ctx.semanticDiskCacheFile(cacheKey);
        ctx.fs.writeFileSync(file, JSON.stringify({
            stamp,
            index,
            savedAt: new Date().toISOString(),
        }), 'utf8');
        const files = ctx.fs.readdirSync(ctx.SEMANTIC_INDEX_CACHE_DIR)
            .filter((f) => f.endsWith('.json'))
            .map((f) => ({
            name: f,
            full: ctx.path.join(ctx.SEMANTIC_INDEX_CACHE_DIR, f),
            mtime: (() => {
                try {
                    return ctx.fs.statSync(ctx.path.join(ctx.SEMANTIC_INDEX_CACHE_DIR, f)).mtimeMs;
                }
                catch {
                    return 0;
                }
            })(),
        }))
            .sort((a, b) => b.mtime - a.mtime);
        for (const stale of files.slice(ctx.SEMANTIC_INDEX_DISK_MAX_FILES)) {
            try {
                ctx.fs.unlinkSync(stale.full);
            }
            catch { /* ignore */ }
        }
    }
    catch {
        // 磁盘缓存失败不影响主流程
    }
};
ctx.decodeWorkspaceFsTabId = function decodeWorkspaceFsTabId(id) {
    const raw = String(id || '');
    if (!raw.startsWith('fs:'))
        return null;
    const rest = raw.slice(3);
    const sep = rest.indexOf(':');
    if (sep <= 0)
        return null;
    return { sourceId: rest.slice(0, sep), relPath: rest.slice(sep + 1) };
};
ctx.buildRecentSourceFileWeights = function buildRecentSourceFileWeights(workspaceState = {}, activeSourceId = '') {
    const map = new Map();
    const st = workspaceState && typeof workspaceState === 'object' ? workspaceState : {};
    const panes = [st.left, st.right].filter(Boolean);
    const activeIds = panes.map((p) => p.active).filter(Boolean);
    for (const id of activeIds) {
        const decoded = ctx.decodeWorkspaceFsTabId(id);
        if (!decoded)
            continue;
        if (activeSourceId && decoded.sourceId !== activeSourceId)
            continue;
        map.set(decoded.relPath, Math.max(map.get(decoded.relPath) || 1, 1.35));
    }
    for (const pane of panes) {
        const tabs = Array.isArray(pane.tabs) ? pane.tabs : [];
        const fsTabs = tabs.map(ctx.decodeWorkspaceFsTabId).filter(Boolean)
            .filter((x) => !activeSourceId || x.sourceId === activeSourceId);
        const maxN = Math.max(1, fsTabs.length);
        fsTabs.forEach((tab, i) => {
            const recency = 1.2 - (i / maxN) * 0.25;
            map.set(tab.relPath, Math.max(map.get(tab.relPath) || 1, recency));
        });
    }
    return map;
};
ctx.getActiveSourceRoot = function getActiveSourceRoot() {
    const store = ctx.loadSourcesStore();
    const active = store.sources.find(s => s.id === store.activeSourceId) || store.sources[0];
    return active?.rootPath || null;
};
ctx.buildActiveSourceFileTools = function buildActiveSourceFileTools(embed, opts = {}) {
    const store = ctx.loadSourcesStore();
    const active = store.sources.find(s => s.id === store.activeSourceId)
        || store.sources[0]
        || null;
    if (!active?.rootPath)
        return null;
    const root = active.rootPath;
    const runId = opts.runId || 'unknown';
    const userData = ctx.app.getPath('userData');
    const recentWeights = ctx.buildRecentSourceFileWeights(opts.workspaceState, active.id);
    // grep 索引缓存：文件清单按根目录 mtime 缓存（短 TTL），内容走 mtime 校验的读缓存，
    // 避免每次 grep 重新遍历目录树 + 全量重读文件。
    const rootStamp = () => ctx.contextCache.statMtimeMs(root);
    const listFiles = () => ctx.contextCache.cached(`grepindex:${root}`, rootStamp(), () => (ctx.sourcesLib.listTree(root, {}).nodes || [])
        .filter((n) => n.type === 'file')
        .map((n) => ({ ...n, weight: recentWeights.get(n.path) || 1 })));
    const readCached = (rel) => {
        const abs = ctx.sourcesLib.resolveUnderRoot(root, rel);
        return abs ? ctx.contextCache.readFileCached(abs) : null;
    };
    const writeAdapter = ctx.fileBackup.buildFileWriteAdapter(root, ctx.sourcesLib, {
        runId,
        rememberDraft: (draft) => ctx.toolDraftsStore.rememberDraft(userData, draft),
    });
    const adapter = {
        ...writeAdapter,
        grep: (query) => ctx.agentFileTools.grepFiles(query, {
            files: listFiles(),
            readFile: readCached,
            maxMatches: ctx.agentFileTools.MAX_GREP_MATCHES,
        }),
    };
    const includeWrite = ctx.isToolSurfaceV1();
    const base = ctx.agentFileTools.buildFileTools(adapter, { includeWrite });
    base.fileAdapter = writeAdapter;
    base.sourceRoot = root;
    // 语义检索工具：仅在提供 embed（用户启用向量重排/embeddings）时投影。
    if (typeof embed === 'function') {
        const cacheKey = `semantic:${root}:${String(embed.cacheKey || 'default')}`;
        const getIndex = async () => {
            const stamp = rootStamp();
            const cached = ctx.semanticIndexCache.get(cacheKey);
            if (cached && cached.stamp === stamp) {
                if (opts.runMetrics)
                    opts.runMetrics.semanticIndexMemoryHit = (opts.runMetrics.semanticIndexMemoryHit || 0) + 1;
                return cached.index;
            }
            const disk = ctx.loadSemanticIndexFromDisk(cacheKey, stamp);
            if (disk) {
                ctx.semanticIndexCache.set(cacheKey, { stamp, index: disk });
                if (opts.runMetrics)
                    opts.runMetrics.semanticIndexDiskHit = (opts.runMetrics.semanticIndexDiskHit || 0) + 1;
                return disk;
            }
            const buildStartedAt = Date.now();
            const index = await ctx.semanticIndex.buildEmbeddedIndex({
                files: listFiles(),
                readFile: readCached,
                embed,
                maxChunks: ctx.semanticIndex.DEFAULT_MAX_CHUNKS,
            });
            if (opts.runMetrics) {
                opts.runMetrics.semanticIndexBuildMs = Date.now() - buildStartedAt;
                opts.runMetrics.semanticIndexChunkCount = Array.isArray(index?.chunks) ? index.chunks.length : 0;
            }
            ctx.semanticIndexCache.set(cacheKey, { stamp, index });
            ctx.saveSemanticIndexToDisk(cacheKey, stamp, index);
            while (ctx.semanticIndexCache.size > ctx.SEMANTIC_INDEX_MAX_ROOTS) {
                ctx.semanticIndexCache.delete(ctx.semanticIndexCache.keys().next().value);
            }
            return index;
        };
        base.definitions = base.definitions.concat(ctx.semanticIndex.SEMANTIC_SEARCH_DEF);
        base.handlers.semantic_search = async (args = {}) => {
            const q = String(args.query || '').trim();
            if (!q)
                return { ok: false, code: 'invalid_args', text: 'semantic_search 需要非空 query' };
            try {
                const queryStartedAt = Date.now();
                const index = await getIndex();
                const detailed = await ctx.semanticIndex.queryDetailed(index, embed, q, {
                    topK: ctx.semanticIndex.DEFAULT_TOPK,
                    maxPerFile: ctx.semanticIndex.DEFAULT_MAX_PER_FILE,
                });
                const hits = detailed.hits || [];
                const meta = {
                    ...(detailed.meta || {}),
                    queryMs: Date.now() - queryStartedAt,
                    hitCount: hits.length,
                };
                if (opts.runMetrics) {
                    opts.runMetrics.semanticQueryMs = meta.queryMs;
                    opts.runMetrics.semanticHitCount = meta.hitCount;
                    opts.runMetrics.semanticDedupeDropped = Number(meta.droppedDedup || 0);
                    opts.runMetrics.semanticClusterCount = Number(meta.clusterCount || 0);
                }
                return { ok: true, text: ctx.semanticIndex.formatSemanticMatches(q, hits), meta };
            }
            catch (err) {
                return { ok: false, code: 'semantic_failed', text: `语义检索失败：${String(err?.message || err).slice(0, 200)}` };
            }
        };
    }
    return base;
};
ctx.kosSourcesCtx = function kosSourcesCtx() {
    try {
        return ctx.sourcesLib.loadStore(ctx.SOURCES_FILE);
    }
    catch {
        return { sources: [] };
    }
};
ctx.listRegistryProviders = function listRegistryProviders() {
    const cfg = ctx.knowledgeOs.loadConfig(ctx.app.getPath('userData'));
    const { providers } = ctx.listProvidersRedacted();
    return providers.map(p => ctx.knowledgeProvider.normalizeProvider(p.id === 'local-default' ? ctx.localDefaultProvider() : p));
};
ctx.wikiDocsForFabric = function wikiDocsForFabric(userData) {
    const list = ctx.knowledgeOs.listEntries(userData, ctx.kosSourcesCtx());
    const wikiRoot = ctx.knowledgeOs.resolveWikiRoot(userData, ctx.kosSourcesCtx());
    const docs = [];
    for (const e of list.wiki || []) {
        const abs = ctx.path.join(wikiRoot, e.path);
        let content = '';
        try {
            content = ctx.fs.readFileSync(abs, 'utf8');
        }
        catch {
            content = e.title || '';
        }
        docs.push({ title: e.title, path: e.path, content });
    }
    return docs;
};
ctx.buildFabricCtx = function buildFabricCtx(extra = {}) {
    const userData = ctx.app.getPath('userData');
    const providers = ctx.listRegistryProviders();
    const s = ctx.loadSettings();
    return {
        userData,
        providers,
        wikiDocs: ctx.wikiDocsForFabric(userData),
        embed: ctx.buildEmbedFn(s),
        ...ctx.kosSourcesCtx(),
        fabricSearch: (ud, q, ctx) => ctx.fabricRetrieval.fabricSearch(ud, q, ctx),
        queryProvider: (def, q, ctx) => ctx.knowledgeProvider.queryProvider(def, q, {
            ...ctx,
            useFabric: false,
        }),
        loadKbDocs: async (provider) => {
            const extracted = ctx.fabricWeave.extractAnchors(userData, provider, ctx.kosSourcesCtx());
            if (!extracted.ok)
                return [];
            return extracted.anchors.map(a => ({
                title: a.title,
                path: a.extRef || a.id,
                content: `${a.title}\n${a.summary || ''}`,
            }));
        },
        readWiki: (rel) => ctx.knowledgeOs.readEntry(userData, 'wiki', rel, ctx.kosSourcesCtx()),
        resolveRef: (ref) => ctx.fabricRetrieval.kbGet(userData, ref, {
            readWiki: rel => ctx.knowledgeOs.readEntry(userData, 'wiki', rel, ctx.kosSourcesCtx()),
        }),
        ...extra,
    };
};
ctx.ensureFabricSeeded = function ensureFabricSeeded(userData) {
    ctx.fabricGraph.ensureFabric(userData);
    const graph = ctx.fabricGraph.loadGraph(userData);
    if ((graph.nodes || []).length)
        return;
    const list = ctx.knowledgeOs.listEntries(userData, ctx.kosSourcesCtx());
    const seedEntries = [...(list.wiki || []), ...(list.okf || [])].map(e => ({
        path: e.path,
        title: e.title,
        kind: e.kind,
    }));
    ctx.fabricGraph.seedConceptsFromEntries(userData, seedEntries, { authority: 2 });
};
ctx.encProviderKey = function encProviderKey(plain) {
    if (!plain)
        return null;
    try {
        if (ctx.safeStorage.isEncryptionAvailable()) {
            return ctx.safeStorage.encryptString(String(plain)).toString('base64');
        }
    }
    catch { /* ignore */ }
    return null;
};
ctx.decProviderKey = function decProviderKey(encB64) {
    if (!encB64)
        return '';
    try {
        if (ctx.safeStorage.isEncryptionAvailable()) {
            return ctx.safeStorage.decryptString(Buffer.from(encB64, 'base64')).toString('utf8');
        }
    }
    catch { /* ignore */ }
    return '';
};
ctx.localDefaultProvider = function localDefaultProvider() {
    const cfg = ctx.knowledgeOs.loadConfig(ctx.app.getPath('userData'));
    return ctx.knowledgeProvider.normalizeProvider({
        ...ctx.knowledgeProvider.defaultPersonalProvider({
            spaceSourceId: cfg.spaceSourceId || null,
            subDir: cfg.subDir || '',
        }),
        id: 'local-default',
        displayName: '我的知识',
    });
};

ctx.listProvidersRedacted = function listProvidersRedacted() {
    const cfg = ctx.knowledgeOs.loadConfig(ctx.app.getPath('userData'));
    const stored = Array.isArray(cfg.providers) ? cfg.providers : [];
    const providers = [ctx.localDefaultProvider(), ...stored].map((p) => ctx.knowledgeProvider.redactProvider(p));
    const activeProviderId = cfg.activeProviderId || 'local-default';
    return { providers, activeProviderId };
};
ctx.resolveActiveProvider = function resolveActiveProvider() {
    const cfg = ctx.knowledgeOs.loadConfig(ctx.app.getPath('userData'));
    const activeId = cfg.activeProviderId || 'local-default';
    if (activeId === 'local-default')
        return ctx.localDefaultProvider();
    const stored = (Array.isArray(cfg.providers) ? cfg.providers : []).find((p) => p.id === activeId);
    if (!stored)
        return ctx.localDefaultProvider();
    if (stored.kind === 'remote-rag') {
        return { ...stored, apiKey: ctx.decProviderKey(stored.apiKeyEnc) };
    }
    return stored;
};

ctx.resolveProviderById = function resolveProviderById(id) {
    const providerId = String(id || '').trim();
    if (!providerId || providerId === 'local-default')
        return ctx.localDefaultProvider();
    const cfg = ctx.knowledgeOs.loadConfig(ctx.app.getPath('userData'));
    const stored = (Array.isArray(cfg.providers) ? cfg.providers : []).find((p) => p.id === providerId);
    if (!stored)
        return null;
    if (stored.kind === 'remote-rag') {
        return { ...stored, apiKey: ctx.decProviderKey(stored.apiKeyEnc) };
    }
    return ctx.knowledgeProvider.normalizeProvider(stored);
};
ctx.readJsonSafe = function readJsonSafe(file) {
    try {
        return JSON.parse(ctx.fs.readFileSync(file, 'utf8'));
    }
    catch {
        return null;
    }
};
ctx.readTextSafe = function readTextSafe(file) {
    try {
        return ctx.fs.readFileSync(file, 'utf8');
    }
    catch {
        return '';
    }
};
ctx.loadWorkbenchAgents = function loadWorkbenchAgents(repo) {
    if (!repo || !repo.ok)
        return [];
    const { root, agentsDir } = repo;
    const registry = ctx.readJsonSafe(ctx.path.join(root, 'tools', 'workflow_runner', 'agents_registry.json'));
    let agentEntries = [];
    if (registry && Array.isArray(registry.agents)) {
        agentEntries = registry.agents.map(a => ({ id: a.id, title: a.title, rel: a.path }));
    }
    else if (ctx.fs.existsSync(agentsDir)) {
        try {
            agentEntries = ctx.fs.readdirSync(agentsDir, { withFileTypes: true })
                .filter(d => d.isDirectory() && !d.name.startsWith('_'))
                .map(d => ({ id: d.name, title: d.name, rel: `.cursor/agents/${d.name}` }));
        }
        catch {
            agentEntries = [];
        }
    }
    const agents = [];
    for (const entry of agentEntries) {
        const dir = ctx.workbenchRepo.resolveAgentDir(root, entry.rel, entry.id);
        if (!dir)
            continue;
        const manifest = ctx.readJsonSafe(ctx.path.join(dir, 'agent.manifest.json'));
        const fm = ctx.workbenchModel.parseAgentFrontmatter(ctx.readTextSafe(ctx.path.join(dir, 'AGENT.md')));
        if (!manifest && !fm.description)
            continue;
        const agent = ctx.workbenchModel.parseAgentManifest(manifest || { id: entry.id, title: entry.title }, {
            id: entry.id,
            title: entry.title,
            description: fm.description,
            path: entry.rel || '',
        });
        if (!agent.persona.role && fm.persona.role)
            agent.persona.role = fm.persona.role;
        if (!agent.model && fm.model)
            agent.model = fm.model;
        agents.push(agent);
    }
    return agents;
};
ctx.loadWorkflowDefinition = function loadWorkflowDefinition(repo, workflowId, options = {}) {
    if (!repo || !repo.ok || !workflowId)
        return null;
    const explicitPath = String(options.path || options.workflowPath || '').trim();
    if (explicitPath) {
        const file = ctx.workbenchRepo.resolveWorkflowFile(repo.root, explicitPath);
        if (file) {
            const json = ctx.readJsonSafe(file);
            if (json) {
                return ctx.workbenchModel.parseWorkflow(json, {
                    id: workflowId,
                    name: options.name || workflowId,
                    description: options.description || '',
                    tags: options.tags,
                    path: explicitPath,
                });
            }
        }
    }
    const wfIndex = ctx.readJsonSafe(ctx.path.join(repo.workflowsDir, 'index.json'));
    const entry = wfIndex && Array.isArray(wfIndex.workflows)
        ? wfIndex.workflows.find(w => w.id === workflowId)
        : null;
    if (!entry || !entry.path)
        return null;
    const file = ctx.workbenchRepo.resolveWorkflowFile(repo.root, entry.path);
    if (!file)
        return null;
    const json = ctx.readJsonSafe(file);
    if (!json)
        return null;
    return ctx.workbenchModel.parseWorkflow(json, {
        id: entry.id,
        name: entry.name,
        description: entry.description || '',
        tags: entry.tags,
        path: entry.path,
    });
};
ctx.detectCursorApiKeyReady = function detectCursorApiKeyReady(installPath) {
    const root = String(installPath || '').trim();
    if (!root || !ctx.fs.existsSync(root))
        return false;
    const files = ['.nine/.env.local', '.nine/.env', '.env.local', '.env'];
    for (const rel of files) {
        const file = ctx.path.join(root, rel);
        if (!ctx.fs.existsSync(file))
            continue;
        let text = '';
        try {
            text = ctx.fs.readFileSync(file, 'utf8');
        }
        catch {
            continue;
        }
        for (const line of text.split(/\r?\n/)) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#'))
                continue;
            const match = trimmed.match(/^(?:export\s+)?(CURSOR_API_KEY|CURSOR_API)\s*=\s*(.*)$/i);
            if (!match)
                continue;
            let value = String(match[2] || '').trim();
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1).trim();
            }
            if (value)
                return true;
        }
    }
    return false;
};
ctx.projectDaemonTask = function projectDaemonTask(raw, repo, options = {}) {
    const agents = ctx.loadWorkbenchAgents(repo);
    const workflowId = String(raw.workflow || raw.task && raw.task.workflow || '').trim();
    const workflowPath = String(options.workflowPath
        || raw.workflow_path
        || raw.workflowPath
        || (raw.workflow && raw.workflow.path)
        || '').trim();
    const workflow = ctx.loadWorkflowDefinition(repo, workflowId, {
        path: workflowPath,
        name: options.workflowName,
    });
    const projection = ctx.workbenchTaskProjection.projectTaskRoom({
        task: raw,
        workflow,
        agents,
        intent: raw.intent,
        status: raw.state,
        workflowId,
        workflowName: workflow && workflow.name,
    });
    return {
        ...projection,
        graph: undefined,
        contentSource: repo && repo.origin === 'daemon' ? 'daemon' : (repo && repo.ok ? 'local' : 'none'),
    };
};
ctx.getWorkbenchDaemonClient = function getWorkbenchDaemonClient() {
    const settings = ctx.loadSettings();
    const token = ctx.workbenchAuth.resolveToken(settings);
    const endpoint = (settings.workbenchAuth && settings.workbenchAuth.endpoint)
        || process.env.KNOWME_WORKBENCH_URL;
    return ctx.workbenchDaemon.createClient({ endpoint, token });
};
ctx.publicWorkbenchAuthStatus = function publicWorkbenchAuthStatus(settings, health = null) {
    return ctx.workbenchAuth.mergeAuthFromHealth(ctx.workbenchAuth.publicStatus(settings), health);
};
ctx.getWorkbenchAutomationStore = function getWorkbenchAutomationStore() {
    return ctx.workbenchAutomationStore.createStore(ctx.WORKBENCH_AUTOMATIONS_FILE, {
        resolveLaunch: (job) => ctx.workbenchConsoleModel.buildAutomationLaunchRequest(job, ctx.lastVerticalPipelineFacts || {}),
    });
};
ctx.getWorkbenchTodoStore = function getWorkbenchTodoStore() {
    return ctx.workbenchTodoStore.createStore(ctx.WORKBENCH_TODOS_FILE);
};
ctx.getWorkbenchTaskDraftStore = function getWorkbenchTaskDraftStore() {
    return ctx.workbenchTaskDraftStore.createStore(ctx.WORKBENCH_TASK_DRAFT_FILE);
};
ctx.getWorkbenchTaskStore = function getWorkbenchTaskStore() {
    return ctx.workbenchTaskStore.createStore(ctx.WORKBENCH_TASKS_FILE);
};
ctx.workbenchTaskScheduleTimer = null;
ctx.notifyWorkbenchTaskScheduleDue = function notifyWorkbenchTaskScheduleDue(payload) {
    if (!ctx.workspaceWin || ctx.workspaceWin.isDestroyed())
        return false;
    ctx.workspaceWin.webContents.send('workbench-task-schedule-due', payload || {});
    return true;
};
ctx.tickWorkbenchTaskSchedules = function tickWorkbenchTaskSchedules() {
    try {
        const store = ctx.getWorkbenchTaskStore();
        const listed = store.list();
        const tasks = listed?.ok && Array.isArray(listed.tasks) ? listed.tasks : [];
        const due = ctx.workbenchTaskScheduler.listDue(tasks, new Date());
        for (const parent of due) {
            const advanced = ctx.workbenchTaskScheduler.advanceAfterFire(parent, new Date());
            const updated = store.update(parent.id, {
                schedule: advanced.schedule,
                scheduleEnabled: advanced.scheduleEnabled,
                scheduleLabel: advanced.scheduleLabel,
                nextRunAt: advanced.nextRunAt,
                lastScheduledAt: advanced.lastScheduledAt,
            });
            if (!updated?.ok)
                continue;
            ctx.notifyWorkbenchTaskScheduleDue({
                parentId: parent.id,
                parent: updated.task,
            });
        }
    }
    catch (err) {
        console.error('[workbench-task-schedule]', err?.stack || err);
    }
};
ctx.startWorkbenchTaskScheduleTicker = function startWorkbenchTaskScheduleTicker() {
    if (ctx.workbenchTaskScheduleTimer)
        return;
    ctx.tickWorkbenchTaskSchedules();
    ctx.workbenchTaskScheduleTimer = setInterval(ctx.tickWorkbenchTaskSchedules, 60 * 1000);
    if (typeof ctx.workbenchTaskScheduleTimer.unref === 'function')
        ctx.workbenchTaskScheduleTimer.unref();
};
ctx.getWorkbenchWorkflowPackageStore = function getWorkbenchWorkflowPackageStore() {
    return ctx.workflowPackageStore.createStore({ file: ctx.WORKBENCH_WORKFLOWS_FILE });
};
ctx.getAgentProfileStore = function getAgentProfileStore() {
    return ctx.agentProfileStore.createStore({ file: ctx.AGENT_PROFILES_FILE });
};
ctx.getWorkbenchContextStore = function getWorkbenchContextStore() {
    return ctx.workbenchContextStore.createStore(ctx.WORKBENCH_CONTEXT_FILE);
};
ctx.getWorkbenchLaunchStores = function getWorkbenchLaunchStores() {
    const contextStore = ctx.getWorkbenchContextStore();
    const draftStore = ctx.getWorkbenchTaskDraftStore();
    const context = contextStore.get().context;
    const draft = draftStore.get().draft;
    return { contextStore, draftStore, context, draft };
};
ctx.buildWorkbenchLaunchFacts = function buildWorkbenchLaunchFacts(input = {}) {
    const payload = input && typeof input === 'object' ? input : {};
    const allowFixtureFacts = process.env.KNOWME_TEST_SEAM === '1';
    const facts = allowFixtureFacts
        ? (payload.facts && typeof payload.facts === 'object' ? payload.facts : payload)
        : {};
    return ctx.workbenchConsoleModel.buildVerticalPipelineFacts({
        ...(ctx.lastVerticalPipelineFacts || {}),
        ...facts,
        daemonOnline: facts.daemonOnline != null
            ? facts.daemonOnline === true
            : !!(ctx.lastVerticalPipelineFacts && ctx.lastVerticalPipelineFacts.daemonOnline),
        localTeamEnabled: facts.localTeamEnabled != null
            ? facts.localTeamEnabled !== false
            : process.env.KNOWME_AGENT_TEAM_RUNTIME !== '0',
        availableExperts: Array.isArray(facts.availableExpertIds)
            ? facts.availableExpertIds
            : (facts.availableExperts || ctx.lastVerticalPipelineFacts?.availableExperts || ctx.collectAvailableWorkbenchExperts()),
    });
};
ctx.resolveLaunchPackageItem = function resolveLaunchPackageItem(resourceId) {
    const id = String(resourceId || '').trim();
    if (!id)
        return null;
    const stored = ctx.getWorkbenchWorkflowPackageStore().get(id);
    if (stored?.ok && stored.package)
        return stored.package;
    const resolved = ctx.workbenchConsoleModel.resolveVerticalPipelineById(id, ctx.lastVerticalPipelineFacts || {});
    return resolved?.package || null;
};
ctx.loadWorkbenchAgentRunSummaries = function loadWorkbenchAgentRunSummaries(limit = 50) {
    const store = new ctx.AgentRunStore({
        rootDir: ctx.path.join(ctx.app.getPath('userData'), 'agent-runs'),
        strictSecrets: true,
    });
    return store.listRootRunIds()
        .slice(-Math.max(1, Math.min(100, Number(limit) || 50)))
        .map((rootRunId) => {
        const result = store.queryRun(rootRunId);
        if (!result.ok || !result.state)
            return null;
        return {
            ...result.state,
            runId: result.state.runId || rootRunId,
            rootRunId,
            executionSource: 'local-team',
        };
    })
        .filter(Boolean);
};
ctx.buildWorkbenchConsoleProjection = function buildWorkbenchConsoleProjection(input = {}) {
    return ctx.workbenchConsoleModel.buildConsoleProjection({
        ...input,
        agentRuns: input.agentRuns || ctx.loadWorkbenchAgentRunSummaries(),
        localTeamEnabled: process.env.KNOWME_AGENT_TEAM_RUNTIME !== '0',
    });
};
ctx.lastVerticalPipelineFacts = ctx.workbenchConsoleModel.buildVerticalPipelineFacts();
ctx.collectAvailableWorkbenchExperts = function collectAvailableWorkbenchExperts() {
    const available = [];
    for (const [expertId] of ctx.workbenchModeCatalog) {
        if (ctx.isExpertAvailableForWorkbench(expertId))
            available.push(expertId);
    }
    return available;
};
ctx.summarizeFeishuConnectorStatus = function summarizeFeishuConnectorStatus(result) {
    const connector = result?.connector || null;
    const status = connector?.status || {};
    return [{
            id: 'feishu',
            kind: 'connector',
            label: '飞书连接器',
            enabled: connector?.enabled === true,
            ready: connector?.enabled === true
                && status.state !== 'auth_required'
                && status.userReady !== false,
            summary: '飞书会议与文档',
        }];
};
ctx.buildVerticalPipelineFactsInput = async function buildVerticalPipelineFactsInput(input = {}) {
    let connectors = [];
    try {
        const result = await ctx.getConnectorsApi().getConnectorStatus('feishu');
        connectors = ctx.summarizeFeishuConnectorStatus(result);
    }
    catch {
        connectors = [];
    }
    const facts = ctx.workbenchConsoleModel.buildVerticalPipelineFacts({
        modes: input.modes,
        daemon: input.daemon,
        agents: input.agents,
        connectors,
        availableExperts: input.availableExperts || ctx.collectAvailableWorkbenchExperts(),
        localTeamEnabled: process.env.KNOWME_AGENT_TEAM_RUNTIME !== '0',
    });
    ctx.lastVerticalPipelineFacts = facts;
    return facts;
};
ctx.attachWorkflowDefinitions = function attachWorkflowDefinitions(root, workflows = []) {
    return (Array.isArray(workflows) ? workflows : []).map(item => {
        if (!item?.path)
            return item;
        const file = ctx.workbenchRepo.resolveWorkflowFile(root, item.path);
        return file ? { ...item, definition: ctx.readJsonSafe(file) } : item;
    });
};
}

module.exports = { create }
