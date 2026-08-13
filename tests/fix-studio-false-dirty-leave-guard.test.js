'use strict'

/**
 * fix-studio-false-dirty-leave-guard — 货架「编辑」误弹离开确认的静态契约。
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const src = path.join(__dirname, '..', 'src')
const workbenchJs = fs.readFileSync(path.join(src, 'workbench.js'), 'utf8')
const modelJs = fs.readFileSync(path.join(src, 'lib', 'workbench-studio-model.js'), 'utf8')

describe('fix-studio-false-dirty-leave-guard', () => {
  it('normalizes free graph for render without forcing dirty', () => {
    assert.ok(modelJs.includes('options.markDirty !== false'), 'ensureFreeGraph accepts markDirty')
    assert.ok(workbenchJs.includes('markDirty: false'), 'board render passes markDirty false')
  })

  it('clears dirty after save before returning to shelf', () => {
    assert.ok(workbenchJs.includes('studioDraft.dirty = false'), 'save path clears dirty')
    const saveIdx = workbenchJs.indexOf("toastFn('已保存到「我的」工作流'")
    const clearIdx = workbenchJs.lastIndexOf('studioDraft.dirty = false', saveIdx)
    assert.ok(clearIdx > 0 && clearIdx < saveIdx, 'dirty cleared before shelf toast')
  })

  it('leave guard ignores start/end-only drafts', () => {
    assert.ok(workbenchJs.includes("node.kind !== 'start' && node.kind !== 'end'"), 'bizNodes filter')
  })

  it('skips noop inline edits and empty inspector sync', () => {
    assert.ok(workbenchJs.includes('失焦未改内容时不得记 dirty'), 'inline noop guard comment')
    assert.ok(workbenchJs.includes("querySelector('[data-studio-workflow-field=\"name\"]')"), 'workflow fields gate')
    assert.ok(workbenchJs.includes('studioIoFingerprint'), 'io fingerprint compare')
    assert.ok(workbenchJs.includes('function leaveStudioToShelf('), 'leave helper')
    assert.ok(workbenchJs.includes('function clearStudioDraftMemory('), 'memory clear helper')
    assert.ok(workbenchJs.includes('clearStudioDraftMemory()'), 'leave clears memory draft')
  })
})
