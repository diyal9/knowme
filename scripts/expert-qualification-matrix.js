'use strict'

const fs = require('node:fs')
const path = require('node:path')

const LIFECYCLE_SCENARIOS = {
  cancel_then_retry: 'retry',
  request_changes: 'revision',
  accept_then_reopen: 'reopen',
}

function parseArgs(argv) {
  const out = { matrix: '', output: '' }
  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--matrix') out.matrix = String(argv[++index] || '')
    else if (value === '--out') out.output = String(argv[++index] || '')
    else throw new Error(`Unknown option: ${value}`)
  }
  return out
}

function isInside(candidate, parent) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate))
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

function resolveWorkspaceFile(root, input, label) {
  if (!String(input || '').trim()) throw new Error(`${label} is required`)
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

function scenarioOf(item) {
  const explicit = String(item?.scenario || '').trim().toLowerCase()
  if (explicit) return explicit
  return LIFECYCLE_SCENARIOS[String(item?.lifecycle || '').trim()] || 'normal'
}

function suiteCases(root, relativeFile, expectedExpertId) {
  const file = path.resolve(root, relativeFile)
  if (!isInside(file, root)) return { file: relativeFile, error: 'suite path escapes workspace', cases: [] }
  if (!fs.existsSync(file)) return { file: relativeFile, error: 'suite file not found', cases: [] }
  let suite
  try { suite = readJson(file, relativeFile) } catch (error) { return { file: relativeFile, error: error.message, cases: [] } }
  const cases = (Array.isArray(suite?.evals) ? suite.evals : [])
    .map(item => ({
      id: String(item?.id || ''),
      expertId: String(item?.expertId || item?.expert || ''),
      scenario: scenarioOf(item),
      lifecycle: String(item?.lifecycle || 'create'),
      routeId: String(item?.routeId || item?.executionRoute || '').trim(),
      assertions: Array.isArray(item?.assertions)
        ? item.assertions.length
        : Array.isArray(item?.expectations) ? item.expectations.length : 0,
    }))
    .filter(item => item.expertId === expectedExpertId)
  return { file: relativeFile, error: '', cases }
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function readCatalogJson(file, label) {
  if (!fs.existsSync(file)) return { value: null, error: `${label} not found` }
  try {
    return { value: readJson(file, label), error: '' }
  } catch (error) {
    return { value: null, error: error.message }
  }
}

function auditExpertContract(root, expertId) {
  const catalogRoot = path.join(root, 'src', 'catalog')
  if (!fs.existsSync(catalogRoot)) return { skipped: true, errors: [], warnings: [] }
  const expertRoot = path.join(catalogRoot, 'experts', expertId)
  const errors = []
  const warnings = []
  const manifestResult = readCatalogJson(path.join(expertRoot, 'manifest.json'), `expert ${expertId} manifest`)
  const capabilityManifestResult = readCatalogJson(
    path.join(expertRoot, 'capability.manifest.json'),
    `expert ${expertId} capability manifest`,
  )
  const expertDoc = path.join(expertRoot, 'EXPERT.md')
  const manifest = manifestResult.value
  const capabilityManifest = capabilityManifestResult.value
  if (manifestResult.error) errors.push(manifestResult.error)
  if (capabilityManifestResult.error) errors.push(capabilityManifestResult.error)
  if (!fs.existsSync(expertDoc)) errors.push(`expert ${expertId} EXPERT.md not found`)
  if (manifest && String(manifest.id || '') !== expertId) errors.push(`expert manifest id mismatch: ${manifest.id || '(empty)'}`)
  if (manifest && manifest.kind !== 'expert') errors.push(`expert manifest kind must be expert, got ${manifest.kind || '(empty)'}`)
  if (capabilityManifest && String(capabilityManifest.id || '') !== expertId) {
    errors.push(`expert capability manifest id mismatch: ${capabilityManifest.id || '(empty)'}`)
  }
  if (capabilityManifest && capabilityManifest.kind !== 'expert') {
    errors.push(`expert capability manifest kind must be expert, got ${capabilityManifest.kind || '(empty)'}`)
  }
  const expertText = fs.existsSync(expertDoc) ? fs.readFileSync(expertDoc, 'utf8') : ''
  for (const field of ['skills:', 'inputContract:', 'outputContract:', 'sop:']) {
    if (!expertText.includes(field)) errors.push(`expert ${expertId} is missing ${field}`)
  }
  const skills = Array.isArray(manifest?.skills) ? manifest.skills.map(String).filter(Boolean) : []
  if (!skills.length) errors.push(`expert ${expertId} declares no skills`)
  for (const skillId of skills) {
    const skillRoot = path.join(catalogRoot, 'skills', skillId)
    const skillManifestResult = readCatalogJson(path.join(skillRoot, 'capability.manifest.json'), `skill ${skillId} manifest`)
    if (skillManifestResult.error) errors.push(skillManifestResult.error)
    if (!fs.existsSync(path.join(skillRoot, 'SKILL.md'))) errors.push(`skill ${skillId} SKILL.md not found`)
    const skillManifest = skillManifestResult.value
    if (skillManifest && String(skillManifest.id || '') !== skillId) errors.push(`skill manifest id mismatch: ${skillId}`)
    if (skillManifest && skillManifest.kind !== 'skill') errors.push(`skill ${skillId} manifest kind must be skill`)
    if (expertText && !new RegExp(`(?:^|\\n)\\s*-\\s*${escapeRegExp(skillId)}(?:\\s|$)`, 'm').test(expertText)) {
      warnings.push(`expert ${expertId} manifest skill ${skillId} is not declared in EXPERT.md`)
    }
  }
  const connectors = Array.isArray(manifest?.connectors) ? manifest.connectors.map(String).filter(Boolean) : []
  for (const connectorId of connectors) {
    const connectorResult = readCatalogJson(
      path.join(catalogRoot, 'connectors', connectorId, 'manifest.json'),
      `connector ${connectorId} manifest`,
    )
    if (connectorResult.error) errors.push(connectorResult.error)
    if (connectorResult.value && String(connectorResult.value.id || '') !== connectorId) {
      errors.push(`connector manifest id mismatch: ${connectorId}`)
    }
  }
  const capabilityDependencies = Array.isArray(capabilityManifest?.dependencies)
    ? capabilityManifest.dependencies.filter(item => item && typeof item === 'object')
    : []
  if (capabilityManifest && !capabilityDependencies.length) {
    errors.push(`expert ${expertId} capability manifest declares no dependencies`)
  }
  const dependencyIds = new Set(capabilityDependencies.map(item => String(item.id || '').trim()).filter(Boolean))
  for (const dependency of capabilityDependencies) {
    const dependencyId = String(dependency.id || '').trim()
    const dependencyKind = String(dependency.kind || '').trim()
    if (!dependencyId || !['skill', 'connector'].includes(dependencyKind)) {
      errors.push(`expert ${expertId} has invalid capability dependency: ${dependencyId || '(empty)'}/${dependencyKind || '(empty)'}`)
      continue
    }
    const dependencyRoot = path.join(catalogRoot, dependencyKind === 'skill' ? 'skills' : 'connectors', dependencyId)
    const dependencyFile = dependencyKind === 'skill' ? 'capability.manifest.json' : 'manifest.json'
    const dependencyResult = readCatalogJson(path.join(dependencyRoot, dependencyFile), `${dependencyKind} ${dependencyId} manifest`)
    if (dependencyResult.error) errors.push(dependencyResult.error)
    if (dependencyKind === 'skill' && !fs.existsSync(path.join(dependencyRoot, 'SKILL.md'))) {
      errors.push(`skill ${dependencyId} SKILL.md not found`)
    }
    if (dependencyResult.value && String(dependencyResult.value.id || '') !== dependencyId) {
      errors.push(`${dependencyKind} manifest id mismatch: ${dependencyId}`)
    }
  }
  const execution = capabilityManifest?.metadata?.knowme?.execution
  const deliverables = Array.isArray(execution?.deliverables) ? execution.deliverables : []
  if (capabilityManifest && !deliverables.length) errors.push(`expert ${expertId} declares no execution deliverables`)
  const deliverableIds = new Set()
  for (const deliverable of deliverables) {
    const deliverableId = String(deliverable?.id || '').trim()
    if (!deliverableId || !String(deliverable?.title || '').trim() || !String(deliverable?.type || '').trim()) {
      errors.push(`expert ${expertId} has an incomplete execution deliverable`)
      continue
    }
    if (deliverableIds.has(deliverableId)) errors.push(`expert ${expertId} repeats deliverable id: ${deliverableId}`)
    deliverableIds.add(deliverableId)
    for (const requiredSkill of Array.isArray(deliverable.requiredSkills) ? deliverable.requiredSkills : []) {
      if (!dependencyIds.has(String(requiredSkill))) {
        errors.push(`expert ${expertId} deliverable ${deliverableId} requires undeclared skill: ${requiredSkill}`)
      }
    }
  }
  const routes = Array.isArray(execution?.routes) ? execution.routes : []
  const routeIds = new Set()
  for (const route of routes) {
    const routeId = String(route?.id || '').trim()
    if (!routeId || !String(route?.description || '').trim()) {
      errors.push(`expert ${expertId} has an incomplete execution route`)
      continue
    }
    if (routeIds.has(routeId)) errors.push(`expert ${expertId} repeats execution route id: ${routeId}`)
    routeIds.add(routeId)
    for (const requiredSkill of Array.isArray(route.requiredSkills) ? route.requiredSkills : []) {
      if (!dependencyIds.has(String(requiredSkill))) {
        errors.push(`expert ${expertId} route ${routeId} requires undeclared skill: ${requiredSkill}`)
      }
    }
  }
  const conditionalRouteIds = [
    ...routes
      .filter(route => !route.default && (
        String(route?.connectorId || '').trim()
        || (Array.isArray(route?.requiredTools) && route.requiredTools.length)
        || (Array.isArray(route?.requiredSkills) && route.requiredSkills.length)
      ))
      .map(route => String(route.id || '').trim()),
    ...deliverables
      .map(deliverable => String(deliverable?.executionRoute || '').trim())
      .filter(Boolean),
  ].filter((routeId, index, values) => routeId && values.indexOf(routeId) === index)
  return {
    skipped: false,
    errors,
    warnings,
    skillCount: skills.length,
    connectorCount: connectors.length,
    capabilityDependencyCount: capabilityDependencies.length,
    deliverableCount: deliverables.length,
    routeCount: routes.length,
    conditionalRouteIds,
  }
}

function evaluateMatrix({ root, matrix, matrixDir = root, validateContracts = fs.existsSync(path.join(root, 'src', 'catalog')) }) {
  if (!matrix || !Array.isArray(matrix.experts) || !matrix.experts.length) throw new Error('qualification matrix has no experts')
  const requiredScenarios = Object.fromEntries(Object.entries(matrix.requiredScenarios || {})
    .map(([key, value]) => [String(key), Math.max(0, Number(value) || 0)]))
  const experts = matrix.experts.map(entry => {
    const id = String(entry?.id || '').trim()
    if (!id) throw new Error('every matrix expert requires id')
    const sourceSuites = Array.isArray(entry?.sourceSuites) ? entry.sourceSuites.map(String) : []
    const suites = sourceSuites.map(file => suiteCases(matrixDir, file, id))
    const cases = suites.flatMap(item => item.cases)
    const scenarioCounts = Object.fromEntries(Object.keys(requiredScenarios).map(scenario => [scenario, 0]))
    for (const item of cases) scenarioCounts[item.scenario] = (scenarioCounts[item.scenario] || 0) + 1
    const missing = Object.entries(requiredScenarios)
      .flatMap(([scenario, minimum]) => scenarioCounts[scenario] < minimum
        ? [`${scenario}:${minimum - scenarioCounts[scenario]} missing`]
        : [])
    const suiteErrors = suites.filter(item => item.error).map(item => `${item.file}: ${item.error}`)
    const contract = validateContracts ? auditExpertContract(root, id) : { skipped: true, errors: [], warnings: [] }
    const contractErrors = contract.errors || []
    const conditionalRouteIds = contract.conditionalRouteIds || []
    const coveredRouteIds = [...new Set(cases.map(item => item.routeId).filter(Boolean))]
    const missingRoutes = conditionalRouteIds
      .filter(routeId => !coveredRouteIds.includes(routeId))
      .map(routeId => `route:${routeId} missing`)
    return {
      expertId: id,
      sourceSuites,
      caseCount: cases.length,
      scenarioCounts,
      missingScenarios: missing,
      coveredRouteIds,
      missingRoutes,
      suiteErrors,
      contract,
      state: suiteErrors.length || missing.length || missingRoutes.length || contractErrors.length
        ? 'insufficient_evidence'
        : 'ready_for_live_execution',
      cases,
    }
  })
  const missingExperts = experts.filter(item => item.state !== 'ready_for_live_execution').map(item => item.expertId)
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    requiredScenarios,
    totalExperts: experts.length,
    readyExperts: experts.filter(item => item.state === 'ready_for_live_execution').length,
    incompleteExperts: missingExperts.length,
    complete: missingExperts.length === 0,
    experts,
  }
}

function toMarkdown(report) {
  const lines = [
    '# Retained expert qualification matrix', '',
    `- Complete: ${report.complete ? 'yes' : 'no'}`,
    `- Ready for live execution: ${report.readyExperts}/${report.totalExperts}`,
    '',
    '| Expert | Cases | Normal | Edge | Retry | Revision | Reopen | State |',
    '|---|---:|---:|---:|---:|---:|---:|---|',
  ]
  for (const expert of report.experts) {
    const c = expert.scenarioCounts
    lines.push(`| ${expert.expertId} | ${expert.caseCount} | ${c.normal || 0} | ${c.edge || 0} | ${c.retry || 0} | ${c.revision || 0} | ${c.reopen || 0} | ${expert.state} |`)
    for (const issue of [...expert.suiteErrors, ...expert.missingScenarios, ...expert.missingRoutes, ...(expert.contract?.errors || [])]) {
      lines.push(`| ↳ ${issue} | | | | | | | |`)
    }
  }
  return lines.join('\n')
}

function main(argv = process.argv) {
  const root = path.resolve(__dirname, '..')
  const options = parseArgs(argv)
  const matrixFile = resolveWorkspaceFile(root, options.matrix || 'openspec/changes/production-qualify-all-experts/expert-qualification-matrix.json', '--matrix')
  const matrix = readJson(matrixFile, 'qualification matrix')
  const report = evaluateMatrix({ root, matrix, matrixDir: path.dirname(matrixFile) })
  const outputFile = options.output
    ? resolveWorkspaceFile(root, options.output, '--out')
    : path.join(path.dirname(matrixFile), 'evidence', 'rqa71-retained-expert-qualification-matrix-2026-09-08.json')
  fs.mkdirSync(path.dirname(outputFile), { recursive: true })
  fs.writeFileSync(outputFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  process.stdout.write(`${toMarkdown(report)}\n[qualification-matrix] report ${outputFile}\n`)
  if (!report.complete) process.exitCode = 2
  return report
}

if (require.main === module) {
  try { main() } catch (error) {
    process.stderr.write(`${error?.stack || error}\n`)
    process.exitCode = 1
  }
}

module.exports = { evaluateMatrix, parseArgs, scenarioOf, toMarkdown }
