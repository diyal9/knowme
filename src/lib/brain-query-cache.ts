'use strict'

/** Short-lived federated retrieval cache. It is never part of durable Brain state. */
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const DEFAULT_TTL_MS = 15 * 60 * 1000

function cacheDir(userData) {
  return path.join(userData, 'knowledge-os', 'cache', 'brain-query')
}

function keyFor(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex')
}

function cacheFile(userData, key) {
  return path.join(cacheDir(userData), `${key}.json`)
}

function read(userData, key, at = Date.now()) {
  const file = cacheFile(userData, key)
  try {
    const value = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (!value || Number(value.expiresAt || 0) <= at) {
      try { fs.unlinkSync(file) } catch { /* expiry cleanup is best effort */ }
      return null
    }
    return Array.isArray(value.hits) ? value.hits : null
  } catch { return null }
}

function write(userData, key, hits, ttlMs = DEFAULT_TTL_MS) {
  const dir = cacheDir(userData)
  fs.mkdirSync(dir, { recursive: true })
  const file = cacheFile(userData, key)
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`
  const value = {
    version: 1,
    createdAt: Date.now(),
    expiresAt: Date.now() + Math.max(1000, Number(ttlMs) || DEFAULT_TTL_MS),
    hits: Array.isArray(hits) ? hits : [],
  }
  fs.writeFileSync(temp, JSON.stringify(value), 'utf8')
  try {
    if (fs.existsSync(file)) fs.unlinkSync(file)
    fs.renameSync(temp, file)
  } catch (error) {
    try { if (fs.existsSync(temp)) fs.unlinkSync(temp) } catch { /* cleanup */ }
    throw error
  }
  return value.hits
}

module.exports = { DEFAULT_TTL_MS, cacheDir, keyFor, read, write }
