'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { parseExpertFrontmatter } = require('../src/lib/expert-runtime')
const { lintExpertPrompt } = require('../src/lib/expert-prompt-governance')

const root = path.resolve(__dirname, '..', 'src', 'catalog', 'experts')

function expertFiles(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const target = path.join(dir, entry.name)
    if (entry.isDirectory()) return expertFiles(target)
    return entry.isFile() && entry.name === 'EXPERT.md' ? [target] : []
  })
}

const results = expertFiles(root).map((file) => {
  const relativeFile = path.relative(path.resolve(__dirname, '..'), file).replace(/\\/g, '/')
  const parsed = parseExpertFrontmatter(fs.readFileSync(file, 'utf8'))
  if (!parsed.ok) {
    return { file: relativeFile, ok: false, errors: [{ code: 'invalid_frontmatter', message: parsed.error }], warnings: [] }
  }
  const lint = lintExpertPrompt(parsed)
  return { file: relativeFile, ok: lint.ok, errors: lint.errors, warnings: lint.warnings }
})

const errorCount = results.reduce((sum, item) => sum + item.errors.length, 0)
const warningCount = results.reduce((sum, item) => sum + item.warnings.length, 0)
process.stdout.write(`${JSON.stringify({
  version: 1, checked: results.length, errorCount, warningCount,
  results: results.filter(item => item.errors.length || item.warnings.length),
}, null, 2)}\n`)
if (errorCount) process.exitCode = 1
