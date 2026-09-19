'use strict'

const { createHash } = require('node:crypto')
const { validateProvidedMaterials } = require('./provided-materials')
const { getViolationClaimLabels } = require('./agent-grounding-labels')
const { collectGroundingSources } = require('./agent-grounding-ledger')

// Internal, transient repair input. Never persist this additional copy of the
// rejected answer, promote it to authority, or treat a matching hash as truth.
const MAX_REPAIR_BYTES = 128 * 1024
const SCOPE = 'execution_receipts_and_labelled_fields_not_semantic_truth'

function buildGroundingRepairContext({ text = '', verification, providedMaterials, evidenceLedger, toolMessages, runId, taskId } = {}) {
  const materials = validateProvidedMaterials(providedMaterials, { runId, taskId })
  const candidate = String(text)
  const hash = createHash('sha256').update(candidate, 'utf8').digest('hex')
  const strings = value => Array.isArray(value) ? value.filter(item => typeof item === 'string') : []
  const issues = (Array.isArray(verification?.violations) ? verification.violations : []).map(issue => ({
    code: typeof issue?.code === 'string' ? issue.code : 'verification_failed',
    // Reuse display-safe label validation, not its eight-label UI cap. Every
    // legal issue label belongs in repair; the whole packet has a byte budget.
    claimLabels: [...new Set((Array.isArray(issue?.claimLabels) ? issue.claimLabels
      : (Array.isArray(issue?.claims) ? issue.claims.map(claim => claim?.label) : []))
      .flatMap(label => getViolationClaimLabels({ claimLabels: [label] })))],
    missingSourceIds: strings(issue?.missingSourceIds),
    missingTools: strings(issue?.missingTools),
  }))
  const fieldChecks = (Array.isArray(verification?.metadata?.fieldChecks) ? verification.metadata.fieldChecks : [])
    .map(field => ({ label: String(field?.label || ''), value: String(field?.value || ''),
      support: field?.support === 'source_excerpt' ? 'source_excerpt' : 'unresolved',
      sourceIds: strings(field?.sourceIds) }))
  const payload = {
    kind: 'grounding_repair_data', trust: 'restricted', scope: SCOPE,
    runId, taskId: taskId || null,
    candidate: { text: candidate, hash },
    materialSnapshotHash: materials?.snapshotHash || null,
    materials: (materials?.items || []).map(item => ({ id: item.id, text: item.text })),
    sources: collectGroundingSources({ providedMaterials: materials, evidenceLedger, toolMessages })
      .map(item => ({ id: item.id, text: item.text })),
    issues, fieldChecks,
  }
  const content = JSON.stringify(payload)
  if (Buffer.byteLength(content, 'utf8') > MAX_REPAIR_BYTES) {
    throw Object.assign(new Error('原稿和核验材料超过单次修复上下文预算；已保留任务，未截断必要材料。'),
      { code: 'grounding_repair_context_budget_exceeded' })
  }
  return {
    message: { role: 'user', content },
    diagnostics: { candidateHash: hash, materialSnapshotHash: payload.materialSnapshotHash,
      issueCount: issues.length, fieldCheckCount: fieldChecks.length },
  }
}

module.exports = { buildGroundingRepairContext }
