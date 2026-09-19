'use strict'

/**
 * Read-only production-data migration rehearsal. It copies only Brain-relevant
 * metadata into an isolated temp directory, runs migration twice and reports
 * idempotence without printing personal content.
 */
const fs = require('fs')
const os = require('os')
const path = require('path')
const crypto = require('crypto')
const brainService = require('../src/lib/brain-service')
const knowledgeOs = require('../src/lib/knowledge-os')
const knowledgeProvider = require('../src/lib/knowledge-provider')

function arg(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : ''
}

function copyIfPresent(sourceRoot, targetRoot, relative) {
  const source = path.join(sourceRoot, relative)
  const target = path.join(targetRoot, relative)
  if (!fs.existsSync(source)) return false
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.copyFileSync(source, target)
  return true
}

function walkFiles(root, relative = '') {
  const dir = path.join(root, relative)
  if (!fs.existsSync(dir)) return []
  const files = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = path.join(relative, entry.name)
    if (entry.isDirectory()) files.push(...walkFiles(root, rel))
    else if (entry.isFile()) files.push(rel)
  }
  return files
}

function fingerprint(root, relative) {
  const target = path.join(root, relative)
  if (!fs.existsSync(target)) return null
  const hash = crypto.createHash('sha256')
  for (const rel of walkFiles(target).sort()) {
    const stat = fs.statSync(path.join(target, rel))
    hash.update(`${rel}:${stat.size}:${stat.mtimeMs}\n`)
  }
  return hash.digest('hex')
}

function main() {
  const source = path.resolve(arg('--source') || path.join(process.env.APPDATA || '', 'KnowMe'))
  if (!source || !fs.existsSync(source)) {
    process.stdout.write(JSON.stringify({ ok: false, code: 'source_missing', sourceExists: false }) + '\n')
    process.exitCode = 2
    return
  }
  const before = fingerprint(source, path.join('knowledge-os', 'brain'))
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-brain-migration-audit-'))
  try {
    const copied = []
    for (const relative of [
      path.join('knowledge-os', 'config.json'),
      path.join('knowledge-os', 'fabric', 'graph.json'),
      path.join('knowledge-os', 'fabric', 'routing.json'),
      path.join('knowledge-os', 'fabric', 'weave-proposals.json'),
      path.join('memory', 'global', 'registry.json'),
      path.join('memory', 'working', 'consolidated.json'),
    ]) if (copyIfPresent(source, temp, relative)) copied.push(relative.replace(/\\/g, '/'))
    const config = knowledgeOs.loadConfig(temp)
    const localProvider = knowledgeProvider.normalizeProvider({
      ...knowledgeProvider.defaultPersonalProvider({
        spaceSourceId: config.spaceSourceId || null,
        subDir: config.subDir || '',
      }),
      id: 'local-default',
      displayName: '我的知识',
    })
    const ctx = { memoryDir: path.join(temp, 'memory'), providers: [localProvider, ...(Array.isArray(config.providers) ? config.providers : [])] }
    const first = brainService.rebuild(temp, ctx)
    const second = brainService.rebuild(temp, ctx)
    const counts = snapshot => ({ nodes: snapshot.nodes.length, claims: snapshot.claims.length, evidence: snapshot.evidence.length, providers: snapshot.providers.length })
    const idempotent = JSON.stringify(counts(first)) === JSON.stringify(counts(second))
    const externalConceptLeak = second.nodes.some(node => node.external === true && node.kind === 'concept')
    const after = fingerprint(source, path.join('knowledge-os', 'brain'))
    const result = {
      ok: idempotent && !externalConceptLeak && before === after,
      sourceExists: true,
      sourceUntouched: before === after,
      copiedMetadataFiles: copied.length,
      migrationVersion: second.state?.migrationVersion || 0,
      idempotent,
      externalConceptLeak,
      counts: counts(second),
    }
    process.stdout.write(JSON.stringify(result, null, 2) + '\n')
    if (!result.ok) process.exitCode = 1
  } finally {
    fs.rmSync(temp, { recursive: true, force: true })
  }
}

main()
