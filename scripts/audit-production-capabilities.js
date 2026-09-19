'use strict'

// Keep direct execution (`node scripts/audit-production-capabilities.js`) as
// reliable as the npm wrapper, which already preloads this bridge.
require('./register-ts')

const fs = require('fs')
const os = require('os')
const path = require('path')

const { createCapabilityStore } = require('../src/lib/capability-store')
const { createCapabilityPackRuntime } = require('../src/lib/capability-pack-runtime')
const { createCapabilityHubService } = require('../src/lib/capability-hub-service')
const { listCatalog, loadBundledCatalog } = require('../src/lib/capability-catalog')
const { createConnectorsApi } = require('../src/lib/connectors')
const { createStore: createWorkbenchModeStore } = require('../src/lib/workbench-mode-store')
const { createStore: createWorkbenchTaskStore } = require('../src/lib/workbench-task-store')

function parseArgs(argv) {
  const options = {
    userData: '',
    snapshotRoot: '',
    qualificationReport: '',
    apply: false,
    strict: false,
    probeConnectors: false,
  }
  for (let index = 2; index < argv.length; index += 1) {
    const value = String(argv[index] || '')
    if (value === '--apply') {
      options.apply = true
      continue
    }
    if (value === '--strict') {
      options.strict = true
      continue
    }
    if (value === '--probe-connectors') {
      options.probeConnectors = true
      continue
    }
    if (value === '--user-data') {
      options.userData = String(argv[++index] || '')
      continue
    }
    if (value === '--snapshot-root') {
      options.snapshotRoot = String(argv[++index] || '')
      continue
    }
    if (value === '--qualification-report') {
      options.qualificationReport = String(argv[++index] || '')
      continue
    }
    throw new Error(`Unknown option: ${value}`)
  }
  return options
}

function qualificationScenarioKey(task) {
  const lifecycle = String(task?.lifecycle || '').trim()
  if (lifecycle === 'cancel_then_retry') return 'retry'
  if (lifecycle === 'request_changes') return 'revision'
  if (lifecycle === 'accept_then_reopen') return 'reopen'
  return String(task?.scenario || 'normal').trim() || 'normal'
}

function hasIndependentProfessionalReview(task) {
  const review = task?.professionalReview
  const reviewer = review?.reviewer
  const checks = Array.isArray(review?.checks) ? review.checks : []
  const reviewerReady = ['human', 'model'].includes(String(reviewer?.kind || '').trim())
    && String(reviewer?.id || '').trim().length > 0
    && reviewer?.independent === true
  const evidenceReady = review?.pass === true
    && review?.userRequirements?.pass === true
    && checks.length > 0
    && checks.every(check => check?.pass === true
      && String(check?.evidence || '').trim().length > 0
      && (String(check?.evidenceQuote || '').trim().length > 0
        || String(check?.evidenceRef || '').trim().length > 0
        || String(check?.evidenceAnchor || '').trim().length > 0))
  return reviewerReady && evidenceReady
}

function collectQualificationReadiness(report, productionExpertIds, currentExperts = new Map(), reportFile = '') {
  const requiredIds = [...productionExpertIds].map(value => String(value || '').trim()).filter(Boolean).sort()
  const emptyResult = (id, state = 'not_provided', issues = []) => ({
    expertId: id,
    state,
    qualified: false,
    sampleCount: 0,
    currentConfigurationCount: 0,
    scenarios: [],
    missingScenarios: ['normal:2', 'edge', 'retry', 'revision', 'reopen'],
    issues,
  })
  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    return {
      reportFile: reportFile || '',
      provided: false,
      status: 'not_provided',
      complete: false,
      qualifiedExpertIds: [],
      missingExpertIds: requiredIds,
      experts: requiredIds.map(id => emptyResult(id)),
    }
  }

  const tasksByExpert = new Map()
  for (const task of Array.isArray(report.tasks) ? report.tasks : []) {
    const expertId = String(task?.expertId || '').trim()
    if (!requiredIds.includes(expertId)) continue
    const rows = tasksByExpert.get(expertId) || []
    rows.push(task)
    tasksByExpert.set(expertId, rows)
  }
  const experts = requiredIds.map(expertId => {
    const rows = tasksByExpert.get(expertId) || []
    if (!rows.length) return emptyResult(expertId, 'missing', ['没有当前保留专家的资格任务报告'])
    const current = currentExperts.get(expertId) || {}
    const currentRows = rows.filter(task => {
      const agent = task?.configuration?.qualificationContext?.agent || {}
      const versionMatches = !current.version || agent.version === current.version
      const hashMatches = !current.hash || !agent.hash || agent.hash === current.hash
      return agent.id === expertId && versionMatches && hashMatches
    })
    const scenarioCounts = new Map()
    for (const task of currentRows) {
      const key = qualificationScenarioKey(task)
      scenarioCounts.set(key, (scenarioCounts.get(key) || 0) + 1)
    }
    const missingScenarios = []
    if ((scenarioCounts.get('normal') || 0) < 2) missingScenarios.push('normal:2')
    for (const scenario of ['edge', 'retry', 'revision', 'reopen']) {
      if (!scenarioCounts.has(scenario)) missingScenarios.push(scenario)
    }
    const allPassed = currentRows.length === rows.length
      && currentRows.length > 0
      && currentRows.every(task => task.lifecycleEvidence?.passed === true
        && task.semanticReview === 'passed'
        && task.hardAssertionsPassed === true
        && task.certificationEligible === true
        && hasIndependentProfessionalReview(task))
    const qualified = allPassed && missingScenarios.length === 0
    const issues = []
    if (currentRows.length !== rows.length) issues.push('报告包含与当前 Agent 版本/配置不一致的任务')
    if (missingScenarios.length) issues.push(`缺少场景：${missingScenarios.join('、')}`)
    if (!allPassed && !issues.includes('报告包含与当前 Agent 版本/配置不一致的任务')) {
      issues.push('存在未通过生命周期、独立评审凭证或硬断言的任务')
    }
    return {
      expertId,
      state: qualified ? 'qualified' : (currentRows.length ? 'incomplete' : 'stale_or_unmatched'),
      qualified,
      sampleCount: rows.length,
      currentConfigurationCount: currentRows.length,
      scenarios: [...scenarioCounts.entries()].map(([scenario, count]) => ({ scenario, count })),
      missingScenarios,
      issues,
    }
  })
  const qualifiedExpertIds = experts.filter(item => item.qualified).map(item => item.expertId)
  return {
    reportFile: reportFile || '',
    provided: true,
    status: qualifiedExpertIds.length === requiredIds.length ? 'complete' : 'incomplete',
    complete: qualifiedExpertIds.length === requiredIds.length,
    qualifiedExpertIds,
    missingExpertIds: requiredIds.filter(id => !qualifiedExpertIds.includes(id)),
    experts,
  }
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function createAuditSnapshotRoot(explicitRoot = '') {
  if (String(explicitRoot || '').trim()) return path.resolve(explicitRoot)
  // The audit is read-only with respect to KnowMe user data. Session
  // snapshots are diagnostic evidence, so keep them in an isolated temporary
  // directory unless the caller explicitly supplies a persistence location.
  return fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-production-audit-'))
}

