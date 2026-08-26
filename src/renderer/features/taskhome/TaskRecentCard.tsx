import type { CapabilityItem, WorkbenchTask } from '../../../shared/api'
import { taskRelTime } from '../../../domain/run-projection'
import { expertDisplayName } from '../../../domain/expert-present'
import { Icon } from '../../app/Icon'
import { ExpertAvatarMark } from '../expert/ExpertAvatarMark'

const TASK_THEME_MAX_LENGTH = 20
const CAPABILITY_THEME_LABELS: Record<string, string> = {
  'business-insight': '业务洞察',
  'business-insight-analysis': '业务洞察',
  'business-insight-analyst': '业务洞察',
  'business insight analyst': '业务洞察',
  'data-analysis': '数据分析',
  'data-analyst': '数据分析',
  'data analyst': '数据分析',
  'longform-editor': '长文编辑',
  'longform editor': '长文编辑',
  'qa-engineer': '质量工程',
  'qa engineer': '质量工程',
}

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
  if (capabilityCheck?.[1]) return clampTaskTheme(`${humanizeCapabilityLabel(capabilityCheck[1])}验收`)
  const bareCapabilityCheck = original.match(/^([a-z0-9][a-z0-9 _-]*)能力验收$/i)
  if (bareCapabilityCheck?.[1]) return clampTaskTheme(`${humanizeCapabilityLabel(bareCapabilityCheck[1])}验收`)
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

function humanizeCapabilityLabel(value: string): string {
  const normalized = value.trim().toLowerCase()
  return CAPABILITY_THEME_LABELS[normalized] || value.trim().replace(/[-_]+/g, ' ')
}

function taskCardContent(task: WorkbenchTask, source: string, theme: string): string {
  const goal = String(task.brief?.goal || task.goal || '').trim()
  const display = goal || (source !== theme ? source : '')
  if (!display || display === theme) return ''
  return display
    .replace(/[A-Za-z]:[\\/][^，。；;,]+/g, '项目')
    .replace(/\s+/g, ' ')
    .trim()
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
  presentation = 'card',
  onOpen,
}: {
  task: WorkbenchTask
  expert?: CapabilityItem
  workflowMode?: boolean
  presentation?: 'card' | 'inbox'
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

  if (presentation === 'inbox') {
    return (
      <article className={`wb-task-card wb-task-inbox-row is-${state.tone}`}>
        <button
          type="button"
          className="wb-task-card-main wb-task-inbox-row-main"
          data-testid={`task-open-${task.id}`}
          onClick={onOpen}
        >
          <span className="wb-task-inbox-task">
            <span className="wb-task-name" data-testid={`task-theme-${task.id}`} title={source}>{theme}</span>
            {content ? <span className="wb-task-card-content" title={content}>{content}</span> : null}
          </span>
          <span className="wb-task-inbox-expert">
            {workflowMode ? (
              <span className="wb-task-inbox-owner-icon" aria-hidden="true"><Icon name="workflow" /></span>
            ) : (
              <ExpertAvatarMark agent={avatarAgent} className="wb-task-card-avatar" size={18} />
            )}
            <span className="wb-task-card-owner-name" title={actor}>{actor}</span>
          </span>
          <time className="wb-task-inbox-updated" dateTime={task.updatedAt || undefined}>{when}</time>
          <span className={`wb-task-card-status wb-task-inbox-state is-${state.tone}`}>
            {state.label}
            <Icon name="chevronRight" />
          </span>
        </button>
      </article>
    )
  }

  return (
    <article className="wb-task-card">
      <button type="button" className="wb-task-card-main" data-testid={`task-open-${task.id}`} onClick={onOpen}>
        <span className="wb-task-card-heading">
          {workflowMode ? (
            <span className="wb-task-card-heading-icon" aria-hidden="true"><Icon name="workflow" /></span>
          ) : null}
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
        {state.tone === 'attention' ? <span className="wb-task-card-action">继续处理</span> : null}
      </button>
    </article>
  )
}
