'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')

const readSource = (file) => fs.readFileSync(path.join(__dirname, '..', 'src', file), 'utf8')

describe('settings connector cleanup', () => {
  const settings = readSource('settings.html')
  const preload = readSource('preload.js')
  const main = readSource('main.js')
  const workspaceAgent = readSource('workspace-agent.js')

  it('keeps Feishu write approval out of connector settings', () => {
    assert.doesNotMatch(settings, /待确认的飞书写入/)
    assert.doesNotMatch(settings, /connectorDrafts|refreshConnectorDrafts/)
    assert.doesNotMatch(settings, /data-draft-(?:approve|reject)/)
  })

  it('hides the built-in MCP placeholder while preserving its dedicated form', () => {
    assert.match(settings, /!\['feishu', 'mcp-default'\]\.includes\(c\.id\)/)
    assert.match(settings, /withStatus\.find\(\(c\) => c\.id === 'mcp-default'\)/)
    assert.match(settings, /id:\s*'mcp-default'[\s\S]*title:\s*'公司 MCP'/)
  })

  it('removes legacy draft IPC and keeps the unified Agent approval path', () => {
    assert.doesNotMatch(preload, /connectorsDrafts|connectorsApproveDraft/)
    assert.doesNotMatch(preload, /connectors-(?:drafts|approve-draft)/)
    assert.doesNotMatch(main, /ipcMain\.handle\('connectors-(?:drafts|approve-draft)'/)
    assert.doesNotMatch(workspaceAgent, /connectorsApproveDraft/)

    assert.match(preload, /connectorsCreateDocDraft/)
    assert.match(preload, /toolApproveDraft/)
    const connectorsIpc = readSource('ipc/connectors.js')
    assert.match(connectorsIpc, /ipcMain\.handle\('connectors-create-doc-draft'/)
    assert.match(connectorsIpc, /ipcMain\.handle\('tool-approve-draft'/)
    assert.match(main, /registerCoreIpc|registerConnectorsIpc/)
    assert.match(workspaceAgent, /window\.api\?\.toolApproveDraft/)
    assert.match(workspaceAgent, /class="agent-tool-approval"/)
  })
})
