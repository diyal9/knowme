'use strict'

/**
 * Guard against IPC strangler regressions: free identifiers that exist as
 * main.js helpers but are neither required nor taken from deps in ipc modules.
 */
const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')

const { readMainEntryBundle } = require('./helpers/main-ipc-bundle')

const ROOT = path.join(__dirname, '..')
const IPC_DIR = path.join(ROOT, 'src', 'ipc')

const KNOWN_SAFE = new Set([
  // Common globals / builtins / electron
  'AbortController', 'Array', 'Boolean', 'Buffer', 'Date', 'Error', 'JSON', 'Map',
  'Math', 'Number', 'Object', 'Promise', 'RegExp', 'Set', 'String', 'Symbol',
  'URL', 'console', 'crypto', 'fs', 'http', 'https', 'path', 'process', 'require',
  'setInterval', 'setTimeout', 'clearInterval', 'clearTimeout', 'module', 'exports',
  'Intl', 'parseInt', 'parseFloat', 'isNaN', 'encodeURIComponent', 'decodeURIComponent',
  // Often payload / local loop vars that collide with main require aliases
  'noteId', 'app', 'BrowserWindow', 'dialog', 'shell', 'Menu', 'clipboard',
])

function extractMainHelpers(src) {
  const names = new Set()
  for (const m of src.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g)) names.add(m[1])
  for (const m of src.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g)) names.add(m[1])
  for (const m of src.matchAll(/\b(?:scope|ctx)\.([A-Za-z_$][\w$]*)\s*=/g)) names.add(m[1])
  return names
}

