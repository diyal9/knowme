'use strict'

/**
 * 本机专家团队运行时、Agent Package 解析与会话 store。
 * 不负责 BrowserWindow。
 */

/** 挂载团队运行时与会话 store；由组合根 create(ctx) 调用一次。 */
function create(ctx) {
ctx.ensureAgentTeamRuntime = function ensureAgentTeamRuntime() {
    if (ctx.agentTeamRuntime)
        return ctx.agentTeamRuntime;
    const enabled = process.env.KNOWME_AGENT_TEAM_RUNTIME !== '0';
    const store = new ctx.AgentRunStore({
        rootDir: ctx.path.join(ctx.app.getPath('userData'), 'agent-runs'),
        strictSecrets: true,
    });
    let manager = null;
    const messageBus = new ctx.AgentMessageBus({
        runStore: store,
        isRunAuthorized: (runId, envelope) => {
            if (!manager)
                return false;
            const source = manager.getRun(runId);
            const target = envelope.targetRunId ? manager.getRun(envelope.targetRunId) : null;
            if (!source.ok)
                return false;
            if (!target)
                return true;
            return target.ok && source.run.rootRunId === target.run.rootRunId;
        },
    });
    const scheduler = new ctx.AgentRunScheduler();
    const launcher = new ctx.AgentRunLauncher({
        metrics: store.metrics,
        buildPorts: async (context) => {
            const factory = ctx.agentRuntimePortFactories.get(context.rootRunId)
                || ctx.agentRuntimePortFactories.get(context.parentRunId);
            if (!factory)
                throw new Error(`子 Run 缺少隔离端口工厂: ${context.rootRunId || context.parentRunId}`);
            return factory(context);
        },
    });
    manager = new ctx.AgentRunManager({
        runStore: store,
        messageBus,
        scheduler,
        launcher,
        metrics: store.metrics,
        authorizeChild: (spec) => {
            const expertId = String(spec.expertId || '').trim();
            if (!expertId)
                return { ok: false, code: 'unknown_agent', message: '缺少子 Agent/Expert 标识' };
            const loaded = ctx.ensureCapabilityHub().expertRuntime().loadExpert(expertId);
            return loaded.ok
                ? { ok: true }
                : { ok: false, code: 'unknown_agent', message: `未知或未安装 Expert: ${expertId}` };
        },
        emit: (event) => {
            if (event?.type === 'bus.message' && event.message) {
                const bus = event.message;
                const rootRunId = String(bus.rootRunId || bus.parentRunId || '');
                const bridge = ctx.agentRuntimeOutputBridges.get(rootRunId);
                if (!bridge)
                    return;
                const mapped = ctx.mapBusMessageToOutputEvent(bus, { runId: rootRunId, seq: 1 });
                if (mapped)
                    bridge(mapped.type, mapped.payload, { phase: mapped.phase });
                return;
            }
            const hit = manager.getRun(event?.runId);
            if (!hit.ok || !hit.run.parentRunId)
                return;
            const run = hit.run;
            const bridge = ctx.agentRuntimeOutputBridges.get(run.rootRunId);
            if (!bridge)
                return;
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
            };
            if (event?.type === 'run.started') {
                bridge(ctx.EventType.SUBRUN_STARTED, payload);
            }
            else if (event?.type === 'run.terminal') {
                const terminalType = run.status === 'cancelled'
                    ? ctx.EventType.SUBRUN_CANCELLED
                    : (run.status === 'done' ? ctx.EventType.SUBRUN_COMPLETED : ctx.EventType.SUBRUN_FAILED);
                bridge(terminalType, { ...payload, terminal: run.status });
            }
            else if (event?.type === 'run.waiting') {
                bridge(ctx.EventType.SUBRUN_WAITING, payload);
            }
            else if ([
                'phase.changed',
                'stage.updated',
                'tool.result',
                ctx.EventType.STAGE,
                ctx.EventType.PLAN_UPDATED,
                ctx.EventType.GROUNDING_STATUS,
                ctx.EventType.TOOL_STARTED,
                ctx.EventType.TOOL_COMPLETED,
                ctx.EventType.TOOL_FAILED,
            ].includes(event?.type)) {
                bridge(ctx.EventType.SUBRUN_PROGRESS, payload);
            }
        },
    });
    manager.recoverAllFromStore();
    ctx.agentTeamRuntime = { store, messageBus, scheduler, launcher, manager, enabled };
    return ctx.agentTeamRuntime;
};

