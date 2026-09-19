/**
 * Recalculate fingerprints for already-audited cross-file CSS collisions.
 * This intentionally refuses to add or remove collision entries.
 */
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const repoRoot = path.resolve(__dirname, '..')
const rendererRoot = path.join(repoRoot, 'src', 'renderer')
const baselinePath = path.join(__dirname, 'workbench-css-collision-baseline.json')
const files = [
  'features/run/console.css',
  'features/workbench/workbench-layout.css',
  'features/shelf/shelf.css',
  'features/workbench/workbench-daemon.css',
  'features/workbench/workbench-studio.css',
  'features/expert/expert-workbench.css',
  'features/workflow/workflow-room.css',
  'features/workbench/workbench-chrome.css',
]

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

const definitions = new Map()
for (const owner of files) {
  const source = fs.readFileSync(path.join(rendererRoot, owner), 'utf8')
  for (const rule of cssRules(source)) {
    if (!definitions.has(rule.selector)) definitions.set(rule.selector, new Map())
    const owners = definitions.get(rule.selector)
    if (!owners.has(owner)) owners.set(owner, new Set())
    owners.get(owner).add(rule.body)
  }
}

const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'))
let updated = 0
for (const entry of baseline.duplicates) {
  const ownersMap = definitions.get(entry.selector)
  if (!ownersMap) throw new Error(`missing audited selector: ${entry.selector}`)
  const currentOwners = [...ownersMap.keys()].sort()
  const expectedOwners = [...entry.owners].sort()
  if (currentOwners.join('|') !== expectedOwners.join('|')) {
    throw new Error(`owner set changed for ${entry.selector}`)
  }
  const payload = currentOwners.map((owner) => ({ owner, bodies: [...ownersMap.get(owner)].sort() }))
  const fingerprint = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 16)
  if (entry.fingerprint === fingerprint) continue
  entry.fingerprint = fingerprint
  updated += 1
}

fs.writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`)
console.log(`updated ${updated} audited workbench CSS collision fingerprints`)
