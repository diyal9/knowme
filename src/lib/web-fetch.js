'use strict';

/**
 * web-fetch — 受限网页抓取：URL 安全校验（SSRF）、限时限量读取、正文提取。
 *
 * 同时服务两条路径：Agent 的 fetch_web_page 工具与「设置 → 内容源 → 添加网页资料」。
 * 两者共用同一份校验，避免其中一条留下未加固的出口。
 */

const dns = require('dns').promises;
const net = require('net');

const DEFAULT_TIMEOUT_MS = 15000;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const MAX_TEXT_CHARS = 120000;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) KnowMe/0.3 Safari/537.36';

const TEXT_CONTENT_TYPES = [
  'text/html',
  'text/plain',
  'text/markdown',
  'application/xhtml+xml',
  'application/json',
  'application/xml',
  'text/xml',
];

const ERROR_MESSAGES = {
  invalid_url: '链接格式无法解析，请检查是否为完整地址。',
  unsupported_scheme: '仅支持 http/https 链接。',
  blocked_target: '出于安全考虑，不能访问本机或内网地址。',
  too_many_redirects: '该链接重定向次数过多，已中止。',
  timeout: '网页响应超时，站点可能较慢或不可达。',
  network_error: '网络不可达，未能连接到该站点。',
  unsupported_content_type: '该链接不是网页或文本内容，暂不支持读取。',
  http_error: '目标站点返回了错误状态。',
  empty_body: '该网页没有可提取的正文内容。',
};

function fail(code, message) {
  return { ok: false, code, message: message || ERROR_MESSAGES[code] || '网页读取失败。' };
}

/* ---------------------------------------------------------------- IP 判定 */

function ipv4ToInt(ip) {
  const parts = String(ip).split('.');
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    value = (value * 256) + n;
  }
  return value;
}

/** 禁止网段：环回、私有、链路本地、CGNAT、保留、组播。 */
const BLOCKED_V4 = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
].map(([base, bits]) => ({
  base: ipv4ToInt(base),
  mask: bits === 0 ? 0 : (0xFFFFFFFF << (32 - bits)) >>> 0,
}));

function isBlockedIPv4(ip) {
  const value = ipv4ToInt(ip);
  if (value === null) return true;
  return BLOCKED_V4.some(({ base, mask }) => ((value & mask) >>> 0) === ((base & mask) >>> 0));
}

/** 展开 IPv6（含 :: 压缩与内嵌 IPv4）为 16 字节；非法返回 null。 */
function parseIPv6(input) {
  let text = String(input || '').trim();
  if (text.startsWith('[') && text.endsWith(']')) text = text.slice(1, -1);
  const zoneAt = text.indexOf('%');
  if (zoneAt >= 0) text = text.slice(0, zoneAt);
  if (!text.includes(':')) return null;

  let tail4 = null;
  const lastColon = text.lastIndexOf(':');
  const trailing = text.slice(lastColon + 1);
  if (trailing.includes('.')) {
    const value = ipv4ToInt(trailing);
    if (value === null) return null;
    tail4 = [(value >>> 24) & 0xFF, (value >>> 16) & 0xFF, (value >>> 8) & 0xFF, value & 0xFF];
    text = text.slice(0, lastColon + 1) + '0:0';
  }

  const halves = text.split('::');
  if (halves.length > 2) return null;
  const toGroups = (part) => (part ? part.split(':').filter(s => s !== '') : []);
  const head = toGroups(halves[0]);
  const tail = halves.length === 2 ? toGroups(halves[1]) : [];
  const total = head.length + tail.length;
  if (total > 8 || (halves.length === 1 && total !== 8)) return null;

  const groups = halves.length === 2
    ? [...head, ...new Array(8 - total).fill('0'), ...tail]
    : head;

  const bytes = new Uint8Array(16);
  for (let i = 0; i < 8; i += 1) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(groups[i])) return null;
    const group = parseInt(groups[i], 16);
    bytes[i * 2] = (group >> 8) & 0xFF;
    bytes[(i * 2) + 1] = group & 0xFF;
  }
  if (tail4) {
    bytes[12] = tail4[0];
    bytes[13] = tail4[1];
    bytes[14] = tail4[2];
    bytes[15] = tail4[3];
  }
  return bytes;
}

