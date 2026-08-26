import type {
  CapabilityItem,
  KnowledgeEntry,
  PersonalAgentGrowthEvent,
  PersonalAgentProfile,
  WorkbenchTask,
} from '../shared/api'
import type { GlobalMemoryItem, MemoryOverview, MemoryPattern } from '../shared/api-extended'

export type GrowthDimensionId = 'context' | 'preference' | 'knowledge' | 'collaboration'

export interface GrowthDimension {
  id: GrowthDimensionId
  label: string
  question: string
  level: number
  progress: number
  points: number
  evidenceCount: number
  summary: string
  evidence: string[]
}

export interface GrowthEquipment {
  skills: {
    installed: number
    bound: number
    stage: string
    summary: string
  }
  connectors: {
    installed: number
    bound: number
    successfulCalls: number
    totalCalls: number
    reliability: number | null
    stage: string
    summary: string
  }
}

export interface PersonalGrowthSnapshot {
  level: number
  progress: number
  points: number
  stage: string
  dimensions: GrowthDimension[]
  equipment: GrowthEquipment
  recommendations: Array<{
    id: string
    title: string
    description: string
    action: 'assistant' | 'workbench' | 'knowledge' | 'skill' | 'connector'
    actionLabel: string
  }>
  yesterdayCompleted: number
}

export interface PersonalGrowthInput {
  profile?: PersonalAgentProfile | null
  growthEvents?: PersonalAgentGrowthEvent[]
  memory?: MemoryOverview | null
  tasks?: WorkbenchTask[]
  knowledge?: KnowledgeEntry[]
  capabilities?: CapabilityItem[]
  now?: Date
}

const COMPLETE_STATUS = /^(completed|complete|done|success|succeeded|accepted|approved|delivered)$/i
const FAILED_STATUS = /^(failed|error|cancelled|canceled|rejected)$/i

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function levelFromPoints(points: number) {
  const safe = Math.max(0, Math.round(points))
  return {
    level: Math.min(10, Math.floor(safe / 100) + 1),
    progress: safe >= 900 ? 100 : safe % 100,
  }
}

function uniqueRefs(refs: Array<{ id?: string } | string> | undefined) {
  return new Set((refs || []).map((item) => typeof item === 'string' ? item : String(item?.id || '')).filter(Boolean)).size
}

function taskCompleted(task: WorkbenchTask) {
  if (COMPLETE_STATUS.test(String(task.status || ''))) return true
  return (task.deliverables || []).some((item) => COMPLETE_STATUS.test(String(item.acceptanceStatus || '')))
}

function taskTopic(task: WorkbenchTask) {
  return String(task.workflowId || task.expertId || task.title || task.kind || '').trim().toLowerCase()
}

function acceptedMemories(memory?: MemoryOverview | null) {
  const patterns = memory?.patterns || []
  const acceptedPatterns = patterns.filter((item: MemoryPattern) => item.prompt_state === 'accepted')
  const global = (memory?.globalMemories || []).filter((item: GlobalMemoryItem) =>
    ['preference', 'decision', 'goal', 'relationship'].includes(String(item.type || '')),
  )
  return { acceptedPatterns, global }
}

function eventCount(events: PersonalAgentGrowthEvent[], types: string[]) {
  const allowed = new Set(types)
  return events.filter((item) => allowed.has(String(item.type || ''))).length
}

function dimension(
  id: GrowthDimensionId,
  label: string,
  question: string,
  points: number,
  evidenceCount: number,
  summary: string,
  evidence: string[],
): GrowthDimension {
  return { id, label, question, points: Math.round(points), evidenceCount, summary, evidence, ...levelFromPoints(points) }
}

function isYesterday(value: string | undefined, now: Date) {
  if (!value) return false
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return false
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return date >= start && date < end
}

