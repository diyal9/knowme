'use strict'

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { redactSensitiveFields } = require('./tool-contract-governance')

const digest = value => crypto.createHash('sha256').update(String(value)).digest('hex')
const receiptDirectory = (userData, sessionId) => path.join(userData, 'tool-execution-receipts', digest(sessionId))

function safeResult(result = {}) {
  // Persist bounded execution evidence, never arguments, headers or opaque raw responses.
  const cleanText = value => String(value || '').slice(0, 4000)
    .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(/((?:password|secret|token|api[_-]?key|authorization)\s*[=:]\s*)[^\s&,;]+/gi, '$1[REDACTED]')
  const safe = redactSensitiveFields({ ok: result.ok === true, code: String(result.code || '').slice(0, 120),
    text: cleanText(result.text || result.message), auditId: result.auditId || '', truncated: true,
    artifacts: (Array.isArray(result.artifacts) ? result.artifacts : []).slice(0, 32).map(item => ({
      id: String(item?.id || '').slice(0, 160), type: String(item?.type || '').slice(0, 80),
      title: cleanText(item?.title).slice(0, 160),
    })) })
  return safe
}

/** Host disk records, not serialized model assertions. An unfinished write is uncertain. */
function writeToolExecutionReceipt(userData, draft, result, outcome) {
  const directory = receiptDirectory(userData, draft.sessionId || '')
  fs.mkdirSync(directory, { recursive: true })
  const file = path.join(directory, `${digest(draft.id)}.json`)
  const receipt = { draftId: draft.id, sessionId: draft.sessionId || '', runId: draft.runId || '',
    toolName: draft.action, invocationHash: draft.invocationHash, replayHash: draft.replayHash, contractHash: draft.contractHash,
    recoveryRunId: draft.recoveryRunId || null,
    outcome, result: safeResult(result), completedAt: new Date().toISOString() }
  const temporary = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`
  fs.writeFileSync(temporary, JSON.stringify(receipt), 'utf8')
  fs.renameSync(temporary, file)
  return receipt
}

function listToolExecutionReceipts(userData, sessionId, options = {}) {
  if (!userData || !sessionId) return []
  const directory = receiptDirectory(userData, sessionId)
  let files
  try { files = fs.readdirSync(directory) } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
  const receipts = files.filter(file => /^[a-f0-9]{64}\.json$/.test(file)).map(file => {
    // Corruption is not equivalent to absence: fail closed, never replay.
    const receipt = JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8'))
    if (receipt.sessionId !== sessionId || !['executed', 'not_executed', 'uncertain'].includes(receipt.outcome)) {
      throw new Error('Invalid execution receipt')
    }
    return receipt
  })
  if (!options.runId) return receipts.sort((left, right) => left.completedAt.localeCompare(right.completedAt))
  const included = new Set()
  const visiting = new Set()
  const visit = (runId, ancestor = false) => {
    if (visiting.has(runId) || included.size >= 64) throw new Error('Invalid execution receipt lineage')
    if (included.has(runId)) return
    const rows = receipts.filter(receipt => receipt.runId === runId)
    if (ancestor && !rows.length) throw new Error('Missing execution receipt lineage')
    visiting.add(runId)
    included.add(runId)
    for (const parent of new Set(rows.map(row => row.recoveryRunId).filter(Boolean))) visit(parent, true)
    visiting.delete(runId)
  }
  visit(options.runId)
  return receipts.filter(receipt => included.has(receipt.runId))
    .sort((left, right) => left.completedAt.localeCompare(right.completedAt))
}

module.exports = { writeToolExecutionReceipt, listToolExecutionReceipts }
