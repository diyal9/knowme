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
const { createStore: createWorkflowStore } = require('../src/lib/workflow-package-store')

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
  if (options.workflow === true) {
    write(path.join(root, '.cursor', 'workflows', 'index.json'), JSON.stringify({
      version: '1.0',
      workflows: [
        { id: 'artist-delivery', name: 'Artist delivery', path: 'artist-delivery.json', catalog: { visibility: 'primary' } },
        { id: 'old-flow', name: 'Old flow', path: 'old-flow.json', catalog: { visibility: 'deprecated' } },
      ],
    }, null, 2))
    const workflow = {
      schema_version: '1.0',
      id: 'artist-delivery',
      name: 'Artist delivery',
      description: 'Create, approve, and deliver art.',
      tags: ['art', 'delivery'],
      nodes: [
        { id: 'create', type: 'agent', agent: 'artist', intent: 'Create art', next: 'approve' },
        { id: 'approve', type: 'gate', gate_id: 'art-approve', intent: 'Approve art', on_approve: 'done', on_reject: 'create' },
        { id: 'done', type: 'terminal', status: 'completed' },
      ],
    }
    write(path.join(root, '.cursor', 'workflows', 'artist-delivery.json'), JSON.stringify(workflow, null, 2))
    write(path.join(root, '.cursor', 'workflows', 'old-flow.json'), JSON.stringify({ ...workflow, id: 'old-flow', name: 'Old flow' }, null, 2))
  }
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
    const workflowStore = createWorkflowStore({ userData })
    return { userData, store, catalog, expertRuntime, connectorsApi, workflowStore }
  }

  it('scans skills, agents and converts plaintext MCP secrets to unconfigured slots without exposing values', () => {
    createRepo(root)
    const scanned = repository.scanCursorRepository(root)
    assert.equal(scanned.ok, true)
    assert.equal(scanned.skills.length, 1)
    assert.equal(scanned.experts.length, 1)
    assert.equal(scanned.connectors.length, 2)
    assert.equal(scanned.connectors.find((item) => item.sourceId === 'safe').blocked, false)
    assert.equal(scanned.connectors.find((item) => item.sourceId === 'blocked').blocked, false)
    assert.equal(scanned.connectors.find((item) => item.sourceId === 'blocked').configState, 'needs_configuration')
    assert.ok(scanned.connectors.find((item) => item.sourceId === 'blocked').secretSlots.length > 0)
    assert.ok(scanned.warnings.some((item) => item.code === 'missing_agent_skills'))
    assert.ok(scanned.warnings.some((item) => item.code === 'mcp_secret_stripped'))

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

  it('imports Cursor workflows, maps expert ids, and skips deprecated definitions', () => {
    createRepo(root, { workflow: true })
    const scanned = repository.scanCursorRepository(root)
    assert.equal(scanned.ok, true)
    assert.equal(scanned.workflows.length, 2)
    assert.equal(scanned.workflows.find(item => item.sourceId === 'old-flow').blocked, true)
    assert.equal(repository.publicPreview(scanned, 'token').counts.workflows, 2)

    const services = deps()
    const result = repository.registerCursorRepository(scanned, services)
    assert.equal(result.ok, true)
    assert.equal(result.idMaps.workflows['artist-delivery'], 'artist-delivery')
    assert.ok(result.skipped.some(item => item.kind === 'workflow' && item.sourceId === 'old-flow'))

    const saved = services.workflowStore.get('artist-delivery')
    assert.equal(saved.ok, true)
    assert.equal(saved.package.source, 'team')
    assert.equal(saved.package.status, 'draft')
    assert.equal(saved.package.provenance.domain, 'visual')
    assert.ok(saved.package.goalTypes.includes('visual'))
    assert.deepEqual(saved.package.agentRefs.map(ref => ref.id), [result.idMaps.experts.artist])
    assert.equal(saved.package.graph.nodes.find(node => node.id === 'create').agentPackageId, result.idMaps.experts.artist)
    assert.equal(saved.package.graph.gates[0].id, 'art-approve')
  })

  it('designs a precise workflow package with transitive Agent and Skill dependencies', () => {
    createRepo(root, { workflow: true })
    write(path.join(root, '.cursor', 'skills', 'entry', 'SKILL.md'), `---
name: entry
description: Workflow entry
---
# Entry
`)
    write(path.join(root, '.cursor', 'skills', 'optional', 'SKILL.md'), `---
name: optional
description: Optional helper
---
# Optional
`)
    write(path.join(root, '.cursor', 'agents', 'artist', 'agent.manifest.json'), JSON.stringify({
      id: 'artist',
      version: '1.0.0',
      title: 'Artist',
      skills: { required: ['alpha'], optional: ['optional'] },
    }, null, 2))

    const scanned = repository.scanCursorRepository(root)
    const planned = repository.planCursorRepositoryImport(scanned, {
      workflowIds: ['artist-delivery'],
      additionalSkillIds: ['entry'],
      includeOptionalSkills: false,
      includeConnectors: false,
    })
    assert.equal(planned.ok, true)
    assert.deepEqual(planned.plan.workflows.map(item => item.id), ['artist-delivery'])
    assert.deepEqual(planned.plan.experts.map(item => item.id), ['artist'])
    assert.deepEqual(planned.plan.skills.map(item => item.id).sort(), ['alpha', 'entry'])
    assert.equal(planned.preview.workflows.length, 1)
    assert.equal(planned.preview.experts.length, 1)
    assert.equal(planned.preview.connectors.length, 0)

    const tolerantPlan = repository.planCursorRepositoryImport(scanned, {
      workflowIds: ['artist-delivery', 'entry'],
      includeOptionalSkills: false,
      includeConnectors: false,
    })
    assert.equal(tolerantPlan.ok, true)
    assert.deepEqual(tolerantPlan.plan.workflows.map(item => item.id), ['artist-delivery'])
    assert.ok(tolerantPlan.plan.skills.some(item => item.id === 'entry'))
    assert.deepEqual(tolerantPlan.plan.selection.additionalSkillIds, ['entry'])

    const services = deps()
    const installed = repository.registerCursorRepository(planned.preview, services)
    assert.equal(installed.counts.installed, 4)
    assert.deepEqual(Object.keys(installed.idMaps.workflows), ['artist-delivery'])
    assert.deepEqual(Object.keys(installed.idMaps.experts), ['artist'])
    assert.deepEqual(Object.keys(installed.idMaps.skills).sort(), ['alpha', 'entry'])
  })

  it('registers idempotently and exposes linked skills through runtime and catalog', () => {
    createRepo(root)
    const scanned = repository.scanCursorRepository(root)
    const first = repository.registerCursorRepository(scanned, deps())
    const second = repository.registerCursorRepository(scanned, deps())
    assert.equal(first.ok, true)
    assert.deepEqual(second.idMaps, first.idMaps)
    assert.equal(first.counts.installed, 4)
    assert.equal(first.counts.skipped, 0)

    const installed = storeLib.loadInstallStore(userData)
    const skillId = first.idMaps.skills.alpha
    assert.equal(installed.entries[skillId].linked, true)
    assert.equal(installed.entries[skillId].originRoot, fs.realpathSync(root))
    assert.equal(installed.entries[skillId].manifest.schemaVersion, 3)
    assert.equal(installed.entries[skillId].manifest.provenance.source, 'local-repo')
    const expertId = first.idMaps.experts.artist
    assert.ok(installed.entries[expertId].manifest.dependencies.some(dep => dep.id === skillId && dep.kind === 'skill'))
    assert.equal(installed.entries[first.idMaps.connectors.safe].manifest.risk.level, 'high')

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
    assert.ok(listed.entries.some((item) => item.id === expertId && item.installed))
    assert.ok(listed.entries.find((item) => item.id === expertId).dependencies.some(dep => dep.id === skillId))
  })

  it('derives a Chinese display name for imported experts and keeps the original slug', () => {
    createRepo(root)
    write(path.join(root, '.cursor', 'agents', 'artist', 'AGENT.md'), `---
name: artist
description: >-
  美术专家：负责制品标准化打包与发布前门禁控制。
persona:
  role: 美术制品打包与交付专家
---
# Artist
Work carefully.
`)
    const scanned = repository.scanCursorRepository(root)
    assert.equal(scanned.experts[0].name, '美术专家')
    assert.equal(scanned.experts[0].originName, 'artist')
    assert.equal(repository.publicPreview(scanned, 'token').experts[0].originName, 'artist')

    const registered = repository.registerCursorRepository(scanned, deps())
    const expertId = registered.idMaps.experts.artist
    const entry = storeLib.loadInstallStore(userData).entries[expertId]
    assert.equal(entry.name, '美术专家')
    assert.equal(entry.originName, 'artist')
    assert.equal(entry.nameSource, 'import')

    const expert = createExpertRuntime({ capabilitiesRoot: storeLib.resolvePaths(userData).root })
      .loadExpert(expertId)
    assert.equal(expert.name, '美术专家')
    assert.equal(expert.originName, 'artist')
  })

  it('keeps a user-renamed expert name when the repository is re-registered', () => {
    createRepo(root)
    const scanned = repository.scanCursorRepository(root)
    const registered = repository.registerCursorRepository(scanned, deps())
    const expertId = registered.idMaps.experts.artist

    const installed = storeLib.loadInstallStore(userData).entries[expertId]
    storeLib.upsertEntry(userData, { ...installed, name: '我的美术专家', nameSource: 'user' })

    repository.registerCursorRepository(repository.scanCursorRepository(root), deps())
    const after = storeLib.loadInstallStore(userData).entries[expertId]
    assert.equal(after.name, '我的美术专家')
    assert.equal(after.nameSource, 'user')

    const listed = catalogLib.listCatalog(userData, {
      bundledRoot: path.join(__dirname, '..', 'src', 'catalog'),
    })
    assert.equal(listed.entries.find((item) => item.id === expertId).name, '我的美术专家')
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