function buildEquipment(profile: PersonalAgentProfile | null | undefined, capabilities: CapabilityItem[], tasks: WorkbenchTask[]): GrowthEquipment {
  const installedSkills = capabilities.filter((item) => item.kind === 'skill' && (item.installed || item.enabled || item.status === 'installed'))
  const installedConnectors = capabilities.filter((item) => item.kind === 'connector' && (item.installed || item.enabled || item.status === 'installed'))
  const boundSkills = uniqueRefs([
    ...(profile?.skillRefs || []),
    ...(profile?.contexts || []).flatMap((item) => item.skillRefs || []),
  ])
  const boundConnectors = uniqueRefs([
    ...(profile?.connectorRefs || []),
    ...(profile?.contexts || []).flatMap((item) => item.connectorRefs || []),
  ])
  const toolCalls = tasks.flatMap((task) => (task.executionEvidence || []).flatMap((item) => item.toolCalls || []))
  const successfulCalls = toolCalls.filter((item) => /^(ok|success|succeeded|completed)$/i.test(String(item.status || ''))).length
  const reliability = toolCalls.length ? Math.round((successfulCalls / toolCalls.length) * 100) : null

  return {
    skills: {
      installed: installedSkills.length,
      bound: boundSkills,
      stage: boundSkills ? '正在磨合' : installedSkills.length ? '等待上场' : '尚未装备',
      summary: boundSkills
        ? `${boundSkills} 项已用于伙伴工作。`
        : installedSkills.length
          ? '已有可用 Skill，实际使用后形成熟练度。'
          : '按重复出现的任务选择 Skill。',
    },
    connectors: {
      installed: installedConnectors.length,
      bound: boundConnectors,
      successfulCalls,
      totalCalls: toolCalls.length,
      reliability,
      stage: toolCalls.length ? '协作中' : installedConnectors.length ? '等待磨合' : '尚未装备',
      summary: toolCalls.length
        ? `${toolCalls.length} 次调用，${successfulCalls} 次成功。`
        : installedConnectors.length
          ? '连接器已可用，完成任务后显示可靠度。'
          : '需要外部工具时再连接。',
    },
  }
}

