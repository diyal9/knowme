/**
 * 设置 → 关于：开发者图标入口与版权
 */
const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')

describe('about-developer-info', () => {
  const settingsHtml = fs.readFileSync(path.join(__dirname, '..', 'src', 'settings.html'), 'utf8')
  const preload = fs.readFileSync(path.join(__dirname, '..', 'src', 'preload.js'), 'utf8')
  const main = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8')
  const icons = fs.readFileSync(path.join(__dirname, '..', 'src', 'ui-icons.js'), 'utf8')

  it('about panel has icon buttons and copyright', () => {
    assert.ok(settingsHtml.includes('btnAboutBlog'), 'blog button')
    assert.ok(settingsHtml.includes('btnAboutCoffee'), 'coffee button')
    assert.ok(!settingsHtml.includes('btnAboutWechat'), 'no standalone wechat button')
    assert.ok(settingsHtml.includes('btnAboutMail'), 'mail button')
    assert.ok(settingsHtml.includes('https://diyal9.github.io/tcloudblog/'), 'blog url')
    assert.ok(settingsHtml.includes('diyalyin'), 'wechat id via coffee')
    assert.ok(settingsHtml.includes('670924505@qq.com'), 'email')
    assert.ok(settingsHtml.includes('© 2026 KnowMe · diyal9'), 'copyright')
  })

  it('exposes openExternal with protocol guard', () => {
    assert.ok(preload.includes('openExternal:'), 'preload API')
    assert.ok(main.includes("ipcMain.handle('open-external'"), 'main handler')
    assert.ok(main.includes('mailto:'), 'mailto allowed')
  })

  it('registers coffee/mail icons', () => {
    assert.ok(icons.includes('coffee:'), 'coffee icon')
    assert.ok(icons.includes('mail:'), 'mail icon')
  })
})
