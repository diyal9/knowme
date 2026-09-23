/**
 * Measure renderer visual-system entropy without parsing or rewriting CSS.
 *
 * The audit intentionally treats shared token definitions as the one place where
 * literal values are expected. Every other stylesheet is a token consumer.
 */
const fs = require('node:fs')
const path = require('node:path')

const repoRoot = path.resolve(__dirname, '..')
const rendererRoot = path.join(repoRoot, 'src', 'renderer')
const budgetPath = path.join(__dirname, 'renderer-visual-budget.json')
const args = new Set(process.argv.slice(2))
const TOKEN_FILES = new Set([
  'src/renderer/app/brand-tokens.css',
  'src/renderer/app/tokens.css',
])
const LENGTH_LITERAL = /(?:^|[^\w-])-?(?:\d+\.?\d*|\.\d+)(?:px|rem|em|ch|vh|vw|vmin|vmax)\b/i
const PIXEL_LITERAL = /(?:^|[^\w-])-?(?:\d+\.?\d*|\.\d+)px\b/i
const DECLARATION = /(?:^|[;{])\s*(--[\w-]+|[a-z-]+)\s*:\s*([^;{}]+)/gi
const SPACING_PROPERTY = /^(?:margin(?:-(?:top|right|bottom|left|block(?:-(?:start|end))?|inline(?:-(?:start|end))?))?|padding(?:-(?:top|right|bottom|left|block(?:-(?:start|end))?|inline(?:-(?:start|end))?))?|gap|row-gap|column-gap|inset(?:-(?:block|inline)(?:-(?:start|end))?)?|top|right|bottom|left)$/

function cssFiles(dir = rendererRoot) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return cssFiles(full)
    return entry.isFile() && entry.name.endsWith('.css') ? [full] : []
  })
}

function withoutComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '')
}

function relative(file) {
  return path.relative(repoRoot, file).replaceAll('\\', '/')
}

function normalizeValue(value) {
  return value.trim().replace(/\s+/g, ' ')
}

function emptyFileMetrics(file, source) {
  return {
    file: relative(file),
    lines: source.split(/\r?\n/).length,
    fontDeclarations: 0,
    hardcodedFontPx: 0,
    tokenizedFontDeclarations: 0,
    radiusDeclarations: 0,
    hardcodedRadiusDeclarations: 0,
    shadowDeclarations: 0,
    spacingDeclarations: 0,
    hardcodedSpacingDeclarations: 0,
    spaceTokenizedDeclarations: 0,
    importantCount: (source.match(/!important\b/g) || []).length,
    semanticTypeRoleUses: (source.match(/var\(--type-(?:page|section|card|body|support|meta)\)/g) || []).length,
    mediaQueries: (source.match(/@media\b/g) || []).length,
    radiusValues: new Set(),
    shadowValues: new Set(),
  }
}

