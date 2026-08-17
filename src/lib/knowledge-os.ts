'use strict'

/**
 * Knowledge OS — product-side wiki + OKF roots under userData.
 * Cursor-dev brain/ is separate; this is KnowMe runtime knowledge.
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const contextCache = require('./context-cache')
const knowledgeRank = require('./knowledge-rank')
const knowledgeSteward = require('./knowledge-steward')
const llmwikiHarness = require('./llmwiki-harness')

const MAX_INDEX_FILES = 2000
const MAX_QUERY_HITS = 8
const SNIPPET_LEN = 180
const TEXT_EXT = new Set(['.md', '.txt', '.markdown'])

function resolveUnderRoot(rootPath, relPath) {
  const root = path.resolve(rootPath)
  const rel = String(relPath || '').replace(/\\/g, '/').replace(/^\/+/, '')
  if (!rel || rel.includes('\0')) return null
  const parts = rel.split('/').filter(Boolean)
  if (parts.some((p) => p === '..')) return null
  const full = path.resolve(root, ...parts)
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep
  if (full !== root && !full.startsWith(rootWithSep)) return null
  return full
}

function isPathInside(rootPath, targetPath) {
  const root = path.resolve(rootPath)
  const target = path.resolve(targetPath)
  const rel = path.relative(root, target)
  return rel === '' || (rel && rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel))
}

function isAuthorizedInput(absPath, wikiRoot, sources = []) {
  const roots = [wikiRoot, ...(Array.isArray(sources) ? sources : [])
    .filter(source => source && source.type === 'local' && source.rootPath)
    .map(source => source.rootPath)]
  return roots.some(root => isPathInside(root, absPath))
}

function knowledgeOsRoot(userData) {
  return path.join(userData, 'knowledge-os')
}

function defaultPaths(userData) {
  const root = knowledgeOsRoot(userData)
  return {
    root,
    wiki: path.join(root, 'wiki'),
    knowledge: path.join(root, 'knowledge'),
    memory: path.join(root, 'memory'),
    raw: path.join(root, 'raw'),
    indexFile: path.join(root, 'index.json'),
    configFile: path.join(root, 'config.json'),
  }
}

function ensureDirs(userData) {
  const p = defaultPaths(userData)
  for (const key of ['root', 'wiki', 'knowledge', 'memory', 'raw']) {
    fs.mkdirSync(p[key], { recursive: true })
  }
  const root = llmwikiHarness.ensureRoot(p.wiki)
  if (!root.ok) throw new Error(root.error || '根知识库初始化失败')
  const okfIndex = path.join(p.knowledge, 'index.md')
  if (!fs.existsSync(okfIndex)) {
    fs.writeFileSync(
      okfIndex,
      '---\nokf_version: "0.1"\n---\n\n# Knowledge Bundle\n\n',
      'utf8'
    )
    fs.writeFileSync(path.join(p.knowledge, 'log.md'), '# Log\n', 'utf8')
    fs.mkdirSync(path.join(p.knowledge, 'concepts'), { recursive: true })
  }
  return p
}

const DEFAULT_CONFIG = {
  // 本地知识库根绑定：内容源空间 + 其下子目录
  spaceSourceId: null,
  subDir: '',
  // 绝对目录覆盖（逃生舱，优先级最高）
  wikiRootOverride: null,
  // 知识库 provider 列表与活跃项（本地 / 远程 RAG）
  providers: [],
  activeProviderId: null,
}

function loadConfig(userData) {
  const { configFile } = defaultPaths(userData)
  try {
    const raw = JSON.parse(fs.readFileSync(configFile, 'utf8'))
    // 向后兼容旧字段 wikiSourceId → spaceSourceId
    if (raw && raw.wikiSourceId && !raw.spaceSourceId) {
      raw.spaceSourceId = raw.wikiSourceId
    }
    return { ...DEFAULT_CONFIG, ...raw }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

function saveConfig(userData, patch) {
  const p = defaultPaths(userData)
  ensureDirs(userData)
  const next = { ...loadConfig(userData), ...patch }
  fs.writeFileSync(p.configFile, JSON.stringify(next, null, 2), 'utf8')
  return next
}

/**
 * @param {string} userData
 * @param {{ sources?: Array<{id:string,type:string,rootPath:string}> }} [ctx]
 */
