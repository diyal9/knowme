/**
 * Runtime Agent evaluation — DeepEval-compatible suites and local evidence.
 *
 * Suites and reports live beside the runtime Agent Registry under userData.
 * The fixed Python bridge is optional: deterministic metrics continue to work
 * when Python or DeepEval is unavailable, while semantic metrics fail closed.
 */
'use strict'

const crypto = require('crypto')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawn } = require('child_process')

const EVALUATION_SCHEMA_VERSION = 1
const DEFAULT_TIMEOUT_MS = 180000
const MAX_BRIDGE_OUTPUT = 1024 * 1024
const RESULT_MARKER = '__KNOWME_DEEPEVAL_RESULT__='
const SAFE_ID_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/i
const REQUIRED_SCENARIOS = Object.freeze({ normal: 2, edge: 1, retry: 1, revision: 1, reopen: 1 })
const NATIVE_METRICS = new Set(['text_assertions', 'tool_correctness', 'tool_permission'])
const DEEPEVAL_METRICS = new Set([
  'g_eval', 'answer_relevancy', 'faithfulness', 'hallucination', 'argument_correctness',
])
const METRIC_SCOPES = Object.freeze({
  text_assertions: 'end_to_end',
  g_eval: 'end_to_end',
  answer_relevancy: 'end_to_end',
  faithfulness: 'end_to_end',
  hallucination: 'end_to_end',
  tool_correctness: 'component',
  argument_correctness: 'component',
  tool_permission: 'component',
})

function ok(payload = {}) {
  return { ok: true, ...payload }
}

function fail(code, error, details = {}) {
  return { ok: false, code, error, ...details }
}

function nowIso() {
  return new Date().toISOString()
}

