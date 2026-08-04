'use strict'

/**
 * capability-hub-service — 主进程 Capability Hub 集中接线：IPC、迁移、工具面、上下文。
 */

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { ipcMain } = require('electron')
const {
  createCapabilityStore,
  resolvePaths,
} = require('./capability-store')
const {
  createCapabilityCatalog,
  listCatalog,
} = require('./capability-catalog')
const { createCapabilityImport } = require('./capability-import')
const { createSkillRuntime } = require('./skill-runtime')
const { createExpertRuntime } = require('./expert-runtime')
const { buildSkillTools } = require('./agent-skill-tools')
const connectorCaps = require('./connector-capabilities')
const connectorStore = require('./connectors/store')
const {
  assembleCapabilityContext,
  getSessionCapabilityBindings,
} = require('./agent-context-assembly')
const {
  scanCursorRepository,
  publicPreview,
  registerCursorRepository,
} = require('./cursor-capability-repository')

const MIGRATION_FLAG = '.connectors-migrated-v1'

const IPC_CHANNELS = Object.freeze({
  capability: [
    'capability-list',
    'capability-install',
    'capability-uninstall',
    'capability-enable',
    'capability-disable',
    'capability-update',
    'capability-import',
    'capability-pick-local-folder',
    'capability-pick-zip-file',
    'capability-pick-cursor-repository',
    'capability-scan-cursor-repository',
    'capability-import-cursor-repository',
  ],
  skill: [
    'skill-list',
    'skill-load',
    'skill-read-resource',
    'skill-run-script',
    'skill-migrate-legacy',
  ],
  expert: [
    'expert-list',
    'expert-get',
    'expert-save',
    'expert-try-chat',
    'expert-snapshot',
  ],
  connector: [
    'connector-health',
    'connector-tools-preview',
    'connector-save-allowlist',
  ],
})

function fail(code, message) {
  return { ok: false, code, error: message }
}

function ok(payload = {}) {
  return { ok: true, ...payload }
}

function mapCatalogItemToHub(entry) {
  const category = Array.isArray(entry.categories) && entry.categories.length
    ? entry.categories[0]
    : '全部'
  const status = entry.installed
    ? (entry.enabled ? 'enabled' : 'disabled')
    : (entry.installStatus || 'available')
  return {
    id: entry.id,
    kind: entry.kind,
    name: entry.name,
    description: entry.description,
    version: entry.version,
    source: entry.source,
    category,
    categories: entry.categories || [],
    tags: entry.tags || [],
    featured: entry.featured === true,
    status,
    enabled: entry.enabled === true,
    installed: entry.installed === true,
    contentHash: entry.installedHash || entry.contentHash || '',
    installedAt: entry.installedAt || '',
    sourceAvailable: entry.sourceAvailable !== false,
    repositoryId: entry.repositoryId || '',
    legacy: entry.source === 'legacy-okf',
    dependencies: [],
  }
}

function createMinimalPackage(kind, payload = {}) {
  const id = String(payload.id || '').trim()
  const name = String(payload.name || id).trim()
  const description = String(payload.description || name).trim()
  if (!id || !name) return fail('invalid_args', '缺少 id 或 name')

  if (kind === 'skill') {
    return {
      ok: true,
      files: {
        'SKILL.md': [
          '---',
          `name: ${JSON.stringify(name)}`,
          `description: ${JSON.stringify(description)}`,
          `slash: ${JSON.stringify(payload.slash || id)}`,
          '---',
          '',
          `# ${name}`,
          '',
          description,
          '',
        ].join('\n'),
      },
    }
  }

  if (kind === 'expert') {
    const systemPrompt = String(payload.systemPrompt || description).trim()
    return {
      ok: true,
      files: {
        'EXPERT.md': [
          '---',
          `name: ${JSON.stringify(name)}`,
          `description: ${JSON.stringify(description)}`,
          'avatar: ""',
          `skills: [${(payload.skills || []).map((s) => JSON.stringify(String(s))).join(', ')}]`,
          `connectors: [${(payload.connectors || []).map((c) => JSON.stringify(String(c))).join(', ')}]`,
          `systemPrompt: ${JSON.stringify(systemPrompt)}`,
          '---',
          '',
        ].join('\n'),
      },
    }
  }

  const manifest = {
    id,
    kind: 'connector',
    name,
    description,
    version: '1.0.0',
    type: String(payload.type || 'mcp'),
    mcp: payload.mcp && typeof payload.mcp === 'object' ? payload.mcp : {
      command: '',
      args: [],
      cwd: '',
      envKeys: [],
    },
    allowlist: Array.isArray(payload.allowlist) ? payload.allowlist : [],
  }
  return {
    ok: true,
    files: {
      'manifest.json': `${JSON.stringify(manifest, null, 2)}\n`,
    },
  }
}

