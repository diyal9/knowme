'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const processTools = require('../src/lib/agent-process-tools')

describe('agent-process-tools', () => {
  it('run_task executes template and returns output', async () => {
    const spawnImpl = (cmd, args) => {
      const { EventEmitter } = require('events')
      const child = new EventEmitter()
      child.stdout = new EventEmitter()
      child.stderr = new EventEmitter()
      child.kill = () => {}
      process.nextTick(() => {
        child.stdout.emit('data', 'ok\n')
        child.emit('close', 0)
      })
      return child
    }
    const { handlers } = processTools.buildProcessTools({ resolveCwd: () => process.cwd(), spawnImpl, runId: 'r1' })
    const r = await handlers.run_task({ task: 'npm test', cwd: process.cwd() })
    assert.equal(r.ok, true)
    assert.match(r.text, /ok/)
  })

  it('blocks dangerous commands in run_task templates indirectly via start_process guard', async () => {
    const { handlers } = processTools.buildProcessTools({ runId: 'r1' })
    const r = await handlers.start_process({ command: 'rm', args: ['-rf', '/'] })
    assert.equal(r.ok, false)
    assert.equal(r.code, 'scope_denied')
  })

  it('cancel_task stops running process within 3s (mock)', async () => {
    let killed = false
    const spawnImpl = () => {
      const { EventEmitter } = require('events')
      const child = new EventEmitter()
      child.stdout = new EventEmitter()
      child.stderr = new EventEmitter()
      child.pid = 999
      child.kill = () => { killed = true; child.emit('close', null, 'SIGTERM') }
      return child
    }
    const { handlers } = processTools.buildProcessTools({ spawnImpl, runId: 'r2' })
    const started = await handlers.start_process({ command: 'echo', args: ['running'] })
    assert.ok(started.taskId)
    const t0 = Date.now()
    const cancelled = await handlers.cancel_task({ taskId: started.taskId })
    assert.equal(cancelled.ok, true)
    assert.equal(cancelled.status, 'cancelled')
    assert.ok(Date.now() - t0 <= 3000)
    assert.equal(killed, true)
  })

  it('task_status and task_logs report registry state', async () => {
    const spawnImpl = () => {
      const { EventEmitter } = require('events')
      const child = new EventEmitter()
      child.stdout = new EventEmitter()
      child.stderr = new EventEmitter()
      child.kill = () => child.emit('close', 0)
      setImmediate(() => {
        child.stdout.emit('data', 'logline')
        child.emit('close', 0)
      })
      return child
    }
    const { handlers } = processTools.buildProcessTools({ spawnImpl, runId: 'r3' })
    const started = await handlers.start_process({ command: 'echo', args: ['hi'] })
    await new Promise((r) => setImmediate(r))
    const st = await handlers.task_status({ taskId: started.taskId })
    assert.equal(st.ok, true)
    const logs = await handlers.task_logs({ taskId: started.taskId })
    assert.match(logs.text, /logline/)
  })

  it('cancelProcessesForRun cancels all for runId', async () => {
    processTools.processRegistry.clear()
    const entry = processTools.registerProcessEntry({
      taskId: 't1', runId: 'run-x', status: 'running', logs: {}, child: { kill: () => {} },
    })
    assert.ok(entry)
    const cancelled = processTools.cancelProcessesForRun('run-x')
    assert.equal(cancelled.length, 1)
  })

  it('run_task aborts on signal and does not stay running', async () => {
    processTools.processRegistry.clear()
    let killed = false
    const spawnImpl = () => {
      const { EventEmitter } = require('events')
      const child = new EventEmitter()
      child.stdout = new EventEmitter()
      child.stderr = new EventEmitter()
      child.pid = 4242
      child.kill = () => {
        killed = true
        child.emit('close', null, 'SIGTERM')
      }
      return child
    }
    const controller = new AbortController()
    const { handlers } = processTools.buildProcessTools({
      spawnImpl,
      runId: 'run-abort',
      resolveCwd: () => process.cwd(),
    })
    const pending = handlers.run_task(
      { task: 'npm test', cwd: process.cwd(), timeoutMs: 60000 },
      controller.signal,
    )
    await new Promise((r) => setImmediate(r))
    controller.abort()
    const r = await pending
    assert.equal(r.ok, false)
    assert.equal(r.code, 'cancelled')
    assert.equal(killed, true)
    const running = [...processTools.processRegistry.values()].filter(
      (e) => e.runId === 'run-abort' && (e.status === 'running' || e.status === 'starting'),
    )
    assert.equal(running.length, 0)
  })
})
