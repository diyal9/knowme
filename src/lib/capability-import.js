'use strict'

/**
 * Capability Hub — 安全导入：本地目录 / 单文件 / ZIP / HTTPS。
 * 仅落盘，不执行包内脚本。ZIP 无第三方依赖：先校验条目，再用内置解压（stored/deflate）。
 */

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')
const {
  assertNotSymlink,
  assertPathInsideRoot,
  assertSafeRelativeSegment,
  clearStaging,
  copyDirectorySafe,
  installFromStaging,
  resolvePaths,
} = require('./capability-store')
const {
  addTrustedSource,
  getCatalogEntry,
  getBundledInstallSource,
  isTrustedSource,
} = require('./capability-catalog')

const LIMITS = {
  maxFileBytes: 10 * 1024 * 1024,
  maxPackageBytes: 50 * 1024 * 1024,
  maxFileCount: 500,
  maxHttpsBytes: 50 * 1024 * 1024,
}

const SECRET_FIELD_RE = /^(api[_-]?key|access[_-]?token|api[_-]?token|secret|password|token|private[_-]?key)$/i
const ENV_REF_RE = /^env:[A-Z_][A-Z0-9_]{0,63}$/i
const DEVICE_NAME_RE = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i

function fail(code, message) {
  return { ok: false, code, error: message }
}

function normalizeZipPath(name) {
  return String(name || '').replace(/\\/g, '/').replace(/^\/+/, '')
}

function validateRelativePath(relativePath) {
  const raw = String(relativePath || '')
  if (!raw) return fail('invalid_path', '空路径')
  if (raw.includes('\0')) return fail('invalid_path', '路径包含非法字符')
  if (/^[a-zA-Z]:/.test(raw) || raw.startsWith('/') || raw.startsWith('\\')) {
    return fail('absolute_path', '不允许绝对路径')
  }

  const normalized = normalizeZipPath(raw)
  const parts = normalized.split('/')
  for (const part of parts) {
    if (!part || part === '.') continue
    if (part === '..') return fail('path_traversal', '不允许路径穿越')
    if (!assertSafeRelativeSegment(part)) return fail('invalid_path', `非法路径段: ${part}`)
    if (DEVICE_NAME_RE.test(part)) return fail('device_path', `不允许 Windows 设备名: ${part}`)
  }
  return { ok: true, path: normalized }
}

function isEnvReference(value) {
  return ENV_REF_RE.test(String(value || '').trim())
}

function scanSecrets(value, keyPath = '') {
  if (value == null) return null
  if (typeof value === 'string') {
    const key = String(keyPath.split('.').pop() || '')
    if (SECRET_FIELD_RE.test(key) && value && !isEnvReference(value)) {
      return fail('plaintext_secret', `字段 ${keyPath || key} 仅允许 env:VAR_NAME 引用`)
    }
    if (/^sk-[a-z0-9]{10,}$/i.test(value.trim())) {
      return fail('plaintext_secret', '检测到疑似 API Key 明文')
    }
    return null
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const hit = scanSecrets(value[i], `${keyPath}[${i}]`)
      if (hit) return hit
    }
    return null
  }
  if (typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      const hit = scanSecrets(nested, keyPath ? `${keyPath}.${key}` : key)
      if (hit) return hit
    }
  }
  return null
}

function validateManifestObject(manifest) {
  if (!manifest || typeof manifest !== 'object') {
    return fail('invalid_manifest', 'manifest 必须是 JSON 对象')
  }
  const secretHit = scanSecrets(manifest)
  if (secretHit) return secretHit
  return { ok: true, manifest }
}

function readJsonFile(filePath) {
  try {
    return { ok: true, data: JSON.parse(fs.readFileSync(filePath, 'utf8')) }
  } catch (err) {
    return fail('invalid_json', err.message || 'JSON 解析失败')
  }
}

function parseFrontmatter(text) {
  const raw = String(text || '')
  if (!raw.startsWith('---\n')) return { frontmatter: {}, body: raw }
  const end = raw.indexOf('\n---\n', 4)
  if (end < 0) return { frontmatter: {}, body: raw }
  const block = raw.slice(4, end)
  const frontmatter = {}
  for (const line of block.split('\n')) {
    const idx = line.indexOf(':')
    if (idx <= 0) continue
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim()
    frontmatter[key] = value
  }
  return { frontmatter, body: raw.slice(end + 5) }
}

