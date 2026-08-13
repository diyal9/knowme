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

function clarificationNodeId(raw = {}) {
  return text(raw.node || raw.node_id || raw.nodeId || raw.id)
}

function looksLikeBareNodeLabel(value, node) {
  const label = text(value)
  const id = text(node)
  if (!label) return true
  if (id && label.toLowerCase() === id.toLowerCase()) return true
  // daemon 节点 id 常见形态：n3-proto / n1-inruntime-cases
  if (/^n\d+[-_][a-z0-9][a-z0-9_-]*$/i.test(label) && (!id || label === id)) return true
  return false
}

/**
 * Daemon 过程日志 / 状态短语，不是给人看的澄清问题。
 * 例：need_input n3-proto: answer file present
 */
function looksLikeClarificationTechnicalStatus(value) {
  const label = text(value)
  if (!label) return true
  const compact = label.replace(/\s+/g, ' ')
  if (/^answer\s+(file\s+)?(already\s+)?present$/i.test(compact)) return true
  if (/^awaiting\b/i.test(compact)) return true
  if (/^TIMEOUT\b/i.test(compact)) return true
  if (/^question\s+sent\s+to\b/i.test(compact)) return true
  if (/^need_input\b/i.test(compact)) return true
  if (/^parallel\s+child\b/i.test(compact)) return true
  if (/^park(ed)?\b/i.test(compact)) return true
  if (/^status\s*:\s*NEED_INPUT\b/i.test(compact)) return true
  // 整段仅由上述技术词组成（日志截断后残留）
  if (/^(answer|awaiting|timeout|present|waiting|blocked|need_input)([\s:_-]+[\w./-]+)*$/i.test(compact)) {
    return true
  }
  return false
}

/**
 * 用户在澄清等待时发送的“元问题”（在问要填什么），不应当作澄清答案提交，
 * 也不应当展示为 Daemon 提出的问题。
 */
function looksLikeClarificationMetaQuestion(rawText) {
  const value = text(rawText)
  if (!value) return false
  if (value.length > 80) return false
  if (/[?？]/.test(value)) {
    return /补充|澄清|要填|填什么|问什么|什么意思|怎么填|需要我|该写|该回|什么内容|什么信息|不清楚|不明白|什么呀|啥/.test(value)
  }
  return /^(需要我补充什么|要补充什么|补充什么|填什么|问的是什么|什么意思|怎么填)[。.!！]*$/i.test(value)
}

function isUsableClarificationQuestion(value, node) {
  const label = text(value)
  if (!label) return false
  if (looksLikeBareNodeLabel(label, node)) return false
  if (looksLikeClarificationTechnicalStatus(label)) return false
  if (looksLikeClarificationMetaQuestion(label)) return false
  return true
}

function pushUsableQuestion(out, seen, value, node) {
  const label = text(value)
  if (!isUsableClarificationQuestion(label, node)) return
  const key = label.toLowerCase()
  if (seen.has(key)) return
  seen.add(key)
  out.push(label)
}

/**
 * 规范化 Daemon pending_clarifications / 本地缓存里的问题列表。
 * Daemon API 主字段是 `questions: string[]`，不是单个 `question`。
 */
function normalizeClarificationQuestions(raw = {}) {
  const node = clarificationNodeId(raw)
  const out = []
  const seen = new Set()
  const list = asList(raw.questions)
  for (const item of list) {
    if (item && typeof item === 'object') {
      pushUsableQuestion(out, seen, item.text || item.question || item.prompt || item, node)
    } else {
      pushUsableQuestion(out, seen, item, node)
    }
  }
  if (out.length) return out

  const scalars = [
    raw.question,
    raw.prompt,
    raw.promptText,
    raw.filePrompt,
    raw.message,
    raw.text,
    raw.body,
    raw.content,
    raw.detail,
    raw.summary,
    raw.hint,
    raw.title,
    raw.reason,
  ]
  for (const item of scalars) {
    const value = text(item)
    if (!value) continue
    // 多行标量：按行拆出列表项
    if (/\n/.test(value) && /(^|\n)\s*[-*]\s+/.test(value)) {
      for (const line of value.split(/\r?\n/)) {
        const m = line.match(/^\s*[-*]\s+(.+)$/)
        if (m) pushUsableQuestion(out, seen, m[1], node)
      }
      continue
    }
    pushUsableQuestion(out, seen, value, node)
  }
  return out
}

