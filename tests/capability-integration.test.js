'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')

const { IPC_CHANNELS, createCapabilityHubService, createMinimalPackage } = require('../src/lib/capability-hub-service')
const { assembleCapabilityContext, isLegacySlashRef } = require('../src/lib/agent-context-assembly')
const { createSession, normalizeSession } = require('../src/lib/agent-sessions')
const { buildSkillTools, SKILL_TOOL_NAMES } = require('../src/lib/agent-skill-tools')
const preload = fs.readFileSync(path.join(__dirname, '../src/preload.js'), 'utf8')

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
    assert.equal(all.length, 25)
    assert.ok(all.includes('capability-list'))
    assert.ok(all.includes('capability-scan-cursor-repository'))
    assert.ok(all.includes('capability-import-cursor-repository'))
    assert.ok(all.includes('skill-run-script'))
    assert.ok(all.includes('expert-try-chat'))
    assert.ok(all.includes('connector-save-allowlist'))
  })

  it('preload exposes knowme capability/skill/expert/connector APIs', () => {
    assert.match(preload, /exposeInMainWorld\('knowme'/)
    assert.match(preload, /capability-list/)
    assert.match(preload, /capability-scan-cursor-repository/)
    assert.match(preload, /capability-import-cursor-repository/)
    assert.match(preload, /skill-list/)
    assert.match(preload, /expert-try-chat/)
    assert.match(preload, /connector-health/)
    assert.match(preload, /capabilityList:/)
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
    assert.match(result.dynamicCapabilityContext, /专家 persona/)
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
