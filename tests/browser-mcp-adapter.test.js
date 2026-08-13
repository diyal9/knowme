'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const browserAdapter = require('../src/lib/browser-mcp-adapter')

describe('browser-mcp-adapter', () => {
  it('blocks disallowed domain', () => {
    const r = browserAdapter.isDomainAllowed('http://127.0.0.1/page')
    assert.equal(r.ok, false)
    assert.equal(r.code, 'scope_denied')
  })

  it('allows domain on allowlist', () => {
    const r = browserAdapter.isDomainAllowed('https://example.com/page', { allowlist: ['example.com'] })
    assert.equal(r.ok, true)
  })

  it('maps playwright tool names', () => {
    assert.equal(browserAdapter.mapPlaywrightToolName('navigate'), 'browser_navigate')
    assert.equal(browserAdapter.mapPlaywrightToolName('browser_snapshot'), 'browser_snapshot')
  })

  it('projects browser tool defs from fake MCP list', () => {
    const defs = browserAdapter.buildBrowserToolDefs([
      { name: 'browser_snapshot', description: 'snap', inputSchema: { type: 'object', properties: {} } },
    ], 'playwright')
    assert.equal(defs.length, 1)
    assert.equal(defs[0].function.name, 'browser_snapshot')
  })

  it('handler returns unavailable without MCP', async () => {
    const { handlers } = browserAdapter.buildBrowserMcpAdapter({ callMcpTool: null })
    const r = await handlers.browser_snapshot({ url: 'https://example.com' })
    assert.equal(r.ok, false)
    assert.match(r.text, /未配置/)
  })

  it('handler calls fake MCP when configured', async () => {
    const { handlers } = browserAdapter.buildBrowserMcpAdapter({
      allowlist: ['example.com'],
      callMcpTool: async () => ({ ok: true, text: 'snapshot ok' }),
    })
    const r = await handlers.browser_navigate({ url: 'https://example.com' })
    assert.equal(r.ok, true)
  })
})
