'use strict'

/** 列出 renderer 里指向已删除 DOM 的变量及其引用次数，重构期用来定位僵尸渲染路径。 */

const fs = require('fs')

const js = fs.readFileSync('src/workbench.js', 'utf8')
const html = fs.readFileSync('src/workspace.html', 'utf8')

const bindings = [...js.matchAll(/(el[A-Za-z0-9_]+|btn[A-Za-z0-9_]+)\s*=\s*document\.getElementById\('([^']+)'\)/g)]
  .map(match => ({ variable: match[1], id: match[2] }))
  .filter(entry => !html.includes(`"${entry.id}"`) && !js.includes(`id="${entry.id}"`))

for (const entry of bindings) {
  const uses = (js.match(new RegExp(`\\b${entry.variable}\\b`, 'g')) || []).length
  console.log(`${entry.variable.padEnd(28)}${entry.id.padEnd(26)}${uses}`)
}
console.log(`dead bindings ${bindings.length}`)
