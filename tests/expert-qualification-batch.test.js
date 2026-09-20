'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const {
  parseArgs,
  suiteSlug,
  buildBatchPlan,
  reportSummary,
  executeBatch,
} = require('../scripts/expert-qualification-batch.js')

const root = path.resolve(__dirname, '..')
const matrixFile = path.join(root, 'openspec', 'changes', 'production-qualify-all-experts', 'expert-qualification-matrix.json')

test('expert qualification batch parses explicit isolated execution options', () => {
  assert.deepEqual(parseArgs([
    'node',
    'expert-qualification-batch.js',
    '--matrix', 'matrix.json',
    '--qa-root', 'qualification/run',
    '--source-user-data', 'source',
    '--out', 'qualification/report.json',
    '--headed',
    '--plan',
  ]), {
    matrix: 'matrix.json',
    qaRoot: 'qualification/run',
    sourceUserData: 'source',
    output: 'qualification/report.json',
    headed: true,
    plan: true,
  })
})

test('expert qualification batch builds one isolated suite plan for the retained roster', () => {
  const plan = buildBatchPlan({ root, matrixFile })
  assert.equal(plan.totalExperts, 7)
  assert.equal(plan.totalSuites, 12)
  assert.equal(plan.totalCases, 59)
  assert.deepEqual(plan.expertIds, [
    'product-manager',
    'office-partner',
    'research-analyst',
    'software-engineer',
    'data-analyst',
    'image-producer',
    'operations-data-analyst',
  ])
  assert.equal(new Set(plan.suites.map(item => item.file)).size, plan.totalSuites)
  assert.equal(plan.suites.every(item => item.caseCount > 0 && item.expertIds.length > 0), true)
  assert.equal(new Set(plan.suites.map(item => item.slug)).size, plan.totalSuites)
})

test('expert qualification batch keeps suite slugs deterministic and report summaries bounded', () => {
  assert.equal(suiteSlug('skill-evals/rqa76-image-producer-qualification/evals.json', 2), '03-skill-evals-rqa76-image-producer-qualification-evals-json')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-qualification-batch-report-'))
  const file = path.join(dir, 'report.json')
  fs.writeFileSync(file, JSON.stringify({
    summary: {
      total: 5,
      lifecyclePassed: 3,
      lifecycleBlocked: 1,
      lifecycleFailed: 1,
      environmentBlocked: 1,
      runtimeFailed: 1,
      semanticReviewPending: 5,
      ignored: 'not numeric',
    },
  }))
  assert.deepEqual(reportSummary(file), {
    total: 5,
    lifecyclePassed: 3,
    lifecycleBlocked: 1,
    lifecycleFailed: 1,
    environmentBlocked: 1,
    runtimeFailed: 1,
    semanticReviewPending: 5,
  })
})

test('expert qualification batch continues after a suite failure and preserves the failure exit code', async () => {
  const qaRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-qualification-batch-run-'))
  const plan = {
    schemaVersion: 1,
    matrixFile,
    expertIds: ['product-manager'],
    totalExperts: 1,
    totalSuites: 2,
    totalCases: 2,
    suites: [
      {
        index: 0,
        file: path.join(root, 'one.json'),
        relativeFile: 'one.json',
        expertIds: ['product-manager'],
        suite: 'one',
        caseCount: 1,
        caseIds: ['PM01'],
        slug: '01-one-json',
      },
      {
        index: 1,
        file: path.join(root, 'two.json'),
        relativeFile: 'two.json',
        expertIds: ['product-manager'],
        suite: 'two',
        caseCount: 1,
        caseIds: ['PM02'],
        slug: '02-two-json',
      },
    ],
  }
  const seen = []
  const result = await executeBatch({
    root,
    plan,
    qaRoot,
    runProcess: async args => {
      seen.push(args[args.indexOf('--suite') + 1])
      return { exitCode: seen.length === 1 ? 2 : 0, signal: '', stdout: '', stderr: '', error: '' }
    },
  })
  assert.equal(seen.length, 2)
  assert.deepEqual(seen, [plan.suites[0].file, plan.suites[1].file])
  assert.equal(result.exitCode, 2)
  assert.equal(result.report.summary.suites, 2)
  assert.equal(result.report.summary.suitesPassed, 1)
  assert.equal(fs.existsSync(result.report.outputFile), true)
})
