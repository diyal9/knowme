'use strict'

require('./register-ts')

const fs = require('fs')
const os = require('os')
const path = require('path')
const { _electron: electron } = require('playwright')
const { buildQualificationContext } = require('../src/lib/expert-task-runtime')

const TERMINAL_STATUSES = new Set(['review', 'completed', 'failed', 'cancelled', 'needs_input'])
const RETRYABLE_STATUSES = new Set(['failed', 'cancelled', 'needs_input', 'starting', 'running', 'revising'])

function parseArgs(argv) {
  const out = { cases: [], suite: '', userData: '', sourceUserData: '', output: '', headed: false }
  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--suite') out.suite = String(argv[++index] || '')
    else if (value === '--case') out.cases.push(...String(argv[++index] || '').split(',').filter(Boolean))
    else if (value === '--user-data') out.userData = String(argv[++index] || '')
    else if (value === '--source-user-data') out.sourceUserData = String(argv[++index] || '')
    else if (value === '--out') out.output = String(argv[++index] || '')
    else if (value === '--headed') out.headed = true
    else throw new Error(`Unknown option: ${value}`)
  }
  return out
}

function isInside(candidate, parent) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate))
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

function assertSafeUserData(input, env = process.env) {
  if (!String(input || '').trim()) {
    throw new Error('--user-data is required; production qualification must use an explicit isolated QA directory')
  }
  const resolved = path.resolve(input)
  const productionRoot = path.resolve(String(env.APPDATA || ''), 'KnowMe')
  if (env.APPDATA && isInside(resolved, productionRoot)) {
    throw new Error(`Refusing to use production KnowMe userData: ${resolved}`)
  }
  if (!/(?:^|[\\/_-])(qa|test|qualification|eval)(?:[\\/_-]|$)/i.test(resolved)) {
    throw new Error('Isolated userData path must contain a qa, test, qualification, or eval marker')
  }
  return resolved
}

const PROVIDER_SETTINGS_KEYS = [
  'llmProvider', 'llmProfile', 'apiEndpoint', 'model', 'temperature', 'tokenCalibrations',
]
const ENCRYPTED_PROVIDER_SETTINGS_KEYS = [
  'apiKeyEnc', 'embeddingApiKeyEnc', 'gitlabTokenEnc', 'workbenchTokenEnc',
]
const PLAINTEXT_SECRET_SETTINGS_KEYS = [
  'apiKey', 'embeddingApiKey', 'gitlabToken', 'workbenchToken', 'systemPrompt',
]

/**
 * Seed an isolated qualification profile without copying or logging plaintext
 * credentials. Encrypted values remain encrypted and are only useful when the
 * launched Electron process can decrypt them through the OS secure store.
 */
