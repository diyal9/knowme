const {
  app, BrowserWindow, ipcMain, Tray, Menu,
  globalShortcut, nativeImage, shell, clipboard, screen, dialog, safeStorage
} = require('electron')
const path = require('path')
const fs   = require('fs')
const crypto = require('crypto')
const https = require('https')
const http  = require('http')
const { spawn } = require('child_process')

// 知我 KnowMe：独立 userData，不迁移旧版应用数据
app.setName('KnowMe')
try {
  const testUserData = process.env.KNOWME_TEST_SEAM === '1'
    ? String(process.env.KNOWME_TEST_USER_DATA_DIR || '').trim()
    : ''
  app.setPath('userData', testUserData
    ? path.resolve(testUserData)
    : path.join(app.getPath('appData'), 'KnowMe'))
} catch { /* path may already be locked */ }
if (process.platform === 'win32') {
  app.setAppUserModelId('com.aispace.knowme')
  const isRemoteDesktop = /^RDP-Tcp/i.test(String(process.env.SESSIONNAME || ''))
  if (isRemoteDesktop) {
    // RDP + Chromium GPU sandbox is a common source of renderer white screens on Windows.
    app.commandLine.appendSwitch('in-process-gpu')
    app.commandLine.appendSwitch('use-angle', 'swiftshader')
  }
  // Some Windows GPUs intermittently fail composition and show a blank white window.
  // Disable hardware acceleration to keep renderer output stable.
  app.commandLine.appendSwitch('disable-gpu')
  app.commandLine.appendSwitch('disable-gpu-compositing')
  app.disableHardwareAcceleration()
}

const logger = require('./lib/logger')
const { materializeWindowsIcon } = require('./lib/app-icon')
const productKnowledge = require('./lib/product-knowledge')
const productMemory = require('./lib/product-memory')

const { getRendererMode } = require('./lib/renderer-entry')

/**
 * Load a BrowserWindow with legacy HTML or Vite React entry.
 * @param {import('electron').BrowserWindow} win
 * @param {{ legacyFile: string, viteEntry: string, viteDevPath?: string }} opts
 */
async function loadRendererEntry(win, opts) {
  const mode = getRendererMode()
  if (mode === 'vite') {
    const isDev = !app.isPackaged && process.argv.includes('--dev')
    if (isDev) {
      const base = String(process.env.KNOWME_VITE_URL || 'http://127.0.0.1:5173').replace(/\/$/, '')
      const devPath = opts.viteDevPath || `/${opts.viteEntry}/`
      try {
        await win.loadURL(`${base}${devPath}`)
        return
      } catch (err) {
        console.warn('[renderer] vite dev URL failed, trying dist then legacy', err)
      }
    }
    const built = path.join(__dirname, '..', 'dist', 'renderer', opts.viteEntry, 'index.html')
    if (fs.existsSync(built)) {
      await win.loadFile(built)
      return
    }
    console.warn(`[renderer] missing ${built}; fallback to legacy ${opts.legacyFile}`)
  }
  await win.loadFile(path.join(__dirname, opts.legacyFile))
}

const settingsSecure = require('./lib/settings-secure')
const { createRemoteConfigClient } = require('./lib/remote-config-client')
const { mergeOrgPublicConfig, normalizeRemoteConfig } = require('./lib/remote-config-merge')
const promptRouter = require('./lib/assistant-prompt-router')
const {
  buildSystemContent,
  buildChatMessages,
} = require('./lib/ai-assistant-context')
const { normalizeAssistantOutput } = require('./lib/assistant-output-style')
const notesBackup = require('./lib/notes-backup')
const noteId = require('./lib/note-id')
const promptSections = require('./lib/prompt-sections')
const conversationGrounding = require('./lib/conversation-grounding')
const noteDiff = require('./lib/note-diff')
const noteVersions = require('./lib/note-versions')
const noteClassify = require('./lib/note-classify')
const agentSessions = require('./lib/agent-sessions')
const agentRun = require('./lib/agent-run')
const agentStream = require('./lib/agent-stream')
const agentTools = require('./lib/agent-tools')
const agentFileTools = require('./lib/agent-file-tools')
const semanticIndex = require('./lib/semantic-index')
const agentLoop = require('./lib/agent-loop')
const agentRecovery = require('./lib/agent-recovery')
const { buildToolFailureHint } = require('./lib/agent-tool-failure-hint')
const { buildToolDisplaySummary } = require('./lib/agent-tool-display')
const agentSandbox = require('./lib/agent-sandbox')
const agentPlanTools = require('./lib/agent-plan-tools')
const agentWebTools = require('./lib/agent-web-tools')
const agentVerify = require('./lib/agent-verify')
const { resolveAgentExecutorMode, resolveGroundingRuntimeMode } = require('./lib/agent-run-ports')
const groundingRuntime = require('./lib/agent-grounding-runtime')
const feishuGroundingAdapter = require('./lib/agent-grounding-feishu-adapter')
const { AgentRunExecutor } = require('./lib/agent-run-executor')
const { buildProductionRunPorts } = require('./lib/agent-run-kernel-adapter')
const llmRuntime = require('./lib/llm-runtime')
const llmModelCatalog = require('./lib/llm-model-catalog')
const llmUsage = require('./lib/llm-usage')
const workbenchModel = require('./lib/workbench-model')
const knowledgeOs = require('./lib/knowledge-os')
const llmwikiService = require('./lib/llmwiki-service')
const knowledgeSteward = require('./lib/knowledge-steward')
const knowledgeStewardStore = require('./lib/knowledge-steward-store')
const knowledgeStewardTools = require('./lib/knowledge-steward-tools')
const obsidianBridge = require('./lib/obsidian-bridge')
const knowledgeProvider = require('./lib/knowledge-provider')
const fabricGraph = require('./lib/fabric-graph')
const fabricWeave = require('./lib/fabric-weave')
const fabricRetrieval = require('./lib/fabric-retrieval')
const fabricGovernance = require('./lib/fabric-governance')
const qmdEngine = require('./lib/qmd-engine')
const chatIntent = require('./lib/chat-intent')
const researchRouting = require('./lib/research-routing')
const contextCache = require('./lib/context-cache')
const contextOrchestrator = require('./lib/agent-context-orchestrator')
const contextPacketLib = require('./lib/context-packet')
const feishuGrounding = require('./lib/feishu-grounding')
const feishuLink = require('./lib/feishu-link')
const writingWorkflow = require('./lib/writing-workflow')
const gameStudio = require('./lib/game-studio-scenes')
const gameRequirement = require('./lib/game-requirement')
const gameWorkbenchHandoff = require('./lib/game-workbench-handoff')
const connectorsLib = require('./lib/connectors-stub')
const connectorToolRuntime = require('./lib/connectors/tool-runtime')
const agentProcessTools = require('./lib/agent-process-tools')
const agentArtifactTools = require('./lib/agent-artifact-tools')
const agentOrchestration = require('./lib/agent-orchestration')
const { mergeExtraTools } = require('./lib/merge-extra-tools')
const { AgentRunStore } = require('./lib/agent-run-store')
const { AgentMessageBus } = require('./lib/agent-message-bus')
const { AgentRunScheduler } = require('./lib/agent-run-scheduler')
const { AgentRunLauncher } = require('./lib/agent-run-launcher')
const { AgentRunManager } = require('./lib/agent-run-manager')
const { AgentTeamWorkflowRunner } = require('./lib/agent-team-workflow-runner')
const agentPackageRuntime = require('./lib/agent-package-runtime')
const workbenchAgentGraph = require('./lib/workbench-agent-graph')
const { EventType, mapBusMessageToOutputEvent } = require('./lib/agent-output-protocol')
const fileBackup = require('./lib/file-backup')
const toolDraftsStore = require('./lib/tool-drafts-store')
const { isToolSurfaceV1 } = require('./lib/tool-contract-registry')
const { resolveToolSurfaceForRun } = require('./lib/tool-surface-builder')
const { resolveTestSeamOpts } = require('./lib/test-seam')
const feishuCli = require('./lib/connectors/feishu-cli')
const feishuAuth = require('./lib/connectors/feishu-auth')
const workbenchAutomationStore = require('./lib/workbench-automation-store')
const workbenchTodoStore = require('./lib/workbench-todo-store')
const workbenchTaskDraftStore = require('./lib/workbench-task-draft-store')
const workbenchTaskStore = require('./lib/workbench-task-store')
const workbenchTaskScheduler = require('./lib/workbench-task-scheduler')
const workbenchModeStore = require('./lib/workbench-mode-store')
const workbenchConsoleModel = require('./lib/workbench-console-model')
const workflowPackageStore = require('./lib/workflow-package-store')
const agentProfileStore = require('./lib/agent-profile-store')
const workbenchContextStore = require('./lib/workbench-context-store')
const workbenchLaunchController = require('./lib/workbench-launch-controller')
function getConnectorsApi() {
  return connectorsLib.bindUserData(() => app.getPath('userData'))
}

const CATALOG_ROOT = (() => {
  const resolved = path.resolve(path.join(__dirname, 'catalog'))
  try {
    if (typeof fs.realpathSync.native === 'function') {
      return fs.realpathSync.native(resolved)
    }
    return fs.realpathSync(resolved)
  } catch {
    return resolved
  }
})()
let capabilityHub = null
let capabilityPackRuntime = null
let workbenchModes = null
let workbenchModeCatalog = new Map()
let workbenchModeDaemon = { online: false }

function ensureCapabilityPackRuntime() {
  if (!capabilityPackRuntime) {
    const getUserData = () => app.getPath('userData')
    const capStore = createCapabilityStore({ getUserData })
    const capabilityImport = require('./lib/capability-import')
    capabilityPackRuntime = createCapabilityPackRuntime({
      userData: getUserData(),
      trustedCatalogRoot: CATALOG_ROOT,
      getAvailableCapabilityManifests: () => {
        const catalog = require('./lib/capability-catalog').listCatalog(getUserData(), {
          bundledRoot: CATALOG_ROOT,
        })
        return (catalog.entries || []).map((entry) => entry.manifest).filter(Boolean)
      },
      getOccupiedSkillIds: () => (
        capStore.listEntries({ kind: 'skill' }).entries || []
      ).map((entry) => entry.id),
      ensureExpertInstalled: (expertId) => {
        const id = String(expertId || '').trim()
        if (!id) return { ok: false, code: 'invalid_args', error: '缺少专家 id' }
        const expertMd = path.join(getUserData(), 'capabilities', 'experts', id, 'EXPERT.md')
        if (fs.existsSync(expertMd)) {
          const entry = capStore.getEntry(id)
          if (entry.ok && entry.entry?.kind === 'expert' && entry.entry.enabled !== false) {
            return { ok: true, status: 'already', expertId: id }
          }
        }
        return capabilityImport.installCurated(getUserData(), id, {
          bundledRoot: CATALOG_ROOT,
          enabled: true,
          riskConfirmed: true,
        })
      },
    })
    try {
      capabilityPackRuntime.ensureDefaultPacks()
    } catch { /* */ }
    try {
      capabilityPackRuntime.migrateLegacyGameIndustry(loadSettings().industry)
    } catch { /* */ }
  }
  return capabilityPackRuntime
}

function ensureCapabilityHub() {
  if (!capabilityHub) {
    capabilityHub = createCapabilityHubService({
      getUserData: () => app.getPath('userData'),
      getKnowledgeDir: () => KNOWLEDGE_DIR,
      getConnectorsApi,
      loadAgentStore,
      bundledRoot: CATALOG_ROOT,
      getPackSkillSources: () => ensureCapabilityPackRuntime().listSkillSources(),
      getPackEmptyStateGroups: () => ensureCapabilityPackRuntime().listEmptyStateGroups(),
      getPackScenesForUi: () => ensureCapabilityPackRuntime().listScenesForUi(),
      getKnowledgeCatalog: () => listProvidersRedacted(),
      resolveProviderById: (id) => resolveProviderById(id),
      getActiveProvider: () => resolveActiveProvider(),
      // 专家卸载后清理工作模式绑定 + 个人工作流引用，避免编排保存撞上幽灵专家
      onExpertUninstalled: (expertId) => {
        let modeCleanup = null
        let workflowCleanup = null
        try {
          modeCleanup = getWorkbenchModeStore().unbindExpertEverywhere(expertId)
        } catch (error) {
          modeCleanup = { ok: false, error: error?.message || String(error) }
        }
        try {
          workflowCleanup = getWorkbenchWorkflowPackageStore().clearExpertRefs(expertId)
        } catch (error) {
          workflowCleanup = { ok: false, error: error?.message || String(error) }
        }
        return {
          ok: modeCleanup?.ok !== false && workflowCleanup?.ok !== false,
          modeCleanup,
          workflowCleanup,
        }
      },
    })
  }
  return capabilityHub
}
const sourcesLib = require('./lib/sources')
const { registerCoreIpc } = require('./ipc')
const workbenchRepo = require('./lib/workbench-repo')
const workflowSupply = require('./lib/workflow-supply')
const workbenchDaemon = require('./lib/workbench-daemon-client')
const workbenchAuth = require('./lib/workbench-auth')
const workbenchBootstrap = require('./lib/workbench-bootstrap')
const workbenchTaskProjection = require('./lib/workbench-task-projection')
const gitlabSource = require('./lib/gitlab-source')
const webSource = require('./lib/web-source')
const { initAutoUpdate, checkForUpdatesManual } = require('./lib/auto-update')
const { createCapabilityHubService } = require('./lib/capability-hub-service')
const { createCapabilityPackRuntime } = require('./lib/capability-pack-runtime')
const { createCapabilityStore } = require('./lib/capability-store')
const { getSessionCapabilityBindings } = require('./lib/agent-context-assembly')

const THEME_LABELS = {
  nine_center: '活动中心',
  nine_skills: '技能包',
  tools: '工具',
  workbench: '工作台',
  daemon: '管线服务',
  webui: 'WebUI',
}

function themeDisplayLabel(theme) {
  return THEME_LABELS[theme] || theme
}

// ── 路径 ─────────────────────────────────────────────────────────────────────
const DATA_DIR      = path.join(app.getPath('userData'), 'notes')
const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json')
const KNOWLEDGE_DIR = path.join(app.getPath('userData'), 'knowledge')
const MEMORY_DIR    = path.join(app.getPath('userData'), 'memory')
const KNOWLEDGE_SEED = path.join(__dirname, 'assets', 'knowledge-seed')
const PROMPT_SPACE_DIR = process.env.STICKY_PROMPT_SPACE_DIR || ''
const PROMPT_SPACE_IMPORT_FLAG = path.join(app.getPath('userData'), 'prompt_space_imported.flag')
const RECENT_FILE = path.join(app.getPath('userData'), 'recent-notes.json')
const AGENT_SESSIONS_FILE = path.join(app.getPath('userData'), 'agent-sessions.json')
const WORKBENCH_AUTOMATIONS_FILE = path.join(app.getPath('userData'), 'workbench-automations.json')
const WORKBENCH_TODOS_FILE = path.join(app.getPath('userData'), 'workbench-todos.json')
const WORKBENCH_TASK_DRAFT_FILE = path.join(app.getPath('userData'), 'workbench-task-draft.json')
const WORKBENCH_TASKS_FILE = path.join(app.getPath('userData'), 'workbench-tasks.json')
const WORKBENCH_MODES_FILE = path.join(app.getPath('userData'), 'workbench-modes.json')
const WORKBENCH_WORKFLOWS_FILE = path.join(app.getPath('userData'), 'workbench-workflows.json')
const AGENT_PROFILES_FILE = path.join(app.getPath('userData'), 'agent-profiles.json')
const WORKBENCH_CONTEXT_FILE = path.join(app.getPath('userData'), 'workbench-context.json')
const SEMANTIC_INDEX_CACHE_DIR = path.join(app.getPath('userData'), 'semantic-index-cache')
const activeAgentRuns = new Map()
const agentRuntimeOutputBridges = new Map()
const agentRuntimePortFactories = new Map()
let agentTeamRuntime = null
let workbenchAgentTeamRunner = null
const workbenchAgentGateWaiters = new Map()
const workbenchAgentRunControllers = new Map()
const workbenchAgentRunEvents = new Map()