function resolveWikiRoot(userData, ctx = {}) {
  ensureDirs(userData)
  const cfg = loadConfig(userData)
  // 1) 绝对覆盖目录（逃生舱）
  if (cfg.wikiRootOverride) {
    try {
      const abs = path.resolve(cfg.wikiRootOverride)
      if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) return abs
    } catch { /* fall through */ }
  }
  // 2) 内容源空间 + 指定子目录（越界防护）
  const spaceId = cfg.spaceSourceId || cfg.wikiSourceId
  if (spaceId && Array.isArray(ctx.sources)) {
    const src = ctx.sources.find((s) => s.id === spaceId)
    if (src?.rootPath && fs.existsSync(src.rootPath)) {
      const base = path.resolve(src.rootPath)
      const sub = String(cfg.subDir || '').trim()
      if (!sub) return base
      const abs = resolveUnderRoot(base, sub)
      if (abs && fs.existsSync(abs) && fs.statSync(abs).isDirectory()) return abs
      // 子目录非法/不存在 → 回退默认，绝不逃逸到源外
    }
  }
  // 3) 应用默认 Wiki 目录
  return defaultPaths(userData).wiki
}

function titleFromContent(content, fallback) {
  const m = String(content || '').match(/^#\s+(.+)$/m)
  if (m) return m[1].trim().slice(0, 120)
  const fm = String(content || '').match(/^title:\s*["']?(.+?)["']?\s*$/m)
  if (fm) return fm[1].trim().slice(0, 120)
  return fallback
}

function walkTextFiles(dir, base = dir, acc = [], depth = 0) {
  if (acc.length >= MAX_INDEX_FILES || depth > 6) return acc
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return acc
  }
  for (const ent of entries) {
    if (acc.length >= MAX_INDEX_FILES) break
    if (ent.name.startsWith('.')) continue
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === '.git') continue
      walkTextFiles(full, base, acc, depth + 1)
    } else if (ent.isFile()) {
      const ext = path.extname(ent.name).toLowerCase()
      if (!TEXT_EXT.has(ext) && ent.name !== 'index.md') continue
      const rel = path.relative(base, full).replace(/\\/g, '/')
      acc.push({ abs: full, rel })
    }
  }
  return acc
}

function buildIndex(wikiRoot) {
  const files = walkTextFiles(wikiRoot)
  const entries = []
  for (const f of files) {
    let content = ''
    try {
      content = fs.readFileSync(f.abs, 'utf8')
    } catch {
      continue
    }
    const title = titleFromContent(content, path.basename(f.rel, path.extname(f.rel)))
    entries.push({
      path: f.rel,
      title,
      chars: content.length,
      updatedAt: (() => {
        try {
          return fs.statSync(f.abs).mtime.toISOString()
        } catch {
          return null
        }
      })(),
    })
  }
  return {
    version: 2,
    wikiRoot: path.resolve(wikiRoot),
    builtAt: new Date().toISOString(),
    entries,
  }
}

function saveIndex(userData, index) {
  const p = defaultPaths(userData)
  ensureDirs(userData)
  fs.writeFileSync(p.indexFile, JSON.stringify(index, null, 2), 'utf8')
  return index
}

function loadOrBuildIndex(userData, wikiRoot) {
  const p = defaultPaths(userData)
  try {
    const raw = JSON.parse(fs.readFileSync(p.indexFile, 'utf8'))
    if (
      Array.isArray(raw?.entries) &&
      raw.wikiRoot &&
      path.resolve(raw.wikiRoot) === path.resolve(wikiRoot)
    ) {
      return raw
    }
  } catch { /* rebuild */ }
  const index = buildIndex(wikiRoot)
  saveIndex(userData, index)
  return index
}

