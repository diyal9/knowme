'use strict';

/**
 * web-fetch — 受限网页抓取：URL 安全校验（SSRF）、限时限量读取、正文提取。
 *
 * 同时服务两条路径：Agent 的 fetch_web_page 工具与「设置 → 内容源 → 添加网页资料」。
 * 两者共用同一份校验，避免其中一条留下未加固的出口。
 */

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

const {
  ERROR_MESSAGES,
  fail,
  isBlockedAddress,
  parseIPv6,
  assertSafeUrl,
} = require('./web-fetch-ssrf');
const { extractReadableText, extractTitle } = require('./web-fetch-html');

/** GitHub 的 blob 页面依赖前端渲染，抓取 HTML 只能得到登录提示和导航壳。
 * 对仓库中的文本/Markdown 文件优先切到 raw 地址，拿到真实文件正文。 */
function preferredFetchUrl(rawUrl) {
  const input = String(rawUrl || '').trim();
  try {
    const url = new URL(input);
    if (url.hostname.toLowerCase() !== 'github.com') return input;
    const parts = url.pathname.split('/').filter(Boolean);
    const blobIndex = parts.indexOf('blob');
    if (parts.length < 5 || blobIndex !== 2) return input;
    const owner = parts[0];
    const repo = parts[1];
    const ref = parts[blobIndex + 1];
    const filePath = parts.slice(blobIndex + 2).join('/');
    if (!owner || !repo || !ref || !filePath) return input;
    return `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${filePath}`;
  } catch {
    return input;
  }
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

  let target = preferredFetchUrl(rawUrl);
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
  preferredFetchUrl,
  extractReadableText,
  extractTitle,
  fetchReadablePage,
};
