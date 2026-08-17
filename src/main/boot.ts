'use strict'

/**
 * 主进程启动：Electron/userData、lib 绑定、数据路径与 Hub 工厂。
 * 不负责开窗或 IPC 注册。
 */

/** 挂载启动期依赖与路径；由组合根 create(ctx) 调用一次。 */
function create(ctx) {
ctx.__bind_app_BrowserWindow_ipcMain_Tray_Menu_glob = require('electron'), ctx.app = ctx.__bind_app_BrowserWindow_ipcMain_Tray_Menu_glob.app, ctx.BrowserWindow = ctx.__bind_app_BrowserWindow_ipcMain_Tray_Menu_glob.BrowserWindow, ctx.ipcMain = ctx.__bind_app_BrowserWindow_ipcMain_Tray_Menu_glob.ipcMain, ctx.Tray = ctx.__bind_app_BrowserWindow_ipcMain_Tray_Menu_glob.Tray, ctx.Menu = ctx.__bind_app_BrowserWindow_ipcMain_Tray_Menu_glob.Menu, ctx.globalShortcut = ctx.__bind_app_BrowserWindow_ipcMain_Tray_Menu_glob.globalShortcut, ctx.nativeImage = ctx.__bind_app_BrowserWindow_ipcMain_Tray_Menu_glob.nativeImage, ctx.shell = ctx.__bind_app_BrowserWindow_ipcMain_Tray_Menu_glob.shell, ctx.clipboard = ctx.__bind_app_BrowserWindow_ipcMain_Tray_Menu_glob.clipboard, ctx.screen = ctx.__bind_app_BrowserWindow_ipcMain_Tray_Menu_glob.screen, ctx.dialog = ctx.__bind_app_BrowserWindow_ipcMain_Tray_Menu_glob.dialog, ctx.safeStorage = ctx.__bind_app_BrowserWindow_ipcMain_Tray_Menu_glob.safeStorage;
ctx.path = require('path');
ctx.fs = require('fs');
ctx.crypto = require('crypto');
ctx.https = require('https');
ctx.http = require('http');
ctx.__bind_spawn = require('child_process'), ctx.spawn = ctx.__bind_spawn.spawn;
// 知我 KnowMe：独立 userData，不迁移旧版应用数据
ctx.app.setName('KnowMe');
try {
    const testUserData = process.env.KNOWME_TEST_SEAM === '1'
        ? String(process.env.KNOWME_TEST_USER_DATA_DIR || '').trim()
        : '';
    ctx.app.setPath('userData', testUserData
        ? ctx.path.resolve(testUserData)
        : ctx.path.join(ctx.app.getPath('appData'), 'KnowMe'));
}
catch { /* path may already be locked */ }
/** @type {'' | 'remote' | 'crash' | 'env'} */
let windowsGpuDisableReason = '';
/** @type {ReturnType<typeof import('../lib/windows-gpu-policy').resolveWindowsGpuPolicy> | null} */
let windowsGpuPolicy = null;
if (process.platform === 'win32') {
    ctx.app.setAppUserModelId('com.aispace.knowme');
    // 自动：远程 / 上次 GPU 崩溃 → 软件路径 + UI 降频；本机健康则开 GPU。
    const { resolveWindowsGpuPolicy } = require('../lib/windows-gpu-policy');
    const {
        readGpuFallback,
        noteGpuFallbackStable,
        clearGpuFallback,
    } = require('../lib/windows-gpu-fallback');
    const userDataDir = ctx.app.getPath('userData');
    const crashState = readGpuFallback(userDataDir, ctx.fs, ctx.path);
    if (crashState.expired) clearGpuFallback(userDataDir, ctx.fs, ctx.path);
    windowsGpuPolicy = resolveWindowsGpuPolicy({
        env: process.env,
        crashFallbackActive: crashState.active,
    });
    if (windowsGpuPolicy.useInProcessGpu && !windowsGpuPolicy.disableGpu) {
        // 远程温和加固：进程内 GPU，仍用硬件加速
        ctx.app.commandLine.appendSwitch('in-process-gpu');
    }
    if (windowsGpuPolicy.disableGpu) {
        if (windowsGpuPolicy.applyRdpSwiftShader) {
            ctx.app.commandLine.appendSwitch('in-process-gpu');
            ctx.app.commandLine.appendSwitch('use-angle', 'swiftshader');
        }
        ctx.app.commandLine.appendSwitch('disable-gpu');
        ctx.app.commandLine.appendSwitch('disable-gpu-compositing');
        ctx.app.disableHardwareAcceleration();
        windowsGpuDisableReason = windowsGpuPolicy.reason;
        if (crashState.active) {
            // 软件路径稳定一段时间后自动清除回退，下次再探测硬件加速
            noteGpuFallbackStable(userDataDir, ctx.fs, ctx.path);
        }
    } else if (crashState.active || crashState.expired) {
        clearGpuFallback(userDataDir, ctx.fs, ctx.path);
    }
    if (windowsGpuPolicy.uiThrottle) {
        process.env.KNOWME_UI_THROTTLE = '1';
    }
    // 本机也写入间隔，避免 preload 回退到过密的默认值
    process.env.KNOWME_UI_LIVE_MS = String(windowsGpuPolicy.liveNowIntervalMs);
    process.env.KNOWME_UI_TELEMETRY_MS = String(windowsGpuPolicy.runTelemetryIntervalMs);
    ctx.windowsGpuPolicy = windowsGpuPolicy;
}
ctx.logger = require('../lib/logger');
if (windowsGpuDisableReason) {
    ctx.logger.system('gpu-policy', `Windows GPU auto-degraded (${windowsGpuDisableReason})`);
} else if (windowsGpuPolicy && windowsGpuPolicy.uiThrottle) {
    ctx.logger.system('gpu-policy', `Windows UI throttle (${windowsGpuPolicy.reason || 'on'})`);
}
ctx.__bind_materializeWindowsIcon = require('../lib/app-icon'), ctx.materializeWindowsIcon = ctx.__bind_materializeWindowsIcon.materializeWindowsIcon;
ctx.productKnowledge = require('../lib/product-knowledge');
ctx.productMemory = require('../lib/product-memory');
ctx.__bind_loadRendererEntry = require('./load-renderer'), ctx.loadRendererEntry = ctx.__bind_loadRendererEntry.loadRendererEntry;
ctx.__bind_applyTrayMenu = require('./tray'), ctx.applyTrayMenu = ctx.__bind_applyTrayMenu.applyTrayMenu;
ctx.settingsSecure = require('../lib/settings-secure');
ctx.__bind_createRemoteConfigClient = require('../lib/remote-config-client'), ctx.createRemoteConfigClient = ctx.__bind_createRemoteConfigClient.createRemoteConfigClient;
ctx.__bind_mergeOrgPublicConfig_normalizeRemoteConf = require('../lib/remote-config-merge'), ctx.mergeOrgPublicConfig = ctx.__bind_mergeOrgPublicConfig_normalizeRemoteConf.mergeOrgPublicConfig, ctx.normalizeRemoteConfig = ctx.__bind_mergeOrgPublicConfig_normalizeRemoteConf.normalizeRemoteConfig;
ctx.promptRouter = require('../lib/assistant-prompt-router');
ctx.__bind_buildSystemContent_buildChatMessages = require('../lib/ai-assistant-context'), ctx.buildSystemContent = ctx.__bind_buildSystemContent_buildChatMessages.buildSystemContent, ctx.buildChatMessages = ctx.__bind_buildSystemContent_buildChatMessages.buildChatMessages;
ctx.__bind_normalizeAssistantOutput = require('../lib/assistant-output-style'), ctx.normalizeAssistantOutput = ctx.__bind_normalizeAssistantOutput.normalizeAssistantOutput;
ctx.noteId = require('../lib/note-id');
ctx.promptSections = require('../lib/prompt-sections');
ctx.conversationGrounding = require('../lib/conversation-grounding');
ctx.noteDiff = require('../lib/note-diff');
ctx.noteVersions = require('../lib/note-versions');
ctx.noteClassify = require('../lib/note-classify');
ctx.agentSessions = require('../lib/agent-sessions');
ctx.agentRun = require('../lib/agent-run');
ctx.agentStream = require('../lib/agent-stream');
ctx.agentTools = require('../lib/agent-tools');
ctx.agentFileTools = require('../lib/agent-file-tools');
ctx.semanticIndex = require('../lib/semantic-index');
ctx.agentLoop = require('../lib/agent-loop');
ctx.agentRecovery = require('../lib/agent-recovery');
ctx.__bind_buildToolFailureHint = require('../lib/agent-tool-failure-hint'), ctx.buildToolFailureHint = ctx.__bind_buildToolFailureHint.buildToolFailureHint;
ctx.__bind_buildToolDisplaySummary = require('../lib/agent-tool-display'), ctx.buildToolDisplaySummary = ctx.__bind_buildToolDisplaySummary.buildToolDisplaySummary;
ctx.agentSandbox = require('../lib/agent-sandbox');
ctx.agentPlanTools = require('../lib/agent-plan-tools');
ctx.agentWebTools = require('../lib/agent-web-tools');
ctx.agentVerify = require('../lib/agent-verify');
ctx.__bind_resolveAgentExecutorMode_resolveGroundin = require('../lib/agent-run-ports'), ctx.resolveAgentExecutorMode = ctx.__bind_resolveAgentExecutorMode_resolveGroundin.resolveAgentExecutorMode, ctx.resolveGroundingRuntimeMode = ctx.__bind_resolveAgentExecutorMode_resolveGroundin.resolveGroundingRuntimeMode;
ctx.groundingRuntime = require('../lib/agent-grounding-runtime');
ctx.feishuGroundingAdapter = require('../lib/agent-grounding-feishu-adapter');
ctx.__bind_AgentRunExecutor = require('../lib/agent-run-executor'), ctx.AgentRunExecutor = ctx.__bind_AgentRunExecutor.AgentRunExecutor;
ctx.__bind_buildProductionRunPorts = require('../lib/agent-run-kernel-adapter'), ctx.buildProductionRunPorts = ctx.__bind_buildProductionRunPorts.buildProductionRunPorts;
ctx.llmRuntime = require('../lib/llm-runtime');
ctx.llmModelCatalog = require('../lib/llm-model-catalog');
ctx.llmUsage = require('../lib/llm-usage');
ctx.workbenchModel = require('../lib/workbench-model');
ctx.knowledgeOs = require('../lib/knowledge-os');
ctx.llmwikiService = require('../lib/llmwiki-service');
ctx.knowledgeSteward = require('../lib/knowledge-steward');
ctx.knowledgeStewardStore = require('../lib/knowledge-steward-store');
ctx.knowledgeStewardTools = require('../lib/knowledge-steward-tools');
ctx.obsidianBridge = require('../lib/obsidian-bridge');
ctx.knowledgeProvider = require('../lib/knowledge-provider');
ctx.fabricGraph = require('../lib/fabric-graph');
ctx.fabricWeave = require('../lib/fabric-weave');
ctx.fabricRetrieval = require('../lib/fabric-retrieval');
ctx.fabricGovernance = require('../lib/fabric-governance');
ctx.qmdEngine = require('../lib/qmd-engine');
ctx.chatIntent = require('../lib/chat-intent');
ctx.researchRouting = require('../lib/research-routing');
ctx.contextCache = require('../lib/context-cache');
ctx.contextOrchestrator = require('../lib/agent-context-orchestrator');
ctx.contextPacketLib = require('../lib/context-packet');
ctx.feishuGrounding = require('../lib/feishu-grounding');
ctx.feishuLink = require('../lib/feishu-link');
ctx.writingWorkflow = require('../lib/writing-workflow');
ctx.gameStudio = require('../lib/game-studio-scenes');
ctx.gameRequirement = require('../lib/game-requirement');
ctx.gameWorkbenchHandoff = require('../lib/game-workbench-handoff');
ctx.connectorsLib = require('../lib/connectors-stub');
ctx.connectorToolRuntime = require('../lib/connectors/tool-runtime');
ctx.agentProcessTools = require('../lib/agent-process-tools');
ctx.agentArtifactTools = require('../lib/agent-artifact-tools');
ctx.agentOrchestration = require('../lib/agent-orchestration');
ctx.__bind_mergeExtraTools = require('../lib/merge-extra-tools'), ctx.mergeExtraTools = ctx.__bind_mergeExtraTools.mergeExtraTools;
ctx.__bind_AgentRunStore = require('../lib/agent-run-store'), ctx.AgentRunStore = ctx.__bind_AgentRunStore.AgentRunStore;
ctx.__bind_AgentMessageBus = require('../lib/agent-message-bus'), ctx.AgentMessageBus = ctx.__bind_AgentMessageBus.AgentMessageBus;
ctx.__bind_AgentRunScheduler = require('../lib/agent-run-scheduler'), ctx.AgentRunScheduler = ctx.__bind_AgentRunScheduler.AgentRunScheduler;
ctx.__bind_AgentRunLauncher = require('../lib/agent-run-launcher'), ctx.AgentRunLauncher = ctx.__bind_AgentRunLauncher.AgentRunLauncher;
ctx.__bind_AgentRunManager = require('../lib/agent-run-manager'), ctx.AgentRunManager = ctx.__bind_AgentRunManager.AgentRunManager;
ctx.__bind_AgentTeamWorkflowRunner = require('../lib/agent-team-workflow-runner'), ctx.AgentTeamWorkflowRunner = ctx.__bind_AgentTeamWorkflowRunner.AgentTeamWorkflowRunner;
ctx.agentPackageRuntime = require('../lib/agent-package-runtime');
ctx.workbenchAgentGraph = require('../lib/workbench-agent-graph');
ctx.__bind_EventType_mapBusMessageToOutputEvent = require('../lib/agent-output-protocol'), ctx.EventType = ctx.__bind_EventType_mapBusMessageToOutputEvent.EventType, ctx.mapBusMessageToOutputEvent = ctx.__bind_EventType_mapBusMessageToOutputEvent.mapBusMessageToOutputEvent;
ctx.fileBackup = require('../lib/file-backup');
ctx.toolDraftsStore = require('../lib/tool-drafts-store');
ctx.__bind_isToolSurfaceV1 = require('../lib/tool-contract-registry'), ctx.isToolSurfaceV1 = ctx.__bind_isToolSurfaceV1.isToolSurfaceV1;
ctx.__bind_resolveToolSurfaceForRun = require('../lib/tool-surface-builder'), ctx.resolveToolSurfaceForRun = ctx.__bind_resolveToolSurfaceForRun.resolveToolSurfaceForRun;
ctx.__bind_resolveTestSeamOpts = require('../lib/test-seam'), ctx.resolveTestSeamOpts = ctx.__bind_resolveTestSeamOpts.resolveTestSeamOpts;
ctx.feishuCli = new Proxy({}, {
  get(_t, prop) {
    if (!ctx.__feishuCliMod) ctx.__feishuCliMod = require('../lib/connectors/feishu-cli')
    const v = ctx.__feishuCliMod[prop]
    return typeof v === 'function' ? v.bind(ctx.__feishuCliMod) : v
  },
});
ctx.feishuAuth = require('../lib/connectors/feishu-auth');
ctx.workbenchAutomationStore = require('../lib/workbench-automation-store');
ctx.workbenchTodoStore = require('../lib/workbench-todo-store');
ctx.workbenchTaskDraftStore = require('../lib/workbench-task-draft-store');
ctx.workbenchTaskStore = require('../lib/workbench-task-store');
ctx.workbenchTaskScheduler = require('../lib/workbench-task-scheduler');
ctx.workbenchModeStore = require('../lib/workbench-mode-store');
ctx.workbenchConsoleModel = require('../lib/workbench-console-model');
ctx.workflowPackageStore = require('../lib/workflow-package-store');
ctx.agentProfileStore = require('../lib/agent-profile-store');
ctx.workbenchContextStore = require('../lib/workbench-context-store');
ctx.workbenchLaunchController = require('../lib/workbench-launch-controller');
ctx.getConnectorsApi = function getConnectorsApi() {
    return ctx.connectorsLib.bindUserData(() => ctx.app.getPath('userData'));
};
ctx.CATALOG_ROOT = (() => {
    const resolved = ctx.path.resolve(ctx.path.join(__dirname, '..', 'catalog'));
    try {
        if (typeof ctx.fs.realpathSync.native === 'function') {
            return ctx.fs.realpathSync.native(resolved);
        }
        return ctx.fs.realpathSync(resolved);
    }
    catch {
        return resolved;
    }
})();
ctx.capabilityHub = null;
ctx.capabilityPackRuntime = null;
ctx.workbenchModes = null;
ctx.workbenchModeCatalog = new Map();
ctx.workbenchModeDaemon = { online: false };
ctx.ensureCapabilityPackRuntime = function ensureCapabilityPackRuntime() {
    if (!ctx.capabilityPackRuntime) {
        const getUserData = () => ctx.app.getPath('userData');
        const capStore = ctx.createCapabilityStore({ getUserData });
        const capabilityImport = require('../lib/capability-import');
        ctx.capabilityPackRuntime = ctx.createCapabilityPackRuntime({
            userData: getUserData(),
            trustedCatalogRoot: ctx.CATALOG_ROOT,
            getAvailableCapabilityManifests: () => {
                const catalog = require('../lib/capability-catalog').listCatalog(getUserData(), {
                    bundledRoot: ctx.CATALOG_ROOT,
                });
                return (catalog.entries || []).map((entry) => entry.manifest).filter(Boolean);
            },
            getOccupiedSkillIds: () => (capStore.listEntries({ kind: 'skill' }).entries || []).map((entry) => entry.id),
            ensureExpertInstalled: (expertId) => {
                const id = String(expertId || '').trim();
                if (!id)
                    return { ok: false, code: 'invalid_args', error: '缺少专家 id' };
                const expertMd = ctx.path.join(getUserData(), 'capabilities', 'experts', id, 'EXPERT.md');
                if (ctx.fs.existsSync(expertMd)) {
                    const entry = capStore.getEntry(id);
                    if (entry.ok && entry.entry?.kind === 'expert' && entry.entry.enabled !== false) {
                        return { ok: true, status: 'already', expertId: id };
                    }
                }
                return capabilityImport.installCurated(getUserData(), id, {
                    bundledRoot: ctx.CATALOG_ROOT,
                    enabled: true,
                    riskConfirmed: true,
                });
            },
        });
        try {
            ctx.capabilityPackRuntime.ensureDefaultPacks();
        }
        catch { /* */ }
        try {
            ctx.capabilityPackRuntime.migrateLegacyGameIndustry(ctx.loadSettings().industry);
        }
        catch { /* */ }
    }
    return ctx.capabilityPackRuntime;
};
ctx.ensureCapabilityHub = function ensureCapabilityHub() {
    if (!ctx.capabilityHub) {
        ctx.capabilityHub = ctx.createCapabilityHubService({
            getUserData: () => ctx.app.getPath('userData'),
            getKnowledgeDir: () => ctx.KNOWLEDGE_DIR,
            getConnectorsApi: ctx.getConnectorsApi,
            loadAgentStore: ctx.loadAgentStore,
            bundledRoot: ctx.CATALOG_ROOT,
            getPackSkillSources: () => ctx.ensureCapabilityPackRuntime().listSkillSources(),
            getPackEmptyStateGroups: () => ctx.ensureCapabilityPackRuntime().listEmptyStateGroups(),
            getPackScenesForUi: () => ctx.ensureCapabilityPackRuntime().listScenesForUi(),
            getKnowledgeCatalog: () => ctx.listProvidersRedacted(),
            resolveProviderById: (id) => ctx.resolveProviderById(id),
            getActiveProvider: () => ctx.resolveActiveProvider(),
            // 专家卸载后清理工作模式绑定 + 个人工作流引用，避免编排保存撞上幽灵专家
            onExpertUninstalled: (expertId) => {
                let modeCleanup = null;
                let workflowCleanup = null;
                try {
                    modeCleanup = ctx.getWorkbenchModeStore().unbindExpertEverywhere(expertId);
                }
                catch (error) {
                    modeCleanup = { ok: false, error: error?.message || String(error) };
                }
                try {
                    workflowCleanup = ctx.getWorkbenchWorkflowPackageStore().clearExpertRefs(expertId);
                }
                catch (error) {
                    workflowCleanup = { ok: false, error: error?.message || String(error) };
                }
                return {
                    ok: modeCleanup?.ok !== false && workflowCleanup?.ok !== false,
                    modeCleanup,
                    workflowCleanup,
                };
            },
        });
    }
    return ctx.capabilityHub;
};
ctx.sourcesLib = require('../lib/sources');
ctx.__bind_registerCoreIpc = require('../ipc'), ctx.registerCoreIpc = ctx.__bind_registerCoreIpc.registerCoreIpc;
ctx.workbenchRepo = require('../lib/workbench-repo');
ctx.workflowSupply = require('../lib/workflow-supply');
ctx.workbenchDaemon = require('../lib/workbench-daemon-client');
ctx.workbenchAuth = require('../lib/workbench-auth');
ctx.workbenchBootstrap = require('../lib/workbench-bootstrap');
ctx.workbenchTaskProjection = require('../lib/workbench-task-projection');
ctx.gitlabSource = require('../lib/gitlab-source');
ctx.webSource = require('../lib/web-source');
ctx.__bind_initAutoUpdate_checkForUpdatesManual = require('../lib/auto-update'), ctx.initAutoUpdate = ctx.__bind_initAutoUpdate_checkForUpdatesManual.initAutoUpdate, ctx.checkForUpdatesManual = ctx.__bind_initAutoUpdate_checkForUpdatesManual.checkForUpdatesManual;
ctx.__bind_createCapabilityHubService = require('../lib/capability-hub-service'), ctx.createCapabilityHubService = ctx.__bind_createCapabilityHubService.createCapabilityHubService;
ctx.__bind_createCapabilityPackRuntime = require('../lib/capability-pack-runtime'), ctx.createCapabilityPackRuntime = ctx.__bind_createCapabilityPackRuntime.createCapabilityPackRuntime;
ctx.__bind_createCapabilityStore = require('../lib/capability-store'), ctx.createCapabilityStore = ctx.__bind_createCapabilityStore.createCapabilityStore;
ctx.__bind_getSessionCapabilityBindings = require('../lib/agent-context-assembly'), ctx.getSessionCapabilityBindings = ctx.__bind_getSessionCapabilityBindings.getSessionCapabilityBindings;
ctx.THEME_LABELS = {
    nine_center: '活动中心',
    nine_skills: '技能包',
    tools: '工具',
    workbench: '工作台',
    daemon: '管线服务',
    webui: 'WebUI',
};
ctx.themeDisplayLabel = function themeDisplayLabel(theme) {
    return ctx.THEME_LABELS[theme] || theme;
};
ctx.DATA_DIR = ctx.path.join(ctx.app.getPath('userData'), 'notes');
ctx.SETTINGS_FILE = ctx.path.join(ctx.app.getPath('userData'), 'settings.json');
ctx.KNOWLEDGE_DIR = ctx.path.join(ctx.app.getPath('userData'), 'knowledge');
ctx.MEMORY_DIR = ctx.path.join(ctx.app.getPath('userData'), 'memory');
ctx.KNOWLEDGE_SEED = ctx.path.join(__dirname, '..', 'assets', 'knowledge-seed');
ctx.PROMPT_SPACE_DIR = process.env.KNOWME_PROMPT_SPACE_DIR || process.env.STICKY_PROMPT_SPACE_DIR || '';
ctx.PROMPT_SPACE_IMPORT_FLAG = ctx.path.join(ctx.app.getPath('userData'), 'prompt_space_imported.flag');
ctx.RECENT_FILE = ctx.path.join(ctx.app.getPath('userData'), 'recent-notes.json');
ctx.AGENT_SESSIONS_FILE = ctx.path.join(ctx.app.getPath('userData'), 'agent-sessions.json');
ctx.WORKBENCH_AUTOMATIONS_FILE = ctx.path.join(ctx.app.getPath('userData'), 'workbench-automations.json');
ctx.WORKBENCH_TODOS_FILE = ctx.path.join(ctx.app.getPath('userData'), 'workbench-todos.json');
ctx.WORKBENCH_TASK_DRAFT_FILE = ctx.path.join(ctx.app.getPath('userData'), 'workbench-task-draft.json');
ctx.WORKBENCH_TASKS_FILE = ctx.path.join(ctx.app.getPath('userData'), 'workbench-tasks.json');
ctx.WORKBENCH_MODES_FILE = ctx.path.join(ctx.app.getPath('userData'), 'workbench-modes.json');
ctx.WORKBENCH_WORKFLOWS_FILE = ctx.path.join(ctx.app.getPath('userData'), 'workbench-workflows.json');
ctx.AGENT_PROFILES_FILE = ctx.path.join(ctx.app.getPath('userData'), 'agent-profiles.json');
ctx.WORKBENCH_CONTEXT_FILE = ctx.path.join(ctx.app.getPath('userData'), 'workbench-context.json');
ctx.SEMANTIC_INDEX_CACHE_DIR = ctx.path.join(ctx.app.getPath('userData'), 'semantic-index-cache');
ctx.activeAgentRuns = new Map();
ctx.agentRuntimeOutputBridges = new Map();
ctx.agentRuntimePortFactories = new Map();
ctx.agentTeamRuntime = null;
ctx.workbenchAgentTeamRunner = null;
ctx.workbenchAgentGateWaiters = new Map();
ctx.workbenchAgentRunControllers = new Map();
ctx.__bind_createEvictingEventMap = require('../lib/runtime-store'), ctx.createEvictingEventMap = ctx.__bind_createEvictingEventMap.createEvictingEventMap;
ctx.workbenchAgentRunEvents = ctx.createEvictingEventMap({ maxEntries: 64, ttlMs: 24 * 60 * 60 * 1000 });
}

module.exports = { create }