function ensureAgentTeamRuntime() {
  if (agentTeamRuntime) return agentTeamRuntime
  const enabled = process.env.KNOWME_AGENT_TEAM_RUNTIME !== '0'

  const store = new AgentRunStore({
    rootDir: path.join(app.getPath('userData'), 'agent-runs'),
    strictSecrets: true,
  })
  let manager = null
  const messageBus = new AgentMessageBus({
    runStore: store,
    isRunAuthorized: (runId, envelope) => {
      if (!manager) return false
      const source = manager.getRun(runId)
      const target = envelope.targetRunId ? manager.getRun(envelope.targetRunId) : null
      if (!source.ok) return false
      if (!target) return true
      return target.ok && source.run.rootRunId === target.run.rootRunId
    },
  })
  const scheduler = new AgentRunScheduler()
  const launcher = new AgentRunLauncher({
    metrics: store.metrics,
    buildPorts: async (context) => {
      const factory = agentRuntimePortFactories.get(context.rootRunId)
        || agentRuntimePortFactories.get(context.parentRunId)
      if (!factory) throw new Error(`子 Run 缺少隔离端口工厂: ${context.rootRunId || context.parentRunId}`)
      return factory(context)
    },
  })

  manager = new AgentRunManager({
    runStore: store,
    messageBus,
    scheduler,
    launcher,
    metrics: store.metrics,
    authorizeChild: (spec) => {
      const expertId = String(spec.expertId || '').trim()
      if (!expertId) return { ok: false, code: 'unknown_agent', message: '缺少子 Agent/Expert 标识' }
      const loaded = ensureCapabilityHub().expertRuntime().loadExpert(expertId)
      return loaded.ok
        ? { ok: true }
        : { ok: false, code: 'unknown_agent', message: `未知或未安装 Expert: ${expertId}` }
    },
    emit: (event) => {
      if (event?.type === 'bus.message' && event.message) {
        const bus = event.message
        const rootRunId = String(bus.rootRunId || bus.parentRunId || '')
        const bridge = agentRuntimeOutputBridges.get(rootRunId)
        if (!bridge) return
        const mapped = mapBusMessageToOutputEvent(bus, { runId: rootRunId, seq: 1 })
        if (mapped) bridge(mapped.type, mapped.payload, { phase: mapped.phase })
        return
      }
      const hit = manager.getRun(event?.runId)
      if (!hit.ok || !hit.run.parentRunId) return
      const run = hit.run
      const bridge = agentRuntimeOutputBridges.get(run.rootRunId)
      if (!bridge) return

      const payload = {
        subRunId: run.runId,
        parentRunId: run.parentRunId,
        expertId: run.meta?.expertId || null,
        builderId: run.meta?.builderId || run.meta?.backend || 'knowme-local',
        phase: event?.phase || event?.payload?.phase || run.phase || run.status,
        status: run.status,
        stopReason: run.stopReason || event?.payload?.stopReason || null,
        summary: event?.payload?.summary || run.meta?.summary || '',
        artifactRefs: event?.payload?.artifactRefs || run.artifactRefs || [],
        evidenceRefs: event?.payload?.evidenceRefs || run.evidenceRefs || [],
        metrics: event?.payload?.metrics || run.meta?.metrics || {},
      }

      if (event?.type === 'run.started') {
        bridge(EventType.SUBRUN_STARTED, payload)
      } else if (event?.type === 'run.terminal') {
        const terminalType = run.status === 'cancelled'
          ? EventType.SUBRUN_CANCELLED
          : (run.status === 'done' ? EventType.SUBRUN_COMPLETED : EventType.SUBRUN_FAILED)
        bridge(terminalType, { ...payload, terminal: run.status })
      } else if (event?.type === 'run.waiting') {
        bridge(EventType.SUBRUN_WAITING, payload)
      } else if ([
        'phase.changed',
        'stage.updated',
        'tool.result',
        EventType.STAGE,
        EventType.PLAN_UPDATED,
        EventType.GROUNDING_STATUS,
        EventType.TOOL_STARTED,
        EventType.TOOL_COMPLETED,
        EventType.TOOL_FAILED,
      ].includes(event?.type)) {
        bridge(EventType.SUBRUN_PROGRESS, payload)
      }
    },
  })
  manager.recoverAllFromStore()

  agentTeamRuntime = { store, messageBus, scheduler, launcher, manager, enabled }
  return agentTeamRuntime
}

function resolveWorkbenchAgentPackage(agentPackageId, profileId = '') {
  const id = String(agentPackageId || '').trim()
  if (!id) return { ok: false, code: 'unknown_agent', message: '缺少 Agent Package 标识' }
  const expert = ensureCapabilityHub().expertRuntime().loadExpert(id)
  if (!expert.ok) return expert
  const requestedProfile = String(profileId || '').trim()
  const profile = requestedProfile
    ? (getAgentProfileStore().get(requestedProfile).profile || null)
    : (getAgentProfileStore().list(id).profiles[0] || null)
  const skillRefs = profile?.skillRefs?.length
    ? profile.skillRefs
    : (expert.skills || []).map(skillId => ({ id: skillId, version: 'latest' }))
  const role = profile?.roleOverlay || expert.name || expert.id
  const normalized = agentPackageRuntime.normalizeLocalAgentPackage({
    packageId: expert.id,
    name: profile?.name || expert.name || expert.id,
    version: profile?.version || expert.manifest?.version || '1.0.0',
    persona: {
      role,
      description: profile?.description || expert.description || '',
      stance: 'evidence-first',
    },
    capabilities: {
      required: skillRefs.map(ref => ({
        id: ref.id,
        kind: 'skill',
        version: ref.version,
        contentHash: ref.contentHash,
      })),
      optional: [],
    },
    inputs: { type: 'object', properties: {} },
    outputs: { type: 'object', properties: {} },
    orchestration: { allowDelegate: false, maxParallel: 1, allowedSubExperts: [] },
  })
  if (!normalized.ok) return normalized
  return {
    ...normalized,
    expert,
    profile,
    contentHash: [expert.manifest?.contentHash || normalized.contentHash, profile?.profileHash]
      .filter(Boolean)
      .join(':'),
  }
}

function workbenchAgentEventList(rootRunId) {
  const id = String(rootRunId || '').trim()
  if (!id) return []
  const events = workbenchAgentRunEvents.get(id) || []
  return events.slice(-120)
}

function getWorkbenchAgentTeamRunner() {
  if (workbenchAgentTeamRunner) return workbenchAgentTeamRunner
  const runtime = ensureAgentTeamRuntime()
  workbenchAgentTeamRunner = new AgentTeamWorkflowRunner({
    runManager: runtime.manager,
    resolveAgentPackage: resolveWorkbenchAgentPackage,
    resolveAgentProfile: profileId => getAgentProfileStore().get(String(profileId || '')),
    requestGateDecision: async ({ rootRunId, node, gate }) => {
      const key = `${rootRunId}:${node.id}`
      const events = workbenchAgentRunEvents.get(rootRunId) || []
      events.push({
        type: 'team.gate.waiting',
        rootRunId,
        nodeId: node.id,
        gateId: gate.id,
        title: gate.description || gate.id,
        at: new Date().toISOString(),
      })
      workbenchAgentRunEvents.set(rootRunId, events.slice(-120))
      return new Promise(resolve => {
        workbenchAgentGateWaiters.set(key, { resolve, rootRunId, nodeId: node.id })
      })
    },
    emit: event => {
      const rootRunId = String(event?.rootRunId || '').trim()
      if (!rootRunId) return
      const events = workbenchAgentRunEvents.get(rootRunId) || []
      events.push({ ...event, at: new Date().toISOString() })
      workbenchAgentRunEvents.set(rootRunId, events.slice(-120))
    },
    specialtyHandlers: {
      llm: async ({ prompt, config }) => {
        const settings = loadSettings()
        if (!settings.apiKey || !settings.apiEndpoint) {
          return { ok: false, code: 'llm_not_configured', message: '请先配置 AI API Key 和 Endpoint' }
        }
        const model = String(config?.modelName || config?.model || '').trim()
        const result = await chatCompletionOnce(
          settings,
          [
            { role: 'system', content: '你是 KnowMe 工作流中的大模型节点。只根据 Prompt 与输入完成当前步骤，不要调用工具。' },
            { role: 'user', content: String(prompt || '').slice(0, 12000) || '请根据上下文给出结果。' },
          ],
          1200,
          { model, temperature: config?.temperature },
        )
        if (result.error) return { ok: false, code: 'llm_failed', message: result.error }
        return { ok: true, summary: String(result.text || '').trim(), text: result.text }
      },
      tool: async ({ config, upstream, node }) => {
        const skillId = String(config?.skillId || '').trim()
        if (!skillId) return { ok: false, code: 'missing_skill', message: '工具节点缺少 Skill' }
        const hub = ensureCapabilityHub()
        const runtime = hub.skillRuntime?.() || hub
        if (typeof runtime.loadSkillL1 === 'function') {
          const loaded = runtime.loadSkillL1(skillId)
          if (loaded?.ok === false) {
            return { ok: false, code: loaded.code || 'skill_missing', message: loaded.message || `无法加载 Skill: ${skillId}` }
          }
          const body = String(loaded?.body || loaded?.content || '').trim()
          const intent = String(node?.intent || '').trim()
          return {
            ok: true,
            summary: [
              `技能 ${loaded?.name || skillId}`,
              intent ? `目标：${intent}` : '',
              upstream ? `上游：${String(upstream).slice(0, 2000)}` : '',
              body ? `技能说明：${body.slice(0, 2000)}` : '已绑定技能（无脚本正文，仅记录绑定结果）',
            ].filter(Boolean).join('\n'),
          }
        }
        return {
          ok: true,
          summary: `已选择技能 ${skillId}${upstream ? `\n上游：${String(upstream).slice(0, 1500)}` : ''}`,
        }
      },
      knowledge: async ({ config, upstream, node }) => {
        const knowledgeId = String(config?.knowledgeId || '').trim()
        if (!knowledgeId) return { ok: false, code: 'missing_knowledge', message: '知识库节点缺少知识库' }
        const query = String(node?.intent || upstream || '').trim() || '检索相关知识'
        const result = await fabricRetrieval.kbQuery(
          app.getPath('userData'),
          knowledgeId,
          query,
          typeof buildFabricCtx === 'function' ? buildFabricCtx() : {},
        )
        if (!result?.ok) {
          return {
            ok: false,
            code: result?.code || 'knowledge_query_failed',
            message: result?.message || '知识库检索失败',
          }
        }
        const hits = Array.isArray(result.hits) ? result.hits : []
        const digest = hits.slice(0, 5).map((hit, index) => {
          const title = hit.title || hit.id || `命中${index + 1}`
          const snippet = String(hit.snippet || hit.text || hit.content || '').slice(0, 400)
          return `- ${title}: ${snippet}`
        }).join('\n')
        return {
          ok: true,
          summary: digest || `知识库 ${knowledgeId} 无命中（查询：${query.slice(0, 200)}）`,
          evidenceRefs: hits.slice(0, 8).map(hit => hit.id || hit.ref).filter(Boolean),
        }
      },
    },
  })
  return workbenchAgentTeamRunner
}

function createWorkbenchAgentPortFactory({ rootRunId, goal, permissions = {} } = {}) {
  const runtime = ensureAgentTeamRuntime()
  const settings = loadSettings()
  const endpoint = normalizeChatEndpoint(settings.apiEndpoint)
  const url = new URL(endpoint)
  const routedModel = llmModelCatalog.resolveRuntimeModel(settings, {
    tier: 'agent',
    prompt: goal,
  })
  const modelProfile = routedModel.profile || {}
  const policy = llmRuntime.getRequestPolicy({
    model: routedModel.model || 'gpt-4o-mini',
    tier: 'agent',
    temperature: settings.temperature,
    requestedOutput: 2400,
    profile: modelProfile,
  })
  const promptCachePolicy = llmRuntime.getCacheControlPolicy({
    enabled: settings.promptCacheControl === true || process.env.KNOWME_PROMPT_CACHE === '1',
    provider: routedModel.provider,
    model: routedModel.model,
    endpoint: settings.apiEndpoint,
  })
  const tokenCalKey = llmUsage.calibrationKey(
    routedModel.provider,
    routedModel.model || 'gpt-4o-mini',
  )
  const sourceRoot = getActiveSourceRoot()
  const runPermissions = {
    ...permissions,
    sandbox: agentSandbox.normalizeSandboxPermissions(permissions, {
      allowNetwork: settings.agentScriptsAllowNetwork === true,
    }),
    orchestration: {
      allowDelegate: false,
      maxParallel: 1,
      allowedSubExperts: [],
      ...(permissions.orchestration || {}),
    },
  }
  const searchKnowledge = async () => ({
    ok: false,
    code: 'workbench_graph_search_unavailable',
    text: '当前 Agent Graph 节点未启用独立知识检索工具',
  })

  const factory = async childCtx => {
    const childRunId = String(childCtx.runId || '')
    const expertId = String(childCtx.expertId || '').trim()
    const expert = ensureCapabilityHub().expertRuntime().loadExpert(expertId)
    if (!expert.ok) throw new Error(expert.message || `未知 Agent: ${expertId}`)
    const childSession = agentSessions.createSession('general', 1, {
      expertId,
      ephemeral: true,
      role: 'general',
      goal: String(childCtx.prompt || '').slice(0, 2000),
    })
    childSession.run.permissions = runPermissions
    const handoffText = JSON.stringify({
      goal,
      task: String(childCtx.prompt || ''),
      handoff: childCtx.handoff || null,
      parentRunId: childCtx.parentRunId || null,
      expertId,
    })
    const apiMessages = [
      {
        role: 'system',
        content: [
          `你是 KnowMe 工作台中的本地 Agent（expert=${expertId}）。`,
          expert.systemPrompt || expert.description || '',
          '只处理当前节点和结构化交接任务；不要假设可以访问父 Agent 的完整历史。',
          '输出应包含可核验的结论，必要时明确缺少的输入。',
          '当节点产出纪要、待办、报告或其他可复用交付物时，必须调用 create_artifact 保存产物，再在回答中说明结果。',
        ].filter(Boolean).join('\n\n'),
      },
      { role: 'user', content: handoffText },
    ]
    const artifactTools = agentArtifactTools.buildArtifactTools({ runId: childRunId })
    const extraTools = mergeExtraTools(artifactTools)
    const bindings = getSessionCapabilityBindings(childSession, ensureCapabilityHub().expertRuntime())
    const resolvedSurface = await resolveToolSurfaceForRun({
      userData: app.getPath('userData'),
      runId: childRunId,
      parentRunId: childCtx.parentRunId,
      subRunId: childRunId,
      sessionId: childSession.id,
      artifactTools,
      extraTools,
      permissions: runPermissions,
      expertSnapshot: expert,
      allowedConnectorIds: bindings.allowedConnectorIds,
      signal: childCtx.signal,
      budget: runtime.manager.getRun(childRunId).run?.budget || null,
      recordReceipt: receipt => runtime.store.writeReceipt(
        childRunId,
        receipt.idempotencyKey || receipt.auditId || `receipt_${Date.now()}`,
        { result: receipt.envelope || receipt },
      ),
      connectorBuild: options => connectorToolRuntime.buildConnectorToolSurface(app.getPath('userData'), {
        extraTools: options.extraTools,
        allowedConnectorIds: bindings.allowedConnectorIds,
        registry: options.registry,
      }),
    })
    const toolSurface = resolvedSurface.surface
    const toolExecutor = toolSurface.createToolExecutor({
      searchKnowledge,
      fabricSearch: searchKnowledge,
      signal: childCtx.signal,
    })
    const childPorts = buildProductionRunPorts({
      settings,
      signal: childCtx.signal,
      url,
      runId: childRunId,
      parentRunId: childCtx.parentRunId,
      subRunId: childRunId,
      routedModel,
      policy,
      promptCachePolicy,
      tokenCalKey,
      toolSurface,
      toolExecutor,
      tier: 'agent',
      apiMessages,
      session: childSession,
      toolsEnabled: modelProfile.supportsTools !== false,
      requestAgentCompletion,
      onStreamChunk: null,
      runStartedAt: Date.now(),
      effectivePersonalization: { applied: [], omitted: [] },
      ctxBundle: {
        contextInfo: { workbenchAgentGraph: true, goal, sourceRoot: sourceRoot || '' },
        taskFrame: null,
      },
      loadAgentSessions,
      saveAgentSessions,
      productMemoryCapture: () => {},
      memoryDir: MEMORY_DIR,
      normalizeAssistantOutput,
      orchestration: {
        cancelAllSubRuns: ({ reason = 'parent_cancelled' } = {}) => (
          runtime.manager.cancelAllChildren(childRunId, reason)
        ),
        cancelSubRun: subRunId => runtime.manager.cancelRun(subRunId, 'parent_cancelled'),
        cancelProcessesForRun: agentProcessTools.cancelProcessesForRun,
      },
      governancePolicy: resolvedSurface.governancePolicy || runPermissions,
      budget: runtime.manager.getRun(childRunId).run?.budget || null,
      persistRunCheckpoint: checkpoint => runtime.manager.saveCheckpoint(childRunId, 'latest', checkpoint),
      cancelProcessesForRun: agentProcessTools.cancelProcessesForRun,
      recordReceipt: receipt => runtime.store.writeReceipt(
        childRunId,
        receipt.idempotencyKey || receipt.auditId || `receipt_${Date.now()}`,
        { result: receipt.envelope || receipt },
      ),
    })
    childPorts._dispose = resolvedSurface.close
    return childPorts
  }
  agentRuntimePortFactories.set(String(rootRunId), factory)
  return factory
}