function isBlockedIPv6(ip) {
  const bytes = parseIPv6(ip);
  if (!bytes) return true;

  const leadingZero = bytes.slice(0, 10).every(b => b === 0);
  // ::ffff:a.b.c.d（映射）与 ::a.b.c.d（兼容）都要按 IPv4 再判一次
  if (leadingZero && bytes[10] === 0xFF && bytes[11] === 0xFF) {
    return isBlockedIPv4(`${bytes[12]}.${bytes[13]}.${bytes[14]}.${bytes[15]}`);
  }
  if (bytes.slice(0, 12).every(b => b === 0)) return true;

  if (bytes.every(b => b === 0)) return true;
  if ((bytes[0] & 0xFE) === 0xFC) return true;
  if (bytes[0] === 0xFE && (bytes[1] & 0xC0) === 0x80) return true;
  if (bytes[0] === 0xFF) return true;
  return false;
}

function isBlockedAddress(ip) {
  const family = net.isIP(ip);
  if (family === 4) return isBlockedIPv4(ip);
  if (family === 6) return isBlockedIPv6(ip);
  return true;
}

/* ------------------------------------------------------------ URL 安全校验 */

/**
 * 校验目标地址是否可安全抓取。
 *
 * 主机名会经 DNS 解析后逐个地址判定，不能只看字符串前缀——否则
 * 一个指向 127.0.0.1 的公网域名就能绕过。
 *
 * 已知残余风险：DNS rebinding（校验与真正连接之间解析结果变化）。
 * Node 的 fetch 不暴露「按已解析 IP 连接」的钩子，彻底封堵需要自定义
 * undici dispatcher；当前攻击面仅限用户主动粘贴的恶意链接，暂接受。
 */
