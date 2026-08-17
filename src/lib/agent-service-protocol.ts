'use strict'

const crypto = require('crypto')

const PROTOCOL_VERSION = 1
const SUPPORTED_PROTOCOL_VERSIONS = [1]
const MAX_PAYLOAD_BYTES = 32 * 1024

const SERVICE_ERROR_CODES = Object.freeze({
  PROTOCOL_VERSION_UNSUPPORTED: 'protocol_version_unsupported',
  SNAPSHOT_MISMATCH: 'snapshot_mismatch',
  CAPABILITY_MISSING: 'capability_missing',
  AUTH_REQUIRED: 'auth_required',
  BUDGET_EXCEEDED: 'budget_exceeded',
  CANCEL_TIMEOUT: 'cancel_timeout',
  RESUME_INVALID: 'resume_invalid',
  REMOTE_UNAVAILABLE: 'remote_unavailable',
  HANDOFF_SCHEMA_INVALID: 'handoff_schema_invalid',
  OUTPUT_SCHEMA_INVALID: 'output_schema_invalid',
  SECRET_PLAINTEXT_BLOCKED: 'secret_plaintext_blocked',
  PAYLOAD_TOO_LARGE: 'payload_too_large',
})

const SECRET_FIELD_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /authorization/i,
  /oauth/i,
  /credential/i,
  /private[_-]?key/i,
]

const TASK_CAPABILITIES = Object.freeze([
  'executeAgentRun',
  'cancelRun',
  'resumeRun',
  'fetchRunStatus',
])

function serviceError(code, message, extra = {}) {
  return {
    ok: false,
    code: String(code || 'remote_unavailable'),
    error: String(message || code || '未知错误'),
    retriable: extra.retriable === true,
    ...extra,
  }
}

function serviceOk(payload = {}) {
  return { ok: true, ...payload }
}

function stableHash(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 16)
}

function isSecretFieldName(name) {
  const key = String(name || '')
  return SECRET_FIELD_PATTERNS.some(re => re.test(key))
}

function redactSecrets(value, path = '', redactedFields = []) {
  if (value == null || typeof value !== 'object') return { value, redactedFields }
  if (Array.isArray(value)) {
    const out = []
    for (let i = 0; i < value.length; i += 1) {
      const child = redactSecrets(value[i], `${path}[${i}]`, redactedFields)
      out.push(child.value)
    }
    return { value: out, redactedFields }
  }

  const out = {}
  for (const [key, nested] of Object.entries(value)) {
    const fieldPath = path ? `${path}.${key}` : key
    if (isSecretFieldName(key)) {
      out[key] = '[REDACTED]'
      redactedFields.push(fieldPath)
      continue
    }
    if (nested && typeof nested === 'object') {
      const child = redactSecrets(nested, fieldPath, redactedFields)
      out[key] = child.value
      continue
    }
    out[key] = nested
  }
  return { value: out, redactedFields }
}

function assertNoPlaintextSecrets(payload) {
  if (payload == null || typeof payload !== 'object') return serviceOk()
  const walk = (node, path) => {
    if (node == null || typeof node !== 'object') return null
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i += 1) {
        const err = walk(node[i], `${path}[${i}]`)
        if (err) return err
      }
      return null
    }
    for (const [key, value] of Object.entries(node)) {
      const fieldPath = path ? `${path}.${key}` : key
      if (isSecretFieldName(key) && typeof value === 'string' && value.length > 0 && value !== '[REDACTED]') {
        return serviceError(
          SERVICE_ERROR_CODES.SECRET_PLAINTEXT_BLOCKED,
          `敏感字段禁止明文传输: ${fieldPath}`,
          { path: fieldPath },
        )
      }
      if (value && typeof value === 'object') {
        const err = walk(value, fieldPath)
        if (err) return err
      }
    }
    return null
  }
  const blocked = walk(payload, '')
  return blocked || serviceOk()
}