function detectKindFromFolder(folderPath) {
  const root = path.resolve(folderPath)
  const skillMd = path.join(root, 'SKILL.md')
  const expertMd = path.join(root, 'EXPERT.md')
  const manifestJson = path.join(root, 'manifest.json')

  if (fs.existsSync(skillMd)) {
    const parsed = parseFrontmatter(fs.readFileSync(skillMd, 'utf8'))
    const secretHit = scanSecrets(parsed.frontmatter)
    if (secretHit) return secretHit
    return {
      ok: true,
      kind: 'skill',
      id: String(parsed.frontmatter.name || path.basename(root)).trim(),
      version: String(parsed.frontmatter.version || '1.0.0').trim(),
      manifest: parsed.frontmatter,
    }
  }

  if (fs.existsSync(expertMd)) {
    const parsed = parseFrontmatter(fs.readFileSync(expertMd, 'utf8'))
    const secretHit = scanSecrets(parsed.frontmatter)
    if (secretHit) return secretHit
    return {
      ok: true,
      kind: 'expert',
      id: String(parsed.frontmatter.name || path.basename(root)).trim(),
      version: String(parsed.frontmatter.version || '1.0.0').trim(),
      manifest: parsed.frontmatter,
    }
  }

  if (fs.existsSync(manifestJson)) {
    const manifest = readJsonFile(manifestJson)
    if (!manifest.ok) return manifest
    const validated = validateManifestObject(manifest.data)
    if (!validated.ok) return validated
    const kind = String(validated.manifest.kind || validated.manifest.type || 'connector').trim()
    const id = String(validated.manifest.id || path.basename(root)).trim()
    return {
      ok: true,
      kind: kind === 'skill' || kind === 'expert' ? kind : 'connector',
      id,
      version: String(validated.manifest.version || '1.0.0').trim(),
      manifest: validated.manifest,
    }
  }

  return fail('missing_manifest', '目录需包含 SKILL.md、EXPERT.md 或 manifest.json')
}

function validateFolderTree(folderPath) {
  const root = path.resolve(folderPath)
  let fileCount = 0
  let totalBytes = 0

  function walk(current) {
    const linkCheck = assertNotSymlink(current)
    if (!linkCheck.ok) throw new Error(linkCheck.error)
    const stat = fs.statSync(current)
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(current)) {
        if (!assertSafeRelativeSegment(name)) throw new Error(`非法路径段: ${name}`)
        walk(path.join(current, name))
      }
      return
    }
    if (!stat.isFile()) throw new Error('仅支持普通文件')
    fileCount += 1
    totalBytes += stat.size
    if (stat.size > LIMITS.maxFileBytes) throw new Error('单文件超过 10MB 限制')
    if (fileCount > LIMITS.maxFileCount) throw new Error('文件数超过 500 限制')
    if (totalBytes > LIMITS.maxPackageBytes) throw new Error('包总大小超过 50MB 限制')
  }

  try {
    walk(root)
    return { ok: true, fileCount, totalBytes }
  } catch (err) {
    return fail('folder_limit', err.message || '目录校验失败')
  }
}

function findEndOfCentralDirectory(buffer) {
  const minOffset = Math.max(0, buffer.length - 65557)
  for (let i = buffer.length - 22; i >= minOffset; i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) return i
  }
  return -1
}

function parseZipEntries(buffer) {
  if (!Buffer.isBuffer(buffer)) return fail('invalid_zip', 'ZIP 数据无效')
  if (buffer.length > LIMITS.maxPackageBytes) return fail('package_too_large', 'ZIP 超过 50MB 限制')

  const eocdOffset = findEndOfCentralDirectory(buffer)
  if (eocdOffset < 0) return fail('invalid_zip', '找不到 ZIP 中央目录')

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10)
  const centralSize = buffer.readUInt32LE(eocdOffset + 12)
  const centralOffset = buffer.readUInt32LE(eocdOffset + 16)
  if (centralOffset + centralSize > buffer.length) return fail('invalid_zip', 'ZIP 中央目录损坏')

  const entries = []
  let offset = centralOffset
  let totalUncompressed = 0

  for (let i = 0; i < totalEntries; i += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      return fail('invalid_zip', 'ZIP 条目头损坏')
    }
    const compressionMethod = buffer.readUInt16LE(offset + 10)
    const compressedSize = buffer.readUInt32LE(offset + 20)
    const uncompressedSize = buffer.readUInt32LE(offset + 24)
    const fileNameLength = buffer.readUInt16LE(offset + 28)
    const extraLength = buffer.readUInt16LE(offset + 30)
    const commentLength = buffer.readUInt16LE(offset + 32)
    const externalAttributes = buffer.readUInt32LE(offset + 38)
    const localHeaderOffset = buffer.readUInt32LE(offset + 42)
    const fileName = buffer.toString('utf8', offset + 46, offset + 46 + fileNameLength)
    offset += 46 + fileNameLength + extraLength + commentLength

    const pathCheck = validateRelativePath(fileName)
    if (!pathCheck.ok) return pathCheck

    const isSymlink = ((externalAttributes >>> 16) & 0o120000) === 0o120000
    if (isSymlink) return fail('symlink', `ZIP 含符号链接: ${fileName}`)

    const isDirectory = fileName.endsWith('/')
    if (!isDirectory) {
      entries.push({
        name: pathCheck.path,
        compressionMethod,
        compressedSize,
        uncompressedSize,
        localHeaderOffset,
      })
      if (uncompressedSize > LIMITS.maxFileBytes) {
        return fail('file_too_large', `文件 ${fileName} 超过 10MB 限制`)
      }
      totalUncompressed += uncompressedSize
      if (totalUncompressed > LIMITS.maxPackageBytes) {
        return fail('package_too_large', '解压后总大小超过 50MB 限制')
      }
    }

    if (entries.length > LIMITS.maxFileCount) {
      return fail('too_many_files', '文件数超过 500 限制')
    }
  }

  return { ok: true, entries, totalEntries }
}

