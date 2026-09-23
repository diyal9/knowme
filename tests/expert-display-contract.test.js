const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { validateAndNormalizeManifest, serializeSidecar } = require('../src/lib/capability-manifest-v2')
const { parseExpertWorkbenchDetail } = require('../src/domain/expert-workbench-detail')
const { createExpertRuntime, buildRouteReadiness } = require('../src/lib/expert-runtime')
const { mapCatalogItemToHub } = require('../src/lib/capability-hub/map')
const { importFromFolder } = require('../src/lib/capability-import')

const root = path.join(__dirname, '../src/catalog/experts')
const activeExpertIds = new Set(JSON.parse(fs.readFileSync(path.join(__dirname, '../src/catalog/catalog.json'), 'utf8'))
  .entries.filter(entry => entry.kind === 'expert')
  .map(entry => entry.id))
const manifest = routes => ({ schemaVersion: 3, id: 'display-example', kind: 'expert', name: '导入专家', version: '1.0.0', metadata: { knowme: { execution: { routes } } } })

describe('expert display contract at authoring and import boundaries', () => {
  it('projects every real bundled route consistently without IDs or silent truncation', () => {
    let count = 0
    for (const directory of fs.readdirSync(root)) {
      if (!activeExpertIds.has(directory)) continue
      const file = path.join(root, directory, 'capability.manifest.json')
      if (!fs.existsSync(file)) continue
      const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
      const declared = raw.metadata?.knowme?.execution?.routes || []
      const normalized = validateAndNormalizeManifest(raw)
      assert.equal(normalized.ok, true, JSON.stringify(normalized.issues))
      for (const source of [raw, normalized.manifest]) {
        const view = parseExpertWorkbenchDetail({ capabilityManifest: source }, raw)
        const readiness = buildRouteReadiness({ capabilityManifest: source })
        assert.equal(view.routes.length, declared.length, raw.id)
        view.routes.forEach((route, index) => {
          assert.notEqual(route.label, route.id, `${raw.id}/${route.id}`)
          assert.match(route.label, /[\u4e00-\u9fff]/)
          assert.equal(route.label, readiness[index].label)
          assert.equal(route.id, declared[index].id)
        })
      }
      count += declared.length
    }
    assert.ok(count >= 7)
  })

  it('normalizes legacy labels idempotently while preserving custom labels and execution fields', () => {
    const raw = manifest([{ id: 'custom-one', description: '检查合同条款', requiredTools: ['read_file'] }, { id: 'custom-two', label: 'Contract Review' }, { id: 'custom-three', label: '  ' }])
    const result = validateAndNormalizeManifest(raw)
    assert.equal(result.ok, true)
    const routes = result.manifest.metadata.knowme.execution.routes
    assert.deepEqual(routes.map(r => r.label), ['检查合同条款', 'Contract Review', '协作方式 3'])
    assert.deepEqual(routes[0].requiredTools, ['read_file'])
    assert.equal(raw.metadata.knowme.execution.routes[0].label, undefined)
    const serialized = serializeSidecar(result.manifest)
    assert.equal(serialized.ok, true)
    assert.deepEqual(JSON.parse(serialized.content), result.manifest)
    assert.equal(validateAndNormalizeManifest(result.manifest).warnings.length, 0)
  })

  it('rejects malformed and duplicate route identities before installation', () => {
    for (const routes of [{}, [{ id: '' }], [{ id: 'same' }, { id: 'same' }], [null]]) {
      const result = validateAndNormalizeManifest(manifest(routes))
      assert.equal(result.ok, false)
      assert.ok(result.issues.some(issue => /expert_route/.test(issue.code)))
    }
  })

  it('retains assembly when a new expert is saved and projected to the hub', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-display-create-'))
    const runtime = createExpertRuntime({ capabilitiesRoot: directory })
    const saved = runtime.saveExpert('display-new', { name: '新建专家', description: '整理资料', systemPrompt: '依据用户提供的材料整理结论。', skills: ['code-review'], connectors: ['feishu'] })
    assert.equal(saved.ok, true, JSON.stringify(saved))
    const loaded = runtime.loadExpert('display-new')
    assert.equal(loaded.ok, true)
    const hub = mapCatalogItemToHub({ ...loaded, kind: 'expert', manifest: loaded.capabilityManifest })
    assert.deepEqual(hub.skills, ['code-review'])
    assert.deepEqual(hub.connectors, ['feishu'])
  })

  it('persists normalized names through a real folder import', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-display-import-'))
    const folder = path.join(directory, 'incoming')
    fs.mkdirSync(folder)
    fs.writeFileSync(path.join(folder, 'EXPERT.md'), '---\nname: 导入专家\ndescription: 整理资料\nsystemPrompt: 依据用户材料整理结论。\n---\n')
    fs.writeFileSync(path.join(folder, 'manifest.json'), JSON.stringify({ id: 'display-example', kind: 'expert', version: '1.0.0' }))
    fs.writeFileSync(path.join(folder, 'capability.manifest.json'), JSON.stringify(manifest([{ id: 'contract-review', description: '合同条款审查' }])))
    const result = importFromFolder(directory, folder, { trustConfirmed: true, id: 'display-example' })
    assert.equal(result.ok, true, JSON.stringify(result))
    const runtime = createExpertRuntime({ capabilitiesRoot: path.join(directory, 'capabilities') })
    const loaded = runtime.loadExpert('display-example')
    assert.equal(loaded.ok, true, JSON.stringify(loaded))
    const routes = loaded.capabilityManifest.metadata.knowme.execution.routes
    assert.equal(routes[0].label, '合同条款审查')
    assert.equal(parseExpertWorkbenchDetail(loaded, { id: 'display-example', name: '导入专家' }).routes[0].label, '合同条款审查')
  })
})