function refreshIndex(userData, ctx = {}) {
  const wikiRoot = resolveWikiRoot(userData, ctx)
  const index = buildIndex(wikiRoot)
  return saveIndex(userData, index)
}

function listEntries(userData, ctx = {}) {
  const wikiRoot = resolveWikiRoot(userData, ctx)
  const index = loadOrBuildIndex(userData, wikiRoot)
  // 单一知识根：概念（okf）为 Wiki 根内 concepts/ 下的条目，不再拼接独立 knowledge 根
  const all = (index.entries || []).map((e) => ({
    kind: e.path.startsWith('concepts/') ? 'okf' : 'wiki',
    editable: e.path.startsWith('raw/'),
    ...e,
  }))
  const wiki = all.filter((e) => e.kind === 'wiki')
  const okf = all.filter((e) => e.kind === 'okf')
  return { wikiRoot, wiki, okf, indexBuiltAt: index.builtAt }
}

function loadQueryDocuments(userData, ctx = {}) {
  const wikiRoot = resolveWikiRoot(userData, ctx)
  // 可选缓存器：ctx.readFile(abs) 优先，否则用模块级 mtime 缓存；异常回退直接读
  const readContent =
    typeof ctx.readFile === 'function'
      ? ctx.readFile
      : (abs) => contextCache.readFileCached(abs)
  const index = loadOrBuildIndex(userData, wikiRoot)
  const docs = []
  for (const e of index.entries || []) {
    const abs = resolveUnderRoot(wikiRoot, e.path)
    if (!abs) continue
    let content = null
    try {
      content = readContent(abs)
    } catch {
      try {
        content = fs.readFileSync(abs, 'utf8')
      } catch {
        content = null
      }
    }
    if (content == null) continue
    docs.push({ title: e.title, path: e.path, content })
  }
  return { wikiRoot, docs }
}

function query(userData, queryText, ctx = {}) {
  const q = String(queryText || '').trim().toLowerCase()
  if (!q) {
    return { ok: true, hits: [], message: '请输入查询关键词' }
  }
  const { docs } = loadQueryDocuments(userData, ctx)
  const hits = knowledgeRank.rankHits(queryText, docs, { topK: MAX_QUERY_HITS })
  return {
    ok: true,
    hits,
    message: hits.length ? null : '没有找到相关资料，可先添加资料或换个关键词',
  }
}

/**
 * 词面检索 + 可选向量语义重排（二阶段）。
 * ctx.embed 存在时对候选做语义重排；缺失或失败时回退词面排序，绝不因重排丢内容。
 */
async function queryRanked(userData, queryText, ctx = {}) {
  const base = query(userData, queryText, ctx)
  if (!base.ok || !Array.isArray(base.hits) || base.hits.length < 2) return base
  if (typeof ctx.embed !== 'function') return base
  try {
    const hits = await knowledgeRank.rerankHits(base.hits, {
      embed: ctx.embed,
      queryText,
      alpha: Number.isFinite(ctx.rerankAlpha) ? ctx.rerankAlpha : 0.5,
    })
    return { ...base, hits, reranked: true }
  } catch {
    return base
  }
}