function readLocalFileHeader(buffer, entry) {
  const offset = entry.localHeaderOffset
  if (buffer.readUInt32LE(offset) !== 0x04034b50) {
    throw new Error(`ZIP 本地头损坏: ${entry.name}`)
  }
  const fileNameLength = buffer.readUInt16LE(offset + 26)
  const extraLength = buffer.readUInt16LE(offset + 28)
  const dataOffset = offset + 30 + fileNameLength + extraLength
  const data = buffer.subarray(dataOffset, dataOffset + entry.compressedSize)
  if (entry.compressionMethod === 0) return data
  if (entry.compressionMethod === 8) {
    return zlib.inflateRawSync(data, { maxOutputLength: LIMITS.maxFileBytes })
  }
  throw new Error(`不支持的压缩方式: ${entry.compressionMethod}`)
}

function extractZipBuffer(buffer, destDir, options = {}) {
  const parsed = parseZipEntries(buffer)
  if (!parsed.ok) return parsed

  const guard = assertPathInsideRoot(destDir, destDir)
  if (!guard.ok) return guard

  if (typeof options.extractAdapter === 'function') {
    return options.extractAdapter(buffer, guard.path, parsed.entries)
  }

  fs.mkdirSync(guard.path, { recursive: true })
  for (const entry of parsed.entries) {
    const target = path.join(guard.path, entry.name.split('/').join(path.sep))
    const targetGuard = assertPathInsideRoot(guard.path, target)
    if (!targetGuard.ok) return targetGuard
    fs.mkdirSync(path.dirname(targetGuard.path), { recursive: true })
    const content = readLocalFileHeader(buffer, entry)
    if (content.length > LIMITS.maxFileBytes) {
      return fail('file_too_large', `文件 ${entry.name} 超过 10MB 限制`)
    }
    fs.writeFileSync(targetGuard.path, content)
  }
  return { ok: true, entries: parsed.entries, destDir: guard.path }
}

function validateHttpsUrl(url) {
  let parsed
  try {
    parsed = new URL(String(url || '').trim())
  } catch {
    return fail('invalid_url', 'URL 格式无效')
  }
  if (parsed.protocol !== 'https:') {
    return fail('non_https', '仅支持 https:// 远程导入')
  }
  if (parsed.protocol === 'file:') {
    return fail('file_scheme', '不允许 file:// 远程引用')
  }
  return { ok: true, url: parsed.toString() }
}

