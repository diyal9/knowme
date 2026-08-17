'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')

const { escapeHtml, relativeTime, relativeTimeCompact, formatDateTime, createToast } =
  require('../src/lib/ui-kit.ts')

describe('ui-kit escapeHtml', () => {
  it('escapes every character that can break out of markup', () => {
    assert.strictEqual(escapeHtml('<b>&"\''), '&lt;b&gt;&amp;&quot;&#39;')
  })

  it('escapes quotes so attribute contexts stay safe', () => {
    const href = 'https://evil.test/a" onmouseover="alert(1)'
    const html = `<a href="${escapeHtml(href)}">x</a>`
    assert.ok(!/onmouseover=/.test(html.replace(/&quot;/g, '')) || !html.includes('" onmouseover="'))
    assert.ok(html.includes('&quot;'))
  })

  it('never throws on non-string input', () => {
    assert.strictEqual(escapeHtml(null), '')
    assert.strictEqual(escapeHtml(undefined), '')
    assert.strictEqual(escapeHtml(0), '0')
    assert.strictEqual(escapeHtml(false), 'false')
  })

  it('keeps a plain string untouched', () => {
    assert.strictEqual(escapeHtml('普通文本 text'), '普通文本 text')
  })
})

describe('ui-kit time formatting', () => {
  it('renders conversational relative time', () => {
    const now = Date.now()
    assert.strictEqual(relativeTime(new Date(now - 10e3).toISOString()), '刚刚')
    assert.strictEqual(relativeTime(new Date(now - 5 * 60e3).toISOString()), '5 分钟前')
    assert.strictEqual(relativeTime(new Date(now - 3 * 3600e3).toISOString()), '3 小时前')
    assert.strictEqual(relativeTime(new Date(now - 30 * 3600e3).toISOString()), '昨天')
    assert.strictEqual(relativeTime(new Date(now - 3 * 86400e3).toISOString()), '3 天前')
  })

  it('renders compact relative time', () => {
    const now = Date.now()
    assert.strictEqual(relativeTimeCompact(new Date(now - 1e3).toISOString()), '刚刚')
    assert.strictEqual(relativeTimeCompact(new Date(now - 30e3).toISOString()), '30s 前')
    assert.strictEqual(relativeTimeCompact(new Date(now - 5 * 60e3).toISOString()), '5m 前')
    assert.strictEqual(relativeTimeCompact(new Date(now - 3 * 3600e3).toISOString()), '3h 前')
    assert.strictEqual(relativeTimeCompact(new Date(now - 3 * 86400e3).toISOString()), '3d 前')
  })

  it('degrades gracefully on empty or invalid input', () => {
    assert.strictEqual(relativeTime(''), '')
    assert.strictEqual(relativeTime('not-a-date'), '')
    assert.strictEqual(relativeTimeCompact(''), '—')
    assert.strictEqual(relativeTimeCompact('', '暂无'), '暂无')
    assert.strictEqual(relativeTimeCompact('not-a-date'), '—')
    assert.strictEqual(formatDateTime(''), '')
  })
})

describe('ui-kit createToast', () => {
  function fakeEl() {
    return { textContent: '', className: '' }
  }

  it('shows the message and applies the type modifier', () => {
    const wrap = fakeEl()
    const text = fakeEl()
    const toast = createToast({ wrap, text, defaultMs: 1000 })

    toast('已保存', 'success')
    assert.strictEqual(text.textContent, '已保存')
    assert.strictEqual(wrap.className, 'toast-wrap show success')

    toast('出错了', 'error')
    assert.strictEqual(wrap.className, 'toast-wrap show error')

    toast('提示')
    assert.strictEqual(wrap.className, 'toast-wrap show')
  })

  it('resolves lazy element refs so it works before DOM is ready', () => {
    let wrap = null
    const text = fakeEl()
    const toast = createToast({ wrap: () => wrap, text })

    toast('还没准备好')
    assert.strictEqual(text.textContent, '')

    wrap = fakeEl()
    toast('现在好了')
    assert.strictEqual(text.textContent, '现在好了')
  })

  it('hides after the timeout and a later toast resets the timer', async () => {
    const wrap = fakeEl()
    const text = fakeEl()
    const toast = createToast({ wrap, text, defaultMs: 20 })

    toast('第一条')
    await new Promise(r => setTimeout(r, 10))
    toast('第二条')
    await new Promise(r => setTimeout(r, 15))
    assert.strictEqual(wrap.className, 'toast-wrap show', '重置后不应提前消失')

    await new Promise(r => setTimeout(r, 20))
    assert.strictEqual(wrap.className, 'toast-wrap')
  })
})
