'use strict'

const BLOCK_ELEMENTS = ['script', 'style', 'noscript', 'iframe', 'svg', 'canvas', 'nav', 'header', 'footer', 'aside', 'form', 'template'];

function codePointOrSpace(code) {
  return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : ' ';
}

function decodeEntities(text) {
  return String(text || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/g, '\'')
    .replace(/&apos;/gi, '\'')
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => codePointOrSpace(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_m, dec) => codePointOrSpace(Number(dec)))
    .replace(/&amp;/gi, '&');
}

/**
 * 从 HTML 提取可读正文。保留标题层级与列表结构，剔除导航类噪声。
 *
 * 正则方案在恶意嵌套 HTML 上不完美，但目标是给 LLM 消化公开文章，
 * 少量残留噪声可接受；引入 jsdom/readability 的体积代价不成比例。
 */
function extractReadableText(html) {
  let text = String(html || '');
  text = text.replace(/<!--[\s\S]*?-->/g, ' ');
  for (const tag of BLOCK_ELEMENTS) {
    text = text.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi'), ' ');
    text = text.replace(new RegExp(`<${tag}\\b[^>]*\\/>`, 'gi'), ' ');
  }
  text = text
    .replace(/<h([1-6])\b[^>]*>/gi, (_m, level) => `\n\n${'#'.repeat(Number(level))} `)
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<\/li>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|section|article|tr|blockquote|pre|ul|ol|table)>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ');
  return decodeEntities(text)
    .replace(/\r/g, '')
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractTitle(html, fallbackUrl) {
  const match = String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = match ? decodeEntities(match[1]).replace(/\s+/g, ' ').trim() : '';
  return title || String(fallbackUrl || '网页资料');
}

module.exports = {
  extractReadableText,
  extractTitle,
  decodeEntities,
}
