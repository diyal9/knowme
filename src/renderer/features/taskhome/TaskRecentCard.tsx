import type { CapabilityItem, WorkbenchTask } from '../../../shared/api'
import { taskRelTime } from '../../../domain/run-projection'
import { expertDisplayName } from '../../../domain/expert-present'
import { Icon } from '../../app/Icon'
import { ExpertAvatarMark } from '../expert/ExpertAvatarMark'

const TASK_THEME_MAX_LENGTH = 20

function clampTaskTheme(value: string): string {
  const characters = Array.from(value)
  if (characters.length <= TASK_THEME_MAX_LENGTH) return value
  return `${characters.slice(0, TASK_THEME_MAX_LENGTH - 1).join('')}…`
}

export function compactTaskTheme(value: unknown): string {
  const original = String(value || '')
    .replace(/[*#`_]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!original) return '未命名任务'

  const capabilityCheck = original.match(/^\[能力验收\]\s*(.+)$/i)
  if (capabilityCheck?.[1]) return clampTaskTheme(`${capabilityCheck[1].trim()}能力验收`)
  if (/[A-Za-z]:[\\/]/.test(original) && original.includes('扫描') && original.includes('导入')) {
    return '扫描并导入项目资源'
  }
  if (original.includes('飞书') && original.includes('消息') && original.includes('处理')) {
    return '处理飞书消息'
  }

  const concise = original
    .replace(/^(?:请|帮我|请帮我|麻烦帮我)\s*/u, '')
    .replace(/[A-Za-z]:[\\/][^，。；;,]+/g, '项目')
    .replace(/[。！？!?].*$/u, '')
    .trim()
  return clampTaskTheme(concise || original)
}

function taskCardContent(task: WorkbenchTask, source: string, theme: string): string {
  const goal = String(task.brief?.goal || task.goal || '').trim()
  if (goal) return goal
  return source !== theme ? source : ''
}

const EXPERT_STATUS_LABEL: Record<string, string> = {
  draft: '草稿', open: '待处理', queued: '等待执行', starting: '正在预检',
  needs_input: '等待补充', running: '专家执行中', review: '等待验收', revising: '修改中',
  completed: '已完成', done: '已完成', finished: '已完成', failed: '执行失败',
  error: '执行失败', timeout: '已超时', blocked: '已阻塞', cancelled: '已取消',
}

const WORKFLOW_STATUS_LABEL: Record<string, string> = {
  ...EXPERT_STATUS_LABEL,
  open: '待启动', starting: '启动中', running: '运行中', review: '等待确认', revising: '调整中',
}

function taskCardStatus(status: string | undefined, workflowMode: boolean): { label: string; tone: string } {
  const value = String(status || 'draft').toLowerCase()
  const labels = workflowMode ? WORKFLOW_STATUS_LABEL : EXPERT_STATUS_LABEL
  const tone = ['completed', 'done', 'finished'].includes(value)
    ? 'done'
    : ['failed', 'error', 'timeout', 'blocked'].includes(value)
      ? 'failed'
      : ['needs_input', 'review', 'open', 'draft', 'queued'].includes(value)
        ? 'attention'
        : value === 'cancelled'
          ? 'muted'
          : 'active'
  return { label: labels[value] || '进行中', tone }
}

export function TaskRecentCard({
  task,
  expert,
  workflowMode = false,
  onOpen,
}: {
  task: WorkbenchTask
  expert?: CapabilityItem
  workflowMode?: boolean
  onOpen: () => void
}) {
  const source = String(task.title || task.brief?.goal || task.goal || task.id).trim()
  const theme = compactTaskTheme(source)
  const content = taskCardContent(task, source, theme)
  const actor = workflowMode
    ? (task.workflowName || task.workflowId || '工作流')
    : expertDisplayName(expert?.name || task.expertName || task.expertId)
  const avatarAgent = expert || {
    id: String(task.expertId || actor || 'expert'),
    kind: 'expert' as const,
    name: actor,
  }
  const when = taskRelTime(task.updatedAt) || '刚刚'
  const state = taskCardStatus(task.status, workflowMode)

  return (
    <article className="wb-task-card">
      <button type="button" className="wb-task-card-main" data-testid={`task-open-${task.id}`} onClick={onOpen}>
        <span className="wb-task-card-heading">
          <span className="wb-task-card-heading-icon" aria-hidden="true">
            <Icon name={workflowMode ? 'workflow' : 'clipboardCheck'} />
          </span>
          <span className="wb-task-name" data-testid={`task-theme-${task.id}`} title={source}>{theme}</span>
        </span>
        {content ? <span className="wb-task-card-content" title={content}>{content}</span> : null}
        <span className="wb-task-card-meta">
          <span className="wb-task-card-owner">
            {workflowMode ? (
              <span className="ico ico-sm" aria-hidden="true"><Icon name="workflow" /></span>
            ) : (
              <ExpertAvatarMark agent={avatarAgent} className="wb-task-card-avatar" size={18} />
            )}
            <span className="wb-task-card-owner-name" title={actor}>{actor}</span>
            <span aria-hidden="true">·</span>
            <time dateTime={task.updatedAt || undefined}>{when}</time>
          </span>
          <span className={`wb-task-card-status is-${state.tone}`}>{state.label}</span>
        </span>
      </button>
    </article>
  )
}
