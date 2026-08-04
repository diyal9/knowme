'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { EventEmitter } = require('events')
const { PassThrough } = require('stream')
const {
  projectMcpTools,
  createMcpSession,
  sanitizeConnectorId,
  buildMcpAgentToolName,
  parseMcpAgentToolName,
  createMcpHostRegistry,
} = require('../src/lib/mcp-host')

describe('mcp-host projectMcpTools', () => {
  it('filters by allowlist and prefixes connector id', () => {
    const tools = [
      { name: 'a', description: 'A', inputSchema: { type: 'object' } },
      { name: 'b', description: 'B' },
      { name: 'c', description: 'C' },
    ]
    const projected = projectMcpTools(tools, ['a', 'c'], 'my-mcp')
    assert.equal(projected.length, 2)
    assert.equal(projected[0].function.name, 'mcp.my_mcp.a')
    assert.equal(projected[1].function.name, 'mcp.my_mcp.c')
    assert.equal(projected[0]._knowme.rawToolName, 'a')
    assert.equal(projected[0]._knowme.connectorId, 'my-mcp')
  })

  it('projects nothing when allowlist empty', () => {
    assert.deepEqual(projectMcpTools([{ name: 'a' }], [], 'x'), [])
  })

  it('sanitizes connector ids and parses agent tool names', () => {
    assert.equal(sanitizeConnectorId('My MCP!'), 'my_mcp')
    assert.equal(buildMcpAgentToolName('alpha', 'echo'), 'mcp.alpha.echo')
    assert.deepEqual(parseMcpAgentToolName('mcp.alpha.echo'), {
      sanitizedConnectorId: 'alpha',
      rawToolName: 'echo',
    })
    assert.equal(parseMcpAgentToolName('echo'), null)
  })
})

describe('mcp-host session', () => {
  it('returns unconfigured without command', async () => {
    const session = createMcpSession({ command: '' })
    const listed = await session.listTools()
    assert.equal(listed.ok, false)
    assert.equal(listed.code, 'unconfigured')
  })

  it('speaks json-rpc over mocked stdio', async () => {
    const stdout = new PassThrough()
    const stderr = new PassThrough()
    const child = new EventEmitter()
    child.stdout = stdout
    child.stderr = stderr
    child.kill = () => {}
    child.stdin = {
      write(chunk) {
        const msg = JSON.parse(String(chunk).trim())
        queueMicrotask(() => {
          if (msg.method === 'initialize') {
            stdout.write(JSON.stringify({
              jsonrpc: '2.0',
              id: msg.id,
              result: {
                protocolVersion: '2024-11-05',
                capabilities: {},
                serverInfo: { name: 'mock' },
              },
            }) + '\n')
          } else if (msg.method === 'tools/list') {
            stdout.write(JSON.stringify({
              jsonrpc: '2.0',
              id: msg.id,
              result: {
                tools: [{
                  name: 'echo',
                  description: 'Echo',
                  inputSchema: { type: 'object' },
                }],
              },
            }) + '\n')
          } else if (msg.method === 'tools/call') {
            stdout.write(JSON.stringify({
              jsonrpc: '2.0',
              id: msg.id,
              result: { content: [{ type: 'text', text: 'hi' }] },
            }) + '\n')
          }
        })
        return true
      },
    }

    const session = createMcpSession({
      command: 'mock-mcp',
      args: [],
      spawnImpl: () => child,
      timeoutMs: 2000,
    })
    const listed = await session.listTools()
    assert.equal(listed.ok, true)
    assert.equal(listed.tools[0].name, 'echo')
    const called = await session.callTool('echo', { x: 1 })
    assert.equal(called.ok, true)
    assert.equal(called.text, 'hi')
    await session.close()
  })
})

describe('mcp-host registry lifecycle', () => {
  it('connects, reuses, and disconnects per connector id', async () => {
    let spawnCount = 0
    const registry = createMcpHostRegistry()
    const spawnImpl = () => {
      spawnCount += 1
      const stdout = new PassThrough()
      const child = new EventEmitter()
      child.stdout = stdout
      child.stderr = new PassThrough()
      child.kill = () => {}
      child.stdin = {
        write(chunk) {
          const msg = JSON.parse(String(chunk).trim())
          queueMicrotask(() => {
            if (msg.method === 'initialize') {
              stdout.write(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { protocolVersion: '2024-11-05', capabilities: {}, serverInfo: { name: 'mock' } } }) + '\n')
            } else if (msg.method === 'tools/list') {
              stdout.write(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { tools: [] } }) + '\n')
            }
          })
          return true
        },
      }
      return child
    }
    const cfg = { command: 'mock', args: [], cwd: '', envKeys: [] }
    const s1 = await registry.connect('conn-a', cfg, { spawnImpl })
    await s1.listTools()
    const s2 = await registry.connect('conn-a', cfg, { spawnImpl })
    assert.equal(spawnCount, 1)
    assert.equal(s1, s2)
    await registry.disconnect('conn-a')
    assert.deepEqual(registry.listConnectedIds(), [])
    await registry.connect('conn-b', cfg, { spawnImpl })
    await registry.getSession('conn-b').listTools()
    assert.equal(spawnCount, 2)
    await registry.disconnectAll()
    assert.deepEqual(registry.listConnectedIds(), [])
  })
})
