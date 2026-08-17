'use strict'

/**
 * Daemon 管线执行间：过程对话 + 审阅制品投影（纯函数）
 */

;(function initWorkbenchDaemonReview(root, factory) {
  const api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  if (root) root.WorkbenchDaemonReview = api
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null), function createWorkbenchDaemonReview() {
const TAB_IDS = ['steps', 'artifacts', 'changes', 'events', 'logs']
const TAB_LABELS = {
  steps: '步骤',
  artifacts: '制品',
  changes: '变更',
  events: '事件',
  logs: '过程日志',
}
const MAX_LOG_LINES = 200
const MAX_PROGRESS_CHARS = 12000

function text(value) {
  return String(value == null ? '' : value).trim()
}

function recommendTab(input = {}) {
  const steps = Array.isArray(input.steps) ? input.steps : []
  const artifacts = Array.isArray(input.artifacts) ? input.artifacts : []
  const state = text(input.status).toLowerCase()
  const done = ['done', 'finished', 'completed', 'success'].includes(state)
  const failed = ['failed', 'error'].includes(state)
  if (done && artifacts.length) return 'artifacts'
  if (failed) return 'logs'
  if (steps.length) return 'steps'
  if (artifacts.length) return 'artifacts'
  return 'steps'
}

function normalizeLogLines(raw, limit = MAX_LOG_LINES) {
  const source = text(raw)
  if (!source || source === '(no log yet)') return []
  const lines = source.split(/\r?\n/).filter(line => line.trim())
  if (lines.length <= limit) return lines
  return lines.slice(-limit)
}

function normalizeProgressText(raw) {
  let source = text(raw)
  if (!source || source === '(no progress yet)') return ''
  if (source.length > MAX_PROGRESS_CHARS) {
    source = `${source.slice(0, MAX_PROGRESS_CHARS)}\n…（摘要已截断）`
  }
  return source
}

function projectProcessTranscript(input = {}) {
  const slug = text(input.slug)
  const progressText = normalizeProgressText(input.progressText)
  const logLines = normalizeLogLines(input.logsText)
  const status = text(input.status)
  // tip 已弃用：过程日志 Tab 不再展示顶部引导文案
  const tip = ''

  return {
    slug,
    tip,
    progress: {
      title: '全部过程',
      empty: !progressText,
      text: progressText,
      emptyLabel: '暂无过程摘要（任务运行后将自动生成）。',
    },
    logs: {
      title: '运行日志',
      empty: !logLines.length,
      lines: logLines,
      emptyLabel: status && ['done', 'finished', 'completed', 'success'].includes(status.toLowerCase())
        ? '任务已结束。日志可能未保留，请查看 progress 摘要或右侧制品。'
        : '（等待日志输出…）',
    },
  }
}

function projectSteps(input = {}) {
  const nodes = Array.isArray(input.nodes) ? input.nodes : []
  const statusMap = input.statusSteps && typeof input.statusSteps === 'object'
    ? input.statusSteps
    : {}
  return nodes.map((node, index) => {
    const id = text(node && (node.id || node.node || node.name) || `step-${index + 1}`)
    const fromStatus = text(statusMap[id] || statusMap[node && node.id] || '')
    const status = text(node && node.status || fromStatus || 'pending').toLowerCase()
    const raw = node && typeof node === 'object' ? node : {}
    return {
      id,
      label: text(raw.label || raw.title || raw.name || id),
      meta: text(raw.meta || raw.type || raw.role || '步骤'),
      status,
      owner: text(raw.owner),
      type: text(raw.type),
      handoff: text(raw.handoff),
      outputLabel: text(raw.outputLabel),
      outputTitle: text(raw.outputTitle),
      degraded: !!raw.degraded,
      degradedPlaceholder: !!raw.degradedPlaceholder,
    }
  })
}

function projectArtifacts(list = []) {
  return (Array.isArray(list) ? list : []).map((item, index) => {
    if (typeof item === 'string') {
      return {
        id: item,
        name: item,
        path: item,
        size: null,
        kind: 'file',
        local: true,
        downloadUrl: '',
      }
    }
    const raw = item && typeof item === 'object' ? item : {}
    const path = text(raw.path || raw.full_path || raw.fullPath)
    const downloadUrl = text(raw.downloadUrl || raw.download_url || raw.url)
    return {
      id: text(raw.id || path || downloadUrl || `artifact-${index + 1}`),
      name: text(raw.name || raw.title || path || downloadUrl || '未命名制品'),
      path,
      size: Number.isFinite(Number(raw.size)) ? Number(raw.size) : null,
      kind: text(raw.kind || raw.type || (downloadUrl ? 'url' : 'file')),
      local: raw.local === true || (!!path && !downloadUrl),
      downloadUrl,
    }
  })
}

/**
 * 制品 Tab 空态：按运行状态给出可读说明（不伪造文件行）。
 * @returns {{ title: string, body: string, showStepsCta: boolean }}
 */
function artifactEmptyState(status) {
  const state = text(status).toLowerCase()
  if (['failed', 'error'].includes(state)) {
    return {
      title: '暂无制品',
      body: '任务未能产出可展示的文件。建议先查看「步骤」定位失败节点。',
      showStepsCta: true,
    }
  }
  if (['cancelled', 'canceled'].includes(state)) {
    return {
      title: '暂无制品',
      body: '任务已取消，未留下可展示的产出文件。',
      showStepsCta: true,
    }
  }
  if (['running', 'waiting', 'queued', 'pending', 'active'].includes(state)) {
    return {
      title: '尚无制品',
      body: '管线仍在执行。产出文件生成后会显示在此文件夹。',
      showStepsCta: true,
    }
  }
  if (['done', 'finished', 'completed', 'success'].includes(state)) {
    return {
      title: '暂无制品',
      body: '任务已结束，但未发现可展示的产出文件。可查看「步骤」或「变更」确认执行结果。',
      showStepsCta: true,
    }
  }
  return {
    title: '暂无制品',
    body: '当前没有可展示的产出文件。',
    showStepsCta: true,
  }
}

function projectEvents(list = {}) {
  const source = Array.isArray(list)
    ? list
    : (list && Array.isArray(list.events) ? list.events : [])
  return source.slice(-100).map((item, index) => {
    const raw = item && typeof item === 'object' ? item : { message: item }
    return {
      id: text(raw.id || raw.event_id || `event-${index + 1}`),
      type: text(raw.type || raw.kind || raw.event || 'event'),
      message: text(raw.message || raw.summary || raw.text || raw.detail || ''),
      at: text(raw.at || raw.ts || raw.time || raw.created_at || raw.createdAt || ''),
    }
  })
}

function projectChanges(body = {}) {
  const raw = body && typeof body === 'object' ? body : {}
  const files = Array.isArray(raw.files)
    ? raw.files
    : (Array.isArray(raw.changes) ? raw.changes : [])
  const tree = Array.isArray(raw.tree) ? raw.tree : []
  const summary = text(raw.summary || raw.message || '')
  const normalizedFiles = files.map((item, index) => {
    if (typeof item === 'string') {
      return { path: item, status: 'modified', id: `chg-${index + 1}` }
    }
    const path = text(item && (item.path || item.file || item.name))
    return {
      id: text(item && (item.id || path) || `chg-${index + 1}`),
      path,
      status: text(item && (item.status || item.change || item.kind) || 'modified'),
    }
  }).filter(item => item.path)
  return {
    summary: summary || (normalizedFiles.length
      ? `${normalizedFiles.length} 个文件变更`
      : (tree.length ? '有变更树' : '')),
    files: normalizedFiles,
    tree,
    empty: !normalizedFiles.length && !tree.length,
  }
}

/**
 * 左栏紧凑「管线进度」卡（不含全文日志）。
 * @returns {{
 *   kind: 'chat-progress',
 *   title: string,
 *   progressLine: string,
 *   currentLabel: string,
 *   statusLabel: string,
 *   ratio: number,
 *   waitingKind: string,
 *   tip: string,
 *   done: number,
 *   total: number,
 * }}
 */
function projectChatProgressCard(input = {}) {
  const steps = Array.isArray(input.steps) && input.steps.length
    ? input.steps
    : projectSteps({ nodes: input.nodes, statusSteps: input.statusSteps })
  const total = steps.length
  const doneStatuses = new Set(['done', 'completed', 'success', 'finished', 'ok'])
  const activeStatuses = new Set(['active', 'running', 'doing', 'in_progress', 'current'])
  const errorStatuses = new Set(['failed', 'error'])
  let done = 0
  let currentLabel = text(input.currentLabel)
  let hasError = false
  for (const step of steps) {
    const status = text(step && step.status).toLowerCase()
    if (doneStatuses.has(status)) done += 1
    if (errorStatuses.has(status)) hasError = true
    if (!currentLabel && activeStatuses.has(status)) {
      currentLabel = text(step.label || step.id)
    }
  }
  if (!currentLabel && total) {
    const fallback = steps[Math.min(done, total - 1)] || steps[0]
    currentLabel = text(fallback && (fallback.label || fallback.id)) || '编排步骤'
  }
  if (!currentLabel) currentLabel = text(input.intent) || '管线任务'
  const ratio = total ? Math.round((done / total) * 100) : 0
  const waitingKind = text(input.waitingKind || 'none').toLowerCase() || 'none'
  const state = text(input.status).toLowerCase()
  const terminalDone = waitingKind === 'none'
    && ['done', 'finished', 'completed', 'success'].includes(state)
  const terminalFail = ['failed', 'error'].includes(state)
  let statusLabel = '执行中'
  if (waitingKind === 'clarification') statusLabel = '等待你补充信息'
  else if (waitingKind === 'gate') statusLabel = '等待你确认'
  else if (terminalDone) statusLabel = '已完成'
  else if (terminalFail || hasError) statusLabel = '失败'
  else if (['cancelled', 'canceled'].includes(state)) statusLabel = '已取消'
  else if (['queued', 'pending', 'waiting', 'idle'].includes(state)) {
    statusLabel = waitingKind !== 'none' ? statusLabel : (state === 'waiting' || state === 'idle' ? '待处理' : '排队中')
  }
  const progressLine = total
    ? (terminalDone
      ? `已完成 ${total}/${total} 步 · 100%`
      : `已完成 ${done}/${total} 步 · ${ratio}%`)
    : (text(input.progressHint) || '进度同步中')
  const tip = waitingKind === 'clarification'
    ? '下方待处理事项需要你作答；完整日志在右侧「过程日志」。'
    : (waitingKind === 'gate'
      ? '请在下方确认卡片提交决定；完整日志在右侧「过程日志」。'
      : '关键步骤与决定会显示在对话中；完整日志在右侧「过程日志」。')
  return {
    kind: 'chat-progress',
    title: '管线进度',
    progressLine,
    currentLabel,
    statusLabel,
    ratio: terminalDone ? 100 : ratio,
    waitingKind,
    tip,
    done: terminalDone ? total : done,
    total,
  }
}

function projectReviewSurface(input = {}) {
  const steps = projectSteps({
    nodes: input.nodes || input.graphNodes,
    statusSteps: input.statusSteps,
  })
  const artifacts = projectArtifacts(input.artifacts)
  const events = projectEvents(input.events)
  const changes = projectChanges(input.changes)
  const process = projectProcessTranscript({
    slug: input.slug,
    intent: input.intent,
    status: input.status,
    progressText: input.progressText,
    logsText: input.logsText,
    tip: input.processTip,
  })
  const recommended = recommendTab({
    steps,
    artifacts,
    status: input.status,
  })
  const activeTab = TAB_IDS.includes(input.activeTab) ? input.activeTab : recommended
  return {
    title: '审阅',
    tabs: TAB_IDS.map(id => ({
      id,
      label: TAB_LABELS[id] || id,
      recommended: id === recommended,
    })),
    activeTab,
    recommendedTab: recommended,
    recommendation: '',
    steps,
    artifacts,
    events,
    changes,
    process,
    artifactCount: artifacts.length,
    slug: text(input.slug),
    intent: text(input.intent),
    workflow: text(input.workflow),
  }
}

return {
  TAB_IDS,
  TAB_LABELS,
  recommendTab,
  normalizeLogLines,
  normalizeProgressText,
  projectProcessTranscript,
  projectChatProgressCard,
  projectSteps,
  projectArtifacts,
  artifactEmptyState,
  projectEvents,
  projectChanges,
  projectReviewSurface,
}
})
