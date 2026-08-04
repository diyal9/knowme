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

    const snap = runtime.createSessionSnapshot('session-1', 'coach')
    assert.equal(snap.ok, true)
    assert.equal(snap.snapshot.persona.systemPrompt, 'Persona v1')
    assert.equal(snap.snapshot.hashes.skills.writing, 'hash-writing')

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
