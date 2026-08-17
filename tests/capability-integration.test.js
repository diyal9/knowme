'use strict'
const { readPreload } = require('./helpers/current-src')

const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')

const { IPC_CHANNELS, createCapabilityHubService, createMinimalPackage } = require('../src/lib/capability-hub-service')
const { assembleCapabilityContext, isLegacySlashRef } = require('../src/lib/agent-context-assembly')
const { createSession, normalizeSession } = require('../src/lib/agent-sessions')
const { buildSkillTools, SKILL_TOOL_NAMES } = require('../src/lib/agent-skill-tools')
const { createCapabilityStore } = require('../src/lib/capability-store')
const { readMainIpcBundle } = require('./helpers/main-ipc-bundle')
const preload = readPreload()
const mainSource = readMainIpcBundle()

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'km-cap-int-'))
}

describe('capability integration wiring', () => {
  it('exports complete IPC channel contract', () => {
    const all = [
      ...IPC_CHANNELS.capability,
      ...IPC_CHANNELS.skill,
      ...IPC_CHANNELS.expert,
      ...IPC_CHANNELS.connector,
    ]
    assert.equal(all.length, 31)
    assert.ok(all.includes('capability-favorite-list'))
    assert.ok(all.includes('capability-favorite-toggle'))
    assert.ok(all.includes('capability-list'))
    assert.ok(all.includes('capability-scan-cursor-repository'))
    assert.ok(all.includes('capability-import-cursor-repository'))
    assert.ok(all.includes('capability-import-precheck'))
    assert.ok(all.includes('capability-install-precheck'))
    assert.ok(all.includes('skill-run-script'))
    assert.ok(all.includes('skill-task-list'))
    assert.ok(all.includes('expert-try-chat'))
    assert.ok(all.includes('expert-delete'))
    assert.ok(all.includes('connector-save-allowlist'))
  })

  it('preload exposes knowme capability/skill/expert/connector APIs', () => {
    assert.match(preload, /exposeInMainWorld\('knowme'/)
    assert.match(preload, /capability-list/)
    assert.match(preload, /capability-scan-cursor-repository/)
    assert.match(preload, /capability-import-cursor-repository/)
    assert.match(preload, /skill-list/)
    assert.match(preload, /skill-task-list/)
    assert.match(preload, /expert-try-chat/)
    assert.match(preload, /expert-delete/)
    assert.match(preload, /connector-health/)
    assert.match(preload, /capabilityList:/)
  })

  it('isolates Electron smoke user data behind the explicit test seam', () => {
    assert.match(mainSource, /KNOWME_TEST_SEAM\s*===\s*'1'/)
    assert.match(mainSource, /KNOWME_TEST_USER_DATA_DIR/)
    assert.match(mainSource, /\.join\((?:scope\.|ctx\.)?app\.getPath\('appData'\),\s*'KnowMe'\)/)
  })

  it('wires pack dependency manifests and blocks unavailable required tools in main', () => {
    assert.match(mainSource, /getAvailableCapabilityManifests:/)
    assert.match(mainSource, /capability-catalog'\)\.listCatalog/)
    assert.match(mainSource, /unavailableRequiredTools/)
    assert.match(mainSource, /所需工具不可用/)
    assert.match(mainSource, /taskCatalog = ensureCapabilityHub\(\)\.listSkillTasks\(\)/)
    assert.match(mainSource, /任务入口已失效或与 Skill 不匹配/)
  })

  it('assembleCapabilityContext merges expert persona and skill L0', () => {
    const session = { id: 's1', expertId: 'office-partner' }
    const expertRuntime = {
      getSessionPersona: () => ({
        ok: true,
        persona: { name: '办公搭档', systemPrompt: '你是办公专家' },
        bindings: { skills: ['writing-polish'], connectors: ['feishu'] },
      }),
    }
    const skillRuntime = {
      autoMatchSkills: () => [{ id: 'writing-polish', name: '文档润色', slash: 'doc-polish', description: '润色' }],
      findSkillRecord: () => null,
      listSlashPickerItems: () => [],
      loadSkillL1: () => ({ ok: false }),
    }
    const result = assembleCapabilityContext({
      session,
      prompt: '帮我润色邮件',
      slashRefs: [],
      tier: 'retrieval',
      expertRuntime,
      skillRuntime,
    })
    assert.match(result.expertBlock, /办公搭档/)
    assert.match(result.skillL0Block, /文档润色/)
    assert.match(result.dynamicCapabilityContext, /专家 SOP · 办公搭档/)
  })

  it('legacy slash refs stay on legacySkillContext path', () => {
    const legacyCtx = '【Legacy OKF】/kb-steward 技能正文'
    const skillRuntime = {
      autoMatchSkills: () => [],
      findSkillRecord: (ref) => (ref === 'kb-steward' ? { id: 'legacy:kb-steward', source: 'legacy-okf', slash: 'kb-steward' } : null),
      listSlashPickerItems: () => [],
      loadSkillL1: () => ({ ok: false }),
    }
    const result = assembleCapabilityContext({
      session: {},
      prompt: '整理知识库',
      slashRefs: ['kb-steward'],
      tier: 'retrieval',
      expertRuntime: null,
      skillRuntime,
      legacySkillContext: legacyCtx,
    })
    assert.match(result.skillL1Block, /Legacy OKF/)
    assert.ok(isLegacySlashRef('kb-steward'))
  })

  it('createMinimalPackage builds skill/expert/connector stubs', () => {
    const skill = createMinimalPackage('skill', { id: 'my-skill', name: 'My Skill' })
    assert.equal(skill.ok, true)
    assert.ok(skill.files['SKILL.md'].includes('My Skill'))

    const expert = createMinimalPackage('expert', { id: 'my-expert', name: 'Expert', systemPrompt: 'Be helpful' })
    assert.ok(expert.files['EXPERT.md'].includes('Be helpful'))

    const conn = createMinimalPackage('connector', { id: 'my-conn', name: 'Conn' })
    assert.ok(conn.files['manifest.json'].includes('"kind": "connector"'))
  })

  it('migrateConnectorsIfNeeded is idempotent with backup', () => {
    const userData = tmpDir()
    const connectorsFile = path.join(userData, 'connectors.json')
    fs.writeFileSync(connectorsFile, JSON.stringify({
      version: 1,
      connectors: [{
        id: 'feishu',
        name: '飞书',
        type: 'feishu',
        enabled: true,
        allowlist: ['feishu.search_docs'],
      }],
    }, null, 2))

    const hub = createCapabilityHubService({
      getUserData: () => userData,
      getKnowledgeDir: () => path.join(userData, 'knowledge'),
      getConnectorsApi: () => ({ upsertConnector: () => {} }),
      bundledRoot: path.join(__dirname, '../src/catalog'),
    })

    const first = hub.migrateConnectorsIfNeeded()
    assert.equal(first.skipped, false)
    assert.ok(first.migrated >= 1)

    const installStore = path.join(userData, 'capabilities', 'install-store.json')
    assert.ok(fs.existsSync(installStore))

    const second = hub.migrateConnectorsIfNeeded()
    assert.equal(second.skipped, true)
  })

  it('scans and imports a Cursor repository only after explicit trust', async () => {
    const userData = tmpDir()
    const repo = tmpDir()
    fs.mkdirSync(path.join(repo, '.cursor', 'skills', 'repo-helper'), { recursive: true })
    fs.writeFileSync(path.join(repo, '.cursor', 'skills', 'repo-helper', 'SKILL.md'), `---
name: Repository Helper
description: Linked repository helper
---
# Helper
Use linked files.
`, 'utf8')
    const hub = createCapabilityHubService({
      getUserData: () => userData,
      getKnowledgeDir: () => path.join(userData, 'knowledge'),
      getConnectorsApi: () => ({ upsertConnector: () => ({ ok: true }) }),
      bundledRoot: path.join(__dirname, '../src/catalog'),
    })

    const preview = await hub.scanCursorRepositoryForHub({ path: repo })
    assert.equal(preview.ok, true)
    assert.equal(preview.counts.skills, 1)
    assert.equal(preview.counts.experts, 1)

    const untrusted = await hub.importCursorRepository({ previewToken: preview.previewToken })
    assert.equal(untrusted.needsTrust, true)

    const imported = await hub.importCursorRepository({
      previewToken: preview.previewToken,
      trustConfirmed: true,
    })
    assert.equal(imported.ok, true)
    assert.equal(imported.counts.installed, 2)

    const listed = await hub.listCapabilities()
    assert.ok(listed.items.some((item) => item.id === imported.idMaps.skills['repo-helper']))

    fs.rmSync(userData, { recursive: true, force: true })
    fs.rmSync(repo, { recursive: true, force: true })
  })

  it('backfills Chinese display names for previously imported experts, idempotently', async () => {
    const userData = tmpDir()
    const store = createCapabilityStore({ userData })
    const expertDir = path.join(userData, 'capabilities', 'experts', 'legacy-expert')
    fs.mkdirSync(expertDir, { recursive: true })
    fs.writeFileSync(path.join(expertDir, 'EXPERT.md'), `---
name: "legacy-expert"
description: "配置协作助手：负责配置表校验与发布。"
avatar: ""
skills: []
connectors: []
systemPrompt: "你是配置协作助手。"
---
`, 'utf8')
    store.upsertEntry({
      id: 'legacy-expert',
      kind: 'expert',
      source: 'local-repo',
      status: 'enabled',
      enabled: true,
      name: 'legacy-expert',
    })

    const hub = createCapabilityHubService({
      getUserData: () => userData,
      getKnowledgeDir: () => path.join(userData, 'knowledge'),
      getConnectorsApi: () => null,
      bundledRoot: path.join(__dirname, '../src/catalog'),
    })

    const first = hub.backfillExpertDisplayNames()
    assert.deepEqual(first.renamed.map((item) => item.name), ['配置协作助手'])
    const entry = createCapabilityStore({ userData }).loadInstallStore().entries['legacy-expert']
    assert.equal(entry.name, '配置协作助手')
    assert.equal(entry.originName, 'legacy-expert')
    assert.equal(entry.nameSource, 'derived')

    const listed = await hub.listCapabilities({ kind: 'expert' })
    const item = listed.items.find((it) => it.id === 'legacy-expert')
    assert.equal(item.name, '配置协作助手')
    assert.equal(item.originName, 'legacy-expert')

    assert.deepEqual(hub.backfillExpertDisplayNames().renamed, [])

    fs.rmSync(userData, { recursive: true, force: true })
  })

  it('keeps a curated expert on its catalog display name during backfill', () => {
    const userData = tmpDir()
    const store = createCapabilityStore({ userData })
    const expertDir = path.join(userData, 'capabilities', 'experts', 'office-partner')
    fs.mkdirSync(expertDir, { recursive: true })
    fs.writeFileSync(path.join(expertDir, 'EXPERT.md'), `---
name: "office-partner"
description: "日常办公多能力专家：写作润色与飞书协作。"
avatar: ""
skills: []
connectors: []
systemPrompt: "你是办公伙伴。"
---
`, 'utf8')
    store.upsertEntry({
      id: 'office-partner',
      kind: 'expert',
      source: 'curated',
      status: 'enabled',
      enabled: true,
    })

    const hub = createCapabilityHubService({
      getUserData: () => userData,
      getKnowledgeDir: () => path.join(userData, 'knowledge'),
      getConnectorsApi: () => null,
      bundledRoot: path.join(__dirname, '../src/catalog'),
    })
    assert.deepEqual(hub.backfillExpertDisplayNames().renamed, [])

    fs.rmSync(userData, { recursive: true, force: true })
  })

  it('keeps a user-renamed expert out of the display-name backfill', () => {
    const userData = tmpDir()
    const store = createCapabilityStore({ userData })
    const expertDir = path.join(userData, 'capabilities', 'experts', 'kept-expert')
    fs.mkdirSync(expertDir, { recursive: true })
    fs.writeFileSync(path.join(expertDir, 'EXPERT.md'), `---
name: "kept-expert"
description: "配置协作助手：负责配置表校验与发布。"
avatar: ""
skills: []
connectors: []
systemPrompt: "你是配置协作助手。"
---
`, 'utf8')
    store.upsertEntry({
      id: 'kept-expert',
      kind: 'expert',
      source: 'local-repo',
      status: 'enabled',
      enabled: true,
      name: 'kept-expert',
      nameSource: 'user',
    })

    const hub = createCapabilityHubService({
      getUserData: () => userData,
      getKnowledgeDir: () => path.join(userData, 'knowledge'),
      getConnectorsApi: () => null,
      bundledRoot: path.join(__dirname, '../src/catalog'),
    })
    assert.deepEqual(hub.backfillExpertDisplayNames().renamed, [])
    assert.equal(store.loadInstallStore().entries['kept-expert'].name, 'kept-expert')

    fs.rmSync(userData, { recursive: true, force: true })
  })

  it('exposes governance metadata and blocks missing dependencies or unconfirmed risk', async () => {
    const userData = tmpDir()
    const store = createCapabilityStore({ userData })
    store.upsertEntry({
      id: 'governed-skill',
      kind: 'skill',
      source: 'custom',
      status: 'disabled',
      enabled: false,
      manifest: {
        schemaVersion: 2,
        id: 'governed-skill',
        kind: 'skill',
        name: 'Governed Skill',
        version: '1.0.0',
        dependencies: [{ id: 'required-connector', kind: 'connector', required: true }],
        permissions: { filesystem: ['read'] },
        risk: { level: 'low', reasons: [] },
        provenance: { source: 'test', ref: 'fixture' },
      },
    })
    store.upsertEntry({
      id: 'high-risk-skill',
      kind: 'skill',
      source: 'custom',
      status: 'disabled',
      enabled: false,
      manifest: {
        schemaVersion: 2,
        id: 'high-risk-skill',
        kind: 'skill',
        name: 'High Risk Skill',
        version: '1.0.0',
        risk: { level: 'high', reasons: ['executes scripts'] },
        provenance: { source: 'test' },
      },
    })
    const hub = createCapabilityHubService({
      getUserData: () => userData,
      getKnowledgeDir: () => path.join(userData, 'knowledge'),
      getConnectorsApi: () => null,
      bundledRoot: path.join(__dirname, '../src/catalog'),
    })

    const listed = await hub.listCapabilities({ kind: 'skill' })
    const governed = listed.items.find(item => item.id === 'governed-skill')
    assert.equal(governed.dependencies[0].id, 'required-connector')
    assert.deepEqual(governed.permissions.filesystem, ['read'])
    assert.equal(governed.provenance.ref, 'fixture')

    const missing = await hub.enableCapability({ id: 'governed-skill' })
    assert.equal(missing.code, 'dependency_conflict')
    const unconfirmed = await hub.enableCapability({ id: 'high-risk-skill' })
    assert.equal(unconfirmed.code, 'risk_confirmation_required')
    const confirmed = await hub.enableCapability({ id: 'high-risk-skill', riskConfirmed: true })
    assert.equal(confirmed.ok, true)
  })

  it('buildSkillToolsForSession exposes four skill tool names', () => {
    const userData = tmpDir()
    fs.mkdirSync(path.join(userData, 'capabilities', 'skills'), { recursive: true })
    const hub = createCapabilityHubService({
      getUserData: () => userData,
      getKnowledgeDir: () => path.join(userData, 'knowledge'),
      getConnectorsApi: () => null,
      bundledRoot: path.join(__dirname, '../src/catalog'),
    })
    const session = createSession('general', 1)
    const tools = hub.buildSkillToolsForSession(session, { allowNetwork: false })
    const names = tools.definitions.map(d => d.function.name)
    assert.deepEqual(names.sort(), [...SKILL_TOOL_NAMES].sort())
  })

  it('saveExpert publishes into catalog so mine filter can resolve user-created experts', async () => {
    const userData = tmpDir()
    const hub = createCapabilityHubService({
      getUserData: () => userData,
      getKnowledgeDir: () => path.join(userData, 'knowledge'),
      getConnectorsApi: () => null,
      bundledRoot: path.join(__dirname, '../src/catalog'),
    })

    const saved = hub.saveExpert({
      id: 'my-self-expert',
      name: '自测专家',
      description: '用户创建的专家应进入列表',
      systemPrompt: '你是自测专家',
      skills: [],
      connectors: [],
      source: 'local',
    })
    assert.equal(saved.ok, true, saved.error || saved.message || 'save should succeed')
    assert.equal(saved.id || saved.result?.id, 'my-self-expert')

    const installStore = JSON.parse(
      fs.readFileSync(path.join(userData, 'capabilities', 'install-store.json'), 'utf8'),
    )
    assert.ok(installStore.entries['my-self-expert'], 'install store receives published expert')
    assert.equal(installStore.entries['my-self-expert'].source, 'local')
    assert.equal(installStore.entries['my-self-expert'].enabled, true)

    const listed = await hub.listCapabilities({ kind: 'expert' })
    assert.equal(listed.ok, true)
    const mine = listed.items.find((item) => item.id === 'my-self-expert')
    assert.ok(mine, 'capability list includes saved expert')
    assert.equal(mine.name, '自测专家')
    assert.ok(['local', 'custom'].includes(mine.source), `user source expected, got ${mine.source}`)

    const deleted = hub.deleteExpert({ id: 'my-self-expert' })
    assert.equal(deleted.ok, true, deleted.error || deleted.message || 'delete should succeed')
    const after = await hub.listCapabilities({ kind: 'expert' })
    assert.ok(!after.items.find((item) => item.id === 'my-self-expert'), 'deleted expert leaves catalog')
    assert.equal(
      fs.existsSync(path.join(userData, 'capabilities', 'experts', 'my-self-expert')),
      false,
      'expert package directory removed',
    )
    const blocked = hub.deleteExpert({ id: 'office-partner', source: 'curated' })
    assert.equal(blocked.ok, false)
    assert.equal(blocked.code, 'readonly_bundled_expert')

    fs.rmSync(userData, { recursive: true, force: true })
  })

  it('listCapabilities surfaces orphan expert packages not yet registered', async () => {
    const userData = tmpDir()
    const expertDir = path.join(userData, 'capabilities', 'experts', 'orphan-expert')
    fs.mkdirSync(expertDir, { recursive: true })
    fs.writeFileSync(path.join(expertDir, 'EXPERT.md'), `---
name: "孤儿专家"
description: "仅有落盘未登记"
avatar: ""
skills: []
connectors: []
systemPrompt: "你是孤儿专家。"
---
`, 'utf8')

    const hub = createCapabilityHubService({
      getUserData: () => userData,
      getKnowledgeDir: () => path.join(userData, 'knowledge'),
      getConnectorsApi: () => null,
      bundledRoot: path.join(__dirname, '../src/catalog'),
    })
    const listed = await hub.listCapabilities({ kind: 'expert' })
    const orphan = listed.items.find((item) => item.id === 'orphan-expert')
    assert.ok(orphan, 'orphan expert appears in list')
    assert.equal(orphan.source, 'custom')
    assert.equal(orphan.name, '孤儿专家')

    fs.rmSync(userData, { recursive: true, force: true })
  })

  it('session model persists expert snapshot and ephemeral fields', () => {
    const raw = normalizeSession({
      id: 's_expert',
      agentId: 'general',
      expertId: 'office-partner',
      capabilitySnapshotId: 's_expert:office-partner',
      snapshotPath: '/tmp/snap.json',
      ephemeral: false,
    })
    assert.equal(raw.expertId, 'office-partner')
    assert.equal(raw.capabilitySnapshotId, 's_expert:office-partner')
    assert.equal(raw.snapshotPath, '/tmp/snap.json')
    assert.equal(raw.ephemeral, false)

    const ephemeral = createSession('general', 1, { expertId: 'x', ephemeral: true })
    assert.equal(ephemeral.ephemeral, true)
    assert.equal(ephemeral.expertId, 'x')
  })

  it('buildSkillTools merges standard four-tool surface', () => {
    const userData = tmpDir()
    const tools = buildSkillTools({
      capabilitiesRoot: path.join(userData, 'capabilities'),
      knowledgeDir: path.join(userData, 'knowledge'),
      getInstallStore: () => ({ skills: {}, experts: {}, connectors: {} }),
      allowedSkillIds: null,
      runScript: async () => ({ ok: true }),
    })
    assert.equal(tools.definitions.length, 4)
    assert.ok(tools.handlers.run_skill_script)
  })
})
