'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { toAgentEvalResults } = require('./expert-qualification-live')

const REVIEWER_KINDS = new Set(['human', 'model'])

function parseArgs(argv) {
  const out = { report: '', review: '', output: '', agentEvalsOutput: '' }
  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--qualification-report') out.report = String(argv[++index] || '')
    else if (value === '--review') out.review = String(argv[++index] || '')
    else if (value === '--out') out.output = String(argv[++index] || '')
    else if (value === '--agent-evals-out') out.agentEvalsOutput = String(argv[++index] || '')
    else throw new Error(`Unknown option: ${value}`)
  }
  return out
}

function isInside(candidate, parent) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate))
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

function resolveWorkspaceFile(root, input, label, required = true) {
  if (!String(input || '').trim()) {
    if (!required) return ''
    throw new Error(`${label} is required`)
  }
  const resolved = path.resolve(root, input)
  if (!isInside(resolved, root)) throw new Error(`${label} must stay inside the workspace`)
  return resolved
}

function readJson(file, label) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (error) {
    throw new Error(`Unable to read ${label}: ${error.message || error}`)
  }
}

function text(value, max = 1000) {
  return String(value || '').trim().slice(0, max)
}

function requiredReviewField(value, label) {
  const result = text(value)
  if (!result) throw new Error(`${label} is required`)
  return result
}

function normalizeReviewer(raw, report) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('reviewer is required')
  }
  const kind = text(raw.kind, 32).toLowerCase()
  if (!REVIEWER_KINDS.has(kind)) throw new Error('reviewer.kind must be human or model')
  if (raw.independent !== true) throw new Error('reviewer.independent must be true')
  const id = requiredReviewField(raw.id, 'reviewer.id')
  const currentModel = text(report?.environment?.modelProfile?.model, 200)
  const model = text(raw.model, 200)
  if (kind === 'model') {
    if (!model) throw new Error('reviewer.model is required for model reviewers')
    if (currentModel && model.toLowerCase() === currentModel.toLowerCase()) {
      throw new Error('reviewer.model must differ from the execution model')
    }
  }
  return {
    kind,
    id,
    model: model || null,
    provider: text(raw.provider, 120) || null,
    independent: true,
    method: text(raw.method, 120) || (kind === 'human' ? 'human_review' : 'separate_model'),
  }
}

function normalizeAnchorText(value) {
  return String(value || '').replace(/\s+/gu, ' ').trim()
}

function reviewEvidenceContext(task) {
  const textSources = []
  const messages = Array.isArray(task?.transcript?.messages) ? task.transcript.messages : []
  messages.forEach((message, index) => {
    if (text(message?.role, 32).toLowerCase() !== 'assistant') return
    const body = normalizeAnchorText(message?.text)
    if (body) textSources.push({ kind: 'assistant_message', id: `assistant:${index + 1}`, body })
  })

  const artifactIds = new Set()
  const artifacts = Array.isArray(task?.reviewEvidence?.artifacts) ? task.reviewEvidence.artifacts : []
  artifacts.forEach((artifact) => {
    const id = text(artifact?.id || artifact?.artifactId || artifact?.artifactRef, 500)
    if (id) artifactIds.add(id)
    const body = normalizeAnchorText(artifact?.body)
    if (body) textSources.push({ kind: 'textual_artifact', id, body })
  })
  return { textSources, artifactIds }
}

