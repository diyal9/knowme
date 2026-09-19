'use strict'

const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')

const { assertSafeUserData } = require('./expert-qualification-live')
const { evaluateMatrix } = require('./expert-qualification-matrix')

function parseArgs(argv) {
  const out = {
    matrix: '',
    qaRoot: '',
    sourceUserData: '',
    output: '',
    headed: false,
    plan: false,
  }
  for (let index = 2; index < argv.length; index += 1) {
    const value = String(argv[index] || '')
    if (value === '--matrix') out.matrix = String(argv[++index] || '')
    else if (value === '--qa-root') out.qaRoot = String(argv[++index] || '')
    else if (value === '--source-user-data') out.sourceUserData = String(argv[++index] || '')
    else if (value === '--out') out.output = String(argv[++index] || '')
    else if (value === '--headed') out.headed = true
    else if (value === '--plan') out.plan = true
    else throw new Error(`Unknown option: ${value}`)
  }
  return out
}

function isInside(candidate, parent) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate))
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

function readJson(file, label) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (error) {
    throw new Error(`Unable to read ${label}: ${error.message || error}`)
  }
}

function resolveWorkspaceFile(root, input, label) {
  if (!String(input || '').trim()) throw new Error(`${label} is required`)
  const resolved = path.resolve(root, input)
  if (!isInside(resolved, root)) throw new Error(`${label} must stay inside the workspace`)
  if (!fs.existsSync(resolved)) throw new Error(`${label} not found: ${input}`)
  return resolved
}

function suiteSlug(relativeFile, index) {
  const base = String(relativeFile || '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  return `${String(index + 1).padStart(2, '0')}-${base || 'suite'}`
}

function buildBatchPlan({ root, matrixFile }) {
  const matrix = readJson(matrixFile, 'qualification matrix')
  const evaluated = evaluateMatrix({
    root,
    matrix,
    matrixDir: path.dirname(matrixFile),
  })
  if (!evaluated.complete) throw new Error('qualification matrix is incomplete; refusing batch execution')

  const suiteOwners = new Map()
  for (const expert of matrix.experts) {
    for (const relativeFile of Array.isArray(expert.sourceSuites) ? expert.sourceSuites : []) {
      const normalized = String(relativeFile || '').trim()
      if (!normalized) continue
      const matrixRelativeSuite = path.resolve(path.dirname(matrixFile), normalized)
      const suiteFile = resolveWorkspaceFile(root, matrixRelativeSuite, 'qualification suite')
      const current = suiteOwners.get(suiteFile) || { relativeFile: normalized, expertIds: [] }
      if (!current.expertIds.includes(expert.id)) current.expertIds.push(expert.id)
      suiteOwners.set(suiteFile, current)
    }
  }

  const suites = [...suiteOwners.entries()]
    .sort((a, b) => a[1].relativeFile.localeCompare(b[1].relativeFile))
    .map(([file, item], index) => {
      const suite = readJson(file, `qualification suite ${item.relativeFile}`)
      const cases = (Array.isArray(suite.evals) ? suite.evals : [])
        .filter(entry => item.expertIds.includes(String(entry?.expertId || entry?.expert || '').trim()))
      return {
        index,
        file,
        relativeFile: item.relativeFile,
        expertIds: item.expertIds,
        suite: String(suite.suite || path.basename(path.dirname(file))),
        caseCount: cases.length,
        caseIds: cases.map(entry => String(entry.id || '').trim()).filter(Boolean),
        slug: suiteSlug(item.relativeFile, index),
      }
    })
  return {
    schemaVersion: 1,
    matrixFile,
    expertIds: matrix.experts.map(item => item.id),
    totalExperts: matrix.experts.length,
    totalSuites: suites.length,
    totalCases: suites.reduce((sum, item) => sum + item.caseCount, 0),
    suites,
  }
}

function runChildProcess(args, options = {}) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', chunk => {
      const text = String(chunk)
      stdout += text
      if (options.onStdout) options.onStdout(text)
    })
    child.stderr.on('data', chunk => {
      const text = String(chunk)
      stderr += text
      if (options.onStderr) options.onStderr(text)
    })
    child.on('error', error => resolve({ exitCode: null, signal: '', stdout, stderr, error: String(error.message || error) }))
    child.on('close', (exitCode, signal) => resolve({ exitCode, signal: signal || '', stdout, stderr, error: '' }))
  })
}

function reportSummary(reportFile) {
  if (!fs.existsSync(reportFile)) return null
  try {
    const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'))
    return {
      total: Number(report.summary?.total) || 0,
      lifecyclePassed: Number(report.summary?.lifecyclePassed) || 0,
      lifecycleBlocked: Number(report.summary?.lifecycleBlocked) || 0,
      lifecycleFailed: Number(report.summary?.lifecycleFailed) || 0,
      environmentBlocked: Number(report.summary?.environmentBlocked) || 0,
      runtimeFailed: Number(report.summary?.runtimeFailed) || 0,
      semanticReviewPending: Number(report.summary?.semanticReviewPending) || 0,
    }
  } catch {
    return null
  }
}