function copyIfPresent(source, targetDir) {
  if (!fs.existsSync(source)) return ''
  fs.mkdirSync(targetDir, { recursive: true })
  const target = path.join(targetDir, path.basename(source))
  fs.copyFileSync(source, target)
  return target
}

function createRuntime(userData, catalogRoot, snapshotRoot = '', { ensureDefaults = false } = {}) {
  const getUserData = () => userData
  const store = createCapabilityStore({ getUserData })
  const packs = createCapabilityPackRuntime({
    userData,
    trustedCatalogRoot: catalogRoot,
    getAvailableCapabilityManifests: () => listCatalog(userData, { bundledRoot: catalogRoot })
      .entries.map(entry => entry.manifest).filter(Boolean),
    getOccupiedSkillIds: () => (store.listEntries({ kind: 'skill' }).entries || []).map(entry => entry.id),
  })
  // Auditing must be read-only by default. Installing the default pack is a
  // migration/write operation and is only allowed when the caller explicitly
  // opts into the apply path.
  if (ensureDefaults) packs.ensureDefaultPacks()
  const hub = createCapabilityHubService({
    getUserData,
    getKnowledgeDir: () => path.join(userData, 'knowledge'),
    getConnectorsApi: () => null,
    bundledRoot: catalogRoot,
    getPackSkillSources: () => packs.listSkillSources(),
    getPackEmptyStateGroups: () => packs.listEmptyStateGroups(),
    getPackScenesForUi: () => packs.listScenesForUi(),
    getExpertSnapshotRoot: () => snapshotRoot,
  })
  return { hub, packs, store, connectorsApi: createConnectorsApi({ getUserData }) }
}

function projectConnectorProbe(result) {
  const status = result?.connector?.status
  const state = String(status?.state || '').trim()
  const ok = status?.ok === true
  return {
    attempted: true,
    ok,
    operational: ok,
    state,
    message: String(status?.message || result?.error || result?.code || '').trim(),
  }
}

async function probeConnector(connectorsApi, item) {
  if (!item?.installed || item.enabled !== true) {
    return {
      attempted: true,
      ok: false,
      operational: false,
      state: 'not_enabled',
      message: '连接器未安装或已停用',
    }
  }
  try {
    return projectConnectorProbe(await connectorsApi.getConnectorStatus(item.id))
  } catch (error) {
    return {
      attempted: true,
      ok: false,
      operational: false,
      state: 'probe_failed',
      message: String(error?.message || error || '连接器探针失败'),
    }
  }
}

function safeCreateAuditSnapshot(expertRuntime, loaded, item, sessionId) {
  if (!loaded?.ok) return { snapshot: loaded, snapshotError: '' }

  try {
    return {
      snapshot: expertRuntime.createSessionSnapshot(sessionId, item.id),
      snapshotError: '',
    }
  } catch (error) {
    const message = String(error?.message || error)
    return {
      snapshot: {
        ok: false,
        code: 'snapshot_failed',
        message,
        issues: [{ code: 'snapshot_failed', message }],
      },
      snapshotError: message,
    }
  }
}

function collectRequiredDependencies(experts = []) {
  const required = {
    skill: new Map(),
    connector: new Map(),
  }
  for (const expert of Array.isArray(experts) ? experts : []) {
    const declared = Array.isArray(expert.dependencies) && expert.dependencies.length
      ? expert.dependencies
      : [
        ...(expert.skills || []).map(id => ({ id, kind: 'skill', required: true })),
        ...(expert.connectors || []).map(id => ({ id, kind: 'connector', required: true })),
      ]
    for (const dependency of declared) {
      const id = String(dependency?.id || '').trim()
      const kind = String(dependency?.kind || '').trim()
      if (!id || (kind !== 'skill' && kind !== 'connector') || dependency.required === false) continue
      if (!required[kind].has(id)) required[kind].set(id, new Set())
      if (expert.id) required[kind].get(id).add(String(expert.id))
    }
  }
  return required
}

function collectConditionalRouteRequirements(entries = []) {
  const routes = []
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (entry?.kind !== 'expert') continue
    const execution = entry.manifest?.metadata?.knowme?.execution || {}
    const addRoute = (
      routeId,
      requiredToolsInput,
      requiredSkillsInput,
      skillId = '',
      requiredConnectorIdsInput = [],
      connectorId = '',
    ) => {
      const requiredTools = [...new Set((Array.isArray(requiredToolsInput) ? requiredToolsInput : [])
        .map(value => String(value || '').trim())
        .filter(Boolean))]
      if (!requiredTools.length) return
      const requiredConnectorIds = [...new Set([
        ...(Array.isArray(requiredConnectorIdsInput) ? requiredConnectorIdsInput : []),
        connectorId,
      ].map(value => String(value || '').trim()).filter(Boolean))]
      routes.push({
        expertId: String(entry.id || '').trim(),
        routeId: String(routeId || '').trim(),
        requiredTools,
        requiredSkills: [...new Set([
          ...(Array.isArray(requiredSkillsInput) ? requiredSkillsInput : []),
          skillId,
        ]
          .map(value => String(value || '').trim())
          .filter(Boolean))],
        ...(requiredConnectorIds.length ? { requiredConnectorIds } : {}),
        readiness: 'task-runtime-probe-required',
        note: '工具是否进入最终执行面，必须在对应任务路由中实时确认；静态能力审计不把声明当成回执。',
      })
    }
    const declaredRoutes = execution.routes
    for (const route of Array.isArray(declaredRoutes) ? declaredRoutes : []) {
      addRoute(
        route.id,
        route.requiredTools,
        route.requiredSkills,
        route.skillId,
        route.requiredConnectorIds,
        route.connectorId,
      )
    }
    // Some experts (notably image-producer) declare their tool contract on a
    // deliverable instead of a route. Those tools are equally conditional and
    // must not disappear from the production audit.
    for (const deliverable of Array.isArray(execution.deliverables) ? execution.deliverables : []) {
      addRoute(
        deliverable.executionRoute || `deliverable:${deliverable.id || 'unknown'}`,
        deliverable.requiredTools,
        deliverable.requiredSkills,
        '',
        deliverable.requiredConnectorIds,
        deliverable.connectorId,
      )
    }
  }
  return routes
}

