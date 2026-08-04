'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')

describe('office assistant MVP surface', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace.html'), 'utf8')
  const agent = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace-agent.js'), 'utf8')

  it('labels office and R&D entry points clearly', () => {
    assert.match(html, /title="办公助理"/)
    assert.match(html, /title="工作台"/)
    assert.match(html, /<strong>工作台<\/strong>/)
  })

  it('exposes a discoverable expert picker', () => {
    assert.match(html, /id="agentExpertBtn"[^>]*>\s*<span class="ico" data-icon="plus"><\/span>\s*<\/button>/)
    assert.match(html, /id="agentExpertPop"/)
    assert.match(agent, /function renderExpertPop\(\)/)
    assert.match(agent, /data-expert-id/)
    assert.match(agent, /expert\.source === 'expert'/)
    assert.match(agent, /expertId: expert\.id/)
  })

  it('keeps the Feishu quick entry on the office home', () => {
    assert.match(html, /查文档\/知识库/)
    assert.match(agent, /飞书查询/)
  })
})
