const { describe, it } = require('node:test')
const assert = require('node:assert')
const {
  normalizeSchedule,
  scheduleToLabel,
  computeNextRunAt,
  listDue,
  advanceAfterFire,
  isDueTask,
} = require('../src/lib/workbench-task-scheduler')

describe('workbench-task-scheduler', () => {
  it('normalizes schedule types and labels', () => {
    assert.equal(normalizeSchedule({ type: 'daily', dailyTime: '09:30' }).dailyTime, '09:30')
    assert.equal(scheduleToLabel({ type: 'daily', dailyTime: '09:30' }), '每天 09:30')
    assert.equal(scheduleToLabel({ type: 'interval', intervalValue: 2, intervalUnit: 'day' }), '每 2 天')
    assert.match(scheduleToLabel({ type: 'once', onceAt: '2099-01-01T10:00:00.000Z' }), /单次/)
  })

  it('computes next daily run after current time', () => {
    const now = new Date('2026-08-12T10:00:00.000Z')
    const next = computeNextRunAt({ type: 'daily', dailyTime: '09:00' }, true, now)
    assert.ok(Date.parse(next) > now.getTime())
  })

  it('lists due parent tasks only', () => {
    const now = new Date('2026-08-12T12:00:00.000Z')
    const tasks = [
      {
        id: 'parent',
        scheduleEnabled: true,
        nextRunAt: '2026-08-12T11:00:00.000Z',
        scheduleParentId: '',
      },
      {
        id: 'child',
        scheduleEnabled: true,
        nextRunAt: '2026-08-12T11:00:00.000Z',
        scheduleParentId: 'parent',
      },
      {
        id: 'future',
        scheduleEnabled: true,
        nextRunAt: '2026-08-12T13:00:00.000Z',
        scheduleParentId: '',
      },
      {
        id: 'off',
        scheduleEnabled: false,
        nextRunAt: '2026-08-12T11:00:00.000Z',
        scheduleParentId: '',
      },
    ]
    const due = listDue(tasks, now)
    assert.deepEqual(due.map(item => item.id), ['parent'])
    assert.equal(isDueTask(tasks[1], now), false)
  })

  it('advances daily and disables once after fire', () => {
    const now = new Date('2026-08-12T12:00:00.000Z')
    const daily = advanceAfterFire({
      id: 'd1',
      schedule: { type: 'daily', dailyTime: '09:00' },
      scheduleEnabled: true,
    }, now)
    assert.equal(daily.scheduleEnabled, true)
    assert.ok(Date.parse(daily.nextRunAt) > now.getTime())
    assert.equal(daily.lastScheduledAt, now.toISOString())

    const once = advanceAfterFire({
      id: 'o1',
      schedule: { type: 'once', onceAt: '2026-08-12T11:00:00.000Z' },
      scheduleEnabled: true,
      nextRunAt: '2026-08-12T11:00:00.000Z',
    }, now)
    assert.equal(once.scheduleEnabled, false)
    assert.equal(once.nextRunAt, '')
  })
})