function collectVerifiedRouteEvidence(tasks = [], routes = [], currentExperts = new Map()) {
  const verified = new Map()
  const successfulStatuses = new Set(['ok', 'done', 'completed', 'success', 'succeeded'])
  for (const task of Array.isArray(tasks) ? tasks : []) {
    if (task?.kind && task.kind !== 'expert') continue
    for (const evidence of Array.isArray(task?.executionEvidence) ? task.executionEvidence : []) {
      if (evidence?.gateStatus !== 'verified' || evidence?.verificationPassed !== true) continue
      if (!evidence?.executionRoute || evidence?.qualificationContext?.complete !== true) continue
      if (Array.isArray(evidence.violations) && evidence.violations.length) continue
      const current = currentExperts.get(task.expertId)
      const agent = evidence.qualificationContext.agent || {}
      if (current?.version && agent.version !== current.version) continue
      if (current?.hash && agent.hash !== current.hash) continue
      const calls = Array.isArray(evidence.toolCalls) ? evidence.toolCalls : []
      const successfulTools = new Set(calls
        .filter(call => successfulStatuses.has(String(call?.status || '').toLowerCase()))
        .map(call => String(call?.name || '').trim())
        .filter(Boolean))
      const skillIds = new Set((evidence.qualificationContext.skills || [])
        .map(skill => String(skill?.id || '').trim())
        .filter(Boolean))
      for (const route of Array.isArray(routes) ? routes : []) {
        if (route.expertId !== task.expertId || route.routeId !== evidence.executionRoute) continue
        if (!route.requiredTools.every(tool => successfulTools.has(tool))) continue
        if (!route.requiredSkills.every(skill => skillIds.has(skill))) continue
        const key = `${route.expertId}:${route.routeId}`
        const previous = verified.get(key) || { evidenceCount: 0, runIds: [] }
        verified.set(key, {
          evidenceCount: previous.evidenceCount + 1,
          runIds: [...previous.runIds, evidence.runId].filter(Boolean).slice(-8),
        })
      }
    }
  }
  return verified
}

// Historical task records are useful for diagnosing a connector or runtime
// regression, but they must not silently become current-version qualification
// receipts. Keep them as a separate, explicitly labelled signal so an audit
// can show that a real artifact was produced before a later expert revision.
function collectHistoricalTaskEvidence(tasks = [], currentExperts = new Map()) {
  const byExpert = new Map()
  for (const task of Array.isArray(tasks) ? tasks : []) {
    if (task?.kind && task.kind !== 'expert') continue
    const expertId = String(task?.expertId || '').trim()
    if (!expertId) continue
    const deliverables = Array.isArray(task?.deliverables) ? task.deliverables : []
    const accepted = deliverables.filter(deliverable => (
      deliverable?.evidenceStatus === 'verified'
      && deliverable?.acceptanceStatus === 'accepted'
      && (deliverable?.artifactRef || (Array.isArray(deliverable?.artifactRefs) && deliverable.artifactRefs.length))
    ))
    if (!accepted.length) continue

    const current = currentExperts.get(expertId) || {}
    const assignment = task.assignmentSnapshot || {}
    const recordedVersion = String(assignment.agentVersion || '').trim()
    const recordedHash = String(assignment.agentHash || assignment.hashes?.expert || '').trim()
    const versionMatches = !current.version || !recordedVersion || recordedVersion === current.version
    const hashMatches = !current.hash || !recordedHash || recordedHash === current.hash
    const previous = byExpert.get(expertId) || {
      expertId,
      acceptedDeliverableCount: 0,
      taskIds: [],
      runIds: [],
      latestAt: '',
      currentVersionEvidenceCount: 0,
      staleVersionEvidenceCount: 0,
    }
    previous.acceptedDeliverableCount += accepted.length
    if (task.id && !previous.taskIds.includes(task.id)) previous.taskIds.push(task.id)
    for (const deliverable of accepted) {
      const runId = String(deliverable.executionRef || '').replace(/^agent-run:/, '').trim()
      if (runId && !previous.runIds.includes(runId)) previous.runIds.push(runId)
    }
    const at = String(task.updatedAt || task.createdAt || '').trim()
    if (at && (!previous.latestAt || at > previous.latestAt)) previous.latestAt = at
    if (versionMatches && hashMatches) previous.currentVersionEvidenceCount += accepted.length
    else previous.staleVersionEvidenceCount += accepted.length
    byExpert.set(expertId, previous)
  }
  return [...byExpert.values()].sort((a, b) => a.expertId.localeCompare(b.expertId))
}

