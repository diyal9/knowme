'use strict'

const { it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { createStore, normalizeTask } = require('../src/lib/workbench-task-store')
const { createExpertTaskRuntime } = require('../src/lib/expert-task-runtime')
const { createProvidedMaterialsSnapshot } = require('../src/lib/provided-materials')

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-rqa30-'))
  t.after(() => {
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()))
    assert.ok(path.basename(root).startsWith('knowme-rqa30-'))
    fs.rmSync(root, { recursive: true, force: true })
  })
  const file = path.join(root, 'tasks.json')
  return { file, store: createStore(file) }
}

const tooMany = () => Array.from({ length: 33 }, (_, n) => ({ id: `source-${n}`, content: `材料${n}` }))
for (const [label, materials] of [
  ['long content', [{ content: '材'.repeat(8001) }]],
  ['long text alias', [{ text: '材'.repeat(8001) }]],
  ['too many', tooMany()],
  ['invalid collection', { content: '正文' }],
  ['non-text content', [{ content: { hidden: 'instruction' } }]],
]) it(`create rejects ${label} before persistence`, t => {
  const { store, file } = fixture(t)
  const result = store.create({ goal: '核对给定材料', materials })
  assert.equal(result.ok, false)
  assert.equal(store.list().tasks.length, 0)
  assert.equal(fs.existsSync(file), false)
})

it('over-limit material update leaves task and on-disk bytes unchanged', t => {
  const { store, file } = fixture(t)
  const created = store.create({ goal: '原目标', materials: [{ content: '完整的原材料' }] })
  const before = fs.readFileSync(file, 'utf8')
  const result = store.update(created.task.id, { status: 'running', brief: { goal: '新目标', materials: tooMany() } })
  assert.equal(result.ok, false)
  assert.equal(fs.readFileSync(file, 'utf8'), before)
})

for (const materials of [[{ content: '长'.repeat(8001) }], tooMany(), 'not an array']) {
  it(`review rejects raw materials atomically (${typeof materials === 'string' ? 'type' : materials.length})`, t => {
    const { store, file } = fixture(t)
    const created = store.create({ goal: '校订', status: 'review', deliverables: [
      { deliverableId: 'primary', version: 1, acceptanceStatus: 'pending' },
    ] })
    const before = fs.readFileSync(file, 'utf8')
    const result = store.reviewDeliverable(created.task.id, 'primary', {
      action: 'accept', comment: '审阅意见不应单独提交', materials,
    })
    assert.equal(result.ok, false)
    assert.equal(fs.readFileSync(file, 'utf8'), before)
  })
}

it('review validates the combined material count instead of dropping the final attachment', t => {
  const { store, file } = fixture(t)
  const created = store.create({ goal: '校订', materials: tooMany().slice(0, 32), deliverables: [{ deliverableId: 'primary' }] })
  const before = fs.readFileSync(file, 'utf8')
  const result = store.reviewDeliverable(created.task.id, 'primary', { action: 'changes_requested',
    comment: '请按新附件修改', materials: [{ id: 'latest', content: '最新修改依据' }] })
  assert.equal(result.ok, false)
  assert.equal(fs.readFileSync(file, 'utf8'), before)
})

it('createStart rejects oversized materials before creating any session', async t => {
  const { store } = fixture(t)
  const runtime = createExpertTaskRuntime({ getWorkbenchTaskStore: () => store,
    ensureAgentSession: () => assert.fail('invalid submission must not create a session') })
  const result = await runtime.createStart({ expertId: 'generic', goal: '只核对材料', brief: { materials: tooMany() } })
  assert.equal(result.ok, false)
  assert.equal(result.code, 'task_input_too_long')
})

it('boundary-size material survives review, unrelated update, cold reload and execution snapshot', t => {
  const { store, file } = fixture(t)
  const content = '材'.repeat(7988) + 'MATERIAL_END'
  assert.equal(content.length, 8000)
  const created = store.create({ goal: '核对', deliverables: [{ deliverableId: 'primary' }] })
  assert.equal(store.reviewDeliverable(created.task.id, 'primary', { action: 'changes_requested',
    comment: '按材料处理', materials: [{ id: 'latest', text: content }] }).ok, true)
  assert.equal(store.update(created.task.id, { status: 'needs_input' }).ok, true)
  const loaded = createStore(file).get(created.task.id).task
  assert.equal(loaded.brief.materials[0].content, content)
  const snapshot = createProvidedMaterialsSnapshot({ taskId: loaded.id, runId: 'rqa30', materials: loaded.brief.materials })
  assert.equal(snapshot.items[0].text, content)
  assert.equal(snapshot.items[0].completeness, 'unknown', 'preservation is not factual verification')
})

it('legacy material normalization preserves stored text and all items without asserting executability', () => {
  const materials = tooMany()
  materials[32].content = '旧'.repeat(8001) + 'LEGACY_END'
  const normalized = normalizeTask({ goal: '历史记录', brief: { materials } })
  assert.equal(normalized.brief.materials.length, 33)
  assert.equal(normalized.brief.materials[32].content, materials[32].content)
  assert.throws(() => createProvidedMaterialsSnapshot({ taskId: 'old', runId: 'current', materials: normalized.brief.materials }),
    error => error.code === 'provided_materials_invalid')
})

for (const attachments of [[{ kind: 'text', text: '材'.repeat(8001) }], tooMany().slice(0, 4),
  [{ kind: 'image', dataUrl: 'data:image/png;base64,' }], [{ kind: 'text', text: ' ' }], 'not a list']) {
  it('runtime review rejects the entire invalid attachment batch before store review or execution', () => {
    let calls = 0
    const runtime = createExpertTaskRuntime({ getWorkbenchTaskStore: () => ({ reviewDeliverable: () => {
      calls++
      return { ok: false, error: 'fixture stop' }
    } }) })
    const result = runtime.reviewDeliverable({ taskId: 'fixture', deliverableId: 'primary',
      action: 'changes_requested', comment: '本意见不能单独提交', attachments })
    assert.equal(result.ok, false)
    assert.equal(calls, 0)
    assert.equal(result.started, false)
  })
}

it('runtime review passes all three valid attachments completely, including readable references', () => {
  let received
  const runtime = createExpertTaskRuntime({ getWorkbenchTaskStore: () => ({ reviewDeliverable: (_id, _delivery, review) => {
    received = review
    return { ok: false, error: 'fixture stop: capture only' }
  } }) })
  const tail = '材'.repeat(7988) + 'MATERIAL_END'
  runtime.reviewDeliverable({ taskId: 'fixture', deliverableId: 'primary', action: 'changes_requested', comment: '按附件核对',
    attachments: [{ name: '完整资料', text: tail }, { title: '引用', ref: 'artifact:reference-id' },
      { name: '第二份', content: '第二份全文' }] })
  assert.equal(received.materials.length, 3)
  assert.equal(received.materials[0].content, tail)
  assert.equal(received.materials[1].ref, 'artifact:reference-id')
  assert.equal(received.materials[2].content, '第二份全文')
})