function seedEncryptedProviderSettings(sourceUserData, targetUserData) {
  const source = String(sourceUserData || '').trim()
  if (!source) return { requested: false, copied: false, reason: 'not_requested' }
  const sourceDir = path.resolve(source)
  const targetDir = path.resolve(String(targetUserData || ''))
  if (!targetDir || sourceDir === targetDir) {
    throw new Error('--source-user-data must be different from the isolated --user-data directory')
  }
  const sourceFile = path.join(sourceDir, 'settings.json')
  if (!fs.existsSync(sourceFile)) {
    return { requested: true, copied: false, reason: 'source_settings_missing' }
  }
  let sourceSettings
  try {
    sourceSettings = JSON.parse(fs.readFileSync(sourceFile, 'utf8'))
  } catch (error) {
    throw new Error(`Unable to read source provider settings: ${error.message || error}`)
  }
  if (!sourceSettings || typeof sourceSettings !== 'object' || Array.isArray(sourceSettings)) {
    throw new Error('Source provider settings must be a JSON object')
  }
  const targetFile = path.join(targetDir, 'settings.json')
  let targetSettings = {}
  try {
    const rawTarget = JSON.parse(fs.readFileSync(targetFile, 'utf8'))
    if (rawTarget && typeof rawTarget === 'object' && !Array.isArray(rawTarget)) targetSettings = rawTarget
  } catch { /* an isolated directory may not have settings yet */ }
  const next = { ...targetSettings }
  for (const key of [...PROVIDER_SETTINGS_KEYS, ...ENCRYPTED_PROVIDER_SETTINGS_KEYS]) {
    if (Object.prototype.hasOwnProperty.call(sourceSettings, key)) next[key] = sourceSettings[key]
  }
  for (const key of PLAINTEXT_SECRET_SETTINGS_KEYS) delete next[key]
  fs.mkdirSync(targetDir, { recursive: true })
  fs.writeFileSync(targetFile, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  return {
    requested: true,
    copied: true,
    source: 'encrypted_settings_only',
    encryptedProviderConfigured: Boolean(String(next.apiKeyEnc || '').trim()),
  }
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

function loadSuite(file, selectedIds = []) {
  const suite = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (!suite || !Array.isArray(suite.evals) || !suite.evals.length) throw new Error('Qualification suite has no evals')
  if (suite.setup?.installCapabilities != null && !Array.isArray(suite.setup.installCapabilities)) {
    throw new Error('suite.setup.installCapabilities must be an array')
  }
  const wanted = new Set(selectedIds.map(value => String(value || '').trim()).filter(Boolean))
  const evals = wanted.size
    ? suite.evals.filter(item => wanted.has(String(item?.id || '').trim()))
    : suite.evals
  if (wanted.size && evals.length !== wanted.size) {
    const found = new Set(evals.map(item => String(item?.id || '').trim()))
    const missing = [...wanted].filter(id => !found.has(id))
    throw new Error(`Unknown eval id(s): ${missing.join(', ')}`)
  }
  const ids = new Set()
  for (const item of evals) {
    if (!item?.id || !item?.expertId || !item?.prompt) throw new Error('Every eval requires id, expertId, and prompt')
    if (ids.has(item.id)) throw new Error(`Duplicate eval id: ${item.id}`)
    ids.add(item.id)
    if (!['create', 'cancel_then_retry', 'request_changes', 'accept_then_reopen'].includes(item.lifecycle || 'create')) {
      throw new Error(`Unsupported lifecycle for ${item.id}: ${item.lifecycle}`)
    }
    if (['request_changes', 'accept_then_reopen'].includes(item.lifecycle) && !String(item.reviewComment || '').trim()) {
      throw new Error(`${item.id} requires reviewComment`)
    }
    if (item.expectedStatus && !['review', 'completed', 'failed', 'cancelled', 'needs_input'].includes(item.expectedStatus)) {
      throw new Error(`Unsupported expectedStatus for ${item.id}: ${item.expectedStatus}`)
    }
    if (item.expectedStatus && ['request_changes', 'accept_then_reopen', 'cancel_then_retry'].includes(item.lifecycle)) {
      throw new Error(`${item.id} cannot combine expectedStatus with lifecycle ${item.lifecycle}`)
    }
  }
  return wanted.size ? { ...suite, evals } : suite
}

function suiteInstallCapabilities(suite) {
  return [...new Set((Array.isArray(suite?.setup?.installCapabilities) ? suite.setup.installCapabilities : [])
    .map(value => String(value || '').trim())
    .filter(Boolean))]
}

function readCursorMcpServer(serverName, env = process.env) {
  const home = String(env.USERPROFILE || env.HOME || os.homedir() || '').trim()
  if (!home || !String(serverName || '').trim()) return null
  const file = path.join(home, '.cursor', 'mcp.json')
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''))
    const server = parsed?.mcpServers?.[String(serverName).trim()]
    return server && typeof server === 'object' && !Array.isArray(server) ? { ...server } : null
  } catch {
    return null
  }
}

function cursorHeaderSecrets(item, server) {
  const mapping = item?.secretsFromCursorHeaders
  const headers = server?.headers
  if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping) || !headers || typeof headers !== 'object') return {}
  const normalizedHeaders = new Map(Object.entries(headers).map(([key, value]) => [String(key).toLowerCase(), value]))
  const secrets = {}
  for (const [secretKey, headerName] of Object.entries(mapping)) {
    const raw = normalizedHeaders.get(String(headerName || '').toLowerCase())
    if (raw == null || String(raw).trim() === '') continue
    const value = String(raw).trim()
    secrets[String(secretKey)] = String(headerName).toLowerCase() === 'authorization'
      ? value.replace(/^Bearer\s+/i, '')
      : value
  }
  return secrets
}

function suiteConnectorConfigurations(suite, env = process.env) {
  const configs = Array.isArray(suite?.setup?.configureConnectors) ? suite.setup.configureConnectors : []
  return configs.map(item => {
    const { secretsFromCursorHeaders: _secretsFromCursorHeaders, ...publicItem } = item || {}
    const mcp = item?.mcp && typeof item.mcp === 'object' ? { ...item.mcp } : undefined
    const cursorServerName = String(mcp?.urlFromCursorServer || '').trim()
    const cursorServer = cursorServerName ? readCursorMcpServer(cursorServerName, env) : null
    const qualificationSecrets = cursorHeaderSecrets(item, cursorServer)
    if (mcp?.urlFromEnv) {
      mcp.url = String(env[String(mcp.urlFromEnv)] || '').trim()
      delete mcp.urlFromEnv
    }
    if (!mcp?.url && cursorServer?.url) mcp.url = String(cursorServer.url).trim()
    delete mcp.urlFromCursorServer
    return {
      ...publicItem,
      ...(mcp ? { mcp } : {}),
      ...(Object.keys(qualificationSecrets).length
        ? { qualificationSecrets }
        : {}),
    }
  }).filter(item => item?.id)
}

