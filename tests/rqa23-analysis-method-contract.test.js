'use strict'

// RQA23 bounded source-package contracts, not installed-profile/model quality.
// Real catalog/parser/L1/assembly/tool-loader; no installation or network IO.
// Text retention and contamination markers are regression guards, not proof
// that a model reasons professionally or that no possible answer is embedded.
const { it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createHash } = require('node:crypto')
const { parseSkillFrontmatter, createSkillRuntime } = require('../src/lib/skill-runtime')
const { createExpertRuntime } = require('../src/lib/expert-runtime')
const { validateAndNormalizeManifest } = require('../src/lib/capability-manifest-v2')
const { loadBundledCatalog } = require('../src/lib/capability-catalog')
const { assembleCapabilityContext } = require('../src/lib/agent-context-assembly')
const { buildSkillTools } = require('../src/lib/agent-skill-tools')
const { resolveOutputSpec } = require('../src/lib/expert-execution-profile')

const root = path.resolve(__dirname, '../src/catalog')
const id = 'data-analysis-method'
const dir = path.join(root, 'skills', id)
const baseline = path.resolve(__dirname, '../openspec/changes/production-qualify-all-experts/skill-evals/rqa23-data-analysis-workspace/skill-snapshot')
const markdown = fs.readFileSync(path.join(dir, 'SKILL.md'), 'utf8')
const parsed = parseSkillFrontmatter(markdown)
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'capability.manifest.json'), 'utf8'))
const permissions = { connectors: { allowedConnectorIds: [] }, tools: { allowlist: [] },
  network: false, write: false, externalWrite: false }

it('RQA23 same method identity, schema and version 1.1.0 with no metadata authority expansion', () => {
  assert.equal(parsed.ok, true)
  assert.equal(parsed.frontmatter.name, id)
  assert.equal(parsed.frontmatter.version, '1.1.0')
  assert.equal(parsed.disableModelInvocation, false)
  assert.equal(manifest.schemaVersion, 3)
  assert.equal(manifest.id, id)
  assert.equal(manifest.kind, 'skill')
  assert.equal(manifest.version, '1.1.0')
  const normalized = validateAndNormalizeManifest(manifest, { id, kind: 'skill' })
  assert.equal(normalized.ok, true, JSON.stringify(normalized))
  assert.deepEqual(manifest.permissions, permissions)
  assert.deepEqual(manifest.dependencies || [], [])
  const oldManifest = JSON.parse(fs.readFileSync(path.join(baseline, 'capability.manifest.json'), 'utf8'))
  const oldParsed = parseSkillFrontmatter(fs.readFileSync(path.join(baseline, 'SKILL.md'), 'utf8'))
  assert.equal(oldManifest.version, '1.0.0')
  // Version is the only metadata change: no hidden requiredTools, connectors,
  // new dependency, execution route or expert-ID branch in frontmatter.
  assert.deepEqual(manifest, { ...oldManifest, version: '1.1.0' })
  assert.deepEqual(parsed.frontmatter, { ...oldParsed.frontmatter, version: '1.1.0' })
})

it('RQA23 raw and normalized catalog publish exactly one matching method version', () => {
  const rawCatalog = JSON.parse(fs.readFileSync(path.join(root, 'catalog.json'), 'utf8'))
  for (const entries of [rawCatalog.entries, loadBundledCatalog(root).entries]) {
    const matches = entries.filter(entry => entry.id === id && entry.kind === 'skill')
    assert.equal(matches.length, 1)
    assert.equal(matches[0].bundlePath, 'skills/' + id)
    assert.equal(matches[0].version, manifest.version)
    if (matches[0].manifest) {
      assert.equal(matches[0].manifest.version, manifest.version)
      assert.deepEqual(matches[0].manifest.dependencies || [], [])
    }
  }
})

it('RQA23 existing units/missing/conflict/denominator/calculation/authorization paragraphs remain intact', () => {
  const oldMarkdown = fs.readFileSync(path.join(baseline, 'SKILL.md'), 'utf8')
  // The supplied snapshot has one extra terminal blank line relative to the
  // original source (c3a265...). Pin its actual bytes, not the source hash.
  assert.equal(createHash('sha256').update(oldMarkdown, 'utf8').digest('hex'),
    '327590886a843751d0736337ad271860a1bfe1a672449665823863c0fa5fe4ee')
  assert.equal(createHash('sha256').update(oldMarkdown.trimEnd() + '\n', 'utf8').digest('hex'),
    'c3a2650715fe87dca6a8fd139c61457b8ea8656ef9c5b3a3ed25589f349ecfc2')
  const oldBody = parseSkillFrontmatter(oldMarkdown).body
  const boundary = oldBody.indexOf('## 从描述走到验证与交付')
  assert.ok(boundary > 0, 'known 1.0.0 safeguard boundary must exist')
  // This verifies preservation of the actual paragraphs, not mere keywords.
  assert.ok(parsed.body.startsWith(oldBody.slice(0, boundary)))
  const finalParagraph = oldBody.trim().split(/\r?\n\r?\n/).at(-1)
  assert.ok(parsed.body.trim().endsWith(finalParagraph))
})