function inspectFile(file) {
  const raw = fs.readFileSync(file, 'utf8')
  const source = withoutComments(raw)
  const metrics = emptyFileMetrics(file, raw)
  for (const match of source.matchAll(DECLARATION)) {
    const property = match[1].toLowerCase()
    const value = normalizeValue(match[2])
    if (property === 'font' || property === 'font-size') {
      metrics.fontDeclarations += 1
      if (PIXEL_LITERAL.test(value)) metrics.hardcodedFontPx += 1
      if (/var\(--(?:type|font|weight)-/.test(value)) metrics.tokenizedFontDeclarations += 1
    }
    if (property.endsWith('radius')) {
      metrics.radiusDeclarations += 1
      if (LENGTH_LITERAL.test(value) || /(?:^|\s)\d+(?:\.\d+)?%\b/.test(value)) {
        metrics.hardcodedRadiusDeclarations += 1
        metrics.radiusValues.add(value)
      }
    }
    if (property === 'box-shadow' || property === 'text-shadow' || (property === 'filter' && value.includes('drop-shadow'))) {
      metrics.shadowDeclarations += 1
      if (value !== 'none' && !/^var\(--[\w-]+\)$/.test(value)) metrics.shadowValues.add(value)
    }
    if (SPACING_PROPERTY.test(property)) {
      metrics.spacingDeclarations += 1
      if (value.includes('var(--space-')) metrics.spaceTokenizedDeclarations += 1
      if (LENGTH_LITERAL.test(value)) metrics.hardcodedSpacingDeclarations += 1
    }
  }
  return metrics
}

function sum(files, key) {
  return files.reduce((total, file) => total + file[key], 0)
}

function union(files, key) {
  return new Set(files.flatMap((file) => [...file[key]]))
}

function topOffenders(files, key) {
  return files
    .filter((file) => file[key] > 0)
    .sort((a, b) => b[key] - a[key] || a.file.localeCompare(b.file))
    .slice(0, 8)
    .map((file) => ({ file: file.file, count: file[key] }))
}

function buildReport() {
  const allFiles = cssFiles().map(inspectFile)
  const consumerFiles = allFiles.filter((file) => !TOKEN_FILES.has(file.file))
  const fontDeclarations = sum(consumerFiles, 'fontDeclarations')
  const tokenizedFontDeclarations = sum(consumerFiles, 'tokenizedFontDeclarations')
  const spacingDeclarations = sum(consumerFiles, 'spacingDeclarations')
  const hardcodedSpacingDeclarations = sum(consumerFiles, 'hardcodedSpacingDeclarations')
  const metrics = {
    cssFiles: allFiles.length,
    cssLines: sum(allFiles, 'lines'),
    fontDeclarations,
    hardcodedFontPx: sum(consumerFiles, 'hardcodedFontPx'),
    tokenizedFontDeclarations,
    tokenizedFontSharePercent: fontDeclarations ? Number((tokenizedFontDeclarations / fontDeclarations * 100).toFixed(1)) : 100,
    radiusDeclarations: sum(consumerFiles, 'radiusDeclarations'),
    hardcodedRadiusDeclarations: sum(consumerFiles, 'hardcodedRadiusDeclarations'),
    uniqueRadiusValues: union(consumerFiles, 'radiusValues').size,
    shadowDeclarations: sum(consumerFiles, 'shadowDeclarations'),
    uniqueShadowValues: union(consumerFiles, 'shadowValues').size,
    spacingDeclarations,
    hardcodedSpacingDeclarations,
    hardcodedSpacingSharePercent: spacingDeclarations ? Number((hardcodedSpacingDeclarations / spacingDeclarations * 100).toFixed(1)) : 0,
    spaceTokenizedDeclarations: sum(consumerFiles, 'spaceTokenizedDeclarations'),
    importantCount: sum(consumerFiles, 'importantCount'),
    semanticTypeRoleUses: sum(consumerFiles, 'semanticTypeRoleUses'),
    mediaQueries: sum(consumerFiles, 'mediaQueries'),
  }
  return {
    generatedAt: new Date().toISOString(),
    scope: 'src/renderer/**/*.css (literal-value budgets exclude app/brand-tokens.css and app/tokens.css)',
    metrics,
    topOffenders: {
      hardcodedFontPx: topOffenders(consumerFiles, 'hardcodedFontPx'),
      hardcodedRadiusDeclarations: topOffenders(consumerFiles, 'hardcodedRadiusDeclarations'),
      hardcodedSpacingDeclarations: topOffenders(consumerFiles, 'hardcodedSpacingDeclarations'),
      importantCount: topOffenders(consumerFiles, 'importantCount'),
    },
  }
}

function evaluateBudget(report) {
  const budget = JSON.parse(fs.readFileSync(budgetPath, 'utf8'))
  const violations = []
  for (const [metric, maximum] of Object.entries(budget.maximums)) {
    const actual = report.metrics[metric]
    if (typeof actual !== 'number') {
      violations.push(`${metric}: unknown metric`)
    } else if (actual > maximum) {
      violations.push(`${metric}: ${actual} exceeds ${maximum}`)
    }
  }
  return { ...budget, violations, ok: violations.length === 0 }
}

function humanReport(report, budget) {
  const metric = report.metrics
  const lines = [
    `renderer visual audit: ${budget.ok ? 'PASS' : 'FAIL'}`,
    `- ${metric.cssFiles} stylesheets / ${metric.cssLines.toLocaleString()} lines`,
    `- typography: ${metric.hardcodedFontPx} consumer declarations with pixel literals / ${metric.tokenizedFontSharePercent}% tokenized`,
    `- radius: ${metric.hardcodedRadiusDeclarations} hardcoded declarations / ${metric.uniqueRadiusValues} unique values`,
    `- shadow: ${metric.shadowDeclarations} declarations / ${metric.uniqueShadowValues} unique non-token values`,
    `- spacing: ${metric.hardcodedSpacingDeclarations} hardcoded declarations (${metric.hardcodedSpacingSharePercent}%) / ${metric.spaceTokenizedDeclarations} using --space-*`,
    `- cascade: ${metric.importantCount} !important declarations`,
    `- semantic typography role uses: ${metric.semanticTypeRoleUses}`,
  ]
  if (budget.violations.length) lines.push(...budget.violations.map((violation) => `- budget: ${violation}`))
  return lines.join('\n')
}

const report = buildReport()
const budget = evaluateBudget(report)
const output = { ...report, budget }

if (args.has('--json')) console.log(JSON.stringify(output, null, 2))
else console.log(humanReport(report, budget))

if (args.has('--check') && !budget.ok) process.exit(1)
