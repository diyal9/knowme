'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const {
  formatToolLabelForUser,
  formatViolationForUser,
  stripRawToolIdsFromText,
} = require('../src/lib/agent-grounding-labels')
const { renderGroundingStatusMetaHtml } = require('../src/lib/agent-grounding-ui')
const groundingRuntime = require('../src/lib/agent-grounding-runtime')

describe('agent grounding user labels', () => {
  it('maps known feishu tools to friendly Chinese labels', () => {
    assert.equal(formatToolLabelForUser('feishu.meeting_read'), '飞书会议妙记读取')
    assert.equal(formatToolLabelForUser('feishu.search_docs'), '飞书文档搜索')
  })

  it('formatViolationForUser hides raw tool ids in missing_required_tools', () => {
    const text = formatViolationForUser({
      code: 'missing_required_tools',
      message: '缺少必需工具调用: feishu.meeting_read',
      missingTools: ['feishu.meeting_read'],
    })
    assert.ok(!text.includes('feishu.meeting_read'))
    assert.ok(text.includes('飞书会议妙记读取'))
  })

  it('explains missing importer evidence with an actionable next step', () => {
    const text = formatViolationForUser({
      code: 'missing_required_evidence',
      unmet: [
        { kind: 'tool_result', tool: 'preview_external_project' },
        { kind: 'tool_result', tool: 'design_external_workflow_import' },
      ],
    })
    assert.ok(text.includes('扫描外部项目'))
    assert.ok(text.includes('生成导入方案'))
    assert.ok(text.includes('重新执行'))
    assert.ok(!text.includes('requiredEvidence'))
  })

  it('stripRawToolIdsFromText replaces dotted tool ids', () => {
    const text = stripRawToolIdsFromText('需要先调用 feishu.meeting_read 再总结')
    assert.ok(!text.includes('feishu.meeting_read'))
    assert.ok(text.includes('飞书会议妙记读取'))
  })

  it('buildHonestRefusal does not expose raw tool ids to users', () => {
    const refusal = groundingRuntime.buildHonestRefusal({
      violations: [{ code: 'missing_required_tools', missingTools: ['feishu.meeting_read'] }],
    }, { requiredTools: ['feishu.meeting_read'] })
    assert.ok(!refusal.includes('feishu.meeting_read'))
    assert.ok(refusal.includes('飞书会议妙记读取'))
  })

  it('renderGroundingStatusMetaHtml never emits raw tool ids', () => {
    const html = renderGroundingStatusMetaHtml({
      status: 'blocked',
      sources: [{ tool: 'feishu.meeting_read', status: 'fail' }],
      violations: [{
        code: 'missing_required_tools',
        message: '缺少必需工具调用: feishu.meeting_read',
        missingTools: ['feishu.meeting_read'],
      }],
    })
    assert.ok(!html.includes('feishu.meeting_read'))
    assert.ok(html.includes('飞书会议妙记读取'))
    assert.ok(html.includes('缺少必需读取'))
  })

  it('buildGroundingStatus adds userMessage without removing machine fields', () => {
    const gs = groundingRuntime.buildGroundingStatus({
      passed: false,
      claims: [],
      violations: [{
        code: 'missing_required_tools',
        message: '缺少必需工具调用: feishu.meeting_read',
        missingTools: ['feishu.meeting_read'],
      }],
    })
    assert.equal(gs.violations[0].message, '缺少必需工具调用: feishu.meeting_read')
    assert.ok(!gs.violations[0].userMessage.includes('feishu.meeting_read'))
  })

})
