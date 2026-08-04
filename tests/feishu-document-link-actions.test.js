'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const {
  classifyFeishuResource,
  parseFeishuUrl,
  parseOpenLink,
  linkAction,
  findMarkdownLinks,
  rewriteMarkdownLinks,
  buildFeishuClientUrl,
} = require('../src/lib/feishu-link')

describe('feishu document link actions', () => {
  const agent = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace-agent.js'), 'utf8')
  const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace.html'), 'utf8')

  it('accepts secure Feishu and LarkSuite URLs', () => {
    assert.equal(parseFeishuUrl('https://forever9.feishu.cn/wiki/abc').host, 'forever9.feishu.cn')
    assert.equal(parseFeishuUrl('https://example.larksuite.com/docx/abc').host, 'example.larksuite.com')
  })

  it('maps AppLink pages to the client scheme so no browser tab is needed', () => {
    assert.equal(
      buildFeishuClientUrl('https://applink.feishu.cn/client/chat/open?openChatId=oc_abc'),
      'feishu://applink.feishu.cn/client/chat/open?openChatId=oc_abc',
    )
    assert.equal(
      buildFeishuClientUrl('https://applink.larksuite.com/client/chat/open?openChatId=oc_abc'),
      'lark://applink.larksuite.com/client/chat/open?openChatId=oc_abc',
    )
  })

  it('leaves non-AppLink URLs on the browser path', () => {
    assert.equal(buildFeishuClientUrl('https://forever9.feishu.cn/minutes/obcnabc'), '')
    assert.equal(buildFeishuClientUrl('https://example.com/client/chat/open'), '')
    assert.equal(buildFeishuClientUrl('http://applink.feishu.cn/client/chat/open'), '')
    assert.equal(buildFeishuClientUrl('not a url'), '')
  })

  it('opens AppLinks through the client scheme with an https fallback', () => {
    const main = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8')
    assert.ok(main.includes('feishuLink.buildFeishuClientUrl(raw)'), 'tries the client scheme first')
    assert.ok(main.includes('function hasSchemeHandler'), 'probes for a registered handler')
    assert.ok(main.includes('viaClient: true'), 'reports the client path')
  })

  it('classifies common Feishu resources without network metadata', () => {
    assert.deepEqual(classifyFeishuResource('/docx/abc'), { type: 'doc', label: '飞书文档', glyph: '文' })
    assert.equal(classifyFeishuResource('/sheets/abc').type, 'sheet')
    assert.equal(classifyFeishuResource('/base/abc').type, 'base')
    assert.equal(classifyFeishuResource('/wiki/abc').type, 'wiki')
    assert.equal(classifyFeishuResource('/minutes/abc').type, 'minutes')
    assert.equal(classifyFeishuResource('/client/chat/open').type, 'chat')
    assert.equal(classifyFeishuResource('/unknown/abc').type, 'resource')
    assert.equal(parseOpenLink('https://example.feishu.cn/bitable/abc').feishuResource.label, '多维表格')
  })

  it('builds Feishu chat open applinks', () => {
    const { buildFeishuChatOpenUrl } = require('../src/lib/feishu-link')
    assert.equal(
      buildFeishuChatOpenUrl('oc_41e7bdf4877cfc316136f4ccf6c32613'),
      'https://applink.feishu.cn/client/chat/open?openChatId=oc_41e7bdf4877cfc316136f4ccf6c32613'
    )
    assert.equal(buildFeishuChatOpenUrl(''), '')
    const parsed = parseOpenLink('https://applink.feishu.cn/client/chat/open?openChatId=oc_1')
    assert.equal(parsed?.isFeishu, true)
    assert.equal(parsed?.feishuResource?.type, 'chat')
  })

  it('rejects unsafe protocols and unrelated hosts', () => {
    assert.equal(parseFeishuUrl('http://feishu.cn/docx/abc'), null)
    assert.equal(parseFeishuUrl('javascript:alert(1)'), null)
    assert.equal(parseFeishuUrl('https://example.com/docx/abc'), null)
  })

  it('allows only known actions for a valid URL', () => {
    const url = 'https://forever9.feishu.cn/docx/abc'
    assert.equal(linkAction(url, 'right').action, 'right')
    assert.equal(linkAction(url, 'external').action, 'external')
    assert.equal(linkAction(url, 'smart').action, 'smart')
    assert.equal(linkAction(url, 'unknown').ok, false)
  })

  it('classifies generic links for smart open routing', () => {
    const preview = parseOpenLink('https://example.com/readme.md')
    assert.equal(preview?.kind, 'preview')
    assert.equal(preview?.previewable, true)

    const browser = parseOpenLink('https://example.com/landing')
    assert.equal(browser?.kind, 'browser')

    const mail = parseOpenLink('mailto:hello@example.com')
    assert.equal(mail?.kind, 'mail')

    const app = parseOpenLink('knowme://feishu/auth')
    assert.equal(app?.kind, 'app')
    assert.equal(linkAction('knowme://feishu/auth', 'external').ok, true)
  })

  it('renders Feishu links as a typed resource card', () => {
    assert.match(agent, /function cleanLinkLabel\(/)
    assert.match(agent, /function renderFeishuLinkCard\(/)
    assert.match(agent, /class="feishu-link-kind"/)
    assert.match(agent, /class="feishu-link-open"/)
    assert.match(agent, /data-resource-type=/)
    assert.match(agent, /feishu-chat-open/)
    assert.doesNotMatch(agent, /class="feishu-link-host"/)
    assert.match(html, /\.feishu-link-card \.feishu-link-kind/)
    assert.match(html, /grid-template-columns:40px minmax\(0,1fr\) auto/)
    assert.match(html, /\.feishu-chat-open/)
    assert.doesNotMatch(html, /\.feishu-link-card \.feishu-link-host/)
  })

  it('renders images with loading, ready and error states', () => {
    assert.match(agent, /data-image-state="loading"/)
    assert.match(agent, /data-image-status-text/)
    assert.match(agent, /dataset\.imageState = 'ready'/)
    assert.match(agent, /dataset\.imageState = 'error'/)
    assert.match(html, /\.agent-inline-image-wrap\[data-image-state="ready"\]/)
    assert.match(html, /\.agent-inline-image-wrap\[data-image-state="error"\]/)
  })

  it('parses Markdown links whose labels contain nested brackets', () => {
    const src = '见 [[架构组][AI-系统工程]权威RAG知识库使用](https://forever9.feishu.cn/wiki/abc) 与普通文本'
    const matches = findMarkdownLinks(src)
    assert.equal(matches.length, 1)
    assert.equal(matches[0].label, '[架构组][AI-系统工程]权威RAG知识库使用')
    assert.equal(matches[0].href, 'https://forever9.feishu.cn/wiki/abc')
    const rewritten = rewriteMarkdownLinks(src, (label, href) => `<L>${label}|${href}</L>`)
    assert.equal(
      rewritten,
      '见 <L>[架构组][AI-系统工程]权威RAG知识库使用|https://forever9.feishu.cn/wiki/abc</L> 与普通文本',
    )
  })

  it('opens Feishu links externally on left click and keeps surface-link review visible', () => {
    assert.match(agent, /parsed\?\.isFeishu \? 'external' : 'smart'/)
    assert.match(agent, /result\.protocol === 'knowme:'/)
    assert.match(agent, /openSettings\?\.\('connectors'\)/)
    assert.match(html, /\.pane-wrap\.surface-link \.work-review \{ display:flex; \}/)
    assert.match(html, /\.pane-wrap\.surface-link \.panes \{ display:none; \}/)
  })
})