ctx.resolveWorkbenchAgentPackage = function resolveWorkbenchAgentPackage(agentPackageId, profileId = '') {
    const id = String(agentPackageId || '').trim();
    if (!id)
        return { ok: false, code: 'unknown_agent', message: '缺少 Agent Package 标识' };
    const expert = ctx.ensureCapabilityHub().expertRuntime().loadExpert(id);
    if (!expert.ok)
        return expert;
    const requestedProfile = String(profileId || '').trim();
    const profile = requestedProfile
        ? (ctx.getAgentProfileStore().get(requestedProfile).profile || null)
        : (ctx.getAgentProfileStore().list(id).profiles[0] || null);
    const skillRefs = profile?.skillRefs?.length
        ? profile.skillRefs
        : (expert.skills || []).map(skillId => ({ id: skillId, version: 'latest' }));
    const role = profile?.roleOverlay || expert.name || expert.id;
    const normalized = ctx.agentPackageRuntime.normalizeLocalAgentPackage({
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
    });
    if (!normalized.ok)
        return normalized;
    return {
        ...normalized,
        expert,
        profile,
        contentHash: [expert.manifest?.contentHash || normalized.contentHash, profile?.profileHash]
            .filter(Boolean)
            .join(':'),
    };
};
ctx.workbenchAgentEventList = function workbenchAgentEventList(rootRunId) {
    const id = String(rootRunId || '').trim();
    if (!id)
        return [];
    const events = ctx.workbenchAgentRunEvents.get(id) || [];
    return events.slice(-120);
};
ctx.getWorkbenchAgentTeamRunner = function getWorkbenchAgentTeamRunner() {
    if (ctx.workbenchAgentTeamRunner)
        return ctx.workbenchAgentTeamRunner;
    const runtime = ctx.ensureAgentTeamRuntime();
    ctx.workbenchAgentTeamRunner = new ctx.AgentTeamWorkflowRunner({
        runManager: runtime.manager,
        resolveAgentPackage: ctx.resolveWorkbenchAgentPackage,
        resolveAgentProfile: profileId => ctx.getAgentProfileStore().get(String(profileId || '')),
        requestGateDecision: async ({ rootRunId, node, gate }) => {
            const key = `${rootRunId}:${node.id}`;
            const events = ctx.workbenchAgentRunEvents.get(rootRunId) || [];
            events.push({
                type: 'team.gate.waiting',
                rootRunId,
                nodeId: node.id,
                gateId: gate.id,
                title: gate.description || gate.id,
                at: new Date().toISOString(),
            });
            ctx.workbenchAgentRunEvents.set(rootRunId, events.slice(-120));
            return new Promise(resolve => {
                ctx.workbenchAgentGateWaiters.set(key, { resolve, rootRunId, nodeId: node.id });
            });
        },
        emit: event => {
            const rootRunId = String(event?.rootRunId || '').trim();
            if (!rootRunId)
                return;
            const events = ctx.workbenchAgentRunEvents.get(rootRunId) || [];
            events.push({ ...event, at: new Date().toISOString() });
            ctx.workbenchAgentRunEvents.set(rootRunId, events.slice(-120));
        },
        specialtyHandlers: {
            llm: async ({ prompt, config }) => {
                const settings = ctx.loadSettings();
                if (!settings.apiKey || !settings.apiEndpoint) {
                    return { ok: false, code: 'llm_not_configured', message: '请先配置 AI API Key 和 Endpoint' };
                }
                const model = String(config?.modelName || config?.model || '').trim();
                const result = await ctx.chatCompletionOnce(settings, [
                    { role: 'system', content: '你是 KnowMe 工作流中的大模型节点。只根据 Prompt 与输入完成当前步骤，不要调用工具。' },
                    { role: 'user', content: String(prompt || '').slice(0, 12000) || '请根据上下文给出结果。' },
                ], 1200, { model, temperature: config?.temperature });
                if (result.error)
                    return { ok: false, code: 'llm_failed', message: result.error };
                return { ok: true, summary: String(result.text || '').trim(), text: result.text };
            },
            tool: async ({ config, upstream, node }) => {
                const skillId = String(config?.skillId || '').trim();
                if (!skillId)
                    return { ok: false, code: 'missing_skill', message: '工具节点缺少 Skill' };
                const hub = ctx.ensureCapabilityHub();
                const runtime = hub.skillRuntime?.() || hub;
                if (typeof runtime.loadSkillL1 === 'function') {
                    const loaded = runtime.loadSkillL1(skillId);
                    if (loaded?.ok === false) {
                        return { ok: false, code: loaded.code || 'skill_missing', message: loaded.message || `无法加载 Skill: ${skillId}` };
                    }
                    const body = String(loaded?.body || loaded?.content || '').trim();
                    const intent = String(node?.intent || '').trim();
                    return {
                        ok: true,
                        summary: [
                            `技能 ${loaded?.name || skillId}`,
                            intent ? `目标：${intent}` : '',
                            upstream ? `上游：${String(upstream).slice(0, 2000)}` : '',
                            body ? `技能说明：${body.slice(0, 2000)}` : '已绑定技能（无脚本正文，仅记录绑定结果）',
                        ].filter(Boolean).join('\n'),
                    };
                }
                return {
                    ok: true,
                    summary: `已选择技能 ${skillId}${upstream ? `\n上游：${String(upstream).slice(0, 1500)}` : ''}`,
                };
            },
            knowledge: async ({ config, upstream, node }) => {
                const knowledgeId = String(config?.knowledgeId || '').trim();
                if (!knowledgeId)
                    return { ok: false, code: 'missing_knowledge', message: '知识库节点缺少知识库' };
                const query = String(node?.intent || upstream || '').trim() || '检索相关知识';
                const result = await ctx.fabricRetrieval.kbQuery(ctx.app.getPath('userData'), knowledgeId, query, typeof ctx.buildFabricCtx === 'function' ? ctx.buildFabricCtx() : {});
                if (!result?.ok) {
                    return {
                        ok: false,
                        code: result?.code || 'knowledge_query_failed',
                        message: result?.message || '知识库检索失败',
                    };
                }
                const hits = Array.isArray(result.hits) ? result.hits : [];
                const digest = hits.slice(0, 5).map((hit, index) => {
                    const title = hit.title || hit.id || `命中${index + 1}`;
                    const snippet = String(hit.snippet || hit.text || hit.content || '').slice(0, 400);
                    return `- ${title}: ${snippet}`;
                }).join('\n');
                return {
                    ok: true,
                    summary: digest || `知识库 ${knowledgeId} 无命中（查询：${query.slice(0, 200)}）`,
                    evidenceRefs: hits.slice(0, 8).map(hit => hit.id || hit.ref).filter(Boolean),
                };
            },
        },
    });
    return ctx.workbenchAgentTeamRunner;
};
ctx.createWorkbenchAgentPortFactory = function createWorkbenchAgentPortFactory({ rootRunId, goal, permissions = {} } = {}) {
    const runtime = ctx.ensureAgentTeamRuntime();
    const settings = ctx.loadSettings();
    const endpoint = ctx.normalizeChatEndpoint(settings.apiEndpoint);
    const url = new URL(endpoint);
    const routedModel = ctx.llmModelCatalog.resolveRuntimeModel(settings, {
        tier: 'agent',
        prompt: goal,
    });
    const modelProfile = routedModel.profile || {};
    const policy = ctx.llmRuntime.getRequestPolicy({
        model: routedModel.model || 'gpt-4o-mini',
        tier: 'agent',
        temperature: settings.temperature,
        requestedOutput: 2400,
        profile: modelProfile,
    });
    const promptCachePolicy = ctx.llmRuntime.getCacheControlPolicy({
        enabled: settings.promptCacheControl === true || process.env.KNOWME_PROMPT_CACHE === '1',
        provider: routedModel.provider,
        model: routedModel.model,
        endpoint: settings.apiEndpoint,
    });
    const tokenCalKey = ctx.llmUsage.calibrationKey(routedModel.provider, routedModel.model || 'gpt-4o-mini');
    const sourceRoot = ctx.getActiveSourceRoot();
    const runPermissions = {
        ...permissions,
        sandbox: ctx.agentSandbox.normalizeSandboxPermissions(permissions, {
            allowNetwork: settings.agentScriptsAllowNetwork === true,
        }),
        orchestration: {
            allowDelegate: false,
            maxParallel: 1,
            allowedSubExperts: [],
            ...(permissions.orchestration || {}),
        },
    };
    const searchKnowledge = async () => ({
        ok: false,
        code: 'workbench_graph_search_unavailable',
        text: '当前 Agent Graph 节点未启用独立知识检索工具',
    });
    const factory = async (childCtx) => {
        const childRunId = String(childCtx.runId || '');
        const expertId = String(childCtx.expertId || '').trim();
        const expert = ctx.ensureCapabilityHub().expertRuntime().loadExpert(expertId);
        if (!expert.ok)
            throw new Error(expert.message || `未知 Agent: ${expertId}`);
        const childSession = ctx.agentSessions.createSession('general', 1, {
            expertId,
            ephemeral: true,
            role: 'general',
            goal: String(childCtx.prompt || '').slice(0, 2000),
        });
        childSession.run.permissions = runPermissions;
        const handoffText = JSON.stringify({
            goal,
            task: String(childCtx.prompt || ''),
            handoff: childCtx.handoff || null,
            parentRunId: childCtx.parentRunId || null,
            expertId,
        });
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
        ];
        const artifactTools = ctx.agentArtifactTools.buildArtifactTools({ runId: childRunId });
        const extraTools = ctx.mergeExtraTools(artifactTools);
        const bindings = ctx.getSessionCapabilityBindings(childSession, ctx.ensureCapabilityHub().expertRuntime());
        const resolvedSurface = await ctx.resolveToolSurfaceForRun({
            userData: ctx.app.getPath('userData'),
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
            recordReceipt: receipt => runtime.store.writeReceipt(childRunId, receipt.idempotencyKey || receipt.auditId || `receipt_${Date.now()}`, { result: receipt.envelope || receipt }),
            connectorBuild: options => ctx.connectorToolRuntime.buildConnectorToolSurface(ctx.app.getPath('userData'), {
                extraTools: options.extraTools,
                allowedConnectorIds: bindings.allowedConnectorIds,
                registry: options.registry,
            }),
        });
        const toolSurface = resolvedSurface.surface;
        const toolExecutor = toolSurface.createToolExecutor({
            searchKnowledge,
            fabricSearch: searchKnowledge,
            signal: childCtx.signal,
        });
        const childPorts = ctx.buildProductionRunPorts({
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
            requestAgentCompletion: ctx.requestAgentCompletion,
            onStreamChunk: null,
            runStartedAt: Date.now(),
            effectivePersonalization: { applied: [], omitted: [] },
            ctxBundle: {
                contextInfo: { workbenchAgentGraph: true, goal, sourceRoot: sourceRoot || '' },
                taskFrame: null,
            },
            loadAgentSessions: ctx.loadAgentSessions,
            saveAgentSessions: ctx.saveAgentSessions,
            productMemoryCapture: () => { },
            memoryDir: ctx.MEMORY_DIR,
            normalizeAssistantOutput: ctx.normalizeAssistantOutput,
            orchestration: {
                cancelAllSubRuns: ({ reason = 'parent_cancelled' } = {}) => (runtime.manager.cancelAllChildren(childRunId, reason)),
                cancelSubRun: subRunId => runtime.manager.cancelRun(subRunId, 'parent_cancelled'),
                cancelProcessesForRun: ctx.agentProcessTools.cancelProcessesForRun,
            },
            governancePolicy: resolvedSurface.governancePolicy || runPermissions,
            budget: runtime.manager.getRun(childRunId).run?.budget || null,
            persistRunCheckpoint: checkpoint => runtime.manager.saveCheckpoint(childRunId, 'latest', checkpoint),
            cancelProcessesForRun: ctx.agentProcessTools.cancelProcessesForRun,
            recordReceipt: receipt => runtime.store.writeReceipt(childRunId, receipt.idempotencyKey || receipt.auditId || `receipt_${Date.now()}`, { result: receipt.envelope || receipt }),
        });
        childPorts._dispose = resolvedSurface.close;
        return childPorts;
    };
    ctx.agentRuntimePortFactories.set(String(rootRunId), factory);
    return factory;
};
ctx.SOURCES_FILE = ctx.path.join(ctx.app.getPath('userData'), 'sources.json');
ctx.LOGS_DIR = ctx.path.join(ctx.app.getPath('userData'), 'logs');
if (!ctx.fs.existsSync(ctx.DATA_DIR))
    ctx.fs.mkdirSync(ctx.DATA_DIR, { recursive: true });
