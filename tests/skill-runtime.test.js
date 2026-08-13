'use strict'

const { describe, it, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const os = require('os')

const {
  createSkillRuntime,
  parseSkillFrontmatter,
  resolveSafePath,
  truncateText,
  LEGACY_PREFIX,
} = require('../src/lib/skill-runtime')
const productKnowledge = require('../src/lib/product-knowledge')

const TMP = path.join(os.tmpdir(), `knowme-skill-runtime-${Date.now()}`)

function writeSkill(root, id, frontmatter, body = '# Body') {
  const dir = path.join(root, 'skills', id)
  fs.mkdirSync(dir, { recursive: true })
  const md = `---\n${frontmatter}\n---\n\n${body}\n`
  fs.writeFileSync(path.join(dir, 'SKILL.md'), md, 'utf8')
  return dir
}

describe('skill-runtime', () => {
  const capabilitiesRoot = path.join(TMP, 'capabilities')
  const knowledgeDir = path.join(TMP, 'knowledge')
  const seedDir = path.join(__dirname, '..', 'src', 'assets', 'knowledge-seed')

  beforeEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true })
    fs.mkdirSync(capabilitiesRoot, { recursive: true })
    fs.mkdirSync(knowledgeDir, { recursive: true })
    productKnowledge.ensureKnowledge(knowledgeDir, seedDir)
  })

  afterEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true })
  })

  it('parses SKILL.md frontmatter with disable-model-invocation and metadata.knowme.slash', () => {
    const parsed = parseSkillFrontmatter(`---
name: Code Review
description: Review pull requests carefully
disable-model-invocation: true
metadata:
  knowme:
    slash: review
---
# Instructions
`)
    assert.equal(parsed.ok, true)
    assert.equal(parsed.name, 'Code Review')
    assert.equal(parsed.disableModelInvocation, true)
    assert.equal(parsed.slash, 'review')
  })

  it('listSkillsL0 returns metadata only and respects enabled filter', () => {
    const alphaDir = writeSkill(capabilitiesRoot, 'alpha', 'name: Alpha\ndescription: Alpha skill for testing keyword match')
    writeSkill(capabilitiesRoot, 'beta', 'name: Beta\ndescription: Beta disabled skill\ndisable-model-invocation: true')
    fs.writeFileSync(path.join(alphaDir, 'capability.manifest.json'), JSON.stringify({
      schemaVersion: 2,
      id: 'alpha',
      kind: 'skill',
      name: 'Alpha',
      version: '1.0.0',
      dependencies: [{ id: 'feishu', kind: 'connector', required: false }],
      permissions: { filesystem: ['read'] },
      risk: { level: 'medium', reasons: ['reads files'] },
      provenance: { source: 'test', ref: 'alpha/SKILL.md' },
    }), 'utf8')

    const runtime = createSkillRuntime({
      capabilitiesRoot,
      knowledgeDir,
      getInstallStore: () => ({
        skills: {
          alpha: { enabled: true },
          beta: { enabled: false },
        },
      }),
    })

    const list = runtime.listSkillsL0()
    assert.equal(list.length, 1)
    assert.equal(list[0].id, 'alpha')
    assert.equal(list[0].disableModelInvocation, false)
    assert.equal(list[0].dependencies[0].id, 'feishu')
    assert.deepEqual(list[0].permissions.filesystem, ['read'])
    assert.equal(list[0].risk.level, 'medium')
    assert.ok(!list[0].body)
  })

  it('loadSkillL1 truncates body within budget', () => {
    writeSkill(capabilitiesRoot, 'long', 'name: Long\ndescription: Long body', 'x'.repeat(500))
    const runtime = createSkillRuntime({
      capabilitiesRoot,
      knowledgeDir,
      l1Budget: 120,
    })
    const loaded = runtime.loadSkillL1('long')
    assert.equal(loaded.ok, true)
    assert.equal(loaded.truncated, true)
    assert.ok(loaded.body.includes('[正文已截断]'))
  })

  it('readSkillResource blocks traversal and allows references/assets only', () => {
    const dir = writeSkill(
      capabilitiesRoot,
      'secure',
      'name: Secure\ndescription: Secure read',
      'body',
    )
    fs.mkdirSync(path.join(dir, 'references'), { recursive: true })
    fs.writeFileSync(path.join(dir, 'references', 'guide.md'), 'guide content', 'utf8')

    const runtime = createSkillRuntime({ capabilitiesRoot, knowledgeDir })
    const ok = runtime.readSkillResource('secure', 'references/guide.md')
    assert.equal(ok.ok, true)
    assert.equal(ok.content, 'guide content')

    const traversal = runtime.readSkillResource('secure', '../SKILL.md')
    assert.equal(traversal.ok, false)
    assert.equal(traversal.code, 'invalid_path')

    const scripts = runtime.readSkillResource('secure', 'scripts/run.js')
    assert.equal(scripts.ok, false)
  })

  it('runSkillScript delegates to sandbox and enforces scripts root', async () => {
    const dir = writeSkill(
      capabilitiesRoot,
      'runner',
      'name: Runner\ndescription: Script runner',
      'body',
    )
    fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true })
    fs.writeFileSync(path.join(dir, 'scripts', 'hello.js'), 'console.log("hi")', 'utf8')

    let captured = null
    const runtime = createSkillRuntime({
      capabilitiesRoot,
      knowledgeDir,
      runScript: async (ctx) => {
        captured = ctx
        return { ok: true, text: 'done', stdout: 'done' }
      },
    })

    const result = await runtime.runSkillScript('runner', 'scripts/hello.js', { foo: 1 }, { network: true })
    assert.equal(result.ok, true)
    assert.equal(captured.scriptsRoot, path.join(dir, 'scripts'))
    assert.equal(captured.permissions.network, true)

    const outside = await runtime.runSkillScript('runner', 'references/x.js')
    assert.equal(outside.ok, false)
  })

  it('autoMatchSkills excludes disable-model-invocation skills', () => {
    writeSkill(
      capabilitiesRoot,
      'review',
      'name: Review\ndescription: code review pull request quality',
    )
    writeSkill(
      capabilitiesRoot,
      'hidden',
      'name: Hidden\ndescription: secret code review helper\ndisable-model-invocation: true',
    )

    const runtime = createSkillRuntime({ capabilitiesRoot, knowledgeDir })
    const hits = runtime.autoMatchSkills('please code review this pull request', { topK: 5 })
    assert.ok(hits.some((h) => h.id === 'review'))
    assert.ok(!hits.some((h) => h.id === 'hidden'))
  })

  it('maps legacy OKF slash skills and exports to SKILL.md', () => {
    productKnowledge.createSkill(knowledgeDir, {
      title: '代码审查',
      slash: 'review',
      body: '## 用途\n审查 PR 变更',
    })

    const runtime = createSkillRuntime({ capabilitiesRoot, knowledgeDir })
    const slashItems = runtime.listSlashPickerItems()
    const legacy = slashItems.find((s) => s.legacy)
    assert.ok(legacy)
    assert.ok(legacy.id.startsWith(LEGACY_PREFIX))

    const exported = runtime.exportLegacyToSkillMd(legacy.id, 'review-export')
    assert.equal(exported.ok, true)
    assert.ok(fs.existsSync(path.join(capabilitiesRoot, 'skills', 'review-export', 'SKILL.md')))
  })

  it('resolveSafePath rejects absolute and parent segments', () => {
    const root = path.join(TMP, 'skill-root')
    fs.mkdirSync(root, { recursive: true })
    const bad = resolveSafePath(root, '../../etc/passwd', ['references'])
    assert.equal(bad.ok, false)
  })

  it('truncateText keeps short text intact', () => {
    const out = truncateText('hello', 100)
    assert.equal(out.truncated, false)
    assert.equal(out.text, 'hello')
  })
})
