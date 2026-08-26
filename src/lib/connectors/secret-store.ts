'use strict'

const fs = require('fs')
const path = require('path')

const SECRET_FILE = 'connector-secrets.json'
const MAX_SECRET_LENGTH = 12000

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return { version: 1, connectors: {} } }
}

function writeJsonAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  fs.renameSync(tmp, file)
}

function cleanId(value) {
  return String(value || '').trim().replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120)
}

function createConnectorSecretStore(options = {}) {
  const getUserData = typeof options.getUserData === 'function'
    ? options.getUserData
    : () => String(options.userData || '')
  const secure = options.safeStorage || null
  const file = () => path.join(getUserData(), SECRET_FILE)

  function encryptionReady() {
    try { return Boolean(secure?.isEncryptionAvailable?.()) } catch { return false }
  }

  function protect(value) {
    if (!encryptionReady()) throw new Error('系统安全存储当前不可用，不能保存连接器密钥')
    return secure.encryptString(String(value)).toString('base64')
  }

  function unprotect(value) {
    if (!value || !encryptionReady()) return ''
    try { return secure.decryptString(Buffer.from(String(value), 'base64')).toString('utf8') } catch { return '' }
  }

  function configuredKeys(connectorId) {
    const id = cleanId(connectorId)
    const bucket = readJson(file()).connectors?.[id] || {}
    return Object.keys(bucket).filter((key) => Boolean(bucket[key]))
  }

  function resolveSecrets(connectorId) {
    const id = cleanId(connectorId)
    const bucket = readJson(file()).connectors?.[id] || {}
    const values = {}
    for (const [key, encrypted] of Object.entries(bucket)) {
      const plain = unprotect(encrypted)
      if (plain) values[key] = plain
    }
    return values
  }

  function setSecrets(connectorId, patch = {}) {
    const id = cleanId(connectorId)
    if (!id) return { ok: false, code: 'invalid_args', message: '连接器 ID 不能为空' }
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
      return { ok: false, code: 'invalid_args', message: '密钥配置无效' }
    }
    if (!encryptionReady()) {
      return { ok: false, code: 'encryption_unavailable', message: '系统安全存储当前不可用，未保存任何明文密钥' }
    }
    const doc = readJson(file())
    doc.version = 1
    doc.connectors = doc.connectors && typeof doc.connectors === 'object' ? doc.connectors : {}
    const next = { ...(doc.connectors[id] || {}) }
    for (const [rawKey, rawValue] of Object.entries(patch)) {
      const key = cleanId(rawKey)
      if (!key) continue
      if (rawValue == null || String(rawValue) === '') delete next[key]
      else next[key] = protect(String(rawValue).slice(0, MAX_SECRET_LENGTH))
    }
    if (Object.keys(next).length) doc.connectors[id] = next
    else delete doc.connectors[id]
    writeJsonAtomic(file(), doc)
    return { ok: true, configuredKeys: Object.keys(next) }
  }

  function removeConnector(connectorId) {
    const id = cleanId(connectorId)
    const doc = readJson(file())
    if (!doc.connectors?.[id]) return { ok: true, removed: false }
    delete doc.connectors[id]
    writeJsonAtomic(file(), doc)
    return { ok: true, removed: true }
  }

  return { file, encryptionReady, configuredKeys, resolveSecrets, setSecrets, removeConnector }
}

module.exports = { SECRET_FILE, createConnectorSecretStore }