function normalizeEvidenceAnchor(row, label, context) {
  const evidenceQuote = text(row.evidenceQuote, 500)
  const evidenceRef = text(row.evidenceRef, 500)
  if (!evidenceQuote && !evidenceRef) {
    throw new Error(`${label}.evidenceAnchor requires evidenceQuote or evidenceRef`)
  }
  let matchedSource = null
  if (evidenceQuote) {
    const quote = normalizeAnchorText(evidenceQuote)
    if (quote.length < 8) throw new Error(`${label}.evidenceQuote must contain at least 8 non-whitespace characters`)
    matchedSource = context.textSources.find(source => source.body.includes(quote)) || null
    if (!matchedSource) {
      throw new Error(`${label}.evidenceQuote must appear in assistant output or a textual artifact`)
    }
  }
  if (evidenceRef) {
    if (!context.artifactIds.has(evidenceRef)) throw new Error(`${label}.evidenceRef does not match a reviewed artifact`)
    const referencedArtifact = context.textSources.find(source => source.kind === 'textual_artifact' && source.id === evidenceRef)
    if (referencedArtifact && !evidenceQuote) {
      throw new Error(`${label}.evidenceRef points to a textual artifact; evidenceQuote is required`)
    }
  }
  return {
    evidenceQuote: evidenceQuote || null,
    evidenceRef: evidenceRef || null,
    evidenceAnchor: matchedSource ? matchedSource.kind : (evidenceRef ? 'artifact_ref' : null),
  }
}

function normalizeEvidenceRow(row, label, criterion, context) {
  if (!row || typeof row !== 'object' || Array.isArray(row) || typeof row.pass !== 'boolean') {
    throw new Error(`${label} must contain a boolean pass`)
  }
  const evidence = requiredReviewField(row.evidence, `${label}.evidence`)
  const reason = requiredReviewField(row.reason, `${label}.reason`)
  const requiredChange = row.pass ? text(row.requiredChange) : requiredReviewField(row.requiredChange, `${label}.requiredChange`)
  return {
    criterion,
    pass: row.pass,
    evidence,
    reason,
    requiredChange,
    ...normalizeEvidenceAnchor(row, label, context),
  }
}

function normalizeTaskReview(task, raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`review for ${task.evalId} is required`)
  if (typeof raw.pass !== 'boolean') throw new Error(`review ${task.evalId}.pass must be boolean`)
  const assertions = Array.isArray(task.assertions) ? task.assertions : []
  if (!assertions.length) throw new Error(`qualification case ${task.evalId} has no assertions`)
  if (!raw.userRequirements || typeof raw.userRequirements !== 'object') {
    throw new Error(`review ${task.evalId}.userRequirements is required`)
  }
  const context = reviewEvidenceContext(task)
  const userRequirements = normalizeEvidenceRow(raw.userRequirements, `review ${task.evalId}.userRequirements`, 0, context)
  const checks = Array.isArray(raw.checks) ? raw.checks : []
  if (checks.length !== assertions.length) {
    throw new Error(`review ${task.evalId} must contain exactly ${assertions.length} checks`)
  }
  const normalizedChecks = checks.map((row, index) => {
    const criterion = Number(row?.criterion)
    if (criterion !== index + 1) throw new Error(`review ${task.evalId} checks must be ordered 1..${assertions.length}`)
    const assertion = text(row?.assertion, 2000)
    if (assertion !== text(assertions[index], 2000)) {
      throw new Error(`review ${task.evalId} check ${criterion} does not match the frozen assertion`)
    }
    return {
      ...normalizeEvidenceRow(row, `review ${task.evalId}.checks[${index}]`, criterion, context),
      assertion,
    }
  })
  const expectedPass = userRequirements.pass && normalizedChecks.every(item => item.pass)
  if (raw.pass !== expectedPass) throw new Error(`review ${task.evalId}.pass does not match its checks`)
  return {
    evalId: text(task.evalId, 200),
    pass: raw.pass,
    summary: text(raw.summary, 1000),
    userRequirements,
    checks: normalizedChecks,
  }
}

function validateIndependentReview(report, reviewDocument) {
  if (!report || !Array.isArray(report.tasks) || !report.tasks.length) {
    throw new Error('qualification report has no tasks')
  }
  const reviewer = normalizeReviewer(reviewDocument?.reviewer, report)
  const rows = Array.isArray(reviewDocument?.reviews) ? reviewDocument.reviews : []
  if (rows.length !== report.tasks.length) {
    throw new Error(`independent review must cover all ${report.tasks.length} qualification cases`)
  }
  const tasksById = new Map(report.tasks.map(task => [text(task.evalId, 200), task]))
  const seen = new Set()
  const reviews = rows.map(row => {
    const evalId = text(row?.evalId, 200)
    if (!tasksById.has(evalId)) throw new Error(`unknown qualification case in review: ${evalId || '<empty>'}`)
    if (seen.has(evalId)) throw new Error(`duplicate review for qualification case: ${evalId}`)
    seen.add(evalId)
    return normalizeTaskReview(tasksById.get(evalId), row)
  })
  if (seen.size !== tasksById.size) throw new Error('independent review has missing qualification cases')
  return {
    schemaVersion: 2,
    reviewer,
    reviews,
  }
}