const SOURCES_FILE = path.join(app.getPath('userData'), 'sources.json')
const LOGS_DIR = path.join(app.getPath('userData'), 'logs')
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

// 统一日志：主进程唯一落盘点，渲染进程通过 app-log 上报。
try {
  logger.init({
    dir: LOGS_DIR,
    level: process.env.KNOWME_LOG_LEVEL || 'info',
    mirrorConsole: process.argv.includes('--dev') || !app.isPackaged,
  })
  logger.system('app-start', 'KnowMe 主进程启动', { version: app.getVersion(), platform: process.platform })
} catch { /* logging must never crash startup */ }

const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
}

// ── 默认设置 ──────────────────────────────────────────────────────────────────
const loadSettings  = () => settingsSecure.load(SETTINGS_FILE)
const saveSettings_ = s  => settingsSecure.save(SETTINGS_FILE, s)

function loadAgentStore() {
  try {
    const raw = JSON.parse(fs.readFileSync(AGENT_SESSIONS_FILE, 'utf8'))
    return agentSessions.migrateStore(raw)
  } catch {
    return agentSessions.migrateStore({ sessions: [], ui: {} })
  }
}

/** @deprecated 兼容旧调用：仅返回 sessions 数组 */
function loadAgentSessions() {
  return loadAgentStore().sessions
}

function saveAgentStore(sessions, ui) {
  const normalized = sessions.map((s, i) => agentSessions.normalizeSession(s, i + 1))
  const nextUi = agentSessions.normalizeUi(ui, normalized)
  fs.writeFileSync(
    AGENT_SESSIONS_FILE,
    JSON.stringify({ sessions: normalized, ui: nextUi }, null, 2),
    'utf8'
  )
  return { sessions: normalized, ui: nextUi }
}

function saveAgentSessions(sessions) {
  const { ui } = loadAgentStore()
  saveAgentStore(sessions, ui)
}

function ensureAgentSession(sessionId, agentId = 'general') {
  const { sessions, ui } = loadAgentStore()
  let session = sessions.find(s => s.id === sessionId)
  if (!session) {
    session = agentSessions.createSession(agentId, sessions.filter(s => s.agentId === agentId).length + 1)
    sessions.unshift(session)
    const open = [...(ui.openSessionIds || [])]
    if (!open.includes(session.id)) open.unshift(session.id)
    saveAgentStore(sessions, { ...ui, openSessionIds: open, activeSessionId: session.id })
  }
  return { session, sessions }
}

// ── 应用图标（同一连接标志按主图、ICO 帧与 2× 托盘分别优化）────────────────
const ICON_DIR = path.join(__dirname, 'assets')
const ICON_PNG = path.join(ICON_DIR, 'icon.png')
const TRAY_ICON_PNG = path.join(ICON_DIR, 'tray-icon.png')
const ICON_ICO = path.join(ICON_DIR, 'icon.ico')
let appIconImage = null
let jumpIconPath = process.execPath
// Windows 任务栏（尤其透明无边框窗口）需要多尺寸 .ico，单尺寸 PNG 会回退到系统默认图标。
// 以内容寻址路径释放到 userData（asar 外），同时避开 Windows 任务栏的旧路径图标缓存。
let winIcoPath = null

function getAppIconImage() {
  if (!appIconImage || appIconImage.isEmpty()) {
    if (process.platform === 'win32' && winIcoPath && fs.existsSync(winIcoPath)) {
      appIconImage = nativeImage.createFromPath(winIcoPath)
    }
    if (!appIconImage || appIconImage.isEmpty()) {
      appIconImage = nativeImage.createFromPath(ICON_PNG)
    }
    if (!appIconImage || appIconImage.isEmpty()) {
      appIconImage = nativeImage.createFromPath(process.execPath)
    }
  }
  return appIconImage
}

/** BrowserWindow icon：win32 传 .ico 路径让系统按 DPI 选多尺寸表示；其它场景仍用 nativeImage。 */
function getWindowIconOption() {
  if (process.platform === 'win32' && winIcoPath && fs.existsSync(winIcoPath)) {
    return winIcoPath
  }
  return getAppIconImage()
}

function ensureBrandIcons() {
  try {
    if (!fs.existsSync(ICON_PNG)) throw new Error(`Missing brand icon: ${ICON_PNG}`)
    const userData = app.getPath('userData')
    if (process.platform === 'win32') {
      if (!fs.existsSync(ICON_ICO)) throw new Error(`Missing Windows brand icon: ${ICON_ICO}`)
      const ico = materializeWindowsIcon(ICON_ICO, userData)
      winIcoPath = ico
      appIconImage = null
      jumpIconPath = ico
    } else {
      jumpIconPath = ICON_PNG
    }
  } catch {
    jumpIconPath = fs.existsSync(ICON_PNG) ? ICON_PNG : process.execPath
  }
}

const makeTrayIcon = () => {
  let icon = null
  if (process.platform === 'win32' && fs.existsSync(TRAY_ICON_PNG)) {
    try {
      // 32 physical pixels presented as 16 DIP: stays sharp at 125%/150% scaling.
      icon = nativeImage.createFromBuffer(fs.readFileSync(TRAY_ICON_PNG), { scaleFactor: 2 })
    } catch { /* fall through to path loading */ }
  }
  if (!icon || icon.isEmpty()) icon = nativeImage.createFromPath(TRAY_ICON_PNG)
  if (!icon.isEmpty()) {
    if (process.platform === 'win32') return icon
    return icon.resize({ width: 32, height: 32, quality: 'best' })
  }
  // 托盘图缺失时回退到主图标，避免系统托盘变成空白占位。
  if (process.platform === 'win32') {
    const ico = nativeImage.createFromPath(ICON_ICO)
    if (!ico.isEmpty()) return ico.resize({ width: 16, height: 16, quality: 'best' })
  }
  const appIcon = getAppIconImage()
  if (appIcon && !appIcon.isEmpty()) {
    if (process.platform === 'win32') return appIcon.resize({ width: 16, height: 16, quality: 'best' })
    return appIcon.resize({ width: 32, height: 32, quality: 'best' })
  }
  return nativeImage.createEmpty()
}

// ── 状态 ─────────────────────────────────────────────────────────────────────
const noteWins   = new Map()
const delPending = new Set()
let tray = null, settingsWin = null, listWin = null, memoryWin = null, workspaceWin = null, logViewerWin = null
const taskbarHooked = new WeakSet()
const APP_DISPLAY_NAME = 'KnowMe'
let isQuitting = false
/** 最近一次用户有意关闭（隐藏）的便签，供托盘「继续编辑」 */
let lastClosedNoteId = null

function noteLabelForMenu(n) {
  if (!n) return '未命名'
  const title = (n.project || '').trim()
  if (title) return title.slice(0, 28)
  const line = (n.content || '').split('\n')[0].trim()
  return (line || '未命名').slice(0, 28)
}

function hasOtherVisibleNotes(exceptId) {
  for (const [id, w] of noteWins) {
    if (exceptId && id === exceptId) continue
    if (w && !w.isDestroyed() && w.isVisible()) return true
  }
  return false
}

function sendListHighlight(noteId) {
  if (!listWin || listWin.isDestroyed() || !noteId) return
  const push = () => {
    if (!listWin || listWin.isDestroyed()) return
    listWin.webContents.send('init-list', loadAllNotes())
    listWin.webContents.send('list-highlight', noteId)
  }
  if (listWin.webContents.isLoading()) {
    listWin.webContents.once('did-finish-load', push)
  } else {
    push()
  }
}

/** 用户关闭单张便签后的续编路径（隐藏全部 / 退出不走这里） */
function resumeAfterNoteHide(noteId) {
  if (!noteId || delPending.has(noteId)) return
  const n = readNote(noteId)
  if (!n || isNoteEmpty(n)) {
    if (lastClosedNoteId === noteId) lastClosedNoteId = null
    updateTray()
    return
  }
  lastClosedNoteId = noteId
  updateTray()
  if (hasOtherVisibleNotes(noteId)) return
  toggleListWin(true)
  setImmediate(() => sendListHighlight(noteId))
}

function isAnyWindowVisible() {
  const wins = [workspaceWin, settingsWin, listWin, ...noteWins.values()]
  return wins.some(w => w && !w.isDestroyed() && w.isVisible())
}

function restoreAppWindows() {
  if (workspaceWin && !workspaceWin.isDestroyed()) {
    if (!workspaceWin.isVisible()) workspaceWin.show()
    workspaceWin.focus()
    return
  }
  if (settingsWin && !settingsWin.isDestroyed() && settingsWin.isVisible()) {
    bringSettingsToFront()
    return
  }
  createWorkspaceWindow()
}

/** 顶栏「最小化到托盘」：隐藏全部窗口，恢复时优先打开该编辑窗 */
function minimizeNoteToTray(noteId) {
  if (noteId && readNote(noteId)) {
    lastClosedNoteId = noteId
    updateTray()
  }
  hideAllWindows()
  updateTaskbarAnchor()
}

function hideAllWindows() {
  if (workspaceWin && !workspaceWin.isDestroyed()) workspaceWin.hide()
  noteWins.forEach(w => { if (!w.isDestroyed()) w.hide() })
  if (listWin && !listWin.isDestroyed()) listWin.hide()
  if (settingsWin && !settingsWin.isDestroyed()) settingsWin.hide()
  if (memoryWin && !memoryWin.isDestroyed()) memoryWin.hide()
  updateTray()
}

function toggleAppVisibility() {
  if (isAnyWindowVisible()) hideAllWindows()
  else restoreAppWindows()
}

function requestAppQuit() {
  isQuitting = true
  app.quit()
}

function hookTaskbarRestore(win) {
  if (process.platform !== 'win32' || !win || win.isDestroyed() || taskbarHooked.has(win)) return
  taskbarHooked.add(win)
  // WM_INITMENU — 任务栏图标被点击时触发（窗口处于 hide 状态时）
  win.hookWindowMessage(278, () => {
    if (!win.isDestroyed() && !isAnyWindowVisible()) restoreAppWindows()
  })
}

function updateTaskbarAnchor() {
  const notes = loadAllNotes()
  let anchor = null
  const visibleList = listWin && !listWin.isDestroyed() && listWin.isVisible() ? listWin : null
  const visibleNotes = [...noteWins.values()].filter(w => !w.isDestroyed() && w.isVisible())

  if (visibleList) anchor = listWin
  else if (visibleNotes.length === 1) anchor = visibleNotes[0]
  else if (listWin && !listWin.isDestroyed() && notes.length > 1) anchor = listWin
  else if (notes.length === 1) anchor = noteWins.get(notes[0].id) || null
  else if (noteWins.size === 1) anchor = [...noteWins.values()][0]

  noteWins.forEach(w => { if (!w.isDestroyed()) w.setSkipTaskbar(w !== anchor) })
  if (listWin && !listWin.isDestroyed()) listWin.setSkipTaskbar(listWin !== anchor)
  if (anchor && !anchor.isDestroyed()) {
    // 透明无边框窗口在任务栏偶发回退到默认图标，显式重设品牌图标
    try { anchor.setIcon(getAppIconImage()) } catch { /* noop */ }
    hookTaskbarRestore(anchor)
  }
}

function clampNoteToWorkArea(note) {
  const displays = screen.getAllDisplays()
  const primary = screen.getPrimaryDisplay()
  const fallback = {
    x: primary.workArea.x + Math.round(primary.workArea.width * 0.18),
    y: primary.workArea.y + Math.round(primary.workArea.height * 0.14),
  }
  let x = Number.isFinite(note?.x) ? note.x : fallback.x
  let y = Number.isFinite(note?.y) ? note.y : fallback.y
  const w = Number.isFinite(note?.w) ? note.w : 360
  const h = Number.isFinite(note?.h) ? note.h : 490
  const target = displays.find(d => {
    const wa = d.workArea
    return x >= wa.x && x <= wa.x + wa.width && y >= wa.y && y <= wa.y + wa.height
  }) || primary
  const wa = target.workArea
  const maxX = wa.x + Math.max(0, wa.width - Math.min(w, wa.width))
  const maxY = wa.y + Math.max(0, wa.height - Math.min(h, wa.height))
  const clampedX = Math.min(Math.max(x, wa.x), maxX)
  const clampedY = Math.min(Math.max(y, wa.y), maxY)
  return {
    x: Math.round(clampedX),
    y: Math.round(clampedY),
    changed: Math.round(clampedX) !== x || Math.round(clampedY) !== y,
  }
}

function loadRecentIds() {
  try {
    const data = JSON.parse(fs.readFileSync(RECENT_FILE, 'utf8'))
    return Array.isArray(data.ids) ? data.ids : []
  } catch { return [] }
}

function saveRecentIds(ids) {
  fs.writeFileSync(RECENT_FILE, JSON.stringify({ ids: ids.slice(0, 12) }), 'utf8')
}

function getRecentNotes() {
  const map = new Map(loadAllNotes().map(n => [n.id, n]))
  const ids = loadRecentIds()
  const ordered = ids.map(id => map.get(id)).filter(Boolean)
  if (ordered.length) return ordered
  return loadAllNotes().slice(0, 8)
}

function touchRecentNote(id) {
  if (!id || !readNote(id)) return
  const ids = loadRecentIds().filter(x => x !== id)
  ids.unshift(id)
  saveRecentIds(ids)
}

function jumpListArgs(extra) {
  return process.defaultApp ? `. ${extra}` : extra
}

function parseLaunchArgs(argv) {
  const args = (argv || process.argv).filter(a => typeof a === 'string')
  const openArg = args.find(a => a.startsWith('--open-note='))
  if (openArg) return { action: 'open-note', id: openArg.slice('--open-note='.length) }
  if (args.includes('--new-note')) return { action: 'new-note' }
  if (args.includes('--open-list')) return { action: 'open-list' }
  return null
}

function handleLaunchArgs(argv) {
  const launch = parseLaunchArgs(argv)
  if (!launch) return false
  if (launch.action === 'open-note' && launch.id) { showNote(launch.id); return true }
  if (launch.action === 'new-note') { newNote(); return true }
  if (launch.action === 'open-list') { createWorkspaceWindow(); return true }
  return false
}

function updateJumpList() {
  if (process.platform !== 'win32') return
  const iconPath = jumpIconPath
  const recentItems = getRecentNotes().slice(0, 8).map(n => ({
    type: 'task',
    title: ((n.title || n.project || '').trim() || '未命名').slice(0, 64),
    description: (n.content?.split('\n')[0]?.trim() || '(空)').slice(0, 128),
    program: process.execPath,
    args: jumpListArgs(`--open-note=${n.id}`),
    iconPath,
    iconIndex: 0,
  }))
  const categories = []
  if (recentItems.length) {
    categories.push({ type: 'custom', name: '最近使用', items: recentItems })
  }
  categories.push({
    type: 'tasks',
    items: [
      { type: 'task', title: '新建文件', program: process.execPath, args: jumpListArgs('--new-note'), iconPath, iconIndex: 0 },
      { type: 'task', title: '显示工作台', program: process.execPath, args: jumpListArgs('--open-list'), iconPath, iconIndex: 0 },
    ],
  })
  try { app.setJumpList(categories) } catch {}
}

