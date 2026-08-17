'use strict'

/**
 * 同页脚本顶层重名检查。
 *
 * 经典 <script> 共享同一个顶层词法作用域：两个文件各自 `const foo` 会让整页
 * 抛 "Identifier 'foo' has already been declared"，且后续脚本全部不执行——
 * 表现是整页白屏或功能静默失效，控制台只有一行 SyntaxError。
 * 这类问题无法靠单元测试发现，所以在 lint 阶段静态拦一道。
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const SRC = path.join(ROOT, 'src')

/**
 * 只看 let / const / class：它们进入全局词法环境，跨脚本重名才会抛错。
 * 顶层 function / var 是 var 作用域（挂全局对象），跨脚本重复声明是合法的，
 * 一并检查会误伤。完整语义由 tests/page-script-scope.test.js 用 V8 实际编译验证。
 */
const DECL_RE = /^(?:const|let|class)\s+([A-Za-z_$][\w$]*)/gm

/**
 * 一个页面里参与同一顶层作用域的所有脚本单元。
 *
 * 内联 <script> 与外部脚本共享同一个作用域，因此必须一起比对——只扫外部文件
 * 会漏掉「外部模块的顶层名撞上页面内联脚本」这一半。
 */
function pageScripts(htmlFile) {
  const html = fs.readFileSync(htmlFile, 'utf8')
  const out = []

  const external = /<script\s+src="([^"]+)"/g
  let m
  while ((m = external.exec(html))) {
    const rel = m[1].split('?')[0]
    if (/^https?:/.test(rel)) continue
    const file = path.join(path.dirname(htmlFile), rel)
    if (!fs.existsSync(file)) continue
    out.push({ label: path.relative(ROOT, file).replace(/\\/g, '/'), code: fs.readFileSync(file, 'utf8') })
  }

  const inline = /<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g
  while ((m = inline.exec(html))) {
    if (m[1].trim()) out.push({ label: `${path.basename(htmlFile)} 内联脚本`, code: m[1] })
  }

  return out
}

/** 只看顶层声明：缩进行必定在函数/块内，不参与顶层作用域 */
function topLevelNames(code) {
  const names = new Set()
  let m
  DECL_RE.lastIndex = 0
  while ((m = DECL_RE.exec(code))) names.add(m[1])
  return names
}

function collectPageHtmlFiles() {
  const pages = []
  if (fs.existsSync(SRC)) {
    for (const file of fs.readdirSync(SRC)) {
      if (file.endsWith('.html')) pages.push(path.join(SRC, file))
    }
  }
  return pages.sort()
}

function run() {
  const pages = collectPageHtmlFiles()
  if (!pages.length) {
    console.log('script-scope ok (no page html to scan)')
    return
  }
  const problems = []
  for (const htmlFile of pages) {
    const owner = new Map()
    for (const { label, code } of pageScripts(htmlFile)) {
      for (const name of topLevelNames(code)) {
        if (owner.has(name)) {
          problems.push(`${path.relative(ROOT, htmlFile)}: 顶层重名 '${name}' — ${owner.get(name)} 与 ${label}`)
        } else {
          owner.set(name, label)
        }
      }
    }
  }
  if (problems.length) {
    for (const line of problems) console.error(`script-scope: ${line}`)
    process.exitCode = 1
    return
  }
  console.log(`script-scope ok (${pages.length} pages)`)
}

run()
