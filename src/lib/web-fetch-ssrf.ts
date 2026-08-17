'use strict'

const dns = require('dns').promises
const net = require('net')

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

module.exports = {
  ERROR_MESSAGES,
  fail,
  ipv4ToInt,
  isBlockedIPv4,
  parseIPv6,
  isBlockedIPv6,
  isBlockedAddress,
  assertSafeUrl,
}