// ── 持久化 ────────────────────────────────────────────────────────────────────
const notePath     = id => noteId.resolveNoteFile(DATA_DIR, id)
const saveNote     = note => {
  if (!note || !noteId.isSafeNoteId(note.id)) return false
  const file = notePath(note.id)
  if (!file) return false
  note.updatedAt = new Date().toISOString()
  fs.writeFileSync(file, JSON.stringify(note, null, 2), 'utf8')
  return true
}
const readNote     = id => {
  const file = notePath(id)
  if (!file) return null
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return null }
}
const deleteNoteF  = id => {
  const file = notePath(id)
  if (!file) return
  try { fs.unlinkSync(file) } catch {}
}

// 空便签：无正文、无项目名、无结构化分段、未收藏 → 不值得保存
function isNoteEmpty(n) {
  if (!n) return false
  if (n.favorite) return false
  if ((n.content || '').trim()) return false
  if ((n.project || '').trim()) return false
  return true
}

// 清理无窗口打开的空便签（打开/刷新列表、启动时调用）
function purgeEmptyClosedNotes() {
  if (!fs.existsSync(DATA_DIR)) return 0
  let removed = 0
  for (const f of fs.readdirSync(DATA_DIR)) {
    if (!noteId.isSafeNoteFileName(f)) continue
    const id = f.slice(0, -'.json'.length)
    if (noteWins.has(id)) continue
    let n = null
    try { n = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8')) } catch { continue }
    if (isNoteEmpty(n)) { deleteNoteF(id); removed++ }
  }
  return removed
}

const loadAllNotes = () => {
  if (!fs.existsSync(DATA_DIR)) return []
  return fs.readdirSync(DATA_DIR).filter(f => noteId.isSafeNoteFileName(f)).map(f => {
    try {
      const n = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'))
      let dirty = false
      if (n.project   === undefined) { n.project   = '';    dirty = true }
      if (n.version   === undefined) { n.version   = '0.1'; dirty = true }
      if (n.favorite  === undefined) { n.favorite  = false; dirty = true }
      if (n.tags      === undefined) { n.tags      = [];    dirty = true }
      if (n.copyCount === undefined) { n.copyCount = 0;     dirty = true }
      if (n.projectManual === undefined) { n.projectManual = !!n.project?.trim(); dirty = true }
      // 工作台模型：title=文件名；project=项目分组；旧 category → project（仅当 project 空）
      if (n.title === undefined) {
        n.title = String(n.project || '').trim()
        const cat = String(n.category || '').trim()
        n.project = cat || ''
        dirty = true
      } else if ((n.category || '').trim() && !(n.project || '').trim()) {
        n.project = String(n.category).trim()
        dirty = true
      }
      if (promptSections.migrateNoteFields(n)) dirty = true
      if (dirty) saveNote(n)
      return n
    } catch { return null }
  }).filter(Boolean).sort((a, b) => new Date(b.updatedAt||0) - new Date(a.updatedAt||0))
}

function walkPromptFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name)
    const stat = fs.statSync(full)
    if (stat.isDirectory()) walkPromptFiles(full, acc)
    else {
      const ext = path.extname(name).toLowerCase()
      if (['.txt', '.md'].includes(ext) || !ext) acc.push(full)
    }
  }
  return acc
}

function getImportedPromptMeta(file) {
  const rel = path.relative(PROMPT_SPACE_DIR, file)
  const parts = rel.split(path.sep)
  const base = path.basename(file, path.extname(file))
  const parent = parts.length > 1 ? parts[parts.length - 2] : ''
  const versionMatch = base.match(/^v(\d+(?:\.\d+)*)/i)
  const version = versionMatch ? versionMatch[1] : '0.1'
  const name = versionMatch && parent ? parent : base
  return {
    name,
    version,
    group: parts.slice(0, -1).join('/'),
    tags: parts.slice(0, Math.max(1, parts.length - 1)).filter(Boolean),
    rel
  }
}

function importPromptSpace() {
  if (!PROMPT_SPACE_DIR || !fs.existsSync(PROMPT_SPACE_DIR)) {
    return { ok: false, error: PROMPT_SPACE_DIR
      ? `目录不存在：${PROMPT_SPACE_DIR}`
      : '未配置 STICKY_PROMPT_SPACE_DIR 环境变量' }
  }

  const existing = new Set(loadAllNotes().map(n => n.sourcePath).filter(Boolean).map(p => path.normalize(p).toLowerCase()))
  const files = walkPromptFiles(PROMPT_SPACE_DIR)
  let imported = 0, skipped = 0, failed = 0

  for (const file of files) {
    const key = path.normalize(file).toLowerCase()
    if (existing.has(key)) { skipped++; continue }
    try {
      const content = fs.readFileSync(file, 'utf8')
      const meta = getImportedPromptMeta(file)
      const id = `n_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`
      const pos = getNewNotePos(imported)
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
      }
      saveNote(note)
      existing.add(key)
      imported++
    } catch {
      failed++
    }
  }

  updateTray()
  if (listWin && !listWin.isDestroyed()) listWin.webContents.send('init-list', loadAllNotes())
  productMemory.capture(MEMORY_DIR, {
    kind: 'telemetry',
    summary: `导入 prompt_space：${imported} 张卡片`,
    meta: { action: 'import-prompt-space', imported, skipped, failed },
  })
  return { ok: true, imported, skipped, failed, total: files.length }
}

// ── 主显示器中心位置 ──────────────────────────────────────────────────────────
function getNewNotePos(idx = 0) {
  const d = screen.getPrimaryDisplay()
  const { x: wx, y: wy, width: ww, height: wh } = d.workArea
  const offset = (idx % 12) * 26
  return {
    x: wx + Math.round(ww * 0.18) + offset,
    y: wy + Math.round(wh * 0.14) + offset
  }
}

// ── 托盘菜单 ──────────────────────────────────────────────────────────────────
function updateTray() {
  if (!tray) return
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '显示工作台', click: () => { createWorkspaceWindow() } },
    { type: 'separator' },
    { label: '设置…', click: () => openSettings() },
    { type: 'separator' },
    { label: '退出', click: requestAppQuit }
  ]))
  updateJumpList()
}

// ── 便签窗口 ──────────────────────────────────────────────────────────────────
function createNoteWindow(note) {
  const pos = clampNoteToWorkArea(note)
  if (pos.changed) {
    note.x = pos.x
    note.y = pos.y
    saveNote(note)
  }
  const win = new BrowserWindow({
    x: pos.x, y: pos.y,
    width: note.w ?? 440, height: note.h ?? 580,
    minWidth: 280, minHeight: 260,
    frame: false, transparent: true,
    alwaysOnTop: note.pinned !== false,
    skipTaskbar: true, resizable: true, hasShadow: false,
    icon: getWindowIconOption(),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true }
  })
  void loadRendererEntry(win, { legacyFile: 'note.html', viteEntry: 'note', viteDevPath: '/note/' })
  win.webContents.on('did-finish-load', () => {
    const n = readNote(note.id)
    if (n) applyNoteLayout(win, n)
    win.webContents.send('init-note', n || note)
  })

  const saveGeo = () => {
    if (layoutApplying.has(win)) return
    const n = readNote(note.id); if (!n) return
    const [x,y] = win.getPosition(), [w,h] = win.getSize()
    Object.assign(n, {x,y,w,h}); saveNote(n)
  }
  win.on('moved', saveGeo); win.on('resized', saveGeo)
  win.on('show', () => {
    const n = readNote(note.id)
    if (n) applyNoteLayout(win, n)
  })
  win.on('close', e => {
    // 空便签直接删除，不落盘（含退出场景）
    if (!delPending.has(note.id) && isNoteEmpty(readNote(note.id))) {
      deleteNoteF(note.id)
      return
    }
    if (isQuitting) return
    if (!delPending.has(note.id)) {
      e.preventDefault()
      win.hide()
      resumeAfterNoteHide(note.id)
    }
  })
  win.on('closed', () => {
    noteWins.delete(note.id)
    delPending.delete(note.id)
    if (lastClosedNoteId === note.id && !readNote(note.id)) lastClosedNoteId = null
    updateTray()
  })
  noteWins.set(note.id, win)
  updateTaskbarAnchor()
  return win
}

const layoutApplying = new WeakSet()

const LAYOUT = {
  note:    { w: 440, h: 580 },
  aiSplit: { w: 1280, h: 760 },
}

function layoutSize(aiOpen) {
  return aiOpen ? LAYOUT.aiSplit : LAYOUT.note
}

function applyNoteLayout(win, n) {
  const size = layoutSize(!!n.aiOpen)
  if (win.isDestroyed()) return { ...size, aiOpen: !!n.aiOpen }
  layoutApplying.add(win)
  win.setMinimumSize(n.aiOpen ? 800 : 280, n.aiOpen ? 500 : 260)
  win.setSize(size.w, size.h, false)
  n.w = size.w
  n.h = size.h
  n.expanded = true
  saveNote(n)
  setImmediate(() => layoutApplying.delete(win))
  const state = { aiOpen: !!n.aiOpen, w: size.w, h: size.h }
  win.webContents.send('layout-changed', state)
  return state
}

function notifyWorkspaceRefresh() {
  if (workspaceWin && !workspaceWin.isDestroyed()) workspaceWin.webContents.send('workspace-refresh')
}

function notifyWorkbenchAuthChanged(auth) {
  if (!workspaceWin || workspaceWin.isDestroyed()) return
  workspaceWin.webContents.send('workbench-auth-changed', auth || null)
}

function openWorkspaceNote(noteId) {
  createWorkspaceWindow()
  const send = () => {
    if (workspaceWin && !workspaceWin.isDestroyed() && noteId) {
      workspaceWin.webContents.send('workspace-open-note', noteId)
    }
  }
  if (workspaceWin.webContents.isLoading()) workspaceWin.webContents.once('did-finish-load', send)
  else send()
}

function newNote() {
  const id = `n_${Date.now()}`
  const note = {
    id, content: '', title: '', project: '', version: '0.1', favorite: false, tags: [], copyCount: 0,
    category: '', okfTags: [], okfConceptId: null, parentNoteId: null,
    sections: null, editorMode: 'md', mdView: 'edit',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  }
  saveNote(note)
  notifyWorkspaceRefresh()
  openWorkspaceNote(id)
  updateTray()
}

function newVersion(noteId) {
  const orig = readNote(noteId); if (!orig) return
  const parts = (orig.version || '0.1').split('.').map(Number)
  parts[parts.length - 1] += 1
  const id = `n_${Date.now()}`
  const note = {
    ...orig, id,
    version: parts.join('.'),
    parentNoteId: orig.id,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  }
  saveNote(note)
  notifyWorkspaceRefresh()
  openWorkspaceNote(id)
  updateTray()
}

function duplicateNote(noteId) {
  const orig = readNote(noteId); if (!orig) return
  const id = `n_${Date.now()}`
  const note = {
    ...orig, id, favorite: false, parentNoteId: null, copyCount: 0,
    title: orig.title ? `${orig.title} 副本` : '',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  }
  saveNote(note)
  notifyWorkspaceRefresh()
  openWorkspaceNote(id)
  updateTray()
}

function showNote(id) {
  const n = readNote(id)
  if (!n) return
  touchRecentNote(id)
  openWorkspaceNote(id)
  updateJumpList()
  updateTray()
}

// ── 工作台窗口（单窗口文件编辑器）────────────────────────────────────────────
function createWorkspaceWindow() {
  if (workspaceWin && !workspaceWin.isDestroyed()) {
    if (!workspaceWin.isVisible()) workspaceWin.show()
    workspaceWin.focus()
    return workspaceWin
  }
  const d = screen.getPrimaryDisplay()
  const { width: ww, height: wh } = d.workArea
  // 窗口壳色与工作台左侧 rail 对齐（L 形 chrome：顶栏 + 侧栏同色）
  const WORKSPACE_CHROME_BG = '#ebeae7'
  const workspaceOpts = {
    width: Math.min(1280, ww - 80), height: Math.min(820, wh - 60),
    minWidth: 900, minHeight: 560, center: true,
    frame: true, autoHideMenuBar: true, backgroundColor: WORKSPACE_CHROME_BG,
    title: APP_DISPLAY_NAME,
    icon: getWindowIconOption(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      // 编辑器 pane 以 iframe 承载，需让 preload 在子框架内也注入，否则 iframe 里 window.api 为 undefined
      nodeIntegrationInSubFrames: true,
      // 右侧文档预览使用内嵌 webview 打开外链
      webviewTag: true,
    },
  }
  // Win/mac：隐藏系统标题字、客户区上延，顶栏用与侧栏相同的壳色
  if (process.platform === 'win32' || process.platform === 'darwin') {
    workspaceOpts.titleBarStyle = 'hidden'
  }
  if (process.platform === 'win32') {
    workspaceOpts.titleBarOverlay = {
      color: WORKSPACE_CHROME_BG,
      symbolColor: '#5c5c5c',
      height: 36,
    }
  }
  workspaceWin = new BrowserWindow(workspaceOpts)
  void loadRendererEntry(workspaceWin, {
    legacyFile: 'workspace.html',
    viteEntry: 'workspace',
    viteDevPath: '/workspace/',
  })
  workspaceWin.webContents.on('will-attach-webview', (event, webPreferences, params) => {
    delete webPreferences.preload
    webPreferences.nodeIntegration = false
    webPreferences.contextIsolation = true
    webPreferences.sandbox = true
    const src = String(params?.src || '')
    let protocol = ''
    try { protocol = new URL(src).protocol } catch { protocol = '' }
    if (protocol !== 'http:' && protocol !== 'https:') {
      event.preventDefault()
    }
  })
  workspaceWin.webContents.on('did-fail-load', (_event, code, desc, url, isMainFrame) => {
    if (!isMainFrame) return
    const target = String(url || 'workspace.html')
    console.error('[workspace-load-fail]', { code, desc, url: target })
    const html = [
      '<!doctype html><meta charset="utf-8">',
      '<title>KnowMe 启动失败</title>',
      '<style>body{font-family:Segoe UI,Arial,sans-serif;background:#f6f5f2;color:#1f2937;padding:24px}h1{font-size:20px;margin:0 0 10px}pre{white-space:pre-wrap;background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:12px}</style>',
      '<h1>页面加载失败</h1>',
      '<p>请重启应用；若仍失败，把下方信息发给开发同学。</p>',
      `<pre>code: ${String(code)}\ndesc: ${String(desc || 'unknown')}\nurl: ${target}</pre>`,
    ].join('')
    void workspaceWin.webContents.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  })
  workspaceWin.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const text = String(message || '')
    if (level >= 2 || text.includes('[kb-debug]') || text.includes('[settings-debug]') || text.includes('[center-surface]')) {
      console.log(`[workspace-console:${level}] ${text} (${sourceId || 'workspace'}:${line || 0})`)
    }
  })
  workspaceWin.webContents.on('render-process-gone', (_event, details) => {
    console.error('[workspace-render-gone]', details)
    if (details?.reason === 'clean-exit') return
    setTimeout(() => {
      try {
        if (!workspaceWin || workspaceWin.isDestroyed()) return
        workspaceWin.webContents.reloadIgnoringCache()
      } catch (err) {
        console.error('[workspace-render-reload-fail]', err?.message || err)
      }
    }, 280)
  })
  workspaceWin.on('close', e => {
    if (isQuitting) return
    e.preventDefault()
    workspaceWin.hide()
    updateTray()
  })
  workspaceWin.on('closed', () => { workspaceWin = null })
  return workspaceWin
}

// ── 设置窗口 ──────────────────────────────────────────────────────────────────
function bringSettingsToFront() {
  if (!settingsWin || settingsWin.isDestroyed()) return
  // 便签 / 总览默认 alwaysOnTop，设置窗必须临时抬升才能盖过它们
  settingsWin.setAlwaysOnTop(true)
  if (settingsWin.isMinimized()) settingsWin.restore()
  settingsWin.show()
  settingsWin.focus()
  settingsWin.moveTop()
}

