'use strict'

const { describe, it, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const repository = require('../src/lib/cursor-capability-repository')
const storeLib = require('../src/lib/capability-store')
const catalogLib = require('../src/lib/capability-catalog')
const { createExpertRuntime } = require('../src/lib/expert-runtime')
const { createSkillRuntime } = require('../src/lib/skill-runtime')
const { createConnectorsApi } = require('../src/lib/connectors')

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content, 'utf8')
}

function createRepo(root, options = {}) {
  write(path.join(root, '.cursor', 'skills', 'alpha', 'SKILL.md'), `---
name: alpha
description: Alpha skill
---
# Alpha
Use repository context.
`)
  write(path.join(root, '.cursor', 'skills', 'alpha', 'references', 'guide.md'), 'linked guide')
  if (options.skillOnly !== true) {
    write(path.join(root, '.cursor', 'agents', 'artist', 'AGENT.md'), `---
name: artist
description: >-
  Repository artist expert.
persona:
  role: Artist
---
# Artist
Work carefully.
`)
    write(path.join(root, '.cursor', 'agents', 'artist', 'agent.manifest.json'), JSON.stringify({
      id: 'artist',
      version: '1.0.0',
      title: 'Artist',
      skills: { required: ['alpha', 'missing-skill'] },
    }, null, 2))
  }
  write(path.join(root, '.cursor', 'mcp.json'), JSON.stringify({
    mcpServers: {
      safe: {
        command: 'node',
        args: ['server.js'],
        env: { SERVICE_TOKEN: 'env:SERVICE_TOKEN' },
      },
      blocked: {
        command: 'node',
        args: ['blocked.js'],
        env: { apiKey: 'sk-1234567890abcdef' },
      },
    },
  }, null, 2))
}

describe('cursor capability repository', () => {
  let root
  let userData

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'km-cursor-repo-'))
    userData = fs.mkdtempSync(path.join(os.tmpdir(), 'km-cursor-user-'))
  })

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true })
    fs.rmSync(userData, { recursive: true, force: true })
  })

  function deps() {
    const store = storeLib.createCapabilityStore({ userData })
    const catalog = catalogLib.createCapabilityCatalog({
      userData,
      bundledRoot: path.join(__dirname, '..', 'src', 'catalog'),
    })
    const expertRuntime = createExpertRuntime({
      capabilitiesRoot: storeLib.resolvePaths(userData).root,
    })
    const connectorsApi = createConnectorsApi({ getUserData: () => userData })
    return { userData, store, catalog, expertRuntime, connectorsApi }
  }

  it('scans skills, agents and blocks plaintext MCP secrets without exposing values', () => {
    createRepo(root)
    const scanned = repository.scanCursorRepository(root)
    assert.equal(scanned.ok, true)
    assert.equal(scanned.skills.length, 1)
    assert.equal(scanned.experts.length, 1)
    assert.equal(scanned.connectors.length, 2)
    assert.equal(scanned.connectors.find((item) => item.sourceId === 'safe').blocked, false)
    assert.equal(scanned.connectors.find((item) => item.sourceId === 'blocked').blocked, true)
    assert.ok(scanned.warnings.some((item) => item.code === 'missing_agent_skills'))
    assert.ok(scanned.warnings.some((item) => item.code === 'mcp_secret'))

    const publicDto = repository.publicPreview(scanned, 'token')
    assert.equal(publicDto.previewToken, 'token')
    assert.equal(JSON.stringify(publicDto).includes('sk-1234567890abcdef'), false)
  })

  it('generates a repository expert for skill-only repositories', () => {
    createRepo(root, { skillOnly: true })
    const scanned = repository.scanCursorRepository(root)
    assert.equal(scanned.ok, true)
    assert.equal(scanned.experts.length, 1)
    assert.equal(scanned.experts[0].generated, true)
    assert.deepEqual(scanned.experts[0].declaredSkills, ['alpha'])
  })

  it('registers idempotently and exposes linked skills through runtime and catalog', () => {
    createRepo(root)
    const scanned = repository.scanCursorRepository(root)
    const first = repository.registerCursorRepository(scanned, deps())
    const second = repository.registerCursorRepository(scanned, deps())
    assert.equal(first.ok, true)
    assert.deepEqual(second.idMaps, first.idMaps)
    assert.equal(first.counts.installed, 3)
    assert.equal(first.counts.skipped, 1)

    const installed = storeLib.loadInstallStore(userData)
    const skillId = first.idMaps.skills.alpha
    assert.equal(installed.entries[skillId].linked, true)
    assert.equal(installed.entries[skillId].originRoot, fs.realpathSync(root))

    const runtime = createSkillRuntime({
      capabilitiesRoot: storeLib.resolvePaths(userData).root,
      getInstallStore: () => ({
        skills: Object.fromEntries(
          Object.values(storeLib.loadInstallStore(userData).entries)
            .filter((entry) => entry.kind === 'skill')
            .map((entry) => [entry.id, entry]),
        ),
      }),
    })
    assert.ok(runtime.listSkillsL0().some((item) => item.id === skillId))
    assert.match(runtime.loadSkillL1(skillId).body, /Use repository context/)
    assert.equal(runtime.readSkillResource(skillId, 'references/guide.md').content, 'linked guide')

    const listed = catalogLib.listCatalog(userData, {
      bundledRoot: path.join(__dirname, '..', 'src', 'catalog'),
    })
    assert.ok(listed.entries.some((item) => item.id === skillId && item.installed))
    assert.ok(listed.entries.some((item) => item.id === first.idMaps.experts.artist && item.installed))
  })

  it('names conflicting capability ids deterministically', () => {
    createRepo(root)
    storeLib.upsertEntry(userData, {
      id: 'alpha',
      kind: 'skill',
      source: 'local',
      enabled: true,
      status: 'enabled',
    })
    const result = repository.registerCursorRepository(repository.scanCursorRepository(root), deps())
    assert.equal(result.ok, true)
    assert.notEqual(result.idMaps.skills.alpha, 'alpha')
    assert.match(result.idMaps.skills.alpha, /--alpha$/)
  })

  it('drops a linked skill from runtime when its source disappears', () => {
    createRepo(root)
    const result = repository.registerCursorRepository(repository.scanCursorRepository(root), deps())
    const skillId = result.idMaps.skills.alpha
    const entries = storeLib.loadInstallStore(userData).entries
    fs.rmSync(path.join(root, '.cursor', 'skills', 'alpha'), { recursive: true, force: true })
    const runtime = createSkillRuntime({
      capabilitiesRoot: storeLib.resolvePaths(userData).root,
      getInstallStore: () => ({ skills: { [skillId]: entries[skillId] } }),
    })
    assert.equal(runtime.listSkillsL0().some((item) => item.id === skillId), false)
    assert.equal(runtime.loadSkillL1(skillId).code, 'not_found')
  })
})
