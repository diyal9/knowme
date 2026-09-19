'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const { registerExpertTaskIpc } = require('../src/ipc/expert-task')

test('expert-task-get stays on the lightweight store read path', async () => {
  const handlers = new Map()
  const task = { id: 'task-1', kind: 'expert', status: 'running' }
  let capabilityRuntimeCalls = 0
  let getCalls = 0
  const store = {
    list: () => ({ ok: true, tasks: [] }),
    get: (id) => {
      getCalls += 1
      assert.equal(id, task.id)
      return { ok: true, task }
    },
  }
  const deps = {
    getWorkbenchTaskStore: () => store,
    ensureCapabilityHub: () => {
      capabilityRuntimeCalls += 1
      throw new Error('read path must not initialize capability runtime')
    },
  }
  const ipcMain = {
    handle: (channel, handler) => handlers.set(channel, handler),
  }

  registerExpertTaskIpc(ipcMain, deps)
  const result = await handlers.get('expert-task-get')({}, task.id)

  assert.deepEqual(result, { ok: true, task })
  assert.equal(getCalls, 1)
  assert.equal(capabilityRuntimeCalls, 0)
})