function openSettings(tab = '') {
  // 托盘 MenuItem.click 会传入 (menuItem, browserWindow, event)，不能当 tab 用
  const tabId = typeof tab === 'string' ? tab : ''
  if (workspaceWin && !workspaceWin.isDestroyed()) {
    workspaceWin.show()
    workspaceWin.focus()
    workspaceWin.webContents.send('workspace-open-settings', tabId)
    if (settingsWin && !settingsWin.isDestroyed()) settingsWin.close()
    return
  }
  openSettingsWindow(tabId)
}

function openSettingsWindow(tab = '') {
  const tabId = typeof tab === 'string' ? tab : ''
  if (settingsWin && !settingsWin.isDestroyed()) {
    bringSettingsToFront()
    if (tabId) settingsWin.webContents.send('select-settings-tab', tabId)
    return
  }
  settingsWin = new BrowserWindow({ width:520, height:720, minWidth:480, minHeight:560,
    title:'KnowMe — 设置', center:true, resizable:true,
    frame:true, autoHideMenuBar:true, backgroundColor:'#f8f7f4',
    alwaysOnTop:true,
    icon: getWindowIconOption(),
    webPreferences: { preload: path.join(__dirname,'preload.js'), contextIsolation:true }
  })
  void loadRendererEntry(settingsWin, { legacyFile: 'settings.html', viteEntry: 'settings', viteDevPath: '/settings/' })
  settingsWin.webContents.on('did-finish-load', () => {
    settingsWin.webContents.send('init-settings', JSON.parse(JSON.stringify(settingsSecure.publicSettings(loadSettings(), { includeSecrets: true }))))
    if (tabId) settingsWin.webContents.send('select-settings-tab', tabId)
  })
  settingsWin.on('closed', () => { settingsWin = null })
  bringSettingsToFront()
}

// ── 总览面板 ──────────────────────────────────────────────────────────────────
function toggleListWin(forceShow = false) {
  if (listWin && !listWin.isDestroyed()) {
    if (forceShow) { listWin.show(); listWin.focus(); updateTaskbarAnchor(); return }
    listWin.isVisible() ? listWin.hide() : (listWin.show(), listWin.focus())
    updateTray()
    return
  }
  const d = screen.getPrimaryDisplay()
  const { x:wx, y:wy, width:ww, height:wh } = d.workArea
  listWin = new BrowserWindow({
    x: wx + ww - 580, y: wy + 50,
    width:560, height:600,
    minWidth:480, minHeight:420,
    frame:false, transparent:true,
    alwaysOnTop:true, skipTaskbar:false, resizable:true,
    icon: getWindowIconOption(),
    webPreferences: { preload: path.join(__dirname,'preload.js'), contextIsolation:true }
  })
  void loadRendererEntry(listWin, { legacyFile: 'list.html', viteEntry: 'list', viteDevPath: '/list/' })
  listWin.webContents.on('did-finish-load', () => { purgeEmptyClosedNotes(); listWin.webContents.send('init-list', loadAllNotes()) })
  listWin.on('close', e => {
    if (isQuitting) return
    e.preventDefault()
    listWin.hide()
    updateTray()
  })
  listWin.on('closed', () => { listWin = null; updateTaskbarAnchor() })
  updateTaskbarAnchor()
}

// ── 记忆面板 ──────────────────────────────────────────────────────────────────
function openMemoryPanel() {
  if (memoryWin && !memoryWin.isDestroyed()) {
    memoryWin.show()
    memoryWin.focus()
    memoryWin.webContents.send('init-memory', productMemory.getRecent(MEMORY_DIR, 50))
    return
  }
  const d = screen.getPrimaryDisplay()
  const { x:wx, y:wy, width:ww } = d.workArea
  memoryWin = new BrowserWindow({
    x: wx + ww - 440, y: wy + 80,
    width:400, height:520,
    frame:false, transparent:true,
    alwaysOnTop:true, skipTaskbar:false, resizable:true,
    icon: getWindowIconOption(),
    webPreferences: { preload: path.join(__dirname,'preload.js'), contextIsolation:true },
  })
  void loadRendererEntry(memoryWin, { legacyFile: 'memory.html', viteEntry: 'memory', viteDevPath: '/memory/' })
  memoryWin.webContents.on('did-finish-load', () => {
    memoryWin.webContents.send('init-memory', productMemory.getRecent(MEMORY_DIR, 50))
  })
  memoryWin.on('close', e => {
    if (isQuitting) return
    e.preventDefault()
    memoryWin.hide()
  })
  memoryWin.on('closed', () => { memoryWin = null })
}

// ── 日志查看窗口 ──────────────────────────────────────────────────────────────
function openLogViewer() {
  if (logViewerWin && !logViewerWin.isDestroyed()) {
    if (logViewerWin.isMinimized()) logViewerWin.restore()
    logViewerWin.show()
    logViewerWin.focus()
    return logViewerWin
  }
  const d = screen.getPrimaryDisplay()
  const { width: ww, height: wh } = d.workArea
  logViewerWin = new BrowserWindow({
    width: Math.min(1080, ww - 80), height: Math.min(760, wh - 80),
    minWidth: 760, minHeight: 480, center: true,
    frame: true, autoHideMenuBar: true, backgroundColor: '#0f1419',
    title: 'KnowMe - 日志中心',
    icon: getWindowIconOption(),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true },
  })
  logViewerWin.webContents.on('did-fail-load', (_event, code, desc, url, isMainFrame) => {
    if (!isMainFrame) return
    const message = `日志页面加载失败\ncode: ${String(code)}\ndesc: ${String(desc || 'unknown')}\nurl: ${String(url || 'log-viewer.html')}`
    console.error('[log-viewer-load-fail]', message)
    const html = [
      '<!doctype html><meta charset="utf-8">',
      '<title>KnowMe 日志中心</title>',
      '<style>body{font-family:Segoe UI,Microsoft YaHei,sans-serif;background:#0e1420;color:#e7edf7;padding:28px}h1{font-size:20px}pre{white-space:pre-wrap;background:#161f2e;border:1px solid #2b3951;border-radius:8px;padding:14px;color:#f4b549}</style>',
      '<h1>日志中心加载失败</h1>',
      '<p>日志文件仍然保存在 KnowMe\\logs 目录。</p>',
      `<pre>${message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`,
    ].join('')
    void logViewerWin.webContents.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  })
  logViewerWin.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    if (level >= 2) {
      console.error(`[log-viewer-console:${level}] ${String(message || '')} (${sourceId || 'log-viewer'}:${line || 0})`)
    }
  })
  logViewerWin.webContents.on('render-process-gone', (_event, details) => {
    console.error('[log-viewer-render-gone]', details)
  })
  void loadRendererEntry(logViewerWin, {
    legacyFile: 'log-viewer.html',
    viteEntry: 'log-viewer',
    viteDevPath: '/log-viewer/',
  })
  logViewerWin.on('closed', () => { logViewerWin = null })
  logger.operation('open-log-viewer', '打开日志中心窗口')
  return logViewerWin
}

// ── IPC（notes CRUD → src/ipc/notes.js via registerCoreIpc）───────────────────
// ── 工作台 IPC ────────────────────────────────────────────────────────────────

function workspaceNoteBrief(n) {
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
  }
}

function groupNotesByProject(notes) {
  const groups = new Map()
  for (const n of notes) {
    const key = (n.project || '').trim() || '__uncat__'
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: key === '__uncat__' ? '未分类' : key,
        items: [],
      })
    }
    groups.get(key).items.push(workspaceNoteBrief(n))
  }
  return [...groups.values()].sort((a, b) => {
    if (a.key === '__uncat__') return 1
    if (b.key === '__uncat__') return -1
    return String(a.label).localeCompare(String(b.label), 'zh-CN')
  })
}

function loadSourcesStore() {
  return sourcesLib.loadStore(SOURCES_FILE)
}

function saveSourcesStore(store) {
  return sourcesLib.saveStore(SOURCES_FILE, store)
}

function findSource(id) {
  return loadSourcesStore().sources.find(s => s.id === id) || null
}

registerCoreIpc(ipcMain, {
  BrowserWindow,
  dialog,
  shell,
  app,
  path,
  sourcesLib,
  gitlabSource,
  webSource,
  loadSourcesStore,
  saveSourcesStore,
  findSource,
  loadSettings,
  saveSettings_,
  notifyWorkspaceRefresh,
  getSettingsWin: () => settingsWin,
  settingsSecure,
  normalizeRemoteConfig,
  createRemoteConfigClient,
  mergeOrgPublicConfig,
  llmModelCatalog,
  DATA_DIR,
  KNOWLEDGE_DIR,
  MEMORY_DIR,
  productKnowledge,
  productMemory,
  notesBackup,
  contextCache,
  showOpenDialogFor,
  updateTray,
  knowledgeOs,
  llmwikiService,
  obsidianBridge,
  fabricGovernance,
  knowledgeStewardStore,
  agentRun,
  kosSourcesCtx,
  ensureFabricSeeded,
  loadAgentStore,
  saveAgentStore,
  fabricGraph,
  fabricWeave,
  fabricRetrieval,
  qmdEngine,
  knowledgeProvider,
  listProvidersRedacted,
  encProviderKey,
  buildFabricCtx,
  resolveActiveProvider,
  listRegistryProviders,
  getConnectorsApi,
  feishuAuth,
  feishuCli,
  toolDraftsStore,
  resolveTestSeamOpts,
  connectorToolRuntime,
  getActiveSourceRoot,
  fileBackup,
  getWorkbenchDaemonClient,
  publicWorkbenchAuthStatus,
  workbenchAuth,
  notifyWorkbenchAuthChanged,
  getWorkbenchTodoStore,
  getWorkbenchTaskDraftStore,
  getWorkbenchTaskStore,
  getWorkbenchWorkflowPackageStore,
  getWorkbenchContextStore,
  getWorkbenchLaunchStores,
  buildWorkbenchLaunchFacts,
  resolveLaunchPackageItem,
  workbenchLaunchController,
  refreshWorkbenchModeProjections,
  getWorkbenchModeStore,
  modeNameFromDto,
  isExpertAvailableForWorkbench,
  getWorkbenchAutomationStore,
  ensureFeishuConnectorReady,
  toTargetItems,
  fs,
  loadWorkbenchDaemonOverview,
  workbenchDaemon,
  workbenchBootstrap,
  workbenchRepo,
  workbenchModel,
  projectDaemonTask,
  listLocalWorkbenchAgents,
  buildVerticalPipelineFactsInput,
  buildWorkflowShelf,
  buildWorkbenchConsoleProjection,
  attachWorkflowDefinitions,
  ensureOfficialWorkflowExperts,
  readJsonSafe,
  readTextSafe,
  crypto,
  https,
  http,
  compileWorkbenchAgentGraphPayload,
  workbenchAgentGraph,
  resolveWorkbenchAgentPackage,
  ensureCapabilityHub,
  ensureAgentTeamRuntime,
  getAgentTeamRuntime: () => agentTeamRuntime,
  workbenchAgentRunControllers,
  workbenchAgentRunEvents,
  createWorkbenchAgentPortFactory,
  agentRuntimePortFactories,
  getWorkbenchAgentTeamRunner,
  workbenchAgentGateWaiters,
  agentArtifactTools,
  workbenchAgentEventList,
  normalizeChatEndpoint,
  parseSseLines,
  extractChatText,
  noteId,
  noteVersions,
  noteDiff,
  readNote,
  saveNote,
  deleteNoteF,
  loadAllNotes,
  newNote,
  newVersion,
  duplicateNote,
  noteWins,
  delPending,
  resumeAfterNoteHide,
  clearLastClosedIf: (id) => { if (lastClosedNoteId === id) lastClosedNoteId = null },
  getListWin: () => listWin,
  noteClassify,
  chatCompletionOnce,
  ensureCapabilityPackRuntime,
  gameStudio,
  gameRequirement,
  gameWorkbenchHandoff,
  getAgentProfileStore,
  agentSessions,
  agentSandbox,
  openSettings,
  openSettingsWindow,
  importPromptSpace,
  PROMPT_SPACE_DIR,
  clipboard,
  logger,
  openLogViewer,
  LOGS_DIR,
  checkForUpdatesManual,
  SOURCES_FILE,
  workspaceNoteBrief,
  groupNotesByProject,
  applyNoteLayout,
  Menu,
  showNote,
  updateTaskbarAnchor,
  activeAgentRuns,
  cleanSuggestedTitle,
  localTitleFromParagraph,
  ensureAgentSession,
  saveAgentSessions,
  loadAgentSessions,
  buildEmbedFn,
  normalizeChatEndpoint,
  requestAgentCompletion,
  buildMissingResourceHint,
  getFeishuGroundingContext,
  hasPriorFeishuFacts,
  agentRuntimePortFactories,
  buildActiveSourceFileTools,
  agentRuntimeOutputBridges,
  screen,
  getWorkspaceWin: () => workspaceWin,
  createWorkspaceWindow,
  getWindowIconOption,
})

// 语义索引缓存：cacheKey(root+embed profile) -> { stamp, index }，按目录 mtime 失效，进程内有界。
const semanticIndexCache = new Map()
const SEMANTIC_INDEX_MAX_ROOTS = 8
const SEMANTIC_INDEX_DISK_MAX_FILES = 32

function hashKey(text = '') {
  return crypto.createHash('sha1').update(String(text)).digest('hex')
}

function semanticDiskCacheFile(cacheKey) {
  const name = `${hashKey(cacheKey)}.json`
  return path.join(SEMANTIC_INDEX_CACHE_DIR, name)
}

function loadSemanticIndexFromDisk(cacheKey, stamp) {
  try {
    const file = semanticDiskCacheFile(cacheKey)
    if (!fs.existsSync(file)) return null
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (!raw || raw.stamp !== stamp || !raw.index) return null
    return raw.index
  } catch {
    return null
  }
}

function saveSemanticIndexToDisk(cacheKey, stamp, index) {
  try {
    fs.mkdirSync(SEMANTIC_INDEX_CACHE_DIR, { recursive: true })
    const file = semanticDiskCacheFile(cacheKey)
    fs.writeFileSync(file, JSON.stringify({
      stamp,
      index,
      savedAt: new Date().toISOString(),
    }), 'utf8')
    const files = fs.readdirSync(SEMANTIC_INDEX_CACHE_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => ({
        name: f,
        full: path.join(SEMANTIC_INDEX_CACHE_DIR, f),
        mtime: (() => {
          try { return fs.statSync(path.join(SEMANTIC_INDEX_CACHE_DIR, f)).mtimeMs } catch { return 0 }
        })(),
      }))
      .sort((a, b) => b.mtime - a.mtime)
    for (const stale of files.slice(SEMANTIC_INDEX_DISK_MAX_FILES)) {
      try { fs.unlinkSync(stale.full) } catch { /* ignore */ }
    }
  } catch {
    // 磁盘缓存失败不影响主流程
  }
}

/**
 * 基于当前活跃内容源构建 Agent 文件工具（read_file / list_dir / grep_files）。
 * 提供 embed 时额外投影 semantic_search（向量语义检索）。
 * 无活跃源时返回 null（不投影文件工具）。全部经 sources.js 路径安全校验。
 */
function decodeWorkspaceFsTabId(id) {
  const raw = String(id || '')
  if (!raw.startsWith('fs:')) return null
  const rest = raw.slice(3)
  const sep = rest.indexOf(':')
  if (sep <= 0) return null
  return { sourceId: rest.slice(0, sep), relPath: rest.slice(sep + 1) }
}

/**
 * 从 workspaceState 提取“活跃/最近打开”的内容源文件权重：
 * - active fs tab 权重更高
 * - 其他 fs tabs 按新近顺序衰减
 */
function buildRecentSourceFileWeights(workspaceState = {}, activeSourceId = '') {
  const map = new Map()
  const st = workspaceState && typeof workspaceState === 'object' ? workspaceState : {}
  const panes = [st.left, st.right].filter(Boolean)
  const activeIds = panes.map((p) => p.active).filter(Boolean)
  for (const id of activeIds) {
    const decoded = decodeWorkspaceFsTabId(id)
    if (!decoded) continue
    if (activeSourceId && decoded.sourceId !== activeSourceId) continue
    map.set(decoded.relPath, Math.max(map.get(decoded.relPath) || 1, 1.35))
  }
  for (const pane of panes) {
    const tabs = Array.isArray(pane.tabs) ? pane.tabs : []
    const fsTabs = tabs.map(decodeWorkspaceFsTabId).filter(Boolean)
      .filter((x) => !activeSourceId || x.sourceId === activeSourceId)
    const maxN = Math.max(1, fsTabs.length)
    fsTabs.forEach((tab, i) => {
      const recency = 1.2 - (i / maxN) * 0.25
      map.set(tab.relPath, Math.max(map.get(tab.relPath) || 1, recency))
    })
  }
  return map
}

