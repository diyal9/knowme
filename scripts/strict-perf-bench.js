#!/usr/bin/env node
/**
 * 从严性能对照：f6ad048 工作台神文件 vs 当前助理首屏静态 CSS。
 * 不测 Electron 墙钟（噪声大）；可重复、入 evidence。
 */
'use strict'

const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const BASE = 'f6ad048'

function gitBlobSize(ref, file) {
  try {
    const buf = execFileSync('git', ['show', `${ref}:${file}`], {
      cwd: ROOT,
      maxBuffer: 32 * 1024 * 1024,
    })
    return buf.length
  } catch {
    return null
  }
}

function fileSize(rel) {
  const p = path.join(ROOT, rel)
  if (!fs.existsSync(p)) return null
  return fs.statSync(p).size
}

function main() {
  const json = process.argv.includes('--json')
  const before = {
    'src/workspace.html': gitBlobSize(BASE, 'src/workspace.html'),
    'src/workspace-agent.js': gitBlobSize(BASE, 'src/workspace-agent.js'),
  }
  const beforeTotal = Object.values(before).reduce((s, n) => s + (n || 0), 0)
  const afterFiles = [
    'src/renderer/app/tokens.css',
    'src/renderer/styles/workspace-chrome.css',
    'src/renderer/styles/agent-chrome.css',
    'src/renderer/styles/workspace-overlays.css',
    'src/renderer/app/legacy-bridge.css',
    'src/renderer/features/workbench/workbench-chrome.css',
  ]
  const after = {}
  for (const f of afterFiles) after[f] = fileSize(f)
  const afterTotal = Object.values(after).reduce((s, n) => s + (n || 0), 0)
  const report = {
    ok: afterTotal > 0 && beforeTotal > 0 && afterTotal < beforeTotal,
    baseline: BASE,
    before_bytes: beforeTotal,
    after_first_paint_css_bytes: afterTotal,
    ratio: beforeTotal ? Number((afterTotal / beforeTotal).toFixed(4)) : null,
    before,
    after,
    note: 'after = assistant-route static CSS only; JS is code-split. before = HTML god-file + page.',
  }
  if (json) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n')
  } else {
    process.stdout.write(
      `strict-perf-bench: ${report.ok ? 'PASS' : 'FAIL'} before=${beforeTotal} after=${afterTotal} ratio=${report.ratio}\n`,
    )
  }
  process.exit(report.ok ? 0 : 1)
}

if (require.main === module) main()
module.exports = { gitBlobSize }
