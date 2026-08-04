const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const {
  IDLE_MIN_MS,
  IDLE_MAX_MS,
  PRESENCE_STORAGE_KEY,
  classifyInputState,
  nextIdleDelay,
  createPresenceController,
} = require('../src/lib/agent-presence')

function fakeClassList() {
  const values = new Set()
  return {
    add: value => values.add(value),
    remove: value => values.delete(value),
    contains: value => values.has(value),
    toggle: (value, force) => {
      const next = force === undefined ? !values.has(value) : force
      if (next) values.add(value)
      else values.delete(value)
      return next
    },
  }
}

function fakeElement() {
  const attrs = {}
  return {
    classList: fakeClassList(),
    dataset: {},
    offsetWidth: 1,
    setAttribute(name, value) { attrs[name] = String(value) },
    getAttribute(name) { return attrs[name] },
  }
}

describe('agent presence', () => {
  it('classifies interaction signals without claiming emotion detection', () => {
    assert.equal(classifyInputState(''), 'idle')
    assert.equal(classifyInputState('我正在整理方案'), 'typing')
    assert.equal(classifyInputState('这里卡住了，刚刚还报错'), 'calm-support')
    assert.equal(classifyInputState('焦虑'), 'calm-support')
  })

  it('keeps idle motion in the configured low-frequency range', () => {
    assert.equal(nextIdleDelay(() => 0), IDLE_MIN_MS)
    assert.equal(nextIdleDelay(() => 1), IDLE_MAX_MS)
    assert.ok(nextIdleDelay(() => 0.5) > IDLE_MIN_MS)
  })

  it('persists the disabled state and stops future presence states', () => {
    const store = new Map()
    const storage = {
      getItem: key => store.get(key) || null,
      setItem: (key, value) => store.set(key, value),
    }
    const root = fakeElement()
    const button = fakeElement()
    const timers = []
    const controller = createPresenceController({
      root,
      button,
      storage,
      random: () => 0,
      setTimeoutFn: callback => {
        timers.push(callback)
        return timers.length
      },
      clearTimeoutFn: () => {},
      reducedMotion: () => false,
    })

    assert.equal(controller.enabled, true)
    controller.setEnabled(false)
    assert.equal(store.get(PRESENCE_STORAGE_KEY), '0')
    assert.equal(controller.state, 'disabled')
    assert.equal(root.dataset.presenceState, 'disabled')
    assert.equal(controller.setState('thinking'), 'disabled')
    assert.equal(controller.state, 'disabled')
    controller.destroy()
  })
})
