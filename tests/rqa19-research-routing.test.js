'use strict'

// Offline reproduction from frozen model-input fields only. Tool records below
// are inert descriptions: no handler, model, network, app or profile is used.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const routing = require('../src/lib/research-routing')
const fixturePath = path.join(__dirname, '../openspec/changes/production-qualify-all-experts/evidence/rqa19-professional-cases.json')
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'))
const webRecords = [{
  type: 'function',
  function: { name: 'search_web', description: 'Search public web pages', parameters: { type: 'object', properties: {} } },
  _knowme: { research: { kind: 'web-search', scope: 'public', preferred: true } },
}]
const existingResearchFrame = Object.freeze({
  workflowId: 'realtime-public-research',
  requiredTools: ['search_web'],
  requiredEvidence: [{ kind: 'tool_result', tool: 'search_web', minChars: 40, forbidTruncated: false }],
  completionConditions: [{ type: 'tool_success', tool: 'search_web' }],
})
const assembledInput = row => [
  row.goal,
  ...row.materials.map(material => `[${material.id}]\n${material.text}`),
  row.request,
  fixture.execution_contract.common_input_suffix,
].join('\n\n')

test('RQA19 fixture contains the frozen six cases and explicit offline instructions', () => {
  assert.equal(fixture.frozen, true)
  assert.deepEqual(fixture.cases.map(row => row.id), ['CS-N01', 'CS-H02', 'CD-N01', 'CD-H02', 'DA-N01', 'DA-H02'])
  assert.match(fixture.execution_contract.common_input_suffix, /不联网/)
  assert.match(fixture.execution_contract.common_input_suffix, /允许但不要求平台当前已授权的纯计算工具/)
  // Assert only assembly, not model quality. Gold assertions/critical failures
  // are never appended to model input or consulted by the routing oracle.
  for (const row of fixture.cases) assert.ok(assembledInput(row).endsWith(fixture.execution_contract.common_input_suffix))
})

for (const id of ['CS-N01', 'CS-H02', 'CD-N01', 'CD-H02']) {
  const row = fixture.cases.find(item => item.id === id)
  const full = assembledInput(row)
  // Full original assignment as displayPrompt reproduces formal runs whose
  // brief.goal contains the submitted assignment. No expert-ID input to router.
  const selected = routing.selectResearchPrompt({ prompt: full, displayPrompt: full })

  test(`RQA19 ${id}: supplied offline materials are not a fresh-web research request`, () => {
    assert.equal(routing.classifyResearchIntent(selected).active, false)
  })

  test(`RQA19 ${id}: projected search availability cannot manufacture a task obligation`, () => {
    const route = routing.buildResearchRoute({ prompt: selected, toolRecords: webRecords })
    assert.equal(route.taskFrame, null, 'no required search receipt for a supplied-materials task')
    assert.equal(route.active, false)
    assert.equal(route.context, '')
  })

  test(`RQA19 ${id}: retry/follow-up clears old generic research frame`, () => {
    assert.equal(routing.reconcileResearchTaskFrame(existingResearchFrame, selected), null)
  })
}

for (const id of ['DA-N01', 'DA-H02']) {
  test(`RQA19 ${id}: same frozen offline contract must not acquire web requirements`, () => {
    const full = assembledInput(fixture.cases.find(row => row.id === id))
    const selected = routing.selectResearchPrompt({ prompt: full, displayPrompt: full })
    const route = routing.buildResearchRoute({ prompt: selected, toolRecords: webRecords })
    assert.equal(route.taskFrame, null)
    assert.equal(route.active, false)
  })
}

for (const [label, prompt] of [
  ['explicit no internet with freshness words', '请只分析已提供的本周市场公告，不联网、不检索外部信息，给出文案方案。'],
  ['pure material editing with current/publication words', '依据下列已提供的材料，整理当前公告的发布文案；这是编辑任务，不需要补充外部事实。'],
  ['offline restriction beyond old 800-character window', '请整理本周公告发布计划。' + '以下均为已提供的合成材料。'.repeat(70) + '\n只分析上述材料，不联网、不搜索。'],
]) {
  test(`RQA19 respects task intent: ${label}`, () => {
    const selected = routing.selectResearchPrompt({ prompt, displayPrompt: prompt })
    assert.equal(routing.buildResearchRoute({ prompt: selected, toolRecords: webRecords }).taskFrame, null)
  })
}

for (const [label, prompt] of [
  ['ordinary affirmative current web request', '请联网搜索本周行业最新新闻，核对公开来源后给出摘要。'],
  ['expert-shaped task with affirmative research', '作为内容策划专家，请联网检索本周行业新闻，为选题补充最新公开事实并列来源。'],
  ['quoted offline statement is data, not current-user prohibition', '材料原话：“这台设备不联网。”\n当前委托：请联网搜索该设备本周最新公开公告，并核对官网。'],
]) {
  test(`RQA19 preserves required search for ${label}`, () => {
    const selected = routing.selectResearchPrompt({ prompt, displayPrompt: prompt })
    const route = routing.buildResearchRoute({ prompt: selected, toolRecords: webRecords })
    assert.equal(route.active, true)
    assert.deepEqual(route.taskFrame, existingResearchFrame)
    assert.equal(routing.reconcileResearchTaskFrame(existingResearchFrame, selected), existingResearchFrame)
  })
}

