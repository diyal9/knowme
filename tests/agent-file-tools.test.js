'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const fileTools = require('../src/lib/agent-file-tools')

describe('agent-file-tools', () => {
  it('exposes read and write tool definitions when includeWrite', () => {
    const names = fileTools.FILE_TOOL_DEFS.map(d => d.function.name)
    assert.ok(names.includes('read_file'))
    assert.ok(names.includes('write_file'))
    assert.ok(names.includes('apply_patch'))
  })

  it('read-only mode exposes only read tools', () => {
    const { definitions } = fileTools.buildFileTools({}, { includeWrite: false })
    const names = definitions.map(d => d.function.name)
    assert.deepEqual(names, ['read_file', 'list_dir', 'grep_files'])
  })

  it('reads a file through the adapter and truncates large content', async () => {
    const big = 'x'.repeat(fileTools.MAX_READ_CHARS + 500)
    const { handlers } = fileTools.buildFileTools({
      readFile: (rel) => ({ ok: true, content: rel === 'a.md' ? '内容' : big, path: rel }),
    })
    const ok = await handlers.read_file({ path: 'a.md' })
    assert.ok(ok.ok)
    assert.match(ok.text, /内容/)
    const truncated = await handlers.read_file({ path: 'big.md' })
    assert.ok(truncated.truncated)
    assert.match(truncated.text, /已截断/)
  })

  it('returns scope_denied for traversal path on write', async () => {
    const { handlers } = fileTools.buildFileTools({ validatePath: () => ({ ok: false, error: '非法路径' }) }, { includeWrite: true })
    const r = await handlers.write_file({ path: '../../outside.txt', content: 'x' })
    assert.equal(r.ok, false)
    assert.equal(r.code, 'scope_denied')
  })

  it('write_file creates draft requiring approval', async () => {
    const drafts = []
    const { handlers } = fileTools.buildFileTools({
      readFile: async () => ({ ok: true, content: 'before' }),
      rememberDraft: (d) => { drafts.push(d); return d },
    }, { includeWrite: true })
    const r = await handlers.write_file({ path: 'a.txt', content: 'after' })
    assert.equal(r.requiresApproval, true)
    assert.equal(r.code, 'approval_required')
    assert.equal(drafts.length, 1)
    assert.match(r.text, /草稿/)
  })

  it('apply_patch returns patch_conflict when file missing', async () => {
    const { handlers } = fileTools.buildFileTools({
      readFile: async () => ({ ok: false, error: 'missing' }),
    }, { includeWrite: true })
    const r = await handlers.apply_patch({ path: 'nope.txt', content: 'x' })
    assert.equal(r.code, 'patch_conflict')
  })

  it('apply_patch draft includes diff preview', async () => {
    const { handlers } = fileTools.buildFileTools({
      readFile: async () => ({ ok: true, content: 'line1\nline2' }),
      rememberDraft: (d) => d,
    }, { includeWrite: true })
    const r = await handlers.apply_patch({ path: 'f.txt', content: 'line1\nchanged' })
    assert.equal(r.requiresApproval, true)
    assert.match(r.text, /草稿/)
  })

  it('delete_path creates approval draft', async () => {
    const { handlers } = fileTools.buildFileTools({ rememberDraft: (d) => d }, { includeWrite: true })
    const r = await handlers.delete_path({ path: 'old.txt' })
    assert.equal(r.requiresApproval, true)
  })

  it('mkdir executes directly when adapter.mkdir provided', async () => {
    let called = false
    const { handlers } = fileTools.buildFileTools({
      mkdir: async () => { called = true; return { ok: true } },
    }, { includeWrite: true })
    const r = await handlers.mkdir({ path: 'newdir' })
    assert.equal(r.ok, true)
    assert.equal(called, true)
  })

  it('isTraversalPath detects parent segments', () => {
    assert.equal(fileTools.isTraversalPath('../x'), true)
    assert.equal(fileTools.isTraversalPath('a/b'), false)
  })

  it('applyFileDraft writes content when approved', async () => {
    let written = null
    const draft = { kind: 'file', action: 'write_file', path: 'a.txt', content: 'new' }
    const r = await fileTools.applyFileDraft(draft, {
      writeFile: async (rel, content) => { written = { rel, content }; return { ok: true } },
    })
    assert.equal(r.ok, true)
    assert.equal(written.content, 'new')
  })

  it('lists directory entries', async () => {
    const { handlers } = fileTools.buildFileTools({
      listDir: () => ({ ok: true, nodes: [{ type: 'dir', name: 'src', path: 'src' }] }),
    })
    const r = await handlers.list_dir({ path: '' })
    assert.ok(r.ok)
    assert.match(r.text, /src/)
  })

  it('greps matching lines', async () => {
    const { handlers } = fileTools.buildFileTools({
      grep: () => ({ ok: true, matches: [{ path: 'main.js', line: 10, text: 'ipc' }] }),
    })
    const hit = await handlers.grep_files({ query: 'ipc' })
    assert.match(hit.text, /main\.js:10/)
  })
})
