'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const { normalizeAssistantOutput } = require('../src/lib/assistant-output-style')
const { readMainIpcBundle } = require('./helpers/main-ipc-bundle')

describe('assistant output style', () => {
  it('removes decorative emoji from generated structural text', () => {
    const input = '🟦 Top 1：确认材料\n## 🎯 结论\n- ✅ 已完成 🎉'
    const output = normalizeAssistantOutput(input)
    assert.equal(output, 'Top 1：确认材料\n## 结论\n- 已完成')
  })

  it('removes emoji-only decoration lines without changing surrounding text', () => {
    assert.equal(
      normalizeAssistantOutput('结论\n✨🔥\n下一步'),
      '结论\n\n下一步',
    )
  })

  it('preserves blockquotes and fenced code exactly', () => {
    const input = [
      '> 🟦 用户原文：今天😀要保留',
      '```text',
      '🟦 code example 😀',
      '```',
    ].join('\n')
    assert.equal(normalizeAssistantOutput(input), input)
  })

  it('keeps ordinary non-decorative emoji in the middle of a sentence', () => {
    const input = '用户描述：今天😀要保留；请分析 🧪 数据'
    assert.equal(normalizeAssistantOutput(input), input)
  })

  it('wires the same policy into prompt, main, renderer, and workspace shell', () => {
    const root = path.join(__dirname, '..')
    const prompt = [
      fs.readFileSync(path.join(root, 'src', 'lib', 'ai-assistant-context.ts'), 'utf8'),
      fs.readFileSync(path.join(root, 'src', 'lib', 'knowme-system-prompt.ts'), 'utf8'),
    ].join('\n')
    const main = readMainIpcBundle()
    const agentSessions = fs.readFileSync(path.join(root, 'src', 'lib', 'agent-sessions.ts'), 'utf8')
    const aiGenerate = [
      fs.readFileSync(path.join(root, 'src', 'ipc', 'ai-generate.ts'), 'utf8'),
      fs.readFileSync(path.join(root, 'src', 'lib', 'agent-generate-execute.ts'), 'utf8'),
    ].join('\n')
    const styleLib = fs.readFileSync(path.join(root, 'src', 'lib', 'assistant-output-style.ts'), 'utf8')
    const sessions = agentSessions
    const feishu = [
      fs.readFileSync(path.join(root, 'src', 'lib', 'connectors', 'feishu-cli.ts'), 'utf8'),
      fs.readFileSync(path.join(root, 'src', 'lib', 'connectors', 'feishu-cli', 'im.ts'), 'utf8'),
    ].join('\n')

    assert.ok(prompt.includes('默认不要在自己生成的标题、列表、状态标签或正文中使用 Emoji'))
    assert.ok(main.includes("require('../lib/assistant-output-style')") || main.includes("require('./lib/assistant-output-style')"))
    const executor = fs.readFileSync(path.join(root, 'src', 'lib', 'agent-run-executor.ts'), 'utf8')
    assert.ok(
      main.includes('normalizeAssistantOutput(snapshot.content)')
      || main.includes('normalizeAssistantOutput: scope.normalizeAssistantOutput')
      || main.includes('normalizeAssistantOutput: ctx.normalizeAssistantOutput')
      || executor.includes('fullText = normalizeAssistantOutput(fullText)'),
    )
    assert.ok(executor.includes('fullText = normalizeAssistantOutput(fullText)'))
    assert.ok(aiGenerate.includes('normalizeAssistantOutput'))
    assert.ok(styleLib.includes('function normalizeAssistantOutput'))
    assert.ok(sessions.includes("require('./assistant-output-style')"))
    assert.ok(sessions.includes('normalizeAssistantOutput(m.text)'))
    assert.ok(feishu.includes('默认不使用 emoji、颜文字或装饰性图标'))
  })
})
