'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

/**
 * 用真实的 V8 编译器验证每个页面的脚本能共存。
 *
 * 经典 <script> 的顶层 let/const/class 进入全局词法环境，第二个脚本声明同名标识符时
 * 会在实例化阶段抛 SyntaxError，且该脚本及其后所有脚本都不执行——线上表现是整页白屏
 * 或功能静默失效，控制台只有一行错误。
 *
 * 把一个页面的所有脚本单元按加载顺序拼起来编译，能精确复现这套语义：
 * 两个 `function foo` 合法（var 作用域，挂全局对象），两个 `const foo` 非法。
 * 这比按正则数声明名字准确——正则无法区分这两种情况。
 *
 * 只编译不执行，因此不需要 DOM 环境。
 */

const SRC = path.join(__dirname, '..', 'src')

/** 按加载顺序取出页面的脚本单元：外部文件 + 内联块 */
function pageScriptUnits(htmlFile) {
  const html = fs.readFileSync(htmlFile, 'utf8')
  const units = []
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/g
  let m

  while ((m = re.exec(html))) {
    const attrs = m[1]
    const srcMatch = attrs.match(/\ssrc="([^"]+)"/)

    if (srcMatch) {
      const rel = srcMatch[1].split('?')[0]
      if (/^https?:/.test(rel)) continue
      const file = path.join(path.dirname(htmlFile), rel)
      if (!fs.existsSync(file)) continue
      // 第三方打包产物（marked / DOMPurify）不是本仓库维护的代码，跳过
      if (rel.includes('vendor/')) continue
      units.push({ label: rel, code: fs.readFileSync(file, 'utf8') })
    } else if (m[2].trim() && !/\stype="(?!text\/javascript)/.test(attrs)) {
      units.push({ label: `${path.basename(htmlFile)} 内联`, code: m[2] })
    }
  }

  return units
}

const pages = fs.readdirSync(SRC).filter(f => f.endsWith('.html'))

describe('页面脚本顶层作用域', () => {
  it('每个页面都有脚本被扫描到（防止匹配逻辑失效后静默通过）', () => {
    const counts = pages.map(p => pageScriptUnits(path.join(SRC, p)).length)
    assert.ok(pages.length > 0, '应能找到页面')
    assert.ok(counts.every(n => n > 0), `每页至少一个脚本单元，实际 ${JSON.stringify(counts)}`)
  })

  for (const page of pages) {
    it(`${page}：所有脚本可共存于同一顶层作用域`, () => {
      const units = pageScriptUnits(path.join(SRC, page))
      const combined = units.map(u => `// ---- ${u.label} ----\n${u.code}`).join('\n;\n')

      try {
        new vm.Script(combined, { filename: `${page}#combined` })
      } catch (err) {
        const hint = /already been declared/.test(err.message)
          ? '\n同页脚本顶层重名会让整页解析失败。把模块包进 IIFE，或改名。'
          : ''
        assert.fail(`${page} 脚本无法共存：${err.message}${hint}\n加载顺序：${units.map(u => u.label).join(' → ')}`)
      }
    })
  }
})

describe('共享模块不污染页面顶层作用域', () => {
  for (const mod of ['ui-kit.js', 'markdown-lite.js']) {
    it(`${mod} 不引入任何顶层标识符`, () => {
      const code = fs.readFileSync(path.join(SRC, 'lib', mod), 'utf8')
      // 与自身拼接：若有顶层 let/const/class 泄露，重复声明会立刻暴露
      assert.doesNotThrow(
        () => new vm.Script(`${code}\n;\n${code}`, { filename: mod }),
        `${mod} 有顶层声明泄露到共享作用域，应包进 IIFE`,
      )
    })
  }
})