// A completed run that exposed a connector tool surface is useful historical
// evidence, even when the current process cannot reproduce the connector
// session. It is deliberately weaker than a tool receipt: loading a tool
// schema proves the old run could see the connector, not that every tool call
// succeeded. Keep this signal separate from current route qualification.
function collectHistoricalRunEvidence(userData) {
  const root = path.join(String(userData || '').trim(), 'agent-runs')
  if (!root || !fs.existsSync(root)) return []
  const byConnector = new Map()
  const connectorForToolName = name => {
    const normalized = String(name || '').trim()
    if (normalized.startsWith('feishu.')) return 'feishu'
    if (normalized === 'generate_image'
      || normalized === 'list_paint_models'
      || normalized.includes('pango-image-mcp')) return 'pango-image-mcp'
    return ''
  }
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const runId = String(entry.name || '').trim()
    const eventsFile = path.join(root, runId, 'events.jsonl')
    if (!fs.existsSync(eventsFile)) continue
    let terminal = null
    try {
      const lines = fs.readFileSync(eventsFile, 'utf8').split(/\r?\n/u).filter(Boolean)
      for (const line of lines) {
        let event
        try { event = JSON.parse(line) } catch { continue }
        if (event?.type !== 'run.terminal' || event.payload?.terminal !== 'completed' || event.payload?.ok !== true) continue
        terminal = event
      }
    } catch {
      continue
    }
    if (!terminal) continue
    const loadedNames = Array.isArray(terminal.payload?.report?.toolSurface?.loadedNames)
      ? terminal.payload.report.toolSurface.loadedNames.map(value => String(value || '').trim()).filter(Boolean)
      : Array.isArray(terminal.payload?.metrics?.toolSurface?.loadedNames)
        ? terminal.payload.metrics.toolSurface.loadedNames.map(value => String(value || '').trim()).filter(Boolean)
        : []
    const connectorIds = new Set()
    for (const name of loadedNames) {
      const connectorId = connectorForToolName(name)
      if (connectorId) connectorIds.add(connectorId)
    }
    const checkpointFile = path.join(root, runId, 'checkpoints', 'latest.json')
    let toolCalls = []
    if (fs.existsSync(checkpointFile)) {
      try {
        const checkpoint = JSON.parse(fs.readFileSync(checkpointFile, 'utf8'))
        toolCalls = Array.isArray(checkpoint?.data?.toolLedger?.calls)
          ? checkpoint.data.toolLedger.calls
          : []
      } catch {
        toolCalls = []
      }
    }
    const connectorCalls = new Map()
    for (const call of toolCalls) {
      const connectorId = connectorForToolName(call?.name)
      if (!connectorId) continue
      connectorIds.add(connectorId)
      const current = connectorCalls.get(connectorId) || {
        successfulToolCallCount: 0,
        failedToolCallCount: 0,
        successfulToolNames: new Set(),
        failedToolNames: new Set(),
      }
      if (call?.status === 'ok') {
        current.successfulToolCallCount += 1
        current.successfulToolNames.add(String(call.name || '').trim())
      } else {
        current.failedToolCallCount += 1
        current.failedToolNames.add(String(call.name || '').trim())
      }
      connectorCalls.set(connectorId, current)
    }
    for (const connectorId of connectorIds) {
      const previous = byConnector.get(connectorId) || {
        connectorId,
        successfulRunCount: 0,
        runIds: [],
        latestAt: '',
        evidenceKind: 'completed_run_tool_surface',
        successfulToolCallCount: 0,
        failedToolCallCount: 0,
        successfulToolNames: [],
        failedToolNames: [],
        runIdsWithSuccessfulCalls: [],
      }
      previous.successfulRunCount += 1
      if (!previous.runIds.includes(runId)) previous.runIds.push(runId)
      const at = String(terminal.ts || terminal.payload?.report?.endedAt || '').trim()
      if (at && (!previous.latestAt || at > previous.latestAt)) previous.latestAt = at
      const calls = connectorCalls.get(connectorId)
      if (calls) {
        previous.successfulToolCallCount += calls.successfulToolCallCount
        previous.failedToolCallCount += calls.failedToolCallCount
        previous.successfulToolNames = [...new Set([
          ...previous.successfulToolNames,
          ...calls.successfulToolNames,
        ])].sort()
        previous.failedToolNames = [...new Set([
          ...previous.failedToolNames,
          ...calls.failedToolNames,
        ])].sort()
        if (calls.successfulToolCallCount > 0) {
          previous.evidenceKind = 'completed_run_tool_calls'
          if (!previous.runIdsWithSuccessfulCalls.includes(runId)) {
            previous.runIdsWithSuccessfulCalls.push(runId)
          }
        }
      }
      byConnector.set(connectorId, previous)
    }
  }
  return [...byConnector.values()].sort((a, b) => a.connectorId.localeCompare(b.connectorId))
}

function readQualificationReport(reportFile) {
  const resolved = String(reportFile || '').trim()
  if (!resolved) return { report: null, error: '' }
  try {
    const absolute = path.resolve(resolved)
    const stat = fs.statSync(absolute)
    if (stat.isDirectory()) {
      const files = fs.readdirSync(absolute)
        .filter(name => name.toLowerCase().endsWith('.json'))
        .filter(name => !name.endsWith('-agent-evals.json'))
        .sort((a, b) => a.localeCompare(b))
      const reports = files.map(name => ({
        name,
        value: JSON.parse(fs.readFileSync(path.join(absolute, name), 'utf8')),
      }))
      const tasks = []
      const seenEvalIds = new Set()
      for (const entry of reports) {
        for (const task of Array.isArray(entry.value?.tasks) ? entry.value.tasks : []) {
          const evalId = String(task?.evalId || '').trim()
          if (evalId && seenEvalIds.has(evalId)) {
            throw new Error(`资格报告包含重复 evalId：${evalId}（文件：${entry.name}）`)
          }
          if (evalId) seenEvalIds.add(evalId)
          tasks.push(task)
        }
      }
      const generatedAt = reports
        .map(entry => String(entry.value?.generatedAt || '').trim())
        .filter(Boolean)
        .sort()
        .pop() || ''
      return {
        report: {
          schemaVersion: 2,
          suite: 'merged-qualification-reports',
          generatedAt,
          sourceReports: reports.map(entry => entry.name),
          tasks,
        },
        error: '',
      }
    }
    return {
      report: JSON.parse(fs.readFileSync(absolute, 'utf8')),
      error: '',
    }
  } catch (error) {
    return {
      report: null,
      error: String(error?.message || error || '资格报告读取失败'),
    }
  }
}