async function downloadHttpsBuffer(url, options = {}) {
  const valid = validateHttpsUrl(url)
  if (!valid.ok) return valid

  const fetchImpl = options.fetchImpl || global.fetch
  if (typeof fetchImpl !== 'function') {
    return fail('fetch_unavailable', '当前环境不支持 HTTPS 下载')
  }

  const controller = typeof AbortController === 'function' ? new AbortController() : null
  const timeoutMs = Number(options.timeoutMs) || 15000
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null

  try {
    const response = await fetchImpl(valid.url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller?.signal,
    })
    if (!response.ok) return fail('http_error', `下载失败: HTTP ${response.status}`)
    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.length > LIMITS.maxHttpsBytes) {
      return fail('package_too_large', '下载内容超过 50MB 限制')
    }
    return { ok: true, buffer, url: valid.url }
  } catch (err) {
    if (err.name === 'AbortError') return fail('timeout', 'HTTPS 下载超时')
    return fail('network_error', err.message || 'HTTPS 下载失败')
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function ensureTrust(userData, source, originUrl, options = {}) {
  const trust = String(source || '').trim()
  if (trust === 'bundled' || trust === 'curated') return { ok: true }
  if (options.trustConfirmed === true) {
    if (originUrl) addTrustedSource(userData, originUrl)
    return { ok: true, trust: 'user_confirmed' }
  }
  if (originUrl && isTrustedSource(userData, originUrl)) return { ok: true, trust: 'trusted_source' }
  return fail('trust_required', '未知来源需用户确认信任后再安装')
}

function stageCopy(userData, srcDir, options = {}) {
  const paths = resolvePaths(userData)
  clearStaging(userData)
  const stageRoot = path.join(paths.staging, options.stageName || `import-${Date.now()}`)
  const copied = copyDirectorySafe(srcDir, stageRoot, paths.root)
  if (!copied.ok) return copied
  return { ok: true, stagingPath: stageRoot }
}

function finalizeInstall(userData, detected, options = {}) {
  const trustCheck = ensureTrust(userData, options.trust, options.originUrl, options)
  if (!trustCheck.ok) return trustCheck

  return installFromStaging(userData, {
    id: options.id || detected.id,
    kind: detected.kind,
    source: options.source || 'local',
    version: options.version || detected.version,
    trust: trustCheck.trust || options.trust || 'unknown',
    originUrl: options.originUrl || '',
    stagingPath: options.stagingPath,
    enabled: options.enabled !== false,
  })
}

function importFromFolder(userData, folderPath, options = {}) {
  const root = path.resolve(String(folderPath || ''))
  if (!fs.existsSync(root)) return fail('not_found', '本地目录不存在')

  const linkCheck = assertNotSymlink(root)
  if (!linkCheck.ok) return linkCheck

  const limits = validateFolderTree(root)
  if (!limits.ok) return limits

  const detected = detectKindFromFolder(root)
  if (!detected.ok) return detected

  const staged = stageCopy(userData, root, options)
  if (!staged.ok) return staged

  return finalizeInstall(userData, detected, {
    ...options,
    source: options.source || 'local',
    stagingPath: staged.stagingPath,
  })
}

function importFromMarkdownFile(userData, filePath, options = {}) {
  const file = path.resolve(String(filePath || ''))
  if (!fs.existsSync(file)) return fail('not_found', '文件不存在')
  const base = path.basename(file)
  if (base !== 'SKILL.md' && base !== 'EXPERT.md') {
    return fail('unsupported_file', '仅支持单文件 SKILL.md 或 EXPERT.md 导入')
  }

  const paths = resolvePaths(userData)
  clearStaging(userData)
  const stageRoot = path.join(paths.staging, options.stageName || `md-${Date.now()}`)
  fs.mkdirSync(stageRoot, { recursive: true })
  fs.copyFileSync(file, path.join(stageRoot, base))

  const detected = detectKindFromFolder(stageRoot)
  if (!detected.ok) return detected

  return finalizeInstall(userData, detected, {
    ...options,
    source: options.source || 'local',
    stagingPath: stageRoot,
  })
}

function importFromJsonFile(userData, filePath, options = {}) {
  const file = path.resolve(String(filePath || ''))
  if (!fs.existsSync(file)) return fail('not_found', '文件不存在')
  const manifest = readJsonFile(file)
  if (!manifest.ok) return manifest
  const validated = validateManifestObject(manifest.data)
  if (!validated.ok) return validated

  const paths = resolvePaths(userData)
  clearStaging(userData)
  const stageRoot = path.join(paths.staging, options.stageName || `json-${Date.now()}`)
  fs.mkdirSync(stageRoot, { recursive: true })
  fs.writeFileSync(path.join(stageRoot, 'manifest.json'), JSON.stringify(validated.manifest, null, 2), 'utf8')

  const detected = detectKindFromFolder(stageRoot)
  if (!detected.ok) return detected

  return finalizeInstall(userData, detected, {
    ...options,
    source: options.source || 'custom',
    stagingPath: stageRoot,
  })
}

function importFromZipBuffer(userData, buffer, options = {}) {
  const paths = resolvePaths(userData)
  clearStaging(userData)
  const stageRoot = path.join(paths.staging, options.stageName || `zip-${Date.now()}`)
  const extracted = extractZipBuffer(buffer, stageRoot, options)
  if (!extracted.ok) return extracted

  const limits = validateFolderTree(stageRoot)
  if (!limits.ok) return limits

  const detected = detectKindFromFolder(stageRoot)
  if (!detected.ok) return detected

  return finalizeInstall(userData, detected, {
    ...options,
    source: options.source || 'zip',
    stagingPath: stageRoot,
  })
}

function importFromZipFile(userData, zipPath, options = {}) {
  const file = path.resolve(String(zipPath || ''))
  if (!fs.existsSync(file)) return fail('not_found', 'ZIP 文件不存在')
  const stat = fs.statSync(file)
  if (stat.size > LIMITS.maxPackageBytes) return fail('package_too_large', 'ZIP 超过 50MB 限制')
  const buffer = fs.readFileSync(file)
  return importFromZipBuffer(userData, buffer, options)
}

async function importFromHttps(userData, url, options = {}) {
  const valid = validateHttpsUrl(url)
  if (!valid.ok) return valid

  const trustCheck = ensureTrust(userData, options.trust, valid.url, options)
  if (!trustCheck.ok) return trustCheck

  const downloaded = await downloadHttpsBuffer(valid.url, options)
  if (!downloaded.ok) return downloaded

  const lower = valid.url.toLowerCase()
  if (lower.endsWith('.zip')) {
    return importFromZipBuffer(userData, downloaded.buffer, {
      ...options,
      source: 'https',
      originUrl: valid.url,
      trust: trustCheck.trust || options.trust,
    })
  }

  if (lower.endsWith('.json')) {
    let manifest
    try {
      manifest = JSON.parse(downloaded.buffer.toString('utf8'))
    } catch (err) {
      return fail('invalid_json', err.message || 'JSON 解析失败')
    }
    const validated = validateManifestObject(manifest)
    if (!validated.ok) return validated
    const paths = resolvePaths(userData)
    clearStaging(userData)
    const stageRoot = path.join(paths.staging, `https-json-${Date.now()}`)
    fs.mkdirSync(stageRoot, { recursive: true })
    fs.writeFileSync(path.join(stageRoot, 'manifest.json'), JSON.stringify(validated.manifest, null, 2), 'utf8')
    const detected = detectKindFromFolder(stageRoot)
    if (!detected.ok) return detected
    return finalizeInstall(userData, detected, {
      ...options,
      source: 'https',
      originUrl: valid.url,
      trust: trustCheck.trust || options.trust,
      stagingPath: stageRoot,
    })
  }

  return fail('unsupported_https', 'HTTPS 导入仅支持 .zip 或 .json')
}

function installCurated(userData, catalogId, options = {}) {
  const entryResult = getCatalogEntry(userData, catalogId, options)
  if (!entryResult.ok) return entryResult
  const sourceResult = getBundledInstallSource(entryResult.entry, options.bundledRoot)
  if (!sourceResult.ok) return sourceResult

  const staged = stageCopy(userData, sourceResult.bundlePath, {
    stageName: `curated-${catalogId}`,
  })
  if (!staged.ok) return staged

  return installFromStaging(userData, {
    id: entryResult.entry.id,
    kind: entryResult.entry.kind,
    source: 'curated',
    version: entryResult.entry.version,
    trust: entryResult.entry.trust || 'bundled',
    stagingPath: staged.stagingPath,
    enabled: options.enabled !== false,
  })
}

function createCapabilityImport(options = {}) {
  const getUserData = typeof options.getUserData === 'function'
    ? options.getUserData
    : () => String(options.userData || '')

  return {
    importFromFolder: (folderPath, opts) => importFromFolder(getUserData(), folderPath, opts),
    importFromMarkdownFile: (filePath, opts) => importFromMarkdownFile(getUserData(), filePath, opts),
    importFromJsonFile: (filePath, opts) => importFromJsonFile(getUserData(), filePath, opts),
    importFromZipFile: (zipPath, opts) => importFromZipFile(getUserData(), zipPath, opts),
    importFromZipBuffer: (buffer, opts) => importFromZipBuffer(getUserData(), buffer, opts),
    importFromHttps: (url, opts) => importFromHttps(getUserData(), url, opts),
    installCurated: (catalogId, opts) => installCurated(getUserData(), catalogId, opts),
    validateHttpsUrl,
    validateRelativePath,
    parseZipEntries,
    extractZipBuffer,
    scanSecrets,
  }
}

module.exports = {
  LIMITS,
  validateRelativePath,
  validateHttpsUrl,
  scanSecrets,
  validateManifestObject,
  detectKindFromFolder,
  validateFolderTree,
  parseZipEntries,
  extractZipBuffer,
  downloadHttpsBuffer,
  importFromFolder,
  importFromMarkdownFile,
  importFromJsonFile,
  importFromZipFile,
  importFromZipBuffer,
  importFromHttps,
  installCurated,
  createCapabilityImport,
}