export function buildPersonalGrowthSnapshot(input: PersonalGrowthInput): PersonalGrowthSnapshot {
  const profile = input.profile
  const events = input.growthEvents || []
  const tasks = input.tasks || []
  const knowledge = [...new Map((input.knowledge || []).map((item) => [String(item.path || item.title || ''), item])).values()]
  const capabilities = input.capabilities || []
  const now = input.now || new Date()
  const completed = tasks.filter(taskCompleted)
  const failed = tasks.filter((task) => FAILED_STATUS.test(String(task.status || '')))
  const topics = new Set(tasks.map(taskTopic).filter(Boolean))
  const contexts = profile?.contexts || []
  const accepted = acceptedMemories(input.memory)
  const appliedMemoryEvents = eventCount(events, ['memory_applied', 'profile_updated'])
  const knowledgeRefs = uniqueRefs([
    ...(profile?.knowledgeRefs || []),
    ...contexts.flatMap((item) => item.knowledgeRefs || []),
  ])
  const taskKnowledgeRefs = new Set(tasks.flatMap((task) => (task.knowledgeRefs || []).map((item) =>
    typeof item === 'string' ? item : String(item?.id || item?.path || ''),
  )).filter(Boolean))
  const acceptedDeliverables = completed.reduce((total, task) => total + (task.deliverables || []).filter((item) =>
    COMPLETE_STATUS.test(String(item.acceptanceStatus || '')),
  ).length, 0)

  const contextPoints = contexts.length * 32 + Math.min(topics.size, 12) * 10 + Math.min(tasks.length, 30) * 2
  const preferenceEvidence = accepted.acceptedPatterns.length + accepted.global.length + appliedMemoryEvents
  const preferencePoints = accepted.acceptedPatterns.length * 22 + accepted.global.length * 16 + appliedMemoryEvents * 10
  const knowledgePoints = Math.min(knowledge.length, 60) * 4 + knowledgeRefs * 18 + taskKnowledgeRefs.size * 12
  const collaborationEvidence = completed.length + acceptedDeliverables
  const collaborationPoints = completed.length * 9 + acceptedDeliverables * 14 + appliedMemoryEvents * 5 + Math.max(0, completed.length - failed.length) * 2

  const dimensions = [
    dimension(
      'context', '情境理解', '你正在做什么', contextPoints, contexts.length + topics.size,
      contexts.length || topics.size
        ? `${contexts.length} 个长期情境，${topics.size} 类工作主题。`
        : '完成真实任务后开始积累。',
      [`长期情境 ${contexts.length}`, `工作主题 ${topics.size}`, `有记录的任务 ${tasks.length}`],
    ),
    dimension(
      'preference', '偏好理解', '你在意什么、如何判断', preferencePoints, preferenceEvidence,
      preferenceEvidence
        ? `${preferenceEvidence} 条偏好已经确认或应用。`
        : '确认偏好后开始积累。',
      [`已确认模式 ${accepted.acceptedPatterns.length}`, `长期偏好与原则 ${accepted.global.length}`, `已应用调整 ${appliedMemoryEvents}`],
    ),
    dimension(
      'knowledge', '知识沉淀', '你和团队知道什么', knowledgePoints, knowledge.length + knowledgeRefs + taskKnowledgeRefs.size,
      knowledge.length || knowledgeRefs
        ? `${knowledge.length} 项知识沉淀，${taskKnowledgeRefs.size} 项已在任务中复用。`
        : '沉淀并复用知识后开始积累。',
      [`知识条目 ${knowledge.length}`, `伙伴绑定 ${knowledgeRefs}`, `任务引用 ${taskKnowledgeRefs.size}`],
    ),
    dimension(
      'collaboration', '协作默契', '如何与你配合', collaborationPoints, collaborationEvidence,
      completed.length
        ? `完成 ${completed.length} 个任务，确认 ${acceptedDeliverables} 份交付。`
        : '完成任务并反馈结果后开始积累。',
      [`已完成任务 ${completed.length}`, `确认交付 ${acceptedDeliverables}`, `未完成或失败 ${failed.length}`],
    ),
  ]

  const points = Math.round(dimensions.reduce((sum, item) => sum + item.points, 0) / dimensions.length)
  const overall = levelFromPoints(points)
  const equipment = buildEquipment(profile, capabilities, tasks)
  const recommendations: PersonalGrowthSnapshot['recommendations'] = []

  if (!contexts.length && !topics.size) recommendations.push({
    id: 'confirm-context', title: '完成一个真实工作任务',
    description: 'KnowMe 会从任务主题和协作结果中积累情境理解。',
    action: 'workbench', actionLabel: '前往工作台',
  })
  if (preferenceEvidence < 3) recommendations.push({
    id: 'confirm-preference', title: '教会 KnowMe 一条判断原则',
    description: '说明什么结果算好，哪些做法需要避免。',
    action: 'assistant', actionLabel: '开始培养',
  })
  if (!knowledge.length || !taskKnowledgeRefs.size) recommendations.push({
    id: 'reuse-knowledge', title: '沉淀一份可复用知识',
    description: '把稳定结论放入知识网，并在下次任务中复用。',
    action: 'knowledge', actionLabel: '前往知识网',
  })
  if (equipment.skills.installed && !equipment.skills.bound) recommendations.push({
    id: 'equip-skill', title: '让一个 Skill 真正上场',
    description: '选择高频任务需要的 Skill，实际使用后形成熟练度。',
    action: 'skill', actionLabel: '查看 Skill',
  })
  if (!equipment.skills.installed && tasks.length >= 2) recommendations.push({
    id: 'find-skill', title: '为重复任务补充能力装备',
    description: '最近已有重复任务信号，可以选择一个 Skill 缩短固定步骤。',
    action: 'skill', actionLabel: '寻找 Skill',
  })
  if (!recommendations.length) recommendations.push({
    id: 'review-growth', title: '复盘最近一次协作',
    description: '确认哪一步最符合你的判断方式，或指出一次仍需改进的地方。',
    action: 'assistant', actionLabel: '开始复盘',
  })

  return {
    level: overall.level,
    progress: overall.progress,
    points,
    stage: overall.level >= 8 ? '深度默契' : overall.level >= 5 ? '稳定协作' : overall.level >= 3 ? '逐渐熟悉' : '相识起步',
    dimensions,
    equipment,
    recommendations: recommendations.slice(0, 3),
    yesterdayCompleted: completed.filter((task) => isYesterday(task.updatedAt, now)).length,
  }
}
