'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const ROOT = path.join(__dirname, '..')
const SRC = path.join(ROOT, 'src')
const RENDERER = path.join(SRC, 'renderer')

function pageScriptUnits(htmlFile) {
  const html = fs.readFileSync(htmlFile, 'utf8')
  const units = []
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/g
  let m

  while ((m = re.exec(html))) {
    const attrs = m[1]
    if (/\stype="module"/.test(attrs)) continue
    const srcMatch = attrs.match(/\ssrc="([^"]+)"/)

    if (srcMatch) {
      const rel = srcMatch[1].split('?')[0]
      if (/^https?:/.test(rel)) continue
      const file = path.join(path.dirname(htmlFile), rel)
      if (!fs.existsSync(file)) continue
      if (rel.includes('vendor/')) continue
      units.push({ label: rel, code: fs.readFileSync(file, 'utf8') })
    } else if (m[2].trim()) {
      units.push({ label: `${path.basename(htmlFile)} 内联`, code: m[2] })
    }
  }

  return units
}

function collectClassicHtmlFiles() {
  const pages = []
  if (fs.existsSync(SRC)) {
    for (const file of fs.readdirSync(SRC)) {
      if (file.endsWith('.html')) pages.push(path.join(SRC, file))
    }
  }
  return pages.sort()
}

const pages = collectClassicHtmlFiles()

describe('页面脚本顶层作用域', () => {
  it('经典 html 壳（非 Vite module）可扫描', () => {
    assert.ok(pages.length > 0, '应能找到 src/*.html')
    const counts = pages.map(p => pageScriptUnits(p).length)
    assert.ok(counts.every(n => n > 0), `每页至少一个脚本单元，实际 ${JSON.stringify(counts)}`)
  })

  it('renderer 入口使用 type=module，不再拼进同一经典作用域', () => {
    const entries = fs.readdirSync(RENDERER)
      .map((name) => path.join(RENDERER, name, 'index.html'))
      .filter((html) => fs.existsSync(html))
    assert.ok(entries.length >= 4, 'workspace/settings/memory/log-viewer')
    for (const html of entries) {
      const text = fs.readFileSync(html, 'utf8')
      assert.match(text, /type="module"/)
    }
  })

  for (const htmlFile of pages) {
    const label = path.relative(ROOT, htmlFile).replace(/\\/g, '/')
    it(`${label}：所有经典脚本可共存于同一顶层作用域`, () => {
      const units = pageScriptUnits(htmlFile)
      const combined = units.map(u => `// ---- ${u.label} ----\n${u.code}`).join('\n;\n')
      try {
        new vm.Script(combined, { filename: `${label}#combined` })
      } catch (err) {
        const hint = /already been declared/.test(err.message)
          ? '\n同页脚本顶层重名会让整页解析失败。把模块包进 IIFE，或改名。'
          : ''
        assert.fail(`${label} 脚本无法共存：${err.message}${hint}\n加载顺序：${units.map(u => u.label).join(' → ')}`)
      }
    })
  }
})

describe('共享模块不污染页面顶层作用域', () => {
  for (const mod of ['ui-kit.ts', 'markdown-lite.ts']) {
    it(`${mod} 不引入任何顶层标识符`, () => {
      const code = fs.readFileSync(path.join(SRC, 'lib', mod), 'utf8')
      assert.doesNotThrow(
        () => new vm.Script(`${code}\n;\n${code}`, { filename: mod }),
        `${mod} 有顶层声明泄露到共享作用域，应包进 IIFE`,
      )
    })
  }
})
