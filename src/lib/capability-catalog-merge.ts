'use strict'

const fs = require('fs')
const path = require('path')

function mergeCatalog(bundled, overlay, installStore) {
  const hidden = new Set(overlay.hiddenIds || [])
  const map = new Map()
  const bundledById = new Map((bundled.entries || []).map(entry => [entry.id, entry]))

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
      skills: installed.skills || [],
      connectors: installed.connectors || [],
      knowledgeRefs: installed.knowledgeRefs || [],
      sop: installed.sop || '',
      useCases: installed.useCases || [],
      boundaries: installed.boundaries || [],
      risk: installed.risk || { level: 'low', reasons: [] },
      provenance: installed.provenance || {},
      lifecycle: installed.lifecycle || { state: 'active', newTasks: true, successors: [] },
      catalogLayer: 'installed',
    })
  }
  const merged = []
  for (const entry of map.values()) {
    const installed = installEntries[entry.id]
    // Curated packages are shipped with a current, trusted manifest. An old
    // install record may still contain the previous manifest (for example
    // after a same-version package contract fix), so it must not eclipse the
    // bundled contract. User-owned and linked capabilities retain their own
    // persisted manifest.
    const bundledEntry = bundledById.get(entry.id)
    const currentManifest = installed?.source === 'curated' && bundledEntry?.manifest
      ? bundledEntry.manifest
      : installed?.manifest || entry.manifest || null
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
      manifest: currentManifest,
      dependencies: currentManifest?.dependencies || installed?.dependencies || entry.dependencies || [],
      permissions: currentManifest?.permissions || installed?.permissions || entry.permissions || {},
      inputs: currentManifest?.inputs || installed?.inputs || entry.inputs || [],
      outputs: currentManifest?.outputs || installed?.outputs || entry.outputs || [],
      skills: installed?.skills || entry.skills || [],
      connectors: installed?.connectors || entry.connectors || [],
      knowledgeRefs: currentManifest?.knowledgeRefs || installed?.knowledgeRefs || entry.knowledgeRefs || [],
      sop: currentManifest?.sop || installed?.sop || entry.sop || '',
      useCases: currentManifest?.useCases || installed?.useCases || entry.useCases || [],
      boundaries: currentManifest?.boundaries || installed?.boundaries || entry.boundaries || [],
      risk: currentManifest?.risk || installed?.risk || entry.risk || { level: 'low', reasons: [] },
      provenance: currentManifest?.provenance || installed?.provenance || entry.provenance || {},
      lifecycle: entry.lifecycle || { state: 'active', newTasks: true, successors: [] },
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
