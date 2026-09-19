const { it } = require('node:test')
const assert = require('node:assert/strict')
const { parseToolArguments } = require('../src/lib/agent-tools-format')
const { buildReflectionNote } = require('../src/lib/agent-recovery')
const { buildToolFailureHint } = require('../src/lib/agent-tool-failure-hint')
const { createStreamAccumulator, feedSse, flushSse, getStreamSnapshot } = require('../src/lib/agent-stream')

it('returns safe syntax diagnostics without copying document contents or parser excerpts', () => {
  const raw = '{"content":"private-secret\n正文"}'
  const result = parseToolArguments(raw)
  assert.equal(result.ok, false)
  assert.equal(result.code, 'invalid_args')
  assert.match(result.message, /JSON/)
  assert.match(result.message, /字符数=/)
  assert.match(result.message, /位置=/)
  assert.doesNotMatch(JSON.stringify(result), /private-secret|正文/)
  assert.equal(parseToolArguments('{"content":"tail').diagnostics.reason, 'incomplete_json')
})

it('gives JSON-specific repair feedback rather than asking for a resource token', () => {
  const result = parseToolArguments('{"content":"a\nb"}')
  const failure = { ...result, toolName: 'create_artifact', status: 'error', text: result.message }
  const reflection = buildReflectionNote([failure])
  assert.match(reflection, /JSON/)
  assert.match(reflection, /转义/)
  assert.doesNotMatch(reflection, /补齐 token|更换关键词/)
  const hint = buildToolFailureHint([failure])
  assert.match(hint, /参数格式/)
  assert.doesNotMatch(hint, /文档 token|查询关键词|明确目标对象/)
})

it('reassembles fragmented document JSON exactly, including split escapes and multiple calls', () => {
  const content = '第一行\n"quote" 与 \\path'
  const args = JSON.stringify({ kind: 'markdown', content })
  const acc = createStreamAccumulator()
  for (let i = 0; i < args.length; i++) {
    const frame = { choices: [{ delta: { tool_calls: [{ index: 0, ...(i === 0 ? { id: 'call-a' } : {}), function: { ...(i === 0 ? { name: 'create_artifact' } : {}), arguments: args[i] } }] } }] }
    const wire = `data: ${JSON.stringify(frame)}\n\n`
    feedSse(acc, wire.slice(0, 9)); feedSse(acc, wire.slice(9))
  }
  feedSse(acc, `data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 1, id: 'call-b', function: { name: 'discover_tools', arguments: '{}' } }] }, finish_reason: 'tool_calls' }] })}\n\n`)
  flushSse(acc)
  const calls = getStreamSnapshot(acc).toolCalls
  assert.equal(calls[0].arguments, args)
  assert.equal(parseToolArguments(calls[0].arguments).args.content, content)
  assert.equal(calls[1].arguments, '{}')
})


it('rejects invalid document arguments before dispatch and preserves a corrected document exactly', async () => {
  const { createToolSurface } = require('../src/lib/agent-tools')
  const { ARTIFACT_TOOL_DEFS } = require('../src/lib/agent-artifact-tools')
  const received = []
  const surface = createToolSurface({ extraDefinitions: ARTIFACT_TOOL_DEFS, handlers: {
    create_artifact: async args => { received.push(args); return { ok: true, text: 'created' } },
  } })
  const executor = surface.createToolExecutor({})
  const failure = await executor.executeToolCall({ name: 'create_artifact', arguments: '{"kind":"markdown","content":"broken\nline"}' })
  assert.equal(failure.ok, false)
  assert.equal(failure.executionStarted, false)
  assert.equal(received.length, 0)
  assert.match(failure.text, /字符数=/)
  const args = { kind: 'markdown', title: '需求', content: '第一行\n引用 "value"，路径 C:\\docs' }
  const success = await executor.executeToolCall({ name: 'create_artifact', arguments: JSON.stringify(args) })
  assert.equal(success.ok, true)
  assert.deepEqual(received, [args])
})
