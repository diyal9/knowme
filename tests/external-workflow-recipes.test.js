'use strict'

const { describe, it, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const fs = require('fs')
const os = require('os')
const path = require('path')
const recipes = require('../src/lib/external-workflow-recipes')
const { validateContract } = require('../src/lib/tool-contract-registry')
const { buildV1Registry } = require('../src/lib/tool-surface-builder')

function write(file, content = '') {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content, 'utf8')
}

function packageFixture(root) {
  return {
    id: 'th-art-psd-to-artbundle',
    name: 'PSD to ArtBundle',
    version: '1.0.0',
    skillRefs: [{ id: 'th-art-artbundle-workflow' }, { id: 'th-art-ui-slicer' }, { id: 'th-art-creator-debug' }],
    provenance: {
      kind: 'cursor-repository',
      sourceId: 'th-art-psd-to-artbundle',
      root,
      ref: '.cursor/workflows/th-art-psd-to-artbundle.json',
    },
    graph: {
      nodes: [
        { id: 'psd_intake', type: 'agent', agentPackageId: 'ui-expert', outputs: { path: 'intake.md' } },
        { id: 'psd_layer_preread', type: 'agent', agentPackageId: 'ui-expert' },
        { id: 'slice_spec_emit', type: 'agent', agentPackageId: 'ui-expert', outputs: { path: 'slice.md' } },
        { id: 'slice_export', type: 'agent', agentPackageId: 'ui-expert' },
        { id: 'bundle_build', type: 'agent', agentPackageId: 'artbundle-expert' },
        { id: 'creator_import_preflight', type: 'agent', agentPackageId: 'artbundle-expert' },
        { id: 'bundle_creator_verify', type: 'agent', agentPackageId: 'artbundle-expert' },
        { id: 'bundle_publish', type: 'agent', agentPackageId: 'artbundle-expert' },
        { id: 'terminal_done', type: 'terminal' },
        { id: 'terminal_blocked', type: 'terminal' },
      ],
      edges: [
        { from: 'psd_intake', to: 'psd_layer_preread', label: '' },
        { from: 'psd_layer_preread', to: 'terminal_blocked', label: '失败' },
        { from: 'bundle_publish', to: 'terminal_done', label: '' },
      ],
    },
  }
}

function inputFixture(root) {
  return {
    goal: '还原界面',
    psdPath: path.join(root, 'source.psd'),
    taskSlug: 'daily-picks',
    feature: 'daily-picks',
    prefabName: 'DailyPicksView',
    clientRoot: path.join(root, 'client'),
    layoutMode: 'absolute',
    canvas: '700x1515',
  }
}

function spawnSuccess(calls, stdout = '{"ok":true}') {
  return (command, args, options) => {
    calls.push({ command, args, options })
    const child = new EventEmitter()
    child.stdout = new EventEmitter()
    child.stderr = new EventEmitter()
    child.kill = () => {}
    process.nextTick(() => {
      child.stdout.emit('data', stdout)
      child.emit('close', 0)
    })
    return child
  }
}

function spawnSequence(calls, results) {
  return (command, args, options) => {
    calls.push({ command, args, options })
    const result = results.shift() || { code: 0, stdout: '{"ok":true}' }
    const child = new EventEmitter()
    child.stdout = new EventEmitter()
    child.stderr = new EventEmitter()
    child.kill = () => {}
    process.nextTick(() => {
      if (result.stdout) child.stdout.emit('data', result.stdout)
      if (result.stderr) child.stderr.emit('data', result.stderr)
      child.emit('close', result.code)
    })
    return child
  }
}

