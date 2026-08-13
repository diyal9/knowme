'use strict'

const { describe, it, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const store = require('../src/lib/workbench-mode-store')

describe('workbench-mode-store', () => {
  let userData
  let file

  beforeEach(() => {
    userData = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-mode-store-'))
    file = path.join(userData, 'workbench-modes.json')
  })

  afterEach(() => {
    fs.rmSync(userData, { recursive: true, force: true })
  })

  function createStore(overrides = {}) {
    return store.createStore({ userData, file, ...overrides })
  }

  it('defaults to office mode with three built-in modes on first launch', () => {
    const s = createStore()
    const dto = s.list()

    assert.equal(dto.ok, true)
    assert.equal(dto.activeModeId, 'office')
    assert.equal(dto.modes.length, 3)
    assert.deepEqual(dto.modes.map((item) => item.id), ['office', 'engineering', 'visual'])
    assert.equal(dto.degraded, false)
    assert.equal(fs.existsSync(file), false)
  })

  it('materializes built-in roles and engineering daemon projection', () => {
    const s = createStore({
      daemonProjector: () => ({ online: true }),
    })
    const engineering = s.list().modes.find((item) => item.id === 'engineering')

    assert.ok(engineering)
    assert.deepEqual(
      engineering.suggestedRoles.map((role) => role.id),
      ['product', 'developer', 'tester'],
    )
    assert.equal(engineering.suggestedRoles[0].source, 'builtin')
    assert.equal(engineering.suggestedRoles[0].removable, false)
    assert.equal(engineering.providers[0].status, 'available')
    assert.equal(engineering.professionalCapabilities[0].status, 'available')
  })

  it('selects a mode and persists activeModeId atomically', () => {
    const s = createStore()
    const selected = s.select('engineering')

    assert.equal(selected.ok, true)
    assert.equal(selected.alreadySelected, false)
    assert.equal(selected.activeModeId, 'engineering')
    assert.ok(fs.existsSync(file))

    const raw = fs.readFileSync(file, 'utf8')
    assert.doesNotMatch(raw, /\.tmp/)
    assert.match(raw, /"activeModeId": "engineering"/)

    const reloaded = createStore()
    assert.equal(reloaded.list().activeModeId, 'engineering')
  })

  it('select is idempotent for the active mode', () => {
    const s = createStore()
    s.select('visual')
    const again = s.select('visual')

    assert.equal(again.ok, true)
    assert.equal(again.alreadySelected, true)
    assert.equal(again.activeModeId, 'visual')
  })

  it('binds and unbinds experts for the active mode', () => {
    const s = createStore({
      catalogProjector: (expertIds) => {
        const map = new Map()
        for (const expertId of expertIds) {
          map.set(expertId, {
            label: '会议纪要助手',
            status: 'available',
            description: '整理会议结论与待办',
          })
        }
        return map
      },
    })

    const bound = s.bindExpert('meeting-notes')
    assert.equal(bound.ok, true)
    assert.equal(bound.alreadyBound, false)
    assert.equal(bound.modeId, 'office')

    const office = bound.modes.find((item) => item.id === 'office')
    assert.equal(office.bindings.length, 1)
    assert.equal(office.bindings[0].expertId, 'meeting-notes')
    assert.equal(office.bindings[0].label, '会议纪要助手')
    assert.equal(office.bindings[0].source, 'user')
    assert.equal(office.bindings[0].removable, true)

    const removed = s.unbindExpert('meeting-notes')
    assert.equal(removed.ok, true)
    assert.equal(removed.modes.find((item) => item.id === 'office').bindings.length, 0)
  })

  it('unbindExpertEverywhere removes binding from every mode and is idempotent when absent', () => {
    const s = createStore()
    s.select('office')
    s.bindExpert('ghost-expert')
    s.select('engineering')
    s.bindExpert('ghost-expert')
    s.select('visual')
    s.bindExpert('ghost-expert')

    const cleared = s.unbindExpertEverywhere('ghost-expert')
    assert.equal(cleared.ok, true)
    assert.equal(cleared.unbound, true)
    assert.deepEqual(cleared.removedFrom.slice().sort(), ['engineering', 'office', 'visual'])
    for (const mode of cleared.modes) {
      assert.equal(
        (mode.bindings || []).some(item => item.expertId === 'ghost-expert'),
        false,
      )
    }

    const again = s.unbindExpertEverywhere('ghost-expert')
    assert.equal(again.ok, true)
    assert.equal(again.unbound, false)
    assert.deepEqual(again.removedFrom, [])
  })

  it('duplicate bind is idempotent and does not create duplicates', () => {
    const s = createStore()
    s.bindExpert('writing-polish')
    const again = s.bindExpert('writing-polish')

    assert.equal(again.ok, true)
    assert.equal(again.alreadyBound, true)

    const office = again.modes.find((item) => item.id === 'office')
    assert.equal(office.bindings.length, 1)

    const persisted = JSON.parse(fs.readFileSync(file, 'utf8'))
    assert.equal(persisted.bindings.office.length, 1)
  })

  it('rejects invalid mode and expert identifiers without mutating disk', () => {
    const s = createStore()
    s.select('office')

    const badMode = s.select('marketing')
    assert.equal(badMode.ok, false)
    assert.match(badMode.error, /未知的工作模式/)

    const badExpert = s.bindExpert('../escape')
    assert.equal(badExpert.ok, false)
    assert.match(badExpert.error, /Expert 标识/)

    assert.equal(fs.existsSync(file), false)
  })

  it('enforces max 32 bindings per mode', () => {
    const s = createStore()
    s.select('office')

    for (let i = 0; i < store.MAX_BINDINGS_PER_MODE; i += 1) {
      const result = s.bindExpert(`expert-${i}`)
      assert.equal(result.ok, true)
    }

    const overflow = s.bindExpert('expert-overflow')
    assert.equal(overflow.ok, false)
    assert.match(overflow.error, /最多绑定 32/)
    assert.equal(s.load().bindings.office.length, store.MAX_BINDINGS_PER_MODE)
  })

  it('falls back safely when persisted state is corrupt or unknown', () => {
    fs.writeFileSync(file, '{not-json', 'utf8')
    let s = createStore()
    let dto = s.list()
    assert.equal(dto.activeModeId, 'office')
    assert.equal(dto.degraded, true)
    assert.match(fs.readFileSync(file, 'utf8'), /not-json/)

    fs.writeFileSync(file, JSON.stringify({
      version: 99,
      activeModeId: 'engineering',
      bindings: { office: [{ expertId: 'x', addedAt: '2026-01-01T00:00:00.000Z' }] },
    }, null, 2), 'utf8')

    s = createStore()
    dto = s.list()
    assert.equal(dto.activeModeId, 'office')
    assert.equal(dto.degraded, true)
    assert.equal(dto.modes.find((item) => item.id === 'office').bindings.length, 0)
  })

  it('normalizes unknown active mode without overwriting corrupt file until a valid write', () => {
    fs.writeFileSync(file, JSON.stringify({
      version: 1,
      activeModeId: 'unknown-mode',
      bindings: {},
      updatedAt: '2026-01-01T00:00:00.000Z',
    }, null, 2), 'utf8')

    const s = createStore()
    const before = fs.readFileSync(file, 'utf8')
    const dto = s.list()
    assert.equal(dto.activeModeId, 'office')
    assert.equal(dto.degraded, true)
    assert.equal(fs.readFileSync(file, 'utf8'), before)

    s.select('visual')
    const after = JSON.parse(fs.readFileSync(file, 'utf8'))
    assert.equal(after.activeModeId, 'visual')
    assert.equal(after.version, store.STORE_VERSION)
  })

  it('protects built-in roles from bind and unbind', () => {
    const s = createStore()
    s.select('engineering')

    const bindBuiltin = s.bindExpert('developer')
    assert.equal(bindBuiltin.ok, false)
    assert.match(bindBuiltin.error, /内置角色/)

    const unbindBuiltin = s.unbindExpert('tester')
    assert.equal(unbindBuiltin.ok, false)
    assert.match(unbindBuiltin.error, /内置角色/)
  })

  it('projects disabled or missing experts without dropping bindings', () => {
    const s = createStore({
      catalogProjector: (expertIds) => {
        const map = new Map()
        for (const expertId of expertIds) {
          map.set(expertId, {
            label: expertId === 'disabled-one' ? '已禁用专家' : '缺失专家',
            status: expertId === 'disabled-one' ? 'disabled' : 'missing',
            description: '占位说明',
          })
        }
        return map
      },
    })

    s.bindExpert('disabled-one')
    s.bindExpert('missing-one')

    const office = s.list().modes.find((item) => item.id === 'office')
    assert.equal(office.bindings.length, 2)
    assert.equal(office.bindings[0].status, 'disabled')
    assert.equal(office.bindings[1].status, 'missing')
  })

  it('retries transient Windows rename locks with a finite bound', () => {
    let attempts = 0
    const result = store.renameWithRetrySync('tmp', 'store', {
      retries: 3,
      delays: [0],
      renameSync: () => {
        attempts += 1
        if (attempts < 3) {
          const error = new Error('locked')
          error.code = 'EPERM'
          throw error
        }
      },
    })

    assert.equal(result.ok, true)
    assert.equal(result.attempts, 3)
    assert.equal(attempts, 3)
  })

  it('keeps bindings isolated per mode', () => {
    const s = createStore()
    s.bindExpert('office-only', { modeId: 'office' })
    s.bindExpert('engineering-only', { modeId: 'engineering' })

    const dto = s.list()
    assert.equal(dto.modes.find((item) => item.id === 'office').bindings.length, 1)
    assert.equal(dto.modes.find((item) => item.id === 'engineering').bindings.length, 1)

    s.select('engineering')
    s.unbindExpert('engineering-only')
    const after = s.list()
    assert.equal(after.modes.find((item) => item.id === 'engineering').bindings.length, 0)
    assert.equal(after.modes.find((item) => item.id === 'office').bindings.length, 1)
  })
})
