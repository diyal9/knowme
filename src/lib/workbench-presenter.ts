'use strict'

/**
 * Workbench 对外展示层（纯函数，可 Node 单测）
 *
 * 仓库里的 agent.manifest.json / AGENT.md 是写给开发者的：description 里混着节点 ID、
 * 产物路径和内部代号（s2-plan-backend、plan-backend.md、Worker、ingest/、RAGFlow…），
 * skills 是 slug（team-developer）。这些一旦原样渲染就会出现在终端用户界面上。
 *
 * 因此展示走统一三段式：可信来源优先 → 内部术语拦截 → 角色模板兜底。
 */

const SUMMARY_MAX = 88

// 命中任一模式即判定该文案含实现细节，不可对外
const INTERNAL_PATTERNS = [
  /\b[sS]\d+-[a-z][a-z0-9-]*/,                      // s2-plan-backend / s3-code-chunk
  /\b[a-z][a-z0-9]*(?:-[a-z0-9]+){2,}\b/,           // 三段以上 kebab slug
  /\b[fF]\d+\b/,                                    // F9
  /[\w-]+\.(?:md|json|ya?ml|js|ts|py|proto|txt|csv)\b/i,
  /(?:^|[\s，。、；：（(])[a-z_][a-z0-9_-]*\/(?=[\s，。、；：）)]|$)/, // ingest/ proto/
  /\bworkers?\b/i,
  /\bingest\b/i,
  /\bproto\b/i,
  /\bmanifest\b/i,
  /\bfrontmatter\b/i,
  /\bworkflow-spec\b/i,
  /\bragflow\b/i,
  /\bagentteams\b/i,
  /\bprompt\b/i,
  /\brepo(?:sitory)?\b/i,
  /\bschema\b/i,
  /\bpayload\b/i,
  /\bnode_specs?\b/i,
  /\bslug\b/i,
]

const ROLE_PRESETS = {
  product: {
    summary: '把模糊的想法整理成清晰需求：目标、范围、优先级和验收标准。',
    capabilities: ['需求梳理', '优先级排序', '验收标准'],
  },
  frontend: {
    summary: '负责界面与交互落地，把需求变成可用、异常情况也兜得住的页面。',
    capabilities: ['界面实现', '交互细节', '异常态兜底'],
  },
  backend: {
    summary: '负责服务端方案与实现：接口、数据结构，以及性能和稳定性。',
    capabilities: ['接口设计', '数据建模', '性能稳定性'],
  },
  qa: {
    summary: '从用户角度检验成果，覆盖主流程与异常情况，给出可复现的结论。',
    capabilities: ['测试方案', '缺陷复现', '回归验收'],
  },
  devops: {
    summary: '负责上线与运行保障：发布步骤、监控告警和回滚预案。',
    capabilities: ['发布上线', '监控告警', '回滚预案'],
  },
  research: {
    summary: '收集并核对资料，提炼可用结论，并标注依据与不确定项。',
    capabilities: ['资料调研', '结论提炼', '决策对比'],
  },
  general: {
    summary: '按工作流接收任务，并产出可以直接使用的专业结果。',
    capabilities: ['任务拆解', '方案输出', '结果复核'],
  },
}

function text(value) {
  return String(value == null ? '' : value).trim()
}

function hasChinese(value) {
  return /[\u3400-\u9fff]/.test(text(value))
}

/** 该文案是否夹带实现细节（节点 ID / 文件路径 / 内部代号） */
function looksInternal(value) {
  const raw = text(value)
  if (!raw) return false
  return INTERNAL_PATTERNS.some(re => re.test(raw))
}

/**
 * 对助手建议 / 任务上下文文案脱敏：抹掉内部路径与实现细节，避免把 ingest/ 等输入路径当产物推荐。
 * 整句不可用时回落为安全提示。
 */
function sanitizeChatSuggestion(value, fallback = '请查看右侧任务工作间中的真实产物。') {
  const raw = text(value)
  if (!raw) return ''
  if (!looksInternal(raw)) return raw
  let cleaned = raw
    .replace(/\b[\w./\\-]*ingest[\w./\\-]*/gi, '内部输入目录')
    .replace(/\b[\w-]+\.(?:md|json|ya?ml|js|ts|py|proto|txt|csv)\b/gi, '相关文件')
    .replace(/\b[sS]\d+-[a-z][a-z0-9-]*/g, '内部步骤')
  cleaned = text(cleaned.replace(/\s{2,}/g, ' '))
  if (!cleaned || looksInternal(cleaned)) return fallback
  return cleaned
}

