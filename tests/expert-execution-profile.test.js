'use strict'

const assert = require('node:assert/strict')
const { describe, it } = require('node:test')
const {
  hydrateDeliverableContracts,
  selectExecutionRoute,
  selectExecutionRouteWithMatch,
  qualityReviewContract,
  resolveOutputSpec,
  collectResultArtifacts,
  expectsArtifact,
  snapshotNeedsRefresh,
} = require('../src/lib/expert-execution-profile')

function snapshot(execution, options = {}) {
  return {
    bindings: {
      skills: options.skills || ['render-skill'],
      connectors: options.connectors || ['render-connector'],
    },
    capabilityManifest: {
      version: options.version || '2.0.0',
      dependencies: [
        { id: 'render-skill', kind: 'skill', required: true },
        { id: 'render-connector', kind: 'connector', required: true },
      ],
      metadata: { knowme: { execution } },
    },
  }
}

describe('expert execution profile', () => {
  it('hydrates deliverables from any expert capability manifest without expert ids', () => {
    const snap = snapshot({
      deliverables: [{
        id: 'rendered-assets', title: '渲染结果', type: 'image', required: true,
        requiredTools: ['render_asset'], requiredArtifacts: [{ type: 'image' }], minArtifacts: 1,
      }],
    })
    const brief = hydrateDeliverableContracts({ goal: '生成图标' }, snap)
    assert.equal(brief.deliverables[0].id, 'rendered-assets')
    assert.deepEqual(brief.deliverables[0].requiredTools, ['render_asset'])
    assert.equal(expectsArtifact(brief.deliverables[0]), true)
  })

  it('does not let a dialogue placeholder weaken a required document contract', () => {
    const snap = snapshot({
      deliverables: [{
        id: 'primary', title: '产品需求文档', type: 'document', required: true,
        requiredSkills: ['product-definition-method'], requiredSections: ['目标', '验收标准'],
      }],
    })
    const brief = hydrateDeliverableContracts({
      deliverables: [{ id: 'primary', title: '专业答复', type: 'answer', required: true }],
    }, snap)
    assert.equal(brief.deliverables[0].title, '产品需求文档')
    assert.equal(brief.deliverables[0].type, 'document')
    assert.equal(brief.deliverables[0].minArtifacts, 1)
    assert.ok(brief.deliverables[0].completionConditions.some(item => item.type === 'artifact_present'))
    assert.deepEqual(brief.deliverables[0].requiredSkills, ['product-definition-method'])
    assert.deepEqual(brief.deliverables[0].requiredSections, ['目标', '验收标准'])
  })

  it('does not let a dialogue placeholder weaken a required artifact contract', () => {
    const snap = snapshot({
      deliverables: [{
        id: 'primary', title: '生成图片', type: 'image', required: true,
        requiredArtifacts: [{ type: 'image' }], minArtifacts: 1,
      }],
    })
    const brief = hydrateDeliverableContracts({
      deliverables: [{ id: 'primary', title: '专业答复', type: 'answer', required: true }],
    }, snap)
    assert.equal(brief.deliverables[0].title, '生成图片')
    assert.equal(brief.deliverables[0].type, 'image')
    assert.equal(brief.deliverables[0].minArtifacts, 1)
  })

  it('keeps an explicit conversational report in chat without inventing a file contract', () => {
    const snap = snapshot({
      deliverables: [{ id: 'output-1', title: '分析结论', type: 'answer', required: true }],
    })
    const brief = hydrateDeliverableContracts({
      deliverables: [{ id: 'primary', title: '管理层数据报告', type: 'answer', required: true }],
    }, snap)
    assert.equal(brief.deliverables[0].type, 'answer')
    assert.equal(brief.deliverables[0].minArtifacts, 0)
    assert.equal(brief.deliverables[0].completionConditions.some(item => item.type === 'artifact_present'), false)
    assert.equal(expectsArtifact(brief.deliverables[0]), false)
  })

  it('selects a manifest route using declared keywords for arbitrary experts', () => {
    const snap = snapshot({ routes: [
      { id: 'calendar', keywords: ['日程', '今天安排'], requiredTools: ['calendar.read'] },
      { id: 'docs', keywords: '文档,wiki', requiredTools: ['docs.read'] },
    ] })
    const route = selectExecutionRoute({ expertId: 'custom-agent', goal: '整理今天安排', brief: {} }, snap)
    assert.equal(route.id, 'calendar')
  })

  it('records whether the task matched a specialist route or fell outside the declared route set', () => {
    const snap = snapshot({ routes: [
      { id: 'calendar', keywords: ['日程'] },
      { id: 'general', default: true },
    ] })
    assert.deepEqual(selectExecutionRouteWithMatch({ goal: '整理今日日程', brief: {} }, snap), {
      route: snap.capabilityManifest.metadata.knowme.execution.routes[0], match: 'keyword',
    })
    const fallback = resolveOutputSpec({ goal: '设计一套完全不同的视觉方案', brief: {}, deliverables: [] }, snap)
    assert.equal(fallback.executionRoute, 'general')
    assert.equal(fallback.executionRouteMatch, 'default')
    assert.equal(fallback.executionRouteFit, 'fallback')

    const unmatched = resolveOutputSpec({ goal: '设计一套完全不同的视觉方案', brief: {}, deliverables: [] }, snapshot({
      routes: [{ id: 'calendar', keywords: ['日程'] }],
    }))
    assert.equal(unmatched.executionRouteMatch, 'none')
    assert.equal(unmatched.executionRouteFit, 'unmatched')

    const unconfigured = resolveOutputSpec({ goal: '设计一套完全不同的视觉方案', brief: {}, deliverables: [] }, snapshot({}))
    assert.equal(unconfigured.executionRouteMatch, 'none')
    assert.equal(unconfigured.executionRouteFit, 'unconfigured')
  })

  it('prefers explicit specialist intent over a generic material fallback', () => {
    const snap = snapshot({ routes: [
      {
        id: 'provided-material',
        when: { hasReadableMaterials: true, noneKeywords: ['从外部读取'] },
        skillId: 'writing-skill',
      },
      { id: 'external-meeting', keywords: ['会议'], requiredTools: ['meeting.read'] },
    ] })
    const route = selectExecutionRoute({
      expertId: 'arbitrary-agent',
      goal: '整理会议纪要',
      brief: { materials: [{ content: '负责人：李明。结论：通过。' }] },
    }, snap)
    assert.equal(route.id, 'external-meeting')
  })

  it('keeps knowledge curation and public research ahead of provided-material fallback', () => {
    const snap = snapshot({ routes: [
      {
        id: 'provided-material',
        when: { hasReadableMaterials: true },
      },
      {
        id: 'public-web-research',
        keywords: ['联网', '搜索'],
        when: { noneKeywords: ['不要联网', '不联网', '不要搜索', '不搜索'] },
      },
      { id: 'knowledge-curation', keywords: ['知识整理', '冲突治理'] },
    ] })
    assert.equal(selectExecutionRoute({
      goal: '请联网搜索两家厂商的官方能力和价格',
      brief: { materials: [{ content: '仅作为研究范围说明。' }] },
    }, snap).id, 'public-web-research')
    assert.equal(selectExecutionRoute({
      goal: '请做知识整理和冲突治理，不联网',
      brief: { materials: [{ content: '两份内容相同但负责人不同的文档。' }] },
    }, snap).id, 'knowledge-curation')
  })

  it('lets a declarative exclusion send an explicitly external request to its tool route', () => {
    const snap = snapshot({ routes: [
      {
        id: 'provided-material',
        when: { hasReadableMaterials: true, noneKeywords: ['从外部读取'] },
        skillId: 'writing-skill',
      },
      { id: 'external-meeting', keywords: ['会议'], requiredTools: ['meeting.read'] },
    ] })
    const route = selectExecutionRoute({
      goal: '请从外部读取会议并整理',
      brief: { materials: [{ content: '这是检索范围说明，不是会议正文。' }] },
    }, snap)
    assert.equal(route.id, 'external-meeting')
  })

  it('does not let a positive keyword route match a negated request', () => {
    const snap = snapshot({ routes: [
      {
        id: 'provided-material',
        when: { hasReadableMaterials: true, noneKeywords: ['联网核查', '公开网络', '网页核查', '搜索公开来源'] },
      },
      {
        id: 'public-web-research',
        keywords: ['联网', '搜索'],
        when: { noneKeywords: ['不要联网', '不联网', '不要搜索', '不搜索'] },
        requiredTools: ['search_web', 'fetch_web_page'],
      },
      { id: 'general', default: true },
    ] })
    const route = selectExecutionRoute({
      goal: '只根据给定材料整理结论，不要联网，不要搜索。',
      brief: { materials: [{ title: '冻结认证题', content: '已提供事实。' }] },
    }, snap)
    assert.equal(route.id, 'provided-material')
  })

  it('does not treat title-only or reference-only attachments as readable material', () => {
    const snap = snapshot({ routes: [
      { id: 'provided-material', when: { hasReadableMaterials: true } },
      { id: 'external-doc', keywords: ['文档'], requiredTools: ['docs.read'] },
    ] })
    const route = selectExecutionRoute({
      goal: '整理文档',
      brief: { materials: [{ title: '需求链接', ref: 'doc://123' }] },
    }, snap)
    assert.equal(route.id, 'external-doc')
  })

  it('merges the selected route into the current output contract', () => {
    const snap = snapshot({
      deliverables: [{ id: 'summary', title: '总结', type: 'document' }],
      routes: [{ id: 'docs', keywords: ['资料'], skillId: 'docs-skill', connectorId: 'docs', requiredTools: ['docs.read'] }],
    })
    const spec = resolveOutputSpec({ goal: '整理资料', brief: {}, deliverables: [] }, snap)
    assert.equal(spec.id, 'summary')
    assert.deepEqual(spec.requiredTools, ['docs.read'])
    assert.deepEqual(spec.requiredConnectorIds, ['docs'])
  })

  it('uses a route-specific quality review without changing the package fallback', () => {
    const snap = snapshot({
      qualityReview: { enabled: true, criteria: ['默认审查'] },
      routes: [{
        id: 'review', keywords: ['评审'], requiredSkills: ['review-method'],
        qualityReview: { enabled: true, criteria: ['核对冲突', '核对验收'] },
      }],
      deliverables: [{ id: 'primary', title: '答复', type: 'answer' }],
    })
    const routed = resolveOutputSpec({ goal: '评审需求', brief: {}, deliverables: [] }, snap)
    const fallback = resolveOutputSpec({ goal: '撰写需求', brief: {}, deliverables: [] }, snap)
    assert.deepEqual(qualityReviewContract(snap, routed), {
      enabled: true, criteria: ['核对冲突', '核对验收'],
    })
    assert.deepEqual(qualityReviewContract(snap, fallback), {
      enabled: true, criteria: ['默认审查'],
    })
  })

  it('preserves every new artifact returned by a multi-output tool call', () => {
    const result = {
      artifactRefs: [
        { id: 'one', type: 'image', targetPath: 'one.png' },
        { id: 'two', kind: 'image/png', targetPath: 'two.png' },
        { id: 'old', type: 'image', targetPath: 'old.png' },
      ],
      terminal: { artifactRefs: [{ id: 'two', type: 'image', targetPath: 'two.png' }] },
    }
    const artifacts = collectResultArtifacts(result, { type: 'image' }, new Set(['old']))
    assert.deepEqual(artifacts.map(item => item.id), ['one', 'two'])
  })

  it('treats a markdown artifact as a document and restores its saved body', async () => {
    const { buildArtifactTools } = require('../src/lib/agent-artifact-tools')
    const { handlers } = buildArtifactTools({ runId: 'document-run' })
    const created = await handlers.create_artifact({ kind: 'markdown', title: '产品需求文档', content: '# 完整 PRD' })
    const artifacts = collectResultArtifacts(created, { type: 'document' })
    assert.equal(artifacts.length, 1)
    assert.equal(artifacts[0].body, '# 完整 PRD')
  })

  it('refreshes snapshots by version and declared bindings, not expert identity', () => {
    const snap = snapshot({})
    assert.equal(snapshotNeedsRefresh({ assignmentSnapshot: { agentVersion: '2.0.0' } }, snap), false)
    assert.equal(snapshotNeedsRefresh({ assignmentSnapshot: { agentVersion: '1.0.0' } }, snap), true)
    assert.equal(snapshotNeedsRefresh(
      { assignmentSnapshot: { agentVersion: '2.0.0' } },
      snapshot({}, { connectors: [] }),
    ), true)
  })
})


it('does not route website implementation into architecture from generated plan steps', () => {
  const snap = snapshot({ routes: [
    { id: 'architecture', keywords: ['技术选型'] },
    { id: 'implementation', default: true },
  ] })
  assert.equal(selectExecutionRoute({ brief: { goal: '做一个宣传网页', plan: { steps: ['视觉与技术选型', '实现网页'] } } }, snap).id, 'implementation')
  assert.equal(selectExecutionRoute({ brief: { goal: '技术选型' } }, snap).id, 'architecture')
  assert.equal(selectExecutionRoute({ brief: { goal: '做一个宣传网页', materials: [
    { id: 'user-input-123', type: 'text', title: '用户补充', content: '只做技术选型' },
  ] } }, snap).id, 'architecture')
})
