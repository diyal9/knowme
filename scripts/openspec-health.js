#!/usr/bin/env node
/**
 * OpenSpec 活跃 change 健康检查：缺 qa-plan / code-review / evidence / acceptance。
 */
'use strict'

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const CHANGES = path.join(ROOT, 'openspec', 'changes')

function listActive() {
  if (!fs.existsSync(CHANGES)) return []
  return fs.readdirSync(CHANGES, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== 'archive')
    .filter((d) => !fs.existsSync(path.join(CHANGES, d.name, '.archived')))
    .map((d) => d.name)
    .sort()
}

function missing(name, file) {
  return !fs.existsSync(path.join(CHANGES, name, file))
}

function main() {
  const json = process.argv.includes('--json')
  const active = listActive()
  const report = {
    ok: true,
    active_count: active.length,
    missing_qa_plan: active.filter((n) => missing(n, 'qa-plan.md')),
    missing_code_review: active.filter((n) => missing(n, 'code-review.md')),
    missing_evidence: active.filter((n) => !fs.existsSync(path.join(CHANGES, n, 'evidence'))),
    missing_acceptance: active.filter((n) => missing(n, 'acceptance.md')),
    hint: 'gate 软项请用 --change <name> 或 OPENSPEC_CHANGE；全量健康检查用本脚本',
  }
  report.ok = report.missing_qa_plan.length === 0 && report.missing_code_review.length === 0
  report.hint = report.active_count > 12
    ? `active ${report.active_count} > 12；归档已完成 change。gate 软项请用 --change`
    : 'gate 软项请用 --change <name> 或 OPENSPEC_CHANGE；全量健康检查用本脚本'
  if (json) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n')
  } else {
    const lines = [
      `OpenSpec health: ${report.ok ? 'OK' : 'NEEDS ATTENTION'}`,
      `  active: ${report.active_count}`,
      `  no qa-plan: ${report.missing_qa_plan.length}`,
      `  no code-review: ${report.missing_code_review.length}`,
      `  no evidence: ${report.missing_evidence.length}`,
      `  no acceptance: ${report.missing_acceptance.length}`,
    ]
    process.stdout.write(lines.join('\n') + '\n')
  }
  process.exit(report.ok ? 0 : 1)
}

if (require.main === module) main()
module.exports = { listActive }
