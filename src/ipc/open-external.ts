'use strict'

const { spawn } = require('child_process')
const { fileURLToPath } = require('url')
const feishuLink = require('../lib/feishu-link')
const webFetch = require('../lib/web-fetch')
const { executeFeishuRead, parseCliJsonOutput } = require('../lib/connectors/feishu-cli/core')

const schemeHandlerProbes = new Map()

const FEISHU_TITLE_SCRIPT = String.raw`(() => {
  const generic = /^(?:飞书|飞书云文档|飞书文档|飞书知识库|知识库|Feishu|Lark|分享|加载中|Loading)$/i;
  const read = (node) => String(node?.value || node?.getAttribute?.('value') || node?.textContent || '').replace(/\s+/g, ' ').trim();
  const usable = (value) => value && value.length <= 120 && !generic.test(value);
  const visible = (node) => {
    const rect = node?.getBoundingClientRect?.();
    return rect && rect.width > 20 && rect.height > 8;
  };
  const selectors = [
    '[data-testid="document-title"]', '[data-testid="doc-title"]', '[data-testid="wiki-title"]',
    '[data-qa="document-title"]', '[data-qa="doc-title"]', 'input[class*="title"]',
    '[class*="title"] input', '[contenteditable="true"][class*="title"]',
    '[class*="title"][contenteditable="true"]', '[class*="title"][role="textbox"]'
  ];
  for (const selector of selectors) {
    for (const node of document.querySelectorAll(selector)) {
      const value = read(node);
      if (visible(node) && usable(value)) return value;
    }
  }
  for (const selector of ['meta[property="og:title"]', 'meta[name="twitter:title"]', 'meta[name="title"]']) {
    const value = String(document.querySelector(selector)?.getAttribute('content') || '').trim();
    if (usable(value)) return value;
  }
  return document.title || '';
})()`

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function decodeXmlText(value) {
  return String(value || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

function normalizeLinkTitle(value) {
  const title = decodeXmlText(value)
    .replace(/\s*[-|·]\s*(?:飞书(?:云文档|知识库)?|Feishu(?: Docs)?|Lark(?: Docs)?)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!title || /^https?:\/\//i.test(title)) return ''
  if (/^(?:飞书|飞书云文档|飞书文档|飞书知识库|知识库|未命名文档|无标题|Feishu|Lark|加载中|Loading)$/i.test(title)) return ''
  return title.slice(0, 120)
}

function titleFromCliResult(text, kind) {
  const payload = parseCliJsonOutput(text)
  if (!payload || typeof payload !== 'object') return ''
  const data = payload.data && typeof payload.data === 'object' ? payload.data : payload
  if (kind === 'wiki') {
    const node = data.node && typeof data.node === 'object' ? data.node : data
    return normalizeLinkTitle(node.title)
  }
  const document = data.document && typeof data.document === 'object' ? data.document : data
  const direct = normalizeLinkTitle(document.title)
  if (direct) return direct
  const match = String(document.content || '').match(/<title(?:\s[^>]*)?>([\s\S]*?)<\/title>/i)
  return normalizeLinkTitle(match?.[1] || '')
}

async function resolveFeishuCliTitle(url, options = {}) {
  const parsed = feishuLink.parseOpenLink(url)
  if (!parsed?.isFeishu) return { ok: false, message: '不是飞书链接' }
  const executeRead = options.executeRead || executeFeishuRead
  const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : 6000
  const isWiki = /\/wiki\//i.test(parsed.path || '')
  const attempts = isWiki
    ? [
        ['feishu.get_wiki_node', { url: parsed.href }, 'wiki'],
        ['feishu.read_doc', { url: parsed.href }, 'doc'],
      ]
    : [['feishu.read_doc', { url: parsed.href }, 'doc']]
  let message = '飞书文档没有可用标题'
  for (const [toolName, args, kind] of attempts) {
    const result = await executeRead(toolName, args, { timeoutMs, retries: 0 })
    if (!result?.ok) {
      message = String(result?.message || message)
      continue
    }
    const title = titleFromCliResult(result.text, kind)
    if (title) return { ok: true, title, finalUrl: parsed.href, via: 'lark-cli' }
  }
  return { ok: false, message }
}

/**
 * Read the title from the rendered page, not the initial HTML response.
 * Feishu document pages are frequently an SPA and their real title only
 * exists after scripts, redirects and the user's persisted session run.
 */
async function resolveFeishuBrowserTitle(url, options = {}) {
  const BrowserWindow = options.BrowserWindow
  if (typeof BrowserWindow !== 'function') return { ok: false, message: '隐藏浏览器不可用' }
  const parsed = feishuLink.parseOpenLink(url)
  if (!parsed?.isFeishu) return { ok: false, message: '不是飞书链接' }
  const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : 10000
  let win
  try {
    win = new BrowserWindow({
      show: false,
      width: 1,
      height: 1,
      webPreferences: {
        partition: 'persist:knowme-preview',
        contextIsolation: true,
        sandbox: true,
      },
    })
    await Promise.race([
      win.loadURL(parsed.href),
      delay(timeoutMs).then(() => { throw new Error('hidden browser timeout') }),
    ])
    const deadline = Date.now() + timeoutMs
    for (const waitMs of [0, 300, 800, 1600, 3000]) {
      if (waitMs) await delay(waitMs)
      if (Date.now() > deadline) break
      const title = normalizeLinkTitle(await win.webContents.executeJavaScript(FEISHU_TITLE_SCRIPT, true))
      if (title) return { ok: true, title, finalUrl: win.webContents.getURL?.() || parsed.href, via: 'hidden-browser' }
    }
    return { ok: false, message: '渲染页面没有可用标题' }
  } catch (err) {
    return { ok: false, message: String(err?.message || '隐藏浏览器读取失败') }
  } finally {
    try { if (win && !win.isDestroyed()) win.destroy() } catch { /* ignore cleanup errors */ }
  }
}

/**
 * Only hand a URL to a client scheme when the OS has a registered handler;
 * otherwise Windows shows a "no app" dialog instead of opening anything.
 */
function hasSchemeHandler(scheme) {
  if (process.platform !== 'win32') return Promise.resolve(false)
  if (schemeHandlerProbes.has(scheme)) return schemeHandlerProbes.get(scheme)
  const probe = new Promise(resolve => {
    let child
    try {
      child = spawn('reg', ['query', `HKEY_CLASSES_ROOT\\${scheme}\\shell\\open\\command`, '/ve'], {
        windowsHide: true,
      })
    } catch {
      resolve(false)
      return
    }
    const timer = setTimeout(() => {
      try { child.kill() } catch { /* ignore */ }
      resolve(false)
    }, 2000)
    child.on('error', () => { clearTimeout(timer); resolve(false) })
    child.on('close', code => { clearTimeout(timer); resolve(code === 0) })
  })
  schemeHandlerProbes.set(scheme, probe)
  return probe
}

/**
 * @param {import('electron').IpcMain} ipcMain
 * @param {{ shell: import('electron').Shell }} deps
 */
function registerOpenExternalIpc(ipcMain, deps) {
  const { shell, BrowserWindow } = deps

  ipcMain.handle('open-external', async (_e, url) => {
    const raw = String(url || '').trim()
    let parsed
    try { parsed = new URL(raw) } catch { return { ok: false, message: '无效链接' } }
    if (parsed.protocol === 'file:') {
      let filePath = ''
      try { filePath = fileURLToPath(raw) } catch { return { ok: false, message: '无效本地路径' } }
      try {
        const err = await shell.openPath(filePath)
        return err ? { ok: false, message: err || '无法打开本地文件' } : { ok: true, viaPath: true }
      } catch (err) {
        return { ok: false, message: err.message || '无法打开本地文件' }
      }
    }
    const allowed = new Set(['http:', 'https:', 'mailto:'])
    if (!allowed.has(parsed.protocol)) return { ok: false, message: '不允许的协议' }
    // An AppLink https page exists only to hand off to the desktop client, so the
    // browser tab is a visible detour. Go straight to the client when it is installed.
    const clientUrl = feishuLink.buildFeishuClientUrl(raw)
    if (clientUrl && await hasSchemeHandler(clientUrl.slice(0, clientUrl.indexOf(':')))) {
      try {
        await shell.openExternal(clientUrl)
        return { ok: true, viaClient: true }
      } catch { /* fall back to the https page below */ }
    }
    try {
      await shell.openExternal(raw)
      return { ok: true }
    } catch (err) {
      return { ok: false, message: err.message || '无法打开链接' }
    }
  })

  ipcMain.handle('resolve-link-title', async (_e, url) => {
    const raw = String(url || '').trim()
    if (!/^https?:\/\//i.test(raw)) return { ok: false, message: '仅支持网页链接' }
    const parsed = feishuLink.parseOpenLink(raw)
    if (parsed?.isFeishu) {
      const resolved = await resolveFeishuCliTitle(parsed.href)
      if (resolved.ok) return resolved
      const rendered = await resolveFeishuBrowserTitle(parsed.href, { BrowserWindow })
      if (rendered.ok) return rendered
    }
    const page = await webFetch.fetchReadablePage(raw, { timeoutMs: 8000, maxBytes: 512 * 1024 })
    const title = normalizeLinkTitle(page.title)
    if (!page.ok || !title) {
      return { ok: false, message: page.ok ? '网页没有可用标题' : page.message }
    }
    return { ok: true, title, finalUrl: page.finalUrl }
  })
}

module.exports = {
  registerOpenExternalIpc,
  hasSchemeHandler,
  normalizeLinkTitle,
  titleFromCliResult,
  resolveFeishuCliTitle,
  resolveFeishuBrowserTitle,
}