function applyIndependentReview(report, reviewDocument) {
  const normalized = validateIndependentReview(report, reviewDocument)
  const byId = new Map(normalized.reviews.map(item => [item.evalId, item]))
  const tasks = report.tasks.map(task => {
    const review = byId.get(text(task.evalId, 200))
    const lifecyclePassed = task.lifecycleEvidence?.passed === true
    const passed = review.pass === true && lifecyclePassed
    return {
      ...task,
      semanticReview: review.pass ? 'passed' : 'failed',
      hardAssertionsPassed: passed,
      certificationEligible: passed,
      professionalReview: {
        reviewer: normalized.reviewer,
        pass: review.pass,
        summary: review.summary,
        userRequirements: review.userRequirements,
        checks: review.checks,
      },
    }
  })
  const summary = {
    ...(report.summary || {}),
    total: tasks.length,
    lifecyclePassed: tasks.filter(item => item.lifecycleEvidence?.passed === true).length,
    runtimeFailed: tasks.filter(item => item.status === 'failed').length,
    semanticReviewPending: tasks.filter(item => !['passed', 'failed'].includes(item.semanticReview)).length,
    semanticReviewPassed: tasks.filter(item => item.semanticReview === 'passed').length,
    semanticReviewFailed: tasks.filter(item => item.semanticReview === 'failed').length,
    professionallyQualified: tasks.filter(item => item.certificationEligible === true).length,
  }
  return {
    ...report,
    schemaVersion: Math.max(2, Number(report.schemaVersion) || 1),
    environment: {
      ...(report.environment || {}),
      professionalReview: normalized.reviewer,
    },
    tasks,
    summary,
  }
}

function defaultOutputPath(reportFile) {
  return reportFile.replace(/\.json$/i, '-reviewed.json')
}

function main(argv = process.argv) {
  const root = path.resolve(__dirname, '..')
  const options = parseArgs(argv)
  const reportFile = resolveWorkspaceFile(root, options.report, '--qualification-report')
  const reviewFile = resolveWorkspaceFile(root, options.review, '--review')
  const outputFile = resolveWorkspaceFile(root, options.output || defaultOutputPath(reportFile), '--out')
  const agentEvalsFile = resolveWorkspaceFile(
    root,
    options.agentEvalsOutput || outputFile.replace(/\.json$/i, '-agent-evals.json'),
    '--agent-evals-out',
  )
  const report = applyIndependentReview(readJson(reportFile, 'qualification report'), readJson(reviewFile, 'review'))
  fs.mkdirSync(path.dirname(outputFile), { recursive: true })
  fs.writeFileSync(outputFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  const agentEvals = toAgentEvalResults(report)
  fs.writeFileSync(agentEvalsFile, `${JSON.stringify(agentEvals, null, 2)}\n`, 'utf8')
  process.stdout.write(`[semantic-review] reviewed ${report.summary.semanticReviewPassed}/${report.summary.total}; qualified ${report.summary.professionallyQualified}/${report.summary.total}\n`)
  process.stdout.write(`[semantic-review] report ${outputFile}\n`)
  process.stdout.write(`[semantic-review] AgentEvals input ${agentEvalsFile}\n`)
  return report
}

if (require.main === module) {
  try {
    main()
  } catch (error) {
    process.stderr.write(`${error?.stack || error}\n`)
    process.exitCode = 1
  }
}

module.exports = {
  applyIndependentReview,
  normalizeReviewer,
  normalizeTaskReview,
  parseArgs,
  validateIndependentReview,
}
