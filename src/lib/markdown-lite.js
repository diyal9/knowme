'use strict'

/**
 * 轻量 Markdown 渲染器（AI 对话气泡专用）。
 *
 * 安全模型：先整体转义，再套用格式标记。任何进入 HTML 属性的值都必须走
 * escapeHtml（覆盖引号），否则 LLM 返回的内容可以逃逸属性。
 *
 * 不用 marked 是因为对话流式渲染每个 token 都会重渲染一次，需要极低开销；
 * marked + DOMPurify 保留给「文档正文预览」这种一次性渲染的场景。
 *
 * 行内渲染可替换：workspace-agent 需要把飞书链接渲染成卡片，通过 inline 选项注入。
 *
 * 与 ui-kit.js 同理，整个模块包在 IIFE 里，不向同页脚本的顶层作用域泄露任何名字。
 */

;(function () {
  const uiKit = (typeof module === 'object' && module.exports)
    ? require('./ui-kit.js')
    : (typeof window !== 'undefined' ? window.UIKit : null)

  const escapeHtml = uiKit
    ? uiKit.escapeHtml
    : s => String(s ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[ch]))

  const IMAGE_RE = /!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/gi
  const LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/gi

  function defaultRenderLink(label, href) {
    return `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer noopener">${escapeHtml(label)}</a>`
  }

  function defaultRenderImage(alt, href) {
    const safeAlt = escapeHtml(alt || '图片')
    const safeHref = escapeHtml(href)
    return `<figure class="chat-inline-image-wrap"><img class="chat-inline-image" src="${safeHref}" alt="${safeAlt}" data-zoom-src="${safeHref}" data-zoom-alt="${safeAlt}" loading="lazy"></figure>`
  }

  /**
   * 行内格式：`code` / **bold** / *italic* / [链接] / ![图片]
   *
   * 链接和图片必须在整体转义之前抽成占位符：否则 URL 里的 `&` 会先变成 `&amp;`，
   * 渲染时再转一次变成 `&amp;amp;`，浏览器解析出的地址就带上了字面量 `&amp;`，
   * 于是所有带查询参数的链接（飞书文档、搜索结果）都会跳错。
   */
  function renderInline(text, options = {}) {
    const {
      links = true,
      images = true,
      renderLink = defaultRenderLink,
      renderImage = defaultRenderImage,
    } = options

    const tokens = []
    const stash = render => `\u0000MDLITE${tokens.push(render) - 1}\u0000`

    let source = String(text ?? '')
    if (images) {
      source = source.replace(IMAGE_RE, (_m, alt, href) =>
        stash(() => renderImage(String(alt || ''), String(href || ''))))
    }
    if (links) {
      source = source.replace(LINK_RE, (_m, label, href) =>
        stash(() => renderLink(String(label || ''), String(href || ''))))
    }

    const html = escapeHtml(source)
      .replace(/`([^`]+?)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>')

    if (!tokens.length) return html
    return html.replace(/\u0000MDLITE(\d+)\u0000/g, (_m, idx) => tokens[Number(idx)]())
  }

  /**
   * 块级结构：标题 / 有序与无序列表 / 围栏代码块 / 段落。
   *
   * @param {string} src
   * @param {{ inline?: (text: string) => string }} [options] inline 可替换整套行内渲染
   */
  function render(src, options = {}) {
    const inline = options.inline || (text => renderInline(text, options))
    const lines = String(src ?? '').replace(/\r\n/g, '\n').split('\n')
    const out = []
    let list = null
    let inCode = false
    let codeBuf = []

    const closeList = () => { if (list) { out.push(`</${list}>`); list = null } }

    for (const line of lines) {
      if (/^\s*```/.test(line)) {
        if (inCode) {
          out.push(`<pre><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`)
          codeBuf = []
          inCode = false
        } else {
          closeList()
          inCode = true
        }
        continue
      }
      if (inCode) { codeBuf.push(line); continue }
      if (!line.trim()) { closeList(); continue }

      const heading = line.match(/^(#{1,4})\s+(.*)$/)
      if (heading) {
        closeList()
        const level = heading[1].length
        out.push(`<h${level} class="md-h">${inline(heading[2])}</h${level}>`)
        continue
      }

      const ordered = line.match(/^\s*\d+[.)]\s+(.*)$/)
      if (ordered) {
        if (list !== 'ol') { closeList(); out.push('<ol>'); list = 'ol' }
        out.push(`<li>${inline(ordered[1])}</li>`)
        continue
      }

      const unordered = line.match(/^\s*[-*+]\s+(.*)$/)
      if (unordered) {
        if (list !== 'ul') { closeList(); out.push('<ul>'); list = 'ul' }
        out.push(`<li>${inline(unordered[1])}</li>`)
        continue
      }

      closeList()
      out.push(`<p>${inline(line)}</p>`)
    }

    if (inCode) out.push(`<pre><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`)
    closeList()
    return out.join('')
  }

  const markdownLite = {
    render,
    renderInline,
    defaultRenderLink,
    defaultRenderImage,
  }

  if (typeof module === 'object' && module.exports) module.exports = markdownLite
  if (typeof window !== 'undefined') window.MarkdownLite = markdownLite
})()
