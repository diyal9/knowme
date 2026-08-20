const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const repoRoot = path.resolve(__dirname, '..')
const rendererRoot = path.join(repoRoot, 'src', 'renderer')
const registryPath = path.join(rendererRoot, 'features', 'workbench', 'workbench-styles.ts')
const appShellPath = path.join(rendererRoot, 'app', 'AppShell.tsx')
const baselinePath = path.join(__dirname, 'workbench-css-collision-baseline.json')

const registeredImports = [
  '../run/console.css',
  './workbench-layout.css',
  '../shelf/shelf.css',
  './workbench-daemon.css',
  './workbench-studio.css',
  '../expert/expert-workbench.css',
  '../workflow/workflow-room.css',
]
const shellStylesheet = path.join(rendererRoot, 'features', 'workbench', 'workbench-chrome.css')

const exclusiveOwners = [
  { prefix: 'wb-console', owner: 'features/run/console.css' },
  { prefix: 'wb-domain', owner: 'features/shelf/shelf.css' },
  { prefix: 'wb-workflow-detail', owner: 'features/shelf/shelf.css' },
  { prefix: 'wb-workflow-run', owner: 'features/workflow/workflow-room.css' },
]

function normalizePath(file) {
  return path.relative(rendererRoot, file).replaceAll('\\', '/')
}

function featureCssFiles(dir = path.join(rendererRoot, 'features')) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return featureCssFiles(full)
    return entry.isFile() && entry.name.endsWith('.css') ? [full] : []
  })
}

function rendererSourceFiles(dir = rendererRoot) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return rendererSourceFiles(full)
    return entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name) ? [full] : []
  })
}

function cssRules(source) {
  const clean = source.replace(/\/\*[\s\S]*?\*\//g, '')
  const rules = []
  for (const match of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const raw = match[1].trim()
    if (!raw || raw.startsWith('@') || /^(?:from|to|\d+(?:\.\d+)?%)$/.test(raw)) continue
    for (const selector of raw.split(',').map((value) => value.trim()).filter(Boolean)) {
      if (!selector.includes('.wb-') && !selector.includes('.workbench')) continue
      rules.push({
        selector: selector.replace(/\s+/g, ' '),
        body: match[2].trim().replace(/\s+/g, ' '),
      })
    }
  }
  return rules
}

function fail(messages) {
  console.error(['workbench CSS cascade check failed:', ...messages.map((message) => `- ${message}`)].join('\n'))
  process.exit(1)
}

const errors = []
const registry = fs.readFileSync(registryPath, 'utf8')
const positions = registeredImports.map((stylesheet) => {
  const position = registry.indexOf(`import '${stylesheet}'`)
  if (position < 0) errors.push(`missing deterministic import: ${stylesheet}`)
  return position
})
for (let index = 1; index < positions.length; index += 1) {
  if (positions[index - 1] >= positions[index]) {
    errors.push(`stylesheet order changed: ${registeredImports[index - 1]} must load before ${registeredImports[index]}`)
  }
}

const shell = fs.readFileSync(appShellPath, 'utf8')
const registryPosition = shell.indexOf("import '../features/workbench/workbench-styles'")
const chromePosition = shell.indexOf("import '../features/workbench/workbench-chrome.css'")
if (registryPosition < 0 || chromePosition < 0 || registryPosition >= chromePosition) {
  errors.push('AppShell must import workbench-styles before workbench-chrome.css')
}

const registeredFiles = [
  ...registeredImports.map((stylesheet) => path.resolve(path.dirname(registryPath), stylesheet)),
  shellStylesheet,
]
const registeredSet = new Set(registeredFiles.map((file) => path.normalize(file)))
const wbFeatureFiles = featureCssFiles().filter((file) => fs.readFileSync(file, 'utf8').includes('.wb-'))
for (const file of wbFeatureFiles) {
  if (!registeredSet.has(path.normalize(file))) {
    errors.push(`${normalizePath(file)} defines wb-* selectors but is not in workbench-styles.ts`)
  }
}
for (const file of registeredFiles) {
  if (!fs.existsSync(file)) errors.push(`registered stylesheet does not exist: ${normalizePath(file)}`)
}

const registeredNames = new Set(registeredFiles.map((file) => path.basename(file)))
for (const file of rendererSourceFiles()) {
  const source = fs.readFileSync(file, 'utf8')
  for (const match of source.matchAll(/import\\s+['\"]([^'\"]+\\.css)['\"]/g)) {
    const stylesheet = path.basename(match[1])
    if (!registeredNames.has(stylesheet)) continue
    const isFeatureRegistry = path.normalize(file) === path.normalize(registryPath) && stylesheet !== path.basename(shellStylesheet)
    const isStaticChrome = path.normalize(file) === path.normalize(appShellPath) && stylesheet === path.basename(shellStylesheet)
    if (!isFeatureRegistry && !isStaticChrome) {
      errors.push(`${normalizePath(file)} imports workbench CSS owned by the static registry or AppShell: ${stylesheet}`)
    }
  }
}

const definitions = new Map()
for (const file of registeredFiles.filter((item) => fs.existsSync(item))) {
  const owner = normalizePath(file)
  const source = fs.readFileSync(file, 'utf8')
  for (const rule of cssRules(source)) {
    if (!definitions.has(rule.selector)) definitions.set(rule.selector, new Map())
    const owners = definitions.get(rule.selector)
    if (!owners.has(owner)) owners.set(owner, new Set())
    owners.get(owner).add(rule.body)
  }

  for (const { prefix, owner: expectedOwner } of exclusiveOwners) {
    if (owner === expectedOwner) continue
    const pattern = new RegExp(`\\.${prefix}(?:[-_:.[#\\s>+~]|$)`)
    if (pattern.test(source)) errors.push(`${owner} defines private .${prefix}* selectors owned by ${expectedOwner}`)
  }
}

const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'))
const accepted = new Map(baseline.duplicates.map((entry) => [
  `${entry.selector}\n${entry.owners.join('|')}`,
  entry.fingerprint,
]))
for (const [selector, ownersMap] of definitions) {
  if (ownersMap.size < 2) continue
  const owners = [...ownersMap.keys()].sort()
  const payload = owners.map((owner) => ({ owner, bodies: [...ownersMap.get(owner)].sort() }))
  const fingerprint = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 16)
  const key = `${selector}\n${owners.join('|')}`
  if (!accepted.has(key)) {
    errors.push(`new cross-file selector collision: ${selector} (${owners.join(', ')})`)
  } else if (accepted.get(key) !== fingerprint) {
    errors.push(`audited collision changed without baseline review: ${selector}`)
  }
}

if (errors.length) fail(errors)
console.log(`workbench css cascade ok (${registeredFiles.length} registered stylesheets, ${accepted.size} audited collisions)`)
