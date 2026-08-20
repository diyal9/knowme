'use strict'

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { validateWorkflowPackage, createWorkflowSnapshot } = require('./workflow-package')
const { validateAndNormalizeManifest } = require('./capability-manifest-v2')

const STORE_VERSION = 1
const TERMINAL = new Set(['completed', 'failed', 'cancelled'])

function nowIso() { return new Date().toISOString() }
function id(prefix) { return `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}` }
function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)) }
function text(value, max = 1000) { return String(value == null ? '' : value).trim().slice(0, max) }

function createWorkflowV2Runtime(options = {}) {
  const file = options.file || path.join(String(options.userData || ''), 'workflow-v2-runs.json')
  const workflowStore = options.workflowStore
  const actionCatalogSource = typeof options.actionCatalog === 'function' ? options.actionCatalog : () => []

  function load() {
    try {
      const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
      return raw?.version === STORE_VERSION && raw.runs ? raw : { version: STORE_VERSION, runs: {} }
    } catch { return { version: STORE_VERSION, runs: {} } }
  }
  function save(state) {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const tmp = `${file}.${process.pid}.tmp`
    fs.writeFileSync(tmp, JSON.stringify({ ...state, version: STORE_VERSION, updatedAt: nowIso() }, null, 2))
    fs.renameSync(tmp, file)
  }
  function event(run, type, payload = {}) {
    run.events = [...(run.events || []), { id: id('event'), type, actorId: text(payload.actorId, 120), summary: text(payload.summary), createdAt: nowIso() }].slice(-500)
  }
  function get(runId) {
    const run = load().runs[text(runId, 120)]
    return run ? { ok: true, run: clone(run) } : { ok: false, code: 'not_found', error: '运行不存在' }
  }
  function update(runId, mutator) {
    const state = load()
    const run = state.runs[text(runId, 120)]
    if (!run) return { ok: false, code: 'not_found', error: '运行不存在' }
    try { mutator(run) } catch (error) { return { ok: false, code: 'invalid_transition', error: error?.message || String(error) } }
    run.updatedAt = nowIso()
    save(state)
    return { ok: true, run: clone(run) }
  }
  function actionCatalog() {
    const actions = []
    for (const raw of actionCatalogSource() || []) {
      const manifest = raw?.manifest || raw?.capabilityManifest || raw
      const normalized = validateAndNormalizeManifest(manifest)
      if (!normalized.ok) continue
      for (const action of normalized.manifest.actions || []) actions.push({ ...action, capabilityId: normalized.manifest.id, capabilityVersion: normalized.manifest.version })
    }
    return { ok: true, actions }
  }
  function validate(input = {}) {
    const raw = input.package || input
    const result = validateWorkflowPackage(raw, input.options || {})
    if (!result.ok) return result
    const catalogRefs = new Set(actionCatalog().actions.map(action => action.ref))
    const issues = []
    for (const node of result.package.graph.nodes) {
      if (node.type === 'action' && catalogRefs.size && !catalogRefs.has(node.actionRef)) {
        issues.push({ code: 'action_not_found', message: `Action Contract 不存在: ${node.actionRef}`, path: `graph.nodes.${node.id}.actionRef` })
      }
    }
    return { ...result, ok: issues.length === 0, issues: [...(result.issues || []), ...issues] }
  }
  function publish(input = {}) {
    return workflowStore.publish(input.id || input.workflowId, input.evidence || input, input.options || {})
  }
  function start(input = {}) {
    const hit = workflowStore.get(input.workflowId || input.id)
    if (!hit.ok) return hit
    const checked = validate({
      package: hit.package,
      options: input.enforceProductBoundary === true ? { enforceProductBoundary: true } : {},
    })
    if (!checked.ok) return checked
    const snapshot = createWorkflowSnapshot(checked.package)
    const runId = id('workflow-run')
    const nodes = Object.fromEntries(checked.package.graph.nodes.map(node => [node.id, {
      nodeId: node.id, type: node.type, status: node.type === 'human' || node.type === 'gate' ? 'waiting' : 'pending', attempts: [], inputVersion: 1, outputVersion: 0,
    }]))
    const run = {
      runId, workflowId: checked.package.id, workflowVersion: checked.package.version, workflowSnapshot: snapshot.snapshot,
      initiatorId: text(input.initiatorId || 'local-user', 120), connectorIdentity: text(input.connectorIdentity || 'initiator', 120),
      status: 'running', input: clone(input.input || {}), nodes, checkpoints: [], lineage: [], grants: clone(input.grants || []), deviations: [], events: [], comments: [],
      createdAt: nowIso(), updatedAt: nowIso(),
    }
    event(run, 'run.started', { actorId: run.initiatorId, summary: '工作流已启动' })
    const state = load(); state.runs[runId] = run; save(state)
    return { ok: true, run: clone(run) }
  }
  function pause(runId, payload = {}) { return update(runId, run => { if (!TERMINAL.has(run.status)) run.status = 'paused'; event(run, 'run.paused', payload) }) }
  function resume(runId, payload = {}) { return update(runId, run => { if (run.status === 'paused' || run.status === 'waiting') run.status = 'running'; event(run, 'run.resumed', payload) }) }
  function submitNode(runId, nodeId, kind, payload = {}) {
    return update(runId, run => {
      const node = run.nodes[text(nodeId, 80)]
      if (!node || node.type !== kind) throw new Error(`${kind} 节点不存在`)
      node.status = payload.approved === false ? 'failed' : 'completed'
      node.outputVersion += 1
      node.output = clone(payload.output || payload)
      node.attempts.push({ attempt: node.attempts.length + 1, status: node.status, createdAt: nowIso(), sideEffectCommitted: false })
      run.checkpoints.push({ id: id('checkpoint'), nodeId: node.nodeId, outputVersion: node.outputVersion, createdAt: nowIso() })
      event(run, `${kind}.submitted`, payload)
    })
  }
  function intervene(runId, payload = {}) { return update(runId, run => { run.status = 'paused'; run.deviations.push({ id: id('deviation'), ...clone(payload), createdAt: nowIso() }); event(run, 'run.intervened', payload) }) }
  function rerun(runId, payload = {}) {
    return update(runId, run => {
      const node = run.nodes[text(payload.nodeId, 80)]
      if (!node) throw new Error('节点不存在')
      const prior = node.attempts[node.attempts.length - 1]
      if (prior?.sideEffectCommitted && payload.confirmSideEffect !== true) throw new Error('该节点已产生外部副作用，重跑前必须显式确认')
      node.status = 'pending'; node.attempts.push({ attempt: node.attempts.length + 1, status: 'pending', rerun: true, createdAt: nowIso() })
      for (const descendantId of Array.isArray(payload.invalidateNodeIds) ? payload.invalidateNodeIds : []) if (run.nodes[descendantId]) run.nodes[descendantId].status = 'invalidated'
      event(run, 'node.rerun_requested', payload)
    })
  }
  function substitute(runId, payload = {}) { return update(runId, run => { const node = run.nodes[text(payload.nodeId, 80)]; if (!node || node.type !== 'agent') throw new Error('只能替换 Agent 节点'); node.substituteAgentRef = text(payload.agentRef, 160); event(run, 'agent.substituted', payload) }) }
  function comment(runId, payload = {}) { return update(runId, run => { run.comments = [...run.comments, { id: id('comment'), body: text(payload.body, 2000), contextKind: ['input', 'change_request', 'intervention'].includes(payload.contextKind) ? payload.contextKind : 'comment', actorId: text(payload.actorId, 120), createdAt: nowIso() }].slice(-300); event(run, 'comment.added', payload) }) }

  return { file, actionCatalog, validate, publish, start, get, pause, resume, submitHuman: (r, n, p) => submitNode(r, n, 'human', p), submitGate: (r, n, p) => submitNode(r, n, 'gate', p), intervene, rerun, substitute, comment }
}

module.exports = { createWorkflowV2Runtime }