/** 合并多组 { definitions, handlers } 额外工具，name 冲突时先注册者优先。 */
// mergeExtraTools → src/lib/merge-extra-tools.js

function getActiveSourceRoot() {
  const store = loadSourcesStore()
  const active = store.sources.find(s => s.id === store.activeSourceId) || store.sources[0]
  return active?.rootPath || null
}

function buildActiveSourceFileTools(embed, opts = {}) {
  const store = loadSourcesStore()
  const active = store.sources.find(s => s.id === store.activeSourceId)
    || store.sources[0]
    || null
  if (!active?.rootPath) return null
  const root = active.rootPath
  const runId = opts.runId || 'unknown'
  const userData = app.getPath('userData')
  const recentWeights = buildRecentSourceFileWeights(opts.workspaceState, active.id)
  // grep 索引缓存：文件清单按根目录 mtime 缓存（短 TTL），内容走 mtime 校验的读缓存，
  // 避免每次 grep 重新遍历目录树 + 全量重读文件。
  const rootStamp = () => contextCache.statMtimeMs(root)
  const listFiles = () => contextCache.cached(
    `grepindex:${root}`,
    rootStamp(),
    () => (sourcesLib.listTree(root, {}).nodes || [])
      .filter((n) => n.type === 'file')
      .map((n) => ({ ...n, weight: recentWeights.get(n.path) || 1 })),
  )
  const readCached = (rel) => {
    const abs = sourcesLib.resolveUnderRoot(root, rel)
    return abs ? contextCache.readFileCached(abs) : null
  }
  const writeAdapter = fileBackup.buildFileWriteAdapter(root, sourcesLib, {
    runId,
    rememberDraft: (draft) => toolDraftsStore.rememberDraft(userData, draft),
  })
  const adapter = {
    ...writeAdapter,
    grep: (query) => agentFileTools.grepFiles(query, {
      files: listFiles(),
      readFile: readCached,
      maxMatches: agentFileTools.MAX_GREP_MATCHES,
    }),
  }
  const includeWrite = isToolSurfaceV1()
  const base = agentFileTools.buildFileTools(adapter, { includeWrite })
  base.fileAdapter = writeAdapter
  base.sourceRoot = root

  // 语义检索工具：仅在提供 embed（用户启用向量重排/embeddings）时投影。
  if (typeof embed === 'function') {
    const cacheKey = `semantic:${root}:${String(embed.cacheKey || 'default')}`
    const getIndex = async () => {
      const stamp = rootStamp()
      const cached = semanticIndexCache.get(cacheKey)
      if (cached && cached.stamp === stamp) {
        if (opts.runMetrics) opts.runMetrics.semanticIndexMemoryHit = (opts.runMetrics.semanticIndexMemoryHit || 0) + 1
        return cached.index
      }
      const disk = loadSemanticIndexFromDisk(cacheKey, stamp)
      if (disk) {
        semanticIndexCache.set(cacheKey, { stamp, index: disk })
        if (opts.runMetrics) opts.runMetrics.semanticIndexDiskHit = (opts.runMetrics.semanticIndexDiskHit || 0) + 1
        return disk
      }
      const buildStartedAt = Date.now()
      const index = await semanticIndex.buildEmbeddedIndex({
        files: listFiles(),
        readFile: readCached,
        embed,
        maxChunks: semanticIndex.DEFAULT_MAX_CHUNKS,
      })
      if (opts.runMetrics) {
        opts.runMetrics.semanticIndexBuildMs = Date.now() - buildStartedAt
        opts.runMetrics.semanticIndexChunkCount = Array.isArray(index?.chunks) ? index.chunks.length : 0
      }
      semanticIndexCache.set(cacheKey, { stamp, index })
      saveSemanticIndexToDisk(cacheKey, stamp, index)
      while (semanticIndexCache.size > SEMANTIC_INDEX_MAX_ROOTS) {
        semanticIndexCache.delete(semanticIndexCache.keys().next().value)
      }
      return index
    }
    base.definitions = base.definitions.concat(semanticIndex.SEMANTIC_SEARCH_DEF)
    base.handlers.semantic_search = async (args = {}) => {
      const q = String(args.query || '').trim()
      if (!q) return { ok: false, code: 'invalid_args', text: 'semantic_search 需要非空 query' }
      try {
        const queryStartedAt = Date.now()
        const index = await getIndex()
        const detailed = await semanticIndex.queryDetailed(index, embed, q, {
          topK: semanticIndex.DEFAULT_TOPK,
          maxPerFile: semanticIndex.DEFAULT_MAX_PER_FILE,
        })
        const hits = detailed.hits || []
        const meta = {
          ...(detailed.meta || {}),
          queryMs: Date.now() - queryStartedAt,
          hitCount: hits.length,
        }
        if (opts.runMetrics) {
          opts.runMetrics.semanticQueryMs = meta.queryMs
          opts.runMetrics.semanticHitCount = meta.hitCount
          opts.runMetrics.semanticDedupeDropped = Number(meta.droppedDedup || 0)
          opts.runMetrics.semanticClusterCount = Number(meta.clusterCount || 0)
        }
        return { ok: true, text: semanticIndex.formatSemanticMatches(q, hits), meta }
      } catch (err) {
        return { ok: false, code: 'semantic_failed', text: `语义检索失败：${String(err?.message || err).slice(0, 200)}` }
      }
    }
  }
  return base
}

// Agent Session：会话由主进程持久化 → src/ipc/agent-session.js

function kosSourcesCtx() {
  try {
    return sourcesLib.loadStore(SOURCES_FILE)
  } catch {
    return { sources: [] }
  }
}

function listRegistryProviders() {
  const cfg = knowledgeOs.loadConfig(app.getPath('userData'))
  const { providers } = listProvidersRedacted()
  return providers.map(p => knowledgeProvider.normalizeProvider(
    p.id === 'local-default' ? localDefaultProvider() : p
  ))
}

function wikiDocsForFabric(userData) {
  const list = knowledgeOs.listEntries(userData, kosSourcesCtx())
  const wikiRoot = knowledgeOs.resolveWikiRoot(userData, kosSourcesCtx())
  const docs = []
  for (const e of list.wiki || []) {
    const abs = path.join(wikiRoot, e.path)
    let content = ''
    try { content = fs.readFileSync(abs, 'utf8') } catch { content = e.title || '' }
    docs.push({ title: e.title, path: e.path, content })
  }
  return docs
}

function buildFabricCtx(extra = {}) {
  const userData = app.getPath('userData')
  const providers = listRegistryProviders()
  const s = loadSettings()
  return {
    userData,
    providers,
    wikiDocs: wikiDocsForFabric(userData),
    embed: buildEmbedFn(s),
    ...kosSourcesCtx(),
    fabricSearch: (ud, q, ctx) => fabricRetrieval.fabricSearch(ud, q, ctx),
    queryProvider: (def, q, ctx) => knowledgeProvider.queryProvider(def, q, {
      ...ctx,
      useFabric: false,
    }),
    loadKbDocs: async (provider) => {
      const extracted = fabricWeave.extractAnchors(userData, provider, kosSourcesCtx())
      if (!extracted.ok) return []
      return extracted.anchors.map(a => ({
        title: a.title,
        path: a.extRef || a.id,
        content: `${a.title}\n${a.summary || ''}`,
      }))
    },
    readWiki: (rel) => knowledgeOs.readEntry(userData, 'wiki', rel, kosSourcesCtx()),
    resolveRef: (ref) => fabricRetrieval.kbGet(userData, ref, {
      readWiki: rel => knowledgeOs.readEntry(userData, 'wiki', rel, kosSourcesCtx()),
    }),
    ...extra,
  }
}

function ensureFabricSeeded(userData) {
  fabricGraph.ensureFabric(userData)
  const graph = fabricGraph.loadGraph(userData)
  if ((graph.nodes || []).length) return
  const list = knowledgeOs.listEntries(userData, kosSourcesCtx())
  const seedEntries = [...(list.wiki || []), ...(list.okf || [])].map(e => ({
    path: e.path,
    title: e.title,
    kind: e.kind,
  }))
  fabricGraph.seedConceptsFromEntries(userData, seedEntries, { authority: 2 })
}

// ── 知识库 Provider：本地 / 远程 RAG ───────────────────────────────
function encProviderKey(plain) {
  if (!plain) return null
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.encryptString(String(plain)).toString('base64')
    }
  } catch { /* ignore */ }
  return null
}
function decProviderKey(encB64) {
  if (!encB64) return ''
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(Buffer.from(encB64, 'base64')).toString('utf8')
    }
  } catch { /* ignore */ }
  return ''
}

// 本地默认 provider（不落库，随本地 Wiki 绑定）
function localDefaultProvider() {
  const cfg = knowledgeOs.loadConfig(app.getPath('userData'))
  return knowledgeProvider.normalizeProvider({
    ...knowledgeProvider.defaultPersonalProvider({
      spaceSourceId: cfg.spaceSourceId || null,
      subDir: cfg.subDir || '',
    }),
    id: 'local-default',
    displayName: '我的知识',
  })
}

function listProvidersRedacted() {
  const cfg = knowledgeOs.loadConfig(app.getPath('userData'))
  const stored = Array.isArray(cfg.providers) ? cfg.providers : []
  const providers = [localDefaultProvider(), ...stored].map((p) =>
    knowledgeProvider.redactProvider(p)
  )
  const activeProviderId = cfg.activeProviderId || 'local-default'
  return { providers, activeProviderId }
}

// 取活跃 provider 定义（remote 的 apiKey 解密为明文，仅内存使用）
function resolveActiveProvider() {
  const cfg = knowledgeOs.loadConfig(app.getPath('userData'))
  const activeId = cfg.activeProviderId || 'local-default'
  if (activeId === 'local-default') return localDefaultProvider()
  const stored = (Array.isArray(cfg.providers) ? cfg.providers : []).find((p) => p.id === activeId)
  if (!stored) return localDefaultProvider()
  if (stored.kind === 'remote-rag') {
    return { ...stored, apiKey: decProviderKey(stored.apiKeyEnc) }
  }
  return stored
}

function resolveProviderById(id) {
  const providerId = String(id || '').trim()
  if (!providerId || providerId === 'local-default') return localDefaultProvider()
  const cfg = knowledgeOs.loadConfig(app.getPath('userData'))
  const stored = (Array.isArray(cfg.providers) ? cfg.providers : []).find((p) => p.id === providerId)
  if (!stored) return null
  if (stored.kind === 'remote-rag') {
    return { ...stored, apiKey: decProviderKey(stored.apiKeyEnc) }
  }
  return knowledgeProvider.normalizeProvider(stored)
}

// ── Workbench：读取当前激活 Git 仓库（只读） ───────────────────────────────────
function readJsonSafe(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return null }
}

function readTextSafe(file) {
  try { return fs.readFileSync(file, 'utf8') } catch { return '' }
}

function loadWorkbenchAgents(repo) {
  if (!repo || !repo.ok) return []
  const { root, agentsDir } = repo
  const registry = readJsonSafe(path.join(root, 'tools', 'workflow_runner', 'agents_registry.json'))
  let agentEntries = []
  if (registry && Array.isArray(registry.agents)) {
    agentEntries = registry.agents.map(a => ({ id: a.id, title: a.title, rel: a.path }))
  } else if (fs.existsSync(agentsDir)) {
    try {
      agentEntries = fs.readdirSync(agentsDir, { withFileTypes: true })
        .filter(d => d.isDirectory() && !d.name.startsWith('_'))
        .map(d => ({ id: d.name, title: d.name, rel: `.cursor/agents/${d.name}` }))
    } catch { agentEntries = [] }
  }
  const agents = []
  for (const entry of agentEntries) {
    const dir = workbenchRepo.resolveAgentDir(root, entry.rel, entry.id)
    if (!dir) continue
    const manifest = readJsonSafe(path.join(dir, 'agent.manifest.json'))
    const fm = workbenchModel.parseAgentFrontmatter(readTextSafe(path.join(dir, 'AGENT.md')))
    if (!manifest && !fm.description) continue
    const agent = workbenchModel.parseAgentManifest(manifest || { id: entry.id, title: entry.title }, {
      id: entry.id,
      title: entry.title,
      description: fm.description,
      path: entry.rel || '',
    })
    if (!agent.persona.role && fm.persona.role) agent.persona.role = fm.persona.role
    if (!agent.model && fm.model) agent.model = fm.model
    agents.push(agent)
  }
  return agents
}

function loadWorkflowDefinition(repo, workflowId, options = {}) {
  if (!repo || !repo.ok || !workflowId) return null
  const explicitPath = String(options.path || options.workflowPath || '').trim()
  if (explicitPath) {
    const file = workbenchRepo.resolveWorkflowFile(repo.root, explicitPath)
    if (file) {
      const json = readJsonSafe(file)
      if (json) {
        return workbenchModel.parseWorkflow(json, {
          id: workflowId,
          name: options.name || workflowId,
          description: options.description || '',
          tags: options.tags,
          path: explicitPath,
        })
      }
    }
  }
  const wfIndex = readJsonSafe(path.join(repo.workflowsDir, 'index.json'))
  const entry = wfIndex && Array.isArray(wfIndex.workflows)
    ? wfIndex.workflows.find(w => w.id === workflowId)
    : null
  if (!entry || !entry.path) return null
  const file = workbenchRepo.resolveWorkflowFile(repo.root, entry.path)
  if (!file) return null
  const json = readJsonSafe(file)
  if (!json) return null
  return workbenchModel.parseWorkflow(json, {
    id: entry.id,
    name: entry.name,
    description: entry.description || '',
    tags: entry.tags,
    path: entry.path,
  })
}

function detectCursorApiKeyReady(installPath) {
  const root = String(installPath || '').trim()
  if (!root || !fs.existsSync(root)) return false
  const files = ['.nine/.env.local', '.nine/.env', '.env.local', '.env']
  for (const rel of files) {
    const file = path.join(root, rel)
    if (!fs.existsSync(file)) continue
    let text = ''
    try { text = fs.readFileSync(file, 'utf8') } catch { continue }
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const match = trimmed.match(/^(?:export\s+)?(CURSOR_API_KEY|CURSOR_API)\s*=\s*(.*)$/i)
      if (!match) continue
      let value = String(match[2] || '').trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1).trim()
      }
      if (value) return true
    }
  }
  return false
}

function projectDaemonTask(raw, repo, options = {}) {
  const agents = loadWorkbenchAgents(repo)
  const workflowId = String(raw.workflow || raw.task && raw.task.workflow || '').trim()
  const workflowPath = String(
    options.workflowPath
    || raw.workflow_path
    || raw.workflowPath
    || (raw.workflow && raw.workflow.path)
    || '',
  ).trim()
  const workflow = loadWorkflowDefinition(repo, workflowId, {
    path: workflowPath,
    name: options.workflowName,
  })
  const projection = workbenchTaskProjection.projectTaskRoom({
    task: raw,
    workflow,
    agents,
    intent: raw.intent,
    status: raw.state,
    workflowId,
    workflowName: workflow && workflow.name,
  })
  return {
    ...projection,
    graph: undefined,
    contentSource: repo && repo.origin === 'daemon' ? 'daemon' : (repo && repo.ok ? 'local' : 'none'),
  }
}

function getWorkbenchDaemonClient() {
  const settings = loadSettings()
  const token = workbenchAuth.resolveToken(settings)
  const endpoint = (settings.workbenchAuth && settings.workbenchAuth.endpoint)
    || process.env.KNOWME_WORKBENCH_URL
  return workbenchDaemon.createClient({ endpoint, token })
}

function publicWorkbenchAuthStatus(settings, health = null) {
  return workbenchAuth.mergeAuthFromHealth(
    workbenchAuth.publicStatus(settings),
    health
  )
}