function stageMinimalPackage(userData, kind, payload) {
  const built = createMinimalPackage(kind, payload)
  if (!built.ok) return built
  const paths = resolvePaths(userData)
  const stageRoot = path.join(paths.staging, `custom-${kind}-${Date.now()}`)
  fs.mkdirSync(stageRoot, { recursive: true })
  for (const [name, content] of Object.entries(built.files)) {
    fs.writeFileSync(path.join(stageRoot, name), content, 'utf8')
  }
  return { ok: true, stagingPath: stageRoot }
}

function createCapabilityHubService(deps = {}) {
  const getUserData = typeof deps.getUserData === 'function' ? deps.getUserData : () => ''
  const getKnowledgeDir = typeof deps.getKnowledgeDir === 'function'
    ? deps.getKnowledgeDir
    : () => path.join(getUserData(), 'knowledge')
  const getConnectorsApi = typeof deps.getConnectorsApi === 'function'
    ? deps.getConnectorsApi
    : () => null
  const bundledRoot = deps.bundledRoot || path.join(__dirname, '..', 'catalog')

  const store = createCapabilityStore({ getUserData })
  const catalogApi = createCapabilityCatalog({ getUserData, bundledRoot })
  const importApi = createCapabilityImport({ getUserData })
  const repositoryPreviews = new Map()

  function rememberRepositoryPreview(preview) {
    const token = crypto.randomBytes(16).toString('hex')
    repositoryPreviews.set(token, { preview, createdAt: Date.now() })
    while (repositoryPreviews.size > 8) {
      const oldest = repositoryPreviews.keys().next().value
      repositoryPreviews.delete(oldest)
    }
    return token
  }

  function capabilitiesRoot() {
    return resolvePaths(getUserData()).root
  }

  function buildInstallStoreMap() {
    const loaded = store.loadInstallStore()
    const map = { skills: {}, experts: {}, connectors: {} }
    for (const entry of Object.values(loaded.entries || {})) {
      if (entry.kind === 'skill') map.skills[entry.id] = entry
      if (entry.kind === 'expert') map.experts[entry.id] = entry
      if (entry.kind === 'connector') map.connectors[entry.id] = entry
    }
    return map
  }

  async function runSkillScriptInSandbox(ctx = {}) {
    const agentSandbox = require('./agent-sandbox')
    const permissions = agentSandbox.normalizeSandboxPermissions(ctx.permissions || {}, {})
    const scriptsRoot = String(ctx.scriptsRoot || ctx.skillRoot || '').trim()
    if (!scriptsRoot) return fail('invalid_path', '技能 scripts 目录无效')

    const scriptAbs = String(ctx.scriptAbs || '').trim()
    const rel = path.relative(scriptsRoot, scriptAbs)
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      return fail('invalid_path', '脚本必须在技能 scripts/ 目录内')
    }

    const ext = path.extname(scriptAbs).toLowerCase()
    const sandboxTools = agentSandbox.buildSandboxTools({
      workdir: scriptsRoot,
      permissions,
    })

    if (ext === '.py') {
      const code = fs.readFileSync(scriptAbs, 'utf8')
      return sandboxTools.handlers.run_python({ code })
    }
    if (ext === '.js' || ext === '.mjs') {
      const command = process.platform === 'win32'
        ? `node "${scriptAbs.replace(/"/g, '\\"')}"`
        : `node ${JSON.stringify(scriptAbs)}`
      return sandboxTools.handlers.run_shell({ command })
    }
    if (ext === '.sh' || ext === '.bash') {
      const command = process.platform === 'win32'
        ? `bash "${scriptAbs.replace(/"/g, '\\"')}"`
        : `bash ${JSON.stringify(scriptAbs)}`
      return sandboxTools.handlers.run_shell({ command })
    }
    return fail('unsupported_script', `不支持的脚本类型: ${ext || '(无扩展名)'}`)
  }

  function skillRuntime() {
    return createSkillRuntime({
      capabilitiesRoot: capabilitiesRoot(),
      knowledgeDir: getKnowledgeDir(),
      getInstallStore: buildInstallStoreMap,
      runScript: (ctx) => runSkillScriptInSandbox(ctx),
    })
  }

  function expertRuntime() {
    const rt = createSkillRuntime({
      capabilitiesRoot: capabilitiesRoot(),
      knowledgeDir: getKnowledgeDir(),
      getInstallStore: buildInstallStoreMap,
    })
    return createExpertRuntime({
      capabilitiesRoot: capabilitiesRoot(),
      getSkillHashes: (ids) => {
        const out = {}
        for (const id of ids) {
          const rec = rt.findSkillRecord(id)
          if (rec) out[id] = rec.contentHash || ''
        }
        return out
      },
      getConnectorHashes: (ids) => Object.fromEntries(ids.map((id) => [id, `connector:${id}`])),
    })
  }

  function migrateConnectorsIfNeeded() {
    const userData = getUserData()
    const paths = resolvePaths(userData)
    fs.mkdirSync(paths.root, { recursive: true })
    const flagFile = path.join(paths.root, MIGRATION_FLAG)
    if (fs.existsSync(flagFile)) return { ok: true, skipped: true }

    const installStorePath = paths.installStore
    if (fs.existsSync(installStorePath)) {
      fs.copyFileSync(installStorePath, `${installStorePath}.bak`)
    }

    const connectors = connectorStore.loadConnectors(userData)
    const existing = store.loadInstallStore().entries || {}
    let migrated = 0

    for (const conn of connectors) {
      const id = String(conn.id || '').trim()
      if (!id || existing[id]) continue

      const installDir = path.join(paths.connectors, id)
      fs.mkdirSync(installDir, { recursive: true })
      const manifest = {
        id,
        kind: 'connector',
        name: conn.name || id,
        description: conn.description || '',
        version: '1.0.0',
        type: conn.type || 'mcp',
        enabled: conn.enabled !== false,
        mcp: conn.mcp || {},
        allowlist: conn.allowlist || [],
        migratedFrom: 'connectors.json',
        migratedAt: new Date().toISOString(),
      }
      fs.writeFileSync(
        path.join(installDir, 'manifest.json'),
        `${JSON.stringify(manifest, null, 2)}\n`,
        'utf8',
      )

      store.upsertEntry({
        id,
        kind: 'connector',
        source: id === 'feishu' ? 'curated' : 'custom',
        version: manifest.version,
        trust: id === 'feishu' ? 'bundled' : 'migrated',
        enabled: conn.enabled !== false,
        status: conn.enabled !== false ? 'enabled' : 'disabled',
      })
      migrated += 1
    }

    fs.writeFileSync(flagFile, `${new Date().toISOString()}\n`, 'utf8')
    return { ok: true, migrated, skipped: false }
  }

  async function connectorLifecycle(entry, enabled) {
    if (!entry || entry.kind !== 'connector') return ok()
    const connectors = connectorStore.loadConnectors(getUserData())
    const conn = connectors.find((c) => c.id === entry.id)
    if (!conn) return ok()
    if (conn.type === 'mcp' && conn.mcp) {
      if (enabled) await connectorCaps.onConnectorEnabled(entry.id, conn.mcp)
      else await connectorCaps.onConnectorDisabled(entry.id)
    }
    getConnectorsApi()?.upsertConnector?.({ id: entry.id, enabled: enabled === true })
    return ok()
  }

  async function listCapabilities(options = {}) {
    const result = listCatalog(getUserData(), { ...options, bundledRoot })
    const items = (result.entries || []).map(mapCatalogItemToHub)
    return ok({ items, version: result.version })
  }

  function publishImportedEntry(result) {
    if (!result?.ok || !result.entry || result.entry.source === 'curated') return result
    const entry = result.entry
    let name = entry.name || entry.id
    let description = entry.description || ''
    if (entry.kind === 'skill') {
      const loaded = skillRuntime().findSkillRecord(entry.id)
      if (loaded) {
        name = loaded.name || name
        description = loaded.description || description
      }
    } else if (entry.kind === 'expert') {
      const loaded = expertRuntime().loadExpert(entry.id)
      if (loaded.ok) {
        name = loaded.name || name
        description = loaded.description || description
      }
    } else if (entry.kind === 'connector') {
      const manifestPath = path.join(resolvePaths(getUserData()).connectors, entry.id, 'manifest.json')
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
        name = manifest.name || name
        description = manifest.description || description
        getConnectorsApi()?.upsertConnector?.({
          id: entry.id,
          title: name,
          type: manifest.type || 'mcp',
          enabled: entry.enabled !== false,
          allowlist: manifest.allowlist || [],
          mcp: manifest.mcp || {},
        })
      } catch { /* keep install metadata */ }
    }
    store.upsertEntry({ ...entry, name, description })
    catalogApi.upsertOverlayEntry({
      id: entry.id,
      kind: entry.kind,
      name,
      description,
      version: entry.version,
      source: entry.source,
      trust: entry.trust,
      categories: entry.kind === 'connector' ? ['自定义'] : [],
      tags: [entry.source],
      contentHash: entry.contentHash,
    })
    return result
  }

  async function scanCursorRepositoryForHub(payload = {}) {
    const folderPath = String(payload.path || '').trim()
    const preview = scanCursorRepository(folderPath)
    if (!preview.ok) return preview
    const previewToken = rememberRepositoryPreview(preview)
    return publicPreview(preview, previewToken)
  }

  async function importCursorRepository(payload = {}) {
    const previewToken = String(payload.previewToken || '').trim()
    const cached = repositoryPreviews.get(previewToken)
    if (!cached || Date.now() - cached.createdAt > 10 * 60 * 1000) {
      repositoryPreviews.delete(previewToken)
      return fail('preview_expired', '仓库预览已过期，请重新扫描')
    }
    if (payload.trustConfirmed !== true) {
      return {
        ok: false,
        needsTrust: true,
        code: 'trust_required',
        error: '请确认信任该本地 Cursor 仓库后再注册',
        preview: publicPreview(cached.preview, previewToken),
      }
    }
    const refreshed = scanCursorRepository(cached.preview.root)
    if (!refreshed.ok) return refreshed
    if (refreshed.contentHash !== cached.preview.contentHash) {
      const nextToken = rememberRepositoryPreview(refreshed)
      repositoryPreviews.delete(previewToken)
      return {
        ok: false,
        code: 'preview_stale',
        error: '仓库内容在确认前发生变化，请检查新预览后重试',
        preview: publicPreview(refreshed, nextToken),
      }
    }
    const result = registerCursorRepository(refreshed, {
      userData: getUserData(),
      store,
      catalog: catalogApi,
      expertRuntime: expertRuntime(),
      connectorsApi: getConnectorsApi(),
    })
    repositoryPreviews.delete(previewToken)
    return result
  }

  async function installCapability(payload = {}) {
    const id = String(payload.id || '').trim()
    if (!id) return fail('invalid_args', '缺少 catalog id')
    const entryResult = catalogApi.getCatalogEntry(id)
    if (!entryResult.ok) return entryResult
    if (entryResult.entry.source === 'curated' || entryResult.entry.catalogLayer === 'bundled') {
      return importApi.installCurated(id, { bundledRoot, enabled: payload.enabled !== false })
    }
    return fail('not_curated', '仅 curated 条目支持 catalog 安装')
  }

  async function uninstallCapability(payload = {}) {
    const id = String(payload.id || '').trim()
    if (!id) return fail('invalid_args', '缺少 id')
    const current = store.getEntry(id)
    if (!current.ok) return current
    if (current.entry.kind === 'connector') {
      await connectorCaps.onConnectorRemoved(id)
      connectorStore.removeConnector(getUserData(), id)
    }
    const result = store.uninstall(id)
    if (result.ok && current.entry.source !== 'curated') catalogApi.removeOverlayEntry(id)
    return result
  }

  async function enableCapability(payload = {}) {
    const id = String(payload.id || '').trim()
    const result = store.enable(id)
    if (result.ok) await connectorLifecycle(result.entry, true)
    return result
  }

  async function disableCapability(payload = {}) {
    const id = String(payload.id || '').trim()
    const result = store.disable(id)
    if (result.ok) await connectorLifecycle(result.entry, false)
    return result
  }

  async function updateCapability(payload = {}) {
    const id = String(payload.id || '').trim()
    const entryResult = catalogApi.getCatalogEntry(id)
    if (!entryResult.ok) return entryResult
    const sourceResult = catalogApi.getBundledInstallSource(entryResult.entry)
    if (!sourceResult.ok) return sourceResult
    return importApi.installCurated(id, { bundledRoot, enabled: true })
  }

  async function importCapability(payload = {}) {
    const source = String(payload.source || 'local').trim()
    const trustConfirmed = payload.trustConfirmed === true

    if (source === 'https') {
      const url = String(payload.url || '').trim()
      const result = await importApi.importFromHttps(url, { trustConfirmed })
      if (!result.ok && result.code === 'trust_required') {
        return { ok: false, needsTrust: true, code: 'trust_required', error: result.error, originUrl: url }
      }
      return publishImportedEntry(result)
    }

    if (source === 'local') {
      const folderPath = String(payload.path || '').trim()
      if (!folderPath) return fail('invalid_args', '缺少本地目录 path')
      const result = importApi.importFromFolder(folderPath, { trustConfirmed })
      if (!result.ok && result.code === 'trust_required') {
        return { ok: false, needsTrust: true, code: 'trust_required', error: result.error, originUrl: folderPath }
      }
      return publishImportedEntry(result)
    }

    if (source === 'zip') {
      const zipPath = String(payload.path || '').trim()
      if (!zipPath) return fail('invalid_args', '缺少 ZIP path')
      const result = importApi.importFromZipFile(zipPath, { trustConfirmed })
      if (!result.ok && result.code === 'trust_required') {
        return { ok: false, needsTrust: true, code: 'trust_required', error: result.error, originUrl: zipPath }
      }
      return publishImportedEntry(result)
    }

    if (source === 'custom') {
      const kind = String(payload.kind || 'skill').trim()
      const staged = stageMinimalPackage(getUserData(), kind, payload)
      if (!staged.ok) return staged
      const result = importApi.importFromFolder(staged.stagingPath, {
        source: 'custom',
        id: payload.id,
        trustConfirmed: true,
      })
      return publishImportedEntry(result)
    }

    return fail('unsupported_source', `不支持的导入来源: ${source}`)
  }

  function buildSkillToolsForSession(session, sandboxPermissions) {
    const bindings = getSessionCapabilityBindings(session, expertRuntime())
    return buildSkillTools({
      capabilitiesRoot: capabilitiesRoot(),
      knowledgeDir: getKnowledgeDir(),
      getInstallStore: buildInstallStoreMap,
      allowedSkillIds: bindings.allowedSkillIds,
      runScript: (ctx) => runSkillScriptInSandbox({
        ...ctx,
        permissions: sandboxPermissions || session?.run?.permissions || {},
      }),
    })
  }

  function filterConnectorsForSession(session, connectors) {
    const bindings = getSessionCapabilityBindings(session, expertRuntime())
    if (!bindings.allowedConnectorIds?.length) return connectors
    const allow = new Set(bindings.allowedConnectorIds)
    return connectors.filter((c) => allow.has(c.id))
  }

  function assembleContextForSession(session, prompt, slashRefs, tier, legacySkillContext) {
    return assembleCapabilityContext({
      session,
      prompt,
      slashRefs,
      tier,
      expertRuntime: expertRuntime(),
      skillRuntime: skillRuntime(),
      legacySkillContext,
    })
  }

  function sessionDto(session) {
    let expertName = ''
    if (session.expertId) {
      const loaded = expertRuntime().loadExpert(session.expertId)
      if (loaded.ok) expertName = loaded.name
    }
    return { ...session, expertName }
  }

  function registerIpcHandlers(handlers = {}) {
    const showOpenDialog = handlers.showOpenDialog

    ipcMain.handle('capability-list', (_e, opts) => listCapabilities(opts || {}))
    ipcMain.handle('capability-install', (_e, payload) => installCapability(payload || {}))
    ipcMain.handle('capability-uninstall', (_e, payload) => uninstallCapability(payload || {}))
    ipcMain.handle('capability-enable', (_e, payload) => enableCapability(payload || {}))
    ipcMain.handle('capability-disable', (_e, payload) => disableCapability(payload || {}))
    ipcMain.handle('capability-update', (_e, payload) => updateCapability(payload || {}))
    ipcMain.handle('capability-import', (_e, payload) => importCapability(payload || {}))
    ipcMain.handle('capability-scan-cursor-repository', (_e, payload) =>
      scanCursorRepositoryForHub(payload || {}))
    ipcMain.handle('capability-import-cursor-repository', (_e, payload) =>
      importCursorRepository(payload || {}))

    ipcMain.handle('capability-pick-local-folder', async (e) => {
      if (!showOpenDialog) return fail('unavailable', '文件对话框不可用')
      const result = await showOpenDialog(e.sender, {
        title: '选择能力包文件夹',
        properties: ['openDirectory'],
      })
      if (result.canceled || !result.filePaths?.length) return ok({ canceled: true })
      return ok({ path: result.filePaths[0] })
    })

    ipcMain.handle('capability-pick-zip-file', async (e) => {
      if (!showOpenDialog) return fail('unavailable', '文件对话框不可用')
      const result = await showOpenDialog(e.sender, {
        title: '选择 ZIP 能力包',
        properties: ['openFile'],
        filters: [{ name: 'ZIP', extensions: ['zip'] }],
      })
      if (result.canceled || !result.filePaths?.length) return ok({ canceled: true })
      return ok({ path: result.filePaths[0] })
    })

    ipcMain.handle('capability-pick-cursor-repository', async (e) => {
      if (!showOpenDialog) return fail('unavailable', '文件对话框不可用')
      const result = await showOpenDialog(e.sender, {
        title: '选择 Cursor 智能体仓库',
        properties: ['openDirectory'],
      })
      if (result.canceled || !result.filePaths?.length) return ok({ canceled: true })
      return ok({ path: result.filePaths[0] })
    })

    ipcMain.handle('skill-list', () => {
      const items = skillRuntime().listSlashPickerItems()
      const skills = items.map((item) => ({
        id: item.id,
        title: item.name,
        slash: item.slash,
        description: item.description || '',
        source: item.source,
        legacy: item.legacy === true,
      }))
      return ok({ skills, items })
    })

    ipcMain.handle('skill-load', (_e, payload = {}) => {
      const skillId = String(payload.skillId || payload.id || '').trim()
      const sessionId = String(payload.sessionId || '').trim()
      let filterOpts = {}
      if (sessionId && deps.loadAgentStore) {
        const { sessions } = deps.loadAgentStore()
        const session = sessions.find((s) => s.id === sessionId)
        if (session) {
          const bindings = getSessionCapabilityBindings(session, expertRuntime())
          if (bindings.allowedSkillIds) filterOpts = { allowedIds: bindings.allowedSkillIds }
        }
      }
      const result = skillRuntime().loadSkillL1(skillId, filterOpts)
      return result.ok ? ok(result) : result
    })

    ipcMain.handle('skill-read-resource', (_e, payload = {}) => {
      const result = skillRuntime().readSkillResource(
        payload.skillId || payload.id,
        payload.path || payload.resource,
      )
      return result.ok ? ok(result) : result
    })

    ipcMain.handle('skill-run-script', async (_e, payload = {}) => {
      const sessionId = String(payload.sessionId || '').trim()
      let permissions = payload.permissions || {}
      if (sessionId && deps.loadAgentStore) {
        const { sessions } = deps.loadAgentStore()
        const session = sessions.find((s) => s.id === sessionId)
        if (session?.run?.permissions) permissions = session.run.permissions
      }
      const result = await skillRuntime().runSkillScript(
        payload.skillId || payload.id,
        payload.script || payload.scriptPath,
        payload.args || {},
        permissions,
      )
      return result.ok ? ok(result) : result
    })

    ipcMain.handle('skill-migrate-legacy', (_e, payload = {}) => {
      const result = skillRuntime().exportLegacyToSkillMd(
        payload.legacySkillId || payload.id,
        payload.targetId,
      )
      return result.ok ? ok(result) : result
    })

    ipcMain.handle('expert-list', () => ok({ experts: expertRuntime().listExperts() }))

    ipcMain.handle('expert-get', (_e, expertId) => {
      const result = expertRuntime().loadExpert(expertId)
      return result.ok ? ok({ expert: result }) : result
    })

    ipcMain.handle('expert-save', (_e, payload = {}) => {
      const result = expertRuntime().saveExpert(payload.id || payload.expertId, payload)
      return result.ok ? ok(result) : result
    })

    ipcMain.handle('expert-snapshot', (_e, payload = {}) => {
      const result = expertRuntime().createSessionSnapshot(
        String(payload.sessionId || '').trim(),
        String(payload.expertId || '').trim(),
      )
      return result.ok ? ok(result) : result
    })

    ipcMain.handle('expert-try-chat', (_e, payload = {}) => {
      const result = expertRuntime().buildTryChatSession(String(payload.expertId || '').trim(), payload)
      return result.ok ? ok({ session: result.session, ephemeral: true }) : result
    })

    ipcMain.handle('connector-health', async (_e, payload = {}) => {
      const connectorId = String(payload.connectorId || payload.id || '').trim()
      const connectors = connectorStore.loadConnectors(getUserData())
      const conn = connectors.find((c) => c.id === connectorId)
      if (!conn) return fail('not_found', '连接器不存在')
      if (conn.type !== 'mcp') {
        return ok({ state: conn.enabled ? 'enabled' : 'disabled', toolsCount: 0 })
      }
      const probe = await connectorCaps.probeMcpHealth(conn.mcp || {})
      return probe.ok ? ok(probe) : probe
    })

    ipcMain.handle('connector-tools-preview', async (_e, payload = {}) => {
      const connectorId = String(payload.connectorId || payload.id || '').trim()
      const connectors = connectorStore.loadConnectors(getUserData())
      const conn = connectors.find((c) => c.id === connectorId)
      if (!conn) return fail('not_found', '连接器不存在')
      const preview = await connectorCaps.previewMcpTools(conn)
      return preview.ok ? ok(preview) : preview
    })

    ipcMain.handle('connector-save-allowlist', (_e, payload = {}) => {
      const connectorId = String(payload.connectorId || payload.id || '').trim()
      const allowlist = Array.isArray(payload.allowlist) ? payload.allowlist : []
      const result = connectorStore.setAllowlist(getUserData(), connectorId, allowlist)
      if (!result.ok) return result
      getConnectorsApi()?.upsertConnector?.({ id: connectorId, allowlist })
      return ok({ connectorId, allowlist })
    })
  }

  return {
    IPC_CHANNELS,
    migrateConnectorsIfNeeded,
    listCapabilities,
    installCapability,
    uninstallCapability,
    enableCapability,
    disableCapability,
    updateCapability,
    importCapability,
    scanCursorRepositoryForHub,
    importCursorRepository,
    skillRuntime,
    expertRuntime,
    buildSkillToolsForSession,
    filterConnectorsForSession,
    assembleContextForSession,
    sessionDto,
    registerIpcHandlers,
    capabilitiesRoot,
  }
}

module.exports = {
  IPC_CHANNELS,
  createCapabilityHubService,
  mapCatalogItemToHub,
  createMinimalPackage,
}
