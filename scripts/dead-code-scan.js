'use strict'

/**
 * 扫描（可选删除）单文件里定义后再无调用点的函数。
 * 重构期用来清理僵尸代码：node scripts/dead-code-scan.js tests/fixtures/legacy-pages/workbench.js [--fix]
 */

const fs = require('fs')
const path = require('path')

const target = process.argv[2] || path.join('tests', 'fixtures', 'legacy-pages', 'workbench.js')
const fix = process.argv.includes('--fix')

function declarations(source) {
  return [...source.matchAll(/^([ \t]*)(?:async\s+)?function ([A-Za-z0-9_$]+)\s*\(/gm)].map(match => ({
    name: match[2],
    start: match.index,
  }))
}

function unusedNames(source) {
  return declarations(source)
    .filter(entry => (source.match(new RegExp(`\\b${entry.name}\\b`, 'g')) || []).length <= 1)
    .map(entry => entry.name)
}

// 参数列表里可能出现解构默认值（entry = {}），必须先跨过整个括号再定位函数体
function bodyStart(source, from) {
  let depth = 0
  for (let cursor = source.indexOf('(', from); cursor < source.length; cursor += 1) {
    const char = source[cursor]
    if (char === '(') depth += 1
    else if (char === ')') {
      depth -= 1
      if (depth === 0) return source.indexOf('{', cursor)
    }
  }
  return -1
}

function cut(source, name) {
  const entry = declarations(source).find(item => item.name === name)
  if (!entry) return source
  let depth = 0
  const index = bodyStart(source, entry.start)
  if (index < 0) return source
  for (let cursor = index; cursor < source.length; cursor += 1) {
    const char = source[cursor]
    if (char === '{') depth += 1
    else if (char === '}') {
      depth -= 1
      if (depth === 0) {
        let end = cursor + 1
        while (source[end] === '\n' || source[end] === '\r') end += 1
        return source.slice(0, entry.start) + source.slice(end)
      }
    }
  }
  return source
}

let source = fs.readFileSync(target, 'utf8')
const removed = []
if (fix) {
  for (let round = 0; round < 20; round += 1) {
    const names = unusedNames(source)
    if (!names.length) break
    names.forEach(name => {
      source = cut(source, name)
      removed.push(name)
    })
  }
  fs.writeFileSync(target, source)
}

const remaining = unusedNames(source)
if (removed.length) console.log('removed:\n' + removed.join('\n'))
if (remaining.length) console.log('unused:\n' + remaining.join('\n'))
console.log(`functions ${declarations(source).length} · removed ${removed.length} · unused ${remaining.length}`)
