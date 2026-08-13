'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

describe('office assistant MVP surface', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace.html'), 'utf8')
  const agent = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace-agent.js'), 'utf8')

  // 模式解析只依赖两个模块级列表，可以脱离 DOM 在沙箱里真跑一遍，
  // 避免这条契约退化成「源码里出现过某个函数名」。
  function loadModeResolvers({ agents = [], catalogExperts = [] } = {}) {
    const slice = (startMarker, endMarker) => {
      const start = agent.indexOf(startMarker)
      const end = agent.indexOf(endMarker, start)
      assert.ok(start >= 0 && end > start, `无法定位源码片段：${startMarker}`)
      return agent.slice(start, end)
    }
    const sandbox = { agents, catalogExperts, result: null }
    vm.createContext(sandbox)
    vm.runInContext([
      slice('const fallbackExperts = [', 'function iconForAgent'),
      slice('function availableAssistantModes()', 'function renderExpertPop()'),
      'result = { availableAssistantModes, availableExperts, isBuiltinAssistantMode }',
    ].join('\n'), sandbox)
    return sandbox.result
  }

  it('labels office and R&D entry points clearly', () => {
    assert.match(html, /title="办公助理"/)
    assert.match(html, /title="工作台"/)
    assert.match(html, /<strong>工作台<\/strong>/)
  })

  it('limits the new assistant picker to built-in modes', () => {
    assert.match(html, /id="agentExpertBtn"[^>]*title="我的专家"/)
    assert.match(html, /id="agentExpertPop"[^>]*aria-label="选择助手模式"/)
    assert.match(agent, /function availableAssistantModes\(\)/)
    assert.match(agent, /function renderExpertPop\(\)/)
    assert.match(agent, /expertPop\.innerHTML = availableAssistantModes\(\)\.map/)
    assert.doesNotMatch(agent, /expertPop\.innerHTML = availableExperts\(\)\.map/)
  })

  it('keeps installed expert packages out of the mode list', () => {
    const installed = [
      { id: 'ui-expert', name: 'UI 专家', description: '界面设计' },
      { id: 'qa-copy-n1fa1g', name: 'QA 副本', description: '测试残留' },
    ]
    const resolvers = loadModeResolvers({ catalogExperts: installed })
    const modes = resolvers.availableAssistantModes()
    // 沙箱数组跨 realm，比较 id 拼接串即可
    assert.equal(modes.map(item => item.id).join(','), 'general,steward,writing,coding')
    for (const item of installed) {
      assert.ok(!modes.some(mode => mode.id === item.id), `${item.id} 不应出现在模式列表`)
      assert.equal(resolvers.isBuiltinAssistantMode(item.id), false)
    }
    // 会话标题仍要能解析专家显示名，所以合并列表本身保留
    assert.ok(resolvers.availableExperts().some(item => item.id === 'ui-expert'))
  })

  it('switches built-in modes without loading an expert package', () => {
    const resolvers = loadModeResolvers()
    for (const mode of ['general', 'steward', 'writing', 'coding']) {
      assert.equal(resolvers.isBuiltinAssistantMode(mode), true, `${mode} 应被识别为内置模式`)
    }
    assert.match(agent, /const mode = availableAssistantModes\(\)\.find/)
    assert.match(agent, /const result = await startModeChat\(mode\.id\)/)
    assert.match(agent, /if \(isBuiltinAssistantMode\(id\)\) return startModeChat\(id\)/)
    assert.match(agent, /async function startModeChat\(modeId\)/)
    assert.match(agent, /createNewAgent\(\{ agentId: mode\.id \}\)/)
  })

  it('keeps the Feishu quick entry on the office home', () => {
    assert.match(html, /查文档\/知识库/)
    assert.match(agent, /飞书查询/)
  })
})
