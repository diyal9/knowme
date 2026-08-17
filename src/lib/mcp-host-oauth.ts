'use strict'

const fs = require('fs')
const path = require('path')
const { sanitizeConnectorId } = require('./mcp-host-names')

function oauthDir(userData) {
  return path.join(String(userData || ''), 'mcp-oauth')
}

function schemaCacheDir(userData) {
  return path.join(String(userData || ''), 'mcp-schemas')
}

function loadOAuthTokens(userData, connectorId) {
  try {
    const file = path.join(oauthDir(userData), `${sanitizeConnectorId(connectorId)}.json`)
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function saveOAuthTokens(userData, connectorId, tokens = {}) {
  const dir = oauthDir(userData)
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `${sanitizeConnectorId(connectorId)}.json`)
  fs.writeFileSync(file, JSON.stringify({ ...tokens, updatedAt: new Date().toISOString() }, null, 2), 'utf8')
}

async function refreshOAuthToken(userData, connectorId, refreshFn) {
  const current = loadOAuthTokens(userData, connectorId)
  if (!current?.refresh_token || typeof refreshFn !== 'function') return current
  try {
    const next = await refreshFn(current)
    if (next?.access_token) saveOAuthTokens(userData, connectorId, { ...current, ...next })
    return next || current
  } catch {
    return current
  }
}

function loadSchemaCache(userData, connectorId) {
  try {
    const file = path.join(schemaCacheDir(userData), `${sanitizeConnectorId(connectorId)}.json`)
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
    return Array.isArray(raw?.tools) ? raw.tools : []
  } catch {
    return null
  }
}

function saveSchemaCache(userData, connectorId, tools = []) {
  const dir = schemaCacheDir(userData)
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `${sanitizeConnectorId(connectorId)}.json`)
  fs.writeFileSync(file, JSON.stringify({ tools, cachedAt: new Date().toISOString() }, null, 2), 'utf8')
}

module.exports = {
  oauthDir,
  schemaCacheDir,
  loadOAuthTokens,
  saveOAuthTokens,
  refreshOAuthToken,
  loadSchemaCache,
  saveSchemaCache,
}