test('RQA19 affirmative request cannot require an unprojected web tool', () => {
  const route = routing.buildResearchRoute({ prompt: '请联网搜索今天最新公开新闻。', toolRecords: [] })
  assert.equal(route.active, true)
  assert.equal(route.taskFrame, null)
  assert.deepEqual(route.sources, [])
})

test('RQA19 does not delete independently declared non-research obligations', () => {
  const declared = { workflowId: 'explicit-user-workflow', requiredTools: ['search_web'] }
  assert.equal(routing.reconcileResearchTaskFrame(declared, '仅分析已给材料，不联网。'), declared)
})

test('RQA19 short visible goal stays authoritative over internal timestamp/SOP scaffolding', () => {
  const row = fixture.cases.find(item => item.id === 'CD-N01')
  const selected = routing.selectResearchPrompt({
    displayPrompt: row.goal,
    prompt: '当前时间：2026-09-06。系统SOP：调查市场最新动态。\n' + assembledInput(row),
  })
  assert.equal(selected, row.goal)
  assert.equal(routing.classifyResearchIntent(selected).active, false)
})

// Post-fix independent challenges. The frozen 24 tests above are unchanged.
// These test user intent, not a particular regex/parser implementation. All
// tools remain inert descriptors; no connector or filesystem search executes.
for (const [label, constraint] of [
  ['Chinese quotes', '“不联网，只分析已给材料。”'],
  ['ASCII quotes', '"不联网，只分析已给材料。"'],
]) {
  test(`RQA19 challenge: explicitly adopted current constraint survives ${label}`, () => {
    const prompt = `本轮约束：${constraint}请整理本周公告发布计划。`
    const route = routing.buildResearchRoute({ prompt, toolRecords: webRecords })
    assert.equal(route.taskFrame, null, 'quotation marks do not revoke a current task constraint')
    assert.equal(route.active, false)
    assert.equal(routing.reconcileResearchTaskFrame(existingResearchFrame, prompt), null)
  })
}

for (const [label, suffix] of [
  ['ordinary internal research control', ''],
  ['external network prohibited, local research requested', '，不联网'],
]) {
  test(`RQA19 challenge: ${label}`, () => {
    const prompt = `请检索本地知识库里本周项目进展${suffix}。`
    const localRecords = [{
      type: 'function',
      function: { name: 'search_knowledge', description: 'Search the local knowledge index', parameters: { type: 'object', properties: {} } },
      _knowme: { research: { kind: 'knowledge-search', scope: 'knowledge' } },
    }]
    const route = routing.buildResearchRoute({ prompt, toolRecords: localRecords })
    assert.equal(route.active, true, 'no external network does not cancel an explicit local lookup')
    assert.equal(route.intent.scope, 'internal')
    assert.equal(route.taskFrame, null, 'local research must not require a public web receipt')
    assert.deepEqual(route.sources.map(source => source.toolName), ['search_knowledge'])
    assert.equal(routing.promoteIntentTier('chat', prompt), 'assist')
  })
}

for (const [label, source] of [
  ['Chinese source quotation control', '材料原话：“这台设备不联网。”'],
  ['Markdown source blockquote', '材料原话：\n> 这台设备不联网。\n'],
]) {
  test(`RQA19 challenge: affirmative web instruction is preserved after ${label}`, () => {
    const prompt = `${source}\n\n当前委托：请联网搜索该设备本周最新公开公告，并核对官网。`
    const route = routing.buildResearchRoute({ prompt, toolRecords: webRecords })
    assert.equal(route.active, true, 'a quoted device property is not the user prohibiting this run from browsing')
    assert.deepEqual(route.taskFrame, existingResearchFrame)
  })
}

test('RQA19 challenge: quoted title to rewrite does not itself request live research', () => {
  const prompt = '请将“最新新闻”这个栏目标题改写为更朴素的四字标题。'
  const route = routing.buildResearchRoute({ prompt, toolRecords: webRecords })
  assert.equal(route.taskFrame, null, 'freshness words in the editing target are not an external retrieval instruction')
  assert.equal(route.active, false)
})

test('RQA19 challenge: explicit web lookup about a quoted title still requires evidence', () => {
  const prompt = '请联网搜索“最新新闻”栏目本周的公开更新，并核对官网。'
  const route = routing.buildResearchRoute({ prompt, toolRecords: webRecords })
  assert.equal(route.active, true)
  assert.deepEqual(route.taskFrame, existingResearchFrame)
})
