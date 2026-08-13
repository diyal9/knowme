'use strict'

/**
 * keep-studio-after-toolbar-save + fix-studio-back-to-workflow-manage
 * — 工具栏保存不得切面；显式离开按来源回管理/货架。
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const workbenchJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'workbench.js'), 'utf8')

function extractFunction(source, name) {
  const asyncStart = source.indexOf(`async function ${name}(`)
  const syncStart = source.indexOf(`function ${name}(`)
  const start = asyncStart >= 0 ? asyncStart : syncStart
  assert.ok(start >= 0, `missing ${name}`)
  const sigEnd = source.indexOf(')', start)
  assert.ok(sigEnd >= 0, `missing ) for ${name}`)
  let i = source.indexOf('{', sigEnd)
  assert.ok(i >= 0, `missing body for ${name}`)
  let depth = 0
  for (; i < source.length; i += 1) {
    const ch = source[i]
    if (ch === '{') depth += 1
    else if (ch === '}') {
      depth -= 1
      if (depth === 0) return source.slice(start, i + 1)
    }
  }
  throw new Error(`unclosed ${name}`)
}

describe('keep-studio-after-toolbar-save', () => {
  it('saveStudioWorkflow does not navigate to shelf', () => {
    const body = extractFunction(workbenchJs, 'saveStudioWorkflow')
    assert.ok(!/setSurface\(\s*['"]shelf['"]/.test(body), 'toolbar save must stay on studio')
    assert.ok(body.includes("toastFn('已保存到「我的」工作流'"), 'still toasts success')
    assert.ok(body.includes('studioDraft.dirty = false'), 'clears dirty after save')
  })

  it('leaveStudioToShelf restores by origin (default manage)', () => {
    const body = extractFunction(workbenchJs, 'leaveStudioToShelf')
    assert.ok(body.includes('clearStudioDraftMemory()'), 'clears draft memory on leave')
    assert.ok(body.includes("openManagePanel(target.managePanel || 'workflows')"), 'manage origin returns to workflow manage')
    assert.ok(/setSurface\(\s*['"]shelf['"]/.test(body), 'shelf origin can still return to shelf')
  })
})

describe('fix-studio-back-to-workflow-manage', () => {
  it('openOrchestration captures studioReturnState before entering studio', () => {
    const body = extractFunction(workbenchJs, 'openOrchestration')
    assert.ok(body.includes('studioReturnState'), 'captures return state')
    assert.ok(body.includes("surface: 'shelf'"), 'shelf origin recorded')
    assert.ok(body.includes("surface: 'manage'"), 'manage origin recorded')
    assert.ok(body.includes("managePanel: 'workflows'"), 'manage panel is workflows')
  })

  it('syncHeadActionButton labels back for manage by default', () => {
    const body = extractFunction(workbenchJs, 'syncHeadActionButton')
    assert.ok(body.includes('返回管理工作流'), 'manage back label')
    assert.ok(body.includes('返回工作流'), 'shelf back label retained')
  })
})
