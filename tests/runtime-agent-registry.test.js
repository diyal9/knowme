'use strict'

const { describe, it, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { createRuntimeAgentRegistry } = require('../src/lib/runtime-agent-registry')

function definition(overrides = {}) {
  return {
    id: 'runtime-reviewer', name: '运行时复盘专家', version: '1.0.0',
    description: '负责使用稳定方法完成经营复盘并交付可验收报告。',
    soul: '证据优先，明确区分事实、判断和建议。',
    sop: '确认目标和口径，执行分析，复核证据与交付物。',
    agenticType: 'planning', skills: ['review-method'], connectors: [], optionalConnectors: [],
    knowledgeRefs: [], useCases: ['经营复盘'], boundaries: ['不执行审批'],
    inputs: [{ name: '数据', required: true }], outputs: [{ name: '报告', required: true }],
    permissions: { connectors: { allowedConnectorIds: [] }, tools: { allowlist: ['read_file'] }, network: false, write: false, externalWrite: false },
    risk: { level: 'low', reasons: [] },
    execution: {
      routes: [{ id: 'review', label: '复盘', description: '读取资料并完成复盘。', requiredSkills: ['review-method'], requiredTools: ['read_file'], toolAllowlist: ['read_file'] }],
      deliverables: [{ id: 'report', title: '复盘报告', type: 'document', required: true }],
      qualityReview: { enabled: true, criteria: ['数字可追溯', '结论有证据'] },
    },
    lifecycle: { state: 'active', newTasks: true, successors: [] },
    ...overrides,
  }
}

describe('runtime Agent Registry', () => {
  let root
  let registry
  let entries
  let experts
  let installed
  let cleanups
  let store
  let catalogApi
  let expertRuntime
  let saveExpertForHub

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-agent-registry-'))
    entries = new Map([['review-method', { id: 'review-method', kind: 'skill', enabled: true, lifecycle: { state: 'active', newTasks: true } }]])
    experts = new Map()
    installed = new Map()
    cleanups = []
    store = {
      resolvePaths: () => ({ root: path.join(root, 'capabilities') }),
      getEntry: id => installed.has(id) ? { ok: true, entry: installed.get(id) } : { ok: false },
      enable: id => { installed.get(id).enabled = true; return { ok: true } },
      disable: id => { installed.get(id).enabled = false; return { ok: true } },
    }
    catalogApi = {
      listCatalog: ({ enabledOnly } = {}) => ({ entries: [...entries.values()].filter(item => !enabledOnly || item.enabled !== false) }),
      getCatalogEntry: id => entries.has(id) ? { ok: true, entry: entries.get(id) } : { ok: false },
      upsertOverlayEntry: patch => { entries.set(patch.id, { ...(entries.get(patch.id) || {}), ...patch }); return { ok: true, entry: entries.get(patch.id) } },
    }
    expertRuntime = () => ({
      loadExpert: id => experts.has(id) ? { ok: true, ...experts.get(id) } : { ok: false },
    })
    saveExpertForHub = payload => {
      const loaded = {
        id: payload.id,
        name: payload.name,
        description: payload.description,
        version: payload.version,
        avatar: payload.avatar,
        soul: payload.soul,
        sop: payload.sop,
        systemPrompt: payload.systemPrompt,
        agenticType: payload.agenticType,
        agenticConfig: payload.agenticConfig,
        skills: payload.skills,
        connectors: payload.connectors,
        optionalConnectors: payload.optionalConnectors,
        useCases: payload.useCases,
        boundaries: payload.boundaries,
        capabilityManifest: payload.capabilityManifest,
        manifest: { version: payload.version },
      }
      experts.set(payload.id, loaded)
      installed.set(payload.id, { id: payload.id, enabled: true })
      entries.set(payload.id, {
        id: payload.id, kind: 'expert', source: 'custom', enabled: true,
        name: payload.name, description: payload.description, version: payload.version,
        manifest: payload.capabilityManifest, lifecycle: payload.lifecycle,
      })
      return { ok: true, id: payload.id }
    }
    registry = createRuntimeAgentRegistry({
      store, catalogApi, expertRuntime, saveExpertForHub,
      onExpertUninstalled: id => { cleanups.push(id); return { ok: true } },
    })
  })

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }))

  it('requires preview and commits a runtime-created Agent with a revision', () => {
    const savedDraft = registry.saveAgentDraft({ intent: 'create', draft: definition() })
    assert.equal(savedDraft.ok, true, JSON.stringify(savedDraft))
    assert.equal(savedDraft.draft.status, 'draft')
    assert.equal(registry.getAgentDraft({ agentId: 'runtime-reviewer' }).draft.definition.name, '运行时复盘专家')

    const preview = registry.previewAgentChange({ action: 'create', agentId: 'runtime-reviewer', definition: definition() })
    assert.equal(preview.ok, true, JSON.stringify(preview))
    assert.equal(preview.confirmationRequired, true)
    assert.equal(experts.has('runtime-reviewer'), false)

    const committed = registry.commitAgentChange({ changeToken: preview.changeToken })
    assert.equal(committed.ok, true, JSON.stringify(committed))
    assert.equal(committed.revision, 1)
    assert.equal(experts.has('runtime-reviewer'), true)
    const publishedDraft = registry.getAgentDraft({ agentId: 'runtime-reviewer' })
    assert.equal(publishedDraft.draft.status, 'published')
    assert.equal(publishedDraft.draft.publishedRevision, 1)
    assert.equal(registry.commitAgentChange({ changeToken: preview.changeToken }).code, 'invalid_change_token')

    const revisions = registry.listAgentRevisions({ agentId: 'runtime-reviewer' })
    assert.equal(revisions.latest, 1)
    assert.equal(revisions.revisions[0].action, 'create')
  })

  it('rejects stale previews', () => {
    const create = registry.previewAgentChange({ action: 'create', agentId: 'runtime-reviewer', definition: definition() })
    assert.equal(registry.commitAgentChange({ changeToken: create.changeToken }).ok, true)
    const update = registry.previewAgentChange({ action: 'update', agentId: 'runtime-reviewer', definition: definition({ version: '1.1.0' }) })
    experts.get('runtime-reviewer').description = '预览后发生的并发修改，应该使旧令牌失效。'
    assert.equal(registry.commitAgentChange({ changeToken: update.changeToken }).code, 'stale_change')
  })

  it('rejects an expired preview token without publishing', () => {
    const preview = registry.previewAgentChange({ action: 'create', agentId: 'runtime-reviewer', definition: definition() })
    const originalNow = Date.now
    Date.now = () => new Date(preview.expiresAt).getTime() + 1
    try {
      assert.equal(registry.commitAgentChange({ changeToken: preview.changeToken }).code, 'change_token_expired')
      assert.equal(experts.has('runtime-reviewer'), false)
    } finally {
      Date.now = originalNow
    }
  })

  it('retires and restores without deleting the package', () => {
    const create = registry.previewAgentChange({ action: 'create', agentId: 'runtime-reviewer', definition: definition() })
    registry.commitAgentChange({ changeToken: create.changeToken })

    const retire = registry.previewAgentChange({ action: 'retire', agentId: 'runtime-reviewer' })
    const retired = registry.commitAgentChange({ changeToken: retire.changeToken })
    assert.equal(retired.ok, true)
    assert.equal(experts.has('runtime-reviewer'), true)
    assert.equal(registry.canStartExpert('runtime-reviewer').code, 'agent_retired')
    assert.deepEqual(cleanups, ['runtime-reviewer'])

    const restore = registry.previewAgentChange({ action: 'restore', agentId: 'runtime-reviewer' })
    assert.equal(registry.commitAgentChange({ changeToken: restore.changeToken }).ok, true)
    assert.equal(registry.canStartExpert('runtime-reviewer').ok, true)
  })

  it('lets an admin retire and publish a runtime override for a bundled Agent', () => {
    entries.set('bundled-reviewer', {
      id: 'bundled-reviewer', kind: 'expert', source: 'curated', enabled: true,
      name: '精选复盘专家', description: '由安装包维护的精选复盘专家。', version: '1.0.0',
      lifecycle: { state: 'active', newTasks: true, successors: [] },
    })
    experts.set('bundled-reviewer', {
      id: 'bundled-reviewer', name: '精选复盘专家', description: '由安装包维护的精选复盘专家。',
      skills: [], connectors: [], optionalConnectors: [], soul: '证据优先', sop: '先核对再交付',
      agenticType: 'planning', manifest: { version: '1.0.0' },
    })
    const preview = registry.previewAgentChange({ action: 'retire', agentId: 'bundled-reviewer' })
    assert.equal(preview.ok, true)
    assert.equal(registry.commitAgentChange({ changeToken: preview.changeToken }).ok, true)
    assert.equal(experts.has('bundled-reviewer'), true)
    assert.equal(entries.get('bundled-reviewer').lifecycle.state, 'retired')
    const update = registry.previewAgentChange({
      action: 'update', agentId: 'bundled-reviewer', definition: definition({ id: 'bundled-reviewer' }),
    })
    assert.equal(update.ok, true, JSON.stringify(update))
    assert.equal(registry.commitAgentChange({ changeToken: update.changeToken }).ok, true)
    assert.equal(experts.get('bundled-reviewer').description, definition().description)
  })

  it('limits ordinary users to their own Agent objects in discovery and mutation', () => {
    entries.set('bundled-reviewer', {
      id: 'bundled-reviewer', kind: 'expert', source: 'curated', enabled: true,
      name: '系统专家', description: '系统内置专家', version: '1.0.0',
    })
    experts.set('bundled-reviewer', {
      id: 'bundled-reviewer', name: '系统专家', description: '系统内置专家',
      skills: [], connectors: [], optionalConnectors: [], soul: '系统准则', sop: '系统流程',
      agenticType: 'planning', manifest: { version: '1.0.0' },
    })
    entries.set('my-reviewer', {
      id: 'my-reviewer', kind: 'expert', source: 'custom', enabled: true,
      name: '我的专家', description: '用户创建专家', version: '1.0.0',
    })
    experts.set('my-reviewer', {
      id: 'my-reviewer', name: '我的专家', description: '用户创建专家',
      skills: [], connectors: [], optionalConnectors: [], soul: '用户准则', sop: '用户流程',
      agenticType: 'planning', manifest: { version: '1.0.0' },
    })
    const userRegistry = createRuntimeAgentRegistry({
      store, catalogApi, expertRuntime, saveExpertForHub, isAgentAdmin: false,
    })
    assert.deepEqual(userRegistry.listManageableAgents().agents.map(item => item.id), ['my-reviewer'])
    assert.equal(userRegistry.getAgentDefinition({ agentId: 'bundled-reviewer' }).code, 'forbidden_agent_scope')
    assert.equal(userRegistry.previewAgentChange({
      action: 'update', agentId: 'bundled-reviewer', definition: definition({ id: 'bundled-reviewer' }),
    }).code, 'forbidden_agent_scope')
    assert.equal(userRegistry.getAgentDefinition({ agentId: 'my-reviewer' }).ok, true)
  })

  it('rolls back by publishing a new immutable revision', () => {
    const create = registry.previewAgentChange({ action: 'create', agentId: 'runtime-reviewer', definition: definition() })
    registry.commitAgentChange({ changeToken: create.changeToken })
    const update = registry.previewAgentChange({
      action: 'update',
      agentId: 'runtime-reviewer',
      definition: definition({ version: '1.1.0', description: '这是第二版经营复盘定义，用于验证不可变 revision 回滚。' }),
    })
    assert.equal(registry.commitAgentChange({ changeToken: update.changeToken }).revision, 2)

    const rollback = registry.previewAgentChange({ action: 'rollback', agentId: 'runtime-reviewer', revision: 1 })
    const committed = registry.commitAgentChange({ changeToken: rollback.changeToken })
    assert.equal(committed.ok, true)
    assert.equal(committed.revision, 3)
    assert.equal(experts.get('runtime-reviewer').version, '1.0.0')
    const revisions = registry.listAgentRevisions({ agentId: 'runtime-reviewer' })
    assert.deepEqual(revisions.revisions.map(item => item.action), ['rollback', 'update', 'create'])
  })
})
