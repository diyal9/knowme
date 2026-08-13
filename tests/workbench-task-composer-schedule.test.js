const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')

const {
  COPY,
  DEFAULT_SCHEDULE,
  buildTaskScheduleTooltip,
  readTaskComposerSchedule,
  syncTaskComposerScheduleFields,
  resetTaskComposerSchedule,
} = require('../src/lib/workbench-task-composer-schedule')

function mockMask(fields = {}) {
  const nodes = new Map(Object.entries(fields).map(([id, spec]) => {
    const el = {
      id,
      value: spec.value ?? '',
      checked: spec.checked ?? false,
      hidden: spec.hidden ?? false,
      getAttribute: name => (name === 'data-composer-schedule' ? spec.scheduleType || '' : ''),
      setAttribute: () => {},
    }
    return [id, el]
  }))
  const scheduleRows = (fields.__scheduleRows || []).map((scheduleType, i) => ({
    hidden: true,
    getAttribute: name => (name === 'data-composer-schedule' ? scheduleType : ''),
  }))
  return {
    querySelector(sel) {
      const m = sel.match(/#([\w-]+)/)
      return m ? nodes.get(m[1]) || null : null
    },
    querySelectorAll(sel) {
      if (sel === '[data-composer-schedule]') return scheduleRows
      return []
    },
  }
}

describe('workbench-task-composer-schedule', () => {
  it('exports boundary copy constants', () => {
    assert.match(COPY.toggleHint, /不会无人值守/)
    assert.match(COPY.fieldsNote, /关闭或退出/)
    assert.match(COPY.automationListHint, /草稿/)
  })

  it('buildTaskScheduleTooltip includes plan, online, and non-unattended hints', () => {
    const tip = buildTaskScheduleTooltip({
      scheduleEnabled: true,
      scheduleLabel: '每天 09:00',
      nextRunAt: '2099-01-01T09:00:00.000Z',
    })
    assert.match(tip, /已设定时/)
    assert.match(tip, /每天 09:00/)
    assert.match(tip, /需 App 在线/)
    assert.match(tip, /非无人值守/)
  })

  it('readTaskComposerSchedule returns disabled defaults when unchecked', () => {
    const mask = mockMask({
      wbTaskComposerScheduleEnabled: { checked: false },
      wbTaskComposerScheduleType: { value: 'daily' },
    })
    const out = readTaskComposerSchedule(mask)
    assert.equal(out.scheduleEnabled, false)
    assert.deepEqual(out.schedule, { ...DEFAULT_SCHEDULE })
  })

  it('readTaskComposerSchedule validates once schedule time', () => {
    const mask = mockMask({
      wbTaskComposerScheduleEnabled: { checked: true },
      wbTaskComposerScheduleType: { value: 'once' },
      wbTaskComposerOnceAt: { value: '' },
    })
    const out = readTaskComposerSchedule(mask)
    assert.equal(out.error, '请填写单次执行时间')
  })

  it('sync and reset toggle field visibility', () => {
    const mask = mockMask({
      wbTaskComposerScheduleEnabled: { checked: true },
      wbTaskComposerScheduleFields: { hidden: true },
      wbTaskComposerScheduleNote: { hidden: true },
      wbTaskComposerScheduleType: { value: 'daily' },
      wbTaskComposerDailyTime: { value: '09:00' },
      wbTaskComposerIntervalValue: { value: '24' },
      wbTaskComposerIntervalUnit: { value: 'hour' },
      wbTaskComposerOnceAt: { value: '' },
      __scheduleRows: ['daily', 'interval'],
    })
    syncTaskComposerScheduleFields(mask)
    assert.equal(mask.querySelector('#wbTaskComposerScheduleFields').hidden, false)
    resetTaskComposerSchedule(mask)
    assert.equal(mask.querySelector('#wbTaskComposerScheduleEnabled').checked, false)
    assert.equal(mask.querySelector('#wbTaskComposerScheduleFields').hidden, true)
  })

  it('workbench loads lib and keeps thin wrappers', () => {
    const workbench = fs.readFileSync(path.join(__dirname, '..', 'src', 'workbench.js'), 'utf8')
    const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace.html'), 'utf8')
    assert.ok(html.includes('workbench-task-composer-schedule.js'), 'workspace includes schedule lib')
    assert.ok(workbench.includes('WorkbenchTaskComposerSchedule'), 'workbench delegates to lib')
    assert.ok(workbench.includes('function readTaskComposerSchedule'), 'thin wrapper retained for contracts')
    assert.match(workbench, /不会无人值守代发消息|WorkbenchTaskComposerSchedule\.COPY/)
  })
})
