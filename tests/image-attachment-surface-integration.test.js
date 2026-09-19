'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const Module = require('node:module')
const { createHash, randomUUID } = require('node:crypto')
const { imageFixture } = require('./helpers/image-fixtures')
const imageTools = require('../src/lib/agent-image-tools')
const builder = require('../src/lib/tool-surface-builder')
const { getSessionCapabilityBindings } = require('../src/lib/agent-context-assembly')
const policy = require('../src/lib/context-engine/policy')

const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const ref = bytes => `attachment:image_${hash(bytes)}`
const attachment = bytes => ({ kind: 'image', name: 'same.png', dataUrl: `data:image/png;base64,${bytes.toString('base64')}` })

// Same production-entry loading pattern as the calculation/scope integration
// fixtures. No shared fixture edits or require-cache mutation. The registry,
// capability guard, finalizer, resolver and image handler all remain real.
async function surfaceFixture(t, { preparedImages, payloadImages = [], omitDraft = false }) {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-attachment-surface-'))
  t.after(() => fs.rmSync(userData, { recursive: true, force: true }))
  const runId = 'attachment-' + randomUUID()
  const controller = new AbortController()
  const session = { id: 'session-' + runId, expertId: 'arbitrary-image-expert',
    taskRef: { id: 'task-' + runId, kind: 'expert-task' }, run: { id: runId, status: 'running' } }
  const connector = { id: imageTools.PANGO_CONNECTOR_ID, type: 'mcp', enabled: true, agentVisible: true,
    mcp: { url: 'https://provider.example.test/mcp' }, allowlist: ['generate_image', 'list_paint_models'] }
  const permissions = { tools: { allowlist: ['generate_image', 'list_paint_models'] },
    connectors: { allowedConnectorIds: [connector.id] }, network: true, write: true, externalWrite: false }
  const expertRuntime = { getSessionPersona: () => ({ ok: true,
    bindings: { skills: [], connectors: [connector.id] }, capabilityManifest: { permissions } }) }
  const calls = []
  const output = await imageFixture('png', { width: 5, height: 7 })
  const noop = () => null
  const libs = {
    app: { getPath: () => userData }, path, contextEngine: policy,
    agentTools: require('../src/lib/agent-tools'),
    isToolSurfaceV1: builder.isToolSurfaceV1,
    resolveToolSurfaceForRun: builder.resolveToolSurfaceForRun,
    getSessionCapabilityBindings,
    mergeExtraTools: require('../src/lib/merge-extra-tools').mergeExtraTools,
    agentSandbox: { normalizeSandboxPermissions: () => ({}) },
    agentPlanTools: { buildPlanTools: noop }, agentWebTools: { buildWebTools: noop },
    agentArtifactTools: { buildArtifactTools: noop },
    agentCapabilityImportTools: require('../src/lib/agent-capability-import-tools'),
    agentImageTools: { ...imageTools, buildImageTools: options => {
      assert.equal(typeof options.resolveMediaReference, 'function', 'production must wire the resolver')
      return imageTools.buildImageTools({ ...options, fetchImpl: async (url, init) => {
        assert.equal(url, connector.mcp.url)
        const body = JSON.parse(init.body)
        assert.equal(body.method, 'tools/call')
        assert.equal(body.params.name, 'generate_image')
        calls.push(body)
        return { ok: true, json: async () => ({ result: { content: [
          { type: 'image', mimeType: 'image/png', data: output.toString('base64') },
        ] } }) }
      } })
    } },
    // Discovery is an environment seam, not a replacement for the actual
    // provider adapter registration or returned surface/executor.
    connectorToolRuntime: { buildConnectorToolSurface: async () => ({ close: async () => {} }) },
    researchRouting: { classifyResearchIntent: () => ({}), buildResearchRoute: () => ({ active: false }) },
    logger: { systemPrompt() {} },
  }
  const filename = path.resolve(__dirname, '../src/lib/agent-generate-tool-surface.ts')
  const entry = new Module(filename, module)
  entry.filename = filename
  entry.paths = Module._nodeModulePaths(path.dirname(filename))
  const nativeRequire = entry.require.bind(entry)
  entry.require = name => name === './agent-generate-libs' ? libs : nativeRequire(name)
  entry._compile(fs.readFileSync(filename, 'utf8'), filename)
  const prepared = {
    session, s: { agentScriptsEnabled: false }, slashRefs: [], tier: 'assist',
    prompt: 'Edit only the requested object.', apiMessages: [], executionPolicy: 'tools-allowed',
    modelProfile: { model: 'offline-fixture', supportsTools: true, contextWindow: 32000 },
    groundingTaskFrame: { requiredTools: ['generate_image'], requiredArtifacts: [{ type: 'image' }], minArtifacts: 1 },
    ...(!omitDraft ? { contextDraft: { version: 2, tier: 'assist', executionPolicy: 'tools-allowed',
      policyInput: { tier: 'assist', scene: 'expert-collaboration', phase: 'execution' },
      staticCapabilityIds: [], blocks: [], query: 'Edit only the requested object.',
      prompt: 'Edit only the requested object.', contextBudget: 6000, inputBudget: 16000,
      history: [], imageAttachments: preparedImages, infoBase: {},
    } } : {}),
  }
  const run = await entry.exports.buildRunToolSurface({
    runId, signal: controller.signal, controller, metrics: {},
    payload: { sessionId: session.id, conversationMode: 'expert-execution', permissions, attachments: payloadImages },
    fail: error => ({ error }), deps: {
      ensureCapabilityHub: () => ({ expertRuntime: () => expertRuntime, buildSkillToolsForSession: noop }),
      ensureAgentTeamRuntime: () => ({ enabled: false, manager: { adoptRunningRun() {}, completeAdoptedRun() {} },
        store: { writeReceipt() {} } }),
      getActiveSourceRoot: noop, buildActiveSourceFileTools: noop,
      loadAgentSessions: () => [session],
      getConnectorsApi: () => ({ loadConnectors: () => [connector], resolveRuntimeOptions: () => ({}) }),
    },
  }, prepared)
  if (run.connectorRuntime) t.after(() => run.connectorRuntime.close())
  assert.equal(run.early, undefined, JSON.stringify(run.early))
  assert.equal(run.resolvedSurface.mode, 'v1')
  assert.equal(run.toolSurface.isAllowedTool('generate_image'), true)
  assert.ok(run.resolvedSurface.registry.get('generate_image'), 'image handler is registered, not called directly')
  return { run, calls, execute: reference => run.toolExecutor.executeToolCall({
    name: 'generate_image', arguments: JSON.stringify({ prompt: 'Edit only the requested object.', n: 1, reference_images: [reference] }),
  }) }
}

