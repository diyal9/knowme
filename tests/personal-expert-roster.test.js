const { describe, it } = require('node:test')
const assert = require('node:assert')
const { commonExpertIds, projectCommonExperts, buildCommonExpertContext } = require('../src/lib/personal-expert-roster')

describe('personal expert roster', () => {
  const modes = { bindings: { office: [{ expertId: 'writer' }], visual: [{ expertId: 'designer' }, { expertId: 'writer' }] } }

  it('deduplicates experts selected as common across workbench modes', () => {
    assert.deepEqual(commonExpertIds(modes), ['writer', 'designer'])
  })

  it('projects only available private expert metadata and no history or credentials', () => {
    const projected = projectCommonExperts(modes, [
      { id: 'writer', kind: 'expert', name: '长文编辑', description: '写作', enabled: true },
      { id: 'designer', kind: 'expert', name: '视觉设计师', description: '设计', enabled: false },
    ])
    assert.deepEqual(projected.map(item => item.id), ['writer'])
    const context = buildCommonExpertContext(projected)
    assert.match(context, /转接前.*确认/)
    assert.doesNotMatch(context, /凭据.*secret/i)
  })
})