function extractRequireBindings(src) {
  const names = new Set()
  for (const m of src.matchAll(/require\((['"])[^'"]+\1\)/g)) {
    /* full require call handled below */
  }
  for (const m of src.matchAll(/const\s+\{([^}]+)\}\s*=\s*require\(/g)) {
    for (const part of m[1].split(',')) {
      const bit = part.trim()
      if (!bit) continue
      const as = bit.split(/\s+as\s+/)
      names.add((as[1] || as[0]).trim())
    }
  }
  for (const m of src.matchAll(/const\s+([A-Za-z_$][\w$]*)\s*=\s*require\(/g)) {
    names.add(m[1])
  }
  return names
}

function extractDepsBindings(src) {
  const names = new Set()
  const m = src.match(/const\s*\{([\s\S]*?)\}\s*=\s*deps\b/)
  if (!m) return names
  for (const part of m[1].split(',')) {
    const bit = part.trim()
    if (!bit || bit.startsWith('//')) continue
    const cleaned = bit.replace(/\/\/.*$/, '').trim()
    if (!cleaned) continue
    const as = cleaned.split(/\s+as\s+|:/)
    const name = (as[0] || '').trim()
    if (/^[A-Za-z_$][\w$]*$/.test(name)) names.add(name)
  }
  return names
}

function extractLocalBindings(src) {
  const names = new Set()
  for (const m of src.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g)) names.add(m[1])
  for (const m of src.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g)) names.add(m[1])
  for (const m of src.matchAll(/\b(?:const|let|var)\s+\{([^}]+)\}\s*=/g)) {
    for (const part of m[1].split(',')) {
      const bit = part.trim()
      if (!bit) continue
      const as = bit.split(/\s+as\s+|:/)
      const name = (as[as.length - 1] || '').trim()
      if (/^[A-Za-z_$][\w$]*$/.test(name)) names.add(name)
    }
  }
  return names
}

function findFreeCalls(src, candidates) {
  const hits = []
  for (const name of candidates) {
    if (KNOWN_SAFE.has(name)) continue
    const re = new RegExp(`\\b${name}\\b`, 'g')
    let m
    while ((m = re.exec(src))) {
      // Skip own definition lines roughly
      const lineStart = src.lastIndexOf('\n', m.index) + 1
      const line = src.slice(lineStart, src.indexOf('\n', m.index))
      if (new RegExp(`\\b(?:function|const|let|var)\\s+${name}\\b`).test(line)) continue
      if (new RegExp(`\\b${name}\\s*,|\\b${name}\\s*\\}|\\b${name}\\s*=`).test(line) && line.includes('deps')) continue
      hits.push({ name, index: m.index, line: line.trim().slice(0, 120) })
      break
    }
  }
  return hits
}

describe('ipc free-main-helper guard', () => {
  it('ai-generate and ai-assist resolve former main-closure helpers', () => {
    const mainSrc = readMainEntryBundle()
    const mainHelpers = extractMainHelpers(mainSrc)
    // Focused watchlist from the temporal-anchor / IPC strangler class of bugs
    const watch = [
      'buildTemporalAnchorContext',
      'mergeExtraTools',
      'buildActiveSourceFileTools',
      'agentRuntimeOutputBridges',
      'loadSourcesStore',
      'getActiveSourceRoot',
      'kosSourcesCtx',
      'workbenchDaemon',
      'agentProcessTools',
      'agentOrchestration',
    ]
    const movedToLib = new Set(['buildTemporalAnchorContext', 'mergeExtraTools'])
    for (const name of watch) {
      assert.ok(
        mainHelpers.has(name) || movedToLib.has(name),
        `expected main helper or lib extraction for ${name}`,
      )
    }

    const gen = [
      fs.readFileSync(path.join(ROOT, 'src', 'ipc', 'ai-generate.ts'), 'utf8'),
      fs.readFileSync(path.join(ROOT, 'src', 'lib', 'agent-generate-prepare.ts'), 'utf8'),
      fs.readFileSync(path.join(ROOT, 'src', 'lib', 'agent-generate-tool-surface.ts'), 'utf8'),
      fs.readFileSync(path.join(ROOT, 'src', 'lib', 'agent-generate-execute.ts'), 'utf8'),
      fs.readFileSync(path.join(ROOT, 'src', 'lib', 'agent-generate-runner.ts'), 'utf8'),
      fs.readFileSync(path.join(ROOT, 'src', 'lib', 'agent-generate-child-ports.ts'), 'utf8'),
    ].join('\n')
    const assist = fs.readFileSync(path.join(IPC_DIR, 'ai-assist.ts'), 'utf8')

    const genBound = new Set([
      ...extractRequireBindings(gen),
      ...extractDepsBindings(gen),
      ...extractLocalBindings(gen),
    ])
    const assistBound = new Set([
      ...extractRequireBindings(assist),
      ...extractDepsBindings(assist),
      ...extractLocalBindings(assist),
    ])

    const genMissing = watch.filter(n => {
      if (n === 'agentProcessTools' || n === 'agentOrchestration') return false
      return gen.includes(n) && !genBound.has(n)
    })
    const assistMissing = ['agentProcessTools', 'agentOrchestration'].filter(n => {
      return assist.includes(n) && !assistBound.has(n)
    })

    assert.deepEqual(genMissing, [], `ai-generate unbound helpers: ${genMissing.join(', ')}`)
    assert.deepEqual(assistMissing, [], `ai-assist unbound helpers: ${assistMissing.join(', ')}`)

    // Temporal anchor / merge tools must come from lib, not main closure
    assert.match(gen, /require\('\.\.\/lib\/temporal-anchor'\)|require\('\.\/temporal-anchor'\)/)
    assert.match(gen, /require\('\.\.\/lib\/merge-extra-tools'\)|require\('\.\/merge-extra-tools'\)/)
    assert.match(gen, /assertRequiredDeps\(/)
    assert.match(gen, /humanizeAgentError\(/)
    assert.ok(genBound.has('buildTemporalAnchorContext'))
    assert.ok(genBound.has('mergeExtraTools'))
    assert.ok(genBound.has('connectorToolRuntime'))

    // Cancel path must wire a real cancelSubRun (not empty noop)
    assert.match(assist, /cancelAllSubRuns\(/)
    assert.doesNotMatch(assist, /cancelSubRun:\s*\(\)\s*=>\s*\{\s*\}/)
  })

  it('scans ipc modules for unbound main-helper identifiers (advisory list)', () => {
    const mainSrc = readMainEntryBundle()
    const mainHelpers = extractMainHelpers(mainSrc)
    const files = fs.readdirSync(IPC_DIR).filter(f => f.endsWith('.ts') && f !== 'index.ts')
    const problems = []
    for (const file of files) {
      const src = fs.readFileSync(path.join(IPC_DIR, file), 'utf8')
      const bound = new Set([
        ...extractRequireBindings(src),
        ...extractDepsBindings(src),
        ...extractLocalBindings(src),
        ...KNOWN_SAFE,
      ])
      const candidates = [...mainHelpers].filter(n => !bound.has(n) && src.includes(n))
      const hits = findFreeCalls(src, candidates)
      for (const hit of hits) {
        // Filter: only flag when used as call or member root (likely runtime binding)
        const callish = new RegExp(`\\b${hit.name}\\s*\\(|\\b${hit.name}\\s*\\.`)
        if (!callish.test(hit.line) && !callish.test(src)) continue
        if (!new RegExp(`\\b${hit.name}\\s*\\(|\\b${hit.name}\\s*\\.`).test(src)) continue
        problems.push(`${file}: ${hit.name} :: ${hit.line}`)
      }
    }
    // Soft assert: known critical set must be empty; dump others for visibility
    const critical = problems.filter(p =>
      /ai-generate\.js: (mergeExtraTools|buildActiveSourceFileTools|agentRuntimeOutputBridges|loadSourcesStore|getActiveSourceRoot|kosSourcesCtx|workbenchDaemon)/.test(p)
      || /ai-assist\.js: (agentProcessTools|agentOrchestration)/.test(p)
      || /buildTemporalAnchorContext/.test(p),
    )
    assert.deepEqual(critical, [], critical.join('\n'))
  })

  it('ai-generate registers with required-deps assert and outer fail catch', () => {
    const gen = [
      fs.readFileSync(path.join(IPC_DIR, 'ai-generate.ts'), 'utf8'),
      fs.readFileSync(path.join(ROOT, 'src', 'lib', 'agent-generate-execute.ts'), 'utf8'),
    ].join('\n')
    assert.match(gen, /AI_GENERATE_REQUIRED_DEPS/)
    assert.match(gen, /catch \(err\) \{\s*[\s\S]*?return fail\(err\)/m)
  })
})
