'use strict'

const fs = require('fs')
const path = require('path')
const { getAdapter, ADAPTERS } = require('../tests/lib/benchmark-adapters')
const {
  validateRunMetadata,
  scoreTaskAgainstRubric,
} = require('../tests/lib/benchmark-schema')
const { buildEnhancedMarkdownReport, percentile } = require('../tests/lib/eval-report')

const TASKS_FILE = path.join(__dirname, '..', 'tests', 'fixtures', 'agent-benchmark', 'tasks', 'core-10.json')
const PRODUCTS = ['knowme', 'cursor', 'workbuddy']

function parseArgs(argv) {
  const out = {
    suite: 'core-10',
    products: PRODUCTS,
    outBase: null,
    rubricVersion: 'v1',
  }
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--suite') out.suite = argv[++i]
    else if (arg === '--products') out.products = argv[++i].split(',').map(s => s.trim())
    else if (arg === '--out') out.outBase = argv[++i]
    else if (arg === '--rubric') out.rubricVersion = argv[++i]
  }
  return out
}

function loadTaskSet(suiteName) {
  if (suiteName !== 'core-10') throw new Error(`Unknown benchmark suite: ${suiteName}`)
  return JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8'))
}

function buildComparativeMatrix(productResults) {
  const matrix = {}
  for (const [product, tasks] of Object.entries(productResults)) {
    for (const task of tasks) {
      for (const [dim, score] of Object.entries(task.scored?.dimensions || {})) {
        if (!matrix[dim]) matrix[dim] = {}
        matrix[dim][product] = matrix[dim][product] || []
        matrix[dim][product].push(score)
      }
    }
  }
  const avgMatrix = {}
  for (const [dim, byProduct] of Object.entries(matrix)) {
    avgMatrix[dim] = {}
    for (const [product, scores] of Object.entries(byProduct)) {
      avgMatrix[dim][product] = scores.reduce((a, b) => a + b, 0) / scores.length
    }
  }
  return avgMatrix
}

function buildGapSummary(productResults) {
  const gaps = {}
  for (const pair of [['knowme', 'cursor'], ['knowme', 'workbuddy']]) {
    const [a, b] = pair
    const aPass = (productResults[a] || []).filter(t => t.passed).length
    const bPass = (productResults[b] || []).filter(t => t.passed).length
    gaps[`${a}_vs_${b}`] = {
      passRateDelta: (productResults[a]?.length ? aPass / productResults[a].length : 0)
        - (productResults[b]?.length ? bPass / productResults[b].length : 0),
      blocked: (productResults[b] || []).every(t => t.metadata?.status === 'blocked'),
    }
  }
  return gaps
}

async function runBenchmark(options) {
  const taskSet = loadTaskSet(options.suite)
  const executedAt = new Date().toISOString()
  const productResults = {}

  for (const product of options.products) {
    const adapter = getAdapter(product)
    const rows = []
    for (const task of taskSet.tasks) {
      const enrichedTask = { ...task, rubricVersion: options.rubricVersion }
      const context = await adapter.prepareContext(enrichedTask)
      const normalized = await adapter.runTask(enrichedTask, context)
      const meta = {
        taskVersion: taskSet.version,
        rubricVersion: options.rubricVersion,
        executedAt,
        product,
        taskId: task.id,
      }
      const metaCheck = validateRunMetadata(meta)
      const scored = normalized.scored || scoreTaskAgainstRubric(normalized, task.rubric || {})
      const blocked = normalized.metadata?.status === 'blocked'
      rows.push({
        taskId: task.id,
        product,
        passed: blocked ? null : (normalized.passed ?? scored.passed),
        blocked,
        invalidForOfficialCompare: metaCheck.invalidForOfficialCompare || blocked,
        metadata: { ...meta, ...normalized.metadata },
        normalized,
        scored,
      })
      await adapter.cleanup(context)
    }
    productResults[product] = rows
  }

  const officialRows = Object.values(productResults).flat()
    .filter(r => !r.invalidForOfficialCompare && r.passed != null)
  const latencies = officialRows.map(r => r.normalized.latencyMs).filter(Number.isFinite)

  return {
    suite: 'cross-product-benchmark',
    taskSet: taskSet.version,
    rubricVersion: options.rubricVersion,
    runAt: executedAt,
    gateLevel: 'advisory',
    products: options.products,
    total: officialRows.length,
    passed: officialRows.filter(r => r.passed).length,
    passRate: officialRows.length ? officialRows.filter(r => r.passed).length / officialRows.length : 0,
    latency: {
      p50: percentile(latencies, 50),
      p90: percentile(latencies, 90),
      samples: latencies.length,
    },
    comparativeMatrix: buildComparativeMatrix(productResults),
    gapSummary: buildGapSummary(productResults),
    productResults,
    adapters: Object.keys(ADAPTERS),
  }
}

function buildBenchmarkMarkdown(summary) {
  const lines = [
    '# Cross-Product Benchmark Report',
    '',
    `- Task set: ${summary.taskSet}`,
    `- Rubric: ${summary.rubricVersion}`,
    `- Official compare rows: ${summary.passed}/${summary.total}`,
    `- Latency p50/p90: ${summary.latency.p50}ms / ${summary.latency.p90}ms`,
    '',
    '## Gap Summary',
    '',
  ]
  for (const [key, gap] of Object.entries(summary.gapSummary || {})) {
    lines.push(`- ${key}: passRateDelta=${gap.passRateDelta.toFixed(3)} blocked=${gap.blocked}`)
  }
  lines.push('', '## Comparative Matrix', '')
  for (const [dim, byProduct] of Object.entries(summary.comparativeMatrix || {})) {
    lines.push(`### ${dim}`)
    for (const [product, score] of Object.entries(byProduct)) {
      lines.push(`- ${product}: ${score.toFixed(3)}`)
    }
    lines.push('')
  }
  lines.push('', '## Tasks', '')
  for (const product of summary.products || []) {
    lines.push(`### ${product}`)
    for (const row of summary.productResults[product] || []) {
      const status = row.blocked ? 'BLOCKED' : (row.passed ? 'PASS' : 'FAIL')
      lines.push(`- ${row.taskId}: ${status}`)
    }
    lines.push('')
  }
  return lines.join('\n')
}

async function main() {
  const args = parseArgs(process.argv)
  const summary = await runBenchmark(args)
  const json = JSON.stringify(summary, null, 2)
  process.stdout.write(json)

  if (args.outBase) {
    const base = path.resolve(args.outBase)
    fs.mkdirSync(path.dirname(base), { recursive: true })
    fs.writeFileSync(`${base}.json`, json)
    fs.writeFileSync(`${base}.md`, buildBenchmarkMarkdown(summary))
  }

  const knowmeFailed = (summary.productResults.knowme || []).some(r => r.passed === false)
  if (knowmeFailed) process.exit(1)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