function slugify(name) {
  return String(name || 'note')
    .replace(/[^\w\u4e00-\u9fff\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || `note-${Date.now().toString(36)}`
}

function ingest(userData, payload = {}, ctx = {}) {
  const wikiRoot = resolveWikiRoot(userData, ctx)
  ensureDirs(userData)
  const created = []

  if (payload.text != null && String(payload.text).trim()) {
    const title = String(payload.title || '粘贴条目').trim().slice(0, 80)
    const body = `# ${title}\n\n${String(payload.text).trim()}\n`
    const written = llmwikiHarness.createRaw(wikiRoot, { title, content: body })
    if (!written.ok) return written
    created.push({ path: written.path, title })
  }

  const files = Array.isArray(payload.files) ? payload.files : []
  for (const f of files) {
    const srcAbs = path.resolve(String(f.absPath || f.path || ''))
    if (!srcAbs || !fs.existsSync(srcAbs) || !fs.statSync(srcAbs).isFile()) {
      return { ok: false, error: `文件不存在：${f.absPath || f.path || ''}` }
    }
    if (!isAuthorizedInput(srcAbs, wikiRoot, ctx.sources)) {
      return { ok: false, error: `文件不在知识库或授权内容源内：${f.absPath || f.path || ''}` }
    }
    // Only allow ingest from within wiki root OR explicit allowExternal with content copy from read buffer
    let content
    try {
      content = fs.readFileSync(srcAbs, 'utf8')
    } catch (e) {
      return { ok: false, error: e.message || String(e) }
    }
    const base = path.basename(srcAbs, path.extname(srcAbs))
    const title = titleFromContent(content, base)
    const out = content.trimStart().startsWith('#') ? content : `# ${title}\n\n${content}`
    const written = llmwikiHarness.createRaw(wikiRoot, {
      title,
      content: out.endsWith('\n') ? out : `${out}\n`,
    })
    if (!written.ok) return written
    created.push({ path: written.path, title })
  }

  if (!created.length) return { ok: false, error: '没有可吸收的内容' }
  refreshIndex(userData, ctx)
  // 写盘后清文件缓存，避免后续 query 命中陈旧条目
  try {
    contextCache.invalidate()
  } catch { /* ignore */ }
  return { ok: true, created }
}

function lintWiki(userData, ctx = {}) {
  const wikiRoot = resolveWikiRoot(userData, ctx)
  const files = walkTextFiles(wikiRoot)
  const harness = llmwikiHarness.inspectRoot(wikiRoot)
  const issues = (harness.issues || []).map(issue => ({
    type: issue.type,
    path: issue.path,
    message: issue.message,
    severity: issue.severity,
  }))
  const titles = new Map()

  for (const f of files) {
    let content = ''
    try {
      content = fs.readFileSync(f.abs, 'utf8')
    } catch {
      issues.push({ type: 'unreadable', path: f.rel, message: '无法读取文件' })
      continue
    }
    if (!content.trim()) {
      issues.push({ type: 'empty', path: f.rel, message: '文件为空' })
    }
    const title = titleFromContent(content, path.basename(f.rel))
    if (titles.has(title)) {
      issues.push({
        type: 'duplicate_title',
        path: f.rel,
        canOpen: true,
        action: 'propose_merge',
        message: `标题与 ${titles.get(title)} 重复：${title}`,
      })
    } else {
      titles.set(title, f.rel)
    }
    const linkRe = /\[([^\]]+)\]\(([^)]+)\)/g
    let m
    while ((m = linkRe.exec(content))) {
      const href = m[2].trim()
      if (/^(https?:|mailto:|#)/i.test(href)) continue
      const target = resolveUnderRoot(wikiRoot, href.replace(/^\.\//, ''))
      if (!target || !fs.existsSync(target)) {
        issues.push({
          type: 'broken_link',
          path: f.rel,
          canOpen: true,
          action: 'propose_fix',
          message: `断链：${href}`,
        })
      }
    }
  }

  if (files.length >= MAX_INDEX_FILES) {
    issues.push({
      type: 'limit',
      path: '',
      message: `已达扫描上限 ${MAX_INDEX_FILES}，部分文件可能未检查`,
    })
  }

  return {
    ok: true,
    issueCount: issues.length,
    issues,
    scanned: files.length,
    healthy: issues.length === 0,
    harness,
  }
}

function buildPromoteArtifact(userData, payload = {}, ctx = {}) {
  const wikiRoot = resolveWikiRoot(userData, ctx)
  const rel = String(payload.wikiPath || '').replace(/\\/g, '/')
  const abs = resolveUnderRoot(wikiRoot, rel)
  if (!abs || !fs.existsSync(abs)) {
    return { ok: false, error: 'Wiki 条目不存在' }
  }
  let content = ''
  try {
    content = fs.readFileSync(abs, 'utf8')
  } catch (e) {
    return { ok: false, error: e.message || String(e) }
  }
  const title = String(payload.title || titleFromContent(content, path.basename(rel))).slice(0, 120)
  const conceptRel = `concepts/${slugify(title)}.md`
  const body = content.replace(/^---[\s\S]*?---\r?\n/, '').trim()
  const draft = [
    '---',
    'type: Concept',
    `title: ${JSON.stringify(title)}`,
    `description: Promoted from wiki ${rel}`,
    'tags: [promoted]',
    `timestamp: ${new Date().toISOString()}`,
    '---',
    '',
    body || `# ${title}`,
    '',
  ].join('\n')

  // 单一知识根：升格产物写回 Wiki 根内 concepts/
  const targetAbsHint = resolveUnderRoot(wikiRoot, conceptRel)

  return {
    ok: true,
    artifact: {
      id: `art_${Date.now().toString(36)}_${crypto.randomBytes(2).toString('hex')}`,
      type: 'wiki_write',
      title: `升格 OKF：${title}`,
      body: draft,
      status: 'draft',
      targetPath: conceptRel,
      targetAbsHint,
      sourceWikiPath: rel,
      sourceHash: knowledgeSteward.hashContent(content),
      rationale: String(payload.rationale || `根据来源「${rel}」生成 OKF 整理提案`),
      confidence: Number.isFinite(payload.confidence) ? payload.confidence : 0.5,
    },
  }
}

function promoteToOkfDraft(userData, payload = {}, ctx = {}) {
  return buildPromoteArtifact(userData, payload, ctx)
}

function promoteToOkfDrafts(userData, payload = {}, ctx = {}) {
  const paths = Array.isArray(payload.wikiPaths)
    ? payload.wikiPaths
    : Array.isArray(payload.paths)
      ? payload.paths
      : payload.wikiPath
        ? [payload.wikiPath]
        : []
  const artifacts = []
  const errors = []
  for (const wikiPath of [...new Set(paths.map(item => String(item || '').trim()).filter(Boolean))]) {
    const result = buildPromoteArtifact(userData, {
      ...payload,
      wikiPath,
      title: payload.titles?.[wikiPath] || payload.title,
    }, ctx)
    if (result.ok) artifacts.push(result.artifact)
    else errors.push({ path: wikiPath, error: result.error })
  }
  return {
    ok: artifacts.length > 0 && errors.length === 0,
    artifacts,
    errors,
    error: artifacts.length ? null : (errors[0]?.error || '没有可升格的 Wiki 条目'),
  }
}

function writeAtomic(abs, content) {
  const tmp = `${abs}.knowme-${crypto.randomBytes(4).toString('hex')}.tmp`
  fs.writeFileSync(tmp, content, 'utf8')
  try {
    if (!fs.existsSync(abs)) {
      fs.renameSync(tmp, abs)
    } else {
      fs.copyFileSync(tmp, abs)
      fs.unlinkSync(tmp)
    }
  } catch (error) {
    try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp) } catch { /* ignore cleanup */ }
    throw error
  }
}

function acceptWrite(userData, artifact, ctx = {}) {
  if (!artifact || artifact.status === 'rejected') {
    return { ok: false, error: '无效产物' }
  }
  ensureDirs(userData)

  // 单一知识根：knowledge_proposal 与 wiki_write 统一写回 Wiki 根内
  if (artifact.type === 'wiki_write' || artifact.type === 'knowledge_proposal') {
    const wikiRoot = resolveWikiRoot(userData, ctx)
    const rel = String(artifact.targetPath || '').replace(/\\/g, '/')
    const abs = resolveUnderRoot(wikiRoot, rel)
    if (!abs) return { ok: false, error: '目标路径非法（须在知识库根内）' }
    if (artifact.sourceWikiPath && artifact.sourceHash) {
      const sourceAbs = resolveUnderRoot(wikiRoot, artifact.sourceWikiPath)
      if (!sourceAbs || !fs.existsSync(sourceAbs)) {
        return { ok: false, error: '来源条目不存在，无法确认提案安全性' }
      }
      const currentSource = fs.readFileSync(sourceAbs, 'utf8')
      if (knowledgeSteward.hashContent(currentSource) !== artifact.sourceHash) {
        return { ok: false, code: 'source_changed', error: '来源条目已变化，请重新生成整理提案' }
      }
    }
    fs.mkdirSync(path.dirname(abs), { recursive: true })
    writeAtomic(abs, String(artifact.body || artifact.proposedContent || ''))
    refreshIndex(userData, ctx)
    try {
      contextCache.invalidate(abs)
    } catch { /* ignore */ }
    return { ok: true, written: abs, rel }
  }

  return { ok: false, error: `不支持的产物类型：${artifact.type}` }
}

function readEntry(userData, kind, relPath, ctx = {}) {
  const rel = String(relPath || '').replace(/\\/g, '/')
  // 单一知识根：okf 与 wiki 条目都在 Wiki 根内
  const root = resolveWikiRoot(userData, ctx)
  if (rel.startsWith('raw/')) {
    const result = llmwikiHarness.readRaw(root, rel)
    if (!result.ok) return result
    return {
      ...result,
      title: titleFromContent(result.content, path.basename(rel)),
      kind: kind || 'wiki',
      editable: true,
    }
  }
  const abs = resolveUnderRoot(root, rel)
  if (!abs || !fs.existsSync(abs)) return { ok: false, error: '条目不存在' }
  try {
    const content = fs.readFileSync(abs, 'utf8')
    return {
      ok: true,
      path: rel,
      kind: kind || 'wiki',
      title: titleFromContent(content, path.basename(rel)),
      content,
      hash: llmwikiHarness.hashContent(content),
      editable: false,
    }
  } catch (e) {
    return { ok: false, error: e.message || String(e) }
  }
}

function harnessStatus(userData, ctx = {}) {
  const root = resolveWikiRoot(userData, ctx)
  return llmwikiHarness.inspectRoot(root)
}

function saveRaw(userData, payload = {}, ctx = {}) {
  const root = resolveWikiRoot(userData, ctx)
  const result = llmwikiHarness.writeRaw(root, payload)
  if (!result.ok) return result
  const index = refreshIndex(userData, ctx)
  const abs = resolveUnderRoot(root, result.path)
  try {
    contextCache.invalidate(abs)
    contextCache.invalidate('kb:')
  } catch { /* ignore */ }
  return {
    ...result,
    indexedAt: index.builtAt,
  }
}

function formatQueryContext(hits) {
  if (!hits?.length) return ''
  const lines = hits.map(
    (h, i) => `[${i + 1}] ${h.title} (${h.path})\n${h.snippet || ''}`
  )
  return `[知识库检索结果]\n${lines.join('\n\n')}\n[检索结束：回答须引用上述来源路径，无命中勿编造]`
}

module.exports = {
  MAX_INDEX_FILES,
  resolveUnderRoot,
  isPathInside,
  isAuthorizedInput,
  knowledgeOsRoot,
  defaultPaths,
  ensureDirs,
  loadConfig,
  saveConfig,
  resolveWikiRoot,
  buildIndex,
  refreshIndex,
  listEntries,
  loadQueryDocuments,
  query,
  queryRanked,
  ingest,
  lintWiki,
  harnessStatus,
  saveRaw,
  promoteToOkfDraft,
  promoteToOkfDrafts,
  acceptWrite,
  readEntry,
  formatQueryContext,
  titleFromContent,
  slugify,
}
