#!/usr/bin/env node
/**
 * 守卫：签字面主 CTA 禁止跨层硬编码 accent。
 * 壳层炭黑 #3d3a36 不得作为工作台/货架/管线 primary 填充；
 * 工作台绿 #2f6f5e 不得作为设置 primary 填充。
 */
'use strict'

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const SHELL_HEX = '#3d3a36'
const WB_HEX = '#2f6f5e'
const WB_HEX_BAD = '#2f6fed'

/** @type {{ file: string, kind: string, line: number, snippet: string }[]} */
const findings = []

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (/\.css$/i.test(name)) out.push(p)
  }
  return out
}

function rel(p) {
  return path.relative(ROOT, p).replace(/\\/g, '/')
}

function scanFile(file) {
  const text = fs.readFileSync(file, 'utf8')
  const lines = text.split(/\r?\n/)
  const r = rel(file)
  const isWorkbench = /workbench|shelf|console|capability-hub|manage|studio|run\//i.test(r)
  const isSettings = /settings\.css$/i.test(r)

  lines.forEach((line, idx) => {
    const n = idx + 1
    const trim = line.trim()
    if (!trim || trim.startsWith('/*') || trim.startsWith('*')) return

    if (isWorkbench && /\.primary\b/.test(line) && line.toLowerCase().includes(SHELL_HEX)) {
      if (/background|border-color/.test(line)) {
        findings.push({ file: r, kind: 'workbench-primary-shell-hex', line: n, snippet: trim })
      }
    }
    if (isSettings && /\.primary\b/.test(line) && line.toLowerCase().includes(WB_HEX)) {
      if (/background|border-color/.test(line)) {
        findings.push({ file: r, kind: 'settings-primary-wb-hex', line: n, snippet: trim })
      }
    }
    if (line.toLowerCase().includes(WB_HEX_BAD)) {
      findings.push({ file: r, kind: 'wb-accent-typo-blue', line: n, snippet: trim })
    }
  })
}

const cssRoots = [
  path.join(ROOT, 'src', 'renderer', 'features'),
  path.join(ROOT, 'src', 'renderer', 'styles'),
  path.join(ROOT, 'src', 'renderer', 'app'),
]

for (const root of cssRoots) {
  for (const file of walk(root)) scanFile(file)
}

const blocking = findings.filter((f) => f.kind !== 'advisory')
const ok = blocking.length === 0

const report = {
  ok,
  checkedAt: new Date().toISOString(),
  shellHex: SHELL_HEX,
  workbenchHex: WB_HEX,
  findings,
}

if (require.main === module) {
  const asJson = process.argv.includes('--json')
  if (asJson) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  } else if (!ok) {
    console.error('ui accent token guard FAILED:')
    for (const f of findings) {
      console.error(`  [${f.kind}] ${f.file}:${f.line}  ${f.snippet}`)
    }
    process.exit(1)
  } else {
    console.log(`ui accent token guard ok (${findings.length} finding(s))`)
  }
}

module.exports = { scanFile, findings, report, SHELL_HEX, WB_HEX }
