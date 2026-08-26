'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const grounding = require('../src/lib/agent-grounding-runtime')

describe('agent-grounding-runtime', () => {
  it('binds numeric selection 1-based to pendingSelection option', () => {
    let state = grounding.createReferenceState()
    state = grounding.setPendingSelection(state, [
      { id: 'c1', label: 'A', payload: { minute_token: 'a' }, boundTool: 'feishu.meeting_read' },
      { id: 'c2', label: 'B', payload: { minute_token: 'b' }, boundTool: 'feishu.meeting_read' },
    ])
    const result = grounding.bindNumericSelection(state, '2')
    assert.equal(result.bound, true)
    assert.equal(result.option.id, 'c2')
    assert.equal(result.index, 2)
  })

  it('routes docx meeting records to feishu.read_doc', () => {
    const pending = grounding.meetingCandidatesToPendingSelection([{
      title: '2026-年中战略会',
      url: 'https://forever9.feishu.cn/docx/Y7fHdNvnIoC9nTxye9gc1xJ5ngg',
    }])
    assert.equal(pending.options[0].boundTool, 'feishu.read_doc')
    const state = grounding.setPendingSelection(grounding.createReferenceState(), pending.options, pending.refSetId)
    const result = grounding.bindNumericSelection(state, '1')
    const intent = grounding.buildDeterministicToolIntent(result.option)
    assert.equal(intent.tool, 'feishu.read_doc')
    assert.equal(intent.args.url, 'https://forever9.feishu.cn/docx/Y7fHdNvnIoC9nTxye9gc1xJ5ngg')
  })

  it('fail-closed when numeric input without pendingSelection', () => {
    const result = grounding.bindNumericSelection(grounding.createReferenceState(), '2')
    assert.equal(result.bound, false)
    assert.equal(result.ambiguous, true)
  })

  it('clears pendingSelection on task switch', () => {
    let state = grounding.setPendingSelection(grounding.createReferenceState(), [{ id: 'c1', label: 'A' }])
    state = grounding.clearStaleOnTaskSwitch(state, { workflowId: 'new' })
    assert.equal(state.pendingSelection, null)
    assert.equal(state.refs.every(r => r.stale), true)
  })

  it('marks title-only tool body as truncated', () => {
    const q = grounding.classifyToolResultQuality('feishu.meeting_read', {
      ok: true,
      text: '{"title":"某会议"}',
    })
    assert.equal(q.status, 'truncated')
  })

  it('blocks false execution claims via OutputGate', () => {
    const verification = grounding.verifyClaims({
      text: '已读取会议内容，议题：发布。',
      evidenceLedger: grounding.createEvidenceLedger(),
      toolLedger: grounding.createToolLedger(),
      taskFrame: { requiredTools: ['feishu.meeting_read'] },
    })
    assert.equal(verification.passed, false)
    const gate = grounding.applyOutputGate({ text: '已读取会议内容，议题：发布。', verification, regenUsed: true })
    assert.equal(gate.blocked, true)
    assert.match(gate.text, /尚未|不能|需要先|证据不足|没有成功/)
  })

  it('does not let an unrelated successful tool support an import claim', () => {
    const toolLedger = grounding.recordToolCall(grounding.createToolLedger(), {
      name: 'read_file', status: 'ok',
    })
    const verification = grounding.verifyClaims({
      text: '项目已经导入完成。',
      evidenceLedger: grounding.createEvidenceLedger(),
      toolLedger,
    })
    assert.equal(verification.passed, false)
    assert.ok(verification.violations.some(item => item.code === 'unsupported_execution_claim'))
  })

  it('does not let search or candidate results support concrete facts', () => {
    const evidenceLedger = grounding.appendEvidence(
      grounding.createEvidenceLedger(),
      {
        source: 'tool',
        status: 'ok',
        digest: '搜索到会议标题与候选 token',
        provenance: { tool: 'feishu.search_docs' },
      },
    )
    const verification = grounding.verifyClaims({
      text: '负责人：张三；结论：已经确定上线日期。',
      evidenceLedger,
      toolLedger: grounding.createToolLedger(),
    })
    assert.equal(verification.passed, false)
    assert.ok(verification.violations.some(item => item.code === 'ungrounded_external_fact'))
  })

  it('allows a verified meeting candidate list but not a conclusion from it', () => {
    const merged = grounding.mergeToolResultsIntoLedgers({
      toolMessages: [{
        toolName: 'feishu.meeting_candidates',
        toolCallId: 'call-candidates',
        status: 'done',
        text: '最近 3 个自然日的会议候选：\n【1】周会纪要（2026-08-21）\n请回复序号选择要读取的会议。',
      }],
    })
    const listVerification = grounding.verifyClaims({
      text: '最近 3 个自然日的会议候选：\n【1】周会纪要（2026-08-21）\n请回复序号选择要读取的会议。',
      evidenceLedger: merged.evidenceLedger,
      toolLedger: merged.toolLedger,
    })
    assert.equal(listVerification.passed, true)
    const conclusionVerification = grounding.verifyClaims({
      text: '会议结论：项目将在周五上线，负责人是张三。',
      evidenceLedger: merged.evidenceLedger,
      toolLedger: merged.toolLedger,
    })
    assert.equal(conclusionVerification.passed, false)
    assert.ok(conclusionVerification.violations.some(item => item.code === 'ungrounded_external_fact'))
  })

  it('does not let planning language launder an unsupported fact', () => {
    const verification = grounding.verifyClaims({
      text: '会议时间：明天上午；下一步我会整理行动项。',
      evidenceLedger: grounding.createEvidenceLedger(),
      toolLedger: grounding.createToolLedger(),
    })
    assert.equal(verification.passed, false)
    assert.ok(verification.violations.some(item => item.code === 'ungrounded_external_fact'))
  })

  it('allows an explicit evidence-limited refusal', () => {
    const verification = grounding.verifyClaims({
      text: '目前尚未读取到会议正文，无法确认会议时间和负责人。',
      evidenceLedger: grounding.createEvidenceLedger(),
      toolLedger: grounding.createToolLedger(),
    })
    assert.equal(verification.passed, true)
  })

  it('rejects a successful read whose returned document does not match the requested token', () => {
    const binding = grounding.validateToolResultBinding(
      { doc_token: 'doc_requested' },
      JSON.stringify({ doc_token: 'doc_other', content: '正文内容足够长，可以被读取。' }),
    )
    assert.equal(binding.mismatch, true)
    const merged = grounding.mergeToolResultsIntoLedgers({
      toolMessages: [{
        toolName: 'feishu.read_doc',
        toolCallId: 'call-1',
        args: { doc_token: 'doc_requested' },
        status: 'done',
        text: JSON.stringify({ doc_token: 'doc_other', content: '正文内容足够长，可以被读取。' }),
      }],
    })
    assert.equal(merged.evidenceLedger.entries[0].status, 'fail')
    assert.equal(merged.evidenceLedger.entries[0].provenance.bindingStatus, 'mismatch')
    assert.equal(merged.toolLedger.calls[0].status, 'fail')
    const verification = grounding.verifyClaims({
      text: '负责人：张三。',
      evidenceLedger: merged.evidenceLedger,
      toolLedger: merged.toolLedger,
    })
    const gate = grounding.applyOutputGate({ text: '负责人：张三。', verification, regenUsed: true })
    assert.match(gate.text, /不一致|核对链接|token/)
  })

  it('allows plain chat without grounding violations', () => {
    const verification = grounding.verifyClaims({
      text: '你好，有什么可以帮你？',
      evidenceLedger: grounding.createEvidenceLedger(),
      toolLedger: grounding.createToolLedger(),
    })
    assert.equal(verification.passed, true)
  })

  it('serializes and deserializes ReferenceState', () => {
    let state = grounding.setPendingSelection(grounding.createReferenceState(), [{ id: 'x', label: 'X' }])
    const raw = grounding.serializeReferenceState(state)
    const restored = grounding.deserializeReferenceState(raw)
    assert.equal(restored.pendingSelection.options[0].id, 'x')
  })
})