async function executeBatch({ root, plan, qaRoot, sourceUserData = '', output = '', headed = false, runProcess = runChildProcess }) {
  const outputFile = output || path.join(qaRoot, 'qualification-batch-report.json')
  if (!isInside(outputFile, qaRoot)) throw new Error('--out must stay inside --qa-root')
  fs.mkdirSync(path.join(qaRoot, 'runs'), { recursive: true })
  fs.mkdirSync(path.join(qaRoot, 'reports'), { recursive: true })
  const results = []
  for (const suite of plan.suites) {
    const runUserData = path.join(qaRoot, 'runs', suite.slug)
    const reportFile = path.join(qaRoot, 'reports', `${suite.slug}.json`)
    const args = [
      path.join(root, 'scripts', 'expert-qualification-live.js'),
      '--suite', suite.file,
      '--user-data', runUserData,
      '--out', reportFile,
      '--case', suite.caseIds.join(','),
    ]
    if (sourceUserData) args.push('--source-user-data', sourceUserData)
    if (headed) args.push('--headed')
    process.stdout.write(`[qualification-batch] ${suite.index + 1}/${plan.totalSuites} ${suite.relativeFile}\n`)
    const child = await runProcess(args, {
      cwd: root,
      env: { ...process.env, KNOWME_TEST_SEAM: '1' },
      onStdout: text => process.stdout.write(text),
      onStderr: text => process.stderr.write(text),
    })
    results.push({
      index: suite.index,
      relativeFile: suite.relativeFile,
      suite: suite.suite,
      expertIds: suite.expertIds,
      caseCount: suite.caseCount,
      runUserData,
      reportFile,
      exitCode: child.exitCode,
      signal: child.signal,
      error: child.error,
      summary: reportSummary(reportFile),
    })
  }

  const failed = results.filter(item => item.exitCode !== 0)
  const batchReport = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    matrixFile: plan.matrixFile,
    qaRoot,
    sourceUserData: sourceUserData ? '[provided]' : '',
    policy: {
      isolatedUserData: true,
      continueAfterSuiteFailure: true,
      automaticProfessionalAcceptance: false,
    },
    plan: {
      totalExperts: plan.totalExperts,
      expertIds: plan.expertIds,
      totalSuites: plan.totalSuites,
      totalCases: plan.totalCases,
    },
    summary: {
      suites: results.length,
      suitesPassed: results.filter(item => item.exitCode === 0).length,
      suitesBlockedOrFailed: failed.length,
      cases: plan.totalCases,
      environmentBlocked: results.reduce((sum, item) => sum + (item.summary?.environmentBlocked || 0), 0),
      lifecyclePassed: results.reduce((sum, item) => sum + (item.summary?.lifecyclePassed || 0), 0),
      lifecycleBlocked: results.reduce((sum, item) => sum + (item.summary?.lifecycleBlocked || 0), 0),
      lifecycleFailed: results.reduce((sum, item) => sum + (item.summary?.lifecycleFailed || 0), 0),
    },
    suites: results,
  }
  fs.writeFileSync(outputFile, `${JSON.stringify(batchReport, null, 2)}\n`, 'utf8')
  batchReport.outputFile = outputFile
  return { report: batchReport, exitCode: failed.length ? 2 : 0 }
}

async function main(argv = process.argv) {
  const root = path.resolve(__dirname, '..')
  const options = parseArgs(argv)
  const matrixFile = resolveWorkspaceFile(
    root,
    options.matrix || 'openspec/changes/production-qualify-all-experts/expert-qualification-matrix.json',
    '--matrix',
  )
  const plan = buildBatchPlan({ root, matrixFile })
  process.stdout.write(`[qualification-batch] plan ${plan.totalExperts} experts / ${plan.totalSuites} suites / ${plan.totalCases} cases\n`)
  if (options.plan) {
    for (const suite of plan.suites) {
      process.stdout.write(`- ${suite.relativeFile}: ${suite.caseCount} cases (${suite.expertIds.join(', ')})\n`)
    }
    return { plan, exitCode: 0 }
  }
  const qaRoot = assertSafeUserData(options.qaRoot)
  const result = await executeBatch({
    root,
    plan,
    qaRoot,
    sourceUserData: options.sourceUserData,
    output: options.output ? path.resolve(options.output) : '',
    headed: options.headed,
  })
  process.stdout.write(`[qualification-batch] report ${result.report.outputFile}\n`)
  process.stdout.write(`[qualification-batch] suites ${result.report.summary.suitesPassed}/${result.report.summary.suites}; lifecycle ${result.report.summary.lifecyclePassed}/${result.report.summary.cases}; environmentBlocked=${result.report.summary.environmentBlocked}\n`)
  if (result.exitCode) process.exitCode = result.exitCode
  return result.report
}

if (require.main === module) {
  main().catch(error => {
    process.stderr.write(`${error?.stack || error}\n`)
    process.exitCode = 1
  })
}

module.exports = {
  parseArgs,
  isInside,
  resolveWorkspaceFile,
  suiteSlug,
  buildBatchPlan,
  reportSummary,
  executeBatch,
  main,
}
