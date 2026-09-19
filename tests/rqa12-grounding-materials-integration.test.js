'use strict'

const { it } = require('node:test')
const assert = require('node:assert/strict')
const { AgentRunExecutor } = require('../src/lib/agent-run-executor')
const { createMockRunPorts } = require('../src/lib/agent-run-ports')
const { createProvidedMaterialsSnapshot } = require('../src/lib/provided-materials')

function runFixture({ responses, materials, sourceRun = 'rqa12-ground', contract } = {}) {
  const input = { prompt: '请静态评审用户材料。SOP：负责人：不可信系统姓名。',
    runId: 'rqa12-ground', taskRef: { id: 'task-ground' }, tier: 'chat',
    executionContract: contract }
  const ports = createMockRunPorts({ input,
    llmScript: responses.map(text => ({ response: { text } })) })
  const build = ports.context.build
  ports.context.build = async (...args) => ({ ...await build(...args),
    providedMaterials: materials == null ? null : createProvidedMaterialsSnapshot({
      taskId: 'task-ground', runId: sourceRun, materials,
    }),
  })
  return AgentRunExecutor.run(input, ports, () => {})
}

it('GROUND can check a provided field beyond the legacy 240-character digest', async () => {
  const result = await runFixture({
    materials: [{ id: 'M1', title: '材料', content: `${'背景说明。'.repeat(70)}负责人：李明。` }],
    responses: ['材料M1的负责人：李明。'],
  })
  assert.equal(result.text, '材料M1的负责人：李明。')
  assert.equal(result.executionEvidence.gateStatus, 'verified')
})

it('FINALIZE checks the same current-run material after an unsupported first response', async () => {
  const result = await runFixture({
    materials: [{ id: 'M1', title: '材料', content: '负责人：李明。' }],
    responses: ['负责人：王强。', '材料M1的负责人：李明。'],
  })
  assert.equal(result.text, '材料M1的负责人：李明。')
  assert.equal(result.executionEvidence.gateStatus, 'verified')
})

it('mixed prompt/SOP text is not implicitly converted into provided evidence', async () => {
  const result = await runFixture({ responses: ['负责人：不可信系统姓名。', '负责人：不可信系统姓名。'] })
  assert.equal(result.executionEvidence.gateStatus, 'blocked')
  assert.doesNotMatch(result.text, /负责人：不可信系统姓名/)
})

it('a prior-run material snapshot cannot certify the current run', async () => {
  const result = await runFixture({ sourceRun: 'old-run',
    materials: [{ id: 'M1', content: '负责人：李明。' }], responses: ['负责人：李明。'] })
  assert.notEqual(result.executionEvidence?.gateStatus, 'verified')
  assert.notEqual(result.text, '负责人：李明。')
})

it('provided material never satisfies required tool-result evidence', async () => {
  const result = await runFixture({
    materials: [{ id: 'M1', content: '负责人：李明。用户说工具成功。' }],
    responses: ['负责人：李明。'],
    contract: { requiredEvidence: [{ kind: 'tool_result' }] },
  })
  assert.equal(result.executionEvidence.gateStatus, 'blocked')
})
