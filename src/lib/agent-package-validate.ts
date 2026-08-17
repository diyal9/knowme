'use strict'

const fs = require('fs')
const path = require('path')
const packageTrust = require('./agent-package-trust')
const {
  PROTOCOL_VERSION,
  SERVICE_ERROR_CODES,
  handshake,
  validateSnapshotHash,
  assertNoPlaintextSecrets,
} = require('./agent-service-protocol')

const AGENT_SCHEMA_VERSION = 1
const TEAM_SCHEMA_VERSION = 1
const PACKAGE_ID_RE = /^[a-z][a-z0-9-]{0,62}$/
const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/
const VALID_NODE_TYPES = new Set([
  'agent', 'gate', 'join', 'human', 'terminal', 'condition',
  'llm', 'tool', 'knowledge',
])
const SPECIALTY_NODE_TYPES = new Set(['llm', 'tool', 'knowledge'])
const VALID_JOIN_STRATEGIES = new Set(['allSucceeded', 'all', 'any', 'anySucceeded'])
const VALID_BACKENDS = new Set(['local-executor', 'cursor-package', 'claude-package', 'daemon-agent'])
const BUILDER_BACKEND_MAP = Object.freeze({
  local: 'local-executor',
  knowme: 'local-executor',
  cursor: 'cursor-package',
  claude: 'claude-package',
  'claude-code': 'claude-package',
  daemon: 'daemon-agent',
  'workbench-daemon': 'daemon-agent',
})

function fail(code, message, extra = {}) {
  return { ok: false, code, error: message, issues: extra.issues || [], ...extra }
}

function ok(payload = {}) {
  return { ok: true, ...payload }
}

function issue(code, message, fieldPath = '') {
  return { code, message, path: fieldPath }
}

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(v => String(v || '').trim()).filter(Boolean))]
}

function computePackageContentHash(manifest, extraFiles = []) {
  return packageTrust.computeIntegrityHash(manifest, extraFiles)
}

function createVersionLock(manifest, contentHash, sourceProvenance = {}) {
  return {
    packageId: manifest.packageId,
    version: manifest.version,
    contentHash: contentHash || computePackageContentHash(manifest),
    hashAlgorithm: packageTrust.HASH_ALGORITHM,
    lockVersion: 2,
    schemaVersion: manifest.schemaVersion,
    protocolVersion: manifest.protocolVersion ?? PROTOCOL_VERSION,
    builder: manifest.builder,
    backend: mapToBackend(manifest),
    lockedAt: new Date().toISOString(),
    sourceProvenance: {
      source: String(sourceProvenance.source || manifest.builder || 'local').trim(),
      ref: sourceProvenance.ref ? String(sourceProvenance.ref).trim() : '',
      originalBuilder: sourceProvenance.originalBuilder
        ? String(sourceProvenance.originalBuilder).trim()
        : manifest.builder,
    },
  }
}

function evaluatePackageTrust(manifest, contentHash, options = {}) {
  if (!options.trustPolicy) return ok({ skipped: true, trustLevel: 'not_evaluated' })
  const permissions = options.permissions || {
    capabilities: manifest.capabilities || {},
    orchestration: manifest.orchestration || {},
  }
  const trust = packageTrust.verifyPackageTrust({
    manifest,
    managedFiles: options.managedFiles,
    expectedContentHash: options.expectedContentHash || options.versionLock?.contentHash || contentHash,
    signature: options.signature,
    permissions,
    policy: options.trustPolicy,
    metrics: options.metrics,
  })
  if (!trust.ok) return trust

  if (options.previousPermissions) {
    const review = packageTrust.verifyPermissionReview({
      previousPermissions: options.previousPermissions,
      nextPermissions: permissions,
      contentHash: trust.contentHash,
      receipt: options.permissionReviewReceipt,
    })
    if (!review.ok) {
      options.metrics?.increment?.('package_trust_rejection_total', 1, { code: review.code })
      return review
    }
    return ok({ ...trust, permissionReview: review })
  }
  return ok(trust)
}

function validateSemver(version, fieldPath) {
  const value = String(version || '').trim()
  if (!SEMVER_RE.test(value)) {
    return issue('invalid_version', 'version 须为 semver', fieldPath)
  }
  return null
}

function validatePackageId(packageId, fieldPath = 'packageId') {
  const value = String(packageId || '').trim()
  if (!PACKAGE_ID_RE.test(value)) {
    return issue('invalid_package_id', 'packageId 须为小写 kebab-case', fieldPath)
  }
  return null
}