function buildExpertReadinessMatrix(validation = {}, productionExpertIds = []) {
  const ids = [...productionExpertIds]
    .map(value => String(value || '').trim())
    .filter(Boolean)
    .sort()
  const experts = Array.isArray(validation.experts) ? validation.experts : []
  const routes = Array.isArray(validation.routes) ? validation.routes : []
  const qualificationExperts = Array.isArray(validation.qualification?.experts)
    ? validation.qualification.experts
    : []
  const skillRecords = Array.isArray(validation.skills) ? validation.skills : []
  const connectorRecords = Array.isArray(validation.connectors) ? validation.connectors : []
  const inconclusiveConnectors = Array.isArray(validation.connectorHealthInconclusive)
    ? validation.connectorHealthInconclusive
    : []
  const unavailableSkills = Array.isArray(validation.conditionalUnavailableSkills)
    ? validation.conditionalUnavailableSkills
    : []
  const unavailableConnectors = Array.isArray(validation.conditionalUnavailableConnectors)
    ? validation.conditionalUnavailableConnectors
    : []

  return ids.map(expertId => {
    const expert = experts.find(item => String(item?.id || '').trim() === expertId)
    const expertRoutes = routes.filter(item => String(item?.expertId || '').trim() === expertId)
    const routeRefs = new Set(expertRoutes.map(item => `${expertId}:${item.routeId}`))
    const routeUnavailableSkills = expertRoutes.flatMap(route => (route.requiredSkills || [])
      .filter(skillId => {
        const skill = skillRecords.find(item => item.id === skillId)
        return skill?.installed !== true || skill?.enabled !== true || skill?.groundingOk !== true
      }))
    const expertUnavailableSkills = unavailableSkills
      .filter(item => (item.routes || []).some(routeRef => routeRefs.has(routeRef)))
      .map(item => item.id)
    expertUnavailableSkills.push(...routeUnavailableSkills)
    const routeUnavailableConnectors = expertRoutes.flatMap(route => (route.requiredConnectorIds || [])
      .filter(connectorId => {
        const connector = connectorRecords.find(item => item.id === connectorId)
        return connector?.installed !== true || connector?.enabled !== true || connector?.operational === false
      }))
    const expertUnavailableConnectors = unavailableConnectors
      .filter(item => (item.routes || []).some(routeRef => routeRefs.has(routeRef)))
      .map(item => item.id)
    expertUnavailableConnectors.push(...routeUnavailableConnectors)
    const expertInconclusiveConnectors = inconclusiveConnectors
      .filter(item => expertUnavailableConnectors.includes(item.id))
      .map(item => ({ id: item.id, state: item.state }))
    const unverifiedRoutes = expertRoutes
      .filter(item => item.readiness !== 'verified'
        || item.requiredSkillsReady !== true
        || item.requiredConnectorsReady !== true)
      .map(item => item.routeId)
    const packageBlockers = []
    if (!expert) packageBlockers.push('expert_missing')
    else {
      if (expert.installed !== true) packageBlockers.push('expert_not_installed')
      if (expert.enabled !== true) packageBlockers.push('expert_disabled')
      if (expert.loadOk !== true) packageBlockers.push('expert_load_failed')
      if (expert.snapshotOk !== true || expert.degraded === true) packageBlockers.push('expert_snapshot_degraded')
    }
    const qualification = qualificationExperts.find(item => item.expertId === expertId) || {
      expertId,
      state: 'not_provided',
      qualified: false,
      sampleCount: 0,
      issues: ['qualification_report_missing'],
    }
    const qualificationBlockers = qualification.qualified === true
      ? []
      : (Array.isArray(qualification.issues) && qualification.issues.length
        ? qualification.issues
        : [String(qualification.state || 'qualification_pending')])
    const packageReady = packageBlockers.length === 0
    const routesReady = unverifiedRoutes.length === 0
    const environmentBlocked = expertInconclusiveConnectors.length > 0
    let status = 'production_ready'
    if (!packageReady) status = 'package_blocked'
    else if (environmentBlocked) status = 'environment_blocked'
    else if (!routesReady) status = 'route_unverified'
    else if (qualification.qualified !== true) status = 'qualification_pending'
    const blockers = []
    for (const code of packageBlockers) blockers.push({ code, source: 'expert' })
    if (expertUnavailableSkills.length) blockers.push({
      code: 'conditional_skills_unavailable',
      source: 'route',
      ids: [...new Set(expertUnavailableSkills)],
    })
    if (expertUnavailableConnectors.length) blockers.push({
      code: environmentBlocked ? 'connector_environment_inconclusive' : 'conditional_connectors_unavailable',
      source: 'route',
      ids: [...new Set(expertUnavailableConnectors)],
      states: expertInconclusiveConnectors,
    })
    if (unverifiedRoutes.length) blockers.push({
      code: 'route_execution_evidence_missing',
      source: 'route',
      routeIds: unverifiedRoutes,
    })
    if (qualification.qualified !== true) blockers.push({
      code: 'professional_qualification_incomplete',
      source: 'qualification',
      issues: qualificationBlockers,
    })
    return {
      expertId,
      status,
      package: {
        ready: packageReady,
        version: String(expert?.version || ''),
        loadOk: expert?.loadOk === true,
        snapshotOk: expert?.snapshotOk === true,
        blockers: packageBlockers,
      },
      routes: {
        total: expertRoutes.length,
        verified: expertRoutes.length - unverifiedRoutes.length,
        unverifiedRouteIds: unverifiedRoutes,
        unavailableSkills: [...new Set(expertUnavailableSkills)],
        unavailableConnectors: [...new Set(expertUnavailableConnectors)],
        inconclusiveConnectors: expertInconclusiveConnectors,
      },
      qualification: {
        state: String(qualification.state || 'not_provided'),
        qualified: qualification.qualified === true,
        sampleCount: Number(qualification.sampleCount) || 0,
        issues: qualificationBlockers,
      },
      blockers,
    }
  })
}

