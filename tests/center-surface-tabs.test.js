'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')

describe('center surface tabs', () => {
  const workspaceHtml = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace.html'), 'utf8')
  const workspaceJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace.js'), 'utf8')
  const settingsHtml = fs.readFileSync(path.join(__dirname, '..', 'src', 'settings.html'), 'utf8')

  it('renders flat responsive shell tabs with accessible content linkage', () => {
    assert.ok(workspaceHtml.includes('id="drawerSurfaceTabs"'), 'dynamic center-surface tablist exists')
    assert.match(workspaceHtml, /\.drawer\.drawer-tabbed-surface \.drawer-surface-tabs\s*\{[^}]*overflow-x:auto[^}]*background:transparent[^}]*box-shadow:none/s)
    assert.match(workspaceHtml, /\.drawer-surface-tab::after\s*\{[^}]*height:2px[^}]*transform:scaleX\(0\)/s)
    assert.match(workspaceHtml, /\.drawer-surface-tab\.active::after\s*\{\s*transform:scaleX\(1\)/)
    assert.ok(workspaceJs.includes("button.setAttribute('role', 'tab')"), 'buttons use tab semantics')
    assert.ok(workspaceJs.includes("drawerBody.setAttribute('role', 'tabpanel')"), 'content uses tabpanel semantics')
    assert.ok(workspaceJs.includes("drawerBody.setAttribute('aria-labelledby', activeButton.id)"), 'active tab labels content')
    assert.ok(workspaceJs.includes("['ArrowLeft', 'ArrowRight', 'Home', 'End']"), 'keyboard navigation is supported')
  })

  it('exposes simplified top-level pages while preserving governance routes', () => {
    for (const label of ['我的知识', '待我确认', '来源']) {
      assert.ok(workspaceJs.includes(`label: '${label}'`), `${label} top-level tab`)
    }
    assert.ok(workspaceJs.includes('normalizeKnowledgeSurfaceRoute'), 'knowledge route aliases are normalized')
    assert.ok(workspaceJs.includes("sources: 'connect'"), 'sources route maps to connect tab')
    assert.ok(workspaceJs.includes('KNOWLEDGE_SURFACE_SECONDARY_ROUTES'), 'secondary routes stay available')
    assert.ok(workspaceJs.includes("if (normalized === 'health' || normalized === 'organize') return 'status'"), 'health and organize stay under knowledge status')
    assert.ok(workspaceJs.includes("if (normalized === 'fabric' || normalized === 'retrieve' || normalized === 'governance') return 'status'"), 'advanced routes stay under knowledge status')
    assert.ok(workspaceJs.includes("safeTab === 'organize'"), 'organization page route')
    assert.ok(workspaceJs.includes("safeTab === 'review'"), 'review page route')
    assert.ok(workspaceJs.includes("safeTab === 'connect'"), 'connect page route')
    assert.ok(workspaceJs.includes("safeTab === 'fabric'"), 'fabric page route')
    assert.ok(workspaceJs.includes("safeTab === 'retrieve'"), 'retrieve page route')
    assert.ok(workspaceJs.includes("safeTab === 'governance'"), 'governance page route')
    assert.ok(workspaceJs.includes('renderKnowledgeFabricWorkspace'), 'fabric workspace renderer')
    assert.ok(workspaceJs.includes('renderKnowledgeRetrieveWorkspace'), 'retrieve workspace renderer')
    assert.ok(workspaceJs.includes('renderKnowledgeGovernanceWorkspace'), 'governance workspace renderer')
    assert.ok(workspaceJs.includes('renderKnowledgeSourcesPage()'), 'sources page renderer')
    assert.ok(workspaceJs.includes("safeTab === 'health'"), 'health page route alias')
    assert.ok(workspaceJs.includes('fabricGovernanceCheckup'), 'governance checkup IPC wired in UI')
    assert.ok(workspaceJs.includes('data-kos-filter="all"'), 'entry filters remain secondary controls')
    assert.ok(workspaceJs.includes('wireKnowledgeProviderRows(drawerBody)'), 'provider switching remains wired')
  })

  it('moves settings categories into the parent shell and synchronizes the active iframe', () => {
    for (const label of ['内容源', 'AI 接口', '助手模式', '系统配置', '连接器', '我的记忆', '关于']) {
      assert.ok(workspaceJs.includes(`label: '${label}'`), `${label} setting tab`)
    }
    assert.match(settingsHtml, /\.embedded-settings \.titlebar\s*\{\s*display:none;/, 'embedded duplicate titlebar hidden')
    assert.ok(settingsHtml.includes("type: 'settings-tab-change'"), 'iframe reports current setting tab')
    assert.ok(workspaceJs.includes("d.type === 'settings-tab-change'"), 'parent receives setting tab')
    assert.ok(workspaceJs.includes('if (!isSettingsSource) return'), 'parent checks current iframe source')
    assert.ok(workspaceJs.includes('syncCenterSurfaceTabs(\'settings\', settingsSurfaceTab)'), 'parent synchronizes active state')
    assert.ok(workspaceJs.includes('settings.html?embedded=1&tab='), 'parent deep-links the selected category')
  })

  it('cleans tab chrome when the center surface closes or becomes a secondary dialog', () => {
    assert.ok(workspaceJs.includes("drawer.classList.remove('drawer-settings', 'drawer-capability-hub', 'drawer-tabbed-surface')"))
    assert.ok(workspaceJs.includes("drawer.classList.remove('drawer-tabbed-surface')"))
    assert.ok(workspaceJs.includes('clearCenterSurfaceTabs()'))
  })
})
