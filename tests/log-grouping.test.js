'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { groupLogEntries, summarizeRun, roundOf } = require('../src/lib/log-grouping')

/** 构造一条日志（时间由秒偏移决定，模拟同一天内的顺序）。 */
function entry(sec, overrides = {}) {
  const ts = new Date(Date.UTC(2026, 6, 30, 12, 0, sec)).toISOString()
  return {
    ts,
    level: 'info',
    category: 'llm',
    event: 'llm-request',
    msg: '请求模型',
    scope: 'ai-generate',
    ...overrides,
    meta: { model: 'gpt-4o', ...(overrides.meta || {}) },
  }
}

// 日志查询返回的是时间倒序，测试数据按此构造
function descending(entries) {
  return [...entries].sort((a, b) => String(b.ts).localeCompare(String(a.ts)))
}

test('同一 runId 的多轮日志合并为一组', () => {
  const list = descending([
    entry(1, { runId: 'run-a', meta: { round: 1 } }),
    entry(2, { runId: 'run-a', event: 'llm-response', meta: { round: 1 } }),
    entry(3, { runId: 'run-a', meta: { round: 2 } }),
    entry(9, { runId: 'run-a', event: 'llm-response', meta: { round: 2 }, durationMs: 4961 }),
  ])
  const items = groupLogEntries(list)
  assert.strictEqual(items.length, 1)
  assert.strictEqual(items[0].type, 'group')
  assert.strictEqual(items[0].runId, 'run-a')
  assert.strictEqual(items[0].entries.length, 4)
  assert.strictEqual(items[0].summary.rounds, 2)
  assert.strictEqual(items[0].summary.count, 4)
  assert.strictEqual(items[0].summary.model, 'gpt-4o')
  assert.strictEqual(items[0].summary.spanMs, 8000)
})

test('组内条目按时间正序排列', () => {
  const list = descending([
    entry(1, { runId: 'run-a', meta: { round: 1 } }),
    entry(5, { runId: 'run-a', meta: { round: 2 } }),
    entry(3, { runId: 'run-a', meta: { round: 1 } }),
  ])
  const [group] = groupLogEntries(list)
  const rounds = group.entries.map(e => roundOf(e))
  assert.deepStrictEqual(rounds, [1, 1, 2])
})

test('无 runId 或单条 runId 保持平铺', () => {
  const list = descending([
    entry(1, { runId: 'run-a' }),
    entry(2, { runId: '', category: 'system', event: 'app-start' }),
    entry(3, { runId: 'run-b' }),
    entry(4, { runId: 'run-b' }),
  ])
  const items = groupLogEntries(list)
  const types = items.map(i => i.type)
  assert.strictEqual(items.length, 3)
  assert.strictEqual(types.filter(t => t === 'group').length, 1)
  assert.strictEqual(types.filter(t => t === 'entry').length, 2)
})

test('分组位置由该组最新条目决定', () => {
  const list = descending([
    entry(1, { runId: 'run-a' }),
    entry(2, { runId: 'run-a' }),
    entry(8, { runId: '', event: 'note-save', category: 'operation' }),
  ])
  const items = groupLogEntries(list)
  assert.strictEqual(items[0].type, 'entry')
  assert.strictEqual(items[0].entry.event, 'note-save')
  assert.strictEqual(items[1].type, 'group')
})

test('关闭合并时逐条平铺', () => {
  const list = descending([
    entry(1, { runId: 'run-a' }),
    entry(2, { runId: 'run-a' }),
    entry(3, { runId: 'run-a' }),
  ])
  const items = groupLogEntries(list, { enabled: false })
  assert.strictEqual(items.length, 3)
  assert.ok(items.every(i => i.type === 'entry'))
})

test('汇总取组内最高级别并统计告警数', () => {
  const summary = summarizeRun([
    entry(1, { runId: 'run-a', meta: { round: 1 } }),
    entry(2, { runId: 'run-a', level: 'warn', meta: { round: 1 } }),
    entry(3, { runId: 'run-a', level: 'error', event: 'llm-error', meta: { round: 2 } }),
  ])
  assert.strictEqual(summary.level, 'error')
  assert.strictEqual(summary.warnCount, 1)
  assert.strictEqual(summary.errorCount, 1)
  assert.strictEqual(summary.title, 'AI 对话')
})

test('筛选后只剩单轮时轮次数随之收敛', () => {
  const summary = summarizeRun([
    entry(4, { runId: 'run-a', meta: { round: 2 } }),
    entry(9, { runId: 'run-a', event: 'llm-response', meta: { round: 2 } }),
  ])
  assert.strictEqual(summary.rounds, 1)
  assert.strictEqual(summary.count, 2)
})

test('缺少 round 元数据时按 llm-request 条数推算轮次', () => {
  const summary = summarizeRun([
    entry(1, { runId: 'run-a', meta: {} }),
    entry(2, { runId: 'run-a', event: 'llm-response', meta: {} }),
    entry(3, { runId: 'run-a', meta: {} }),
  ])
  assert.strictEqual(summary.rounds, 2)
})

test('跨类别同 runId 也会合并并记录类别', () => {
  const list = descending([
    entry(1, { runId: 'run-a', category: 'system-prompt', event: 'prompt-built' }),
    entry(2, { runId: 'run-a', category: 'llm' }),
    entry(3, { runId: 'run-a', category: 'mcp', event: 'tool-call' }),
  ])
  const [group] = groupLogEntries(list)
  assert.deepStrictEqual(group.summary.categories, ['system-prompt', 'llm', 'mcp'])
})

test('空输入与非数组输入安全返回', () => {
  assert.deepStrictEqual(groupLogEntries([]), [])
  assert.deepStrictEqual(groupLogEntries(null), [])
  assert.strictEqual(summarizeRun(null).count, 0)
})
