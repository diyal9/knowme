'use strict'

/**
 * One-shot: install curated capabilities into real KnowMe userData.
 * Does not delete other user data.
 */
require('./register-ts')

const fs = require('fs')
const path = require('path')
const { createCapabilityHubService } = require('../src/lib/capability-hub-service')

const IDS = [
  'crawl4ai',
  'last30days-cn',
  'crawl4ai-expert',
  'sentiment-opinion-expert',
]

async function main() {
  const userData = path.join(process.env.APPDATA || '', 'KnowMe')
  if (!userData || path.basename(userData).toLowerCase() !== 'knowme') {
    throw new Error(`拒绝写入非 KnowMe 用户目录: ${userData}`)
  }
  if (!fs.existsSync(userData)) {
    throw new Error(`KnowMe 用户目录不存在: ${userData}`)
  }

  const bundledRoot = path.resolve(__dirname, '../src/catalog')
  const hub = createCapabilityHubService({
    getUserData: () => userData,
    bundledRoot,
  })

  const results = []
  for (const id of IDS) {
    try {
      const result = await hub.installCapability({
        id,
        enabled: true,
        riskConfirmed: true,
      })
      results.push({
        id,
        ok: result.ok === true,
        code: result.code || null,
        error: result.error || result.message || null,
        version: result.version || result.entry?.version || null,
        source: result.source || null,
        enabled: result.enabled,
        rawKeys: Object.keys(result || {}),
        result,
      })
    } catch (err) {
      results.push({
        id,
        ok: false,
        error: err && err.message ? err.message : String(err),
      })
    }
  }

  const storePath = path.join(userData, 'capabilities', 'install-store.json')
  const store = JSON.parse(fs.readFileSync(storePath, 'utf8'))
  const entries = store.entries || store.items || store
  const summary = IDS.map((id) => {
    const entry =
      (Array.isArray(entries)
        ? entries.find((e) => e && e.id === id)
        : entries && typeof entries === 'object'
          ? entries[id]
          : null) || null
    const install = results.find((r) => r.id === id)
    return {
      id,
      installOk: install?.ok === true,
      installError: install?.ok ? null : install?.error || install?.code || 'failed',
      enabled: entry ? entry.enabled : null,
      version: entry ? entry.version : null,
      source: entry ? entry.source : null,
      storeEntry: entry,
    }
  })

  console.log(JSON.stringify({ userData, bundledRoot, results: summary, installResults: results.map((r) => ({
    id: r.id,
    ok: r.ok,
    code: r.code,
    error: r.error,
    version: r.version,
    source: r.source,
    enabled: r.enabled,
  })) }, null, 2))
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : err)
  process.exit(1)
})
