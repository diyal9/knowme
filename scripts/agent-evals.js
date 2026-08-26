'use strict'

const fs = require('fs')
const path = require('path')
const { evaluateAgents, toMarkdown } = require('../tests/lib/agent-evals')

function args(argv) {
  const out = { json: false, out: null, results: null }
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--json') out.json = true
    else if (argv[i] === '--out') out.out = argv[++i]
    else if (argv[i] === '--results') out.results = argv[++i]
  }
  return out
}

function main() {
  const options = args(process.argv)
  const root = path.resolve(__dirname, '..')
  const results = options.results ? JSON.parse(fs.readFileSync(path.resolve(options.results), 'utf8')) : null
  const report = evaluateAgents({
    expertsRoot: path.join(root, 'src', 'catalog', 'experts'),
    catalogPath: path.join(root, 'src', 'catalog', 'catalog.json'),
    results,
  })
  const json = JSON.stringify(report, null, 2)
  if (options.out) {
    const base = path.resolve(options.out)
    fs.mkdirSync(path.dirname(base), { recursive: true })
    fs.writeFileSync(`${base}.json`, `${json}\n`)
    fs.writeFileSync(`${base}.md`, `${toMarkdown(report)}\n`)
  }
  process.stdout.write(`${options.json ? json : toMarkdown(report)}\n`)
}

main()
