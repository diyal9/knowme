'use strict'

// Host-owned task grants. Never deserialize authority from model/session payloads.
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

function taskCapabilityIdentity(session = {}) {
  return {
    sessionId: String(session.id || ''),
    taskId: String(session.taskRef?.id || session.id || ''),
    agentId: String(session.expertId || session.agentId || 'general'),
  }
}

function sameTaskCapabilityIdentity(a, b) {
  return Boolean(a?.sessionId && a?.taskId && a?.agentId)
    && ['sessionId', 'taskId', 'agentId'].every(key => a[key] === b?.[key])
}

function loadTaskCapabilityGrants(userData, session) {
  if (!userData) return []
  try {
    const rows = JSON.parse(fs.readFileSync(path.join(userData, 'task-capability-grants.json'), 'utf8')).grants
    if (!Array.isArray(rows)) return []
    return session ? rows.filter(row => sameTaskCapabilityIdentity(row, taskCapabilityIdentity(session))) : rows
  } catch { return [] }
}

function saveTaskCapabilityGrants(userData, grants) {
  if (!userData) throw new Error('Missing host userData directory')
  fs.mkdirSync(userData, { recursive: true })
  const file = path.join(userData, 'task-capability-grants.json')
  const temp = `${file}.${crypto.randomUUID()}.tmp`
  fs.writeFileSync(temp, JSON.stringify({ version: 1, grants }, null, 2), 'utf8')
  fs.renameSync(temp, file)
}

// Only called by the trusted host approval route after policy/catalog validation.
function recordTaskCapabilityGrant(userData, session, capabilityKind, capabilityId, draftId) {
  const identity = taskCapabilityIdentity(session)
  if (!identity.sessionId || !['skills', 'connectors', 'knowledge'].includes(capabilityKind) || !capabilityId) {
    throw new Error('Invalid task capability grant')
  }
  const grants = loadTaskCapabilityGrants(userData)
  const grant = {
    id: crypto.randomUUID(), ...identity, capabilityKind, capabilityId,
    draftId, approvedBy: 'user', approvedAt: new Date().toISOString(), revokedAt: null,
  }
  grants.push(grant)
  saveTaskCapabilityGrants(userData, grants)
  return grant
}

function revokeTaskCapabilityGrant(userData, session, grantId) {
  const grants = loadTaskCapabilityGrants(userData)
  const grant = grants.find(row => row.id === grantId
    && sameTaskCapabilityIdentity(row, taskCapabilityIdentity(session)))
  if (!grant) return { ok: false, code: 'not_found', message: '任务授权不存在' }
  grant.revokedAt = new Date().toISOString()
  saveTaskCapabilityGrants(userData, grants)
  return { ok: true, grantId, restartRequired: true, message: '已撤销任务授权' }
}

module.exports = {
  taskCapabilityIdentity, sameTaskCapabilityIdentity, loadTaskCapabilityGrants,
  recordTaskCapabilityGrant, revokeTaskCapabilityGrant,
}
