'use strict'

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const PACK_STATE_SCHEMA = 1
const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown'])

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return null }
}

function writeFileAtomic(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
  fs.writeFileSync(tmp, content, 'utf8')
  fs.renameSync(tmp, file)
}

function listMarkdownFiles(root) {
  const files = []
  if (!fs.existsSync(root)) return files
  const visit = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name))
    for (const entry of entries) {
      const absolute = path.join(dir, entry.name)
      if (entry.isSymbolicLink()) continue
      if (entry.isDirectory()) visit(absolute)
      else if (entry.isFile() && MARKDOWN_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) files.push(absolute)
    }
  }
  visit(root)
  return files
}

function materializeMarkdown(source, packId) {
  const prefix = `/raw/packs/${packId}/kb/okf/`
  return String(source || '').replace(/\]\(\/(?!\/)([^)#?]+)((?:#[^)]+)?)\)/g, (_match, href, anchor) => {
    if (href.startsWith(`raw/packs/${packId}/`)) return `](/${href}${anchor || ''})`
    return `](${prefix}${href}${anchor || ''})`
  })
}

/**
 * Sync a bundled Markdown pack into Knowledge OS without overwriting files the
 * user changed after a previous sync. Stale files are intentionally retained.
 */
function syncBundledKnowledgePack(options = {}) {
  const packId = String(options.packId || '').trim()
  const version = String(options.version || '1.0.0').trim()
  const packRoot = path.resolve(String(options.packRoot || ''))
  const wikiRoot = path.resolve(String(options.wikiRoot || ''))
  if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(packId)) throw new Error('invalid knowledge pack id')
  if (!fs.existsSync(packRoot) || !fs.statSync(packRoot).isDirectory()) throw new Error(`knowledge pack missing: ${packRoot}`)

  const targetRoot = path.join(wikiRoot, 'raw', 'packs', packId)
  const markerFile = path.join(wikiRoot, '.knowme', 'packs', `${packId}.json`)
  const previous = readJson(markerFile)
  const previousFiles = previous?.schemaVersion === PACK_STATE_SCHEMA && previous?.packId === packId
    ? previous.files || {}
    : {}
  const nextFiles = {}
  const created = []
  const updated = []
  const unchanged = []
  const conflicts = []

  for (const sourceFile of listMarkdownFiles(packRoot)) {
    const relative = path.relative(packRoot, sourceFile).replace(/\\/g, '/')
    if (!relative || relative.startsWith('../')) continue
    const targetFile = path.join(targetRoot, ...relative.split('/'))
    const sourceText = materializeMarkdown(fs.readFileSync(sourceFile, 'utf8'), packId)
    const sourceHash = sha256(sourceText)
    const targetExists = fs.existsSync(targetFile)
    const targetText = targetExists ? fs.readFileSync(targetFile, 'utf8') : ''
    const targetHash = targetExists ? sha256(targetText) : ''
    const prior = previousFiles[relative] || null

    if (!targetExists) {
      writeFileAtomic(targetFile, sourceText)
      created.push(relative)
      nextFiles[relative] = { sourceHash, installedHash: sourceHash }
      continue
    }
    if (targetHash === sourceHash) {
      unchanged.push(relative)
      nextFiles[relative] = { sourceHash, installedHash: sourceHash }
      continue
    }
    if (prior?.installedHash && targetHash === prior.installedHash) {
      writeFileAtomic(targetFile, sourceText)
      updated.push(relative)
      nextFiles[relative] = { sourceHash, installedHash: sourceHash }
      continue
    }

    conflicts.push(relative)
    nextFiles[relative] = {
      sourceHash,
      installedHash: String(prior?.installedHash || ''),
      conflictHash: targetHash,
    }
  }

  writeFileAtomic(markerFile, `${JSON.stringify({
    schemaVersion: PACK_STATE_SCHEMA,
    packId,
    version,
    sourceRoot: packRoot,
    targetRoot,
    syncedAt: new Date().toISOString(),
    files: nextFiles,
  }, null, 2)}\n`)

  return {
    ok: true,
    packId,
    version,
    changed: created.length > 0 || updated.length > 0,
    created,
    updated,
    unchanged,
    conflicts,
    targetRoot,
    markerFile,
  }
}

module.exports = {
  PACK_STATE_SCHEMA,
  listMarkdownFiles,
  materializeMarkdown,
  syncBundledKnowledgePack,
}
