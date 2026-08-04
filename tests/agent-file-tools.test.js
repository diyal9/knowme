'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const fileTools = require('../src/lib/agent-file-tools')

describe('agent-file-tools', () => {
  it('exposes read_file, list_dir and grep_files definitions', () => {
    const names = fileTools.FILE_TOOL_DEFS.map(d => d.function.name)
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

  it('returns a safe error when the adapter refuses an out-of-root path', async () => {
    const { handlers } = fileTools.buildFileTools({
      readFile: () => ({ ok: false, error: '非法路径' }),
    })
    const r = await handlers.read_file({ path: '../../etc/passwd' })
    assert.equal(r.ok, false)
    assert.match(r.text, /非法路径/)
  })

  it('lists directory entries', async () => {
    const { handlers } = fileTools.buildFileTools({
      listDir: () => ({ ok: true, nodes: [{ type: 'dir', name: 'src', path: 'src' }, { type: 'file', name: 'a.md', path: 'a.md' }] }),
    })
    const r = await handlers.list_dir({ path: '' })
    assert.ok(r.ok)
    assert.match(r.text, /src/)
    assert.match(r.text, /a\.md/)
  })

  it('greps matching lines and reports misses honestly', async () => {
    const { handlers } = fileTools.buildFileTools({
      grep: (q) => q === 'ipc'
        ? ({ ok: true, matches: [{ path: 'main.js', line: 10, text: 'ipcMain.handle' }] })
        : ({ ok: true, matches: [] }),
    })
    const hit = await handlers.grep_files({ query: 'ipc' })
    assert.match(hit.text, /main\.js:10/)
    const miss = await handlers.grep_files({ query: 'zzz' })
    assert.match(miss.text, /未找到/)
  })

  it('greps a file list via an injected reader and stops at maxMatches', () => {
    const reads = []
    const files = [{ path: 'a.md' }, { path: 'b.md' }]
    const contents = { 'a.md': 'foo\nbar foo\nbaz', 'b.md': 'foo here too' }
    const readFile = (rel) => { reads.push(rel); return contents[rel] }
    const r = fileTools.grepFiles('foo', { files, readFile, maxMatches: 2 })
    assert.ok(r.ok)
    assert.equal(r.matches.length, 2)
    assert.equal(r.matches[0].path, 'a.md')
    assert.equal(r.matches[0].line, 1)
  })

  it('grep returns empty for an empty query', () => {
    const r = fileTools.grepFiles('', { files: [{ path: 'a' }], readFile: () => 'x' })
    assert.equal(r.ok, false)
    assert.equal(r.matches.length, 0)
  })

  it('validates required arguments', async () => {
    const { handlers } = fileTools.buildFileTools({ readFile: () => ({ ok: true, content: '' }) })
    const r = await handlers.read_file({})
    assert.equal(r.ok, false)
    assert.match(r.text, /需要 path/)
  })
})