/**
 * 从澄清对象字段中提取“真正要问用户的问题”，排除裸节点 id / 技术态。
 */
function clarificationQuestionFromFields(raw = {}) {
  const questions = normalizeClarificationQuestions(raw)
  if (!questions.length) return ''
  if (questions.length === 1) return questions[0]
  return questions.map((q, i) => `${i + 1}. ${q}`).join('\n')
}

function clarificationFileCandidates(node, slug) {
  const id = text(node)
  if (!id) return []
  const task = text(slug)
  const out = []
  // 工作区 blob 相对仓库根：daemon sidecar 在 .nine/.daemon-runtime/{slug}/
  if (task) {
    out.push(
      `.nine/.daemon-runtime/${task}/.dispatch/${id}.return.txt`,
      `.nine/.daemon-runtime/${task}/.clarifications/${id}.md`,
    )
  }
  // 兼容旧相对路径 / 已挂载到 cwd 的副本
  out.push(
    `.dispatch/${id}.return.txt`,
    `dispatch/${id}.return.txt`,
    `.clarifications/${id}.md`,
    `clarifications/${id}.md`,
    `.clarifications/${id}.txt`,
    `.nine/clarifications/${id}.md`,
  )
  return out
}

/**
 * 从 NEED_INPUT RETURN / 澄清文件中提取问题列表。
 */