it('RQA23 package contains no executable extras or obvious evaluation/expert-routing markers', () => {
  assert.deepEqual(fs.readdirSync(dir).sort(), ['SKILL.md', 'capability.manifest.json'].sort())
  assert.doesNotMatch(markdown, /\b(?:expertId|expert_id|RQA\d+|R20-DA-N01|DA-H\d+)\b|task-mto|frozen-inputs|professional-batch/)
  // Deliberately no keyword-count or professional-quality score here.
})

it('RQA23 real L1 loads the entire method below existing 2400-char contract without widening access', () => {
  const runtime = createSkillRuntime({ capabilitiesRoot: root })
  assert.ok(parsed.body.trim().length > 0)
  assert.ok(parsed.body.length < 2400, `body=${parsed.body.length}; do not expand budget`)
  for (const options of [{ allowedIds: [id] }, { allowedIds: [id], maxChars: 2400 }]) {
    const loaded = runtime.loadSkillL1(id, options)
    assert.equal(loaded.ok, true, loaded.message)
    assert.equal(loaded.body, parsed.body)
    assert.equal(loaded.truncated, false)
    assert.equal(loaded.activation.complete, true)
    assert.equal(loaded.activation.skillId, id)
    assert.deepEqual(loaded.dependencies, [])
    for (const key of ['requiredTools', 'requiredEvidence', 'completionConditions']) {
      assert.deepEqual(loaded.executionContract[key], [])
    }
  }
  assert.equal(runtime.loadSkillL1(id, { allowedIds: [] }).code, 'not_allowed')
  const deniedBudget = runtime.loadSkillL1(id, { allowedIds: [id], maxChars: parsed.body.length - 1 })
  assert.equal(deniedBudget.code, 'skill_l1_budget_exceeded')
  assert.equal(deniedBudget.activation, undefined)
  assert.equal(deniedBudget.body, undefined)
})

it('RQA23 expert 2.4.3 selects core through ordinary route and assembles complete L1', () => {
  const experts = createExpertRuntime({ capabilitiesRoot: root })
  const skills = createSkillRuntime({ capabilitiesRoot: root })
  const session = { id: 'rqa23-source-contract', expertId: 'data-analyst' }
  const persona = experts.getSessionPersona(session.id, session.expertId)
  assert.equal(persona.ok, true, persona.message)
  assert.equal(persona.capabilityManifest.version, '2.4.3')
  const dependencies = persona.capabilityManifest.dependencies.filter(item => item.kind === 'skill')
  assert.deepEqual(dependencies.map(({ id, required }) => ({ id, required })), [
    { id, required: true },
    { id: 'business-metrics-analysis', required: true },
    { id: 'business-cause-analysis', required: true },
    { id: 'business-insight-report', required: true },
    { id: 'data-report-method', required: true },
    { id: 'writing-polish', required: false },
  ])
  const primary = { id: 'user-owned-output', title: 'Requested analysis', type: 'answer', required: true }
  const spec = resolveOutputSpec({ brief: { goal: 'Analyze supplied records.', deliverables: [primary] } }, persona)
  assert.deepEqual(spec.requiredSkills, [id])
  assert.equal(spec.id, primary.id)
  const context = assembleCapabilityContext({ session, prompt: 'Analyze supplied records.', tier: 'assist',
    slashRefs: spec.requiredSkills, expertRuntime: experts, skillRuntime: skills })
  assert.deepEqual(context.resolvedSlashIds, [id])
  assert.ok(context.skillL1Block.includes(parsed.body))
  assert.ok(context.skillL1Block.length < 2400, `wrapped L1=${context.skillL1Block.length}; do not expand budget`)
  const block = context.contextBlocks.find(item => item.id === 'skill.explicit-content')
  assert.equal(block?.explicit, true)
  assert.equal(block.content, context.skillL1Block)
  assert.equal(context.groundingContract, null)
})

it('RQA23 normal load_skill handler returns full instructions and no new tool contract', async () => {
  const runtime = createSkillRuntime({ capabilitiesRoot: root })
  const { handlers } = buildSkillTools({ runtime, getAllowedSkillIds: () => [id] })
  const loaded = await handlers.load_skill({ skill_id: id })
  assert.equal(loaded.ok, true, loaded.message)
  assert.equal(loaded.truncated, false)
  assert.equal(loaded.activation.complete, true)
  assert.equal(loaded.activation.skillId, id)
  assert.ok(loaded.text.includes(parsed.body))
  assert.deepEqual(loaded.dependencies, [])
  assert.deepEqual(loaded.executionContract.requiredTools, [])
  assert.deepEqual(loaded.executionContract.requiredEvidence, [])
  assert.deepEqual(loaded.executionContract.completionConditions, [])
})
