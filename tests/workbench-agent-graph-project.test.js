'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { registerWorkbenchAgentGraphIpc } = require('../src/ipc/workbench-agent-graph')

function startHandler(projectId, context) {
  const handlers = new Map()
  registerWorkbenchAgentGraphIpc({
    handle: (channel, handler) => handlers.set(channel, handler),
  }, {
    getActiveProjectId: () => projectId,
    resolveProjectContext: () => context,
    workbenchExternalRunContexts: new Map(),
  })
  return handlers.get('workbench-agent-graph-start')
}

test('file-producing Agent Graph requires a project', async () => {
  const result = await startHandler(null, null)(null, { goal: 'create report' })
  assert.equal(result.ok, false)
  assert.equal(result.code, 'project_required')
})

test('Agent Graph blocks missing, archived and readonly projects before compilation', async () => {
  const cases = [
    {
      status: 'missing',
      context: { ok: true, project: { status: 'missing' }, workspace: { rootPath: 'D:/gone', available: false, writable: false } },
      code: 'project_unavailable',
    },
    {
      status: 'archived',
      context: { ok: true, project: { status: 'archived' }, workspace: { rootPath: 'D:/archive', available: true, writable: false } },
      code: 'project_unavailable',
    },
    {
      status: 'readonly',
      context: { ok: true, project: { status: 'readonly' }, workspace: { rootPath: 'D:/read', available: true, writable: false } },
      code: 'project_readonly',
    },
  ]

  for (const item of cases) {
    const result = await startHandler(`project-${item.status}`, item.context)(null, { goal: 'create report' })
    assert.equal(result.ok, false)
    assert.equal(result.code, item.code)
  }
})
