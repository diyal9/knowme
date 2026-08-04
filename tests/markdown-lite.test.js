'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')

const { render, renderInline } = require('../src/lib/markdown-lite.js')

describe('markdown-lite block rendering', () => {
  it('renders headings, lists, code fences and paragraphs', () => {
    const html = render([
      '# 标题',
      '',
      '- 项目一',
      '- 项目二',
      '',
      '1. 第一',
      '2. 第二',
      '',
      '```',
      'const x = 1',
      '```',
      '',
      '正文段落',
    ].join('\n'))

    assert.match(html, /<h1 class="md-h">标题<\/h1>/)
    assert.match(html, /<ul><li>项目一<\/li><li>项目二<\/li><\/ul>/)
    assert.match(html, /<ol><li>第一<\/li><li>第二<\/li><\/ol>/)
    assert.match(html, /<pre><code>const x = 1<\/code><\/pre>/)
    assert.match(html, /<p>正文段落<\/p>/)
  })

  it('escapes html inside code fences', () => {
    const html = render('```\n<script>alert(1)</script>\n```')
    assert.ok(!html.includes('<script>'))
    assert.match(html, /&lt;script&gt;/)
  })

  it('closes an unterminated code fence', () => {
    const html = render('```\nstill open')
    assert.match(html, /<pre><code>still open<\/code><\/pre>/)
  })

  it('tolerates empty and non-string input', () => {
    assert.strictEqual(render(''), '')
    assert.strictEqual(render(null), '')
    assert.strictEqual(render(undefined), '')
  })
})

describe('markdown-lite inline rendering', () => {
  it('renders code, bold and italic', () => {
    assert.match(renderInline('`code`'), /<code>code<\/code>/)
    assert.match(renderInline('**粗体**'), /<strong>粗体<\/strong>/)
    assert.match(renderInline('这是 *斜体* 文本'), /<em>斜体<\/em>/)
  })

  it('renders links with safe rel attributes', () => {
    const html = renderInline('[文档](https://example.test/doc)')
    assert.match(html, /<a href="https:\/\/example\.test\/doc" target="_blank" rel="noreferrer noopener">文档<\/a>/)
  })

  it('renders images as zoomable figures', () => {
    const html = renderInline('![截图](https://example.test/a.png)')
    assert.match(html, /<img class="chat-inline-image" src="https:\/\/example\.test\/a\.png"/)
    assert.match(html, /data-zoom-src="https:\/\/example\.test\/a\.png"/)
    assert.match(html, /loading="lazy"/)
  })

  // 回归：链接曾被转义两次，`&` 变成 `&amp;amp;`，带查询参数的地址全部跳错。
  it('keeps query parameters intact instead of double-escaping them', () => {
    const html = renderInline('[报表](https://example.test/r?a=1&b=2&c=3)')
    assert.match(html, /href="https:\/\/example\.test\/r\?a=1&amp;b=2&amp;c=3"/)
    assert.ok(!html.includes('&amp;amp;'), html)
  })

  it('keeps query parameters intact for images too', () => {
    const html = renderInline('![图](https://example.test/i.png?w=1&h=2)')
    assert.match(html, /src="https:\/\/example\.test\/i\.png\?w=1&amp;h=2"/)
    assert.ok(!html.includes('&amp;amp;'), html)
  })

  it('renders several links in one line independently', () => {
    const html = renderInline('见 [A](https://a.test/?x=1&y=2) 和 [B](https://b.test/?z=3)')
    assert.match(html, /href="https:\/\/a\.test\/\?x=1&amp;y=2"/)
    assert.match(html, /href="https:\/\/b\.test\/\?z=3"/)
  })

  it('can disable links and images', () => {
    const html = renderInline('[文档](https://example.test/doc)', { links: false })
    assert.ok(!html.includes('<a '))
  })

  it('accepts a custom link renderer', () => {
    const html = renderInline('[会话](https://example.test/x)', {
      renderLink: (label, href) => `<span data-href="${href}">${label}</span>`,
    })
    assert.match(html, /<span data-href="https:\/\/example\.test\/x">会话<\/span>/)
  })
})

// LLM 与远端内容会直接进入渲染器，属性逃逸是真实攻击面。
describe('markdown-lite xss regressions', () => {
  it('does not let a link href break out of the attribute', () => {
    const html = renderInline('[点我](https://evil.test/a"onmouseover="alert(1))')
    assert.ok(!/onmouseover="alert/.test(html), html)
    assert.match(html, /&quot;/)
  })

  it('does not let an image alt break out of the attribute', () => {
    const html = renderInline('![x"onerror="alert(1)](https://evil.test/a.png)')
    assert.ok(!/onerror="alert/.test(html), html)
  })

  it('does not let an image src break out of the attribute', () => {
    const html = renderInline('![图](https://evil.test/a.png"onerror="alert(1))')
    assert.ok(!/onerror="alert/.test(html), html)
  })

  it('escapes raw html in plain text', () => {
    const html = render('<img src=x onerror=alert(1)>')
    assert.ok(!html.includes('<img src=x'))
    assert.match(html, /&lt;img/)
  })

  it('escapes single quotes so single-quoted attributes stay safe', () => {
    const html = renderInline("[a](https://evil.test/a'onmouseover='alert(1))")
    assert.ok(!/'onmouseover='/.test(html), html)
  })
})
