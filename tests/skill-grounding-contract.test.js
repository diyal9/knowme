'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const {
  parseSkillGroundingFromContent,
  parseSkillFrontmatter,
  parseGroundingBlocksFromRaw,
} = require('../src/lib/skill-runtime')
const groundingRuntime = require('../src/lib/agent-grounding-runtime')

const BLOCK_D4 = `---
name: meeting-summary
requiredTools:
  - feishu.meeting_read
requiredEvidence:
  - kind: tool_result
    tool: feishu.meeting_read
    minChars: 200
    forbidTruncated: true
completionConditions:
  - type: tool_success
    tool: feishu.meeting_read
  - type: evidence_present
    kind: meeting_minutes_body
---
# Body
`

describe('skill grounding contract', () => {
  it('parses inline requiredTools from SKILL frontmatter', () => {
    const content = `---
name: meeting-summary
requiredTools: [feishu.meeting_read, feishu.meeting_candidates]
completionConditions: [tool_success]
---
# Body
`
    const parsed = parseSkillGroundingFromContent(content)
    assert.equal(parsed.ok, true)
    assert.deepEqual(parsed.contract.requiredTools, ['feishu.meeting_read', 'feishu.meeting_candidates'])
  })

  it('parses design D4 block-level grounding arrays', () => {
    const parsed = parseSkillGroundingFromContent(BLOCK_D4)
    assert.equal(parsed.ok, true)
    assert.deepEqual(parsed.contract.requiredTools, ['feishu.meeting_read'])
    assert.equal(parsed.contract.requiredEvidence.length, 1)
    assert.equal(parsed.contract.requiredEvidence[0].tool, 'feishu.meeting_read')
    assert.equal(parsed.contract.requiredEvidence[0].minChars, 200)
    assert.equal(parsed.contract.completionConditions.length, 2)
    assert.equal(parsed.contract.completionConditions[0].type, 'tool_success')
    assert.equal(parsed.contract.completionConditions[1].kind, 'meeting_minutes_body')
  })

  it('does not silently empty block-level requiredTools', () => {
    const fm = parseSkillFrontmatter(BLOCK_D4)
    assert.equal(fm.ok, true)
    assert.ok(Array.isArray(fm.frontmatter.requiredTools))
    assert.deepEqual(fm.frontmatter.requiredTools, ['feishu.meeting_read'])
    assert.ok(Array.isArray(fm.frontmatter.requiredEvidence))
    assert.equal(fm.frontmatter.requiredEvidence.length, 1)
  })

  it('parses mixed inline requiredTools and block requiredEvidence', () => {
    const content = `---
name: mixed
requiredTools: [feishu.meeting_read]
requiredEvidence:
  - kind: tool_result
    tool: feishu.meeting_read
    minChars: 100
---
# Body
`
    const parsed = parseSkillGroundingFromContent(content)
    assert.equal(parsed.ok, true)
    assert.deepEqual(parsed.contract.requiredTools, ['feishu.meeting_read'])
    assert.equal(parsed.contract.requiredEvidence[0].minChars, 100)
  })

  it('returns empty arrays for absent grounding keys without error', () => {
    const content = `---
name: plain
description: no grounding
---
# Body
`
    const parsed = parseSkillGroundingFromContent(content)
    assert.equal(parsed.ok, true)
    assert.deepEqual(parsed.contract.requiredTools, [])
    assert.deepEqual(parsed.contract.requiredEvidence, [])
    assert.deepEqual(parsed.contract.completionConditions, [])
  })

  it('flags invalid requiredTools scalar types', () => {
    const content = `---
name: bad
requiredTools: 123
---
# Body
`
    const parsed = parseSkillGroundingFromContent(content)
    assert.equal(parsed.ok, false)
    assert.deepEqual(parsed.contract.requiredTools, [])
    assert.ok(parsed.issues.some(i => i.path === 'requiredTools'))
  })

  it('rejects tool_result evidence without tool via validateGroundingContract', () => {
    const validation = groundingRuntime.validateGroundingContract({
      requiredEvidence: [{ kind: 'tool_result', minChars: 100 }],
    })
    assert.equal(validation.ok, false)
    assert.ok(validation.issues.length)
  })

  it('mergeGroundingContracts unions tools and strictest evidence', () => {
    const merged = groundingRuntime.mergeGroundingContracts([
      {
        skillId: 'a',
        requiredTools: ['feishu.meeting_read'],
        requiredEvidence: [{ kind: 'tool_result', tool: 'feishu.meeting_read', minChars: 100 }],
        completionConditions: [{ type: 'tool_success', tool: 'feishu.meeting_read' }],
      },
      {
        skillId: 'b',
        requiredTools: ['feishu.search_docs'],
        requiredEvidence: [{ kind: 'tool_result', tool: 'feishu.meeting_read', minChars: 300 }],
        completionConditions: [{ type: 'evidence_present', kind: 'meeting_minutes_body' }],
      },
    ])
    assert.deepEqual(merged.requiredTools.sort(), ['feishu.meeting_read', 'feishu.search_docs'].sort())
    assert.equal(merged.requiredEvidence.length, 1)
    const meetingRule = merged.requiredEvidence.find(r => r.tool === 'feishu.meeting_read')
    assert.equal(meetingRule.minChars, 300)
    assert.equal(merged.completionConditions.length, 2)
    assert.equal(merged.skillId, 'a+b')
  })

  it('parseGroundingBlocksFromRaw handles empty block lists', () => {
    const raw = `requiredTools:\n\nname: x`
    const blocks = parseGroundingBlocksFromRaw(raw)
    assert.deepEqual(blocks, {})
  })
})
