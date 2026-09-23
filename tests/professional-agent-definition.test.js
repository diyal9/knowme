'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const {
  definitionHash,
  validateProfessionalAgentDefinition,
} = require('../src/lib/professional-agent-definition')

function professionalDefinition(overrides = {}) {
  return {
    id: 'finance-reviewer',
    name: '经营复盘专家',
    description: '负责基于统一口径完成经营复盘并交付可追溯结论。',
    version: '1.0.0',
    soul: '证据优先，不用猜测替代业务事实。',
    sop: '先确认目标和口径，再执行分析，最后逐项复核交付物。',
    agenticType: 'planning',
    skills: ['business-review-method'],
    connectors: [],
    optionalConnectors: [],
    knowledgeRefs: ['knowledge:finance-metrics'],
    useCases: ['月度经营复盘'],
    boundaries: ['不代替财务审批'],
    inputs: [{ name: '经营数据', type: 'table', required: true }],
    outputs: [{ name: '复盘报告', type: 'document', required: true }],
    permissions: {
      connectors: { allowedConnectorIds: [] },
      tools: { allowlist: ['read_file'] },
      network: false,
      write: false,
      externalWrite: false,
    },
    risk: { level: 'low', reasons: [] },
    execution: {
      strategy: 'sop-first',
      routes: [{
        id: 'review',
        label: '经营复盘',
        description: '按统一口径分析经营数据并形成复盘。',
        requiredSkills: ['business-review-method'],
        requiredTools: ['read_file'],
        toolAllowlist: ['read_file'],
      }],
      deliverables: [{ id: 'report', title: '经营复盘报告', type: 'document', required: true }],
      qualityReview: { enabled: true, criteria: ['所有数字可追溯', '结论与证据逐项对应'] },
    },
    lifecycle: { state: 'active', newTasks: true, successors: [] },
    ...overrides,
  }
}

describe('professional Agent definition', () => {
  it('accepts a complete definition and builds a schema v3 manifest', () => {
    const result = validateProfessionalAgentDefinition(professionalDefinition(), {
      availableIds: new Set(['business-review-method']),
    })
    assert.equal(result.ok, true, JSON.stringify(result.issues))
    assert.equal(result.manifest.schemaVersion, 3)
    assert.equal(result.manifest.metadata.knowme.execution.routes[0].id, 'review')
    assert.deepEqual(result.manifest.metadata.knowledgeRefs, ['knowledge:finance-metrics'])
  })

  it('blocks weak definitions and undeclared tool authority', () => {
    const definition = professionalDefinition({
      boundaries: [],
      execution: {
        routes: [{ id: 'review', label: '复盘', description: '执行复盘', requiredTools: ['write_file'] }],
        deliverables: [],
        qualityReview: { enabled: true, criteria: ['只检查一次'] },
      },
    })
    const result = validateProfessionalAgentDefinition(definition, {
      availableIds: new Set(['business-review-method']),
    })
    assert.equal(result.ok, false)
    assert.ok(result.issues.some(item => item.code === 'missing_boundaries'))
    assert.ok(result.issues.some(item => item.code === 'tool_not_allowed'))
    assert.ok(result.issues.some(item => item.code === 'weak_quality_review'))
  })

  it('hashes definitions canonically', () => {
    assert.equal(definitionHash({ a: 1, b: 2 }), definitionHash({ b: 2, a: 1 }))
  })
})
