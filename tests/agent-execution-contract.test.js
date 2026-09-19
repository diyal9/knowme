'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const {
  mergeExecutionContracts,
  validateExecutionCompletion,
  enforceExecutionTerminal,
} = require('../src/lib/agent-execution-contract')

describe('agent execution completion contract', () => {
  it('requires successful tool calls, evidence, and artifacts together', () => {
    const contract = mergeExecutionContracts([{
      requiredTools: ['import_project', 'verify_import'],
      requiredEvidence: [{ tool: 'verify_import', kind: 'tool_result' }],
      completionConditions: [{ type: 'artifact_present' }],
      minArtifacts: 1,
    }])
    const failed = validateExecutionCompletion(contract, {
      executionEvidence: {
        toolCalls: [
          { name: 'import_project', status: 'ok' },
          { name: 'verify_import', status: 'fail' },
        ],
        evidence: [],
      },
      artifactRefs: [],
    })
    assert.equal(failed.ok, false)
    assert.ok(failed.violations.some(item => item.code === 'missing_required_tools'))
    assert.ok(failed.violations.some(item => item.code === 'missing_required_evidence'))
    assert.ok(failed.violations.some(item => item.code === 'missing_required_artifacts'))

    const passed = validateExecutionCompletion(contract, {
      executionEvidence: {
        toolCalls: [
          { name: 'import_project', status: 'ok' },
          { name: 'verify_import', status: 'ok' },
        ],
        evidence: [{ status: 'ok', provenance: { tool: 'verify_import', kind: 'tool_result' } }],
      },
      artifactRefs: [{ id: 'report', type: 'document' }],
    })
    assert.equal(passed.ok, true)
  })

  it('turns an optimistic remote completed terminal into a failed terminal', () => {
    const terminal = enforceExecutionTerminal({ requiredTools: ['publish_release'] }, {
      terminal: 'DONE', ok: true, text: '已经发布', executionEvidence: { toolCalls: [] },
    })
    assert.equal(terminal.ok, false)
    assert.equal(terminal.terminal, 'ERROR')
    assert.equal(terminal.code, 'execution_contract_unmet')
    assert.equal(terminal.executionEvidence.gateStatus, 'blocked')
  })

  it('accepts concrete file mutations for the host write_file capability', () => {
    const contract = {
      requiredTools: ['write_file'],
      requiredEvidence: [{ kind: 'tool_result', tool: 'write_file' }],
      completionConditions: [{ type: 'tool_success', tool: 'write_file' }],
    }
    for (const tool of ['write_file', 'create_file', 'apply_patch']) {
      const assessed = validateExecutionCompletion(contract, {
        executionEvidence: {
          toolCalls: [{ name: tool, status: 'ok' }],
          evidence: [{ status: 'ok', provenance: { tool } }],
        },
      })
      assert.equal(assessed.ok, true, tool)
    }
  })
})
