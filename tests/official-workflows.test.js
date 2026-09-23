const { describe, it } = require('node:test')
const assert = require('node:assert')
const {
  OFFICIAL_WORKFLOWS,
  LEGACY_DEMO_SEED_IDS,
  listOfficialWorkflowPackages,
  requiredExpertIds,
  isLegacyDemoSeedId,
} = require('../src/lib/official-workflows')
const { buildWorkflowSupply } = require('../src/lib/workflow-supply')
const { workflowDisplayName } = require('../src/lib/workflow-display-name')

describe('official-workflows catalog', () => {
  it('ships the remaining professional multi-stage expert package with a gate', () => {
    const packages = listOfficialWorkflowPackages()
    assert.equal(packages.length, 1)
    assert.equal(OFFICIAL_WORKFLOWS.length, 1)

    for (const pkg of packages) {
      assert.equal(pkg.source, 'official')
      assert.equal(pkg.status, 'published')
      assert.ok(pkg.executionBackends.includes('local-team'))
      const agentNodes = (pkg.graph.nodes || []).filter(node => node.type === 'agent')
      const gateNodes = (pkg.graph.nodes || []).filter(node => node.type === 'gate')
      const agentIds = new Set(agentNodes.map(node => node.agentPackageId).filter(Boolean))
      assert.ok(agentIds.size >= 1, `${pkg.id} needs an expert`)
      assert.ok(agentNodes.length >= 2, `${pkg.id} needs ≥2 expert stages`)
      assert.ok(gateNodes.length >= 1, `${pkg.id} needs ≥1 gate`)
      assert.ok(gateNodes.every(node => node.gateRef), `${pkg.id} gate needs gateRef`)
      assert.ok((pkg.graph.gates || []).length >= 1, `${pkg.id} needs gate defs`)
      assert.ok((pkg.graph.edges || []).length >= 2, `${pkg.id} needs edges`)
      assert.ok((pkg.graph.members || []).length >= 2, `${pkg.id} needs members`)
    }
  })

  it('exposes required expert ids covering all agent refs', () => {
    const ids = requiredExpertIds()
    assert.equal(ids.includes('product-manager'), false)
    assert.equal(ids.includes('user-researcher'), false)
    assert.equal(ids.includes('requirement-reviewer'), false)
    assert.equal(ids.includes('meeting-scribe'), false)
    assert.equal(ids.includes('action-owner'), false)
    assert.equal(ids.includes('creative-director'), false)
    assert.ok(ids.includes('image-producer'))
    assert.equal(ids.includes('office-partner'), false)
    for (const pkg of OFFICIAL_WORKFLOWS) {
      for (const ref of pkg.agentRefs) {
        assert.ok(ids.includes(ref.id), `missing ${ref.id}`)
      }
    }
  })

  it('marks legacy demo seed ids without listing them as official packages', () => {
    assert.equal(LEGACY_DEMO_SEED_IDS.length, 6)
    for (const id of LEGACY_DEMO_SEED_IDS) {
      assert.equal(isLegacyDemoSeedId(id), true)
      assert.equal(listOfficialWorkflowPackages().find(item => item.id === id), undefined)
    }
  })

  it('uses short display names for official ids', () => {
    assert.equal(
      workflowDisplayName({ id: 'official-art-image-production', name: '美术生图' }),
      '美术生图',
    )
  })

  it('keeps official card blurbs as short value props without step chains', () => {
    const expected = {
      'official-art-image-production': '从传播目标到候选图片、参数记录和人工选版的完整生图流程。',
    }
    for (const pkg of listOfficialWorkflowPackages()) {
      assert.equal(pkg.description, expected[pkg.id], `${pkg.id} description`)
      assert.doesNotMatch(pkg.description, /→|->/)
      assert.ok(pkg.description.length <= 36, `${pkg.id} blurb too long`)
    }
  })

  it('hands a standard visual brief directly from design to image production', () => {
    const visual = listOfficialWorkflowPackages().find(item => item.id === 'official-art-image-production')
    const design = visual.graph.nodes.find(node => node.id === 'n-design')
    const generate = visual.graph.nodes.find(node => node.id === 'n-generate')
    const handoff = visual.graph.edges.find(edge => edge.from === 'n-design' && edge.to === 'n-generate')
    assert.match(design.intent, /生图交接包/)
    assert.match(generate.intent, /不重复澄清已覆盖字段/)
    assert.match(handoff.label, /可直接生成/)
  })

  it('runs creative direction, visual design and generation within the retained image expert', () => {
    const visual = listOfficialWorkflowPackages().find(item => item.id === 'official-art-image-production')
    const stages = visual.graph.nodes.filter(node => node.type === 'agent')
    assert.deepEqual(visual.agentRefs.map(ref => ref.id), ['image-producer'])
    assert.deepEqual(stages.map(node => node.agentPackageId), [
      'image-producer', 'image-producer', 'image-producer',
    ])
    assert.match(stages[0].intent, /创意概念模式/)
    assert.match(stages[1].intent, /视觉方案模式/)
  })

  it('injects official packages onto the shelf when provided as verticals', () => {
    const experts = requiredExpertIds().map(id => ({ id }))
    const result = buildWorkflowSupply({
      repoWorkflows: [],
      daemon: { online: false, workflows: [] },
      personal: [],
      verticals: listOfficialWorkflowPackages(),
      agents: experts,
      repoActive: false,
      localTeamEnabled: true,
    })
    assert.equal(result.packages.filter(item => item.source === 'official').length, 1)
    assert.equal(result.stats.byOrigin.official, 1)
    for (const pkg of result.packages.filter(item => item.source === 'official')) {
      assert.equal(pkg.readiness.runnable, true, `${pkg.id} should be runnable`)
      assert.equal(pkg.origin, 'official')
    }
  })

  it('does not treat legacy empty demo ids as runnable official shelf cards', () => {
    const result = buildWorkflowSupply({
      repoWorkflows: [],
      daemon: { online: true, workflows: [] },
      personal: [],
      verticals: listOfficialWorkflowPackages(),
      agents: requiredExpertIds().map(id => ({ id })),
      repoActive: true,
      localTeamEnabled: true,
    })
    for (const id of LEGACY_DEMO_SEED_IDS) {
      assert.equal(result.packages.find(item => item.id === id), undefined)
    }
  })
})
