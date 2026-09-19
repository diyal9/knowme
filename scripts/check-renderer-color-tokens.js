/** Enforce one semantic renderer palette and prevent private feature colors. */
const fs = require('node:fs')
const path = require('node:path')

const repoRoot = path.resolve(__dirname, '..')
const rendererRoot = path.join(repoRoot, 'src', 'renderer')
const palettePath = path.join(rendererRoot, 'app', 'brand-tokens.css')
const RAW_COLOR = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![0-9a-fA-F])|\brgba?\([^)]*\)|\bhsla?\([^)]*\)/g
const SEMANTIC_TOKEN = /--(?:brand|action|surface|text|border|state)-[\w-]+\s*:/g

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

const palette = withoutComments(fs.readFileSync(palettePath, 'utf8'))
const tokens = palette.match(SEMANTIC_TOKEN) || []
const names = tokens.map((token) => token.slice(0, token.indexOf(':')).trim())
const errors = []

if (names.length < 30 || names.length > 40) {
  errors.push(`semantic palette must contain 30-40 tokens; found ${names.length}`)
}
if (new Set(names).size !== names.length) errors.push('semantic palette contains duplicate token names')

for (const file of cssFiles()) {
  if (path.normalize(file) === path.normalize(palettePath)) continue
  const source = withoutComments(fs.readFileSync(file, 'utf8'))
  const matches = [...source.matchAll(RAW_COLOR)]
  if (!matches.length) continue
  const relative = path.relative(repoRoot, file).replaceAll('\\', '/')
  const preview = matches.slice(0, 5).map((match) => match[0]).join(', ')
  errors.push(`${relative}: ${matches.length} raw color literal(s): ${preview}`)
}

if (errors.length) {
  console.error(['renderer color token check failed:', ...errors.map((error) => `- ${error}`)].join('\n'))
  process.exit(1)
}

console.log(`renderer color tokens ok (${names.length} semantic tokens, ${cssFiles().length} stylesheets)`)

