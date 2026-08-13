'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const { normalizeAttentionPayload, daemonAttentionId } = require('../src/lib/attention-payload')

describe('attention payload', () => {
  it('normalizes required fields and clamps urgency', () => {
    const item = normalizeAttentionPayload({
      id: 'daemon:abc:gate:n1',
      title: '任务标题',
      body: '请审批',
      urgency: 'input',
      deepLink: { type: 'daemon-task', slug: 'abc' },
    })
    assert.equal(item.id, 'daemon:abc:gate:n1')
    assert.equal(item.urgency, 'input')
    assert.equal(item.deepLink.slug, 'abc')
    assert.equal(item.avatarText, '任')
  })

  it('rejects empty id', () => {
    assert.equal(normalizeAttentionPayload({ title: 'x' }), null)
  })

  it('builds stable daemon attention ids', () => {
    assert.equal(daemonAttentionId('s1', 'gate', 'n'), 'daemon:s1:gate:n')
  })
})

describe('attention ipc module', () => {
  it('registers attention notify handlers', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'ipc', 'attention-notify.js'), 'utf8')
    assert.ok(src.includes("ipcMain.handle('attention-notify'"))
    assert.ok(src.includes('showDesktopToast'))
    assert.ok(src.includes('workspaceForeground'))
  })

  it('ships a desktop toast page', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'attention-toast.html'), 'utf8')
    assert.ok(html.includes('class="card"'))
    assert.ok(html.includes('id="title"'))
    assert.ok(html.includes('attentionToastActivate'))
  })
})
