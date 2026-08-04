const { describe, it } = require('node:test')
const assert = require('node:assert')
const {
  normalizeRepoPath,
  normalizeTaskContext,
  normalizeTaskContextDefaults,
  summarizeTaskContext,
} = require('../src/lib/workbench-task-context')

describe('workbench task context', () => {
  it('normalizes repository-relative paths and resource lists', () => {
    const context = normalizeTaskContext({
      workspace: { projectId: 'group/project', ref: 'main' },
      inputs: {
        root: './artifacts//inbox/demo',
        prd: 'PRD.md',
        resources: 'assets/, assets/, references/',
      },
      outputs: { root: 'artifacts/outputs/demo' },
    })
    assert.equal(context.protocolVersion, '1')
    assert.deepEqual(context.inputs.resources, ['assets/', 'references/'])
    assert.equal(summarizeTaskContext(context).includes('group/project'), true)
  })

  it('rejects absolute paths, traversal, and incomplete context', () => {
    assert.throws(
      () => normalizeRepoPath('C:\\secret', '输入制品目录'),
      error => error.code === 'invalid_context_path',
    )
    assert.throws(
      () => normalizeRepoPath('artifacts/../secret', 'PRD 路径'),
      error => error.code === 'invalid_context_path',
    )
    assert.throws(
      () => normalizeTaskContext({
        workspace: { projectId: 'group/project' },
        inputs: {},
        outputs: { root: 'artifacts/out' },
      }),
      error => error.code === 'invalid_context',
    )
  })

  it('returns null for an omitted optional context', () => {
    assert.equal(normalizeTaskContext(null), null)
    assert.equal(normalizeTaskContext({}), null)
  })

  it('normalizes partial daemon defaults and allows asset files as PRD input', () => {
    const context = normalizeTaskContextDefaults({
      workspace: { projectId: 'group/project', ref: 'release/1.0' },
      inputs: { prd: './assets/mockup.png' },
    })
    assert.equal(context.workspace.projectId, 'group/project')
    assert.equal(context.workspace.ref, 'release/1.0')
    assert.equal(context.inputs.prd, 'assets/mockup.png')
    assert.deepEqual(context.inputs.resources, [])
  })
})
