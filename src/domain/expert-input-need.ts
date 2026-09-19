import type { ExpertTaskAttention } from '../shared/api'

export type ExpertInputNeed = {
  kind: 'execution' | 'reroute' | 'capability' | 'configuration' | 'workspace' | 'material' | 'information'
  action: 'provide_input' | 'open_capability' | 'open_settings' | 'open_workspace' | 'retry' | 'reroute' | 'review_approval'
  title: string
  detail: string
  item: string
  nextStep: string
  composerPlaceholder: string
  alternative?: string
  question?: string
  example?: string
  options?: string[]
  issues?: { id: string; code?: string; detail: string }[]
}

function compactText(value: unknown) {
  return String(value || '')
    .replace(/[`*#]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanItem(value: string, fallback: string) {
  return compactText(value)
    .replace(/[。；;，,]+$/, '')
    .slice(0, 80) || fallback
}

/** Failed-state display only: never infer a cause from raw events or stringify Error objects. */
export function describeExpertFailure(attention?: ExpertTaskAttention | null): Pick<ExpertInputNeed, 'title' | 'detail' | 'nextStep'> {
  const raw = typeof attention?.detail === 'string' ? attention.detail : ''
  // Attention carries a user-facing message; legacy/malformed records can still contain
  // diagnostics. Keep only its first line and fail closed on credentials/URLs rather
  // than trying to render or partially mask an arbitrary exception payload.
  const line = raw.split(/\r?\n/, 1)[0].trim()
  const diagnostic = /^(?:at\s|Traceback\b)|(?:authorization|api[_-]?key|access[_-]?token|refresh[_-]?token|token|secret|password|cookie|credential)["']?\s*[:=]|\b(?:Bearer|Basic)\s+\S+|\bsk-[A-Za-z0-9_-]+|\b[a-z][a-z0-9+.-]*:\/\/|[A-Za-z0-9_-]{32,}/i.test(line)
  return {
    title: '本次执行未完成',
    detail: (!diagnostic && compactText(line).slice(0, 500)) || '当前没有可展示的具体失败原因。',
    nextStep: '已有成果和修改意见已保留。可稍后重新执行，无需重复提交任务背景。',
  }
}

function structuredInputNeed(raw?: ExpertTaskAttention | null): ExpertInputNeed | null {
  if (!raw?.kind || !raw.action) return null
  if (raw.kind === 'approval_required') return {
    kind: 'execution', action: 'review_approval', title: '等待操作审批',
    detail: '请先在任务审批卡中确认或拒绝本次请求。', item: '待审批操作',
    nextStep: '在执行详情中核对审批内容；操作批准后先查看执行结果，补充文字不会代替批准。', composerPlaceholder: '', options: [],
  }
  if (raw.kind === 'tool_execution_completed') return {
    kind: 'execution', action: 'retry', title: '操作结果已记录，等待继续',
    detail: '已批准的操作已经执行；专家将基于已有结果处理剩余工作。', item: '已执行操作',
    nextStep: '基于执行结果继续，不要重新执行已成功的操作。', composerPlaceholder: '', options: [],
  }
  if (raw.kind === 'tool_approval_expired') return {
    kind: 'execution', action: 'retry', title: '操作未执行，可重新申请',
    detail: '原审批已失效或被拒绝；宿主已确认这次操作没有执行。', item: '未执行操作',
    nextStep: '重新生成操作审批，核对目标和参数后再批准。', composerPlaceholder: '', options: [],
  }
  const item = cleanItem(raw.item || raw.field || '', '任务继续所需的信息')
  const hostFileTools = new Set(['read_file', 'list_dir', 'grep_files', 'write_file', 'create_file', 'apply_patch', 'move_path', 'copy_path', 'delete_path', 'mkdir'])
  const legacyWorkspaceAction = raw.action === 'open_capability' && hostFileTools.has(item)
  const issues = (Array.isArray(raw.issues) ? raw.issues : []).map(issue => ({
    id: cleanItem(issue?.id || '', '任务所需能力'),
    code: compactText(issue?.code),
    detail: compactText(issue?.message) || '执行前检查未通过',
  })).filter(issue => issue.id).slice(0, 8)
  if (raw.kind === 'operation_status_unknown') return {
    kind: 'execution',
    action: 'provide_input',
    title: cleanItem(raw.title || '', '需要核对操作结果'),
    detail: compactText(raw.detail || raw.question) || '操作可能已经生效，但尚未收到可确认的结果。',
    item: cleanItem(raw.item || '', '本次操作'),
    nextStep: '请先核对目标端是否已有结果，再在下方说明后续处理；不要直接重复执行。',
    composerPlaceholder: '说明核对结果，或告诉专家下一步如何处理… @ 选文件',
    question: compactText(raw.question),
    options: [],
  }
  const action = (legacyWorkspaceAction ? 'open_workspace' : raw.action) as ExpertInputNeed['action']
  const kind: ExpertInputNeed['kind'] = action === 'open_settings'
    ? 'configuration'
    : action === 'open_workspace'
      ? 'workspace'
    : action === 'open_capability'
      ? 'capability'
      : action === 'reroute'
        ? 'reroute'
        : raw.kind === 'missing_material'
          ? 'material'
          : action === 'provide_input'
            ? 'information'
            : 'execution'
  const nextStep = action === 'open_settings'
    ? '前往设置完成配置，返回后重新执行。'
    : action === 'open_workspace'
      ? '确认或选择可写的项目目录，然后重新执行。'
    : action === 'open_capability'
      ? '前往能力中心完成安装、启用或授权，返回后继续。'
      : action === 'retry'
        ? '不需要重复补充任务背景，直接重新执行。'
        : action === 'reroute'
          ? '确认新的执行路径后继续。'
          : '直接回答下面的问题；回答充分后任务才会继续。'
  return {
    kind,
    action,
    title: cleanItem(legacyWorkspaceAction ? '' : raw.title || '', raw.kind === 'authorization_required' ? '需要完成能力授权'
      : kind === 'configuration' ? '需要完成配置'
        : kind === 'workspace' ? '需要可写的项目目录'
        : kind === 'capability' ? '需要启用任务能力'
          : kind === 'reroute' ? '执行路径需要确认'
            : kind === 'execution' ? '工具执行未完成' : '还需要一项信息'),
    detail: compactText(raw.detail || raw.question) || nextStep,
    item,
    nextStep,
    composerPlaceholder: action === 'provide_input'
      ? '补充信息或回答上方问题… @ 选文件'
      : '',
    alternative: action === 'reroute' ? raw.defaultValue : undefined,
    question: compactText(raw.question),
    example: compactText(raw.example),
    options: Array.isArray(raw.options) ? raw.options.map(compactText).filter(Boolean).slice(0, 4) : [],
    issues,
  }
}

export function describeExpertInputNeed(
  summary: unknown,
  goal: unknown = '',
  attention?: ExpertTaskAttention | null,
): ExpertInputNeed {
  const structured = structuredInputNeed(attention)
  if (structured) return structured
  const text = compactText(summary)
  const taskGoal = compactText(goal)
  const requiredRead = text.match(/(?:缺少必需读取|还缺少可核验结果|工具结果证据不足)\s*[：:]\s*([^。；;]+)/i)
  const internalExecutionBlock = /requiredEvidence|missing_required_evidence|requiredTools|missing_required_tools/i.test(text)

  if (requiredRead || internalExecutionBlock) {
    const item = cleanItem(requiredRead?.[1] || '', '任务所需的读取结果')
    const internalMeeting = /(我的|飞书|会议|妙记|纪要|内部)/.test(taskGoal)
      && !/(公开|全网|互联网|网页|新闻|资讯|行业|市场|官网|媒体)/.test(taskGoal)
    if (/公开网络搜索/.test(item) && internalMeeting) {
    return {
      kind: 'reroute',
      action: 'reroute',
        title: '执行路径需要调整',
        detail: '这项任务应读取你的飞书会议，不需要公开网络搜索。',
        item,
        alternative: '飞书会议内容',
        nextStep: '改用已授权的飞书连接器，从当前任务继续。',
        composerPlaceholder: '如需调整，可补充会议范围或指定具体会议… @ 选文件',
      }
    }
    return {
      kind: 'execution',
      action: 'retry',
      title: '需要完成一次读取',
      detail: `不需要补充资料。专家还没有完成「${item}」。`,
      item,
      nextStep: '不需要重复补充任务背景，直接重新执行。',
      composerPlaceholder: '',
    }
  }

  const capabilityMatch = text.match(/(?:未启用|未安装|未授权|缺少)(?:所需的?|必需的?)?\s*(?:能力|技能|连接器)?\s*[：:]?\s*([^。；;]+)/)
  if (capabilityMatch && /(能力|技能|连接器|未启用|未安装|未授权)/.test(text)) {
    const item = cleanItem(capabilityMatch[1], '任务所需能力')
    return {
      kind: 'capability',
      action: 'open_capability',
      title: '需要启用能力',
      detail: `当前专家缺少「${item}」，启用后可从这里继续。`,
      item,
      nextStep: '前往能力中心完成安装或授权。',
      composerPlaceholder: `也可以说明不使用「${item}」时应如何调整任务…`,
    }
  }

  const item = cleanItem(
    text.replace(/^(?:请|需要你|还需要)(?:补充|提供|确认)\s*/i, ''),
    '任务继续所需的信息',
  )
  return {
    kind: 'information',
    action: 'provide_input',
    title: '还需要一项信息',
    detail: text || '请补充任务继续所需的材料、范围或选择。',
    item,
    nextStep: '直接在下方输入，或添加相关文件。',
    composerPlaceholder: `请补充：${item}… @ 选文件`,
  }
}
