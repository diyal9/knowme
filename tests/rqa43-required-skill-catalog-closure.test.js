'use strict'

const { it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.join(__dirname, '../src/catalog')
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'))

it('RQA43 keeps every bundled expert catalog version aligned with its installable package', () => {
  const catalog = readJson(path.join(ROOT, 'catalog.json')).entries
  const expertsRoot = path.join(ROOT, 'experts')
  const expertIds = catalog.filter(item => item.kind === 'expert').map(item => item.id).sort()
  for (const expertId of expertIds) {
    const expertDir = path.join(expertsRoot, expertId)
    const packageManifest = readJson(path.join(expertDir, 'capability.manifest.json'))
    const matches = catalog.filter(item => item.id === expertId && item.kind === 'expert')
    assert.equal(matches.length, 1, `${expertId}: expert must be uniquely published`)
    assert.equal(matches[0].version, packageManifest.version,
      `${expertId}: catalog and expert package versions differ`)
  }
})

it('RQA43 publishes every bundled expert required Skill as one installable catalog entry', () => {
  const catalog = readJson(path.join(ROOT, 'catalog.json')).entries
  const expertsRoot = path.join(ROOT, 'experts')
  const expertIds = catalog.filter(item => item.kind === 'expert').map(item => item.id).sort()
  for (const expertId of expertIds) {
    const expertDir = path.join(expertsRoot, expertId)
    const expert = readJson(path.join(expertDir, 'capability.manifest.json'))
    for (const dependency of expert.dependencies || []) {
      if (dependency.kind !== 'skill' || dependency.required === false) continue
      const matches = catalog.filter(item => item.id === dependency.id && item.kind === 'skill')
      assert.equal(matches.length, 1, `${expertId}: required Skill ${dependency.id} must be uniquely published`)
      const entry = matches[0]
      const skillDir = path.join(ROOT, entry.bundlePath)
      assert.equal(fs.existsSync(path.join(skillDir, 'SKILL.md')), true,
        `${expertId}: required Skill ${dependency.id} has no readable SKILL.md`)
      const skillManifest = readJson(path.join(skillDir, 'capability.manifest.json'))
      assert.equal(entry.version, skillManifest.version,
        `${expertId}: catalog and Skill package versions differ for ${dependency.id}`)
    }
  }
})
