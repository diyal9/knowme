import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const repoRoot = path.resolve(import.meta.dirname, '../../..')

function read(rel: string) {
  return readFileSync(path.join(repoRoot, rel), 'utf8')
}

describe('renderer visual system governance', () => {
  it('publishes the complete spacing, density, radius and elevation grammar', () => {
    const tokens = read('src/renderer/app/tokens.css')
    for (const token of [
      '--space-7:',
      '--space-8:',
      '--space-9:',
      '--density-relaxed-gap:',
      '--density-standard-gap:',
      '--density-compact-gap:',
      '--control-xl:',
      '--radius-panel:',
      '--radius-pill:',
      '--radius-circle:',
      '--shadow-rest:',
      '--shadow-raised:',
      '--shadow-overlay:',
    ]) {
      expect(tokens, token).toContain(token)
    }
  })

  it('keeps the checked-in visual entropy budget green', () => {
    const stdout = execFileSync(process.execPath, [
      path.join(repoRoot, 'scripts/audit-renderer-visual-system.js'),
      '--check',
      '--json',
    ], { encoding: 'utf8' })
    const report = JSON.parse(stdout)
    expect(report.budget.ok).toBe(true)
    expect(report.budget.violations).toEqual([])
  })

  it('documents the immutable structure and function boundary', () => {
    const contract = read('docs/visual-system.md')
    expect(contract).toContain('现有导航、页面分区、卡片/侧栏/抽屉关系、控件顺序和业务流程均为冻结基线')
    expect(contract).toContain('功能回归为零、结构差异为零')
  })
})