async function assertSafeUrl(rawUrl, deps = {}) {
  const lookup = typeof deps.lookup === 'function' ? deps.lookup : dns.lookup;
  const text = String(rawUrl || '').trim();
  if (!text) return fail('invalid_url', '链接为空。');

  let url;
  try {
    url = new URL(text);
  } catch {
    return fail('invalid_url');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return fail('unsupported_scheme', `仅支持 http/https 链接，当前为 ${url.protocol.replace(':', '')}。`);
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (!hostname) return fail('invalid_url', '链接缺少主机名。');

  if (net.isIP(hostname)) {
    if (isBlockedAddress(hostname)) {
      return fail('blocked_target', `出于安全考虑，不能访问本机或内网地址（${hostname}）。`);
    }
    return { ok: true, url };
  }

  if (/^localhost$/i.test(hostname) || /\.localhost$/i.test(hostname)) {
    return fail('blocked_target', '出于安全考虑，不能访问 localhost。');
  }

  let records;
  try {
    records = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    return fail('network_error', `无法解析域名 ${hostname}。`);
  }
  const addresses = (Array.isArray(records) ? records : [records]).filter(Boolean);
  if (addresses.length === 0) return fail('network_error', `无法解析域名 ${hostname}。`);
  for (const record of addresses) {
    if (isBlockedAddress(String(record.address || ''))) {
      return fail('blocked_target', `该域名解析到本机或内网地址，已拦截（${hostname}）。`);
    }
  }
  return { ok: true, url };
}

/* -------------------------------------------------------------- 正文提取 */

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

/* ------------------------------------------------------------------ 抓取 */

function combineSignals(signals) {
  const list = signals.filter(Boolean);
  if (list.length === 1) return list[0];
  if (typeof AbortSignal.any === 'function') return AbortSignal.any(list);
  return list[0];
}

function parseContentType(header) {
  const raw = String(header || '').trim();
  const [mime, ...params] = raw.split(';');
  const charsetParam = params.map(p => p.trim()).find(p => /^charset=/i.test(p));
  return {
    mime: mime.trim().toLowerCase(),
    charset: charsetParam ? charsetParam.split('=')[1].replace(/["']/g, '').trim().toLowerCase() : '',
  };
}

async function readBodyLimited(response, maxBytes) {
  if (!response.body) return { bytes: new Uint8Array(0), truncated: false };
  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    if (received + value.byteLength > maxBytes) {
      chunks.push(value.subarray(0, maxBytes - received));
      received = maxBytes;
      truncated = true;
      try { await reader.cancel(); } catch { /* ignore */ }
      break;
    }
    chunks.push(value);
    received += value.byteLength;
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { bytes, truncated };
}

function decodeBody(bytes, charset) {
  const encoding = charset && charset !== 'utf8' ? charset : 'utf-8';
  try {
    return new TextDecoder(encoding, { fatal: false }).decode(bytes);
  } catch {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  }
}

/**
 * 抓取一个公开网页并返回可读正文。
 *
 * @param {string} rawUrl
 * @param {{ timeoutMs?: number, maxBytes?: number, maxRedirects?: number,
 *           signal?: AbortSignal, fetchImpl?: Function, lookup?: Function }} [options]
 * @returns {Promise<{ ok: true, title: string, finalUrl: string, text: string,
 *                     truncated: boolean, contentType: string, bytes: number }
 *                  | { ok: false, code: string, message: string }>}
 */
async function fetchReadablePage(rawUrl, options = {}) {
  const timeoutMs = Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
    ? options.timeoutMs
    : DEFAULT_TIMEOUT_MS;
  const maxBytes = Number.isFinite(options.maxBytes) && options.maxBytes > 0 ? options.maxBytes : MAX_BYTES;
  const maxRedirects = Number.isFinite(options.maxRedirects) && options.maxRedirects >= 0
    ? options.maxRedirects
    : MAX_REDIRECTS;
  const doFetch = typeof options.fetchImpl === 'function' ? options.fetchImpl : fetch;
  const deadline = Date.now() + timeoutMs;

  let target = String(rawUrl || '').trim();
  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const safe = await assertSafeUrl(target, { lookup: options.lookup });
    if (!safe.ok) return safe;

    const remaining = deadline - Date.now();
    if (remaining <= 0) return fail('timeout');

    let response;
    try {
      response = await doFetch(safe.url.href, {
        method: 'GET',
        redirect: 'manual',
        signal: combineSignals([AbortSignal.timeout(remaining), options.signal]),
        headers: {
          'user-agent': USER_AGENT,
          accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5',
          'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
        },
      });
    } catch (err) {
      const name = String(err?.name || '');
      if (name === 'TimeoutError' || name === 'AbortError') return fail('timeout');
      return fail('network_error', `无法连接到 ${safe.url.hostname}：${String(err?.message || err).slice(0, 200)}`);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      try { await response.body?.cancel(); } catch { /* ignore */ }
      if (!location) {
        return fail('http_error', `目标站点返回 ${response.status} 但未给出跳转地址。`);
      }
      try {
        target = new URL(location, safe.url).href;
      } catch {
        return fail('invalid_url', `跳转地址无法解析：${String(location).slice(0, 200)}`);
      }
      continue;
    }

    if (!response.ok) {
      try { await response.body?.cancel(); } catch { /* ignore */ }
      return fail('http_error', `目标站点返回 HTTP ${response.status}，页面可能已删除或地址有误。`);
    }

    const { mime, charset } = parseContentType(response.headers.get('content-type'));
    if (mime && !TEXT_CONTENT_TYPES.includes(mime)) {
      try { await response.body?.cancel(); } catch { /* ignore */ }
      return fail('unsupported_content_type', `该链接返回的是 ${mime}，暂不支持读取（仅支持网页与纯文本）。`);
    }

    const { bytes, truncated } = await readBodyLimited(response, maxBytes);
    const body = decodeBody(bytes, charset);
    const isHtml = !mime || mime === 'text/html' || mime === 'application/xhtml+xml';
    const extracted = isHtml ? extractReadableText(body) : body.trim();
    const clipped = extracted.length > MAX_TEXT_CHARS;
    const text = clipped ? extracted.slice(0, MAX_TEXT_CHARS) : extracted;
    const finalUrl = safe.url.href;

    if (!text) return fail('empty_body');

    return {
      ok: true,
      title: isHtml ? extractTitle(body, finalUrl) : finalUrl,
      finalUrl,
      text,
      truncated: truncated || clipped,
      contentType: mime || 'text/html',
      bytes: bytes.byteLength,
    };
  }

  return fail('too_many_redirects');
}

module.exports = {
  DEFAULT_TIMEOUT_MS,
  MAX_BYTES,
  MAX_REDIRECTS,
  MAX_TEXT_CHARS,
  TEXT_CONTENT_TYPES,
  ERROR_MESSAGES,
  isBlockedAddress,
  parseIPv6,
  assertSafeUrl,
  extractReadableText,
  extractTitle,
  fetchReadablePage,
};
