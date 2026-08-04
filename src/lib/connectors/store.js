'use strict'

const fs = require('fs')
const path = require('path')
const { mergeWithDefaults, normalizeConnector } = require('./normalize')

function connectorsPath(userData) {
  return path.join(String(userData || ''), 'connectors.json')
}

function loadConnectors(userData) {
  const file = connectorsPath(userData)
  let raw = null
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    raw = null
  }
  const list = Array.isArray(raw?.connectors) ? raw.connectors : Array.isArray(raw) ? raw : []
  return mergeWithDefaults(list)
}

function saveConnectors(userData, connectors) {
  const file = connectorsPath(userData)
  const list = (Array.isArray(connectors) ? connectors : []).map((c) => normalizeConnector(c))
  const dir = path.dirname(file)
  fs.mkdirSync(dir, { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify({ version: 1, connectors: list }, null, 2), 'utf8')
  fs.renameSync(tmp, file)
  return list
}

function upsertConnector(userData, patch) {
  const list = loadConnectors(userData)
  const next = normalizeConnector(patch)
  const idx = list.findIndex((c) => c.id === next.id)
  if (idx >= 0) {
    list[idx] = normalizeConnector({ ...list[idx], ...next, id: list[idx].id })
  } else {
    list.push(next)
  }
  return saveConnectors(userData, list)
}

function setAllowlist(userData, connectorId, allowlist) {
  const list = loadConnectors(userData)
  const idx = list.findIndex((c) => c.id === String(connectorId || '').trim())
  if (idx < 0) return { ok: false, code: 'not_found', connectors: list }
  list[idx] = normalizeConnector({ ...list[idx], allowlist })
  const saved = saveConnectors(userData, list)
  return { ok: true, connectors: saved }
}

function removeConnector(userData, connectorId) {
  const id = String(connectorId || '').trim()
  const list = loadConnectors(userData)
  const next = list.filter((connector) => connector.id !== id)
  if (next.length === list.length) return { ok: false, code: 'not_found', connectors: list }
  return { ok: true, connectors: saveConnectors(userData, next) }
}

module.exports = {
  connectorsPath,
  loadConnectors,
  saveConnectors,
  upsertConnector,
  setAllowlist,
  removeConnector,
}
