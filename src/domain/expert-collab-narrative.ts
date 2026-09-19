import type { WorkbenchTaskEvent } from '../shared/api'
import type { ExpertCollabFeedItem } from './expert-collab-feed'

export type ExpertNarrativeDetail = {
  label: string
  value: string
}

export type ExpertNarrativeMoment = {
  id: string
  role: 'expert' | 'user'
  body: string
  createdAt?: string
  active?: boolean
  disclosure?: {
    label: string
    details: ExpertNarrativeDetail[]
  }
}

export type ExpertNarrativeFeedItem =
  | Extract<ExpertCollabFeedItem, { kind: 'message' | 'deliverable' }>
  | { kind: 'moment'; moment: ExpertNarrativeMoment; index: number }

const SILENT_EVENTS = new Set([
  'created',
  'started',
  'task_created',
  'task_started',
  'preflight_started',
  'preflight_passed',
  'execution_contract_upgraded',
  'deliverable_created',
  'deliverable_submitted',
  'deliverable_ready',
  'revision_ready',
  'task_completed',
  'deliverable_accepted',
  'needs_input',
  'input_requested',
  'preflight_failed',
  'execution_blocked',
  'task_failed',
  'failed',
  'task_cancelled',
  'cancelled',
])

// Runtime stages are execution telemetry, not additional assistant turns. Keep
// them in the same collapsible progress bucket so a stage label such as
// “上下文准备完成” cannot be rendered once as dialogue and again as status.
const PROGRESS_EVENTS = new Set([
  'progress',
  'tool_progress',
  'tool_completed',
  'stage_prepare',
  'stage_tools',
  'stage_retrieval',
  'stage_ground',
  'stage_verify_claims',
  'stage_generate',
  'stage_compatibility',
])
const USER_EVENTS = new Set(['input_provided', 'input_queued', 'plan_confirmed', 'changes_requested'])

function compact(value: unknown) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

/**
 * Execution sessions may persist a short assistant message for every tool
 * round. Those messages carry no user-facing answer; rendering them as normal
 * turns splits one execution summary into a tall list of "调用工具" rows.
 * Keep them inside the surrounding progress bucket instead.
 */
function isExecutionOnlyMessage(item: ExpertCollabFeedItem) {
  if (item.kind !== 'message' || item.message.role !== 'assistant') return false
  const trace = Array.isArray(item.message.trace) ? item.message.trace : []
  const text = compact(item.message.text)
  return /^调用工具\s*[:：]/u.test(text)
    || (!text && trace.some((entry) => entry.kind === 'tool' || entry.kind === 'subrun'))
}

function eventId(event: WorkbenchTaskEvent, index: number) {
  return String(event.id || `${event.type || 'event'}-${event.sequence || index}`)
}

function approachBody(summary: unknown) {
  const route = approachDetail(summary)
  if (!route || route === '按最小必要路径执行') {
    return '我会先核对完成这项工作所需的信息，再按专业工作方法推进。'
  }
  return `我会${route}。`
}

function approachDetail(summary: unknown) {
  return compact(summary)
    .replace(/^已按\s*SOP\s*路由执行[：:]\s*/i, '')
    .replace(/^已加载专家\s*SOP[，,]?\s*/i, '')
    .replace(/[。；;]+$/, '')
}

function plannedWorkBody(summary: unknown) {
  const value = compact(summary).replace(/[。；;]+$/, '')
  if (!value || /^(专家)?已开始(工作|执行)?$/i.test(value)) return ''
  if (/^我(会|将|先)/.test(value)) return `${value}。`
  return `我会${value}。`
}

function progressBody(summary: unknown) {
  const value = compact(summary)
  if (!value) return '我正在核对任务所需的信息。'
  if (/^(正在)?准备上下文[.…\.]*$/i.test(value)) {
    return '我正在整理完成这项工作所需的背景和材料。'
  }
  if (/^工具执行进度$/i.test(value)) return '我正在核对执行结果。'
  return value
}

function progressDetails(events: WorkbenchTaskEvent[]): ExpertNarrativeDetail[] {
  const seen = new Set<string>()
  return events.flatMap((event) => {
    const value = progressBody(event.summary)
    if (!value || seen.has(value)) return []
    seen.add(value)
    return [{
      label: event.type === 'tool_progress' || event.type === 'tool_completed' ? '执行' : '进展',
      value,
    }]
  })
}

function userBody(event: WorkbenchTaskEvent) {
  const value = compact(event.summary)
  if (event.type === 'changes_requested') {
    return value ? `请按以下意见修改：${value}` : '请继续修改这份成果。'
  }
  return value || '我补充了任务继续所需的信息。'
}

function isUserActivity(event: WorkbenchTaskEvent, type: string) {
  // New activity-contract events carry their provenance explicitly. Keep the
  // type allowlist only for legacy records that predate the contract.
  return event.source === 'user' || USER_EVENTS.has(type)
}

/**
 * 将底层任务活动转换成用户可理解的专家协作叙事。
 * 技术生命周期留在任务记录中；默认会话只保留专家方法、关键进展、用户发言和成果。
 */
