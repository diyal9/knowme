'use strict'

const { describe, it, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { createStore } = require('../src/lib/workbench-automation-store')
const { buildVerticalPipelineFacts, buildAutomationLaunchRequest } = require('../src/lib/workbench-console-model')

describe('workbench-automation-store', () => {
  let dir
  let file

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-auto-store-'))
    file = path.join(dir, 'automations.json')
  })

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('persists workflowId, domain and backend on jobs', () => {
    const store = createStore(file)
    const created = store.create({
      name: '每日简报',
      prompt: '汇总今日待办',
      workflowId: 'office-meeting-to-actions',
      domain: 'office',
      backend: 'local-team',
    })
    assert.equal(created.ok, true)
    assert.equal(created.job.workflowId, 'office-meeting-to-actions')
    assert.equal(created.job.domain, 'office')
    assert.equal(created.job.backend, 'local-team')
  })

  it('returns scheduler_unavailable for unbound jobs', () => {
    const store = createStore(file, {
      resolveLaunch: (job) => buildAutomationLaunchRequest(job, buildVerticalPipelineFacts({
        connectors: [{ id: 'feishu', enabled: true, ready: true, kind: 'connector' }],
        availableExperts: ['office-assistant'],
      })),
    })
    const created = store.create({ name: '未绑定', prompt: '只做提醒' })
    const result = store.runNow(created.job.id)
    assert.equal(result.ok, false)
    assert.equal(result.code, 'scheduler_unavailable')
  })

  it('returns structured launch request when bound and pipeline is ready', () => {
    const facts = buildVerticalPipelineFacts({
      connectors: [{ id: 'feishu', enabled: true, ready: true, kind: 'connector' }],
      availableExperts: ['office-assistant'],
    })
    const store = createStore(file, {
      resolveLaunch: (job) => buildAutomationLaunchRequest(job, facts),
    })
    const created = store.create({
      name: '会前提醒',
      prompt: '整理会前 brief',
      workflowId: 'office-meeting-to-actions',
      domain: 'office',
      backend: 'local-team',
      projectId: 'project-office',
    })
    const result = store.runNow(created.job.id)
    assert.equal(result.ok, true)
    assert.equal(result.launchRequest.resourceId, 'office-meeting-to-actions')
    assert.equal(result.launchRequest.backend, 'local-team')
    assert.equal(result.launchRequest.projectId, 'project-office')
    assert.equal(result.launchRequest.returnState.projectId, 'project-office')
    assert.doesNotMatch(JSON.stringify(result), /queued/)
  })

  it('persists product project bindings without inferring them from legacy workspace ids', () => {
    const store = createStore(file)
    const created = store.create({
      name: '项目周报',
      prompt: '生成周报',
      projectId: 'project-a',
      workspaceId: 'legacy-space',
    })
    assert.equal(created.job.projectId, 'project-a')
    assert.equal(created.job.workspaceId, 'legacy-space')

    const legacy = store.create({
      name: '旧自动化',
      prompt: '保留旧记录',
      workspaceId: 'remote-gitlab-project',
    })
    assert.equal(legacy.job.projectId, '')
  })

  it('blocks project automation when the bound workspace is missing or readonly', () => {
    const contexts = {
      missing: { ok: true, project: { status: 'missing' }, workspace: { available: false, writable: false } },
      readonly: { ok: true, project: { status: 'readonly' }, workspace: { available: true, writable: false } },
    }
    const store = createStore(file, {
      resolveProject: (projectId) => contexts[projectId],
      resolveLaunch: () => ({ ok: true }),
    })
    const missing = store.create({
      name: '离线项目任务', prompt: 'run', projectId: 'missing',
      workflowId: 'wf', domain: 'office', backend: 'local-team',
    })
    const readonly = store.create({
      name: '只读项目任务', prompt: 'run', projectId: 'readonly',
      workflowId: 'wf', domain: 'office', backend: 'local-team',
    })

    assert.equal(store.runNow(missing.job.id).code, 'project_unavailable')
    assert.equal(store.runNow(readonly.job.id).code, 'project_readonly')
  })
})