// 统一日志：主进程唯一落盘点，渲染进程通过 app-log 上报。
try {
    ctx.logger.init({
        dir: ctx.LOGS_DIR,
        level: process.env.KNOWME_LOG_LEVEL || 'info',
        mirrorConsole: process.argv.includes('--dev') || !ctx.app.isPackaged,
    });
    ctx.logger.system('app-start', 'KnowMe 主进程启动', { version: ctx.app.getVersion(), platform: process.platform });
}
catch { /* logging must never crash startup */ }
ctx.gotSingleInstanceLock = ctx.app.requestSingleInstanceLock();
if (!ctx.gotSingleInstanceLock) {
    ctx.app.quit();
}
ctx.loadSettings = () => ctx.settingsSecure.load(ctx.SETTINGS_FILE);
ctx.saveSettings_ = s => ctx.settingsSecure.save(ctx.SETTINGS_FILE, s);
ctx.loadAgentStore = function loadAgentStore() {
    try {
        const raw = JSON.parse(ctx.fs.readFileSync(ctx.AGENT_SESSIONS_FILE, 'utf8'));
        return ctx.agentSessions.migrateStore(raw);
    }
    catch {
        return ctx.agentSessions.migrateStore({ sessions: [], ui: {} });
    }
};
ctx.loadAgentSessions = function loadAgentSessions() {
    return ctx.loadAgentStore().sessions;
};
ctx.saveAgentStore = function saveAgentStore(sessions, ui) {
    const normalized = sessions.map((s, i) => ctx.agentSessions.normalizeSession(s, i + 1));
    const nextUi = ctx.agentSessions.normalizeUi(ui, normalized);
    ctx.fs.writeFileSync(ctx.AGENT_SESSIONS_FILE, JSON.stringify({ sessions: normalized, ui: nextUi }, null, 2), 'utf8');
    return { sessions: normalized, ui: nextUi };
};
ctx.saveAgentSessions = function saveAgentSessions(sessions) {
    const { ui } = ctx.loadAgentStore();
    ctx.saveAgentStore(sessions, ui);
};
ctx.ensureAgentSession = function ensureAgentSession(sessionId, agentId = 'general', opts = {}) {
    const { sessions, ui } = ctx.loadAgentStore();
    const { ensureSessionInStore } = require('../lib/agent-session-ensure');
    const ensured = ensureSessionInStore(sessions, ui, sessionId, {
        agentId,
        ...opts,
    });
    if (ensured.created) {
        ctx.saveAgentStore(ensured.sessions, ensured.ui);
    }
    return { session: ensured.session, sessions: ensured.sessions };
};
}

module.exports = { create }