test('production surface dispatches the prepared visible image bytes, never conflicting payload bytes', async t => {
  const a = await imageFixture('png', { width: 2, height: 3 })
  const b = await imageFixture('png', { width: 3, height: 2 })
  const f = await surfaceFixture(t, { preparedImages: [attachment(a)], payloadImages: [attachment(b)] })
  const content = f.run.apiMessages.at(-1).content
  const label = content.findIndex(part => part.type === 'text' && part.text.includes(ref(a)))
  assert.ok(label >= 0)
  assert.equal(content[label + 1].image_url.url, attachment(a).dataUrl)
  assert.equal(JSON.stringify(content).includes(ref(b)), false)
  const result = await f.execute(ref(a))
  assert.equal(result.ok, true, JSON.stringify(result))
  assert.equal(f.calls.length, 1)
  const sent = f.calls[0].params.arguments.reference_images
  assert.deepEqual(sent, [attachment(a).dataUrl])
  const sentBytes = Buffer.from(sent[0].split(',')[1], 'base64')
  assert.deepEqual(sentBytes, a)
  assert.equal(hash(sentBytes), hash(a))
  assert.notEqual(hash(sentBytes), hash(b))
  assert.equal(result.artifactRefs[0].meta.image.width, 5, 'real output decoder also ran')
  const rejected = await f.execute(ref(b))
  assert.equal(rejected.ok, false)
  assert.equal(rejected.code, 'media_reference_unavailable')
  assert.equal(f.calls.length, 1, 'payload-only reference must not reach provider')
})

test('an explicitly empty prepared attachment list never falls back to payload attachments', async t => {
  const bytes = await imageFixture()
  const f = await surfaceFixture(t, { preparedImages: [], payloadImages: [attachment(bytes)] })
  assert.equal(JSON.stringify(f.run.apiMessages).includes(ref(bytes)), false)
  const result = await f.execute(ref(bytes))
  assert.equal(result.ok, false)
  assert.equal(result.code, 'media_reference_unavailable')
  assert.equal(f.calls.length, 0)
})

test('without a context draft the production compatibility path resolves supplied payload attachments', async t => {
  const bytes = await imageFixture()
  const f = await surfaceFixture(t, { omitDraft: true, payloadImages: [attachment(bytes)] })
  const result = await f.execute(ref(bytes))
  assert.equal(result.ok, true, JSON.stringify(result))
  assert.equal(f.calls.length, 1)
  assert.deepEqual(f.calls[0].params.arguments.reference_images, [attachment(bytes).dataUrl])
})

test('a different task cannot dispatch another task attachment or a shared filename', async t => {
  const a = await imageFixture('png', { width: 2, height: 3 })
  const b = await imageFixture('png', { width: 3, height: 2 })
  const first = await surfaceFixture(t, { preparedImages: [attachment(a)] })
  const second = await surfaceFixture(t, { preparedImages: [attachment(b)] })
  assert.equal((await first.execute(ref(a))).ok, true)
  for (const invalid of [ref(a), 'same.png', 'D:/private/same.png']) {
    const result = await second.execute(invalid)
    assert.equal(result.ok, false, invalid)
    assert.equal(result.code, 'media_reference_unavailable')
  }
  assert.equal(second.calls.length, 0)
  assert.equal((await second.execute(ref(b))).ok, true)
  assert.equal(second.calls.length, 1)
  assert.deepEqual(second.calls[0].params.arguments.reference_images, [attachment(b).dataUrl])
  assert.equal(first.calls.length, 1)
})