function buildProductionSummary(validation, requiredDependencies) {
  const unavailableSkills = validation.skills.filter(item => item.required === true
    && (item.installed !== true || item.enabled !== true))
  const optionalUnavailableSkills = validation.skills.filter(item => item.required !== true
    && (item.installed !== true || item.enabled !== true))
  const unavailableConnectors = validation.connectors.filter(item => item.required === true
    && (item.installed !== true || item.enabled !== true))
  const optionalUnavailableConnectors = validation.connectors.filter(item => item.required !== true
    && (item.installed !== true || item.enabled !== true))
  const degradedExperts = validation.experts.filter(item => item.degraded === true)
  const taskCatalogIssues = validation.taskCatalog?.issues || []
  const conditionalRoutes = (validation.routes || []).map(item => ({
    expertId: item.expertId,
    routeId: item.routeId,
    requiredTools: item.requiredTools,
    requiredSkills: item.requiredSkills,
    ...(Array.isArray(item.requiredConnectorIds) && item.requiredConnectorIds.length
      ? { requiredConnectorIds: item.requiredConnectorIds }
      : {}),
    readiness: item.readiness,
    requiredSkillsReady: item.requiredSkillsReady !== false,
    requiredConnectorsReady: item.requiredConnectorsReady !== false,
    evidenceCount: Number(item.evidenceCount) || 0,
    evidenceRunIds: Array.isArray(item.evidenceRunIds) ? item.evidenceRunIds : [],
  }))
  const conditionalUnavailableSkills = [...new Map(
    conditionalRoutes.flatMap(route => (route.requiredSkills || []).map(skillId => {
      const skill = validation.skills.find(item => item.id === skillId)
      const ready = skill?.installed === true && skill?.enabled === true && skill?.groundingOk === true
      return ready ? [] : [skillId, {
        id: skillId,
        routes: [`${route.expertId}:${route.routeId}`],
      }]
    }))
      .filter(item => item.length > 0),
  )].map(([id, item]) => ({ id, routes: item.routes }))
  const conditionalUnavailableConnectors = [...new Map(
    conditionalRoutes.flatMap(route => (route.requiredConnectorIds || []).map(connectorId => {
      const connector = validation.connectors.find(item => item.id === connectorId)
      const ready = connector?.installed === true
        && connector?.enabled === true
        && connector?.operational !== false
      return ready ? [] : [connectorId, {
        id: connectorId,
        routes: [`${route.expertId}:${route.routeId}`],
      }]
    }))
      .filter(item => item.length > 0),
  )].map(([id, item]) => ({ id, routes: item.routes }))
  for (const route of conditionalRoutes) {
    for (const item of conditionalUnavailableSkills) {
      if ((route.requiredSkills || []).includes(item.id)) {
        const routeRef = `${route.expertId}:${route.routeId}`
        if (!item.routes.includes(routeRef)) item.routes.push(routeRef)
      }
    }
    for (const item of conditionalUnavailableConnectors) {
      if ((route.requiredConnectorIds || []).includes(item.id)) {
        const routeRef = `${route.expertId}:${route.routeId}`
        if (!item.routes.includes(routeRef)) item.routes.push(routeRef)
      }
    }
  }
  const unverifiedConditionalRoutes = conditionalRoutes.filter(item => (
    item.readiness !== 'verified'
      || item.requiredSkillsReady !== true
      || item.requiredConnectorsReady !== true
  ))
  const historicalRunEvidence = Array.isArray(validation.historicalRunEvidence)
    ? validation.historicalRunEvidence
    : []
  const historicalConnectorIds = new Set(historicalRunEvidence
    .map(item => String(item?.connectorId || '').trim())
    .filter(Boolean))
  const inconclusiveProbeStates = new Set([
    'auth_required',
    'offline',
    'probe_failed',
    'safe_storage_unavailable',
    'secret_unavailable',
    'sandbox_unavailable',
  ])
  const connectorHealthInconclusive = validation.connectors
    .filter(item => {
      if (item.installed !== true || item.enabled !== true || item.operational !== false) return false
      const state = String(item.liveProbe?.state || '').trim()
      return item.liveProbe?.attempted === true
        && inconclusiveProbeStates.has(state)
        && historicalConnectorIds.has(String(item.id || '').trim())
    })
    .map(item => {
      const historical = historicalRunEvidence.find(entry => entry.connectorId === item.id)
      return {
        id: item.id,
        state: String(item.liveProbe?.state || '').trim(),
        reason: historical?.evidenceKind === 'completed_run_tool_calls'
          ? '当前进程无法读取或复现连接器状态，但历史完成运行曾真实调用成功；需要在正常 KnowMe 运行环境重新验证。'
          : '当前进程无法读取或复现连接器状态，但历史完成运行曾加载过该连接器工具面；需要在正常 KnowMe 运行环境重新验证。',
        historicalEvidence: historical ? {
          evidenceKind: historical.evidenceKind,
          successfulRunCount: Number(historical.successfulRunCount) || 0,
          successfulToolCallCount: Number(historical.successfulToolCallCount) || 0,
          failedToolCallCount: Number(historical.failedToolCallCount) || 0,
          runIds: Array.isArray(historical.runIds) ? historical.runIds : [],
          runIdsWithSuccessfulCalls: Array.isArray(historical.runIdsWithSuccessfulCalls)
            ? historical.runIdsWithSuccessfulCalls
            : [],
          successfulToolNames: Array.isArray(historical.successfulToolNames)
            ? historical.successfulToolNames
            : [],
          failedToolNames: Array.isArray(historical.failedToolNames)
            ? historical.failedToolNames
            : [],
        } : null,
      }
    })
  const inconclusiveIds = new Set(connectorHealthInconclusive.map(item => item.id))
  const unhealthyConnectors = validation.connectors
    .filter(item => item.installed === true
      && item.enabled === true
      && item.operational === false
      && !inconclusiveIds.has(item.id))
    .map(item => item.id)
  const connectorHealthProbed = validation.connectors.some(item => item.liveProbe?.attempted === true)
  const packageReady = unavailableSkills.length === 0
    && unavailableConnectors.length === 0
    && degradedExperts.length === 0
    && taskCatalogIssues.length === 0
  const qualificationGatePassed = validation.qualification?.complete === true
  const productionExpertIds = new Set((validation.qualification?.experts || [])
    .map(item => String(item?.expertId || '').trim())
    .filter(Boolean))
  const expertReadiness = buildExpertReadinessMatrix({
    ...validation,
    connectorHealthInconclusive,
    conditionalUnavailableSkills,
    conditionalUnavailableConnectors,
  }, productionExpertIds)
  return {
    // Static package readiness is not full production readiness. A declared
    // tool such as generate_image still needs a live route probe and receipt.
    packageReady,
    productionReady: packageReady
      && unhealthyConnectors.length === 0
      && connectorHealthInconclusive.length === 0
      && unverifiedConditionalRoutes.length === 0
      && qualificationGatePassed,
    executionReady: packageReady
      && unhealthyConnectors.length === 0
      && connectorHealthInconclusive.length === 0
      && unverifiedConditionalRoutes.length === 0,
    qualificationGatePassed,
    expertReadiness,
    qualification: validation.qualification || {
      provided: false,
      status: 'not_provided',
      complete: false,
      qualifiedExpertIds: [],
      missingExpertIds: [],
      experts: [],
    },
    requiredSkills: [...requiredDependencies.skill.keys()],
    requiredConnectors: [...requiredDependencies.connector.keys()],
    unavailableSkills: unavailableSkills.map(item => item.id),
    unavailableConnectors: unavailableConnectors.map(item => item.id),
    unhealthyConnectors,
    connectorHealthInconclusive,
    connectorHealthProbed,
    optionalUnavailableSkills: optionalUnavailableSkills.map(item => item.id),
    // Route dependencies are intentionally not part of static packageReady:
    // they are only required when that route is selected. Keep them explicit
    // so an audit cannot look complete while a selected route is unavailable.
    conditionalUnavailableSkills,
    conditionalUnavailableConnectors,
    optionalUnavailableConnectors: optionalUnavailableConnectors.map(item => item.id),
    historicalEvidence: validation.historicalEvidence || [],
    historicalRunEvidence,
    conditionalRoutes,
    unverifiedConditionalRoutes,
    degradedExperts: degradedExperts.map(item => ({
      id: item.id,
      issues: item.issues || [],
    })),
    taskCatalogIssues,
  }
}

