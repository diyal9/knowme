'use strict'

;(function initWorkbenchStudioCanvas(root, factory) {
  const api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  if (root) root.WorkbenchStudioCanvas = api
})(typeof window !== 'undefined' ? window : globalThis, function createWorkbenchStudioCanvas() {
  const START_ID = '__start__'
  const END_ID = '__end__'
  const COL_GAP = 112
  const ROW_GAP = 72
  const PAD_X = 64
  const PAD_Y = 56
  const MAX_NODE_H = 320
  const SIDES = ['left', 'right', 'top', 'bottom']
  const OUTWARD = {
    left: [-1, 0],
    right: [1, 0],
    top: [0, -1],
    bottom: [0, 1],
  }

  // Summary-only cards: compact floors; height from section rows (not inline forms)
  // Floors leave room for goal/prompt text box (~4 lines) without bottom clipping.
  const SIZE = {
    start: { w: 220, h: 96 },
    end: { w: 220, h: 96 },
    agent: { w: 248, h: 168 },
    llm: { w: 260, h: 160 },
    tool: { w: 236, h: 128 },
    knowledge: { w: 236, h: 128 },
    condition: { w: 220, h: 120 },
    join: { w: 120, h: 72 },
    gate: { w: 200, h: 96 },
  }

  // Keep in sync with studio palette glyphs (ui-icons / KnowMeIcons)
  const KIND_ICONS = {
    start: 'play',
    end: 'square',
    agent: 'users',
    llm: 'optimize',
    tool: 'component',
    knowledge: 'bookOpen',
    condition: 'workflow',
    join: 'network',
    gate: 'clipboardCheck',
  }

  const SUMMARY_ROW_MAX = 40
  const SUMMARY_TEXT_MAX = 72
  const SUMMARY_IO_VISIBLE = 2
  const HEADER_H = 56

  function text(value, max = 240) {
    return String(value == null ? '' : value).trim().slice(0, max)
  }

  function iconForKind(kind) {
    return KIND_ICONS[kind] || 'component'
  }

  function sizeOf(kind) {
    return SIZE[kind] || SIZE.agent
  }

  function ioLabels(list, fallback) {
    const labels = (Array.isArray(list) ? list : [])
      .map(item => text(item?.label || item?.name || item?.id || '', SUMMARY_ROW_MAX))
      .filter(Boolean)
    if (!labels.length) return fallback ? [fallback] : []
    if (labels.length <= SUMMARY_IO_VISIBLE) return labels
    const head = labels.slice(0, SUMMARY_IO_VISIBLE)
    head.push(`等 ${labels.length - SUMMARY_IO_VISIBLE} 项`)
    return head
  }

  function makeSection(title, rows, mode = 'rows', tone = '') {
    const cleaned = (Array.isArray(rows) ? rows : [rows])
      .map(row => text(row, mode === 'text' ? SUMMARY_TEXT_MAX : SUMMARY_ROW_MAX))
      .filter(Boolean)
      .slice(0, mode === 'text' ? 1 : SUMMARY_IO_VISIBLE + 1)
    if (!cleaned.length) return null
    const toneNorm = tone === 'warn' ? 'warn' : (tone === 'empty' ? 'empty' : '')
    return {
      title: text(title, 24),
      mode,
      rows: cleaned,
      tone: toneNorm,
    }
  }

  function isPlaceholderInput(value) {
    const v = text(value, 80)
    if (!v) return true
    return /^(本环节输入|上游|上游结果|上游\s*\/\s*本节点输入|未填写输入)$/i.test(v)
  }

  function summaryEmptyLabel(bind) {
    if (bind === 'agentPackageId') return '未绑定专家'
    if (bind === 'config.knowledgeId') return '未选择知识库'
    if (bind === 'config.skillId') return '未选择技能'
    if (bind === 'config.modelName' || bind === 'config.model') return '未选择模型'
    if (bind === 'config.prompt') return '未填写 Prompt'
    if (bind === 'intent') return '未填写目标'
    if (bind === 'inputSpec') return '未填写输入'
    if (bind === 'outputSpec') return '未填写输出'
    if (bind === 'config.note') return '人工确认后继续'
    return '—'
  }

  function summaryFieldRow(field) {
    if (!field || field.area === 'title') return null
    // Canvas shows key value only; type/meta labels stay in the inspector.
    const raw = text(field.value, field.type === 'textarea' ? SUMMARY_TEXT_MAX : SUMMARY_ROW_MAX)
    if (raw) return raw
    if (field.readonly && field.value) return text(field.value, SUMMARY_ROW_MAX)
    return summaryEmptyLabel(field.bind)
  }

  function summaryFieldWarn(field) {
    if (!field || field.area === 'title') return false
    if (text(field.value)) return false
    return ['agentPackageId', 'config.knowledgeId', 'config.skillId', 'config.modelName', 'config.model'].includes(field.bind)
  }

  function summaryFieldEmpty(field) {
    if (!field || field.area === 'title') return false
    if (text(field.value)) return false
    return !summaryFieldWarn(field)
  }

  function makeField(spec = {}) {
    return {
      bind: text(spec.bind, 80),
      type: text(spec.type || 'text', 16) || 'text',
      section: text(spec.section || '', 24),
      label: text(spec.label || '', 40),
      value: spec.value == null ? '' : String(spec.value),
      placeholder: text(spec.placeholder || '', 80),
      max: Number(spec.max) > 0 ? Number(spec.max) : 240,
      options: Array.isArray(spec.options) ? spec.options : null,
      area: text(spec.area || 'body', 16) || 'body',
      readonly: spec.readonly === true,
    }
  }

  function fieldsFromNode(node, draft = {}) {
    const kind = node.kind || node.type || 'agent'
    const cfg = node.config && typeof node.config === 'object' ? node.config : {}
    const fields = []

    if (kind === 'start') {
      const list = Array.isArray(draft.inputs) && draft.inputs.length
        ? draft.inputs
        : [{ label: 'user_input', type: 'text' }]
      list.slice(0, 4).forEach((item, index) => {
        fields.push(makeField({
          bind: `draft.inputs.${index}.label`,
          type: 'text',
          section: '输入',
          label: 'string',
          value: item?.label || '',
          placeholder: index === 0 ? 'user_input' : `入参 ${index + 1}`,
          max: 160,
        }))
      })
      return fields
    }

    if (kind === 'end') {
      const list = Array.isArray(draft.outputs) && draft.outputs.length
        ? draft.outputs
        : [{ label: 'result', type: 'text' }]
      list.slice(0, 4).forEach((item, index) => {
        fields.push(makeField({
          bind: `draft.outputs.${index}.label`,
          type: 'text',
          section: '输出',
          label: 'string',
          value: item?.label || '',
          placeholder: index === 0 ? 'result' : `出参 ${index + 1}`,
          max: 160,
        }))
      })
      return fields
    }

    if (kind === 'join') {
      fields.push(makeField({
        bind: 'intent',
        type: 'text',
        section: '说明',
        value: node.intent || node.description || '并行汇合',
        placeholder: '汇合说明',
        max: 120,
        readonly: true,
      }))
      return fields
    }

    if (kind === 'gate') {
      fields.push(makeField({
        bind: 'name',
        type: 'text',
        area: 'title',
        value: node.name || '人工确认',
        placeholder: '确认节点名称',
        max: 120,
      }))
      fields.push(makeField({
        bind: 'config.note',
        type: 'text',
        section: '确认',
        value: cfg.note || node.approvalNote || '',
        placeholder: '人工确认后继续',
        max: 240,
      }))
      return fields
    }

    if (kind === 'condition') {
      fields.push(makeField({
        bind: 'name',
        type: 'text',
        area: 'title',
        value: node.name || '条件判断',
        max: 120,
      }))
      fields.push(makeField({
        bind: 'config.left',
        type: 'text',
        section: '条件',
        label: '左值',
        value: cfg.left || 'input',
        placeholder: 'input',
        max: 160,
      }))
      fields.push(makeField({
        bind: 'config.compare',
        type: 'select',
        section: '条件',
        label: '比较',
        value: cfg.compare || 'equal',
        options: [
          { value: 'equal', label: '等于' },
          { value: 'not_equal', label: '不等于' },
          { value: 'contains', label: '包含' },
          { value: 'blank', label: '为空' },
        ],
      }))
      fields.push(makeField({
        bind: 'config.right',
        type: 'text',
        section: '条件',
        label: '右值',
        value: cfg.right || '',
        placeholder: '比较值',
        max: 240,
      }))
      fields.push(makeField({
        bind: 'branchHint',
        type: 'text',
        section: '分支',
        value: '成立 / 不成立双端口',
        readonly: true,
      }))
      return fields
    }

    // Shared title for editable exec nodes
    if (['agent', 'llm', 'tool', 'knowledge'].includes(kind)) {
      fields.push(makeField({
        bind: 'name',
        type: 'text',
        area: 'title',
        value: node.name || '',
        placeholder: kind === 'agent' ? '专家节点' : defaultTitle(kind),
        max: 120,
      }))
    }

    if (kind === 'llm') {
      fields.push(makeField({
        bind: 'config.modelName',
        type: 'select-model',
        section: '模型',
        value: cfg.modelName || cfg.model || '',
        placeholder: '选择模型',
        max: 80,
      }))
      fields.push(makeField({
        bind: 'inputSpec',
        type: 'text',
        section: '输入',
        value: node.inputSpec || '',
        placeholder: '上游结果',
        max: 200,
      }))
      fields.push(makeField({
        bind: 'config.prompt',
        type: 'textarea',
        section: 'Prompt',
        value: cfg.prompt || node.intent || '',
        placeholder: '系统提示词，可用 {{input}}',
        max: 4000,
      }))
      fields.push(makeField({
        bind: 'outputSpec',
        type: 'text',
        section: '输出',
        value: node.outputSpec || '',
        placeholder: 'output',
        max: 200,
      }))
      return fields
    }

    if (kind === 'tool') {
      fields.push(makeField({
        bind: 'inputSpec',
        type: 'text',
        section: '输入',
        value: node.inputSpec || '',
        placeholder: '上游结果',
        max: 200,
      }))
      fields.push(makeField({
        bind: 'config.skillId',
        type: 'select-skill',
        section: '工具',
        value: cfg.skillName || cfg.skillId || '',
        placeholder: '选择技能',
      }))
      fields.push(makeField({
        bind: 'intent',
        type: 'textarea',
        section: '目标',
        value: node.intent || '',
        placeholder: '该工具节点要完成什么',
        max: 1200,
      }))
      fields.push(makeField({
        bind: 'outputSpec',
        type: 'text',
        section: '输出',
        value: node.outputSpec || '',
        placeholder: 'output',
        max: 200,
      }))
      return fields
    }

    if (kind === 'knowledge') {
      fields.push(makeField({
        bind: 'inputSpec',
        type: 'text',
        section: '输入',
        value: node.inputSpec || '',
        placeholder: '检索问题',
        max: 200,
      }))
      fields.push(makeField({
        bind: 'config.knowledgeId',
        type: 'select-knowledge',
        section: '知识库',
        value: cfg.knowledgeName || cfg.knowledgeId || '',
        placeholder: '选择知识库',
      }))
      fields.push(makeField({
        bind: 'intent',
        type: 'textarea',
        section: '目标',
        value: node.intent || '',
        placeholder: '检索目标说明',
        max: 1200,
      }))
      fields.push(makeField({
        bind: 'outputSpec',
        type: 'text',
        section: '输出',
        value: node.outputSpec || '',
        placeholder: '检索结果',
        max: 200,
      }))
      return fields
    }

    // agent
    fields.push(makeField({
      bind: 'inputSpec',
      type: 'text',
      section: '输入',
      value: node.inputSpec || '',
      placeholder: '上游 / 本节点输入',
      max: 200,
    }))
    fields.push(makeField({
      bind: 'intent',
      type: 'textarea',
      section: '目标',
      value: node.intent || '',
      placeholder: '本节点目标',
      max: 1200,
    }))
    fields.push(makeField({
      bind: 'outputSpec',
      type: 'text',
      section: '输出',
      value: node.outputSpec || '',
      placeholder: '本节点输出',
      max: 200,
    }))
    return fields
  }

  function defaultTitle(kind) {
    return ({
      llm: '大模型节点',
      tool: '工具节点',
      knowledge: '知识库节点',
      agent: '专家节点',
    })[kind] || '节点'
  }

  function sectionsFromNode(node, draft = {}) {
    // Read-only summary projection for canvas cards (edits live in the inspector).
    const kind = node.kind || node.type || 'agent'
    const skillCount = Array.isArray(node.profile?.skillRefs) ? node.profile.skillRefs.length : 0
    const fields = fieldsFromNode(node, draft)
    const bySection = new Map()
    const warnBySection = new Map()
    fields.filter(f => f.area !== 'title').forEach(field => {
      const title = field.section || '配置'
      if (!bySection.has(title)) {
        bySection.set(title, [])
        warnBySection.set(title, false)
      }
      const display = summaryFieldRow(field)
      if (display) bySection.get(title).push(display)
      if (summaryFieldWarn(field)) warnBySection.set(title, true)
    })
    if (!bySection.size) {
      const inputHint = text(node.inputSpec || '', SUMMARY_ROW_MAX) || '上游结果'
      const outputHint = text(node.outputSpec || '', SUMMARY_ROW_MAX) || 'output'
      if (kind === 'start') {
        return [makeSection('输入', ioLabels(draft.inputs || node.inputs, 'user_input'))].filter(Boolean)
      }
      if (kind === 'end') {
        return [makeSection('输出', ioLabels(draft.outputs || node.outputs, 'result'))].filter(Boolean)
      }
      return [
        makeSection('输入', [inputHint]),
        makeSection('输出', [outputHint]),
      ].filter(Boolean)
    }
    const emptyBySection = new Map()
    fields.filter(f => f.area !== 'title').forEach(field => {
      const title = field.section || '配置'
      if (!emptyBySection.has(title)) emptyBySection.set(title, true)
      if (text(field.value)) emptyBySection.set(title, false)
      else if (!summaryFieldEmpty(field) && !summaryFieldWarn(field)) emptyBySection.set(title, false)
    })
    let sections = []
    bySection.forEach((rows, title) => {
      const mode = title === 'Prompt' || title === '目标' ? 'text' : 'rows'
      const tone = warnBySection.get(title) ? 'warn' : (emptyBySection.get(title) ? 'empty' : '')
      // start/end may produce many IO rows from fields; re-apply overflow hint
      let displayRows = mode === 'text' ? [rows[0]] : rows
      if ((kind === 'start' || kind === 'end') && mode !== 'text' && rows.length > SUMMARY_IO_VISIBLE) {
        displayRows = rows.slice(0, SUMMARY_IO_VISIBLE).concat([`等 ${rows.length - SUMMARY_IO_VISIBLE} 项`])
      }
      sections.push(makeSection(title, displayRows, mode, tone))
    })
    if (kind === 'agent') {
      const expertId = text(node.agentPackageId, 72)
      const known = Array.isArray(draft.knownExpertIds) ? draft.knownExpertIds : null
      const orphan = !!(expertId && known && !known.includes(expertId))
      const expertLabel = orphan
        ? `${expertId}（已失效）`
        : (expertId || '未绑定专家')
      const expertSection = makeSection('执行专家', [expertLabel], 'rows', (expertId && !orphan) ? '' : 'warn')
      if (expertSection) sections.unshift(expertSection)
      if (skillCount) {
        sections.splice(Math.min(sections.length, 2), 0, makeSection('技能', [`${skillCount} 项已选`]))
      }
      // Keep canvas scannable: expert + goal (+ skills); drop placeholder IO.
      sections = sections.filter(section => {
        if (!section) return false
        if (section.title === '输出') return false
        if (section.title === '输入') return !isPlaceholderInput(section.rows?.[0])
        return true
      })
    } else if (kind === 'llm') {
      sections = sections.filter(section => {
        if (!section) return false
        if (section.title === '模型' || section.title === 'Prompt') return true
        if (section.title === '输入') return !isPlaceholderInput(section.rows?.[0])
        return false
      })
    } else if (kind === 'tool' || kind === 'knowledge') {
      sections = sections.filter(section => {
        if (!section) return false
        if (section.title === '输出') return false
        if (section.title === '输入') return !isPlaceholderInput(section.rows?.[0])
        return true
      })
    }
    return sections.filter(Boolean)
  }

  function sizeForNode(kind, sections, _fields = null) {
    const base = sizeOf(kind)
    // Match CSS: section head + padding ≈ 22; text box ≈ 4×10.5×1.4 + pad ≈ 56
    let h = HEADER_H
    ;(sections || []).forEach(section => {
      h += 22
      if (section.mode === 'text') h += 56
      else h += Math.max(1, (section.rows || []).length) * 16
      h += 6
    })
    // .wb-studio-flow-sections padding-top/bottom
    h = Math.min(MAX_NODE_H, Math.max(base.h, h + 14))
    return { w: base.w, h }
  }

  function sidePoint(node, side) {
    const x = Number(node.x) || 0
    const y = Number(node.y) || 0
    const w = Number(node.w) || sizeOf(node.kind).w
    const h = Number(node.h) || sizeOf(node.kind).h
    if (side === 'left') return { x, y: y + h / 2 }
    if (side === 'top') return { x: x + w / 2, y }
    if (side === 'bottom') return { x: x + w / 2, y: y + h }
    return { x: x + w, y: y + h / 2 }
  }

  function chooseEdgeSides(from, to, preferred = {}) {
    const preferFrom = text(preferred.fromSide, 12)
    const preferTo = text(preferred.toSide, 12)
    let best = null
    SIDES.forEach(fromSide => {
      SIDES.forEach(toSide => {
        const p1 = sidePoint(from, fromSide)
        const p2 = sidePoint(to, toSide)
        const dx = p2.x - p1.x
        const dy = p2.y - p1.y
        const dist = Math.hypot(dx, dy) || 1
        const o1 = OUTWARD[fromSide]
        const o2 = OUTWARD[toSide]
        // Prefer exit/entry normals that point along the connection vector
        const leaveAlign = (dx * o1[0] + dy * o1[1]) / dist
        const enterAlign = (-dx * o2[0] - dy * o2[1]) / dist
        let score = dist - Math.max(0, leaveAlign) * dist * 0.55 - Math.max(0, enterAlign) * dist * 0.55
        // Mild penalty for opposite-side reverse flows that kink hard
        if (leaveAlign < 0) score += dist * 0.2
        if (enterAlign < 0) score += dist * 0.2
        if (preferFrom && fromSide === preferFrom) score -= 36
        if (preferTo && toSide === preferTo) score -= 36
        if (!best || score < best.score) {
          best = { fromSide, toSide, score, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y }
        }
      })
    })
    return best || {
      fromSide: 'right',
      toSide: 'left',
      x1: (from.x || 0) + (from.w || 0),
      y1: (from.y || 0) + (from.h || 0) / 2,
      x2: to.x || 0,
      y2: (to.y || 0) + (to.h || 0) / 2,
    }
  }

  function edgePathPoints(x1, y1, x2, y2, fromSide = 'right', toSide = 'left') {
    const dx = x2 - x1
    const dy = y2 - y1
    const dist = Math.hypot(dx, dy)
    const curve = Math.max(48, Math.min(200, dist * 0.42 + 20))
    const o1 = OUTWARD[fromSide] || OUTWARD.right
    const o2 = OUTWARD[toSide] || OUTWARD.left
    const c1x = x1 + o1[0] * curve
    const c1y = y1 + o1[1] * curve
    const c2x = x2 + o2[0] * curve
    const c2y = y2 + o2[1] * curve
    return `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`
  }

  function edgePath(from, to, preferred = {}) {
    const pick = chooseEdgeSides(from, to, preferred)
    return edgePathPoints(pick.x1, pick.y1, pick.x2, pick.y2, pick.fromSide, pick.toSide)
  }

  function visualNodeFromDraft(node, selectedId, draft = {}) {
    const kind = node.kind || node.type || 'agent'
    const skillCount = Array.isArray(node.profile?.skillRefs) ? node.profile.skillRefs.length : 0
    let body = text(node.intent || node.description || '', 160)
    if (kind === 'llm') body = text(node.config?.prompt || node.intent || '配置 Prompt 与模型', 160)
    if (kind === 'tool') body = text(node.config?.skillName || node.config?.skillId || '绑定一项技能', 160)
    if (kind === 'knowledge') body = text(node.config?.knowledgeName || node.config?.knowledgeId || '绑定知识库', 160)
    if (kind === 'condition') {
      body = `${node.config?.left || 'input'} ${node.config?.compare || 'equal'} ${node.config?.right || '…'}`
    }
    if (kind === 'start') body = body || '工作流入参'
    if (kind === 'end') body = body || '工作流出参'
    if (kind === 'join') body = body || '并行汇合'
    if (kind === 'gate') body = text(node.config?.note || node.approvalNote || '人工确认后继续', 120)

    const titles = {
      start: '开始节点',
      end: '结束节点',
      agent: node.name || node.agentPackageId || '专家节点',
      llm: node.name || '大模型节点',
      tool: node.name || '工具节点',
      knowledge: node.name || '知识库节点',
      condition: node.name || '条件判断',
      join: node.name || '汇合',
      gate: node.name || '人工确认',
    }

    const typeLabels = {
      start: '开始',
      end: '结束',
      agent: '专家',
      llm: '大模型',
      tool: '工具',
      knowledge: '知识库',
      condition: '条件',
      join: '汇合',
      gate: '确认',
    }

    const sections = sectionsFromNode(node, draft)
    const dim = sizeForNode(kind, sections)

    return {
      id: node.id,
      kind,
      title: titles[kind] || node.name || kind,
      typeLabel: typeLabels[kind] || kind,
      subtitle: kind === 'agent'
        ? (node.role || node.agentPackageId || '')
        : '',
      body,
      sections,
      // Canvas cards are summary-only; inspector owns all edits.
      fields: [],
      inputHint: text(node.inputSpec || '', 80),
      outputHint: text(node.outputSpec || '', 80),
      skillCount,
      relation: node.relation || '',
      selectable: true,
      agentPackageId: node.agentPackageId || '',
      agent: kind === 'agent' || kind === 'llm' || kind === 'tool' || kind === 'knowledge',
      wired: kind !== 'start',
      canOutput: kind !== 'end',
      canInput: kind !== 'start',
      draftNode: node,
      selected: node.id === selectedId,
      w: dim.w,
      h: dim.h,
      x: Number.isFinite(Number(node.x)) ? Number(node.x) : null,
      y: Number.isFinite(Number(node.y)) ? Number(node.y) : null,
    }
  }

  function autoLayoutBoard(placed, edges = []) {
    const byId = new Map(placed.map(n => [n.id, n]))
    const col = new Map()
    const edgeList = Array.isArray(edges) ? edges : []
    if (edgeList.length && byId.has(START_ID)) {
      col.set(START_ID, 0)
      const queue = [START_ID]
      const seen = new Set([START_ID])
      while (queue.length) {
        const id = queue.shift()
        const depth = col.get(id) || 0
        edgeList.forEach(edge => {
          if (edge.from !== id || !byId.has(edge.to) || seen.has(edge.to)) return
          seen.add(edge.to)
          col.set(edge.to, depth + 1)
          queue.push(edge.to)
        })
      }
    }
    let maxCol = 0
    placed.forEach((node, index) => {
      if (!col.has(node.id)) col.set(node.id, index)
      maxCol = Math.max(maxCol, col.get(node.id) || 0)
    })
    if (byId.has(END_ID) && !edgeList.length) col.set(END_ID, maxCol + 1)

    const columns = new Map()
    placed.forEach(node => {
      const c = col.get(node.id) || 0
      if (!columns.has(c)) columns.set(c, [])
      columns.get(c).push(node)
    })

    let width = PAD_X
    let height = PAD_Y
    ;[...columns.keys()].sort((a, b) => a - b).forEach(c => {
      const layer = columns.get(c)
      const layerW = Math.max(...layer.map(n => n.w || sizeOf(n.kind).w))
      let y = PAD_Y
      layer.forEach(node => {
        const dimW = node.w || sizeOf(node.kind).w
        const dimH = node.h || sizeOf(node.kind).h
        node.x = width + (layerW - dimW) / 2
        node.y = y
        node.w = dimW
        node.h = dimH
        y += dimH + ROW_GAP
        height = Math.max(height, y + PAD_Y)
      })
      width += layerW + COL_GAP
    })
    return { width: width + PAD_X, height }
  }

  /**
   * Align positioned nodes on an axis.
   * @param {Array<{id:string,x:number,y:number,w?:number,h?:number,kind?:string}>} nodes
   * @param {'left'|'top'|'center-h'} mode
   * @param {string[]} [targetIds] when ≥2, only those; otherwise all
   */
  function alignNodes(nodes, mode, targetIds) {
    const list = Array.isArray(nodes) ? nodes.map(n => ({
      id: n.id,
      x: Number(n.x) || 0,
      y: Number(n.y) || 0,
      w: Number(n.w) || sizeOf(n.kind).w,
      h: Number(n.h) || sizeOf(n.kind).h,
      kind: n.kind,
    })) : []
    const ids = Array.isArray(targetIds) ? targetIds.filter(Boolean) : []
    const targets = ids.length >= 2
      ? list.filter(n => ids.includes(n.id))
      : list
    if (targets.length < 2) return list.map(n => ({ id: n.id, x: n.x, y: n.y }))

    if (mode === 'left') {
      const x = Math.min(...targets.map(n => n.x))
      targets.forEach(n => { n.x = x })
    } else if (mode === 'top') {
      const y = Math.min(...targets.map(n => n.y))
      targets.forEach(n => { n.y = y })
    } else if (mode === 'center-h') {
      const mid = targets.reduce((sum, n) => sum + n.x + n.w / 2, 0) / targets.length
      targets.forEach(n => { n.x = Math.max(0, mid - n.w / 2) })
    }
    return list.map(n => ({ id: n.id, x: Math.max(0, n.x), y: Math.max(0, n.y) }))
  }

  function layoutPositions(draft) {
    const nodes = Array.isArray(draft?.nodes) ? draft.nodes : []
    const placed = nodes.map(node => {
      const visual = visualNodeFromDraft(node, '', draft)
      return { ...visual, x: null, y: null }
    })
    autoLayoutBoard(placed, Array.isArray(draft?.edges) ? draft.edges : [])
    return placed.map(n => ({ id: n.id, x: n.x, y: n.y, w: n.w, h: n.h }))
  }

  function placeFree(placed, edges = []) {
    let maxX = 0
    let maxY = 0
    let needsAuto = false
    placed.forEach(node => {
      node.w = node.w || sizeOf(node.kind).w
      node.h = node.h || sizeOf(node.kind).h
      if (node.x == null || node.y == null) needsAuto = true
    })
    if (needsAuto || placed.every(n => n.x == null)) {
      return autoLayoutBoard(placed, edges)
    }
    placed.forEach(node => {
      node.x = Math.max(0, node.x)
      node.y = Math.max(0, node.y)
      maxX = Math.max(maxX, node.x + node.w)
      maxY = Math.max(maxY, node.y + node.h)
    })
    return { width: Math.max(maxX + PAD_X, 720), height: Math.max(maxY + PAD_Y, 360) }
  }

  function buildLinearBoard(draft, options = {}) {
    const viewDraft = Array.isArray(options.knownExpertIds)
      ? { ...draft, knownExpertIds: options.knownExpertIds }
      : draft
    const composition = typeof options.toComposition === 'function'
      ? options.toComposition(viewDraft)
      : { nodes: [], edges: [] }
    const nodes = Array.isArray(viewDraft?.nodes) ? viewDraft.nodes : []
    const selectedId = text(options.selectedId, 80)
    const layers = []

    layers.push([visualNodeFromDraft({
      id: START_ID,
      kind: 'start',
      name: '开始节点',
      intent: (viewDraft.inputs || []).map(i => i.label).join(' · ') || 'user_input',
    }, selectedId, viewDraft)])

    if (nodes.length) {
      let index = 0
      while (index < nodes.length) {
        const group = [nodes[index]]
        while (index < nodes.length - 1 && nodes[index].relation === 'parallel') {
          index += 1
          group.push(nodes[index])
        }
        layers.push(group.map(node => visualNodeFromDraft(node, selectedId, viewDraft)))
        if (group.length > 1) {
          layers.push([visualNodeFromDraft({
            id: `join-${group[0].id}`,
            kind: 'join',
            name: '汇合',
            intent: `join · ${group.length} 路`,
          }, selectedId, viewDraft)])
        }
        const last = group[group.length - 1]
        if (last.relation === 'approval' && index < nodes.length - 1) {
          layers.push([visualNodeFromDraft({
            id: `gate-${last.id}`,
            kind: 'gate',
            name: '人工确认',
            approvalNote: last.approvalNote,
          }, selectedId, viewDraft)])
        }
        index += 1
      }
    }

    layers.push([visualNodeFromDraft({
      id: END_ID,
      kind: 'end',
      name: '结束节点',
      intent: (viewDraft.outputs || []).map(i => i.label).join(' · ') || 'workflow 结果',
    }, selectedId, viewDraft)])

    const placed = []
    let cursorX = PAD_X
    let maxY = 0
    layers.forEach(layer => {
      const layerW = Math.max(...layer.map(item => item.w || sizeOf(item.kind).w))
      let cursorY = PAD_Y + 40
      layer.forEach(item => {
        const dimW = item.w || sizeOf(item.kind).w
        const dimH = item.h || sizeOf(item.kind).h
        placed.push({
          ...item,
          x: cursorX + (layerW - dimW) / 2,
          y: cursorY,
          w: dimW,
          h: dimH,
        })
        cursorY += dimH + ROW_GAP
        maxY = Math.max(maxY, cursorY)
      })
      if (layer.length > 1) {
        const layerItems = placed.slice(-layer.length)
        const minY = Math.min(...layerItems.map(n => n.y))
        const maxBottom = Math.max(...layerItems.map(n => n.y + n.h))
        const span = maxBottom - minY
        const targetTop = PAD_Y + Math.max(0, (260 - span) / 2)
        const delta = targetTop - minY
        layerItems.forEach(n => { n.y += delta })
      }
      cursorX += layerW + COL_GAP
    })

    const byId = new Map(placed.map(n => [n.id, n]))
    const edgeSet = new Set()
    const edges = []
    function addEdge(from, to, extra = {}) {
      if (!from || !to || from === to) return
      if (!byId.has(from) || !byId.has(to)) return
      const key = `${from}->${to}`
      if (edgeSet.has(key)) return
      edgeSet.add(key)
      edges.push({
        id: `e-${from}-${to}`,
        from,
        to,
        branch: extra.branch || '',
        label: extra.label || '',
        path: edgePath(byId.get(from), byId.get(to)),
        selected: options.selectedEdgeId === `e-${from}-${to}`,
      })
    }
    if (nodes.length) {
      const firstGroup = [nodes[0].id]
      let i = 0
      while (i < nodes.length - 1 && nodes[i].relation === 'parallel') {
        i += 1
        firstGroup.push(nodes[i].id)
      }
      firstGroup.forEach(id => addEdge(START_ID, id))
    } else addEdge(START_ID, END_ID)

    ;(composition.edges || []).forEach(edge => {
      const from = text(edge.from, 80)
      const to = text(edge.to, 80) === 'n-terminal' ? END_ID : text(edge.to, 80)
      addEdge(from, to, edge)
    })

    return {
      startId: START_ID,
      endId: END_ID,
      nodes: placed,
      edges,
      width: Math.max(cursorX + PAD_X, 720),
      height: Math.max(maxY + PAD_Y, 360),
      empty: nodes.length === 0,
      free: false,
    }
  }

  function buildFreeBoard(draft, options = {}) {
    const selectedId = text(options.selectedId, 80)
    const selectedEdgeId = text(options.selectedEdgeId, 100)
    const viewDraft = Array.isArray(options.knownExpertIds)
      ? { ...draft, knownExpertIds: options.knownExpertIds }
      : draft
    let nodes = Array.isArray(viewDraft?.nodes) ? viewDraft.nodes.slice() : []
    if (!nodes.some(n => n.kind === 'start' || n.id === START_ID)) {
      nodes.unshift({ id: START_ID, kind: 'start', name: '开始节点', x: 72, y: 140 })
    }
    if (!nodes.some(n => n.kind === 'end' || n.id === END_ID)) {
      nodes.push({ id: END_ID, kind: 'end', name: '结束节点', x: 920, y: 140 })
    }
    const placed = nodes.map(node => visualNodeFromDraft(node, selectedId, viewDraft))
    const size = placeFree(placed, Array.isArray(viewDraft.edges) ? viewDraft.edges : [])
    const byId = new Map(placed.map(n => [n.id, n]))
    const edges = (Array.isArray(viewDraft.edges) ? viewDraft.edges : []).map(edge => {
      const from = byId.get(edge.from)
      const to = byId.get(edge.to)
      if (!from || !to) return null
      return {
        ...edge,
        path: edgePath(from, to),
        selected: edge.id === selectedEdgeId || (selectedEdgeId === `${edge.from}->${edge.to}`),
      }
    }).filter(Boolean)

    const agentLike = nodes.filter(n => !['start', 'end'].includes(n.kind) && n.kind)
    return {
      startId: START_ID,
      endId: END_ID,
      nodes: placed,
      edges,
      width: size.width,
      height: size.height,
      empty: agentLike.length === 0,
      free: true,
    }
  }

  function buildBoard(draft, options = {}) {
    if (draft?.graphMode === 'free' && Array.isArray(draft.edges)) {
      return buildFreeBoard(draft, options)
    }
    return buildLinearBoard(draft, options)
  }

  function paletteTypes() {
    return [
      { id: 'start', kind: 'start', title: '开始', hint: '入参与流程目标', system: true, group: 'flow', groupTitle: '流程' },
      { id: 'end', kind: 'end', title: '结束', hint: '出参与交付结果', system: true, group: 'flow', groupTitle: '流程' },
      { id: 'agent', kind: 'agent', title: '专家', hint: '从工作台选择完整 Agent 专家', system: false, group: 'capability', groupTitle: '能力' },
      { id: 'llm', kind: 'llm', title: '大模型', hint: '选择 Hub 模型 + Prompt，直连生成', system: false, group: 'capability', groupTitle: '能力' },
      { id: 'tool', kind: 'tool', title: '工具', hint: '绑定技能并直接执行', system: false, group: 'capability', groupTitle: '能力' },
      { id: 'knowledge', kind: 'knowledge', title: '知识库', hint: '绑定知识库并检索', system: false, group: 'capability', groupTitle: '能力' },
      { id: 'condition', kind: 'condition', title: '条件', hint: '分支：成立 / 不成立', system: false, group: 'control', groupTitle: '控制' },
      { id: 'join', kind: 'join', title: '汇合', hint: '「同时执行」后自动出现', system: true, group: 'control', groupTitle: '控制' },
      { id: 'gate', kind: 'gate', title: '人工确认', hint: '「执行前确认」后自动出现', system: true, group: 'control', groupTitle: '控制' },
    ]
  }

  return {
    START_ID,
    END_ID,
    SIZE,
    KIND_ICONS,
    MAX_NODE_H,
    SIDES,
    buildBoard,
    edgePath,
    edgePathPoints,
    sidePoint,
    chooseEdgeSides,
    paletteTypes,
    iconForKind,
    sectionsFromNode,
    fieldsFromNode,
    sizeForNode,
    visualNodeFromDraft,
    autoLayoutBoard,
    alignNodes,
    layoutPositions,
  }
})
