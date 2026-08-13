'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const studio = require('../src/lib/workbench-studio-model')
const canvas = require('../src/lib/workbench-studio-canvas')

describe('workbench-studio-canvas', () => {
  it('renders start and end only when draft has no agents', () => {
    const draft = studio.createDraft({ name: '空流', inputs: [{ label: '问题' }], outputs: [{ label: '答案' }] })
    const board = canvas.buildBoard(draft, { toComposition: studio.toComposition })
    assert.equal(board.empty, true)
    assert.ok(board.nodes.some(n => n.kind === 'start'))
    assert.ok(board.nodes.some(n => n.kind === 'end'))
    assert.ok(board.edges.some(e => e.from === canvas.START_ID && e.to === canvas.END_ID))
  })

  it('layouts serial agents between start and end with composition edges', () => {
    let draft = studio.createDraft({ goal: '串行' })
    draft = studio.addAgent(draft, { id: 'a', name: 'A' })
    draft = studio.addAgent(draft, { id: 'b', name: 'B' })
    const board = canvas.buildBoard(draft, { toComposition: studio.toComposition })
    const kinds = board.nodes.map(n => n.kind)
    assert.deepEqual(kinds.filter(k => k === 'agent').length, 2)
    assert.ok(board.edges.some(e => e.from === canvas.START_ID))
    assert.ok(board.edges.some(e => e.to === canvas.END_ID))
    assert.ok(board.nodes.every(n => Number.isFinite(n.x) && Number.isFinite(n.y)))
  })

  it('surfaces join and gate nodes for parallel and approval relations', () => {
    let draft = studio.createDraft({ goal: '并行确认' })
    draft = studio.addAgent(draft, { id: 'r', name: '研究' })
    draft = studio.addAgent(draft, { id: 'w', name: '写作' })
    draft = studio.addAgent(draft, { id: 'v', name: '审阅' })
    draft = studio.updateNode(draft, draft.nodes[0].id, { relation: 'parallel' })
    draft = studio.updateNode(draft, draft.nodes[1].id, { relation: 'approval' })
    const board = canvas.buildBoard(draft, {
      toComposition: studio.toComposition,
      selectedId: draft.nodes[0].id,
    })
    assert.ok(board.nodes.some(n => n.kind === 'join'))
    assert.ok(board.nodes.some(n => n.kind === 'gate'))
    assert.ok(board.nodes.find(n => n.id === draft.nodes[0].id)?.selected)
    assert.ok(board.edges.length >= 4)
  })

  it('exposes palette types aligned with agentUniverse-inspired roles', () => {
    const types = canvas.paletteTypes()
    assert.ok(types.some(t => t.kind === 'start'))
    assert.ok(types.some(t => t.kind === 'agent'))
    assert.ok(types.some(t => t.kind === 'llm'))
    assert.ok(types.some(t => t.kind === 'gate'))
  })

  it('projects agentUniverse-style sectioned summaries on nodes', () => {
    const draft = studio.createDraft({
      name: 'AU卡',
      inputs: [{ label: 'user_input' }],
      outputs: [{ label: 'answer' }],
    })
    let next = studio.addNode(draft, {
      kind: 'llm',
      name: '总结',
      config: { model: 'gpt-4o', prompt: '请根据背景回答 {{input}}' },
      inputSpec: 'input',
      outputSpec: 'output',
    })
    next = studio.addNode(next, {
      kind: 'agent',
      name: '专家节点',
      intent: '完成评审',
      agentPackageId: 'pkg-qa',
      inputSpec: '需求',
      outputSpec: '结论',
    })
    const board = canvas.buildBoard(next, { toComposition: studio.toComposition })
    const start = board.nodes.find(n => n.kind === 'start')
    const end = board.nodes.find(n => n.kind === 'end')
    const llm = board.nodes.find(n => n.kind === 'llm')
    const agent = board.nodes.find(n => n.kind === 'agent')
    assert.ok(start.sections?.some(s => s.title === '输入' && s.rows.some(r => String(r).includes('user_input'))))
    assert.ok(end.sections?.some(s => s.title === '输出'))
    assert.ok(llm.sections?.some(s => s.title === 'Prompt'))
    assert.ok(llm.sections?.some(s => s.title === '模型'))
    assert.ok(agent.sections?.some(s => s.title === '执行专家' && s.rows.some(r => String(r).includes('pkg-qa'))))
    assert.ok(agent.sections?.some(s => s.title === '目标'))
    assert.ok(!agent.sections?.some(s => s.title === '输出'), 'agent canvas drops output; inspector keeps it')
    assert.deepEqual(llm.fields, [])
    assert.deepEqual(agent.fields, [])
    assert.ok(llm.w >= 240)
    assert.ok(llm.h >= 100)
    assert.ok(llm.h <= canvas.MAX_NODE_H)
  })

  it('maps node kinds to component-library icons', () => {
    assert.equal(canvas.iconForKind('start'), 'play')
    assert.equal(canvas.iconForKind('end'), 'square')
    assert.equal(canvas.iconForKind('agent'), 'users')
    assert.equal(canvas.iconForKind('gate'), 'clipboardCheck')
    assert.equal(canvas.KIND_ICONS.condition, 'workflow')
  })

  it('summarizes long IO lists with overflow hint instead of mid-string clip', () => {
    const draft = studio.createDraft({
      name: '多出参',
      inputs: [
        { label: '入参一很长很长的名字' },
        { label: '入参二' },
        { label: '入参三' },
      ],
      outputs: [
        { label: '文案方向' },
        { label: '图像提示词' },
        { label: '查询最新的输出结果字段' },
        { label: '额外出参' },
      ],
    })
    const board = canvas.buildBoard(draft, { toComposition: studio.toComposition })
    const start = board.nodes.find(n => n.kind === 'start')
    const end = board.nodes.find(n => n.kind === 'end')
    const startRows = start.sections.find(s => s.title === '输入').rows
    const endRows = end.sections.find(s => s.title === '输出').rows
    assert.ok(startRows.length <= 3)
    assert.ok(startRows.some(r => String(r).includes('等')))
    assert.ok(endRows.length <= 3)
    assert.ok(endRows.some(r => String(r).includes('等')))
    assert.ok(!endRows.some(r => String(r).includes(' ·  string')))
    assert.ok(end.h >= 96)
  })

  it('drops placeholder agent input from canvas summary', () => {
    const sections = canvas.sectionsFromNode({
      kind: 'agent',
      name: '文案',
      agentPackageId: 'copywriter',
      intent: '整理卖点',
      inputSpec: '本环节输入',
    })
    assert.ok(sections.some(s => s.title === '执行专家'))
    assert.ok(sections.some(s => s.title === '目标'))
    assert.ok(!sections.some(s => s.title === '输入'))
  })

  it('workbench canvas nodes use StickyIcons data-icon not unicode glyphs', () => {
    const script = fs.readFileSync(path.join(__dirname, '../src/workbench.js'), 'utf8')
    assert.match(script, /function studioKindIcon\(/)
    assert.match(script, /wb-studio-flow-icon[\s\S]*data-icon=/)
    assert.doesNotMatch(script, /start:\s*'▶'/)
    assert.doesNotMatch(script, /gate:\s*'✓'/)
  })

  it('condition cards expose branch section', () => {
    const sections = canvas.sectionsFromNode({
      kind: 'condition',
      config: { left: 'score', compare: 'equal', right: 'pass' },
    })
    assert.ok(sections.some(s => s.title === '条件'))
    assert.ok(sections.some(s => s.title === '分支'))
  })

  it('board nodes are summary-only; editable binds stay off the card', () => {
    const draft = studio.createDraft({ name: '摘要卡' })
    let next = studio.addNode(draft, {
      kind: 'knowledge',
      name: '知识库',
      config: { knowledgeId: 'kb-1', knowledgeName: '产品文档' },
      inputSpec: '检索问题',
    })
    next = studio.addNode(next, {
      kind: 'llm',
      name: '总结',
      config: { modelName: 'gpt-4o', prompt: 'hello' },
    })
    const board = canvas.buildBoard(next, { toComposition: studio.toComposition })
    for (const node of board.nodes) {
      assert.deepEqual(node.fields || [], [], `node ${node.kind} must not expose editable fields`)
    }
    const knowledge = board.nodes.find(n => n.kind === 'knowledge')
    assert.ok(knowledge.sections?.some(s => s.title === '知识库' && s.rows.some(r => String(r).includes('产品文档'))))
    assert.ok(knowledge.sections?.every(s => !/select|input|textarea/i.test(JSON.stringify(s))))

    const emptyKb = canvas.sectionsFromNode({ kind: 'knowledge', name: '空知识库', config: {} })
    assert.ok(emptyKb.some(s => s.title === '知识库' && s.tone === 'warn' && s.rows.some(r => String(r).includes('未选择'))))

    const emptyTool = canvas.sectionsFromNode({ kind: 'tool', name: '工具', config: {} })
    assert.ok(emptyTool.some(s => s.title === '工具' && s.tone === 'warn'))
    assert.ok(emptyTool.some(s => s.title === '工具' || s.title === '输入' || s.title === '目标'))

    const unboundAgent = canvas.sectionsFromNode({ kind: 'agent', name: '专家', intent: 'x' })
    assert.ok(unboundAgent.some(s => s.title === '执行专家' && s.tone === 'warn'))
  })

  it('canvas css uses type-colored full header chrome', () => {
    const css = fs.readFileSync(path.join(__dirname, '../src/workbench-console.css'), 'utf8')
    assert.match(css, /\.wb-studio-flow-node\.kind-tool \.wb-studio-flow-head\s*\{[^}]*background:/s)
    assert.match(css, /\.wb-studio-flow-node\.kind-knowledge \.wb-studio-flow-head\s*\{[^}]*background:/s)
    assert.match(css, /\.wb-studio-flow-section\.is-empty/)
    assert.doesNotMatch(css, /\.wb-studio-flow-node\.kind-tool\s*\{\s*border-top:\s*3px/)
  })

  it('sizes summary nodes from compact section floors', () => {
    const sections = canvas.sectionsFromNode({
      kind: 'llm',
      config: { prompt: 'x'.repeat(80), modelName: 'm' },
      inputSpec: 'in',
      outputSpec: 'out',
    })
    const size = canvas.sizeForNode('llm', sections)
    assert.ok(size.w >= 240)
    assert.ok(size.h >= 100)
    assert.ok(size.h < 260, 'summary card should be shorter than former inline form height')
    assert.ok(size.h <= canvas.MAX_NODE_H)
  })

  it('agent goal text section gets enough height to avoid bottom clip', () => {
    const sections = canvas.sectionsFromNode({
      kind: 'agent',
      name: '专家节点',
      agentPackageId: 'copywriter',
      intent: '把 Brief 整理为受众、卖点与文案方向，并补充语气约束与禁区',
    })
    assert.ok(sections.some(s => s.title === '目标' && s.mode === 'text'))
    const size = canvas.sizeForNode('agent', sections)
    assert.ok(size.h >= 190, `expected taller goal card, got ${size.h}`)
    assert.ok(size.h < 280, 'still compact vs old inline forms')
  })

  it('routes stacked nodes via top/bottom sides with smooth cubic curves', () => {
    const from = { x: 100, y: 40, w: 200, h: 100 }
    const to = { x: 120, y: 280, w: 200, h: 100 }
    const pick = canvas.chooseEdgeSides(from, to)
    assert.ok(['bottom', 'right', 'left'].includes(pick.fromSide))
    assert.ok(['top', 'left', 'right'].includes(pick.toSide))
    // Prefer vertical when mostly below
    assert.equal(pick.fromSide, 'bottom')
    assert.equal(pick.toSide, 'top')
    const path = canvas.edgePath(from, to)
    assert.match(path, /^M [\d.]+ [\d.]+ C /)
    assert.doesNotMatch(path, / L /)
  })

  it('routes right-of layout via left/right handles', () => {
    const from = { x: 40, y: 80, w: 180, h: 90 }
    const to = { x: 360, y: 90, w: 180, h: 90 }
    const pick = canvas.chooseEdgeSides(from, to)
    assert.equal(pick.fromSide, 'right')
    assert.equal(pick.toSide, 'left')
  })

  it('alignNodes left/top/center-h for multiple nodes', () => {
    const nodes = [
      { id: 'a', x: 40, y: 20, w: 100, h: 80 },
      { id: 'b', x: 200, y: 60, w: 120, h: 80 },
      { id: 'c', x: 80, y: 140, w: 100, h: 80 },
    ]
    const left = canvas.alignNodes(nodes, 'left')
    assert.equal(left.find(n => n.id === 'a').x, 40)
    assert.equal(left.find(n => n.id === 'b').x, 40)
    assert.equal(left.find(n => n.id === 'c').x, 40)

    const top = canvas.alignNodes(nodes, 'top')
    assert.equal(top.find(n => n.id === 'a').y, 20)
    assert.equal(top.find(n => n.id === 'b').y, 20)

    const center = canvas.alignNodes(nodes, 'center-h')
    const midA = center.find(n => n.id === 'a').x + 50
    const midB = center.find(n => n.id === 'b').x + 60
    assert.ok(Math.abs(midA - midB) < 0.01)
  })

  it('layoutPositions writes coordinates for free draft', () => {
    let draft = studio.createDraft({ goal: '整理', graphMode: 'free' })
    draft = studio.addAgent(draft, { id: 'a', name: 'A' })
    draft = studio.addAgent(draft, { id: 'b', name: 'B' })
    draft = studio.ensureFreeGraph(draft)
    draft = studio.updatePosition(draft, draft.nodes[0].id, 900, 400)
    const positions = canvas.layoutPositions(draft)
    assert.ok(positions.length >= 2)
    assert.ok(positions.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)))
    const xs = positions.map(p => p.x)
    assert.ok(Math.max(...xs) - Math.min(...xs) > 50)
  })
})
