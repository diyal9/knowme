'use strict'

const crypto = require('crypto')
const { createAgentRuntimeMetrics } = require('./agent-runtime-metrics')

const HASH_ALGORITHM = 'sha256'
const SIGNATURE_ALGORITHM = 'Ed25519'
const FULL_SHA256_RE = /^[a-f0-9]{64}$/
const LEGACY_HASH_RE = /^[a-f0-9]{16}$/

function stableCanonicalize(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableCanonicalize).join(',')}]`
  const entries = Object.keys(value)
    .sort()
    .filter(key => value[key] !== undefined)
    .map(key => `${JSON.stringify(key)}:${stableCanonicalize(value[key])}`)
  return `{${entries.join(',')}}`
}

function sha256Hex(value) {
  const input = Buffer.isBuffer(value) ? value : Buffer.from(String(value), 'utf8')
  return crypto.createHash(HASH_ALGORITHM).update(input).digest('hex')
}

function computeIntegrityHash(manifest, managedFiles = []) {
  const hash = crypto.createHash(HASH_ALGORITHM)
  hash.update(stableCanonicalize(manifest), 'utf8')
  for (const file of managedFiles) {
    const entry = typeof file === 'string'
      ? { path: '', content: file }
      : { path: String(file?.path || ''), content: file?.content ?? '' }
    hash.update('\0', 'utf8')
    hash.update(entry.path, 'utf8')
    hash.update('\0', 'utf8')
    hash.update(Buffer.isBuffer(entry.content) ? entry.content : Buffer.from(String(entry.content), 'utf8'))
  }
  return hash.digest('hex')
}

function permissionDigest(permissions = {}) {
  return sha256Hex(stableCanonicalize(permissions || {}))
}

function createSignaturePayload(input = {}) {
  return Buffer.from(stableCanonicalize({
    packageId: String(input.packageId || ''),
    version: String(input.version || ''),
    contentHash: String(input.contentHash || ''),
    permissionDigest: String(input.permissionDigest || permissionDigest(input.permissions)),
  }), 'utf8')
}

function signPackage(input = {}, privateKey) {
  if (!privateKey) throw new Error('signPackage requires privateKey')
  const contentHash = String(input.contentHash || computeIntegrityHash(input.manifest, input.managedFiles))
  if (!FULL_SHA256_RE.test(contentHash)) throw new Error('signPackage requires full SHA-256 contentHash')
  const permissionsHash = String(input.permissionDigest || permissionDigest(input.permissions))
  const payload = createSignaturePayload({
    packageId: input.packageId || input.manifest?.packageId,
    version: input.version || input.manifest?.version,
    contentHash,
    permissionDigest: permissionsHash,
  })
  return {
    algorithm: SIGNATURE_ALGORITHM,
    publisherId: String(input.publisherId || ''),
    keyId: String(input.keyId || ''),
    contentHash,
    permissionDigest: permissionsHash,
    signature: crypto.sign(null, payload, privateKey).toString('base64'),
  }
}

function normalizeTrustPolicy(policy = {}) {
  return {
    mode: policy.mode === 'strict' ? 'strict' : 'compatible',
    allowIntegrityOnly: policy.allowIntegrityOnly === true,
    allowLegacyHash: policy.allowLegacyHash === true,
    trustedPublishers: policy.trustedPublishers && typeof policy.trustedPublishers === 'object'
      ? policy.trustedPublishers
      : {},
    revokedPublisherIds: new Set(policy.revokedPublisherIds || []),
    revokedKeyIds: new Set(policy.revokedKeyIds || []),
  }
}

function reject(metrics, code, message, extra = {}) {
  metrics.increment('package_trust_rejection_total', 1, { code })
  return { ok: false, code, message, trustLevel: 'rejected', ...extra }
}

function resolveTrustedKey(policy, publisherId, keyId) {
  const publisher = policy.trustedPublishers[publisherId]
  if (!publisher) return null
  if (publisher.keys && typeof publisher.keys === 'object') return publisher.keys[keyId] || null
  if (publisher.keyId === keyId) return publisher.publicKey || null
  return publisher[keyId] || null
}

function verifyPackageTrust(input = {}) {
  const metrics = input.metrics || createAgentRuntimeMetrics()
  const policy = normalizeTrustPolicy(input.policy)
  const actualContentHash = computeIntegrityHash(input.manifest, input.managedFiles)
  const expectedContentHash = String(
    input.expectedContentHash
    || input.lock?.contentHash
    || input.signature?.contentHash
    || '',
  )

  if (expectedContentHash && LEGACY_HASH_RE.test(expectedContentHash)) {
    if (!policy.allowLegacyHash) {
      return reject(metrics, 'package_legacy_hash', '旧 16 位内容哈希须显式重新锁定', {
        migrationRequired: true,
        actualContentHash,
      })
    }
    return {
      ok: policy.mode !== 'strict',
      code: 'package_hash_migration_required',
      message: '旧哈希仅可用于迁移，未认证发布者身份',
      migrationRequired: true,
      trustLevel: 'legacy_integrity_unverified',
      contentHash: actualContentHash,
      authenticatedPublisher: false,
    }
  }

  if (expectedContentHash && !FULL_SHA256_RE.test(expectedContentHash)) {
    return reject(metrics, 'package_integrity_format_invalid', 'Package 内容锁不是完整 SHA-256')
  }
  if (expectedContentHash && expectedContentHash !== actualContentHash) {
    return reject(metrics, 'package_integrity_mismatch', 'Package 内容与 SHA-256 锁不一致', {
      expectedContentHash,
      actualContentHash,
    })
  }

  const signature = input.signature
  if (!signature) {
    if (policy.mode === 'strict' || !policy.allowIntegrityOnly) {
      return reject(metrics, 'package_signature_required', '信任策略要求可信发布者签名', {
        contentHash: actualContentHash,
        authenticatedPublisher: false,
      })
    }
    return {
      ok: true,
      trustLevel: 'integrity_only',
      contentHash: actualContentHash,
      authenticatedPublisher: false,
    }
  }

  const publisherId = String(signature.publisherId || '')
  const keyId = String(signature.keyId || '')
  if (String(signature.algorithm || '') !== SIGNATURE_ALGORITHM) {
    return reject(metrics, 'package_signature_algorithm_unsupported', '仅支持 Ed25519 Package 签名')
  }
  if (policy.revokedPublisherIds.has(publisherId) || policy.revokedKeyIds.has(keyId)) {
    return reject(metrics, 'package_publisher_revoked', 'Package 发布者或密钥已撤销', {
      publisherId,
      keyId,
    })
  }
  const publicKey = resolveTrustedKey(policy, publisherId, keyId)
  if (!publicKey) {
    return reject(metrics, 'package_publisher_untrusted', 'Package 发布者或 keyId 不在信任策略中', {
      publisherId,
      keyId,
    })
  }
  if (signature.contentHash !== actualContentHash) {
    return reject(metrics, 'package_integrity_mismatch', '签名绑定的内容哈希与实际内容不一致')
  }
  const actualPermissionDigest = permissionDigest(input.permissions)
  if (signature.permissionDigest !== actualPermissionDigest) {
    return reject(metrics, 'package_signature_payload_mismatch', '签名绑定的权限摘要与实际权限不一致')
  }

  let valid = false
  try {
    valid = crypto.verify(
      null,
      createSignaturePayload({
        packageId: input.manifest?.packageId,
        version: input.manifest?.version,
        contentHash: actualContentHash,
        permissionDigest: actualPermissionDigest,
      }),
      publicKey,
      Buffer.from(String(signature.signature || ''), 'base64'),
    )
  } catch {
    valid = false
  }
  if (!valid) {
    return reject(metrics, 'package_signature_invalid', 'Package Ed25519 签名校验失败', {
      publisherId,
      keyId,
    })
  }

  metrics.increment('package_trust_verified_total', 1, { outcome: 'verified_publisher' })
  return {
    ok: true,
    trustLevel: 'verified_publisher',
    contentHash: actualContentHash,
    publisherId,
    keyId,
    authenticatedPublisher: true,
  }
}

function flattenPermissions(value, prefix = '', output = new Map()) {
  if (Array.isArray(value)) {
    output.set(prefix, [...new Set(value.map(item => stableCanonicalize(item)))].sort())
    return output
  }
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value).sort()) {
      flattenPermissions(value[key], prefix ? `${prefix}.${key}` : key, output)
    }
    return output
  }
  output.set(prefix, value)
  return output
}

function diffPermissions(previous = {}, next = {}) {
  const before = flattenPermissions(previous)
  const after = flattenPermissions(next)
  const expanded = []
  const reduced = []
  for (const [path, nextValue] of after.entries()) {
    if (!before.has(path)) {
      expanded.push({ path, before: undefined, after: nextValue })
      continue
    }
    const previousValue = before.get(path)
    if (Array.isArray(nextValue) && Array.isArray(previousValue)) {
      const added = nextValue.filter(item => !previousValue.includes(item))
      const removed = previousValue.filter(item => !nextValue.includes(item))
      if (added.length) expanded.push({ path, added })
      if (removed.length) reduced.push({ path, removed })
    } else if (previousValue === false && nextValue === true) {
      expanded.push({ path, before: previousValue, after: nextValue })
    } else if (typeof previousValue === 'number' && typeof nextValue === 'number') {
      if (nextValue > previousValue) expanded.push({ path, before: previousValue, after: nextValue })
      if (nextValue < previousValue) reduced.push({ path, before: previousValue, after: nextValue })
    } else if (stableCanonicalize(previousValue) !== stableCanonicalize(nextValue)) {
      expanded.push({ path, before: previousValue, after: nextValue })
    }
  }
  for (const [path, previousValue] of before.entries()) {
    if (!after.has(path)) reduced.push({ path, before: previousValue, after: undefined })
  }
  return { expanded, reduced, requiresReview: expanded.length > 0 }
}

function verifyPermissionReview(input = {}) {
  const diff = diffPermissions(input.previousPermissions, input.nextPermissions)
  if (!diff.requiresReview) return { ok: true, reviewed: false, diff }
  const expectedDigest = permissionDigest(input.nextPermissions)
  const receipt = input.receipt
  if (!receipt
    || receipt.approved !== true
    || receipt.contentHash !== input.contentHash
    || receipt.permissionDigest !== expectedDigest) {
    return {
      ok: false,
      code: 'package_permission_review_required',
      message: 'Package 权限扩大须匹配当前内容哈希的显式审阅收据',
      diff,
      permissionDigest: expectedDigest,
    }
  }
  return { ok: true, reviewed: true, diff, permissionDigest: expectedDigest }
}

module.exports = {
  HASH_ALGORITHM,
  SIGNATURE_ALGORITHM,
  FULL_SHA256_RE,
  LEGACY_HASH_RE,
  stableCanonicalize,
  sha256Hex,
  computeIntegrityHash,
  permissionDigest,
  createSignaturePayload,
  signPackage,
  normalizeTrustPolicy,
  verifyPackageTrust,
  flattenPermissions,
  diffPermissions,
  verifyPermissionReview,
}