export function buildExpertCollabNarrative(
  feed: ExpertCollabFeedItem[],
  status: string,
): ExpertNarrativeFeedItem[] {
  const result: ExpertNarrativeFeedItem[] = []
  // The room renders an optimistic confirmation (or restores it from the brief).
  // Reconcile only those platform-owned echoes with durable confirmation events;
  // equal text in ordinary user messages is not evidence of duplication.
  const confirmationEchoes = new Map<string, number>()
  for (const item of feed) {
    if (item.kind !== 'message' || item.message.role !== 'user'
      || !/^(?:plan-confirm-|restored-plan-confirmation-)/.test(String(item.message.id || ''))) continue
    const body = compact(item.message.text)
    if (body) confirmationEchoes.set(body, (confirmationEchoes.get(body) || 0) + 1)
  }
  let progress: Array<{ event: WorkbenchTaskEvent; index: number }> = []

  function flushProgress() {
    if (!progress.length) return
    const latest = progress.at(-1)!
    const details = progressDetails(progress.map((item) => item.event))
    result.push({
      kind: 'moment',
      index: latest.index,
      moment: {
        id: `progress-${eventId(latest.event, latest.index)}`,
        role: 'expert',
        body: progressBody(latest.event.summary),
        createdAt: latest.event.createdAt,
        active: ['starting', 'running', 'revising'].includes(status),
        disclosure: details.length > 1
          ? { label: `查看已完成的工作（${details.length}）`, details }
          : details.length === 1
            ? { label: '查看执行依据', details }
            : undefined,
      },
    })
    progress = []
  }

  feed.forEach((item) => {
    if (item.kind !== 'event') {
      if (isExecutionOnlyMessage(item)) return
      flushProgress()
      result.push(item)
      return
    }

    const type = String(item.event.type || '').trim()
    if (type === 'plan_confirmed') {
      const body = compact(item.event.summary)
      const echoes = confirmationEchoes.get(body) || 0
      if (echoes > 0) {
        confirmationEchoes.set(body, echoes - 1)
        return
      }
    }
    if (PROGRESS_EVENTS.has(type)) {
      progress.push({ event: item.event, index: item.index })
      return
    }

    flushProgress()
    if (type === 'sop_applied') {
      const body = approachBody(item.event.summary)
      result.push({
        kind: 'moment',
        index: item.index,
        moment: {
          id: `approach-${eventId(item.event, item.index)}`,
          role: 'expert',
          body,
          createdAt: item.event.createdAt,
          disclosure: {
            label: '查看工作路径',
            details: [
              { label: '本次路径', value: approachDetail(item.event.summary) || '按专家工作方法的最小必要路径执行' },
              { label: '调整原则', value: '如果材料或执行条件发生变化，我会说明原因后再调整路径。' },
            ],
          },
        },
      })
      return
    }

    if (type === 'task_started' || type === 'started') {
      const body = plannedWorkBody(item.event.summary)
      if (!body) return
      result.push({
        kind: 'moment',
        index: item.index,
        moment: {
          id: `plan-${eventId(item.event, item.index)}`,
          role: 'expert',
          body,
          createdAt: item.event.createdAt,
          disclosure: {
            label: '查看工作路径',
            details: [
              { label: '工作安排', value: compact(item.event.summary).replace(/[。；;]+$/, '') },
              { label: '调整原则', value: '如果发现新的约束或风险，我会先说明判断，再继续推进。' },
            ],
          },
        },
      })
      return
    }

    if (isUserActivity(item.event, type)) {
      result.push({
        kind: 'moment',
        index: item.index,
        moment: {
          id: `user-${eventId(item.event, item.index)}`,
          role: 'user',
          body: userBody(item.event),
          createdAt: item.event.createdAt,
        },
      })
      return
    }

    if (SILENT_EVENTS.has(type)) return

    const summary = compact(item.event.summary)
    if (!summary) return
    result.push({
      kind: 'moment',
      index: item.index,
      moment: {
        id: `update-${eventId(item.event, item.index)}`,
        role: 'expert',
        body: summary,
        createdAt: item.event.createdAt,
        disclosure: {
          label: '查看判断依据',
          details: [{ label: '协作记录', value: summary }],
        },
      },
    })
  })
  flushProgress()

  const activeStatus = ['starting', 'running', 'revising'].includes(status)
  const reversedExpertMomentIndex = [...result].reverse().findIndex((item) => item.kind === 'moment' && item.moment.role === 'expert')
  const reversedUserTurnIndex = [...result].reverse().findIndex((item) => (
    item.kind === 'message' ? item.message.role === 'user' : item.kind === 'moment' && item.moment.role === 'user'
  ))
  const latestExpertMomentIndex = reversedExpertMomentIndex < 0 ? -1 : result.length - reversedExpertMomentIndex - 1
  const latestUserTurnIndex = reversedUserTurnIndex < 0 ? -1 : result.length - reversedUserTurnIndex - 1
  const latestExpertMoment = result[latestExpertMomentIndex]
  if (activeStatus && latestExpertMomentIndex > latestUserTurnIndex && latestExpertMoment?.kind === 'moment') {
    latestExpertMoment.moment.active = true
  } else if (activeStatus) {
    const body = status === 'revising'
      ? '我正在根据你的意见检查并修改上一版成果。'
      : status === 'starting'
        ? '方案已确认，我正在检查执行条件。'
        : '执行已开始，我正在推进第一项工作。'
    result.push({
      kind: 'moment',
      index: result.length,
      moment: {
        id: 'expert-active-work',
        role: 'expert',
        body,
        active: true,
        disclosure: status === 'revising'
          ? undefined
          : {
              label: '查看执行进度',
              details: status === 'starting'
                ? [
                    { label: '方案', value: '已确认' },
                    { label: '当前', value: '正在检查所需能力和材料是否可用' },
                    { label: '下一步', value: '检查通过后立即按已确认方案执行' },
                  ]
                : [
                    { label: '方案', value: '已确认并进入执行' },
                    { label: '当前', value: '正在等待首个可展示的执行进展' },
                    { label: '同步', value: '关键判断和工具进展会继续更新在本对话中' },
                  ],
            },
      },
    })
  }

  return result
}
