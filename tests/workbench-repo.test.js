const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const repo = require('../src/lib/workbench-repo')

function makeRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-workbench-'))
  fs.mkdirSync(path.join(root, '.git'))
  fs.mkdirSync(path.join(root, '.cursor', 'workflows'), { recursive: true })
  fs.writeFileSync(path.join(root, '.cursor', 'workflows', 'index.json'), '{"workflows":[]}')
  return root
}

describe('workbench repository binding', () => {
  it('resolves the active Git source', () => {
    const root = makeRepo()
    const result = repo.resolveActiveRepo({
      activeSourceId: 'repo-1',
      sources: [{ id: 'repo-1', type: 'local', displayName: 'Repo One', rootPath: root }],
    })
    assert.equal(result.ok, true)
    assert.equal(result.root, root)
    assert.equal(result.source.displayName, 'Repo One')
  })

  it('rejects a non-Git source and allows missing workflow index', () => {
    const plain = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-plain-'))
    const nonGit = repo.resolveActiveRepo({
      activeSourceId: 'plain',
      sources: [{ id: 'plain', type: 'local', displayName: 'Plain', rootPath: plain }],
    })
    assert.equal(nonGit.ok, false)
    assert.match(nonGit.error, /不是 Git 仓库/)

    fs.mkdirSync(path.join(plain, '.git'))
    const noIndex = repo.resolveActiveRepo({
      activeSourceId: 'plain',
      sources: [{ id: 'plain', type: 'local', displayName: 'Plain', rootPath: plain }],
    })
    assert.equal(noIndex.ok, true)
    assert.equal(noIndex.root, plain)
  })

  it('keeps workflow paths inside .cursor/workflows', () => {
    const root = makeRepo()
    const valid = repo.resolveWorkflowFile(root, 'custom/flow.json')
    assert.equal(valid, path.join(root, '.cursor', 'workflows', 'custom', 'flow.json'))
    assert.equal(repo.resolveWorkflowFile(root, '../agents/secret.json'), null)
    assert.equal(repo.resolveWorkflowFile(root, 'C:\\temp\\flow.json'), null)
    assert.equal(repo.resolveWorkflowFile(root, '/tmp/flow.json'), null)
    assert.equal(repo.resolveWorkflowFile(root, 'custom/flow.yaml'), null)
  })

  it('resolves relative artifact paths under the active repo root', () => {
    const root = makeRepo()
    const file = path.join(root, 'docs', 'report.md')
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, '# ok')
    const store = {
      activeSourceId: 'repo-1',
      sources: [{ id: 'repo-1', type: 'local', displayName: 'Repo', rootPath: root }],
    }
    const ok = repo.resolveArtifactOpenPath('docs/report.md', store)
    assert.equal(ok.ok, true)
    assert.equal(ok.target, file)

    const missing = repo.resolveArtifactOpenPath('docs/missing.md', store)
    assert.equal(missing.ok, false)
    assert.equal(missing.reason, 'not-generated')

    const traversal = repo.resolveArtifactOpenPath('../outside.md', store)
    assert.equal(traversal.ok, false)
    assert.equal(traversal.reason, 'invalid')
  })
})