function payloadByteSize(payload) {
  try {
    return Buffer.byteLength(JSON.stringify(payload ?? null), 'utf8')
  } catch {
    return Infinity
  }
}

function intersectCapabilities(local = [], remote = []) {
  const localSet = new Set((Array.isArray(local) ? local : []).map(String))
  const remoteSet = new Set((Array.isArray(remote) ? remote : []).map(String))
  return TASK_CAPABILITIES.filter(cap => localSet.has(cap) && remoteSet.has(cap))
}

function negotiateProtocolVersion(localVersions = SUPPORTED_PROTOCOL_VERSIONS, remoteVersions = []) {
  const local = (Array.isArray(localVersions) ? localVersions : [localVersions])
    .map(Number)
    .filter(Number.isFinite)
  const remote = (Array.isArray(remoteVersions) ? remoteVersions : [remoteVersions])
    .map(Number)
    .filter(Number.isFinite)
  const common = local.filter(v => remote.includes(v)).sort((a, b) => b - a)
  if (!common.length) {
    return serviceError(
      SERVICE_ERROR_CODES.PROTOCOL_VERSION_UNSUPPORTED,
      `无共同 protocolVersion（local=${local.join(',')} remote=${remote.join(',')}）`,
      { localVersions: local, remoteVersions: remote },
    )
  }
  return serviceOk({ negotiatedVersion: common[0] })
}

function handshake(local = {}, remote = {}) {
  const localVersion = Number(local.protocolVersion ?? PROTOCOL_VERSION)
  const remoteVersion = Number(remote.protocolVersion ?? remote.builderProtocolVersion ?? 0)
  const negotiated = negotiateProtocolVersion(
    local.supportedVersions || SUPPORTED_PROTOCOL_VERSIONS,
    remote.supportedVersions || [remoteVersion],
  )
  if (!negotiated.ok) return negotiated

  const supportedCapabilities = intersectCapabilities(
    local.supportedCapabilities || TASK_CAPABILITIES,
    remote.supportedCapabilities || TASK_CAPABILITIES,
  )
  if (!supportedCapabilities.length) {
    return serviceError(
      SERVICE_ERROR_CODES.CAPABILITY_MISSING,
      '握手后无可用任务能力交集',
      { missingCapabilities: TASK_CAPABILITIES.filter(c => !(remote.supportedCapabilities || TASK_CAPABILITIES).includes(c)) },
    )
  }

  return serviceOk({
    negotiatedVersion: negotiated.negotiatedVersion,
    builderId: String(remote.builderId || remote.builder || 'unknown').trim(),
    authMode: String(remote.authMode || local.authMode || 'none').trim(),
    runStoreCompat: Boolean(remote.runStoreCompat ?? local.runStoreCompat ?? true),
    supportedCapabilities,
    handshakeHash: stableHash({
      negotiatedVersion: negotiated.negotiatedVersion,
      builderId: remote.builderId || remote.builder,
      supportedCapabilities,
    }),
  })
}

function createTaskBinding(spec = {}) {
  const runId = String(spec.runId || '').trim()
  const agentPackageId = String(spec.agentPackageId || spec.packageId || '').trim()
  const packageSnapshotHash = String(spec.packageSnapshotHash || spec.snapshotHash || '').trim()
  const governanceEnvelope = spec.governanceEnvelope && typeof spec.governanceEnvelope === 'object'
    ? spec.governanceEnvelope
    : {}
  const inputPayload = spec.inputPayload ?? spec.input ?? {}

  if (!runId) return serviceError('invalid_task', '缺少 runId')
  if (!agentPackageId) return serviceError('invalid_task', '缺少 agentPackageId')
  if (!packageSnapshotHash) return serviceError('invalid_task', '缺少 packageSnapshotHash')

  const size = payloadByteSize(inputPayload)
  if (size > MAX_PAYLOAD_BYTES) {
    return serviceError(
      SERVICE_ERROR_CODES.PAYLOAD_TOO_LARGE,
      `inputPayload 超过 ${MAX_PAYLOAD_BYTES} 字节`,
      { bytes: size },
    )
  }

  const secretGuard = assertNoPlaintextSecrets(inputPayload)
  if (!secretGuard.ok) return secretGuard

  const redacted = redactSecrets(inputPayload)
  return serviceOk({
    binding: {
      runId,
      agentPackageId,
      packageSnapshotHash,
      governanceEnvelope,
      inputPayload: redacted.value,
      redactedFields: redacted.redactedFields,
      protocolVersion: Number(spec.protocolVersion ?? PROTOCOL_VERSION),
      idempotencyKey: spec.idempotencyKey ? String(spec.idempotencyKey).trim() : '',
    },
  })
}