function getWorkbenchAutomationStore() {
  return workbenchAutomationStore.createStore(WORKBENCH_AUTOMATIONS_FILE, {
    resolveLaunch: (job) => workbenchConsoleModel.buildAutomationLaunchRequest(job, lastVerticalPipelineFacts || {}),
  })
}

function getWorkbenchTodoStore() {
  return workbenchTodoStore.createStore(WORKBENCH_TODOS_FILE)
}

function getWorkbenchTaskDraftStore() {
  return workbenchTaskDraftStore.createStore(WORKBENCH_TASK_DRAFT_FILE)
}

function getWorkbenchTaskStore() {
  return workbenchTaskStore.createStore(WORKBENCH_TASKS_FILE)
}

let workbenchTaskScheduleTimer = null

function notifyWorkbenchTaskScheduleDue(payload) {
  if (!workspaceWin || workspaceWin.isDestroyed()) return false
  workspaceWin.webContents.send('workbench-task-schedule-due', payload || {})
  return true
}

function tickWorkbenchTaskSchedules() {
  try {
    const store = getWorkbenchTaskStore()
    const listed = store.list()
    const tasks = listed?.ok && Array.isArray(listed.tasks) ? listed.tasks : []
    const due = workbenchTaskScheduler.listDue(tasks, new Date())
    for (const parent of due) {
      const advanced = workbenchTaskScheduler.advanceAfterFire(parent, new Date())
      const updated = store.update(parent.id, {
        schedule: advanced.schedule,
        scheduleEnabled: advanced.scheduleEnabled,
        scheduleLabel: advanced.scheduleLabel,
        nextRunAt: advanced.nextRunAt,
        lastScheduledAt: advanced.lastScheduledAt,
      })
      if (!updated?.ok) continue
      notifyWorkbenchTaskScheduleDue({
        parentId: parent.id,
        parent: updated.task,
      })
    }
  } catch (err) {
    console.error('[workbench-task-schedule]', err?.stack || err)
  }
}

function startWorkbenchTaskScheduleTicker() {
  if (workbenchTaskScheduleTimer) return
  tickWorkbenchTaskSchedules()
  workbenchTaskScheduleTimer = setInterval(tickWorkbenchTaskSchedules, 60 * 1000)
  if (typeof workbenchTaskScheduleTimer.unref === 'function') workbenchTaskScheduleTimer.unref()
}

function getWorkbenchWorkflowPackageStore() {
  return workflowPackageStore.createStore({ file: WORKBENCH_WORKFLOWS_FILE })
}

function getAgentProfileStore() {
  return agentProfileStore.createStore({ file: AGENT_PROFILES_FILE })
}

function getWorkbenchContextStore() {
  return workbenchContextStore.createStore(WORKBENCH_CONTEXT_FILE)
}

function getWorkbenchLaunchStores() {
  const contextStore = getWorkbenchContextStore()
  const draftStore = getWorkbenchTaskDraftStore()
  const context = contextStore.get().context
  const draft = draftStore.get().draft
  return { contextStore, draftStore, context, draft }
}

function buildWorkbenchLaunchFacts(input = {}) {
  const payload = input && typeof input === 'object' ? input : {}
  const allowFixtureFacts = process.env.KNOWME_TEST_SEAM === '1'
  const facts = allowFixtureFacts
    ? (payload.facts && typeof payload.facts === 'object' ? payload.facts : payload)
    : {}
  return workbenchConsoleModel.buildVerticalPipelineFacts({
    ...(lastVerticalPipelineFacts || {}),
    ...facts,
    daemonOnline: facts.daemonOnline != null
      ? facts.daemonOnline === true
      : !!(lastVerticalPipelineFacts && lastVerticalPipelineFacts.daemonOnline),
    localTeamEnabled: facts.localTeamEnabled != null
      ? facts.localTeamEnabled !== false
      : process.env.KNOWME_AGENT_TEAM_RUNTIME !== '0',
    availableExperts: Array.isArray(facts.availableExpertIds)
      ? facts.availableExpertIds
      : (facts.availableExperts || lastVerticalPipelineFacts?.availableExperts || collectAvailableWorkbenchExperts()),
  })
}

function resolveLaunchPackageItem(resourceId) {
  const id = String(resourceId || '').trim()
  if (!id) return null
  const stored = getWorkbenchWorkflowPackageStore().get(id)
  if (stored?.ok && stored.package) return stored.package
  const resolved = workbenchConsoleModel.resolveVerticalPipelineById(id, lastVerticalPipelineFacts || {})
  return resolved?.package || null
}

function loadWorkbenchAgentRunSummaries(limit = 50) {
  const store = new AgentRunStore({
    rootDir: path.join(app.getPath('userData'), 'agent-runs'),
    strictSecrets: true,
  })
  return store.listRootRunIds()
    .slice(-Math.max(1, Math.min(100, Number(limit) || 50)))
    .map((rootRunId) => {
      const result = store.queryRun(rootRunId)
      if (!result.ok || !result.state) return null
      return {
        ...result.state,
        runId: result.state.runId || rootRunId,
        rootRunId,
        executionSource: 'local-team',
      }
    })
    .filter(Boolean)
}

function buildWorkbenchConsoleProjection(input = {}) {
  return workbenchConsoleModel.buildConsoleProjection({
    ...input,
    agentRuns: input.agentRuns || loadWorkbenchAgentRunSummaries(),
    localTeamEnabled: process.env.KNOWME_AGENT_TEAM_RUNTIME !== '0',
  })
}

let lastVerticalPipelineFacts = workbenchConsoleModel.buildVerticalPipelineFacts()

function collectAvailableWorkbenchExperts() {
  const available = []
  for (const [expertId] of workbenchModeCatalog) {
    if (isExpertAvailableForWorkbench(expertId)) available.push(expertId)
  }
  return available
}

function summarizeFeishuConnectorStatus(result) {
  const connector = result?.connector || null
  const status = connector?.status || {}
  return [{
    id: 'feishu',
    kind: 'connector',
    label: '飞书连接器',
    enabled: connector?.enabled === true,
    ready: connector?.enabled === true
      && status.state !== 'auth_required'
      && status.userReady !== false,
    summary: '飞书会议与文档',
  }]
}

async function buildVerticalPipelineFactsInput(input = {}) {
  let connectors = []
  try {
    const result = await getConnectorsApi().getConnectorStatus('feishu')
    connectors = summarizeFeishuConnectorStatus(result)
  } catch {
    connectors = []
  }
  const facts = workbenchConsoleModel.buildVerticalPipelineFacts({
    modes: input.modes,
    daemon: input.daemon,
    agents: input.agents,
    connectors,
    availableExperts: input.availableExperts || collectAvailableWorkbenchExperts(),
    localTeamEnabled: process.env.KNOWME_AGENT_TEAM_RUNTIME !== '0',
  })
  lastVerticalPipelineFacts = facts
  return facts
}

/** 读取仓库工作流 JSON 正文，供供给管道填充 graph；读不到时留空并由排除规则处理。 */
function attachWorkflowDefinitions(root, workflows = []) {
  return (Array.isArray(workflows) ? workflows : []).map(item => {
    if (!item?.path) return item
    const file = workbenchRepo.resolveWorkflowFile(root, item.path)
    return file ? { ...item, definition: readJsonSafe(file) } : item
  })
}

function buildWorkflowShelf(input = {}) {
  // 官方参考工作流（多 Agent + Gate）注入货架；旧 Demo 空壳不上架。
  // 另汇集个人编排、仓库投影与 Daemon 目录；automation 仍可按历史 id 解析。
  const officialWorkflows = require('./lib/official-workflows')
  const verticals = typeof input.verticals !== 'undefined'
    ? (input.verticals || [])
    : officialWorkflows.listOfficialWorkflowPackages()
  return workflowSupply.buildWorkflowSupply({
    repoWorkflows: input.workflows || [],
    daemon: input.daemon || {},
    personal: input.personal || [],
    verticals,
    agents: input.agents || [],
    repoActive: input.repoActive === true,
    localTeamEnabled: process.env.KNOWME_AGENT_TEAM_RUNTIME !== '0',
  })
}

async function ensureOfficialWorkflowExperts() {
  const officialWorkflows = require('./lib/official-workflows')
  const hub = ensureCapabilityHub()
  const ids = officialWorkflows.requiredExpertIds()
  const results = []
  for (const id of ids) {
    try {
      const loaded = hub.expertRuntime().loadExpert(id)
      if (loaded?.ok) {
        results.push({ id, status: 'present' })
        continue
      }
      const installed = await hub.installCapability({ id, enabled: true, riskConfirmed: true })
      results.push({
        id,
        status: installed?.ok ? 'installed' : 'failed',
        error: installed?.ok ? '' : (installed?.error || installed?.message || ''),
      })
    } catch (error) {
      results.push({ id, status: 'failed', error: error?.message || String(error) })
    }
  }
  return { ok: true, results }
}

function getWorkbenchModeStore() {
  if (!workbenchModes) {
    workbenchModes = workbenchModeStore.createStore({
      file: WORKBENCH_MODES_FILE,
      catalogProjector: (expertIds) => {
        const projected = new Map()
        for (const expertId of expertIds || []) {
          const item = workbenchModeCatalog.get(expertId)
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
              })
        }
        return projected
      },
      daemonProjector: () => workbenchModeDaemon,
    })
  }
  return workbenchModes
}

function modeNameFromDto(dto, modeId) {
  return (Array.isArray(dto?.modes) ? dto.modes : []).find(mode => mode.id === modeId)?.name || modeId
}

async function refreshWorkbenchModeProjections(daemonOverview = null) {
  const [catalogResult, daemon] = await Promise.all([
    ensureCapabilityHub().listCapabilities({ kind: 'expert' }).catch(error => ({
      ok: false,
      error: error?.message || String(error),
      items: [],
    })),
    daemonOverview
      ? Promise.resolve(daemonOverview)
      : loadWorkbenchDaemonOverview().catch(() => ({ online: false })),
  ])
  workbenchModeCatalog = new Map(
    (Array.isArray(catalogResult?.items) ? catalogResult.items : [])
      .filter(item => item?.kind === 'expert')
      .map(item => [String(item.id || ''), item]),
  )
  workbenchModeDaemon = daemon && typeof daemon === 'object'
    ? { online: daemon.online === true }
    : { online: false }
  return getWorkbenchModeStore().list()
}

function isExpertAvailableForWorkbench(expertId) {
  const item = workbenchModeCatalog.get(String(expertId || '').trim())
  const installed = ['installed', 'enabled', 'disabled'].includes(String(item?.status || '').toLowerCase())
  return Boolean(item && item.kind === 'expert' && installed && item.enabled === true)
}

function normalizeAutomationTargetName(item = {}, fallback) {
  return String(
    item.name ||
    item.chat_name ||
    item.localized_name ||
    item.en_name ||
    fallback ||
    ''
  ).trim()
}

const FEISHU_FACT_TOOLS = ['feishu.related_chats', 'feishu.today_priority', 'feishu.doc_kb_suggest']

/** Earlier rounds already put Feishu facts on screen, so a follow-up may re-slice them. */
function hasPriorFeishuFacts(session) {
  const list = Array.isArray(session?.messages) ? session.messages : []
  return list.some(item => item
    && item.role === 'tool'
    && item.status === 'done'
    && FEISHU_FACT_TOOLS.includes(item.toolName))
}

/** Unknown status counts as ready: never invent an auth problem the user cannot verify. */
async function getFeishuGroundingContext() {
  try {
    const result = await getConnectorsApi().getConnectorStatus('feishu')
    const connector = result?.connector || null
    const status = connector?.status || {}
    return {
      authReady: status.state === 'auth_required' ? false : status.userReady !== false,
      connectorEnabled: connector ? connector.enabled === true : null,
      allowlist: Array.isArray(connector?.allowlist) ? connector.allowlist.slice() : null,
      projectedAllowlist: Array.isArray(status?.projectedAllowlist) ? status.projectedAllowlist.slice() : null,
    }
  } catch {
    return {
      authReady: true,
      connectorEnabled: null,
      allowlist: null,
      projectedAllowlist: null,
    }
  }
}

function ensureFeishuConnectorReady(connector) {
  if (!connector || connector.enabled !== true) {
    return { ok: false, code: 'feishu_disabled', error: '飞书连接器未启用，请先在设置中启用并授权' }
  }
  const status = connector.status || {}
  if (status.state === 'auth_required' || status.userReady === false) {
    return { ok: false, code: 'feishu_auth_required', error: '飞书用户身份未授权，请先在设置中完成飞书登录授权' }
  }
  return { ok: true }
}

function toTargetItems(list = [], kind = 'chat') {
  return (Array.isArray(list) ? list : [])
    .map(item => {
      const id = String(
        kind === 'chat'
          ? (item.id || item.chat_id || '')
          : (item.id || item.open_id || item.user_id || '')
      ).trim()
      if (!id) return null
      return {
        id,
        name: normalizeAutomationTargetName(item, id),
      }
    })
    .filter(Boolean)
}

async function loadWorkbenchDaemonOverview() {
  const settings = loadSettings()
  const installPath = workbenchBootstrap.resolveWorkbenchInstallPath(settings)
  const cursorApiKeyReady = detectCursorApiKeyReady(installPath)
  try {
    const result = await getWorkbenchDaemonClient().overview()
    const auth = publicWorkbenchAuthStatus(settings, result.health || null)
    const bootstrapStatus = workbenchBootstrap.buildPublicStatus(settings, {
      daemonOverview: result,
      tokenConfigured: Boolean(workbenchAuth.resolveToken(settings)),
    })
    const executor = result.executor || workbenchDaemon.assessExecutorFromHealth(result.health || {})
    const executorReady = result.executorReady === true || executor.ready === true
    return {
      ...result,
      auth,
      bootstrap: bootstrapStatus,
      executor,
      executorReady,
      cursorApiKeyReady,
      installPath: installPath || '',
    }
  } catch (error) {
    const bootstrapStatus = workbenchBootstrap.buildPublicStatus(settings, {
      tokenConfigured: Boolean(workbenchAuth.resolveToken(settings)),
    })
    return {
      ...workbenchDaemon.normalizeError(error),
      online: false,
      workflows: [],
      tasks: [],
      agents: [],
      agentCatalogAvailable: false,
      auth: publicWorkbenchAuthStatus(settings),
      bootstrap: bootstrapStatus,
      executorReady: false,
      cursorApiKeyReady,
      installPath: installPath || '',
      hint: '请检查 Workbench 服务地址、网络连接和授权状态',
    }
  }
}

function listLocalWorkbenchAgents() {
  const hub = ensureCapabilityHub()
  let catalogById = new Map()
  try {
    const catalog = require('./lib/capability-catalog').listCatalog(app.getPath('userData'), {
      bundledRoot: CATALOG_ROOT,
    })
    catalogById = new Map(
      (catalog.entries || [])
        .filter(entry => entry && entry.kind === 'expert' && entry.id)
        .map(entry => [String(entry.id), entry]),
    )
  } catch { /* catalog optional for workbench list */ }
  return hub.expertRuntime().listExperts().map((expert) => {
    const profiles = getAgentProfileStore().list(expert.id).profiles || []
    const profile = profiles.find(item => item.provenance?.scope === 'default-agent') || profiles[0] || null
    const meta = catalogById.get(String(expert.id)) || {}
    // 与专家库同源：目录/安装表展示名优先于 EXPERT.md 原始 slug
    const name = String(meta.name || expert.name || expert.id).trim()
    const description = String(expert.description || meta.description || '').trim()
    const category = Array.isArray(meta.categories) && meta.categories[0]
      ? String(meta.categories[0])
      : '专家'
    const status = meta.installed
      ? (meta.enabled === true ? 'enabled' : 'disabled')
      : (meta.installStatus || 'available')
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
    }
  })
}

function normalizeChatEndpoint(endpoint) {
  const trimmed = endpoint.trim().replace(/\/+$/, '')
  if (/\/chat\/completions(\?|$)/.test(trimmed)) return trimmed
  if (/\/v1$/.test(trimmed) || /\/compatible-mode\/v1$/.test(trimmed)) {
    return `${trimmed}/chat/completions`
  }
  return trimmed
}

