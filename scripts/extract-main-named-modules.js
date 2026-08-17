'use strict'

/**
 * One-shot: merge src/main/part-*.ts into named attach() modules.
 * Run from repo root. Safe to re-run only before part-* are deleted.
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const MAIN = path.join(ROOT, 'src', 'main')

function stripPartPreamble(src) {
  return src
    .replace(/^'use strict'\s*\r?\n/, '')
    .replace(/^const scope = require\('\.\/scope'\)\s*\r?\n/, '')
}

function readPart(n) {
  const id = String(n).padStart(2, '0')
  return stripPartPreamble(fs.readFileSync(path.join(MAIN, `part-${id}.ts`), 'utf8'))
}

function writeModule(name, header, partNums) {
  const body = partNums.map(readPart).join('\n')
  const text = [
    "'use strict'",
    '',
    header,
    '',
    'function attach(scope) {',
    body.replace(/\s+$/, ''),
    '}',
    '',
    'module.exports = { attach }',
    '',
  ].join('\n')
  fs.writeFileSync(path.join(MAIN, name), text)
  console.log('wrote', name, 'lines', text.split(/\n/).length)
}

writeModule(
  'boot.ts',
  [
    '/**',
    ' * 主进程启动：Electron/userData、lib 绑定、数据路径与 Hub 工厂。',
    ' * 不负责开窗或 IPC 注册。',
    ' */',
  ].join('\n'),
  [1],
)

writeModule(
  'agent-runtime.ts',
  [
    '/**',
    ' * 本机专家团队运行时、Agent Package 解析与会话 store。',
    ' * 不负责 BrowserWindow。',
    ' */',
  ].join('\n'),
  [2, 3],
)

writeModule(
  'shell.ts',
  [
    '/**',
    ' * 图标、窗口句柄、便签兼容 stub、工作台/设置/记忆/日志窗。',
    ' * 不负责知识检索或 Agent 循环。',
    ' */',
  ].join('\n'),
  [4, 5, 6, 7, 8],
)

writeModule(
  'knowledge.ts',
  [
    '/**',
    ' * 内容源、语义索引、Fabric 上下文与 LLM Provider 解析。',
    ' * 不负责开窗。',
    ' */',
  ].join('\n'),
  [9, 10, 11],
)

writeModule(
  'workbench.ts',
  [
    '/**',
    ' * 工作台货架/mode、管线投影、app ready 与进程守卫。',
    ' * 不负责渲染层 UI。',
    ' */',
  ].join('\n'),
  [12, 13, 14],
)
