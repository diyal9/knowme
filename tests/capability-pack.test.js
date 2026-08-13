const fs = require('fs')
const os = require('os')
const path = require('path')
const { describe, it, before } = require('node:test')
const assert = require('node:assert')
const { createCapabilityPackRuntime } = require('../src/lib/capability-pack-runtime')
const { validatePackManifest } = require('../src/lib/capability-pack-schema')

describe('capability pack schema', () => {
  it('validates game-studio manifest', () => {
    const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/packs/game-studio/pack.json'), 'utf8'))
    const result = validatePackManifest(raw)
    assert.equal(result.ok, true)
    assert.equal(result.manifest.id, 'game-studio')
  })

  it('rejects invalid pack id', () => {
    const result = validatePackManifest({ schemaVersion: 1, id: 'Bad_ID', version: '1.0.0', name: 'x', description: 'y' })
    assert.equal(result.ok, false)
  })
})

describe('capability pack runtime', () => {
  it('discovers bundled packs without install', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-pack-disc-'))
    const rt = createCapabilityPackRuntime({ userData: tmpDir })
    const packs = rt.discoverPacks()
    assert.ok(packs.some(p => p.id === 'game-studio'))
    assert.ok(packs.some(p => p.id === 'office-partner'))
    const game = packs.find(p => p.id === 'game-studio')
    assert.equal(game.enabled, false)
    assert.ok(game.capabilityDependencies.some(dep => dep.id === 'game-studio-partner' && dep.kind === 'expert'))
    assert.equal(game.provenance.adaptedFrom, 'pack.json')
  })

  it('installs game pack without empty-state UI scenes (office pack owns connectors)', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-pack-game-'))
    const rt = createCapabilityPackRuntime({ userData: tmpDir })
    const installed = rt.installPack('game-studio', 'bundled')
    assert.equal(installed.ok, true)
    const scenes = rt.listScenesForUi('game-studio')
    assert.equal(scenes.length, 0)
  })

  it('installs office-partner pack with today priority and feishu empty-state scenes', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-pack-office-'))
    const rt = createCapabilityPackRuntime({ userData: tmpDir })
    const installed = rt.installPack('office-partner', 'bundled')
    assert.equal(installed.ok, true)
    const scenes = rt.listScenesForUi('office-partner')
    assert.equal(scenes.length, 4)
    assert.deepEqual(scenes.map(s => s.id), [
      'feishu-today-priority',
      'feishu-docs',
      'feishu-meeting',
      'feishu-chats',
    ])
  })

  it('ensureDefaultPacks enables game-studio and office-partner', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-pack-defaults-'))
    const rt = createCapabilityPackRuntime({ userData: tmpDir })
    const ensured = rt.ensureDefaultPacks()
    assert.equal(ensured.ok, true)
    assert.ok(rt.isPackEnabled('game-studio'))
    assert.ok(rt.isPackEnabled('office-partner'))
  })

  it('ensureDefaultPacks installs pack-declared experts via hook', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-pack-experts-'))
    const installed = []
    const rt = createCapabilityPackRuntime({
      userData: tmpDir,
      ensureExpertInstalled: (expertId) => {
        installed.push(expertId)
        const dir = path.join(tmpDir, 'capabilities', 'experts', expertId)
        fs.mkdirSync(dir, { recursive: true })
        fs.writeFileSync(path.join(dir, 'EXPERT.md'), `---\nname: ${expertId}\n---\n`, 'utf8')
        return { ok: true, status: 'installed', expertId }
      },
    })
    const ensured = rt.ensureDefaultPacks()
    assert.equal(ensured.ok, true)
    assert.ok(installed.includes('game-studio-partner'))
    assert.ok(installed.includes('office-partner'))
    assert.ok(fs.existsSync(path.join(tmpDir, 'capabilities', 'experts', 'game-studio-partner', 'EXPERT.md')))
  })

  it('already-enabled pack still backfills missing expert on ensureDefaultPacks', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-pack-backfill-'))
    const rt1 = createCapabilityPackRuntime({ userData: tmpDir })
    assert.equal(rt1.installPack('game-studio', 'bundled').ok, true)
    const installed = []
    const rt2 = createCapabilityPackRuntime({
      userData: tmpDir,
      ensureExpertInstalled: (expertId) => {
        installed.push(expertId)
        return { ok: true, status: 'installed', expertId }
      },
    })
    assert.ok(rt2.isPackEnabled('game-studio'))
    const ensured = rt2.ensureDefaultPacks()
    assert.equal(ensured.ok, true)
    assert.ok(installed.includes('game-studio-partner'))
    const gameResult = (ensured.results || []).find((item) => item.packId === 'game-studio')
    assert.equal(gameResult?.expert?.expertId, 'game-studio-partner')
  })

  it('blocks path traversal for pack files', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-pack-traversal-'))
    const rt = createCapabilityPackRuntime({ userData: tmpDir })
    rt.installPack('game-studio', 'bundled')
    const bad = rt.readPackFile('game-studio', '../../../package.json')
    assert.equal(bad.ok, false)
  })

  it('installs third-party example pack without core changes', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-pack-third-'))
    const rt = createCapabilityPackRuntime({ userData: tmpDir })
    const src = path.join(__dirname, '../src/packs/example-minimal')
    const installed = rt.installFromDirectory(src)
    assert.equal(installed.ok, true)
    const groups = rt.listEmptyStateGroups()
    assert.ok(groups.some(g => g.packId === 'example-minimal'))
  })

  it('uses unified atomic dependencies when an availability registry is provided', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-pack-deps-'))
    const rt = createCapabilityPackRuntime({
      userData: tmpDir,
      getAvailableCapabilityManifests: () => [],
    })
    const installed = rt.installPack('game-studio', 'bundled')
    assert.equal(installed.ok, false)
    assert.equal(installed.code, 'dependency_conflict')
    assert.match(installed.error, /game-studio-partner/)
  })

  it('disable pack removes empty state scenes', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-pack-disable-'))
    const rt = createCapabilityPackRuntime({ userData: tmpDir })
    rt.installPack('office-partner', 'bundled')
    assert.ok(rt.listEmptyStateGroups().length > 0)
    rt.disablePack('office-partner')
    assert.equal(rt.listEmptyStateGroups().filter(g => g.packId === 'office-partner').length, 0)
  })

  it('loads requirement schema from game pack', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-pack-req-'))
    const rt = createCapabilityPackRuntime({ userData: tmpDir })
    rt.installPack('game-studio', 'bundled')
    const schema = rt.getRequirementSchema('game-studio')
    assert.ok(schema.sections.some(s => s.key === 'acceptance'))
  })

  it('preserves bundledCapabilities.catalogRoot in schema', () => {
    const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/packs/game-studio/pack.json'), 'utf8'))
    const result = validatePackManifest(raw)
    assert.equal(result.manifest.bundledCapabilities.catalogRoot, '../../catalog')
  })

  it('lists enabled pack skill sources from trusted catalog', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-pack-skills-'))
    const rt = createCapabilityPackRuntime({ userData: tmpDir })
    rt.installPack('game-studio', 'bundled')
    const payload = rt.listSkillSources()
    assert.ok(payload.sources.some(src => src.id === 'game-requirement-doc'))
    assert.equal(payload.sources[0].ownerPackId, 'game-studio')
    assert.ok(payload.sources[0].contentHash)
  })

  it('blocks imported pack when catalog root escapes pack directory', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-pack-import-escape-'))
    const src = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-pack-src-escape-'))
    const packDir = path.join(src, 'escape-pack')
    fs.mkdirSync(packDir, { recursive: true })
    fs.writeFileSync(path.join(packDir, 'pack.json'), JSON.stringify({
      schemaVersion: 1,
      id: 'escape-pack',
      name: 'Escape Pack',
      description: 'catalog escape test',
      version: '0.1.0',
      skills: ['demo-skill'],
      scenes: [],
      bundledCapabilities: { catalogRoot: '../../catalog' },
    }, null, 2), 'utf8')
    const rt = createCapabilityPackRuntime({ userData: tmpDir })
    const installed = rt.installFromDirectory(packDir)
    assert.equal(installed.ok, false)
    assert.match(installed.error, /越界|缺少|无效|catalog/i)
  })

  it('validates missing bundled skill on enable', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-pack-missing-skill-'))
    const src = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-pack-src-missing-'))
    const packDir = path.join(src, 'missing-skill-pack')
    const catalogDir = path.join(packDir, 'catalog')
    fs.mkdirSync(path.join(catalogDir, 'skills'), { recursive: true })
    fs.writeFileSync(path.join(packDir, 'pack.json'), JSON.stringify({
      schemaVersion: 1,
      id: 'missing-skill-pack',
      name: 'Missing Skill Pack',
      description: 'missing skill test',
      version: '0.1.0',
      skills: ['ghost-skill'],
      scenes: [],
      bundledCapabilities: { catalogRoot: 'catalog' },
    }, null, 2), 'utf8')
    const rt = createCapabilityPackRuntime({ userData: tmpDir })
    const installed = rt.installFromDirectory(packDir)
    assert.equal(installed.ok, false)
    assert.equal(installed.code, 'missing_pack_skill')
  })

  it('legacy scene-only pack installs without catalog skills', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-pack-legacy-'))
    const rt = createCapabilityPackRuntime({ userData: tmpDir })
    const installed = rt.installFromDirectory(path.join(__dirname, '../src/packs/example-minimal'))
    assert.equal(installed.ok, true)
    const payload = rt.listSkillSources()
    assert.equal(payload.sources.length, 0)
    assert.ok(rt.listEmptyStateGroups().some(g => g.packId === 'example-minimal'))
  })

  it('disable pack removes pack skill sources', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-pack-disable-skills-'))
    const rt = createCapabilityPackRuntime({ userData: tmpDir })
    rt.installPack('game-studio', 'bundled')
    assert.ok(rt.listSkillSources().sources.length > 0)
    rt.disablePack('game-studio')
    assert.equal(rt.listSkillSources().sources.length, 0)
  })

  it('resolvePackFile rejects traversal after guard fix', () => {
    const { resolvePackFile } = require('../src/lib/capability-pack-store')
    const packRoot = path.join(__dirname, '../src/packs/game-studio')
    assert.equal(resolvePackFile(packRoot, '../../../package.json'), null)
    assert.ok(resolvePackFile(packRoot, 'pack.json'))
  })

  it('rejects traversal pack ids without deleting sibling user data', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-pack-id-guard-'))
    const victim = path.join(tmpDir, 'victim')
    fs.mkdirSync(victim, { recursive: true })
    fs.writeFileSync(path.join(victim, 'keep.txt'), 'keep', 'utf8')
    const rt = createCapabilityPackRuntime({ userData: tmpDir })

    const removed = rt.uninstallPack('../../victim')

    assert.equal(removed.ok, false)
    assert.equal(removed.code, 'invalid_pack_id')
    assert.equal(fs.readFileSync(path.join(victim, 'keep.txt'), 'utf8'), 'keep')
  })

  it('keeps the prior installed pack when safe copy fails', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-pack-tx-'))
    const rt = createCapabilityPackRuntime({ userData: tmpDir })
    const source = path.join(__dirname, '../src/packs/example-minimal')
    const first = rt.installFromDirectory(source)
    assert.equal(first.ok, true)
    const installedManifest = path.join(
      tmpDir,
      'capability-packs',
      'installed',
      'example-minimal',
      'pack.json',
    )
    const before = fs.readFileSync(installedManifest, 'utf8')
    const linkRoot = path.join(tmpDir, 'linked-source')
    fs.symlinkSync(source, linkRoot, 'junction')

    const update = rt.installFromDirectory(linkRoot)

    assert.equal(update.ok, false)
    assert.equal(update.code, 'pack_copy_failed')
    assert.equal(fs.readFileSync(installedManifest, 'utf8'), before)
    assert.equal(rt.discoverPacks().find(pack => pack.id === 'example-minimal')?.enabled, true)
  })
})
