'use strict'

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const SCHEMA_VERSION = 1
const MANIFEST_DIR = '.knowme'
const MANIFEST_FILE = 'llmwiki.json'
const REQUIRED_DIRS = ['raw', 'concepts', MANIFEST_DIR]
const RAW_EXTENSIONS = new Set(['.md', '.markdown', '.txt'])
const CONCEPT_EXTENSIONS = new Set(['.md', '.markdown'])
const MAX_RAW_BYTES = 2 * 1024 * 1024
const MAX_INSPECT_FILES = 4000

function hashContent(content) {
  return crypto.createHash('sha256').update(String(content || ''), 'utf8').digest('hex')
}

function failure(code, error, details = {}) {
  return { ok: false, code, error, ...details }
}

function normalizeRelative(input) {
  const raw = String(input || '').trim().replace(/\\/g, '/')
  if (!raw || raw.includes('\0') || path.posix.isAbsolute(raw) || /^[a-z]:\//i.test(raw)) {
    return null
  }
  const parts = raw.split('/').filter(Boolean)
  if (!parts.length || parts.some(part => part === '.' || part === '..')) return null
  return parts.join('/')
}

function isInside(rootPath, targetPath) {
  const root = path.resolve(rootPath)
  const target = path.resolve(targetPath)
  const rel = path.relative(root, target)
  return rel === '' || (!!rel && rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel))
}

function manifestPath(rootPath) {
  return path.join(path.resolve(rootPath), MANIFEST_DIR, MANIFEST_FILE)
}

function readManifest(rootPath) {
  const file = manifestPath(rootPath)
  try {
    return { ok: true, manifest: JSON.parse(fs.readFileSync(file, 'utf8')), path: file }
  } catch (error) {
    return failure(
      fs.existsSync(file) ? 'invalid_manifest' : 'missing_manifest',
      fs.existsSync(file) ? '根知识库元数据损坏' : '根知识库元数据缺失',
      { path: file, cause: error.message }
    )
  }
}

