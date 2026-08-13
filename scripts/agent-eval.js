'use strict'

const fs = require('fs')
const path = require('path')
const { loadBaseline } = require('../tests/agent-conversation-eval-harness')
const { runSuite, resolveSuite, listSuites } = require('../tests/lib/eval-suites')
const { buildEnhancedMarkdownReport } = require('../tests/lib/eval-report')

function parseArgs(argv) {
  const out = {
    suite: 'hard-offline',
    baseline: 'v1',
    outBase: null,
    hardOnly: false,
    advisoryOk: false,
    list: false,
  }
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--suite') out.suite = argv[++i]
    else if (arg === '--baseline') out.baseline = argv[++i]
    else if (arg === '--out') out.outBase = argv[++i]
    else if (arg === '--hard-only') out.hardOnly = true
    else if (arg === '--advisory-ok') out.advisoryOk = true
    else if (arg === '--list') out.list = true
  }
  return out
}

async function main() {
  const args = parseArgs(process.argv)

  if (args.list) {
    process.stdout.write(`${JSON.stringify(listSuites(), null, 2)}\n`)
    return
  }

  const suiteMeta = resolveSuite(args.suite)
  const baseline = loadBaseline(args.baseline)
  const summary = await runSuite(args.suite, { baselineName: args.baseline, baseline })
  summary.baselineConfig = baseline
  summary.requestedSuite = args.suite

  const json = JSON.stringify(summary, null, 2)
  process.stdout.write(json)

  if (args.outBase) {
    const base = path.resolve(args.outBase)
    fs.mkdirSync(path.dirname(base), { recursive: true })
    fs.writeFileSync(`${base}.json`, json)
    fs.writeFileSync(`${base}.md`, buildEnhancedMarkdownReport(summary))
  }

  const blocking = suiteMeta.gateLevel === 'blocking' && !args.advisoryOk
  if (blocking && summary.passed !== summary.total) process.exit(1)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