function clonePlain(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function uniqueStrings(value) {
  return [...new Set((Array.isArray(value) ? value : [])
    .map(item => String(item || '').trim())
    .filter(Boolean))]
}

function writeJsonAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const temp = `${file}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  fs.renameSync(temp, file)
}

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

function contentHash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function normalizeThreshold(value, fallback = 0.7) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : fallback
}

function normalizeToolCall(raw = {}) {
  return {
    name: String(raw.name || raw.tool || '').trim().slice(0, 160),
    ...(raw.description ? { description: String(raw.description).slice(0, 1000) } : {}),
    ...(raw.inputParameters || raw.input || raw.arguments
      ? { inputParameters: clonePlain(raw.inputParameters || raw.input || raw.arguments) }
      : {}),
    ...(raw.output !== undefined ? { output: clonePlain(raw.output) } : {}),
    ...(raw.type ? { type: String(raw.type).toUpperCase() === 'MCP' ? 'MCP' : 'FUNCTION' } : {}),
  }
}

function normalizeMetric(raw = {}, index = 0) {
  const type = String(raw.type || '').trim().toLowerCase()
  if (!NATIVE_METRICS.has(type) && !DEEPEVAL_METRICS.has(type)) {
    return fail('unsupported_eval_metric', `不支持的评估指标: ${type || '<empty>'}`, { index })
  }
  const id = String(raw.id || `${type}-${index + 1}`).trim()
  if (!SAFE_ID_RE.test(id)) return fail('invalid_metric_id', `指标 id 无效: ${id}`, { index })
  if (type === 'g_eval' && !String(raw.criteria || '').trim()) {
    return fail('missing_eval_criteria', `G-Eval 指标 ${id} 缺少 criteria`, { index })
  }
  return ok({
    metric: {
      id,
      type,
      scope: METRIC_SCOPES[type],
      name: String(raw.name || id).trim().slice(0, 120),
      threshold: normalizeThreshold(raw.threshold, type === 'tool_permission' ? 1 : 0.7),
      required: raw.required !== false,
      ...(raw.criteria ? { criteria: String(raw.criteria).trim().slice(0, 4000) } : {}),
      evaluationParams: uniqueStrings(raw.evaluationParams || raw.evaluation_params),
      strict: raw.strict === true,
      compareArguments: raw.compareArguments === true,
      compareOutput: raw.compareOutput === true,
      exactTools: raw.exactTools === true,
      orderedTools: raw.orderedTools === true,
    },
  })
}

function normalizeCase(raw = {}, index = 0) {
  const id = String(raw.id || `case-${index + 1}`).trim()
  if (!SAFE_ID_RE.test(id)) return fail('invalid_eval_case_id', `用例 id 无效: ${id}`, { index })
  const input = String(raw.input || raw.prompt || '').trim()
  if (!input) return fail('missing_eval_input', `用例 ${id} 缺少 input`, { index })
  const scenario = String(raw.scenario || 'normal').trim().toLowerCase()
  return ok({
    testCase: {
      id,
      scenario,
      input: input.slice(0, 32000),
      ...(raw.expectedOutput || raw.expected_output
        ? { expectedOutput: String(raw.expectedOutput || raw.expected_output).slice(0, 32000) }
        : {}),
      context: uniqueStrings(raw.context).slice(0, 50),
      retrievalContext: uniqueStrings(raw.retrievalContext || raw.retrieval_context).slice(0, 50),
      expectedTools: (Array.isArray(raw.expectedTools || raw.expected_tools)
        ? (raw.expectedTools || raw.expected_tools) : []).map(normalizeToolCall).filter(item => item.name),
      allowedTools: uniqueStrings(raw.allowedTools || raw.allowed_tools),
      deniedTools: uniqueStrings(raw.deniedTools || raw.denied_tools),
      assertions: {
        mustContain: uniqueStrings(raw.assertions?.mustContain || raw.mustContain),
        mustNotContain: uniqueStrings(raw.assertions?.mustNotContain || raw.mustNotContain),
      },
    },
  })
}

function normalizeSuite(raw = {}, agentId) {
  const id = String(raw.id || raw.suiteId || 'regression').trim()
  if (!SAFE_ID_RE.test(id)) return fail('invalid_eval_suite_id', `评估集 id 无效: ${id}`)
  const rawMetrics = Array.isArray(raw.metrics) ? raw.metrics : []
  const rawCases = Array.isArray(raw.cases || raw.testCases) ? (raw.cases || raw.testCases) : []
  if (!rawMetrics.length) return fail('missing_eval_metrics', '评估集至少需要一个指标')
  if (!rawCases.length) return fail('missing_eval_cases', '评估集至少需要一个测试用例')
  if (rawMetrics.length > 12) return fail('too_many_eval_metrics', '单个评估集最多 12 个指标')
  if (rawCases.length > 100) return fail('too_many_eval_cases', '单个评估集最多 100 个用例')
  const metrics = []
  const cases = []
  for (let index = 0; index < rawMetrics.length; index += 1) {
    const result = normalizeMetric(rawMetrics[index], index)
    if (!result.ok) return result
    metrics.push(result.metric)
  }
  for (let index = 0; index < rawCases.length; index += 1) {
    const result = normalizeCase(rawCases[index], index)
    if (!result.ok) return result
    cases.push(result.testCase)
  }
  if (new Set(metrics.map(item => item.id)).size !== metrics.length) return fail('duplicate_eval_metric', '评估指标 id 不能重复')
  if (new Set(cases.map(item => item.id)).size !== cases.length) return fail('duplicate_eval_case', '评估用例 id 不能重复')
  return ok({ suite: {
    schemaVersion: EVALUATION_SCHEMA_VERSION,
    id,
    agentId,
    title: String(raw.title || `${agentId} regression`).trim().slice(0, 160),
    description: String(raw.description || '').trim().slice(0, 1600),
    judgeModel: String(raw.judgeModel || raw.judge_model || '').trim().slice(0, 160),
    metrics,
    cases,
  } })
}

function scenarioCoverage(cases = []) {
  const observed = {}
  for (const item of cases) {
    const scenario = String(item.scenario || 'normal')
    observed[scenario] = (observed[scenario] || 0) + 1
  }
  const missing = []
  for (const [scenario, minimum] of Object.entries(REQUIRED_SCENARIOS)) {
    const count = observed[scenario] || 0
    if (count < minimum) missing.push(`${scenario}:${minimum - count}`)
  }
  return { observed, required: { ...REQUIRED_SCENARIOS }, missing, passed: missing.length === 0 }
}

function metricResult(metric, score, reason, engine = 'knowme-native') {
  const normalizedScore = Number.isFinite(Number(score)) ? Math.max(0, Math.min(1, Number(score))) : null
  const passed = normalizedScore !== null && normalizedScore >= metric.threshold
  return {
    metricId: metric.id,
    type: metric.type,
    scope: metric.scope,
    engine,
    threshold: metric.threshold,
    score: normalizedScore,
    passed,
    status: passed ? 'passed' : 'failed',
    reason: String(reason || '').slice(0, 4000),
  }
}

function blockedMetric(metric, code, reason) {
  return {
    metricId: metric.id,
    type: metric.type,
    scope: metric.scope,
    engine: 'deepeval',
    threshold: metric.threshold,
    score: null,
    passed: false,
    status: 'blocked',
    code,
    reason: String(reason || '').slice(0, 4000),
  }
}

function evaluateTextAssertions(metric, testCase, observation) {
  const output = String(observation.actualOutput || '')
  const required = testCase.assertions?.mustContain || []
  const forbidden = testCase.assertions?.mustNotContain || []
  const checks = [
    ...required.map(value => ({ label: `包含 ${value}`, passed: output.includes(value) })),
    ...forbidden.map(value => ({ label: `不包含 ${value}`, passed: !output.includes(value) })),
  ]
  if (!checks.length) return metricResult(metric, output.trim() ? 1 : 0, output.trim() ? '输出非空。' : '输出为空。')
  const passed = checks.filter(item => item.passed).length
  const failed = checks.filter(item => !item.passed).map(item => item.label)
  return metricResult(metric, passed / checks.length, failed.length ? `未通过：${failed.join('；')}` : '所有文本断言通过。')
}

function toolSignature(call, metric) {
  const signature = { name: call.name, type: call.type || 'FUNCTION' }
  if (metric.compareArguments) signature.inputParameters = call.inputParameters || null
  if (metric.compareOutput) signature.output = call.output ?? null
  return JSON.stringify(signature)
}

function evaluateToolCorrectness(metric, testCase, observation) {
  const expected = testCase.expectedTools || []
  const actual = observation.toolsCalled || []
  const expectedSignatures = expected.map(item => toolSignature(item, metric))
  const actualSignatures = actual.map(item => toolSignature(item, metric))
  let matches = 0
  const remaining = [...expectedSignatures]
  for (const signature of actualSignatures) {
    const index = remaining.indexOf(signature)
    if (index >= 0) {
      matches += 1
      remaining.splice(index, 1)
    }
  }
  const ordered = !metric.orderedTools || actualSignatures.every((value, index) => value === expectedSignatures[index])
  const exact = !metric.exactTools || (actualSignatures.length === expectedSignatures.length && matches === expectedSignatures.length)
  const denominator = Math.max(1, actual.length, expected.length)
  const score = ordered && exact ? matches / denominator : 0
  return metricResult(metric, score,
    `命中 ${matches}/${denominator}；实际工具 ${actual.length}，期望工具 ${expected.length}${ordered ? '' : '；顺序不符'}${exact ? '' : '；未精确匹配'}。`)
}

function evaluateToolPermission(metric, testCase, observation) {
  const allowed = new Set(testCase.allowedTools || [])
  const denied = new Set(testCase.deniedTools || [])
  const calls = observation.toolsCalled || []
  const unauthorized = calls.filter(call => denied.has(call.name) || (allowed.size > 0 && !allowed.has(call.name)))
  const score = calls.length ? (calls.length - unauthorized.length) / calls.length : 1
  return metricResult(metric, score, unauthorized.length
    ? `越权工具：${unauthorized.map(item => item.name).join('、')}`
    : '所有工具调用均在权限范围内。')
}

function normalizeObservations(raw = []) {
  const list = Array.isArray(raw) ? raw : []
  const result = new Map()
  for (const item of list) {
    const caseId = String(item.caseId || item.case_id || item.id || '').trim()
    if (!caseId || result.has(caseId)) continue
    result.set(caseId, {
      caseId,
      actualOutput: String(item.actualOutput || item.actual_output || '').slice(0, 64000),
      toolsCalled: (Array.isArray(item.toolsCalled || item.tools_called)
        ? (item.toolsCalled || item.tools_called) : []).map(normalizeToolCall).filter(call => call.name),
      trace: item.trace && typeof item.trace === 'object' ? clonePlain(item.trace) : null,
      evidenceRefs: uniqueStrings(item.evidenceRefs || item.evidence_refs),
    })
  }
  return result
}

function defaultRunProcess({ cmd, args = [], cwd, input = '', timeoutMs = DEFAULT_TIMEOUT_MS, env = process.env } = {}) {
  return new Promise(resolve => {
    let child
    try {
      child = spawn(cmd, args, { cwd, env, windowsHide: true, shell: false })
    } catch (error) {
      resolve({ ok: false, code: -1, stdout: '', stderr: String(error?.message || error), timedOut: false })
      return
    }
    let stdout = ''
    let stderr = ''
    let settled = false
    const finish = result => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(result)
    }
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL') } catch { /* ignore */ }
      finish({ ok: false, code: null, stdout, stderr, timedOut: true })
    }, timeoutMs)
    child.stdout?.on('data', chunk => { if (stdout.length < MAX_BRIDGE_OUTPUT) stdout += String(chunk) })
    child.stderr?.on('data', chunk => { if (stderr.length < MAX_BRIDGE_OUTPUT) stderr += String(chunk) })
    child.on('error', error => finish({ ok: false, code: -1, stdout, stderr: stderr || String(error?.message || error), timedOut: false }))
    child.on('close', code => finish({ ok: code === 0, code, stdout, stderr, timedOut: false }))
    try { child.stdin?.end(input) } catch { /* ignore */ }
  })
}

function createDeepEvalBridge(options = {}) {
  const fallbackPython = options.pythonCmd || process.env.KNOWME_PYTHON || (process.platform === 'win32' ? 'python' : 'python3')
  const resolvePythonCmd = typeof options.resolvePythonCmd === 'function'
    ? options.resolvePythonCmd
    : () => fallbackPython
  const scriptPath = options.scriptPath || path.join(__dirname, '..', 'catalog', 'skills', 'agent-registry-operations', 'scripts', 'deepeval_runner.py')
  const runProcess = options.runProcess || defaultRunProcess

  async function invoke(action, payload = {}) {
    if (!fs.existsSync(scriptPath)) return fail('deepeval_bridge_missing', 'DeepEval 适配器文件缺失')
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-deepeval-'))
    try {
      const run = await runProcess({
        cmd: resolvePythonCmd(),
        args: ['-I', scriptPath],
        cwd,
        input: JSON.stringify({ action, payload }),
        timeoutMs: options.timeoutMs || DEFAULT_TIMEOUT_MS,
        env: { ...process.env, DEEPEVAL_DISABLE_DOTENV: '1', PYTHONUTF8: '1' },
      })
      if (run.timedOut) return fail('deepeval_timeout', 'DeepEval 执行超时')
      const marker = String(run.stdout || '').lastIndexOf(RESULT_MARKER)
      if (marker < 0) {
        const detail = String(run.stderr || run.stdout || '').trim().slice(0, 2000)
        return fail(run.code === -1 ? 'python_unavailable' : 'deepeval_bridge_failed', detail || 'DeepEval 未返回结构化结果')
      }
      try {
        return JSON.parse(String(run.stdout).slice(marker + RESULT_MARKER.length).trim())
      } catch {
        return fail('deepeval_invalid_result', 'DeepEval 返回了无法解析的结果')
      }
    } finally {
      try { fs.rmSync(cwd, { recursive: true, force: true }) } catch { /* ignore */ }
    }
  }

  return {
    status: () => invoke('status'),
    evaluate: payload => invoke('evaluate', payload),
  }
}

function createAgentEvaluationService(deps = {}) {
  const store = deps.store
  const registry = deps.registry || null
  if (!store?.resolvePaths) throw new Error('Agent evaluation requires capability store')
  const runtimeRoot = path.join(store.resolvePaths().root, 'runtimes', 'deepeval')
  const runtimePython = process.platform === 'win32'
    ? path.join(runtimeRoot, 'Scripts', 'python.exe')
    : path.join(runtimeRoot, 'bin', 'python')
  const systemPython = deps.pythonCmd || process.env.KNOWME_PYTHON || (process.platform === 'win32' ? 'python' : 'python3')
  const bridge = deps.deepEvalBridge || createDeepEvalBridge({
    ...deps,
    resolvePythonCmd: () => fs.existsSync(runtimePython) ? runtimePython : systemPython,
  })
  const runProcess = deps.runProcess || defaultRunProcess

  function evaluationRoot(agentId) {
    const id = String(agentId || '').trim()
    if (!SAFE_ID_RE.test(id)) return fail('invalid_agent_id', 'Agent id 无效')
    const root = path.join(store.resolvePaths().root, 'agent-registry', id, 'evaluations')
    return ok({ id, root, suites: path.join(root, 'suites'), runs: path.join(root, 'runs') })
  }

  function suitePath(agentId, suiteId) {
    const paths = evaluationRoot(agentId)
    if (!paths.ok) return paths
    const id = String(suiteId || '').trim()
    if (!SAFE_ID_RE.test(id)) return fail('invalid_eval_suite_id', '评估集 id 无效')
    return ok({ ...paths, suiteId: id, suite: path.join(paths.suites, `${id}.json`) })
  }

  function configurationIdentity(agentId) {
    const draft = registry?.getAgentDraft?.({ agentId })
    if (draft?.ok) return {
      source: 'draft',
      definitionHash: String(draft.draft?.definitionHash || ''),
      draftStatus: String(draft.draft?.status || 'draft'),
      publishedRevision: Number(draft.draft?.publishedRevision) || null,
    }
    const revisions = registry?.listAgentRevisions?.({ agentId })
    const latest = revisions?.ok && revisions.revisions?.[0]
    if (latest) return {
      source: 'revision',
      definitionHash: String(latest.definitionHash || ''),
      revision: Number(latest.revision) || null,
    }
    const current = registry?.getAgentDefinition?.({ agentId })
    return current?.ok ? {
      source: current.ownership === 'system' ? 'system' : 'runtime',
      definitionHash: String(current.definitionHash || ''),
      version: String(current.definition?.version || ''),
    } : { source: 'unresolved', definitionHash: '' }
  }

  function saveSuite(payload = {}) {
    const agentId = String(payload.agentId || payload.agent_id || payload.suite?.agentId || '').trim()
    const normalized = normalizeSuite(payload.suite || payload, agentId)
    if (!normalized.ok) return normalized
    const paths = suitePath(agentId, normalized.suite.id)
    if (!paths.ok) return paths
    const existing = readJson(paths.suite)
    const timestamp = nowIso()
    const suite = {
      ...normalized.suite,
      createdAt: existing?.createdAt || timestamp,
      updatedAt: timestamp,
      configuration: configurationIdentity(agentId),
      coverage: scenarioCoverage(normalized.suite.cases),
    }
    suite.suiteHash = contentHash({ ...suite, createdAt: undefined, updatedAt: undefined, suiteHash: undefined })
    writeJsonAtomic(paths.suite, suite)
    return ok({ code: existing ? 'agent_eval_suite_updated' : 'agent_eval_suite_created', suite })
  }

  function getSuite(payload = {}) {
    const paths = suitePath(payload.agentId || payload.agent_id, payload.suiteId || payload.suite_id)
    if (!paths.ok) return paths
    const suite = readJson(paths.suite)
    return suite ? ok({ suite }) : fail('agent_eval_suite_not_found', `评估集不存在: ${paths.suiteId}`)
  }

  async function checkRuntime() {
    const status = await bridge.status()
    return status?.ok
      ? ok({ code: 'deepeval_ready', available: true, version: status.version || '', metrics: [...DEEPEVAL_METRICS] })
      : ok({
          code: status?.code || 'deepeval_unavailable',
          available: false,
          version: '',
          metrics: [...DEEPEVAL_METRICS],
          error: status?.error || '未检测到 DeepEval',
          setup: 'python -m pip install -U deepeval',
        })
  }

  async function setupRuntime() {
    if (typeof deps.deepEvalInstaller === 'function') return deps.deepEvalInstaller({ runtimeRoot, runtimePython })
    fs.mkdirSync(path.dirname(runtimeRoot), { recursive: true })
    if (!fs.existsSync(runtimePython)) {
      const created = await runProcess({
        cmd: systemPython,
        args: ['-m', 'venv', runtimeRoot],
        cwd: path.dirname(runtimeRoot),
        timeoutMs: 300000,
        env: { ...process.env, PYTHONUTF8: '1' },
      })
      if (!created.ok) return fail(created.code === -1 ? 'python_unavailable' : 'deepeval_venv_failed',
        String(created.stderr || created.stdout || '无法创建 DeepEval 隔离环境').slice(0, 3000))
    }
    const installed = await runProcess({
      cmd: runtimePython,
      args: ['-m', 'pip', 'install', '--upgrade', 'deepeval>=3.0'],
      cwd: runtimeRoot,
      timeoutMs: 900000,
      env: { ...process.env, PIP_DISABLE_PIP_VERSION_CHECK: '1', PYTHONUTF8: '1' },
    })
    if (!installed.ok) return fail('deepeval_install_failed',
      String(installed.stderr || installed.stdout || 'DeepEval 安装失败').slice(0, 6000))
    const status = await checkRuntime()
    return status.available
      ? ok({ code: 'deepeval_installed', available: true, version: status.version, runtimeRoot })
      : fail('deepeval_install_unverified', status.error || 'DeepEval 安装后校验失败')
  }

  async function runEvaluation(payload = {}) {
    const agentId = String(payload.agentId || payload.agent_id || '').trim()
    const suiteResult = getSuite({ agentId, suiteId: payload.suiteId || payload.suite_id })
    if (!suiteResult.ok) return suiteResult
    const suite = suiteResult.suite
    const observations = normalizeObservations(payload.observations)
    const mode = ['auto', 'native', 'deepeval'].includes(String(payload.engine || '').toLowerCase())
      ? String(payload.engine).toLowerCase() : 'auto'
    const semanticMetrics = suite.metrics.filter(metric => DEEPEVAL_METRICS.has(metric.type))
    let runtime = { available: false, code: 'native_only' }
    if (semanticMetrics.length && mode !== 'native') runtime = await checkRuntime()
    let deepResults = []
    let deepFailure = null
    if (semanticMetrics.length && mode !== 'native' && runtime.available) {
      const executedCases = suite.cases.filter(testCase => observations.has(testCase.id)).map(testCase => ({
        ...testCase,
        observation: observations.get(testCase.id),
      }))
      const deep = await bridge.evaluate({
        agentId,
        suiteId: suite.id,
        judgeModel: String(payload.judgeModel || payload.judge_model || suite.judgeModel || '').trim(),
        metrics: semanticMetrics,
        cases: executedCases,
      })
      if (deep?.ok) deepResults = Array.isArray(deep.results) ? deep.results : []
      else deepFailure = deep || fail('deepeval_failed', 'DeepEval 执行失败')
    }
    const deepIndex = new Map(deepResults.map(item => [`${item.caseId}:${item.metricId}`, item]))
    const caseResults = suite.cases.map(testCase => {
      const observation = observations.get(testCase.id)
      if (!observation) {
        return {
          caseId: testCase.id,
          scenario: testCase.scenario,
          status: 'blocked',
          metrics: suite.metrics.map(metric => blockedMetric(metric, 'missing_observation', '缺少目标 Agent 的真实运行结果。')),
        }
      }
      const metrics = suite.metrics.map(metric => {
        if (metric.type === 'text_assertions') return evaluateTextAssertions(metric, testCase, observation)
        if (metric.type === 'tool_correctness') return evaluateToolCorrectness(metric, testCase, observation)
        if (metric.type === 'tool_permission') return evaluateToolPermission(metric, testCase, observation)
        if (mode === 'native') return blockedMetric(metric, 'deepeval_disabled', '当前执行选择了 native 模式，语义指标未运行。')
        if (!runtime.available) return blockedMetric(metric, runtime.code || 'deepeval_unavailable', runtime.error || 'DeepEval 不可用。')
        if (deepFailure) return blockedMetric(metric, deepFailure.code || 'deepeval_failed', deepFailure.error || 'DeepEval 执行失败。')
        const result = deepIndex.get(`${testCase.id}:${metric.id}`)
        if (!result || result.error) return blockedMetric(metric, result?.code || 'deepeval_metric_failed', result?.error || 'DeepEval 未返回该指标结果。')
        return metricResult(metric, result.score, result.reason, `deepeval${runtime.version ? `@${runtime.version}` : ''}`)
      })
      return {
        caseId: testCase.id,
        scenario: testCase.scenario,
        status: metrics.some(item => item.status === 'blocked') ? 'blocked'
          : metrics.every(item => item.passed || suite.metrics.find(metric => metric.id === item.metricId)?.required === false) ? 'passed' : 'failed',
        metrics,
        evidenceRefs: observation.evidenceRefs,
      }
    })
    const allMetrics = caseResults.flatMap(item => item.metrics)
    const coverage = scenarioCoverage(suite.cases)
    const currentConfiguration = configurationIdentity(agentId)
    const staleConfiguration = Boolean(suite.configuration?.definitionHash && currentConfiguration.definitionHash
      && suite.configuration.definitionHash !== currentConfiguration.definitionHash)
    const summary = {
      cases: caseResults.length,
      passedCases: caseResults.filter(item => item.status === 'passed').length,
      failedCases: caseResults.filter(item => item.status === 'failed').length,
      blockedCases: caseResults.filter(item => item.status === 'blocked').length,
      metrics: allMetrics.length,
      passedMetrics: allMetrics.filter(item => item.status === 'passed').length,
      failedMetrics: allMetrics.filter(item => item.status === 'failed').length,
      blockedMetrics: allMetrics.filter(item => item.status === 'blocked').length,
    }
    const gate = {
      passed: coverage.passed && !staleConfiguration && summary.blockedCases === 0 && summary.failedCases === 0,
      coverage,
      staleConfiguration,
      configuration: currentConfiguration,
      certification: 'scenario-regression-only',
      note: '通过表示当前配置的冻结场景回归通过，不等于独立专业认证。',
    }
    const runId = `eval_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
    const paths = evaluationRoot(agentId)
    const report = {
      schemaVersion: EVALUATION_SCHEMA_VERSION,
      runId,
      agentId,
      suiteId: suite.id,
      suiteHash: suite.suiteHash,
      engine: mode,
      deepEval: { available: runtime.available === true, version: runtime.version || '', code: runtime.code || '' },
      createdAt: nowIso(),
      status: summary.blockedCases ? 'blocked' : (gate.passed ? 'passed' : 'failed'),
      summary,
      gate,
      cases: caseResults,
    }
    writeJsonAtomic(path.join(paths.runs, `${runId}.json`), report)
    writeJsonAtomic(path.join(paths.root, 'latest.json'), { runId, report: path.join('runs', `${runId}.json`), updatedAt: report.createdAt })
    return ok({ code: 'agent_eval_completed', report })
  }

  function getReport(payload = {}) {
    const paths = evaluationRoot(payload.agentId || payload.agent_id)
    if (!paths.ok) return paths
    let runId = String(payload.runId || payload.run_id || '').trim()
    if (!runId) runId = String(readJson(path.join(paths.root, 'latest.json'))?.runId || '')
    if (!/^eval_[a-z0-9_]+$/i.test(runId)) return fail('agent_eval_report_not_found', '评估报告不存在')
    const report = readJson(path.join(paths.runs, `${runId}.json`))
    return report ? ok({ report }) : fail('agent_eval_report_not_found', `评估报告不存在: ${runId}`)
  }

  return { checkRuntime, setupRuntime, saveSuite, getSuite, runEvaluation, getReport }
}

module.exports = {
  EVALUATION_SCHEMA_VERSION,
  DEFAULT_TIMEOUT_MS,
  REQUIRED_SCENARIOS,
  NATIVE_METRICS,
  DEEPEVAL_METRICS,
  normalizeSuite,
  scenarioCoverage,
  createDeepEvalBridge,
  createAgentEvaluationService,
}
