'use strict'

const fs = require('fs')
const path = require('path')

function mergeCatalog(bundled, overlay, installStore) {
  const hidden = new Set(overlay.hiddenIds || [])
  const map = new Map()

  for (const entry of bundled.entries) {
    if (hidden.has(entry.id)) continue
    map.set(entry.id, { ...entry, catalogLayer: 'bundled' })
  }

  for (const entry of Object.values(overlay.entries || {})) {
    if (hidden.has(entry.id)) {
      map.delete(entry.id)
      continue
    }
    const base = map.get(entry.id)
    map.set(entry.id, {
      ...(base || {}),
      ...entry,
      catalogLayer: base ? 'overlay' : 'user',
    })
  }

  const installEntries = installStore?.entries || {}
  for (const installed of Object.values(installEntries)) {
    if (map.has(installed.id) || ['removed', 'failed', 'available'].includes(installed.status)) continue
    map.set(installed.id, {
      id: installed.id,
      kind: installed.kind,
      name: installed.name || installed.id,
      originName: installed.originName || '',
      nameSource: installed.nameSource || '',
      description: installed.description || '',
      version: installed.version || '1.0.0',
      source: installed.source || 'local',
      trust: installed.trust || 'unknown',
      categories: [],
      tags: installed.repositoryId ? ['Cursor'] : [],
      featured: false,
      bundlePath: '',
      contentHash: installed.contentHash || '',
      manifest: installed.manifest || null,
      dependencies: installed.dependencies || [],
      permissions: installed.permissions || {},
      inputs: installed.inputs || [],
      outputs: installed.outputs || [],
      risk: installed.risk || { level: 'low', reasons: [] },
      provenance: installed.provenance || {},
      catalogLayer: 'installed',
    })
  }
  const merged = []
  for (const entry of map.values()) {
    const installed = installEntries[entry.id]
    const sourceAvailable = !installed?.linked || (
      installed.originRoot
      && installed.originPath
      && fs.existsSync(path.resolve(installed.originRoot, installed.originPath))
    )
    merged.push({
      ...entry,
      name: installed?.name || entry.name,
      originName: installed?.originName || entry.originName || '',
      nameSource: installed?.nameSource || entry.nameSource || '',
      manifest: installed?.manifest || entry.manifest || null,
      dependencies: installed?.manifest?.dependencies || installed?.dependencies || entry.manifest?.dependencies || entry.dependencies || [],
      permissions: installed?.manifest?.permissions || installed?.permissions || entry.manifest?.permissions || entry.permissions || {},
      inputs: installed?.manifest?.inputs || installed?.inputs || entry.manifest?.inputs || entry.inputs || [],
      outputs: installed?.manifest?.outputs || installed?.outputs || entry.manifest?.outputs || entry.outputs || [],
      risk: installed?.manifest?.risk || installed?.risk || entry.manifest?.risk || entry.risk || { level: 'low', reasons: [] },
      provenance: installed?.manifest?.provenance || installed?.provenance || entry.manifest?.provenance || entry.provenance || {},
      installed: Boolean(installed),
      enabled: installed ? installed.enabled !== false : false,
      installStatus: installed?.status || 'available',
      installedVersion: installed?.version || '',
      installedHash: installed?.contentHash || '',
      installedAt: installed?.installedAt || '',
      sourceAvailable,
      repositoryId: installed?.repositoryId || '',
    })
  }

  merged.sort((a, b) => {
    if (a.featured !== b.featured) return a.featured ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  return merged
}

module.exports = {
  mergeCatalog,
}
