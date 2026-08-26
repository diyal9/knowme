#!/usr/bin/env node
'use strict'

/**
 * Opt-in live configuration/probe for the real KnowMe user profile.
 * Must be launched by Electron so connector secrets can use safeStorage.
 */
const fs = require('fs')
const os = require('os')
const path = require('path')
const { app, safeStorage } = require('electron')
require('./register-ts')

const repoRoot = path.resolve(__dirname, '..')
const catalogRoot = path.join(repoRoot, 'src', 'catalog')
const cursorMcpFile = path.join(os.homedir(), '.cursor', 'mcp.json')

function loadSourceConfig() {
  const doc = JSON.parse(fs.readFileSync(cursorMcpFile, 'utf8'))
  const photoshop = doc?.mcpServers?.photoshop
  const creator = doc?.mcpServers?.creator_mcp
  if (!photoshop?.command || !photoshop?.args?.length) throw new Error('缺少 photoshop stdio 配置')
  if (!creator?.url) throw new Error('缺少 creator_mcp URL')
  const token = String(creator?.headers?.Authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) throw new Error('creator_mcp 缺少 Bearer token')
  return { photoshop, creator, token }
}

function ensureInstalled(userData, id) {
  const target = path.join(userData, 'capabilities', 'connectors', id, 'manifest.json')
  if (fs.existsSync(target)) return { ok: true, status: 'already' }
  const { installCurated } = require('../src/lib/capability-import')
  return installCurated(userData, id, {
    bundledRoot: catalogRoot,
    enabled: true,
    riskConfirmed: true,
  })
}

async function callReadOnly(connector, api, toolName) {
  const host = require('../src/lib/mcp-host')
  const session = host.createMcpSessionForTransport(connector.mcp, {
    ...api.resolveRuntimeOptions(connector),
    timeoutMs: 30_000,
  })
  try {
    const result = await session.callTool(toolName, {})
    return {
      tool: toolName,
      ok: result.ok === true,
      preview: String(result.text || result.message || '').slice(0, 300),
    }
  } finally {
    await session.close()
  }
}

async function main() {
  app.setName('KnowMe')
  app.setPath('userData', path.join(app.getPath('appData'), 'KnowMe'))
  await app.whenReady()

  const userData = app.getPath('userData')
  const source = loadSourceConfig()
  const installs = {
    photoshop: ensureInstalled(userData, 'photoshop-mcp'),
    creator: ensureInstalled(userData, 'cocos-creator-mcp'),
  }
  if (!installs.photoshop.ok || !installs.creator.ok) {
    throw new Error(installs.photoshop.error || installs.creator.error || '连接器安装失败')
  }

  const { createConnectorsApi } = require('../src/lib/connectors')
  const api = createConnectorsApi({
    getUserData: () => userData,
    safeStorage,
    storeMode: 'unified',
  })

  const photoshopCwd = source.photoshop.cwd
    || path.resolve(path.dirname(String(source.photoshop.args[0])), '..', '..', '..', '..')
  api.upsertConnector({
    id: 'photoshop-mcp',
    title: 'Photoshop MCP',
    type: 'mcp',
    enabled: true,
    mcp: {
      transport: 'stdio',
      command: String(source.photoshop.command),
      args: source.photoshop.args.map(String),
      cwd: photoshopCwd,
      env: Object.fromEntries(Object.entries(source.photoshop.env || {}).map(([key, value]) => [key, String(value)])),
      envKeys: [],
    },
  })
  api.setAllowlist('photoshop-mcp', [
    'photoshop_ping',
    'photoshop_get_version',
    'photoshop_get_document_info',
    'photoshop_get_layers',
  ])

  api.upsertConnector({
    id: 'cocos-creator-mcp',
    title: 'Cocos Creator MCP',
    type: 'mcp',
    enabled: true,
    mcp: {
      transport: 'sse',
      url: String(source.creator.url),
    },
  })
  const secret = await api.setSecrets('cocos-creator-mcp', { access_token: source.token })
  if (!secret.ok) throw new Error(secret.message || 'Creator MCP 密钥保存失败')
  api.setAllowlist('cocos-creator-mcp', [
    'ping',
    'get_project_info',
    'get_editor_context',
    'query_scene_hierarchy',
  ])

  const photoshopStatus = await api.getConnectorStatus('photoshop-mcp')
  const photoshopTools = await api.getConnectorTools('photoshop-mcp')
  const creatorStatus = await api.getConnectorStatus('cocos-creator-mcp')
  const creatorTools = await api.getConnectorTools('cocos-creator-mcp')
  const connectors = api.loadConnectors()
  const photoshopConnector = connectors.find((item) => item.id === 'photoshop-mcp')
  const creatorConnector = connectors.find((item) => item.id === 'cocos-creator-mcp')

  const calls = {
    photoshop: await callReadOnly(photoshopConnector, api, 'photoshop_ping'),
    creator: await callReadOnly(creatorConnector, api, 'ping'),
  }
  const workflowStore = require('../src/lib/workflow-package-store').createStore({ userData })
  const workflowCurrent = workflowStore.get('th-art-psd-to-artbundle')
  let workflow = { ok: false, status: 'not_installed', connectorDependencies: [] }
  if (workflowCurrent.ok) {
    const { enrichExternalWorkflowPackage } = require('../src/lib/external-workflow-recipes')
    const upgraded = enrichExternalWorkflowPackage(workflowCurrent.package)
    const saved = workflowStore.save(upgraded)
    if (!saved.ok) throw new Error(saved.error || 'PSD → ArtBundle 工作流依赖升级失败')
    workflow = {
      ok: true,
      status: 'upgraded',
      connectorDependencies: saved.package.connectorDependencies || [],
    }
  }
  const publicList = api.listConnectors()
  const publicCreator = publicList.connectors.find((item) => item.id === 'cocos-creator-mcp')

  console.log(JSON.stringify({
    ok: photoshopStatus?.connector?.status?.ok === true
      && creatorStatus?.connector?.status?.ok === true
      && calls.photoshop.ok
      && calls.creator.ok,
    userData,
    installs,
    photoshop: {
      status: photoshopStatus?.connector?.status,
      discoveredTools: photoshopTools?.availableTools?.length || 0,
      allowlist: photoshopConnector?.allowlist || [],
      call: calls.photoshop,
    },
    creator: {
      status: creatorStatus?.connector?.status,
      discoveredTools: creatorTools?.availableTools?.length || 0,
      allowlist: creatorConnector?.allowlist || [],
      secretConfigured: publicCreator?.secretSlots?.some((slot) => slot.key === 'access_token' && slot.configured === true) === true,
      call: calls.creator,
    },
    workflow,
  }, null, 2))
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ ok: false, message: String(error?.message || error) }, null, 2))
    process.exitCode = 1
  })
  .finally(() => app.exit(process.exitCode || 0))