function suiteConnectorConfigurationIssues(suite, env = process.env) {
  const configs = Array.isArray(suite?.setup?.configureConnectors) ? suite.setup.configureConnectors : []
  return configs.flatMap(item => {
    const id = String(item?.id || '').trim()
    if (!id) return []
    const mcp = item?.mcp && typeof item.mcp === 'object' ? item.mcp : null
    if (!mcp) return []
    const transport = String(mcp.transport || 'streamable-http').trim().toLowerCase()
    if (['streamable-http', 'sse', 'http'].includes(transport)) {
      const cursorServer = mcp.urlFromCursorServer ? readCursorMcpServer(mcp.urlFromCursorServer, env) : null
      const url = String(mcp.url || (mcp.urlFromEnv ? env[String(mcp.urlFromEnv)] : '') || cursorServer?.url || '').trim()
      if (!url) return [{
        id,
        code: 'missing_endpoint',
        field: mcp.urlFromEnv ? String(mcp.urlFromEnv) : mcp.urlFromCursorServer ? `cursor.mcpServers.${mcp.urlFromCursorServer}.url` : 'mcp.url',
        message: mcp.urlFromEnv
          ? `连接器 ${id} 需要设置环境变量 ${mcp.urlFromEnv}`
          : mcp.urlFromCursorServer
            ? `连接器 ${id} 需要在 Cursor MCP 配置中设置 ${mcp.urlFromCursorServer}.url`
          : `连接器 ${id} 缺少 MCP 服务地址`,
      }]
    }
    if (transport === 'stdio' && !String(mcp.command || '').trim()) return [{
      id,
      code: 'missing_command',
      field: 'mcp.command',
      message: `连接器 ${id} 缺少 stdio MCP 启动命令`,
    }]
    return []
  })
}

