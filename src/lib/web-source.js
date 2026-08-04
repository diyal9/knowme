'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const webFetch = require('./web-fetch');

function cacheDir(userData, pageUrl) {
  const clean = String(pageUrl || '').trim();
  const key = crypto.createHash('sha1').update(clean).digest('hex').slice(0, 16);
  return path.join(userData, 'web-sources', key);
}

async function fetchPageSnapshot({ userData, pageUrl, fetchImpl, lookup, timeoutMs } = {}) {
  const page = await webFetch.fetchReadablePage(pageUrl, { fetchImpl, lookup, timeoutMs });
  if (!page.ok) return { ok: false, error: `网页抓取失败：${page.message}` };
  const { title, finalUrl } = page;
  const body = page.text;
  const rootPath = cacheDir(userData, finalUrl);
  fs.mkdirSync(rootPath, { recursive: true });
  const snapshot = `# ${title}\n\n- Source: ${finalUrl}\n- Fetched At: ${new Date().toISOString()}\n\n## Page Content\n\n${body || '网页正文为空或暂不支持提取。'}\n`;
  fs.writeFileSync(path.join(rootPath, 'index.md'), snapshot, 'utf8');
  fs.writeFileSync(path.join(rootPath, 'meta.json'), JSON.stringify({
    pageUrl: finalUrl,
    title,
    fetchedAt: new Date().toISOString(),
  }, null, 2), 'utf8');
  return {
    ok: true,
    rootPath,
    pageUrl: finalUrl,
    title,
  };
}

module.exports = {
  cacheDir,
  fetchPageSnapshot,
};
