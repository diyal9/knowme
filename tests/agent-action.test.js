'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const action = require('../src/lib/agent-action')

describe('agent-action', () => {
  it('normalizes legacy send and fill actions', () => {
    const send = action.normalizeAction({
      id: 's1',
      label: '整理行动项',
      action: 'send',
      payload: '请整理上面的内容',
    })
    assert.equal(send.kind, 'conversation')
    assert.equal(send.execution, 'send')
    assert.equal(send.requiresInput, false)

    const fill = action.normalizeAction({
      id: 's2',
      label: '补充材料',
      action: 'fill',
      payload: '请整理[在此粘贴会议记录]',
    })
    assert.equal(fill.execution, 'fill')
    assert.equal(fill.requiresInput, true)
  })

  it('downgrades placeholder sends to editable fills', () => {
    const resolved = action.resolveExecutionPolicy({
      label: '整理文件',
      action: 'send',
      payload: '请整理【待填写的真实内容】',
    })
    assert.equal(resolved.ok, true)
    assert.equal(resolved.action.execution, 'fill')
    assert.equal(action.hasUserInputSlot(resolved.action.payload), true)
  })

  it('maps navigation and clipboard actions to their execution kinds', () => {
    const open = action.normalizeAction({
      label: '打开文档',
      action: 'open_link',
      payload: 'https://example.com/doc',
    })
    const copy = action.normalizeAction({
      label: '复制结果',
      action: 'copy',
      payload: '内容',
    })
    assert.deepEqual(
      { kind: open.kind, execution: open.execution },
      { kind: 'navigation', execution: 'open' }
    )
    assert.deepEqual(
      { kind: copy.kind, execution: copy.execution },
      { kind: 'clipboard', execution: 'copy' }
    )
  })

  it('rejects incomplete and unknown actions', () => {
    assert.equal(action.validateAction(null).ok, false)
    assert.equal(action.validateAction({
      kind: 'conversation',
      execution: 'send',
      label: '空动作',
      payload: '',
      args: {},
      selection: 'single',
    }).code, 'missing_payload')
    assert.equal(action.validateAction({
      kind: 'unknown',
      execution: 'send',
      label: '未知',
      payload: 'x',
      selection: 'single',
    }).code, 'invalid_kind')
  })

  it('dispatches once and reports stable lifecycle states', async () => {
    const statuses = []
    let calls = 0
    const dispatcher = action.createActionDispatcher({
      send: async (item) => {
        calls++
        return { prompt: item.payload }
      },
      onStatus: event => statuses.push(event.status),
    })
    const first = await dispatcher.dispatch({
      id: 'once',
      label: '继续细化',
      action: 'send',
      payload: '请继续细化',
    }, { context: { messageId: 'm1' } })
    const second = await dispatcher.dispatch({
      id: 'once',
      label: '继续细化',
      action: 'send',
      payload: '请继续细化',
    }, { context: { messageId: 'm1' } })
    assert.equal(first.ok, true)
    assert.equal(first.status, 'success')
    assert.equal(second.ok, false)
    assert.equal(second.status, 'duplicate')
    assert.equal(calls, 1)
    assert.deepEqual(statuses, ['pending', 'success'])
  })

  it('routes invoke actions to the kind-specific executor', async () => {
    const dispatcher = action.createActionDispatcher({
      file: async item => ({ tool: item.args.tool, path: item.args.path }),
    })
    const result = await dispatcher.dispatch({
      id: 'read-1',
      kind: 'file',
      execution: 'invoke',
      label: '读取文件',
      args: { tool: 'read_file', path: 'notes.md' },
    })
    assert.equal(result.ok, true)
    assert.deepEqual(result.result, { tool: 'read_file', path: 'notes.md' })
  })

  it('provides constrained file and capability action adapters', () => {
    const file = action.createFileAction({
      tool: 'read_file',
      label: '读取文件',
      args: { path: 'notes.md' },
    })
    const skill = action.createSkillAction({
      skillId: 'meeting-summary',
      label: '会议总结',
      payload: '总结最近的会议',
    })
    const workflow = action.createWorkflowAction({
      workflowId: 'team-run',
      label: '启动流程',
      payload: '启动团队流程',
    })
    assert.equal(action.validateAction(file).ok, true)
    assert.equal(file.args.tool, 'read_file')
    assert.equal(skill.kind, 'skill')
    assert.equal(skill.args.skillId, 'meeting-summary')
    assert.equal(workflow.kind, 'workflow')
    assert.equal(action.validateAction(action.createFileAction({
      tool: 'write_file',
      label: '写入文件',
      args: { path: 'notes.md' },
    })).code, 'file_tool_not_allowed')
  })

  it('turns approved side effects into confirmation actions', () => {
    const resolved = action.resolveExecutionPolicy({
      id: 'write-1',
      kind: 'tool',
      execution: 'invoke',
      label: '写入文档',
      payload: '写入远程文档',
      requiresApproval: true,
    })
    assert.equal(resolved.ok, true)
    assert.equal(resolved.action.execution, 'confirm')
  })
})
