'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const { normalizeAssistantOutput } = require('../src/lib/assistant-output-style')

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
    const prompt = fs.readFileSync(path.join(root, 'src', 'lib', 'ai-assistant-context.js'), 'utf8')
    const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8')
    const renderer = fs.readFileSync(path.join(root, 'src', 'workspace-agent.js'), 'utf8')
    const shell = fs.readFileSync(path.join(root, 'src', 'workspace.html'), 'utf8')
    const sessions = fs.readFileSync(path.join(root, 'src', 'lib', 'agent-sessions.js'), 'utf8')
    const feishu = fs.readFileSync(path.join(root, 'src', 'lib', 'connectors', 'feishu-cli.js'), 'utf8')

    assert.ok(prompt.includes('默认不要在自己生成的标题、列表、状态标签或正文中使用 Emoji'))
    assert.ok(main.includes("require('./lib/assistant-output-style')"))
    assert.ok(main.includes('normalizeAssistantOutput(snapshot.content)'))
    assert.ok(main.includes('fullText = normalizeAssistantOutput(fullText)'))
    assert.ok(renderer.includes('window.AssistantOutputStyle'))
    assert.ok(renderer.includes('const assistantText = normalizeAssistantOutput(m.text)'))
    assert.ok(shell.includes('lib/assistant-output-style.js'))
    assert.ok(sessions.includes("require('./assistant-output-style')"))
    assert.ok(sessions.includes('normalizeAssistantOutput(m.text)'))
    assert.ok(feishu.includes('默认不使用 emoji、颜文字或装饰性图标'))
  })
})
