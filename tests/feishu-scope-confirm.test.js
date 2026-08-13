'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')

const settings = fs.readFileSync(path.join(__dirname, '..', 'src', 'settings.html'), 'utf8')
const workspaceAgent = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace-agent.js'), 'utf8')

describe('feishu authorization confirmation and gap-based completion', () => {
  it('asks for confirmation with the capability list before opening the browser', () => {
    assert.match(settings, /id="feishuScopeConfirm"/)
    assert.match(settings, /id="btnFeishuScopeConfirm"/)
    assert.match(settings, /id="btnFeishuScopeCancel"/)
    assert.match(settings, /id="feishuScopeConfirmRaw"/)
    assert.match(settings, /const agreed = await confirmFeishuScopeRequest\(plan, topUp\)\s*\n\s*if \(!agreed\) return/)
  })

  it('exposes the authorization plan to the renderer through connector status', () => {
    const connectors = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'lib', 'connectors', 'index.js'),
      'utf8'
    )
    assert.match(connectors, /adjusted\.permissionPlan = planFeishuScopeRequest\(adjusted\.permissions\)/)
    assert.match(settings, /permissionPlan/)
  })

  // The pre-click state cannot prove this round granted anything, so a top-up
  // must wait for the granted set to actually change.
  it('requires the permission gap to shrink before reporting a top-up success', () => {
    assert.match(settings, /feishuAuthBaseline\s*=\s*\{[\s\S]{0,160}signature: feishuScopeSignature\(statusPayload\)/)
    assert.match(settings, /const grantedSomething = feishuAuthBaseline\.topUp/)
    assert.match(settings, /docKbReady !== false && grantedSomething/)
    assert.match(settings, /还没检测到新增授权/)
  })

  it('stops offering a stalled top-up as the primary action', () => {
    assert.match(settings, /feishuTopUpStalledKey/)
    assert.match(settings, /重试补充权限/)
    assert.match(settings, /通常需管理员审批/)
  })

  // `open-external` refuses any non-http scheme, so sending the internal auth
  // deep link there surfaced 「不允许的协议」 instead of authorizing.
  it('runs the auth deep link in-chat instead of handing it to the OS opener', () => {
    const openExternalIpc = fs.readFileSync(path.join(__dirname, '..', 'src', 'ipc', 'open-external.js'), 'utf8')
    assert.match(openExternalIpc, /不允许的协议/)
    assert.match(
      workspaceAgent,
      /async function handleFeishuLinkAction[\s\S]{0,400}?const authLink = parseFeishuAuthDeepLink\(url\)/
    )
    assert.match(workspaceAgent, /await runFeishuAuthInChat\(host, authLink\.scopes\)/)
    // The interception must precede every openExternal call in that function.
    const body = /async function handleFeishuLinkAction[\s\S]*?\r?\n  \}\r?\n/.exec(workspaceAgent)?.[0]
    assert.ok(body, 'handleFeishuLinkAction body should be locatable')
    assert.ok(
      body.indexOf('parseFeishuAuthDeepLink') < body.indexOf('openExternal'),
      'deep link is consumed before any external open'
    )
  })

  it('anchors the progress panel when a structured suggestion triggers auth', () => {
    assert.match(workspaceAgent, /function ensureFeishuAuthHost\(\)/)
    assert.match(workspaceAgent, /feishu-auth-cta-wrap feishu-auth-cta-wrap-standalone/)
    const workspaceHtml = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace.html'), 'utf8')
    assert.match(workspaceHtml, /\.feishu-auth-cta-wrap-standalone \{[^}]*display:block/)
  })

  it('names the scopes Feishu refused instead of implying a full request', () => {
    const auth = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'lib', 'connectors', 'feishu-auth.js'),
      'utf8'
    )
    assert.match(auth, /droppedScopes,\s*\n\s*skippedScopes,/)
    assert.match(workspaceAgent, /function feishuSkippedScopeNote\(result\)/)
    assert.match(workspaceAgent, /飞书不认识这些权限名/)
  })

  it('waits for a scope change before auto-resuming an in-chat authorization', () => {
    assert.match(workspaceAgent, /async function waitForFeishuAuth\(wrap, baseline = null\)/)
    assert.match(workspaceAgent, /if \(!baseline\?\.alreadyReady\) return true/)
    assert.match(workspaceAgent, /feishuScopeSignature\(statusPayload\) !== baseline\.signature/)
    assert.match(workspaceAgent, /waitForFeishuAuth\(wrap, baseline\)/)
  })
})