function normalizeEmbeddingsEndpoint(endpoint) {
  const trimmed = String(endpoint || '').trim().replace(/\/+$/, '')
  if (!trimmed) return ''
  if (/\/embeddings(\?|$)/.test(trimmed)) return trimmed
  if (/\/chat\/completions$/.test(trimmed)) return trimmed.replace(/\/chat\/completions$/, '/embeddings')
  if (/\/v1$/.test(trimmed) || /\/compatible-mode\/v1$/.test(trimmed)) return `${trimmed}/embeddings`
  return `${trimmed}/embeddings`
}

/**
 * 构建 embeddings 调用函数用于向量语义重排。
 * 仅当 settings.semanticRerank === true 且具备 apiKey/端点时启用，否则返回 null（走词面排序）。
 * 失败/超时抛错，由 knowledge-os.queryRanked 捕获回退，绝不阻断检索。
 */
function buildEmbedFn(settings) {
  if (!settings || settings.semanticRerank !== true || !settings.apiKey) return null
  const endpoint = normalizeEmbeddingsEndpoint(settings.apiEndpoint)
  if (!endpoint || typeof fetch !== 'function') return null
  const apiKey = settings.apiKey
  const model = String(settings.embeddingModel || '').trim()
    || (settings.llmProvider === 'dashscope' ? 'text-embedding-v3' : 'text-embedding-3-small')
  const embed = async (texts) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, input: texts }),
        signal: controller.signal,
      })
      if (!res.ok) throw new Error(`embeddings ${res.status}`)
      const json = await res.json()
      const data = Array.isArray(json?.data) ? json.data : []
      const ordered = [...data].sort((a, b) => (Number(a?.index) || 0) - (Number(b?.index) || 0))
      const vectors = ordered.map((d) => d.embedding)
      if (vectors.length !== texts.length) {
        throw new Error(`embeddings count mismatch: ${vectors.length}/${texts.length}`)
      }
      return vectors
    } finally {
      clearTimeout(timer)
    }
  }
  embed.cacheKey = `${endpoint}|${model}`
  return embed
}

function parseSseLines(buffer, onDelta) {
  const lines = buffer.split('\n')
  const remainder = lines.pop() ?? ''
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('data:')) continue
    const payload = trimmed.slice(5).trim()
    if (!payload || payload === '[DONE]') continue
    try {
      const j = JSON.parse(payload)
      if (j.error) throw new Error(j.error.message || JSON.stringify(j.error).substring(0, 200))
      const delta = j.choices?.[0]?.delta?.content
      if (delta) onDelta(delta)
    } catch (e) {
      if (e.message && !e.message.includes('Unexpected')) throw e
    }
  }
  return remainder
}

function extractChatText(json) {
  return json.choices?.[0]?.message?.content || ''
}

function requestAgentCompletion({ url, settings, body, onSnapshot, signal }) {
  return new Promise(resolve => {
    const lib = url.protocol === 'https:' ? https : http
    const port = url.port || (url.protocol === 'https:' ? 443 : 80)
    const payload = JSON.stringify(body)
    let req
    let settled = false
    let abortHandler
    const finish = result => {
      if (settled) return
      settled = true
      if (abortHandler) signal?.removeEventListener('abort', abortHandler)
      resolve(result)
    }
    req = lib.request({
      hostname: url.hostname,
      port,
      method: 'POST',
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'Authorization': `Bearer ${settings.apiKey}`,
        'Content-Length': Buffer.byteLength(payload),
      },
    }, res => {
      let raw = ''
      let sawSse = String(res.headers['content-type'] || '').includes('text/event-stream')
      let lastContent = ''
      let reasoningReported = false
      const accumulator = agentStream.createStreamAccumulator()
      const publishSnapshot = () => {
        if (signal?.aborted || settled) return
        const snapshot = agentStream.getStreamSnapshot(accumulator)
        if (snapshot.hasReasoning && !reasoningReported) {
          reasoningReported = true
          onSnapshot?.({ ...snapshot, reasoningStarted: true })
        }
        if (snapshot.content !== lastContent) {
          lastContent = snapshot.content
          onSnapshot?.(snapshot)
        }
      }

      res.on('data', chunk => {
        if (signal?.aborted || settled) return
        const piece = chunk.toString()
        raw += piece
        if (!sawSse && (raw.startsWith('data:') || piece.includes('\ndata:'))) sawSse = true
        if (!sawSse) return
        try {
          agentStream.feedSse(accumulator, piece)
          publishSnapshot()
        } catch (err) {
          req.destroy()
          finish({ error: err.message || '流式响应解析失败', status: res.statusCode })
        }
      })

      res.on('end', () => {
        if (settled) return
        if (res.statusCode !== 200) {
          let message = raw.substring(0, 300)
          try {
            const parsed = JSON.parse(raw)
            message = parsed.error?.message || parsed.message || message
          } catch { /* keep response preview */ }
          finish({ error: `HTTP ${res.statusCode}: ${message}`, status: res.statusCode })
          return
        }
        try {
          if (sawSse) {
            agentStream.flushSse(accumulator)
          } else {
            agentStream.applyCompletionJson(accumulator, JSON.parse(raw))
          }
          publishSnapshot()
          finish({ snapshot: agentStream.getStreamSnapshot(accumulator), streamed: sawSse })
        } catch (err) {
          finish({ error: err.message || '响应格式异常', status: res.statusCode })
        }
      })
    })
    abortHandler = () => {
      req.destroy()
      finish({ error: '请求已取消', cancelled: true })
    }
    if (signal?.aborted) return abortHandler()
    signal?.addEventListener('abort', abortHandler, { once: true })
    req.setTimeout(120000, () => {
      req.destroy()
      finish({ error: '请求超时（120s），请检查网络或 Endpoint', timedOut: true })
    })
    req.on('error', err => {
      if (signal?.aborted) return finish({ error: '请求已取消', cancelled: true })
      finish({ error: `连接失败: ${err.message}` })
    })
    req.write(payload)
    req.end()
  })
}

function cleanSuggestedTitle(raw) {
  return (raw || '')
    .trim()
    .replace(/^["'「『【《]|["'」』】》]$/g, '')
    .replace(/^(标题|Title)[:：]\s*/i, '')
    .replace(/\s+/g, ' ')
    .slice(0, 40)
}

function localTitleFromParagraph(para) {
  const line = para.split('\n').map(l => l.trim()).find(Boolean) || para
  return cleanSuggestedTitle(line.replace(/^#+\s*/, ''))
}

function chatCompletionOnce(s, messages, maxTokens = 80, options = {}) {
  const endpoint = normalizeChatEndpoint(s.apiEndpoint)
  let url
  try { url = new URL(endpoint) } catch { return Promise.resolve({ error: `Endpoint 格式错误: ${s.apiEndpoint}` }) }
  const promptForRoute = (Array.isArray(messages) ? messages : [])
    .map(item => typeof item?.content === 'string' ? item.content : '')
    .join('\n')
    .slice(0, 5000)
  const routedModel = llmModelCatalog.resolveRuntimeModel(s, {
    tier: 'assist',
    prompt: promptForRoute,
    history: messages,
  })
  const explicitModel = String(options.model || '').trim()
  const temperature = options.temperature == null || options.temperature === ''
    ? 0.3
    : Number(options.temperature)
  const tokenCap = Number.isFinite(Number(options.maxTokens)) ? Number(options.maxTokens) : maxTokens

  const body = JSON.stringify({
    model: explicitModel || routedModel.model || 'gpt-4o-mini',
    messages,
    max_tokens: tokenCap,
    temperature: Number.isFinite(temperature) ? temperature : 0.3,
    stream: false,
  })

  return new Promise(resolve => {
    const lib = url.protocol === 'https:' ? https : http
    const port = url.port || (url.protocol === 'https:' ? 443 : 80)
    const req = lib.request({
      hostname: url.hostname, port, method: 'POST',
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${s.apiKey}`,
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let data = ''
      res.on('data', c => { data += c })
      res.on('end', () => {
        if (res.statusCode !== 200) {
          try {
            const j = JSON.parse(data)
            resolve({ error: j.error?.message || j.message || `HTTP ${res.statusCode}` })
          } catch {
            resolve({ error: `HTTP ${res.statusCode}: ${data.substring(0, 120)}` })
          }
          return
        }
        try {
          const j = JSON.parse(data)
          if (j.error) resolve({ error: j.error.message || 'API 错误' })
          else resolve({ text: extractChatText(j) })
        } catch {
          resolve({ error: '响应解析失败' })
        }
      })
    })
    req.setTimeout(20000, () => { req.destroy(); resolve({ error: '请求超时' }) })
    req.on('error', e => resolve({ error: e.message }))
    req.write(body)
    req.end()
  })
}


function recommendWorkbenchAgentMembers(goal, experts) {
  const text = String(goal || '').toLowerCase()
  const signals = [
    ['product', '需求', '方案', '规划', 'proposal', 'plan'],
    ['research', '调研', '检索', '分析', 'research', 'query'],
    ['coding', '开发', '代码', '研发', '实现', 'code'],
    ['testing', '测试', '验收', 'qa', '回归', 'test'],
    ['writing', '写作', '文案', '纪要', 'writing'],
  ]
  const scored = (Array.isArray(experts) ? experts : []).map((expert, index) => {
    const haystack = [
      expert.id,
      expert.name,
      expert.description,
      ...(expert.skills || []),
    ].join(' ').toLowerCase()
    const score = signals.reduce((sum, group) => (
      sum + (group.some(token => text.includes(token) && haystack.includes(token)) ? 3 : 0)
    ), 0)
    return { expert, index, score }
  })
  scored.sort((a, b) => b.score - a.score || a.index - b.index)
  const selected = scored.slice(0, Math.min(3, scored.length)).map(({ expert }) => ({
    id: expert.id,
    expertId: expert.id,
    agentPackageId: expert.id,
    role: expert.name || expert.id,
    intent: `围绕「${String(goal || '').slice(0, 160)}」完成${expert.name || expert.id}负责的步骤`,
  }))
  return selected
}

function compileWorkbenchAgentGraphPayload(payload = {}) {
  const goal = String(payload.goal || '').trim()
  const listed = ensureCapabilityHub().expertRuntime().listExperts()
  const hasExplicitNodes = Array.isArray(payload.nodes) && payload.nodes.length > 0
  const requestedMembers = Array.isArray(payload.members)
    ? payload.members
    : (hasExplicitNodes ? [] : recommendWorkbenchAgentMembers(goal, listed))
  const specialtyOnly = hasExplicitNodes
    && !requestedMembers.length
    && payload.nodes.some(node => ['llm', 'tool', 'knowledge'].includes(String(node.type || '')))
  const template = specialtyOnly || hasExplicitNodes
    ? (payload.template || null)
    : String(
      payload.template
        || (requestedMembers.length >= 3 ? 'parallel' : (requestedMembers.length === 2 ? 'serial' : 'single')),
    )
  return workbenchAgentGraph.compileWorkbenchAgentGraph({
    ...payload,
    goal,
    template,
    members: requestedMembers,
    teamPackageId: payload.teamPackageId || `workbench-agent-graph-${Date.now().toString(36)}`,
    teamName: payload.teamName || 'KnowMe Agent 协作图',
  }, {
    resolveAgentPackage: resolveWorkbenchAgentPackage,
  })
}


function extractResourceHintTarget(args = {}) {
  if (!args || typeof args !== 'object') return ''
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
  ]
  for (const key of candidates) {
    const value = String(args[key] || '').trim()
    if (value) return value.slice(0, 240)
  }
  return ''
}

function isMissingResourceText(text = '') {
  const raw = String(text || '').trim()
  if (!raw) return false
  return /(enoent|no such file|not found|does not exist|404|找不到|未找到|不存在|路径无效|缺少资源)/i.test(raw)
}

function buildMissingResourceHint(entries = []) {
  const list = Array.isArray(entries) ? entries : []
  const failed = [...list].reverse().find(item =>
    item?.status === 'error' && isMissingResourceText(item?.text)
  )
  if (!failed) return ''
  const target = extractResourceHintTarget(failed.args)
  if (target) {
    return `我尝试读取目标内容，但未找到该资源：\`${target}\`。\n请先确认路径是否正确、文件是否已生成，再让我继续读取。`
  }
  return '我尝试读取目标内容，但未找到对应资源。\n请先确认路径是否正确、文件是否已生成，再让我继续读取。'
}


async function showOpenDialogFor(sender, options) {
  const parent =
    (sender && BrowserWindow.fromWebContents(sender)) ||
    (settingsWin && !settingsWin.isDestroyed() ? settingsWin : null) ||
    BrowserWindow.getFocusedWindow()
  if (!parent || parent.isDestroyed()) {
    return dialog.showOpenDialog(options)
  }
  const wasOnTop = parent.isAlwaysOnTop()
  if (wasOnTop) parent.setAlwaysOnTop(false)
  try {
    return await dialog.showOpenDialog(parent, options)
  } finally {
    if (wasOnTop && !parent.isDestroyed()) {
      parent.setAlwaysOnTop(true)
      parent.focus()
    }
  }
}

// ── 启动 ──────────────────────────────────────────────────────────────────────
if (gotSingleInstanceLock) {
  app.on('second-instance', (_e, commandLine) => {
    if (!handleLaunchArgs(commandLine)) restoreAppWindows()
  })
  app.on('activate', () => restoreAppWindows())

  app.whenReady().then(() => {
    app.setName(APP_DISPLAY_NAME)
    if (process.platform !== 'darwin') Menu.setApplicationMenu(null)
    ensureBrandIcons()
    if (process.platform === 'darwin' && app.dock) app.dock.setIcon(getAppIconImage())
    productKnowledge.ensureKnowledge(KNOWLEDGE_DIR, KNOWLEDGE_SEED)
    try {
      const hub = ensureCapabilityHub()
      hub.migrateConnectorsIfNeeded()
      hub.backfillExpertDisplayNames()
      hub.registerIpcHandlers({ showOpenDialog: showOpenDialogFor })
      ensureCapabilityPackRuntime()
    } catch (err) {
      console.error('[capability-hub]', err?.stack || err)
    }
    try { knowledgeOs.ensureDirs(app.getPath('userData')) } catch { /* */ }
    productMemory.ensureMemory(MEMORY_DIR)
    purgeEmptyClosedNotes()
    tray = new Tray(makeTrayIcon())
    tray.setToolTip(`${APP_DISPLAY_NAME}  左键显示/隐藏 · 右键菜单`)
    tray.on('click', toggleAppVisibility)
    tray.on('double-click', () => restoreAppWindows())
    updateTray()
    globalShortcut.register('CmdOrCtrl+Alt+N', newNote)
    globalShortcut.register('CmdOrCtrl+Alt+L', () => createWorkspaceWindow())
    settingsSecure.stripPlaintextApiKey(SETTINGS_FILE)
    if (process.argv.includes('--dev') && PROMPT_SPACE_DIR && !fs.existsSync(PROMPT_SPACE_IMPORT_FLAG)) {
      const result = importPromptSpace()
      try { fs.writeFileSync(PROMPT_SPACE_IMPORT_FLAG, JSON.stringify(result, null, 2), 'utf8') } catch {}
    }
    if (!handleLaunchArgs(process.argv)) {
      createWorkspaceWindow()
    }
    updateTaskbarAnchor()
    updateJumpList()
    initAutoUpdate()
    startWorkbenchTaskScheduleTicker()
  })
}
app.on('window-all-closed', () => {})
app.on('before-quit', () => { isQuitting = true })
app.on('will-quit', () => globalShortcut.unregisterAll())

process.on('uncaughtException', err => {
  console.error('[fatal]', err?.stack || err)
  try { logger.error('system', 'uncaught-exception', String(err?.message || err).slice(0, 300), { stack: String(err?.stack || '').slice(0, 2000) }) } catch { /* ignore */ }
})
process.on('unhandledRejection', err => {
  console.error('[unhandled]', err?.stack || err)
  try { logger.error('system', 'unhandled-rejection', String(err?.message || err).slice(0, 300), { stack: String(err?.stack || '').slice(0, 2000) }) } catch { /* ignore */ }
})
app.on('child-process-gone', (_event, details) => {
  const type = String(details?.type || '')
  if (type === 'GPU' || type === 'Utility') {
    console.error('[child-process-gone]', details)
    try { logger.error('system', 'child-process-gone', `${type} 子进程退出`, { reason: details?.reason, exitCode: details?.exitCode }) } catch { /* ignore */ }
  }
})