function ensureRoot(rootPath) {
  const root = path.resolve(String(rootPath || ''))
  if (!rootPath) return failure('invalid_root', '缺少根知识库路径')
  try {
    fs.mkdirSync(root, { recursive: true })
    for (const dir of REQUIRED_DIRS) fs.mkdirSync(path.join(root, dir), { recursive: true })
    const file = manifestPath(root)
    let created = false
    if (!fs.existsSync(file)) {
      const now = new Date().toISOString()
      const manifest = {
        type: 'knowme-llmwiki',
        schemaVersion: SCHEMA_VERSION,
        createdAt: now,
        updatedAt: now,
      }
      fs.writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`, {
        encoding: 'utf8',
        flag: 'wx',
      })
      created = true
    }
    const loaded = readManifest(root)
    if (!loaded.ok) return loaded
    if (loaded.manifest.type !== 'knowme-llmwiki') {
      return failure('invalid_manifest_type', '目录不是 KnowMe 根知识库', { root })
    }
    if (Number(loaded.manifest.schemaVersion) !== SCHEMA_VERSION) {
      return failure('unsupported_schema', '根知识库版本不受支持', {
        root,
        expectedVersion: SCHEMA_VERSION,
        actualVersion: loaded.manifest.schemaVersion,
      })
    }
    return { ok: true, root, created, manifest: loaded.manifest }
  } catch (error) {
    return failure('root_init_failed', error.message || '根知识库初始化失败', { root })
  }
}

function assertNoSymlink(rootPath, targetPath, options = {}) {
  const root = path.resolve(rootPath)
  const target = path.resolve(targetPath)
  if (!isInside(root, target)) return failure('path_escape', '路径超出根知识库')
  const rel = path.relative(root, target)
  const parts = rel ? rel.split(path.sep).filter(Boolean) : []
  let current = root
  for (let index = 0; index < parts.length; index += 1) {
    current = path.join(current, parts[index])
    if (!fs.existsSync(current)) {
      if (options.allowMissingLeaf && index === parts.length - 1) break
      continue
    }
    const stat = fs.lstatSync(current)
    if (stat.isSymbolicLink()) {
      return failure('symlink_forbidden', '资料路径不能经过符号链接', {
        path: path.relative(root, current).replace(/\\/g, '/'),
      })
    }
  }
  return { ok: true }
}

function resolveRawPath(rootPath, relPath, options = {}) {
  const root = path.resolve(rootPath)
  const rel = normalizeRelative(relPath)
  if (!rel || (rel !== 'raw' && !rel.startsWith('raw/'))) {
    return failure('raw_path_required', '资料必须位于 raw 目录')
  }
  if (rel === 'raw') return failure('file_required', '必须指定资料文件')
  const extension = path.extname(rel).toLowerCase()
  if (!RAW_EXTENSIONS.has(extension)) {
    return failure('unsupported_file_type', '仅支持 Markdown 或纯文本资料', { path: rel })
  }
  const target = path.resolve(root, ...rel.split('/'))
  const rawRoot = path.resolve(root, 'raw')
  if (!isInside(rawRoot, target)) return failure('path_escape', '资料路径超出 raw 目录')
  try {
    const symlink = assertNoSymlink(root, target, { allowMissingLeaf: options.allowMissing === true })
    if (!symlink.ok) return symlink
  } catch (error) {
    return failure('path_check_failed', error.message || '无法检查资料路径')
  }
  return { ok: true, root, rawRoot, rel, target }
}

function readRaw(rootPath, relPath) {
  const resolved = resolveRawPath(rootPath, relPath)
  if (!resolved.ok) return resolved
  try {
    if (!fs.existsSync(resolved.target) || !fs.statSync(resolved.target).isFile()) {
      return failure('not_found', '资料不存在', { path: resolved.rel })
    }
    const stat = fs.statSync(resolved.target)
    if (stat.size > MAX_RAW_BYTES) {
      return failure('content_too_large', '资料超过可编辑大小限制', {
        path: resolved.rel,
        maxBytes: MAX_RAW_BYTES,
        bytes: stat.size,
      })
    }
    const content = fs.readFileSync(resolved.target, 'utf8')
    return {
      ok: true,
      path: resolved.rel,
      content,
      hash: hashContent(content),
      bytes: Buffer.byteLength(content, 'utf8'),
      updatedAt: stat.mtime.toISOString(),
    }
  } catch (error) {
    return failure('read_failed', error.message || '资料读取失败', { path: resolved.rel })
  }
}

function writeRaw(rootPath, payload = {}) {
  const init = ensureRoot(rootPath)
  if (!init.ok) return init
  const resolved = resolveRawPath(init.root, payload.path, { allowMissing: true })
  if (!resolved.ok) return resolved
  const content = String(payload.content ?? '')
  const bytes = Buffer.byteLength(content, 'utf8')
  if (bytes > MAX_RAW_BYTES) {
    return failure('content_too_large', '资料超过可编辑大小限制', {
      path: resolved.rel,
      maxBytes: MAX_RAW_BYTES,
      bytes,
    })
  }
  try {
    const exists = fs.existsSync(resolved.target)
    if (exists && !fs.statSync(resolved.target).isFile()) {
      return failure('file_required', '目标不是可编辑资料文件', { path: resolved.rel })
    }
    if (exists) {
      const current = fs.readFileSync(resolved.target, 'utf8')
      const currentHash = hashContent(current)
      if (!payload.expectedHash) {
        return failure('expected_hash_required', '保存已有资料需要内容版本', {
          path: resolved.rel,
          currentHash,
        })
      }
      if (payload.expectedHash !== currentHash) {
        return failure('stale_content', '资料已被其他程序修改，请重新载入后再保存', {
          path: resolved.rel,
          currentHash,
        })
      }
    } else if (payload.expectedHash) {
      return failure('stale_content', '资料已不存在，请重新载入', { path: resolved.rel })
    }

    fs.mkdirSync(path.dirname(resolved.target), { recursive: true })
    const parentCheck = assertNoSymlink(init.root, path.dirname(resolved.target))
    if (!parentCheck.ok) return parentCheck
    const temp = path.join(
      path.dirname(resolved.target),
      `.${path.basename(resolved.target)}.knowme-${crypto.randomBytes(6).toString('hex')}.tmp`
    )
    try {
      fs.writeFileSync(temp, content, { encoding: 'utf8', flag: 'wx' })
      fs.renameSync(temp, resolved.target)
    } catch (error) {
      try {
        if (fs.existsSync(temp)) fs.unlinkSync(temp)
      } catch { /* cleanup only */ }
      return failure('atomic_write_failed', error.message || '资料保存失败', { path: resolved.rel })
    }
    const stat = fs.statSync(resolved.target)
    return {
      ok: true,
      path: resolved.rel,
      hash: hashContent(content),
      bytes,
      updatedAt: stat.mtime.toISOString(),
      created: !exists,
    }
  } catch (error) {
    return failure('write_failed', error.message || '资料保存失败', { path: resolved.rel })
  }
}

function slugify(value) {
  return String(value || '新资料')
    .trim()
    .replace(/[^\w\u4e00-\u9fff-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || `资料-${Date.now().toString(36)}`
}

function createRaw(rootPath, payload = {}) {
  const title = String(payload.title || '新资料').trim().slice(0, 120) || '新资料'
  const extension = RAW_EXTENSIONS.has(String(payload.extension || '').toLowerCase())
    ? String(payload.extension).toLowerCase()
    : '.md'
  const root = path.resolve(rootPath)
  const base = slugify(title)
  let index = 0
  let rel
  do {
    const suffix = index ? `-${index}` : ''
    rel = `raw/${base}${suffix}${extension}`
    index += 1
  } while (fs.existsSync(path.resolve(root, ...rel.split('/'))) && index < 10000)
  const provided = String(payload.content ?? '').trim()
  const content = provided || (extension === '.txt' ? `${title}\n` : `# ${title}\n\n`)
  return writeRaw(root, { path: rel, content })
}

function inspectArea(root, area, allowed, issues, stats) {
  const base = path.join(root, area)
  if (!fs.existsSync(base)) return
  const stack = [base]
  while (stack.length && stats.scanned < MAX_INSPECT_FILES) {
    const current = stack.pop()
    let entries
    try {
      entries = fs.readdirSync(current, { withFileTypes: true })
    } catch (error) {
      issues.push({
        severity: 'error',
        type: 'unreadable',
        path: path.relative(root, current).replace(/\\/g, '/'),
        message: error.message || '目录无法读取',
      })
      continue
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name)
      const rel = path.relative(root, full).replace(/\\/g, '/')
      if (entry.isSymbolicLink()) {
        issues.push({
          severity: 'error',
          type: 'symlink_forbidden',
          path: rel,
          message: '根知识库内不允许符号链接',
        })
        continue
      }
      if (entry.isDirectory()) {
        stack.push(full)
        continue
      }
      if (!entry.isFile()) continue
      stats.scanned += 1
      const ext = path.extname(entry.name).toLowerCase()
      if (!allowed.has(ext)) {
        issues.push({
          severity: 'error',
          type: 'unsupported_file_type',
          path: rel,
          message: `${area} 中包含不支持的文件类型`,
        })
        continue
      }
      if (area === 'raw') stats.rawFiles += 1
      if (area === 'concepts') stats.concepts += 1
    }
  }
  if (stats.scanned >= MAX_INSPECT_FILES) {
    issues.push({
      severity: 'warning',
      type: 'scan_limit',
      path: area,
      message: `检查达到 ${MAX_INSPECT_FILES} 个文件上限`,
    })
  }
}

function inspectRoot(rootPath) {
  const root = path.resolve(String(rootPath || ''))
  const issues = []
  const stats = { rawFiles: 0, concepts: 0, scanned: 0 }
  if (!rootPath || !fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    return {
      ok: false,
      schemaVersion: SCHEMA_VERSION,
      root,
      checkedAt: new Date().toISOString(),
      stats,
      issues: [{ severity: 'error', type: 'missing_root', path: '', message: '根知识库不存在' }],
    }
  }
  for (const dir of REQUIRED_DIRS) {
    const full = path.join(root, dir)
    if (!fs.existsSync(full) || !fs.statSync(full).isDirectory()) {
      issues.push({
        severity: 'error',
        type: 'missing_directory',
        path: dir,
        message: `缺少必需目录：${dir}`,
      })
    }
  }
  const manifest = readManifest(root)
  if (!manifest.ok) {
    issues.push({ severity: 'error', type: manifest.code, path: `${MANIFEST_DIR}/${MANIFEST_FILE}`, message: manifest.error })
  } else if (
    manifest.manifest.type !== 'knowme-llmwiki' ||
    Number(manifest.manifest.schemaVersion) !== SCHEMA_VERSION
  ) {
    issues.push({
      severity: 'error',
      type: 'unsupported_schema',
      path: `${MANIFEST_DIR}/${MANIFEST_FILE}`,
      message: '根知识库元数据类型或版本不受支持',
    })
  }
  inspectArea(root, 'raw', RAW_EXTENSIONS, issues, stats)
  inspectArea(root, 'concepts', CONCEPT_EXTENSIONS, issues, stats)
  return {
    ok: !issues.some(issue => issue.severity === 'error'),
    schemaVersion: SCHEMA_VERSION,
    root,
    checkedAt: new Date().toISOString(),
    stats,
    issues,
  }
}

module.exports = {
  SCHEMA_VERSION,
  MANIFEST_DIR,
  MANIFEST_FILE,
  REQUIRED_DIRS,
  RAW_EXTENSIONS,
  MAX_RAW_BYTES,
  hashContent,
  normalizeRelative,
  isInside,
  ensureRoot,
  inspectRoot,
  resolveRawPath,
  readRaw,
  writeRaw,
  createRaw,
}