function validateSnapshotHash(expectedHash, manifestOrSnapshot = {}) {
  const expected = String(expectedHash || '').trim()
  const actual = String(
    manifestOrSnapshot.contentHash
    || manifestOrSnapshot.packageSnapshotHash
    || manifestOrSnapshot.snapshotHash
    || '',
  ).trim()
  if (!expected || !actual) {
    return serviceError('invalid_snapshot', '缺少 snapshot hash')
  }
  if (expected !== actual) {
    return serviceError(
      SERVICE_ERROR_CODES.SNAPSHOT_MISMATCH,
      `packageSnapshotHash 不匹配（expected=${expected} actual=${actual}）`,
      { expected, actual },
    )
  }
  return serviceOk({ snapshotHash: actual })
}

function createServiceEnvelope(kind, payload = {}, meta = {}) {
  const redacted = redactSecrets(payload)
  const body = {
    protocolVersion: Number(meta.protocolVersion ?? PROTOCOL_VERSION),
    messageId: meta.messageId || crypto.randomUUID(),
    correlationId: meta.correlationId ? String(meta.correlationId) : '',
    runId: meta.runId ? String(meta.runId) : '',
    kind: String(kind || 'progress'),
    ts: meta.ts || new Date().toISOString(),
    payload: redacted.value,
    redactedFields: redacted.redactedFields,
  }
  if (meta.terminal) body.terminal = String(meta.terminal)
  return body
}

function mapRemoteError(raw = {}) {
  const code = String(raw.code || raw.errorCode || SERVICE_ERROR_CODES.REMOTE_UNAVAILABLE).trim()
  const known = Object.values(SERVICE_ERROR_CODES)
  const normalizedCode = known.includes(code) ? code : SERVICE_ERROR_CODES.REMOTE_UNAVAILABLE
  return serviceError(
    normalizedCode,
    String(raw.message || raw.error || normalizedCode),
    {
      retriable: raw.retriable === true || normalizedCode === SERVICE_ERROR_CODES.REMOTE_UNAVAILABLE,
      remote: true,
      details: raw.details && typeof raw.details === 'object' ? raw.details : undefined,
    },
  )
}

function mapTerminalStatus(status) {
  const value = String(status || '').trim().toLowerCase()
  if (value === 'completed' || value === 'done' || value === 'success') return 'completed'
  if (value === 'cancelled' || value === 'canceled') return 'cancelled'
  if (value === 'failed' || value === 'error') return 'failed'
  return 'failed'
}

module.exports = {
  PROTOCOL_VERSION,
  SUPPORTED_PROTOCOL_VERSIONS,
  MAX_PAYLOAD_BYTES,
  SERVICE_ERROR_CODES,
  TASK_CAPABILITIES,
  serviceError,
  serviceOk,
  stableHash,
  isSecretFieldName,
  redactSecrets,
  assertNoPlaintextSecrets,
  payloadByteSize,
  intersectCapabilities,
  negotiateProtocolVersion,
  handshake,
  createTaskBinding,
  validateSnapshotHash,
  createServiceEnvelope,
  mapRemoteError,
  mapTerminalStatus,
}
