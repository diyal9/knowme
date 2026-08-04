'use strict'

/**
 * 工作台任务事实摘要（纯函数，无 IO）。
 * 用于 UI 展示与注入协作对话上下文，防止模型用通用商业流程编造状态。
 */

const LOCAL_APPROVER = '本机操作者（开发者）'

function asList(value) {
  return Array.isArray(value) ? value.filter(Boolean) : []
}

function firstGate(gates) {
  return asList(gates)[0] || null
}

function firstClarification(clarifications) {
  return asList(clarifications)[0] || null
}

function normalizeStatus(status) {
  return String(status || '').trim().toLowerCase()
}

function isDoneStatus(status) {
  const s = normalizeStatus(status)
  return ['done', 'finished', 'completed', 'success'].includes(s)
}

function text(value) {
  return String(value == null ? '' : value).trim()
}

function normalizePathKey(value) {
  return text(value).replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '').toLowerCase()
}

function collectInputPaths(inputs) {
  if (!inputs) return []
  if (Array.isArray(inputs)) {
    return inputs.map(item => {
      if (item && typeof item === 'object') return text(item.path || item.name || item.root || item.prd || '')
      return text(item)
    }).filter(Boolean)
  }
  if (typeof inputs !== 'object') return [text(inputs)].filter(Boolean)
  const list = []
  if (inputs.root) list.push(text(inputs.root))
  if (inputs.prd) list.push(text(inputs.prd))
  if (Array.isArray(inputs.resources)) {
    for (const item of inputs.resources) list.push(text(item))
  }
  return list.filter(Boolean)
}

function classifyWorkbenchPaths(artifacts = [], inputs = []) {
  const inputPaths = collectInputPaths(inputs)
  const inputKeys = new Set(inputPaths.map(normalizePathKey).filter(Boolean))

  const classified = asList(artifacts).map((item) => {
    let label = ''
    let pathValue = ''
    if (item && typeof item === 'object') {
      label = text(item.name || item.title || item.path || item.id || '')
      pathValue = text(item.path || item.full_path || item.fullPath || item.name || '')
    } else {
      label = text(item)
      pathValue = label
    }
    const key = normalizePathKey(pathValue || label)
    const matchedInput = !!(key && inputKeys.has(key))
    return {
      label: label || pathValue,
      path: pathValue || label,
      kind: matchedInput ? 'input' : 'artifact',
    }
  }).filter(item => item.label || item.path)

  const seenInput = new Set()
  const inputsOut = []
  for (const pathValue of inputPaths) {
    const key = normalizePathKey(pathValue)
    if (!key || seenInput.has(key)) continue
    seenInput.add(key)
    inputsOut.push({ label: pathValue, path: pathValue, kind: 'input' })
  }

  return {
    inputs: inputsOut,
    artifacts: classified.filter(item => item.kind === 'artifact'),
  }
}

/**
 * @param {object} input
 * @param {string} [input.status]
 * @param {string} [input.currentNode]
 * @param {string[]} [input.agents]
 * @param {Array|string[]} [input.artifacts]
 * @param {object|Array|string[]} [input.inputs]
 * @param {boolean} [input.degraded]
 * @param {string} [input.degradedReason]
 * @param {object|null} [input.gate]
 * @param {object|null} [input.clarification]
 * @param {Array} [input.pendingGates]
 * @param {Array} [input.pendingClarifications]
 */