function selectCases(suite, selectedIds) {
  if (!selectedIds.length) return suite.evals
  const wanted = new Set(selectedIds)
  const selected = suite.evals.filter(item => wanted.has(String(item.id)))
  const missing = [...wanted].filter(id => !selected.some(item => String(item.id) === id))
  if (missing.length) throw new Error(`Unknown eval id(s): ${missing.join(', ')}`)
  return selected
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function taskGet(page, taskId) {
  return page.evaluate(id => window.api.expertTaskGet(id), taskId)
}

async function waitForTask(page, taskId, predicate, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs
  let latest = null
  while (Date.now() < deadline) {
    const result = await taskGet(page, taskId)
    if (result?.ok && result.task) {
      latest = result.task
      if (predicate(latest)) return latest
      if (TERMINAL_STATUSES.has(latest.status) && latest.status !== 'review' && latest.status !== 'completed') {
        throw new Error(`${label} stopped at ${latest.status}: ${latest.attention?.question || latest.attention?.detail || latest.resultSummary || 'no detail'}`)
      }
    }
    await delay(500)
  }
  throw new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)}s (last status: ${latest?.status || 'unknown'})`)
}

function primaryDeliverable(task) {
  return (task?.deliverables || []).find(item => item.required !== false) || task?.deliverables?.[0] || null
}

function deliverableVersion(task) {
  return Number(primaryDeliverable(task)?.version || 0)
}

async function waitForReview(page, taskId, timeoutMs, minimumVersion = 1) {
  return waitForTask(
    page,
    taskId,
    task => task.status === 'review' && deliverableVersion(task) >= minimumVersion,
    timeoutMs,
    `waiting for review v${minimumVersion}`,
  )
}

async function waitForExpectedOutcome(page, taskId, expectedStatus, timeoutMs) {
  return waitForTask(
    page,
    taskId,
    task => task.status === expectedStatus,
    timeoutMs,
    `waiting for expected status ${expectedStatus}`,
  )
}

async function retryWhenIdle(page, taskId, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs
  let latestError = ''
  while (Date.now() < deadline) {
    const result = await page.evaluate(id => window.api.expertTaskRetry(id), taskId)
    if (result?.ok && result.started) return result
    latestError = String(result?.error || '')
    if (result?.task && !RETRYABLE_STATUSES.has(result.task.status)) break
    await delay(300)
  }
  throw new Error(`retry did not start: ${latestError || 'unknown error'}`)
}

function lifecycleCheck(item, task, checkpoints) {
  const events = (task?.events || []).map(event => String(event.type || ''))
  const executionRoutes = [...new Set((task?.executionEvidence || [])
    .map(item => String(item?.executionRoute || '').trim())
    .filter(Boolean))]
  const blockedReason = environmentBlock(task)
  if (blockedReason) {
    return {
      passed: false,
      blocked: true,
      blockedReason,
      checks: {},
      events,
      executionRoutes,
    }
  }
  const version = deliverableVersion(task)
  const checks = {
    endedInExpectedState: item.expectedStatus
      ? task?.status === item.expectedStatus
      : task?.status === 'review',
    hasDeliverable: item.expectedHasDeliverable === false
      ? true
      : item.expectedStatus && item.expectedStatus !== 'review'
        ? Boolean(primaryDeliverable(task))
        : Boolean(primaryDeliverable(task)),
  }
  if (item.expectedAttentionKind) {
    checks.hasExpectedAttention = task?.attention?.kind === item.expectedAttentionKind
  }
  if (item.expectedHasDeliverable === false) {
    checks.hasNoDeliverable = !primaryDeliverable(task)
  }
  if (item.routeId) {
    checks.executionRouteSelected = executionRoutes.includes(String(item.routeId).trim())
  }
  if (item.lifecycle === 'cancel_then_retry') {
    checks.cancelled = events.includes('cancelled')
    checks.retried = events.includes('retried') || events.includes('resumed')
  }
  if (item.lifecycle === 'request_changes') {
    checks.changesRequested = events.includes('changes_requested')
    checks.newVersion = version > Number(checkpoints.initialVersion || 0)
    checks.previousVersionLinked = Boolean(primaryDeliverable(task)?.previousVersionId)
  }
  if (item.lifecycle === 'accept_then_reopen') {
    checks.accepted = events.includes('deliverable_accepted')
    checks.reopened = events.includes('changes_requested')
    checks.newVersion = version > Number(checkpoints.initialVersion || 0)
    checks.previousVersionLinked = Boolean(primaryDeliverable(task)?.previousVersionId)
  }
  return { passed: Object.values(checks).every(Boolean), blocked: false, checks, events, executionRoutes }
}

function configurationEvidence(task) {
  const evidence = [...(task?.executionEvidence || [])].reverse()
  const qualified = evidence.find(item => item?.qualificationContext?.configurationId)
  return {
    configurationId: String(qualified?.qualificationContext?.configurationId || ''),
    qualificationContext: qualified?.qualificationContext || null,
    executionEvidenceCount: evidence.length,
    toolCallCount: evidence.reduce((sum, item) => sum + (Array.isArray(item?.toolCalls) ? item.toolCalls.length : 0), 0),
    violations: evidence.flatMap(item => Array.isArray(item?.violations) ? item.violations : []),
  }
}

function taskSnapshot(task) {
  if (!task) return null
  return {
    id: task.id,
    expertId: task.expertId,
    status: task.status,
    assignmentSnapshot: task.assignmentSnapshot || null,
    execRef: task.execRef || null,
    progress: task.progress || null,
    attention: task.attention || null,
    resultSummary: task.resultSummary || '',
    events: task.events || [],
    deliverables: task.deliverables || [],
    executionEvidence: task.executionEvidence || [],
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  }
}

function bindConfiguration(task, observed, modelProfile = {}) {
  if (observed?.configurationId) return observed
  const qualificationContext = buildQualificationContext(task, null, {
    provider: modelProfile.provider,
    model: modelProfile.model,
    requestedModel: modelProfile.model,
    label: modelProfile.label,
    autoRouted: false,
  })
  return {
    ...(observed || {}),
    configurationId: qualificationContext.configurationId,
    qualificationContext,
    identitySource: 'persisted_assignment_snapshot+active_model_profile',
  }
}

function transcriptFromSession(session) {
  if (!session) return { sessionId: '', messages: [], text: '' }
  const messages = (session.messages || []).map(message => ({
    role: String(message.role || ''),
    text: String(message.text || ''),
    runId: String(message.runId || ''),
    createdAt: message.createdAt || null,
  }))
  return {
    sessionId: String(session.id || ''),
    messages,
    text: messages.map(message => `${message.role}: ${message.text}`).join('\n\n'),
  }
}

const MAX_REVIEW_ARTIFACT_BODY_CHARS = 120000
const TEXT_REVIEW_ARTIFACT_TYPES = new Set(['answer', 'document', 'markdown', 'text'])

// Independent qualification review needs the candidate itself, not only the
// task summary. The runtime keeps the canonical candidate in the session
// artifact; export a bounded text copy for the isolated QA report while
// keeping binary/image payloads out of JSON evidence.
function reviewEvidenceFromSession(session, task) {
  if (!session || !task) return { artifacts: [] }
  const refs = new Set(
    (Array.isArray(task.deliverables) ? task.deliverables : [])
      .flatMap(item => [item?.artifactRef, ...(Array.isArray(item?.artifactRefs) ? item.artifactRefs : [])])
      .map(value => String(value || '').split('#').at(-1))
      .filter(Boolean),
  )
  const artifacts = Array.isArray(session.run?.artifacts) ? session.run.artifacts : []
  const candidates = artifacts.filter((artifact) => {
    if (!artifact?.id) return false
    if (refs.has(String(artifact.id))) return true
    return String(artifact.meta?.taskId || '') === String(task.id || '')
  })
  return {
    artifacts: candidates.map((artifact) => {
      const body = String(artifact.body || '')
      const type = String(artifact.type || artifact.kind || '').trim()
      const row = {
        id: String(artifact.id),
        title: String(artifact.title || ''),
        type,
        status: String(artifact.status || ''),
        bodyChars: body.length,
        truncated: body.length > MAX_REVIEW_ARTIFACT_BODY_CHARS,
      }
      if (TEXT_REVIEW_ARTIFACT_TYPES.has(type.toLowerCase())) {
        row.body = body.slice(0, MAX_REVIEW_ARTIFACT_BODY_CHARS)
      } else if (artifact.targetPath || artifact.meta?.path) {
        row.targetPath = String(artifact.targetPath || artifact.meta.path)
      }
      return row
    }),
  }
}

function loadSessionTranscripts(userData, rows) {
  const file = path.join(userData, 'agent-sessions.json')
  if (!fs.existsSync(file)) return
  const stored = JSON.parse(fs.readFileSync(file, 'utf8'))
  const sessions = Array.isArray(stored?.sessions) ? stored.sessions : []
  const byId = new Map(sessions.map(session => [String(session.id || ''), session]))
  for (const row of rows) {
    const sessionId = String(row.task?.execRef?.id || '')
    const session = byId.get(sessionId)
    row.transcript = transcriptFromSession(session)
    row.reviewEvidence = reviewEvidenceFromSession(session, row.task)
  }
}

function reportPath(root, suite, requested) {
  if (requested) return resolveWorkspaceFile(root, requested, '--out')
  const slug = String(suite.suite || 'qualification').toLowerCase().replace(/[^a-z0-9-]+/g, '-')
  return path.join(root, 'openspec', 'changes', 'production-qualify-all-experts', 'evidence', `${slug}-live-results.json`)
}

function writeReport(file, report) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
}

function toAgentEvalResults(report) {
  const grouped = new Map()
  for (const row of report.tasks || []) {
    const tasks = grouped.get(row.expertId) || []
    const expectedOutcome = Boolean(row.expectedStatus && row.status === row.expectedStatus && row.lifecycleEvidence?.passed === true)
    const environmentBlocked = Boolean(row.environmentBlock)
    const hardFailure = !environmentBlocked && !expectedOutcome && (row.status === 'failed' || row.lifecycleEvidence?.passed === false)
    tasks.push({
      taskId: row.taskId,
      evalId: row.evalId,
      scenario: row.scenario,
      status: environmentBlocked ? 'blocked' : hardFailure ? 'failed' : row.status,
      configurationId: row.configuration?.configurationId || '',
      hardFailure,
      blockedReason: environmentBlocked ? row.environmentBlock : null,
      hardAssertionsPassed: row.hardAssertionsPassed === true
        ? true
        : row.hardAssertionsPassed === false
          ? false
          : null,
      assertionsPassed: row.hardAssertionsPassed === true ? row.assertions.length : 0,
      assertionsTotal: row.assertions.length,
      failureSummary: hardFailure ? (row.error || 'Lifecycle contract failed') : '',
      summary: environmentBlocked
        ? 'Environment configuration blocked execution; no professional output was produced.'
        : hardFailure ? '' : 'Lifecycle evidence captured; independent semantic review remains pending.',
    })
    grouped.set(row.expertId, tasks)
  }
  return {
    suite: report.suite,
    evaluatedAt: report.generatedAt,
    agents: [...grouped.entries()].map(([agentId, tasks]) => ({
      agentId,
      currentConfigurationId: tasks.find(item => item.configurationId)?.configurationId || '',
      tasks,
    })),
  }
}

function statusAfterRunError(task) {
  const status = String(task?.status || '').trim()
  return ['needs_input', 'failed', 'cancelled'].includes(status) ? status : 'failed'
}

function environmentBlock(task) {
  if (String(task?.status || '').trim() !== 'needs_input') return null
  const attention = task?.attention
  const kind = String(attention?.kind || '').trim()
  if (!['configuration_required', 'capability_unavailable'].includes(kind)) return null
  return {
    kind,
    action: String(attention.action || ''),
    item: String(attention.item || ''),
    detail: String(attention.detail || attention.question || ''),
  }
}

function qualificationEnvironmentBlock(message, context = {}) {
  const detail = String(message || '').trim() || '资格环境未完成配置'
  const secureStorageUnavailable = /安全存储|明文密钥|secure storage|secret storage/i.test(detail)
  return {
    kind: 'configuration_required',
    code: secureStorageUnavailable ? 'secure_storage_unavailable' : 'qualification_setup_incomplete',
    action: secureStorageUnavailable ? 'enable_secure_storage' : 'fix_qualification_setup',
    item: String(context.item || (secureStorageUnavailable ? 'connector secrets' : 'qualification setup')),
    detail: secureStorageUnavailable
      ? `${detail} 未绕过安全存储，也未保存明文密钥；请在支持系统安全存储的环境中重试。`
      : detail,
  }
}

function blockedQualificationRow(item, block, error = '') {
  return {
    evalId: item.id,
    expertId: item.expertId,
    title: item.title || item.id,
    scenario: item.scenario || 'normal',
    lifecycle: item.lifecycle || 'create',
    expectedStatus: item.expectedStatus || '',
    assertions: item.assertions || [],
    status: 'needs_input',
    taskId: '',
    checkpoints: {},
    lifecycleEvidence: {
      passed: false,
      blocked: true,
      blockedReason: block,
      checks: {},
      events: [],
    },
    configuration: null,
    environmentBlock: block,
    semanticReview: 'pending_independent_review',
    hardAssertionsPassed: null,
    certificationEligible: false,
    task: null,
    transcript: null,
    error: String(error || ''),
    elapsedMs: 0,
  }
}

async function runCase(page, item, suite, timeoutMs, modelProfile) {
  const startedAt = Date.now()
  const row = {
    evalId: item.id,
    expertId: item.expertId,
    title: item.title || item.id,
    scenario: item.scenario || 'normal',
    lifecycle: item.lifecycle || 'create',
    expectedStatus: item.expectedStatus || '',
    assertions: item.assertions || [],
    status: 'running',
    taskId: '',
    checkpoints: {},
    lifecycleEvidence: null,
    configuration: null,
    environmentBlock: null,
    semanticReview: 'pending_independent_review',
    hardAssertionsPassed: null,
    certificationEligible: false,
    task: null,
    transcript: null,
    error: '',
    elapsedMs: 0,
  }
  try {
    const installed = await page.evaluate(id => window.knowme.capability.install({
      id,
      enabled: true,
      riskConfirmed: true,
    }), item.expertId)
    if (!installed?.ok) throw new Error(`expert install/update failed: ${installed?.error || 'unknown error'}`)
    row.install = {
      ok: true,
      id: installed.item?.id || item.expertId,
      version: installed.item?.version || installed.record?.version || '',
    }

    const created = await page.evaluate(input => window.api.expertTaskCreateStart(input), {
      expertId: item.expertId,
      expertName: item.expertId,
      title: `[${suite.suite || 'qualification'}] ${item.id} ${item.title || ''}`.trim(),
      brief: {
        goal: item.prompt,
        materials: [{ title: '冻结认证题', content: item.prompt }],
        constraints: item.constraints || [
          '严格依据已知事实，不得编造',
          '直接在对话中交付完整结果',
          '除非题目明确要求，否则不得执行外部动作或调用工具',
        ],
        deliverables: item.deliverables || [{ id: 'primary', title: item.title || '认证交付', type: 'answer', required: true }],
      },
    })
    if (!created?.ok || !created.task?.id) throw new Error(created?.error || 'task creation failed')
    row.taskId = created.task.id

    let finalTask
    if (row.lifecycle === 'cancel_then_retry') {
      const cancelled = await page.evaluate(id => window.api.expertTaskCancel(id), row.taskId)
      if (!cancelled?.ok) throw new Error(cancelled?.error || 'cancel failed')
      row.checkpoints.cancelledStatus = cancelled.task?.status || ''
      await retryWhenIdle(page, row.taskId)
      finalTask = await waitForReview(page, row.taskId, timeoutMs)
    } else {
      const initial = item.expectedStatus && item.expectedStatus !== 'review'
        ? await waitForExpectedOutcome(page, row.taskId, item.expectedStatus, timeoutMs)
        : await waitForReview(page, row.taskId, timeoutMs)
      if (item.expectedStatus && item.expectedStatus !== 'review') {
        finalTask = initial
      } else {
        row.checkpoints.initialVersion = deliverableVersion(initial)
        row.checkpoints.initialStatus = initial.status
        const deliverableId = primaryDeliverable(initial)?.deliverableId
        if (!deliverableId) throw new Error('initial review has no deliverable')

        if (row.lifecycle === 'request_changes') {
        const reviewed = await page.evaluate(input => window.api.expertTaskReviewDeliverable(input), {
          taskId: row.taskId,
          deliverableId,
          action: 'changes_requested',
          decision: 'changes_requested',
          comment: item.reviewComment,
        })
        if (!reviewed?.ok || !reviewed.started) throw new Error(reviewed?.error || 'revision did not start')
        finalTask = await waitForReview(page, row.taskId, timeoutMs, row.checkpoints.initialVersion + 1)
        } else if (row.lifecycle === 'accept_then_reopen') {
        const accepted = await page.evaluate(input => window.api.expertTaskReviewDeliverable(input), {
          taskId: row.taskId,
          deliverableId,
          action: 'accept',
          decision: 'accept',
          comment: 'Lifecycle qualification checkpoint; this is not professional certification.',
        })
        if (!accepted?.ok || accepted.task?.status !== 'completed') throw new Error(accepted?.error || 'accept checkpoint did not complete')
        row.checkpoints.acceptedStatus = accepted.task.status
        const reopened = await page.evaluate(input => window.api.expertTaskReviewDeliverable(input), {
          taskId: row.taskId,
          deliverableId,
          action: 'changes_requested',
          decision: 'changes_requested',
          comment: item.reviewComment,
        })
        if (!reopened?.ok || !reopened.started) throw new Error(reopened?.error || 'reopen did not start')
        finalTask = await waitForReview(page, row.taskId, timeoutMs, row.checkpoints.initialVersion + 1)
        } else {
          finalTask = initial
        }
      }
    }

    row.status = finalTask.status
    row.environmentBlock = environmentBlock(finalTask)
    row.lifecycleEvidence = lifecycleCheck(item, finalTask, row.checkpoints)
    row.configuration = bindConfiguration(finalTask, configurationEvidence(finalTask), modelProfile)
    row.task = taskSnapshot(finalTask)
  } catch (error) {
    row.error = String(error?.stack || error)
    if (row.taskId) {
      const latest = await taskGet(page, row.taskId).catch(() => null)
      if (latest?.task) {
        row.status = statusAfterRunError(latest.task)
        row.environmentBlock = environmentBlock(latest.task)
        row.task = taskSnapshot(latest.task)
        row.configuration = bindConfiguration(latest.task, configurationEvidence(latest.task), modelProfile)
        row.lifecycleEvidence = lifecycleCheck(item, latest.task, row.checkpoints)
        if (['starting', 'running', 'revising'].includes(latest.task.status)) {
          const cleanup = await page.evaluate(id => window.api.expertTaskCancel(id), row.taskId).catch(() => null)
          row.cleanup = {
            attempted: true,
            ok: cleanup?.ok === true,
            status: cleanup?.task?.status || '',
            reason: 'qualification_harness_timeout_or_failure',
          }
        }
      }
    }
    if (!row.status) row.status = 'failed'
  } finally {
    row.elapsedMs = Date.now() - startedAt
  }
  return row
}

async function main(argv = process.argv) {
  const root = path.resolve(__dirname, '..')
  const options = parseArgs(argv)
  const suiteFile = resolveWorkspaceFile(root, options.suite, '--suite')
  const suite = loadSuite(suiteFile, options.cases)
  const cases = selectCases(suite, options.cases)
  const connectorConfigurationIssues = suiteConnectorConfigurationIssues(suite)
  if (connectorConfigurationIssues.length) {
    throw new Error([
      'Qualification suite configuration is incomplete; no Electron task was created.',
      ...connectorConfigurationIssues.map(issue => `- ${issue.message}`),
      'Configure the declared connector endpoint/command and rerun the same suite.',
    ].join('\n'))
  }
  const userData = assertSafeUserData(options.userData)
  const output = reportPath(root, suite, options.output)
  const timeoutMs = Math.max(10000, Number(suite.executionPolicy?.maxWaitSeconds || 180) * 1000)
  const report = {
    schemaVersion: 1,
    suite: suite.suite || path.basename(path.dirname(suiteFile)),
    purpose: suite.purpose || '',
    generatedAt: new Date().toISOString(),
    environment: {
      isolatedUserData: userData,
      testSeam: true,
      productionDataProtected: true,
      automaticProfessionalAcceptance: false,
      providerSeed: { requested: false, copied: false, reason: 'not_requested' },
    },
    policy: suite.executionPolicy || {},
    setup: {
      installCapabilities: suiteInstallCapabilities(suite),
      configuredConnectors: suiteConnectorConfigurations(suite).map(item => item.id),
      installed: [],
      configured: [],
    },
    selectedCases: cases.map(item => item.id),
    tasks: [],
    summary: null,
  }

  let app
  let setupEnvironmentBlock = null
  try {
    report.environment.providerSeed = seedEncryptedProviderSettings(options.sourceUserData, userData)
    if (report.environment.providerSeed.requested && !report.environment.providerSeed.copied) {
      const error = new Error('source userData 中没有 settings.json，无法为隔离资格任务提供加密 Provider 配置')
      error.qualificationEnvironmentBlock = qualificationEnvironmentBlock(error.message, {
        item: 'source-user-data/settings.json',
      })
      throw error
    }
    app = await electron.launch({
      timeout: 30000,
      // Qualification evidence must not be invalidated by the Windows GPU
      // crash/relaunch path. This only affects the isolated Electron process;
      // it does not change the production application's GPU policy.
      args: ['--disable-gpu', '--disable-gpu-compositing', '.'],
      cwd: root,
      env: {
        ...process.env,
        KNOWME_TEST_SEAM: '1',
        KNOWME_TEST_USER_DATA_DIR: userData,
      },
    })
    const page = await app.firstWindow({ timeout: 30000 })
    await page.waitForLoadState('domcontentloaded', { timeout: 30000 })
    await page.waitForFunction(() => Boolean(
      window.api?.expertTaskCreateStart
      && window.api?.expertTaskGet
      && window.api?.expertTaskReviewDeliverable
      && window.knowme?.capability?.install
    ), null, { timeout: 30000 })
    for (const id of suiteInstallCapabilities(suite)) {
      const installed = await page.evaluate(capabilityId => window.knowme.capability.install({
        id: capabilityId,
        enabled: true,
        riskConfirmed: true,
      }), id)
      if (!installed?.ok) throw new Error(`suite capability install failed for ${id}: ${installed?.error || 'unknown error'}`)
      report.setup.installed.push({ id, version: installed.item?.version || installed.record?.version || '' })
    }
    for (const connector of suiteConnectorConfigurations(suite)) {
      const { qualificationSecrets, ...connectorPatch } = connector
      const configured = await page.evaluate(patch => window.api.connectorsUpsert(patch), connectorPatch)
      if (configured?.ok === false) throw new Error(`suite connector configuration failed for ${connector.id}: ${configured.error || 'unknown error'}`)
      if (qualificationSecrets && Object.keys(qualificationSecrets).length) {
        const secrets = await page.evaluate(({ id, values }) => window.api.connectorsSetSecrets(id, values), {
          id: connector.id,
          values: qualificationSecrets,
        })
        if (secrets?.ok === false) {
          const error = new Error(`suite connector secrets failed for ${connector.id}: ${secrets.error || secrets.message || 'unknown error'}`)
          error.qualificationEnvironmentBlock = qualificationEnvironmentBlock(error.message, {
            item: `connector:${connector.id} secrets`,
          })
          throw error
        }
      }
      report.setup.configured.push({ id: connector.id, ok: true })
    }
    const modelProfile = await page.evaluate(() => window.api.llmProfile())
    report.environment.modelProfile = {
      provider: modelProfile?.provider || '',
      model: modelProfile?.model || '',
      label: modelProfile?.label || '',
      maxOutput: modelProfile?.maxOutput || null,
    }

    for (let index = 0; index < cases.length; index += 1) {
      const item = cases[index]
      process.stdout.write(`[qualification] ${index + 1}/${cases.length} ${item.id} ${item.expertId}\n`)
      const row = await runCase(page, item, suite, timeoutMs, report.environment.modelProfile)
      report.tasks.push(row)
      writeReport(output, report)
      const lifecycleState = row.lifecycleEvidence?.blocked
        ? 'blocked'
        : row.lifecycleEvidence?.passed === true ? 'pass' : 'fail'
      process.stdout.write(`[qualification] ${item.id} ${row.status} lifecycle=${lifecycleState} ${row.elapsedMs}ms${row.error ? ' ERROR' : ''}\n`)
    }
  } catch (error) {
    if (!error?.qualificationEnvironmentBlock) throw error
    setupEnvironmentBlock = error.qualificationEnvironmentBlock
    report.environment.block = setupEnvironmentBlock
    report.setup.status = 'blocked'
    report.setup.error = setupEnvironmentBlock.detail
  } finally {
    if (app) await app.close().catch(() => {})
  }

  if (setupEnvironmentBlock) {
    report.tasks = cases.map(item => blockedQualificationRow(item, setupEnvironmentBlock, setupEnvironmentBlock.detail))
  }

  loadSessionTranscripts(userData, report.tasks)
  report.summary = {
    total: report.tasks.length,
    lifecyclePassed: report.tasks.filter(item => item.lifecycleEvidence?.passed === true).length,
    lifecycleBlocked: report.tasks.filter(item => item.lifecycleEvidence?.blocked === true).length,
    lifecycleFailed: report.tasks.filter(item => item.lifecycleEvidence?.passed === false && item.lifecycleEvidence?.blocked !== true).length,
    runtimeFailed: report.tasks.filter(item => item.status === 'failed').length,
    runtimeNeedsInput: report.tasks.filter(item => item.status === 'needs_input').length,
    environmentBlocked: report.tasks.filter(item => item.environmentBlock).length,
    runtimeCancelled: report.tasks.filter(item => item.status === 'cancelled').length,
    semanticReviewPending: report.tasks.filter(item => item.semanticReview === 'pending_independent_review').length,
    professionallyQualified: 0,
  }
  writeReport(output, report)
  const agentEvalOutput = output.replace(/\.json$/i, '-agent-evals.json')
  writeReport(agentEvalOutput, toAgentEvalResults(report))
  process.stdout.write(`[qualification] report ${output}\n`)
  process.stdout.write(`[qualification] AgentEvals input ${agentEvalOutput}\n`)
  process.stdout.write(`[qualification] lifecycle ${report.summary.lifecyclePassed}/${report.summary.total}; environmentBlocked=${report.summary.environmentBlocked}; professional certification remains pending independent assertion review\n`)
  if (report.summary.runtimeFailed || report.summary.lifecyclePassed !== report.summary.total || report.summary.environmentBlocked) process.exitCode = 2
  return report
}

if (require.main === module) {
  main().catch(error => {
    process.stderr.write(`${error?.stack || error}\n`)
    process.exitCode = 1
  })
}

module.exports = {
  assertSafeUserData,
  configurationEvidence,
  environmentBlock,
  qualificationEnvironmentBlock,
  seedEncryptedProviderSettings,
  blockedQualificationRow,
  lifecycleCheck,
  loadSuite,
  readCursorMcpServer,
  suiteConnectorConfigurations,
  cursorHeaderSecrets,
  suiteConnectorConfigurationIssues,
  parseArgs,
  selectCases,
  statusAfterRunError,
  reviewEvidenceFromSession,
  toAgentEvalResults,
}