describe('external-workflow-recipes', () => {
  let root

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-external-workflow-'))
    write(path.join(root, '.cursor', 'workflows', 'th-art-psd-to-artbundle.json'), '{}')
    for (const relative of Object.values(recipes.ARTBUNDLE_SCRIPTS)) write(path.join(root, relative), '// fixture')
    write(path.join(root, 'source.psd'), 'psd')
    fs.mkdirSync(path.join(root, 'client', 'assets'), { recursive: true })
  })

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }))

  it('upgrades an already imported ArtBundle package without re-importing it', () => {
    const enriched = recipes.enrichExternalWorkflowPackage(packageFixture(root))
    assert.equal(enriched.name, 'PSD导Artbundle')
    assert.equal(enriched.inputs.some(item => item.id === 'psdPath' && item.required), true)
    assert.deepEqual(
      enriched.inputs.filter(item => !item.hidden && !item.advanced).map(item => item.id),
      ['psdPath'],
    )
    assert.equal(enriched.inputs.find(item => item.id === 'goal').hidden, true)
    assert.equal(enriched.inputs.some(item => item.id === 'taskSlug'), false)
    assert.equal(enriched.inputs.some(item => item.id === 'prefabName'), false)
    assert.equal(enriched.outputs.some(item => item.id === 'creator'), true)
    assert.equal(enriched.graph.nodes.find(node => node.id === 'psd_layer_preread').type, 'tool')
    assert.equal(enriched.graph.nodes.find(node => node.id === 'bundle_publish').config.externalAction, 'publish')
    assert.equal(enriched.graph.nodes.some(node => node.id === 'terminal_blocked'), false)
    assert.equal(enriched.graph.edges.some(edge => edge.label === '失败'), false)
    assert.equal(enriched.graph.nodes.find(node => node.id === 'slice_spec_emit').type, 'tool')
    assert.equal(enriched.graph.nodes.find(node => node.id === 'slice_spec_emit').config.externalAction, 'prepare-specs')
  })

  it('infers implementation identifiers when the user only selects a PSD and Creator project', () => {
    const result = recipes.resolveRecipeContext(packageFixture(root), {
      psdPath: path.join(root, 'Shop Screen.psd'),
      clientRoot: path.join(root, 'client'),
    })
    assert.equal(result.ok, true)
    assert.match(result.taskSlug, /^shop-screen-[a-f0-9]{8}$/)
    assert.equal(result.feature, 'shop-screen')
    assert.equal(result.prefabName, 'ShopScreenView')
    assert.equal(result.exportId, result.taskSlug)
  })

  it('rejects unsafe identifiers before resolving output paths', () => {
    const result = recipes.resolveRecipeContext(packageFixture(root), {
      ...inputFixture(root),
      taskSlug: '../escape',
    })
    assert.equal(result.ok, false)
    assert.equal(result.code, 'invalid_external_workflow_input')
  })

  it('preflights Node, fixed scripts, PSD and Creator project without exposing context', async () => {
    const calls = []
    const result = await recipes.preflightExternalWorkflow(packageFixture(root), inputFixture(root), {
      spawn: spawnSuccess(calls, 'v24.0.0'),
    })
    assert.equal(result.ok, true)
    assert.equal(result.supported, true)
    assert.equal(result.checks.every(check => check.ok || check.optional), true)
    assert.equal(calls[0].command, 'node')
    assert.deepEqual(calls[0].args, ['--version'])
    assert.equal(calls[0].options.shell, false)
  })

  it('allows Agent file writes only in the current workflow-spec artifacts directory', async () => {
    const bundle = recipes.buildExternalWorkflowToolBundle(packageFixture(root), inputFixture(root))
    assert.ok(bundle)
    const validPath = 'workflow-spec/daily-picks/artifacts/curated-manifest.json'
    const saved = await bundle.handlers.write_external_workflow_file({ path: validPath, content: '{"version":"1.0.0"}' })
    assert.equal(saved.ok, true)
    assert.equal(fs.existsSync(path.join(root, validPath)), true)
    const escaped = await bundle.handlers.write_external_workflow_file({ path: '../outside.json', content: '{}' })
    assert.equal(escaped.ok, false)
    const secret = await bundle.handlers.write_external_workflow_file({ path: validPath, content: '{"token":"secret-value"}' })
    assert.equal(secret.ok, false)
    assert.equal(secret.code, 'secret_blocked')
  })

  it('registers every imported workflow tool in the v1 tool runtime', () => {
    const bundle = recipes.buildExternalWorkflowToolBundle(packageFixture(root), inputFixture(root))
    assert.ok(bundle)
    for (const definition of bundle.definitions) {
      assert.deepEqual(validateContract(definition._knowme), { ok: true })
    }
    const registry = buildV1Registry({ extraTools: bundle })
    const expected = bundle.definitions.map(definition => definition.function.name)
    assert.deepEqual(
      expected.filter(name => !registry.has(name)),
      [],
      'external workflow tools must not disappear during contract registration',
    )
    assert.equal(registry.has('th_art_probe_psd'), true)
  })

  it('atomically emits the three files required by the slicing gate', async () => {
    const bundle = recipes.buildExternalWorkflowToolBundle(packageFixture(root), inputFixture(root))
    const result = await bundle.handlers.emit_artbundle_specs({
      manifest: { version: '1.0.0', slices: [] },
      nodeSpec: { version: '1.0.0', nodes: [] },
      sliceSpec: '# Curated slicing plan',
    })
    assert.equal(result.ok, true)
    assert.equal(fs.existsSync(path.join(root, 'workflow-spec', 'daily-picks', 'artifacts', 'curated-manifest.json')), true)
    assert.equal(fs.existsSync(path.join(root, 'workflow-spec', 'daily-picks', 'artifacts', 'node-spec.json')), true)
    assert.equal(fs.existsSync(path.join(root, 'workflow-spec', 'daily-picks', 'artifacts', 'slice-spec.md')), true)
  })

  it('deterministically prepares curated specs from the PSD probe', async () => {
    const inputs = inputFixture(root)
    const context = recipes.resolveRecipeContext(packageFixture(root), inputs)
    write(context.probePath, JSON.stringify({
      ok: true,
      document: { width: 700, height: 1515 },
      stats: { layerCount: 3, visibleTextCount: 1 },
      layers: [
        { path: 'Canvas/背景', name: '背景', kind: 'pixel', visible: true, bounds: { left: 0, top: 0, width: 700, height: 1515 } },
        { path: 'Canvas/按钮', name: '按钮', kind: 'group', visible: true, bounds: { left: 100, top: 200, width: 200, height: 80 } },
        { path: 'Canvas/按钮/文字', name: '文字', kind: 'text', visible: true, bounds: { left: 120, top: 220, width: 100, height: 30 } },
      ],
    }))
    const result = await recipes.executeExternalWorkflowAction({
      pkg: packageFixture(root),
      inputs,
      action: 'prepare-specs',
    })
    assert.equal(result.ok, true)
    const manifest = JSON.parse(fs.readFileSync(context.manifestPath, 'utf8'))
    const nodeSpec = JSON.parse(fs.readFileSync(context.nodeSpecPath, 'utf8'))
    assert.equal(manifest.slices.length, 2)
    assert.equal(manifest.slices[0].psdGroup, 'Canvas/背景')
    assert.equal(nodeSpec.nodes.length, 2)
    assert.equal(nodeSpec.nodes[1].texture, 'component_02.png')
    assert.equal(fs.existsSync(context.sliceSpecPath), true)
  })

  it('executes only the fixed script with argument arrays and shell disabled', async () => {
    const calls = []
    const result = await recipes.executeExternalWorkflowAction({
      pkg: packageFixture(root),
      inputs: inputFixture(root),
      action: 'probe-psd',
      spawn: spawnSuccess(calls),
    })
    assert.equal(result.ok, true)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].command, 'node')
    assert.equal(calls[0].options.shell, false)
    assert.equal(calls[0].args[0], fs.realpathSync(path.join(root, recipes.ARTBUNDLE_SCRIPTS['probe-psd'])))
    assert.equal(calls[0].args.includes('--prefer-ps'), true)

    const denied = await recipes.executeExternalWorkflowAction({
      pkg: packageFixture(root),
      inputs: inputFixture(root),
      action: 'run-arbitrary-command',
      spawn: spawnSuccess(calls),
    })
    assert.equal(denied.ok, false)
    assert.equal(denied.code, 'external_action_denied')
    assert.equal(calls.length, 1)
  })

  it('materializes the curated manifest after Photoshop fallback export', async () => {
    const inputs = inputFixture(root)
    const context = recipes.resolveRecipeContext(packageFixture(root), inputs)
    write(context.manifestPath, JSON.stringify({
      version: '1.0.0',
      psd: 'source.psd',
      slices: [{ file: 'screen.png', psdGroup: 'Canvas', description: 'screen', ninePatch: false, common: false, exportMode: 'photoshop' }],
    }))
    const calls = []
    const result = await recipes.executeExternalWorkflowAction({
      pkg: packageFixture(root),
      inputs,
      action: 'slice-export',
      spawn: spawnSequence(calls, [
        { code: 1, stderr: 'Error: Cannot find module psdcli' },
        { code: 0, stdout: '{"ok":true,"exportedCount":1}' },
      ]),
    })
    assert.equal(result.ok, true)
    assert.equal(result.fallback, 'photoshop')
    assert.equal(calls.length, 2)
    const sliceManifest = path.join(context.sliceRoot, 'slices', 'manifest.json')
    assert.equal(fs.existsSync(sliceManifest), true)
    assert.deepEqual(JSON.parse(fs.readFileSync(sliceManifest, 'utf8')).slices[0].file, 'screen.png')
  })

  it('adapts the UI canvas format to the TH-ART bundle CLI format', async () => {
    const inputs = inputFixture(root)
    const context = recipes.resolveRecipeContext(packageFixture(root), inputs)
    write(context.nodeSpecPath, '{"version":"1.0.0"}')
    const calls = []
    const result = await recipes.executeExternalWorkflowAction({
      pkg: packageFixture(root),
      inputs,
      action: 'bundle-build',
      spawn: spawnSuccess(calls),
    })
    assert.equal(result.ok, true)
    const canvasIndex = calls[0].args.indexOf('--canvas')
    assert.notEqual(canvasIndex, -1)
    assert.equal(calls[0].args[canvasIndex + 1], '700,1515')
  })

  it('redacts credential-shaped values from bounded process output', () => {
    const output = recipes.scrubLog('Authorization: Bearer abc\nTOKEN=top-secret\nok')
    assert.equal(output.includes('abc'), false)
    assert.equal(output.includes('top-secret'), false)
    assert.equal(output.includes('[REDACTED]'), true)
    assert.deepEqual(
      recipes.redactStructuredOutput({ ok: true, token: 'hidden', nested: { apiKey: 'hidden-too' } }),
      { ok: true, token: '[REDACTED]', nested: { apiKey: '[REDACTED]' } },
    )
  })
})