function buildWorkbenchTaskBrief(input = {}) {
  const gate = input.gate || firstGate(input.pendingGates)
  const clarification = input.clarification || firstClarification(input.pendingClarifications)
  const status = String(input.status || '').trim() || '进行中'
  const agents = asList(input.agents).map(String)
  const classified = classifyWorkbenchPaths(input.artifacts, input.inputs)
  const artifacts = classified.artifacts.map(item => item.label || item.path).filter(Boolean)
  const inputPaths = classified.inputs.map(item => item.label || item.path).filter(Boolean)
  const degraded = input.degraded === true

  let waitingKind = 'none'
  let waitingTitle = ''
  let waitingDetail = ''
  let nextAction = ''

  if (degraded) {
    waitingDetail = text(input.degradedReason)
      || '流程详情暂不可用：激活内容源可能与工作流不匹配。'
    nextAction = '打开设置 → 内容源，确认激活源包含对应 .cursor/workflows/，再刷新任务。'
  } else if (gate) {
    waitingKind = 'gate'
    waitingTitle = String(gate.title || gate.node || gate.node_id || gate.id || '审批节点').trim()
    waitingDetail = `审批方：${LOCAL_APPROVER}。可在流程面板选择：通过 / 修订 / 打回。`
    nextAction = '在右侧流程操作区完成审批，不要假设存在财务、法务、运营等外部审批人。'
  } else if (clarification) {
    waitingKind = 'clarification'
    waitingTitle = String(clarification.question || clarification.node || clarification.node_id || clarification.id || '需要补充信息').trim()
    waitingDetail = '流程在等待本机操作者补充澄清信息。'
    nextAction = '在右侧流程操作区回答澄清问题，或在协作区补充材料后继续。'
  } else if (isDoneStatus(status)) {
    waitingDetail = '任务已结束，当前没有待审批或待澄清节点。'
    nextAction = artifacts.length
      ? '可查看右侧任务产物，或返回流程列表。'
      : '可返回流程列表；当前没有可打开的任务产物。'
  } else {
    waitingDetail = '流程仍在执行或等待下一节点，尚未出现本机审批/澄清门禁。'
    nextAction = '关注右侧工作流 Graph 与操作按钮；不要用通用商业活动流程臆测卡点。'
  }

  const rawNode = String(input.currentNode || '').trim()
  let currentNodeLabel = rawNode
  if (degraded) {
    currentNodeLabel = '流程详情暂不可用'
  } else if (!currentNodeLabel) {
    if (waitingKind === 'gate') currentNodeLabel = waitingTitle || '等待本机审批'
    else if (waitingKind === 'clarification') currentNodeLabel = '等待澄清'
    else if (isDoneStatus(status)) currentNodeLabel = '已完成'
    else currentNodeLabel = '流程执行中'
  } else if (
    isDoneStatus(status)
    && waitingKind === 'none'
    && /等待流程推进|waiting/i.test(currentNodeLabel)
  ) {
    currentNodeLabel = '已完成'
  }

  // 用户向结论：一句话 + 语义色，供界面「当前状态」区直接展示（不暴露内部事实串）
  const failed = ['failed', 'error', 'rejected'].includes(normalizeStatus(status))
  let tone = 'running'
  let headline = '正在执行'
  if (failed) {
    tone = 'error'
    headline = '执行失败，需要处理'
  } else if (degraded) {
    tone = 'muted'
    headline = isDoneStatus(status) ? '已结束 · 流程详情暂不可用' : '流程详情暂不可用'
  } else if (waitingKind === 'gate') {
    tone = 'waiting'
    headline = '等待你确认'
  } else if (waitingKind === 'clarification') {
    tone = 'waiting'
    headline = '等待你补充信息'
  } else if (isDoneStatus(status)) {
    tone = 'done'
    headline = '任务已完成'
  }

  const lines = [
    `状态：${status}`,
    `当前节点：${currentNodeLabel}`,
    waitingKind === 'gate' ? `等待类型：本机审批门禁（${waitingTitle}）` : '',
    waitingKind === 'clarification' ? `等待类型：澄清（${waitingTitle}）` : '',
    waitingKind === 'none' ? '等待类型：无' : '',
    waitingDetail,
    agents.length ? `参与助手：${agents.join('、')}` : '参与助手：由工作流按需调度（未声明具体角色时禁止臆造）',
    artifacts.length ? `已有产物：${artifacts.join('、')}` : '已有产物：暂无或未同步',
    inputPaths.length ? '任务输入：已配置启动输入（非产物，禁止引导用户当作产物打开）' : '',
    `建议下一步：${nextAction}`,
    '禁止把任务输入路径当作产物推荐给用户查看。',
  ].filter(Boolean)

  return {
    status,
    tone,
    headline,
    currentNodeLabel,
    waitingKind,
    waitingTitle,
    waitingDetail,
    nextAction,
    approver: waitingKind === 'gate' ? LOCAL_APPROVER : '',
    agents,
    artifacts,
    inputs: inputPaths,
    pathItems: classified,
    factualBrief: lines.join('\n'),
  }
}

function workbenchGroundingRules() {
  return [
    '【工作台任务事实门禁 · 必须遵守】',
    '1. 解释任务状态时，只能引用上方「任务事实」以及用户本轮明确提供的材料；禁止用通用商业活动/审批流程模板填补。',
    '2. 禁止编造未在任务事实或参与助手中出现的组织角色与部门（例如财务、法务、运营、市场，除非事实中已写明）。',
    '3. 本机工作流的 gate 审批方是「本机操作者（开发者）」，不是外部审批链。',
    '4. 若任务事实或知识库未提供某信息，直接说明「本地工作流/知识库未提供」，不要猜测。',
    '5. 优先引导用户使用流程面板的审批、澄清与产物操作；协作对话只用于补充要求、材料或调用助手。',
    '6. 仅「已有产物」可推荐打开；「任务输入」路径不是产物，禁止写成「查看产物 ingest/…」。',
  ].join('\n')
}

const workbenchTaskBriefApi = {
  LOCAL_APPROVER,
  classifyWorkbenchPaths,
  buildWorkbenchTaskBrief,
  workbenchGroundingRules,
}

if (typeof module === 'object' && module.exports) {
  module.exports = workbenchTaskBriefApi
}
if (typeof window !== 'undefined') {
  window.WorkbenchTaskBrief = workbenchTaskBriefApi
}
