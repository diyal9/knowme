const { describe, it } = require('node:test')
const assert = require('node:assert')
const {
  adaptLegacyCapability,
  aggregateRisk,
  checkDependencyGraph,
  serializeSidecar,
  validateAndNormalizeManifest,
} = require('../src/lib/capability-manifest-v2')

function manifest(id, kind = 'skill', dependencies = []) {
  return {
    schemaVersion: 2,
    id,
    kind,
    name: id,
    version: '1.0.0',
    dependencies,
  }
}

describe('capability manifest v2', () => {
  it('normalizes the common shape', () => {
    const result = validateAndNormalizeManifest({
      ...manifest('writer'),
      permissions: { network: false },
      inputs: ['prompt'],
      outputs: [{ name: 'draft', type: 'text' }],
      risk: 'medium',
      provenance: { source: 'curated', trust: 'bundled' },
    })
    assert.equal(result.ok, true)
    assert.deepEqual(result.manifest.inputs, [{ name: 'prompt' }])
    assert.equal(result.manifest.risk.level, 'medium')
    assert.equal(result.manifest.provenance.source, 'curated')
  })

  it('rejects invalid schema, id, version and self dependency', () => {
    const result = validateAndNormalizeManifest({
      schemaVersion: 1,
      id: 'bad/id',
      kind: 'skill',
      name: 'Bad',
      version: 'latest',
      dependencies: ['bad/id'],
    })
    assert.equal(result.ok, false)
    assert.ok(result.issues.some(item => item.code === 'unsupported_schema'))
    assert.ok(result.issues.some(item => item.code === 'invalid_id'))
    assert.ok(result.issues.some(item => item.code === 'invalid_version'))
  })

  it('adapts legacy expert bindings into typed dependencies', () => {
    const result = adaptLegacyCapability('expert', {
      name: '写作教练',
      version: '1.0.0',
      skills: ['rewrite'],
      connectors: ['feishu'],
    }, { id: 'writing-coach', source: 'local', ref: 'EXPERT.md' })
    assert.equal(result.ok, true)
    assert.deepEqual(result.manifest.dependencies.map(dep => [dep.id, dep.kind]), [
      ['rewrite', 'skill'],
      ['feishu', 'connector'],
    ])
    assert.equal(result.manifest.provenance.adaptedFrom, 'EXPERT.md')
  })

  it('adapts executable MCP connector as high risk', () => {
    const result = adaptLegacyCapability('connector', {
      id: 'company-mcp',
      name: 'Company MCP',
      type: 'mcp',
      mcp: { command: 'node', args: ['server.js'] },
    })
    assert.equal(result.ok, true)
    assert.equal(result.manifest.risk.level, 'high')
    assert.ok(result.manifest.risk.reasons.length > 0)
  })

  it('reports missing required dependency and warns for optional dependency', () => {
    const result = checkDependencyGraph([
      manifest('writer', 'expert', [
        { id: 'rewrite', kind: 'skill', required: true },
        { id: 'style-guide', kind: 'skill', required: false },
      ]),
    ])
    assert.equal(result.ok, false)
    assert.ok(result.issues.some(item => item.code === 'missing_dependency'))
    assert.ok(result.warnings.some(item => item.code === 'missing_optional_dependency'))
  })

  it('detects dependency cycles', () => {
    const result = checkDependencyGraph([
      manifest('a', 'skill', ['b']),
      manifest('b', 'skill', ['c']),
      manifest('c', 'skill', ['a']),
    ])
    assert.equal(result.ok, false)
    assert.ok(result.issues.some(item => item.code === 'dependency_cycle'))
  })

  it('accepts externally available dependencies', () => {
    const result = checkDependencyGraph([
      manifest('writer', 'expert', [{ id: 'rewrite', kind: 'skill', required: true }]),
    ], { availableIds: new Set(['rewrite']) })
    assert.equal(result.ok, true)
  })

  it('aggregates the highest risk and serializes a deterministic sidecar', () => {
    const low = validateAndNormalizeManifest(manifest('safe')).manifest
    const high = validateAndNormalizeManifest({ ...manifest('mcp', 'connector'), risk: { level: 'high', reasons: ['local process'] } }).manifest
    assert.equal(aggregateRisk([low, high]).level, 'high')
    const serialized = serializeSidecar(high)
    assert.equal(serialized.ok, true)
    assert.match(serialized.content, /"schemaVersion": 2/)
  })

  it('preserves validated knowme experience and drops invalid tasks', () => {
    const result = validateAndNormalizeManifest({
      ...manifest('feishu-related-chats'),
      metadata: {
        knowme: {
          experience: {
            tasks: [
              {
                id: 'relatedChats',
                title: '相关聊天',
                modes: ['general'],
                surfaces: ['empty'],
                prompt: '分析聊天',
              },
              {
                id: 'bad task',
                title: 'bad',
                modes: ['general'],
                surfaces: ['empty'],
                prompt: 'bad',
              },
            ],
          },
        },
      },
    })
    assert.equal(result.ok, true)
    assert.equal(result.manifest.metadata.knowme.experience.tasks.length, 1)
    assert.ok(result.warnings.some(item => item.code === 'invalid_task_field'))
  })

  it('legacy adapter exposes empty experience extension', () => {
    const result = adaptLegacyCapability('skill', { name: 'Legacy' }, { id: 'legacy-skill' })
    assert.equal(result.ok, true)
    assert.deepEqual(result.manifest.metadata.knowme.experience.tasks, [])
  })
})
