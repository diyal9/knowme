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
  it('ships exactly three official multi-agent packages with gates', () => {
    const packages = listOfficialWorkflowPackages()
    assert.equal(packages.length, 3)
    assert.equal(OFFICIAL_WORKFLOWS.length, 3)

    for (const pkg of packages) {
      assert.equal(pkg.source, 'official')
      assert.equal(pkg.status, 'published')
      assert.ok(pkg.executionBackends.includes('local-team'))
      const agentNodes = (pkg.graph.nodes || []).filter(node => node.type === 'agent')
      const gateNodes = (pkg.graph.nodes || []).filter(node => node.type === 'gate')
      const agentIds = new Set(agentNodes.map(node => node.agentPackageId).filter(Boolean))
      assert.ok(agentIds.size >= 2, `${pkg.id} needs ≥2 agents`)
      assert.ok(gateNodes.length >= 1, `${pkg.id} needs ≥1 gate`)
      assert.ok(gateNodes.every(node => node.gateRef), `${pkg.id} gate needs gateRef`)
      assert.ok((pkg.graph.gates || []).length >= 1, `${pkg.id} needs gate defs`)
      assert.ok((pkg.graph.edges || []).length >= 2, `${pkg.id} needs edges`)
      assert.ok((pkg.graph.members || []).length >= 2, `${pkg.id} needs members`)
    }
  })

  it('exposes required expert ids covering all agent refs', () => {
    const ids = requiredExpertIds()
    assert.ok(ids.includes('product-manager'))
    assert.ok(ids.includes('user-researcher'))
    assert.ok(ids.includes('requirement-reviewer'))
    assert.ok(ids.includes('meeting-scribe'))
    assert.ok(ids.includes('creative-director'))
    assert.ok(ids.includes('image-producer'))
    assert.ok(ids.includes('office-partner'))
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
      workflowDisplayName({ id: 'official-product-requirement', name: '写产品需求' }),
      '写产品需求',
    )
    assert.equal(
      workflowDisplayName({ id: 'official-art-image-production', name: '美术生图' }),
      '美术生图',
    )
    assert.equal(
      workflowDisplayName({ id: 'official-daily-office', name: '日常办公' }),
      '日常办公',
    )
  })

  it('keeps official card blurbs as short value props without step chains', () => {
    const expected = {
      'official-product-requirement': '把业务想法整理成有证据、可评审、可验收的产品需求。',
      'official-art-image-production': '从传播目标到候选图片、参数记录和人工选版的完整生图流程。',
      'official-daily-office': '把会议材料转成正式纪要、行动项和可发送的同步稿。',
    }
    for (const pkg of listOfficialWorkflowPackages()) {
      assert.equal(pkg.description, expected[pkg.id], `${pkg.id} description`)
      assert.doesNotMatch(pkg.description, /→|->/)
      assert.ok(pkg.description.length <= 36, `${pkg.id} blurb too long`)
    }
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
    assert.equal(result.packages.filter(item => item.source === 'official').length, 3)
    assert.equal(result.stats.byOrigin.official, 3)
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
