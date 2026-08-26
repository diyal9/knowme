#!/usr/bin/env node
'use strict'

/**
 * Opt-in live smoke for the Capability Hub connector manager.
 *
 * Preconditions:
 * - Photoshop and Cocos Creator are already running.
 * - ~/.cursor/mcp.json contains `photoshop` and `creator_mcp` entries.
 * - the renderer dev server is available at KNOWME_VITE_URL.
 *
 * The script never prints or writes connector secrets. It installs the two
 * curated packages through the public UI, saves their local instances, tests
 * each connection, discovers tools and persists a conservative read-only
 * allowlist.
 */
const fs = require('fs')
const os = require('os')
const path = require('path')
const { _electron: electron } = require('playwright')

const repoRoot = path.resolve(__dirname, '..')
const viteUrl = String(process.env.KNOWME_VITE_URL || 'http://127.0.0.1:5173').replace(/\/$/, '')
const cursorMcpFile = path.join(os.homedir(), '.cursor', 'mcp.json')
const evidenceFile = path.join(repoRoot, 'openspec', 'changes', 'build-managed-connector-tool-platform', 'evidence', 'live-connectors.png')

function requireConfig() {
  const raw = JSON.parse(fs.readFileSync(cursorMcpFile, 'utf8'))
  const photoshop = raw?.mcpServers?.photoshop
  const creator = raw?.mcpServers?.creator_mcp
  if (!photoshop?.command || !photoshop?.args?.length) throw new Error('~/.cursor/mcp.json 缺少 photoshop stdio 配置')
  if (!creator?.url) throw new Error('~/.cursor/mcp.json 缺少 creator_mcp URL')
  const authorization = String(creator?.headers?.Authorization || '')
  const accessToken = authorization.replace(/^Bearer\s+/i, '')
  if (!accessToken) throw new Error('creator_mcp 缺少 Authorization Bearer token')
  return { photoshop, creator, accessToken }
}

async function openConnector(page, name) {
  const search = page.getByRole('searchbox', { name: '搜索能力' })
  await search.fill(name)
  const manage = page.getByRole('button', { name: `管理连接器：${name}` })
  const install = page.getByRole('button', { name: `查看并安装：${name}` })
  if (await manage.count()) await manage.click()
  else await install.click()

  const drawer = page.getByTestId('hub-detail-drawer')
  await drawer.waitFor({ state: 'visible' })
  const installButton = drawer.getByRole('button', { name: '安装', exact: true })
  if (await installButton.count()) {
    await installButton.click()
  }
  const manager = drawer.getByTestId('hub-connector-manager')
  await manager.waitFor({ state: 'visible', timeout: 20_000 })
  return { drawer, manager }
}

async function saveAndProbe(manager) {
  await manager.getByRole('button', { name: '保存配置' }).click()
  await manager.getByRole('status').filter({ hasText: '配置已保存' }).waitFor({ timeout: 20_000 })
  await manager.getByRole('button', { name: '测试连接' }).click()
  await manager.getByRole('status').filter({ hasText: /MCP 在线/ }).waitFor({ timeout: 45_000 })
  const online = await manager.getByRole('status').innerText()
  await manager.getByRole('button', { name: '发现工具' }).click()
  await manager.getByRole('status').filter({ hasText: /已发现 \d+ 个工具/ }).waitFor({ timeout: 45_000 })
  const discovered = await manager.getByRole('status').innerText()
  return { online, discovered }
}

async function setAllowlist(manager, names) {
  for (const name of names) {
    const checkbox = manager.getByRole('checkbox', { name: new RegExp(`^${name}\\b`) })
    if (await checkbox.count() && !(await checkbox.isChecked())) await checkbox.check()
  }
  await manager.getByRole('button', { name: '保存工具授权' }).click()
  await manager.getByRole('status').filter({ hasText: 'Agent 工具允许列表已保存' }).waitFor({ timeout: 20_000 })
}

async function closeDrawer(drawer) {
  await drawer.getByRole('button', { name: '关闭详情' }).click()
  await drawer.waitFor({ state: 'hidden' })
}

async function main() {
  const config = requireConfig()
  const electronApp = await electron.launch({
    args: [repoRoot, '--dev'],
    cwd: repoRoot,
    env: { ...process.env, KNOWME_VITE_URL: viteUrl },
    timeout: 45_000,
  })

  const page = await electronApp.firstWindow({ timeout: 45_000 })
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(String(error?.message || error)))

  try {
    await page.locator('#appShell').waitFor({ timeout: 45_000 })
    await page.getByRole('button', { name: '能力中心：Agent、Skill 与 MCP 连接器' }).click()
    const hub = page.getByTestId('capability-hub-surface')
    await hub.waitFor({ state: 'visible', timeout: 30_000 })
    await hub.getByRole('tab', { name: '连接器' }).click()

    const ps = await openConnector(page, 'Photoshop MCP')
    await ps.manager.getByLabel('传输方式').selectOption('stdio')
    await ps.manager.getByLabel('启动命令').fill(String(config.photoshop.command))
    await ps.manager.getByLabel('参数（每行一个）').fill((config.photoshop.args || []).join('\n'))
    const psCwd = config.photoshop.cwd || path.resolve(path.dirname(String(config.photoshop.args[0])), '..', '..', '..', '..')
    await ps.manager.getByLabel('工作目录').fill(psCwd)
    const psEnv = Object.entries(config.photoshop.env || {}).map(([key, value]) => `${key}=${value}`).join('\n')
    await ps.manager.getByLabel('非敏感环境变量（KEY=value）').fill(psEnv)
    const photoshop = await saveAndProbe(ps.manager)
    await setAllowlist(ps.manager, ['photoshop_ping', 'photoshop_get_version', 'photoshop_get_document_info', 'photoshop_get_layers'])
    await closeDrawer(ps.drawer)

    const creator = await openConnector(page, 'Cocos Creator MCP')
    await creator.manager.getByLabel('传输方式').selectOption('sse')
    await creator.manager.getByLabel('服务 URL').fill(String(config.creator.url))
    await creator.manager.getByLabel(/Creator MCP Access Token/).fill(config.accessToken)
    const cocos = await saveAndProbe(creator.manager)
    await setAllowlist(creator.manager, ['ping', 'get_project_info', 'get_editor_context', 'query_scene_hierarchy'])

    fs.mkdirSync(path.dirname(evidenceFile), { recursive: true })
    await page.screenshot({ path: evidenceFile, fullPage: true })
    console.log(JSON.stringify({
      ok: true,
      photoshop,
      cocos,
      evidenceFile,
      pageErrors: pageErrors.slice(0, 10),
    }, null, 2))
  } finally {
    await electronApp.close()
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, message: String(error?.message || error) }, null, 2))
  process.exitCode = 1
})
