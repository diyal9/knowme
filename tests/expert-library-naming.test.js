'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')

const src = path.join(__dirname, '..', 'src')

describe('Agent center naming', () => {
  const railTs = fs.readFileSync(path.join(src, 'domain', 'rail.ts'), 'utf8')
  const sideRail = fs.readFileSync(path.join(src, 'renderer', 'app', 'SideRail.tsx'), 'utf8')
  const hubSurface = fs.readFileSync(path.join(src, 'renderer', 'features', 'capability-hub', 'CapabilityHubSurface.tsx'), 'utf8')

  it('rail and hub chrome use 能力中心', () => {
    assert.match(railTs, /label: '能力中心'/)
    assert.match(sideRail, /capabilities/)
    assert.match(hubSurface, /能力中心/)
    assert.match(hubSurface, /hub-tab/)
  })

  it('user-facing module names avoid 能力 Hub', () => {
    assert.ok(!hubSurface.includes('能力 Hub'))
    assert.ok(!railTs.includes('能力 Hub'))
  })
})
