'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const { buildProductionRunPorts } = require('../src/lib/agent-run-kernel-adapter')
const sessions = require('../src/lib/agent-sessions')

test('production persistence keeps tool receipts and assistant trace alongside concurrent user input', async () => {
  const runId = 'transcript-run'
  const initial = sessions.createSession('general')
  initial.messages = [{ id: 'user-1', role: 'user', text: '生成头像' }]
  let saved = [initial]
  const ports = buildProductionRunPorts({
    session: initial, runId, settings: {}, signal: new AbortController().signal,
    loadAgentSessions: () => saved,
    saveAgentSessions: next => { saved = next.map(item => sessions.normalizeSession(item)) },
    toolSurface: { getToolDefinitions: () => [], validateToolCall: () => ({ ok: true }) },
    toolExecutor: { executeToolCall: async () => ({ ok: true }) },
    normalizeAssistantOutput: value => value,
    apiMessages: [],
  })
  const receipt = { effects: [{ type: 'save', target: 'artifact-1' }] }
  const tool = { id: 'tool-1', role: 'tool', runId, toolCallId: 'call-1', toolName: 'custom.render', text: '完成',
    artifactRefs: [{ id: 'artifact-1', type: 'image', targetPath: 'C:/output/image.png' }], receipt }
  const assistant = { id: 'answer-1', role: 'assistant', runId, text: '图片已保存',
    trace: [{ id: 'tool-1', kind: 'tool', title: '生成图片', status: 'done', toolName: 'custom.render' }] }
  saved = [{ ...initial, messages: [...initial.messages, { id: 'user-2', role: 'user', text: '请保留白底' }] }]
  await ports.session.persist({
    session: { ...initial, messages: [...initial.messages, tool, assistant] },
    fullText: assistant.text, trace: assistant.trace, toolMessages: [tool], metrics: { toolCalls: 1 }, emit: () => {},
  })
  const transcript = saved[0].messages
  assert.ok(transcript.some(item => item.id === 'user-2'))
  assert.deepEqual(transcript.find(item => item.id === 'tool-1').receipt, receipt)
  assert.equal(transcript.find(item => item.id === 'tool-1').artifactRefs[0].id, 'artifact-1')
  assert.equal(transcript.find(item => item.id === 'answer-1').trace[0].toolName, 'custom.render')
})