function validateJsonSchemaSubset(schema, value, fieldPath = '$') {
  const issues = []
  if (!schema || typeof schema !== 'object') {
    issues.push(issue('invalid_schema', 'schema 必须是对象', fieldPath))
    return { ok: false, issues }
  }

  const type = schema.type ? String(schema.type).trim() : null
  if (type === 'object') {
    if (value == null || typeof value !== 'object' || Array.isArray(value)) {
      issues.push(issue('type_mismatch', '期望 object', fieldPath))
      return { ok: false, issues }
    }
    const required = Array.isArray(schema.required) ? schema.required : []
    for (const key of required) {
      if (!(key in value)) {
        issues.push(issue('missing_required', `缺少必填字段 ${key}`, `${fieldPath}.${key}`))
      }
    }
    const properties = schema.properties && typeof schema.properties === 'object' ? schema.properties : {}
    for (const [key, propSchema] of Object.entries(properties)) {
      if (!(key in value)) continue
      const child = validateJsonSchemaSubset(propSchema, value[key], `${fieldPath}.${key}`)
      if (!child.ok) issues.push(...child.issues)
    }
    return issues.length ? { ok: false, issues } : { ok: true, issues: [] }
  }

  if (type === 'array') {
    if (!Array.isArray(value)) {
      issues.push(issue('type_mismatch', '期望 array', fieldPath))
      return { ok: false, issues }
    }
    if (schema.items) {
      for (let i = 0; i < value.length; i += 1) {
        const child = validateJsonSchemaSubset(schema.items, value[i], `${fieldPath}[${i}]`)
        if (!child.ok) issues.push(...child.issues)
      }
    }
    return issues.length ? { ok: false, issues } : { ok: true, issues: [] }
  }

  if (type === 'string') {
    if (typeof value !== 'string') issues.push(issue('type_mismatch', '期望 string', fieldPath))
    return issues.length ? { ok: false, issues } : { ok: true, issues: [] }
  }

  if (type === 'number' || type === 'integer') {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      issues.push(issue('type_mismatch', `期望 ${type}`, fieldPath))
    } else if (type === 'integer' && !Number.isInteger(value)) {
      issues.push(issue('type_mismatch', '期望 integer', fieldPath))
    }
    return issues.length ? { ok: false, issues } : { ok: true, issues: [] }
  }

  if (type === 'boolean') {
    if (typeof value !== 'boolean') issues.push(issue('type_mismatch', '期望 boolean', fieldPath))
    return issues.length ? { ok: false, issues } : { ok: true, issues: [] }
  }

  return { ok: true, issues: [] }
}

function normalizeCapabilities(raw) {
  if (!raw || typeof raw !== 'object') return { required: [], optional: [] }
  const mapDeps = (values) => (Array.isArray(values) ? values : []).map((item) => {
    if (typeof item === 'string') return { id: item.trim(), required: true }
    if (!item || typeof item !== 'object') return null
    const id = String(item.id || '').trim()
    if (!id) return null
    return {
      id,
      kind: item.kind ? String(item.kind).trim() : undefined,
      required: item.required !== false && item.optional !== true,
    }
  }).filter(Boolean)
  return {
    required: mapDeps(raw.required),
    optional: mapDeps(raw.optional),
  }
}

function normalizeGates(raw) {
  return (Array.isArray(raw) ? raw : []).map((gate, index) => {
    if (!gate || typeof gate !== 'object') return null
    const id = String(gate.id || '').trim()
    if (!id) return null
    const type = String(gate.type || 'smoke').trim()
    return {
      id,
      type,
      params: gate.params && typeof gate.params === 'object' ? gate.params : {},
      description: gate.description ? String(gate.description).trim() : '',
      _index: index,
    }
  }).filter(Boolean)
}

function normalizeTests(raw) {
  return (Array.isArray(raw) ? raw : []).map((test, index) => {
    if (!test || typeof test !== 'object') return null
    const id = String(test.id || '').trim()
    if (!id) return null
    return {
      id,
      fixtureRef: test.fixtureRef ? String(test.fixtureRef).trim() : '',
      expectation: test.expectation && typeof test.expectation === 'object' ? test.expectation : {},
      _index: index,
    }
  }).filter(Boolean)
}

module.exports = {
  fail,
  ok,
  issue,
  uniqueStrings,
  computePackageContentHash,
  createVersionLock,
  evaluatePackageTrust,
  validateSemver,
  validatePackageId,
  validateJsonSchemaSubset,
  normalizeCapabilities,
  normalizeGates,
  normalizeTests,
}
