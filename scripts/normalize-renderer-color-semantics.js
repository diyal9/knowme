/**
 * Refine warm-neutral migrations after raw colors have been tokenized.
 *
 * Low-chroma beige values can look yellow in HSL and be provisionally mapped
 * to warning tokens. This pass keeps warning tokens in status-bearing rules
 * and returns ordinary chrome, borders and surfaces to their semantic roles.
 */
const fs = require('node:fs')
const path = require('node:path')

const repoRoot = path.resolve(__dirname, '..')
const rendererRoot = path.join(repoRoot, 'src', 'renderer')
const palettePath = path.join(rendererRoot, 'app', 'brand-tokens.css')
const write = process.argv.includes('--write')
const statusSelector = /(?:warn|waiting|permission|review|revis|attention|overflow|gate|hitl|limited|degraded|paused|pending|error|danger|fail|reject|block|delete|cancel|missing|stale|drift|is-back|kind-tool|kind-join)/i

function cssFiles(dir = rendererRoot) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return cssFiles(full)
    return entry.isFile() && entry.name.endsWith('.css') ? [full] : []
  })
}

function normalizeDeclaration(segment) {
  if (!segment.includes('--state-warning-')) return segment
  const colon = segment.indexOf(':')
  if (colon < 0) return segment
  const property = segment.slice(0, colon).replace(/\/\*[\s\S]*?\*\//g, '').trim()
  if (property.startsWith('--') && property.includes('warning')) return segment

  const value = segment.slice(colon + 1)
  let normalized = value
  if (/^(?:background|background-color|background-image|fill|stop-color)$/.test(property)) {
    normalized = normalized
      .replaceAll('var(--state-warning-soft)', 'var(--surface-subtle)')
      .replaceAll('var(--state-warning-border)', 'var(--surface-muted)')
  } else if (/^(?:border|border-|outline|outline-|column-rule|stroke|text-decoration-color)/.test(property)) {
    normalized = normalized
      .replaceAll('var(--state-warning-soft)', 'var(--border-subtle)')
      .replaceAll('var(--state-warning-border)', 'var(--border-default)')
  } else {
    normalized = normalized
      .replaceAll('var(--state-warning-soft)', 'var(--surface-subtle)')
      .replaceAll('var(--state-warning-border)', 'var(--border-default)')
  }
  return `${segment.slice(0, colon + 1)}${normalized}`
}

function normalizeBlock(match, selector, body) {
  if (statusSelector.test(selector)) return match
  return `${selector}{${body.split(';').map(normalizeDeclaration).join(';')}}`
}

let changedFiles = 0
let changedReferences = 0
for (const file of cssFiles()) {
  if (path.normalize(file) === path.normalize(palettePath)) continue
  const source = fs.readFileSync(file, 'utf8')
  const before = (source.match(/var\(--state-warning-(?:soft|border)\)/g) || []).length
  const normalized = source.replace(/([^{}]+)\{([^{}]*state-warning-(?:soft|border)[^{}]*)\}/gs, normalizeBlock)
  const after = (normalized.match(/var\(--state-warning-(?:soft|border)\)/g) || []).length
  if (normalized === source) continue
  changedFiles += 1
  changedReferences += before - after
  if (write) fs.writeFileSync(file, normalized)
}

console.log(`${write ? 'normalized' : 'would normalize'} ${changedReferences} warm-neutral references across ${changedFiles} CSS files`)
