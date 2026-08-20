'use strict'

const { describe, it, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const os = require('os')

const {
  createExpertRuntime,
  parseExpertFrontmatter,
  validateBindings,
  validateExpertPackage,
} = require('../src/lib/expert-runtime')

const TMP = path.join(os.tmpdir(), `knowme-expert-runtime-${Date.now()}`)

describe('expert-runtime', () => {
  const capabilitiesRoot = path.join(TMP, 'capabilities')

  beforeEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true })
    fs.mkdirSync(capabilitiesRoot, { recursive: true })
  })

  afterEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true })
  })

  it('parses EXPERT.md frontmatter and validates required fields', () => {
    const parsed = parseExpertFrontmatter(`---
name: 写作教练
description: 帮助润色中文写作
avatar: coach.png
skills: [writing, polish]
connectors: [feishu]
systemPrompt: 你是一位耐心的写作教练。
---
`)
    assert.equal(parsed.ok, true)
    assert.equal(parsed.name, '写作教练')
    assert.deepEqual(parsed.skills, ['writing', 'polish'])
    assert.deepEqual(parsed.connectors, ['feishu'])

    const invalid = validateExpertPackage({ name: '', systemPrompt: '' })
    assert.equal(invalid.ok, false)
  })

  it('parses curated multiline bindings and block system prompt', () => {
    const parsed = parseExpertFrontmatter(`---
name: 办公伙伴
description: 日常办公专家
skills:
  - writing-polish
connectors:
  - feishu
systemPrompt: |
  你是 KnowMe 办公伙伴。
  回答简洁、可执行。
---
`)
    assert.deepEqual(parsed.skills, ['writing-polish'])
    assert.deepEqual(parsed.connectors, ['feishu'])
    assert.equal(parsed.systemPrompt, '你是 KnowMe 办公伙伴。\n回答简洁、可执行。')
  })

  it('saveExpert writes EXPERT.md and manifest atomically', () => {
    const runtime = createExpertRuntime({ capabilitiesRoot })
    const saved = runtime.saveExpert('writing-coach', {
      name: '写作教练',
      description: '润色写作',
      avatar: 'coach.png',
      skills: ['writing'],
      connectors: ['feishu'],
      systemPrompt: '你是写作教练。',
    })
    assert.equal(saved.ok, true)
    assert.ok(fs.existsSync(path.join(capabilitiesRoot, 'experts', 'writing-coach', 'EXPERT.md')))
    assert.ok(fs.existsSync(path.join(capabilitiesRoot, 'experts', 'writing-coach', 'manifest.json')))

    const loaded = runtime.loadExpert('writing-coach')
    assert.equal(loaded.ok, true)
    assert.equal(loaded.systemPrompt, '你是写作教练。')

    const deleted = runtime.deleteExpert('writing-coach')
    assert.equal(deleted.ok, true)
    assert.equal(fs.existsSync(path.join(capabilitiesRoot, 'experts', 'writing-coach')), false)
    const missing = runtime.deleteExpert('writing-coach')
    assert.equal(missing.ok, false)
    assert.equal(missing.code, 'not_found')
  })

  it('validateBindings reports unknown skill and connector ids', () => {
    const result = validateBindings(
      { skills: ['writing', 'missing'], connectors: ['feishu', 'ghost'] },
      { availableSkills: ['writing'], availableConnectors: ['feishu'] },
    )
    assert.equal(result.ok, false)
    assert.equal(result.issues.length, 2)
  })

  it('createSessionSnapshot freezes persona and hashes', () => {
    const runtime = createExpertRuntime({
      capabilitiesRoot,
      getSkillHashes: (ids) => Object.fromEntries(ids.map((id) => [id, `hash-${id}`])),
      getConnectorHashes: (ids) => Object.fromEntries(ids.map((id) => [id, `hash-${id}`])),
    })
    runtime.saveExpert('coach', {
      name: 'Coach',
      description: 'Coach expert',
      skills: ['writing'],
      connectors: ['feishu'],
      systemPrompt: 'Persona v1',
    })
    fs.writeFileSync(path.join(capabilitiesRoot, 'experts', 'coach', 'capability.manifest.json'), JSON.stringify({
      schemaVersion: 3,
      id: 'coach',
      kind: 'expert',
      name: 'Coach',
      description: 'Coach expert',
      version: '1.0.0',
      dependencies: [],
      permissions: { tools: ['write_report'] },
      inputs: [], outputs: [],
      risk: { level: 'low', reasons: [] },
      provenance: { source: 'test', trust: 'bundled' },
    }))

    const snap = runtime.createSessionSnapshot('session-1', 'coach')
    assert.equal(snap.ok, true)
    assert.equal(snap.snapshot.persona.systemPrompt, 'Persona v1')
    assert.equal(snap.snapshot.hashes.skills.writing, 'hash-writing')
    assert.deepEqual(snap.snapshot.capabilityManifest.permissions.tools, ['write_report'])

    runtime.saveExpert('coach', {
      name: 'Coach',
      description: 'Coach expert',
      skills: ['writing'],
      connectors: ['feishu'],
      systemPrompt: 'Persona v2 updated',
    })

    const persona = runtime.getSessionPersona('session-1')
    assert.equal(persona.source, 'snapshot')
    assert.equal(persona.persona.systemPrompt, 'Persona v1')
    assert.deepEqual(persona.capabilityManifest.permissions.tools, ['write_report'])
  })

  it('saves and freezes Soul SOP agenticType without hub drift', () => {
    const runtime = createExpertRuntime({ capabilitiesRoot })
    const saved = runtime.saveExpert('office', {
      name: '办公伙伴',
      description: '办公',
      soul: '稳重简洁',
      sop: '先对齐再执行',
      agenticType: 'planning',
      agenticConfig: { planFirst: true },
      skills: [],
      connectors: [],
    })
    assert.equal(saved.ok, true)
    assert.equal(saved.agenticType, 'planning')
    const snap = runtime.createSessionSnapshot('s-office', 'office')
    assert.equal(snap.snapshot.persona.soul, '稳重简洁')
    assert.equal(snap.snapshot.persona.agenticType, 'planning')
    runtime.saveExpert('office', {
      name: '办公伙伴',
      soul: '改了',
      sop: '新SOP',
      agenticType: 'reflection',
    })
    const persona = runtime.getSessionPersona('s-office')
    assert.equal(persona.persona.soul, '稳重简洁')
    assert.equal(persona.persona.agenticType, 'planning')
  })

  it('updateSessionBindings overrides snapshot only', () => {
    const runtime = createExpertRuntime({
      capabilitiesRoot,
      getAvailableSkillIds: () => ['writing', 'polish'],
      getAvailableConnectorIds: () => ['feishu'],
    })
    runtime.saveExpert('coach', {
      name: 'Coach',
      sop: '教写作',
      skills: ['writing'],
      connectors: [],
    })
    runtime.createSessionSnapshot('s-bind', 'coach')
    const updated = runtime.updateSessionBindings('s-bind', {
      skills: ['writing', 'polish'],
      connectors: ['feishu'],
    })
    assert.equal(updated.ok, true)
    assert.deepEqual(updated.bindings.skills, ['writing', 'polish'])
    const loaded = runtime.loadExpert('coach')
    assert.deepEqual(loaded.skills, ['writing'])
    assert.deepEqual(loaded.connectors, [])
  })

  it('creates a persona-only snapshot when required bindings are unavailable', () => {
    const runtime = createExpertRuntime({
      capabilitiesRoot,
      getAvailableSkillIds: () => [],
      getAvailableConnectorIds: () => ['feishu'],
    })
    runtime.saveExpert('blocked-coach', {
      name: 'Blocked Coach',
      description: 'Needs writing',
      skills: ['writing'],
      connectors: ['feishu'],
      systemPrompt: 'Coach',
    })

    const snap = runtime.createSessionSnapshot('session-blocked', 'blocked-coach')
    assert.equal(snap.ok, true)
    assert.equal(snap.degraded, true)
    assert.equal(snap.snapshot.persona.systemPrompt, 'Coach')
    assert.equal(snap.snapshot.readiness.state, 'limited')
    assert.deepEqual(
      snap.snapshot.readiness.items.map(item => [item.id, item.status]),
      [['writing', 'limited'], ['feishu', 'ready']],
    )
  })

  it('buildTryChatSession returns ephemeral session DTO', () => {
    const runtime = createExpertRuntime({ capabilitiesRoot })
    runtime.saveExpert('coach', {
      name: 'Coach',
      description: 'Coach expert',
      skills: [],
      connectors: [],
      systemPrompt: 'Try chat persona',
    })

    const tryChat = runtime.buildTryChatSession('coach')
    assert.equal(tryChat.ok, true)
    assert.equal(tryChat.session.ephemeral, true)
    assert.equal(tryChat.session.expertId, 'coach')
    assert.ok(fs.existsSync(tryChat.session.snapshotPath))
  })

  it('getSessionPersona falls back to live expert when no snapshot', () => {
    const runtime = createExpertRuntime({ capabilitiesRoot })
    runtime.saveExpert('live', {
      name: 'Live',
      description: 'Live expert',
      skills: [],
      connectors: [],
      systemPrompt: 'Live persona',
    })
    const persona = runtime.getSessionPersona('missing-session', 'live')
    assert.equal(persona.source, 'live')
    assert.equal(persona.persona.systemPrompt, 'Live persona')
  })
})
