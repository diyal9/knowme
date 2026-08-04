'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')

describe('workbench automation Feishu push targets', () => {
  it('uses Feishu-native target copy for push options', () => {
    const script = fs.readFileSync(path.join(__dirname, '..', 'src', 'workbench.js'), 'utf8')
    assert.match(script, /推送到飞书个人会话/)
    assert.match(script, /推送到飞书群会话/)
    assert.doesNotMatch(script, /WorkBuddy 微信小程序/)
    assert.doesNotMatch(script, /自动化企微通知 bot/)
  })
})