async function main() {
  const options = parseArgs(process.argv)
  const apply = options.apply
  const userData = options.userData
    ? path.resolve(options.userData)
    : process.env.KNOWME_USER_DATA
    ? path.resolve(process.env.KNOWME_USER_DATA)
    : path.join(process.env.APPDATA || '', 'KnowMe')
  const snapshotRoot = createAuditSnapshotRoot(options.snapshotRoot)
  const catalogRoot = path.resolve(__dirname, '..', 'src', 'catalog')
  const bundledCatalog = loadBundledCatalog(catalogRoot)
  const productionExpertIds = new Set((bundledCatalog.entries || [])
    .filter(item => item.kind === 'expert')
    .map(item => String(item.id || '').trim())
    .filter(Boolean))
  const catalogEntries = listCatalog(userData, { bundledRoot: catalogRoot }).entries
  const runtime = createRuntime(userData, catalogRoot, snapshotRoot, { ensureDefaults: apply })
  const { hub } = runtime
  const beforeExperts = (await hub.listCapabilities({ kind: 'expert' })).items
  const beforeSkills = (await hub.listCapabilities({ kind: 'skill' })).items
  const beforeConnectors = (await hub.listCapabilities({ kind: 'connector' })).items
  const result = {
    generatedAt: new Date().toISOString(),
    userData,
    snapshotRoot,
    apply,
    backupDir: '',
    inventory: {
      experts: beforeExperts.length,
      productionExperts: productionExpertIds.size,
      nonProductionExperts: beforeExperts.filter(item => !productionExpertIds.has(item.id)).length,
      skills: beforeSkills.length,
      connectors: beforeConnectors.length,
    },
    installs: { skills: [], connectors: [], experts: [] },
    workbench: { modeId: '', bindings: [] },
    validation: { skills: [], connectors: [], experts: [], routes: [], taskCatalog: null },
  }

  if (apply) {
    const backupDir = path.join(userData, 'audit', `capability-production-${timestamp()}`)
    result.backupDir = backupDir
    copyIfPresent(path.join(userData, 'capabilities', 'install-store.json'), backupDir)
    copyIfPresent(path.join(userData, 'workbench-modes.json'), backupDir)

    for (const item of beforeSkills) {
      if (item.installed && item.enabled) {
        result.installs.skills.push({ id: item.id, ok: true, status: 'already' })
        continue
      }
      const installed = await hub.installCapability({ id: item.id, enabled: true, riskConfirmed: true })
      result.installs.skills.push({
        id: item.id,
        ok: installed.ok === true,
        status: installed.ok ? 'installed' : 'failed',
        code: installed.code || '',
        error: installed.error || '',
        warnings: installed.warnings || [],
      })
    }

    for (const item of beforeConnectors) {
      if (item.installed && item.enabled) {
        result.installs.connectors.push({ id: item.id, ok: true, status: 'already' })
        continue
      }
      const installed = await hub.installCapability({ id: item.id, enabled: true, riskConfirmed: true })
      result.installs.connectors.push({
        id: item.id,
        ok: installed.ok === true,
        status: installed.ok ? 'installed' : 'failed',
        code: installed.code || '',
        error: installed.error || '',
        warnings: installed.warnings || [],
      })
    }

    for (const item of beforeExperts) {
      if (item.installed && item.enabled) {
        result.installs.experts.push({ id: item.id, ok: true, status: 'already' })
        continue
      }
      const installed = await hub.installCapability({ id: item.id, enabled: true, riskConfirmed: true })
      result.installs.experts.push({
        id: item.id,
        ok: installed.ok === true,
        status: installed.ok ? 'installed' : 'failed',
        code: installed.code || '',
        error: installed.error || '',
        warnings: installed.warnings || [],
      })
    }

    const modeStore = createWorkbenchModeStore({ userData })
    const modeState = modeStore.load()
    result.workbench.modeId = modeState.activeModeId
    for (const item of beforeExperts) {
      const bound = modeStore.bindExpert(item.id, { modeId: modeState.activeModeId })
      result.workbench.bindings.push({
        id: item.id,
        ok: bound.ok === true,
        status: bound.ok ? (bound.alreadyBound ? 'already' : 'bound') : 'failed',
        error: bound.error || '',
      })
    }
  }

  const afterExperts = (await hub.listCapabilities({ kind: 'expert' })).items
  const afterSkills = (await hub.listCapabilities({ kind: 'skill' })).items
  const afterConnectors = (await hub.listCapabilities({ kind: 'connector' })).items
  const expertRuntime = hub.expertRuntime()
  const requiredDependencies = collectRequiredDependencies(expertRuntime.listExperts()
    .filter(item => productionExpertIds.has(String(item.id || '').trim())))
  result.validation.requiredDependencies = {
    skills: [...requiredDependencies.skill.entries()].map(([id, experts]) => ({
      id,
      experts: [...experts],
    })),
    connectors: [...requiredDependencies.connector.entries()].map(([id, experts]) => ({
      id,
      experts: [...experts],
    })),
  }
  const skillRuntime = hub.skillRuntime()
  for (const item of afterSkills) {
    const record = skillRuntime.findSkillRecord(item.id)
    const requiredByExperts = [...(requiredDependencies.skill.get(item.id) || [])]
    const installed = item.installed === true && item.enabled === true
    const loaded = installed
      ? skillRuntime.loadSkillL1(item.id, { maxChars: 12000, invocation: 'explicit-user' })
      : { ok: false, code: 'not_installed', message: '技能未安装或已停用' }
    const grounding = installed
      ? skillRuntime.loadSkillGroundingContract(item.id)
      : { ok: false, issues: [{ message: '技能未安装或已停用' }] }
    result.validation.skills.push({
      id: item.id,
      name: item.name,
      installed: item.installed,
      enabled: item.enabled,
      source: item.source,
      ownerPackId: item.ownerPackId || '',
      recordFound: Boolean(record),
      loadOk: loaded.ok === true,
      modelInvocationAllowed: record?.disableModelInvocation !== true,
      invocationMode: record?.disableModelInvocation === true ? 'explicit-user' : 'model-or-user',
      bodyChars: loaded.ok ? loaded.body.length : 0,
      groundingOk: grounding.ok === true,
      groundingIssues: grounding.issues || [],
      experienceWarnings: item.experienceWarnings || [],
      required: requiredByExperts.length > 0,
      requiredByExperts,
      error: loaded.ok ? '' : (loaded.message || loaded.code || 'load failed'),
    })
  }

  for (const item of afterConnectors) {
    const requiredByExperts = [...(requiredDependencies.connector.get(item.id) || [])]
    result.validation.connectors.push({
      id: item.id,
      name: item.name,
      installed: item.installed,
      enabled: item.enabled,
      source: item.source,
      required: requiredByExperts.length > 0,
      requiredByExperts,
      recordFound: Boolean(item),
      error: item.installed && item.enabled ? '' : '连接器未安装或已停用',
    })
  }

  for (const [id, experts] of requiredDependencies.skill.entries()) {
    if (result.validation.skills.some(item => item.id === id)) continue
    result.validation.skills.push({
      id,
      name: id,
      installed: false,
      enabled: false,
      source: '',
      required: true,
      requiredByExperts: [...experts],
      recordFound: false,
      loadOk: false,
      modelInvocationAllowed: false,
      invocationMode: 'explicit-user',
      bodyChars: 0,
      groundingOk: false,
      groundingIssues: [{ message: '必需技能未在能力目录中找到' }],
      experienceWarnings: [],
      error: '必需技能未在能力目录中找到',
    })
  }
  for (const [id, experts] of requiredDependencies.connector.entries()) {
    if (result.validation.connectors.some(item => item.id === id)) continue
    result.validation.connectors.push({
      id,
      name: id,
      installed: false,
      enabled: false,
      source: '',
      required: true,
      requiredByExperts: [...experts],
      recordFound: false,
      error: '必需连接器未在能力目录中找到',
    })
  }

  const conditionalRoutes = collectConditionalRouteRequirements(catalogEntries.filter(item => (
    item.kind !== 'expert' || productionExpertIds.has(String(item.id || '').trim())
  )))
  if (options.probeConnectors) {
    const probeIds = new Set([
      ...requiredDependencies.connector.keys(),
      ...conditionalRoutes.flatMap(route => route.requiredConnectorIds || []),
    ])
    await Promise.all(result.validation.connectors
      .filter(item => probeIds.has(item.id))
      .map(async item => {
        item.liveProbe = await probeConnector(runtime.connectorsApi, item)
        item.operational = item.liveProbe.operational === true
        item.error = item.operational ? item.error : (item.liveProbe.message || item.error)
      }))
  }

  const storedTasks = createWorkbenchTaskStore(path.join(userData, 'workbench-tasks.json')).list()
  result.validation.historicalRunEvidence = collectHistoricalRunEvidence(userData)
  result.validation.routes = conditionalRoutes.map(route => {
    return {
      ...route,
      requiredSkillsReady: route.requiredSkills.every(skillId => result.validation.skills.some(item =>
        item.id === skillId && item.installed === true && item.enabled === true && item.groundingOk === true)),
      requiredConnectorsReady: (route.requiredConnectorIds || []).every(connectorId => result.validation.connectors.some(item =>
        item.id === connectorId
          && item.installed === true
          && item.enabled === true
          && item.operational !== false)),
    }
  })

  for (const item of afterExperts) {
    const loaded = expertRuntime.loadExpert(item.id)
    const sessionId = `audit-${item.id}-${Date.now()}`
    const { snapshot, snapshotError } = safeCreateAuditSnapshot(expertRuntime, loaded, item, sessionId)
    result.validation.experts.push({
      id: item.id,
      name: item.name,
      installed: item.installed,
      enabled: item.enabled,
      loadOk: loaded.ok === true,
      version: snapshot.capabilityManifest?.version || loaded.manifest?.version || '',
      hash: snapshot.hashes?.expert || '',
      promptChars: loaded.ok ? loaded.systemPrompt.length : 0,
      snapshotOk: snapshot.ok === true,
      degraded: snapshot.degraded === true || (loaded.ok === true && snapshot.ok !== true),
      issues: snapshot.issues || loaded.issues || [],
      error: loaded.ok
        ? (snapshot.ok ? '' : (snapshot.message || snapshot.error || snapshotError || 'snapshot failed'))
        : (loaded.message || loaded.error || 'load failed'),
    })
  }

  const currentExperts = new Map(result.validation.experts.map(item => [item.id, {
    version: item.version,
    hash: item.hash,
  }]))
  result.validation.historicalEvidence = collectHistoricalTaskEvidence(storedTasks.tasks, currentExperts)
  const qualificationInput = readQualificationReport(options.qualificationReport)
  result.validation.qualification = collectQualificationReadiness(
    qualificationInput.report,
    productionExpertIds,
    currentExperts,
    options.qualificationReport,
  )
  if (qualificationInput.error) {
    result.validation.qualification.status = 'invalid_report'
    result.validation.qualification.error = qualificationInput.error
  }
  const verifiedRouteEvidence = collectVerifiedRouteEvidence(storedTasks.tasks, result.validation.routes, currentExperts)
  result.validation.routes = result.validation.routes.map(route => {
    const evidence = verifiedRouteEvidence.get(`${route.expertId}:${route.routeId}`)
    return evidence ? {
      ...route,
      readiness: 'verified',
      evidenceCount: evidence.evidenceCount,
      evidenceRunIds: evidence.runIds,
    } : route
  })

  const tasks = hub.listSkillTasks()
  result.validation.taskCatalog = {
    tasks: tasks.tasks?.length || 0,
    issues: tasks.issues || [],
    revision: tasks.revision || '',
  }
  result.summary = buildProductionSummary(result.validation, requiredDependencies)
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  if (options.strict && !result.summary.productionReady) process.exitCode = 2
}

if (require.main === module) {
  main().catch(error => {
    process.stderr.write(`${error?.stack || error}\n`)
    process.exitCode = 1
  })
}

module.exports = {
  main,
  parseArgs,
  safeCreateAuditSnapshot,
  createAuditSnapshotRoot,
  collectRequiredDependencies,
  collectConditionalRouteRequirements,
  collectVerifiedRouteEvidence,
  collectHistoricalTaskEvidence,
  collectHistoricalRunEvidence,
  collectQualificationReadiness,
  hasIndependentProfessionalReview,
  buildExpertReadinessMatrix,
  readQualificationReport,
  buildProductionSummary,
  createRuntime,
}
