'use strict'

const { createHash } = require('node:crypto')
const { validateProvidedMaterials } = require('./provided-materials')
const { getViolationClaimLabels } = require('./agent-grounding-labels')

const SCOPE = 'execution_receipts_and_labelled_fields_not_semantic_truth'
const HASH = /^[a-f0-9]{64}$/i

// Debug correlation only, never evidence or an authorization/completion input.
// Hashes avoid retaining an extra rejected answer or field value here; they
// are not encryption and do not certify the truth of the candidate/material.
function normalizeVerificationDiagnostics(raw, { runId } = {}) {
  if (!raw || raw.version !== 1 || raw.scope !== SCOPE
    || typeof raw.runId !== 'string' || !raw.runId || raw.runId.length > 256
    || raw.runId !== runId || typeof raw.candidateHash !== 'string' || !HASH.test(raw.candidateHash)
    || (raw.materialSnapshotHash !== null && (typeof raw.materialSnapshotHash !== 'string'
      || !HASH.test(raw.materialSnapshotHash)))
    || !Array.isArray(raw.fieldChecks)) return null
  for (const key of ['candidateChars', 'materialCount', 'fieldCheckCount']) {
    if (!Number.isSafeInteger(raw[key]) || raw[key] < 0) return null
  }
  const fieldChecks = []
  for (const field of raw.fieldChecks.slice(0, 16)) {
    if (!field || typeof field.valueHash !== 'string' || !HASH.test(field.valueHash)
      || !['source_excerpt', 'unresolved'].includes(field.support)) return null
    const [label] = getViolationClaimLabels({ claimLabels: [field.label] })
    if (label) fieldChecks.push({ label, valueHash: field.valueHash, support: field.support })
  }
  return {
    version: 1,
    runId: raw.runId,
    taskId: typeof raw.taskId === 'string' ? raw.taskId.slice(0, 256) : null,
    candidateHash: raw.candidateHash,
    candidateChars: raw.candidateChars,
    materialSnapshotHash: raw.materialSnapshotHash,
    materialCount: raw.materialCount,
    scope: SCOPE,
    fieldChecks,
    fieldCheckCount: raw.fieldCheckCount,
  }
}

function buildVerificationDiagnostics({ text = '', verification, providedMaterials, runId, taskId } = {}) {
  const materials = validateProvidedMaterials(providedMaterials, { runId, taskId })
  const candidate = String(text)
  const fields = Array.isArray(verification?.metadata?.fieldChecks) ? verification.metadata.fieldChecks : []
  const hash = value => createHash('sha256').update(value, 'utf8').digest('hex')
  return normalizeVerificationDiagnostics({
    version: 1, runId, taskId, scope: SCOPE,
    candidateHash: hash(candidate), candidateChars: candidate.length,
    materialSnapshotHash: materials?.snapshotHash || null,
    materialCount: materials?.items.length || 0,
    fieldCheckCount: fields.length,
    fieldChecks: fields.slice(0, 16).map(field => ({
      label: field.label, valueHash: hash(String(field.value || '')), support: field.support,
    })),
  }, { runId })
}

module.exports = { buildVerificationDiagnostics, normalizeVerificationDiagnostics }