function extractQuestionsFromDaemonText(rawText, node) {
  const value = String(rawText || '')
  if (!text(value)) return []
  const out = []
  const seen = new Set()

  // ## 原始问题（write_answer 模板）
  const originalMatch = value.match(/##\s*原始问题\s*\n([\s\S]*?)(?=\n##\s|\n#\s|$)/i)
  if (originalMatch) {
    for (const line of originalMatch[1].split(/\r?\n/)) {
      const m = line.match(/^\s*[-*]\s+(.+)$/)
      if (m) pushUsableQuestion(out, seen, m[1], node)
    }
    if (out.length) return out
  }

  // questions: YAML-ish 列表（RETURN 块）
  const lines = value.split(/\r?\n/)
  let inQuestions = false
  for (const line of lines) {
    if (/^\s*questions\s*:/i.test(line)) {
      inQuestions = true
      const inline = line.replace(/^\s*questions\s*:\s*/i, '').trim()
      if (inline && inline !== '|' && inline !== '>') {
        for (const part of inline.split(/\s*;\s*|\s*\|\s*/)) {
          pushUsableQuestion(out, seen, part.replace(/^\[|\]$/g, ''), node)
        }
      }
      continue
    }
    if (!inQuestions) continue
    const item = line.match(/^\s*[-*]\s+(.+)$/)
    if (item) {
      pushUsableQuestion(out, seen, item[1], node)
      continue
    }
    if (text(line) && !/^\s/.test(line) && !/^\s*#/.test(line)) break
  }
  if (out.length) return out

  // 纯答复文件：# 澄清答复 / ## 答复 — 没有原始问题时不得整文件当问题
  if (/^#\s*澄清答复/m.test(value) || /^##\s*答复\s*$/m.test(value)) {
    return []
  }

  return out
}

function formatClarificationQuestions(questions) {
  const list = asList(questions).map(text).filter(Boolean)
  if (!list.length) return ''
  if (list.length === 1) return list[0]
  return list.map((q, i) => `${i + 1}. ${q}`).join('\n')
}

function extractPromptFromClarificationFile(rawText, node) {
  const questions = extractQuestionsFromDaemonText(rawText, node)
  if (questions.length) return formatClarificationQuestions(questions)

  let value = text(rawText)
  if (!value) return ''
  // 答复文件禁止整段回填为「问题」
  if (/^#\s*澄清答复/m.test(value) || /^##\s*答复\s*$/m.test(value)) return ''
  // 去掉纯答案占位，保留问题正文
  value = value
    .replace(/^\s*#{1,6}\s*(your\s+)?answer\s*:?\s*$/gim, '')
    .replace(/^\s*>?\s*请在下方填写.*$/gim, '')
    .trim()
  if (!value) return ''
  if (!isUsableClarificationQuestion(value, node)) return ''
  // 过长的 dispatch prompt / stdout 不当作单句问题
  if (value.length > 1200 && !/[?？]/.test(value.slice(0, 400))) return ''
  return value.slice(0, 4000)
}

function extractClarificationHintFromLogs(logText, node) {
  const id = text(node)
  const lines = String(logText || '').split(/\r?\n/).map(line => text(line)).filter(Boolean)
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i]
    if (!/need_input|clarif/i.test(line)) continue
    if (id && !line.includes(id)) continue
    // 跳过仅声明 awaiting 文件 / need_input 节点的技术行
    if (/awaiting\s+\.?clarifications\//i.test(line) && !/[?？]/.test(line)) continue
    if (/need_input\s+node\s*=/i.test(line) && !/[?？]/.test(line)) continue
    if (/^\[?\d{1,2}:\d{2}(?::\d{2})?\]?\s*action\[\d+\]:\s*need_input\b/i.test(line) && !/[?？]/.test(line)) {
      continue
    }
    if (/answer\s+(file\s+)?(already\s+)?present/i.test(line) && !/[?？]/.test(line)) continue
    if (/question\s+sent\s+to\b/i.test(line) && !/[?？]/.test(line)) continue
    if (/\bTIMEOUT\b/i.test(line) && !/[?？]/.test(line)) continue
    if (/parallel\s+child\b/i.test(line) && !/[?？]/.test(line)) continue
    const stripped = line
      .replace(/^\[?\d{1,2}:\d{2}(?::\d{2})?\]?\s*/u, '')
      .replace(/^action\[\d+\]:\s*/i, '')
      .replace(/^need_input\s+[^\s:]+:\s*/i, '')
      .replace(/^need_input\s+node\s*=\s*[^\s]+\s*/i, '')
      .trim()
    if (!isUsableClarificationQuestion(stripped, id)) continue
    // 日志提示须像真实问句 / 中文说明，拒绝纯英文短状态
    if (/^[a-z0-9 _./:-]+$/i.test(stripped) && stripped.length < 48 && !/[?？]/.test(stripped)) {
      continue
    }
    return stripped.slice(0, 800)
  }
  return ''
}

/**
 * 是否应把本轮发送自动当作 Daemon 澄清答案。
 * 无明确问题文案，或内容是元问题时，MUST NOT 自动提交。
 */
function shouldAutoSubmitDaemonClarification(rawText, clarification = {}) {
  const display = resolveClarificationDisplay(clarification)
  if (!display.hasExplicitQuestion) return false
  if (looksLikeClarificationMetaQuestion(rawText)) return false
  return !!text(rawText)
}

/**
 * @returns {{ node: string, question: string, questions: string[], title: string, detail: string, hasExplicitQuestion: boolean }}
 */
function resolveClarificationDisplay(raw = {}) {
  const node = clarificationNodeId(raw)
  const questions = normalizeClarificationQuestions(raw)
  const question = formatClarificationQuestions(questions)
  const hasExplicitQuestion = questions.length > 0
  const title = hasExplicitQuestion
    ? (questions.length === 1 ? questions[0] : '请补充以下信息')
    : (node ? `节点「${node}」需要你补充信息` : '请补充任务所需信息')
  const detail = hasExplicitQuestion
    ? (questions.length > 1 ? question : '')
    : '管线未给出具体问题文案。请结合右侧「过程日志」与上方说明作答；也可补充目标、约束或缺失材料后发送。'
  return { node, question, questions, title, detail, hasExplicitQuestion }
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
  const terminalKind = normalizeStatus(input.terminalKind || '')
  const agents = asList(input.agents).map(String)
  const classified = classifyWorkbenchPaths(input.artifacts, input.inputs)
  const artifacts = classified.artifacts.map(item => item.label || item.path).filter(Boolean)
  const inputPaths = classified.inputs.map(item => item.label || item.path).filter(Boolean)
  const degraded = input.degraded === true
  const failed = terminalKind === 'failure'
    || ['failed', 'error', 'rejected'].includes(normalizeStatus(status))
  const cancelled = terminalKind === 'cancelled'
    || ['cancelled', 'canceled'].includes(normalizeStatus(status))
  // HITL 优先：有澄清/门禁时不得标 succeeded（对齐 Daemon WebUI「待处理」）
  const hasHitl = !!(gate || clarification)
  const succeeded = !failed && !cancelled && !hasHitl && (
    terminalKind === 'success' || isDoneStatus(status)
  )

  let waitingKind = 'none'
  let waitingTitle = ''
  let waitingDetail = ''
  let nextAction = ''

  if (degraded && !failed && !cancelled && !succeeded && !hasHitl) {
    waitingDetail = text(input.degradedReason)
      || '流程详情暂不可用：管线服务工作流定义未能加载。'
    nextAction = '打开设置 → 管线服务安装目录，确认已配置后刷新任务。'
  } else if (gate && !failed && !cancelled) {
    waitingKind = 'gate'
    waitingTitle = String(gate.title || gate.node || gate.node_id || gate.id || '审批节点').trim()
    waitingDetail = `审批方：${LOCAL_APPROVER}。请在左侧对话卡片选择：通过 / 修订 / 打回。`
    nextAction = '在左侧对话中完成审批，不要假设存在财务、法务、运营等外部审批人。'
  } else if (clarification && !failed && !cancelled) {
    waitingKind = 'clarification'
    const display = resolveClarificationDisplay(clarification)
    waitingTitle = display.hasExplicitQuestion
      ? (display.questions.length === 1 ? display.questions[0] : display.question)
      : display.title
    waitingDetail = display.hasExplicitQuestion
      ? '流程在等待本机操作者在左侧对话中补充澄清信息。'
      : (display.detail || '流程在等待本机操作者在左侧对话中补充澄清信息。')
    nextAction = '在左侧对话输入框直接回复澄清问题并发送；发送后任务会继续。'
  } else if (failed) {
    waitingDetail = '任务已停止，保留当前日志和上下文，可检查原因后重新执行。'
    nextAction = '检查任务日志和错误原因；确认目标、资料或 CURSOR_API_KEY 后可重新执行。'
  } else if (cancelled) {
    waitingDetail = '任务已取消，原任务不会继续推进。'
    nextAction = '确认目标和资料后重新启动任务。'
  } else if (succeeded) {
    waitingDetail = '任务已结束，当前没有待审批或待澄清节点。'
    nextAction = artifacts.length
      ? '可查看右侧任务产物，或返回流程列表。'
      : '可返回流程列表；当前没有可打开的任务产物。'
  } else {
    waitingDetail = '流程仍在执行或等待下一节点，尚未出现本机审批/澄清门禁。'
    nextAction = '关注右侧步骤进度与过程日志；需要你确认时会在左侧对话出现操作卡。不要用通用商业活动流程臆测卡点。'
  }

  const rawNode = String(input.currentNode || '').trim()
  let currentNodeLabel = rawNode
  if (degraded && !failed && !cancelled && !succeeded) {
    currentNodeLabel = '流程详情暂不可用'
  } else if (!currentNodeLabel) {
    if (waitingKind === 'gate') currentNodeLabel = waitingTitle || '等待本机审批'
    else if (waitingKind === 'clarification') currentNodeLabel = '等待澄清'
    else if (failed) currentNodeLabel = '执行失败'
    else if (cancelled) currentNodeLabel = '已取消'
    else if (succeeded) currentNodeLabel = '已完成'
    else currentNodeLabel = '流程执行中'
  } else if (
    succeeded
    && waitingKind === 'none'
    && /等待流程推进|waiting/i.test(currentNodeLabel)
  ) {
    currentNodeLabel = '已完成'
  }

  // 用户向结论：一句话 + 语义色，供界面「当前状态」区直接展示（不暴露内部事实串）
  let tone = 'running'
  let headline = '正在执行'
  if (failed) {
    tone = 'error'
    headline = '执行失败，需要处理'
  } else if (cancelled) {
    tone = 'muted'
    headline = '任务已取消，可重新启动'
  } else if (degraded) {
    tone = 'muted'
    headline = succeeded ? '已结束 · 流程详情暂不可用' : '流程详情暂不可用'
  } else if (waitingKind === 'gate') {
    tone = 'waiting'
    headline = '等待你确认'
  } else if (waitingKind === 'clarification') {
    tone = 'waiting'
    headline = '等待你补充信息'
  } else if (succeeded) {
    tone = 'done'
    headline = '任务已完成'
  }

  const lines = [
    `状态：${failed ? 'failed' : (cancelled ? 'cancelled' : (succeeded ? 'done' : status))}`,
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
    '1. 解释任务状态时，只能引用上方「任务事实」、下方「本轮可用来源」、用户本轮明确提供的材料，以及本轮已返回的工具结果；禁止用通用商业活动/审批流程模板填补。',
    '2. 禁止编造未在任务事实或参与助手中出现的组织角色与部门（例如财务、法务、运营、市场，除非事实中已写明）。',
    '3. 本机工作流的 gate 审批方是「本机操作者（开发者）」，不是外部审批链。',
    '4. 若任务事实或知识库未提供某信息，直接说明「本地工作流/知识库未提供」，不要猜测。',
    '5. 优先引导用户在左侧对话完成审批与澄清；协作对话也可用于补充材料或调用助手。',
    '6. 仅「已有产物」可推荐打开；「任务输入」路径不是产物，禁止写成「查看产物 ingest/…」。',
    '7. 【第一性原则】拆解问题时按顺序：①已验证事实（引用具体来源）→ ②信息缺口（缺什么、为何缺）→ ③可验证下一步（用户可执行的动作）。禁止跳过事实直接给结论。',
    '8. 【引用来源】凡陈述任务状态、产物、日志、澄清内容或外部材料，MUST 在正文用「依据：…」点名来源，并确保该来源出现在「本轮可用来源」中；禁止无来源的断言。',
    '9. 工作台对话零幻觉：不得把常识、训练记忆或相似项目经验当作本任务事实。',
  ].join('\n')
}

/**
 * 构建工作台本轮可展示/可引用的来源列表（纯函数）。
 * @returns {Array<{ id: string, kind: string, label: string, detail?: string }>}
 */
function buildWorkbenchCitations(context = {}, extras = {}) {
  const out = []
  const seen = new Set()
  const push = (item) => {
    const label = text(item.label)
    if (!label) return
    const id = text(item.id) || `${item.kind || 'src'}:${label}`
    const key = id.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    out.push({
      id,
      kind: text(item.kind) || 'context',
      label: label.slice(0, 120),
      detail: text(item.detail).slice(0, 240),
    })
  }

  const factual = text(context.factualBrief)
  if (factual) {
    push({
      id: 'task-facts',
      kind: 'task-facts',
      label: '任务事实',
      detail: factual.split('\n').slice(0, 3).join(' · ').slice(0, 180),
    })
  }

  const waiting = text(context.waitingKind)
  if (waiting && waiting !== 'none') {
    const title = text(context.waitingTitle) || waiting
    push({
      id: `waiting:${waiting}`,
      kind: 'waiting',
      label: waiting === 'gate' ? '审批门禁' : (waiting === 'clarification' ? '澄清等待' : '等待状态'),
      detail: title,
    })
  }

  const clarifyQ = clarificationQuestionFromFields(context.clarification || {})
  if (clarifyQ) {
    push({
      id: 'clarification-question',
      kind: 'clarification',
      label: '澄清问题',
      detail: clarifyQ.slice(0, 180),
    })
  }

  const classified = classifyWorkbenchPaths(
    context.artifacts,
    context.inputs || (context.context && context.context.inputs),
  )
  for (const item of classified.artifacts.slice(0, 4)) {
    push({
      id: `artifact:${item.path || item.label}`,
      kind: 'artifact',
      label: `产物 ${item.label || item.path}`,
      detail: item.path || '',
    })
  }
  for (const item of classified.inputs.slice(0, 2)) {
    push({
      id: `input:${item.path || item.label}`,
      kind: 'input',
      label: `任务输入 ${item.label || item.path}`,
      detail: '输入材料（非产物）',
    })
  }

  const slug = text(context.slug || context.name)
  if (slug) {
    push({
      id: `task:${slug}`,
      kind: 'task',
      label: `任务 ${slug}`,
      detail: text(context.workflowName || context.workflow || context.intent),
    })
  }

  const attachmentName = text(extras.attachmentName)
  if (attachmentName) {
    push({
      id: `attachment:${attachmentName}`,
      kind: 'attachment',
      label: `用户附加 ${attachmentName}`,
    })
  }

  const toolSources = asList(extras.toolSources)
  for (const src of toolSources.slice(0, 5)) {
    if (src && typeof src === 'object') {
      push({
        id: `tool:${src.tool || src.name || src.label}`,
        kind: 'tool',
        label: text(src.label || src.tool || src.name) || '工具结果',
        detail: text(src.detail || src.status),
      })
    } else {
      push({ id: `tool:${src}`, kind: 'tool', label: text(src) })
    }
  }

  return out.slice(0, 8)
}

function formatWorkbenchCitationsForPrompt(citations) {
  const list = asList(citations)
  if (!list.length) {
    return '本轮可用来源：无（仅可依据用户本轮消息；不足则说明未提供）'
  }
  const lines = list.map((item, i) => {
    const detail = text(item.detail)
    return `${i + 1}. [${item.kind || 'context'}] ${item.label}${detail ? ` — ${detail}` : ''}`
  })
  return ['【本轮可用来源 · 回答时必须引用】', ...lines].join('\n')
}

const workbenchTaskBriefApi = {
  LOCAL_APPROVER,
  classifyWorkbenchPaths,
  clarificationNodeId,
  normalizeClarificationQuestions,
  clarificationQuestionFromFields,
  clarificationFileCandidates,
  extractQuestionsFromDaemonText,
  extractPromptFromClarificationFile,
  extractClarificationHintFromLogs,
  looksLikeClarificationTechnicalStatus,
  looksLikeClarificationMetaQuestion,
  isUsableClarificationQuestion,
  shouldAutoSubmitDaemonClarification,
  resolveClarificationDisplay,
  buildWorkbenchTaskBrief,
  workbenchGroundingRules,
  buildWorkbenchCitations,
  formatWorkbenchCitationsForPrompt,
}

if (typeof module === 'object' && module.exports) {
  module.exports = workbenchTaskBriefApi
}
if (typeof window !== 'undefined') {
  window.WorkbenchTaskBrief = workbenchTaskBriefApi
}