/** 用于角色分类的原始信号：可以读内部文案，但只用来判断，不用来展示 */
function roleSignals(agent = {}) {
  const persona = agent.persona && typeof agent.persona === 'object' ? agent.persona : {}
  return [agent.title, persona.role, agent.id, agent.description]
    .map(text)
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function roleKeyOf(signals) {
  const s = text(signals).toLowerCase()
  if (/(story|product|producer|leader|\bpm\b|需求|产品|方案|澄清)/.test(s)) return 'product'
  if (/(qa|test|tester|测试|验收|回归|黑盒)/.test(s)) return 'qa'
  if (/(devops|\bops\b|operator|部署|发布|运维|灰度|监控|告警)/.test(s)) return 'devops'
  if (/(research|query|search|调研|问答|检索)/.test(s)) return 'research'
  if (/(frontend|front-end|\bfront\b|\bfe\b|前端|页面|\bui\b|交互)/.test(s)) return 'frontend'
  if (/(backend|back-end|\bback\b|\bbe\b|后端|接口|数据库|服务端|\bapi\b)/.test(s)) return 'backend'
  return 'general'
}

function isArchitect(signals) {
  return /(arch|architect|架构)/i.test(text(signals))
}

function preset(key) {
  return ROLE_PRESETS[key] || ROLE_PRESETS.general
}

function clip(value, max = SUMMARY_MAX) {
  const raw = text(value)
  if (raw.length <= max) return raw
  return `${raw.slice(0, max - 1)}…`
}

/**
 * 对外专家简介。
 * 优先使用作者显式提供的面向用户文案（display.summary / summary），
 * 其次才考虑 description；任一候选含实现细节或无中文即跳过，最终回落角色模板。
 */
function userFacingSummary(agent = {}, roleLabel = '') {
  const display = agent.display && typeof agent.display === 'object' ? agent.display : {}
  const candidates = [display.summary, agent.summary, agent.description]
  for (const candidate of candidates) {
    const value = text(candidate)
    if (!value || !hasChinese(value) || looksInternal(value)) continue
    return clip(value)
  }
  const key = roleKeyOf(roleSignals(agent))
  if (key === 'general' && roleLabel) {
    return `${roleLabel}会按工作流接收任务，并产出可以直接使用的专业结果。`
  }
  return preset(key).summary
}

/**
 * 对外能力标签。skills 是内部 slug，不能直接展示，
 * 因此按角色给出用户可读的能力词；架构类角色额外突出「架构设计」。
 */
function capabilityTags(agent = {}, limit = 3) {
  const display = agent.display && typeof agent.display === 'object' ? agent.display : {}
  const authored = Array.isArray(display.capabilities) ? display.capabilities : []
  const clean = authored
    .map(text)
    .filter(item => item && hasChinese(item) && !looksInternal(item))
  if (clean.length) return clean.slice(0, limit)

  const signals = roleSignals(agent)
  const base = preset(roleKeyOf(signals)).capabilities
  const tags = isArchitect(signals) ? ['架构设计', ...base] : [...base]
  return [...new Set(tags)].slice(0, limit)
}

/** 专家可参与的工作流阶段数（节点 key 本身是内部标识，只对外暴露数量） */
function stageCount(agent = {}) {
  return Array.isArray(agent.workflowNodes) ? agent.workflowNodes.length : 0
}

const workbenchPresenterApi = {
  SUMMARY_MAX,
  ROLE_PRESETS,
  looksInternal,
  sanitizeChatSuggestion,
  roleKeyOf,
  roleSignals,
  isArchitect,
  userFacingSummary,
  capabilityTags,
  stageCount,
}

if (typeof module === 'object' && module.exports) {
  module.exports = workbenchPresenterApi
}
if (typeof window !== 'undefined') {
  window.WorkbenchPresenter = workbenchPresenterApi
}
