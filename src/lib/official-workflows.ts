'use strict'

/** 三个随产品发布、可直接运行的官方工作流。 */
const { normalizeWorkflowPackage } = require('./workflow-package')

const TERMINAL = 'n-terminal'

function member(id, agentPackageId, role, intent) {
  return { id, agentPackageId, expertId: agentPackageId, agentOrigin: 'local', role, intent }
}

function agentNode(id, agentPackageId, role, intent) {
  return { id, type: 'agent', agentPackageId, agentOrigin: 'local', role, intent, name: role }
}

function gateNode(id, gateRef, name) {
  return { id, type: 'gate', gateRef, description: name, name }
}

function terminalNode() {
  return { id: TERMINAL, type: 'terminal', status: 'completed', name: '完成' }
}

function buildPackage(raw) {
  const normalized = normalizeWorkflowPackage(raw)
  if (!normalized.ok) throw new Error(`official workflow invalid: ${raw.id} · ${normalized.error || 'unknown'}`)
  return normalized.package
}

const PRODUCT_REQUIREMENT = buildPackage({
  id: 'official-product-requirement', name: '写产品需求',
  description: '把业务想法整理成有证据、可评审、可验收的产品需求。',
  source: 'official', status: 'published', version: '2.0.0',
  goalTypes: ['product', 'requirement', 'prd'],
  inputs: [
    { id: 'goal', label: '业务目标或待解决的问题', required: true },
    { id: 'materials', label: '用户反馈、现状材料与约束', required: false },
  ],
  outputs: [
    { id: 'evidence', label: '用户问题与证据清单' },
    { id: 'prd', label: '产品需求文档' },
    { id: 'review', label: '评审结论与修改记录' },
  ],
  agentRefs: [{ id: 'user-researcher' }, { id: 'product-manager' }, { id: 'requirement-reviewer' }],
  skillRefs: [{ id: 'writing-polish' }], executionBackends: ['local-team'],
  qualityGates: [{ id: 'requirement-approval', label: '需求范围与验收标准确认' }],
  provenance: { kind: 'official-production', domain: 'product', reference: false },
  graph: {
    goal: '从真实材料提炼用户问题，形成产品需求并完成正式评审',
    members: [
      member('n-research', 'user-researcher', '用户研究', '提炼用户问题、证据、机会点与待验证假设'),
      member('n-product', 'product-manager', '产品经理', '形成目标、范围、流程、规则、异常和验收标准完整的 PRD'),
      member('n-review', 'requirement-reviewer', '需求评审', '检查完整性、可验证性、依赖和风险并给出结论'),
    ],
    gates: [{
      id: 'requirement-approval', title: '需求范围与验收标准确认', type: 'approval',
      description: '确认需求边界、关键规则和验收标准后形成正式版本',
      params: { requiresUserApproval: true, onReject: { action: 'rollback', targetNodeId: 'n-product', maxAttempts: 3 } },
    }],
    nodes: [
      agentNode('n-research', 'user-researcher', '用户研究', '从材料中提炼用户问题、证据和机会点'),
      agentNode('n-product', 'product-manager', '产品经理', '基于证据编写完整产品需求文档'),
      agentNode('n-review', 'requirement-reviewer', '需求评审', '逐项评审需求并输出修改建议'),
      gateNode('n-gate', 'requirement-approval', '确认需求范围与验收标准'), terminalNode(),
    ],
    edges: [
      { from: 'n-research', to: 'n-product', label: '交接用户证据' },
      { from: 'n-product', to: 'n-review', label: '提交 PRD 草案' },
      { from: 'n-review', to: 'n-gate', label: '提交评审结论' },
      { from: 'n-gate', to: TERMINAL, label: '形成正式需求' },
    ],
    parallelism: 1, joinStrategy: 'allSucceeded',
  },
})

const ART_IMAGE_PRODUCTION = buildPackage({
  id: 'official-art-image-production', name: '美术生图',
  description: '从传播目标到候选图片、参数记录和人工选版的完整生图流程。',
  source: 'official', status: 'published', version: '2.0.0',
  goalTypes: ['visual', 'image', 'creative'],
  inputs: [
    { id: 'brief', label: '传播目标、受众与使用场景', required: true },
    { id: 'brand', label: '品牌规范、尺寸与禁用元素', required: false },
  ],
  outputs: [
    { id: 'creative', label: '创意概念与视觉 Brief' },
    { id: 'images', label: '候选图像与参数记录' },
    { id: 'selection', label: '选版结论与修改意见' },
  ],
  agentRefs: [{ id: 'creative-director' }, { id: 'visual-designer' }, { id: 'image-producer' }],
  skillRefs: [{ id: 'visual-brief-prompt' }, { id: 'writing-polish' }], executionBackends: ['local-team'],
  qualityGates: [{ id: 'image-selection', label: '候选图片人工选版' }],
  provenance: { kind: 'official-production', domain: 'visual', reference: false },
  graph: {
    goal: '形成创意与生图方案，执行真实生图并由用户完成选版',
    members: [
      member('n-creative', 'creative-director', '创意策划', '定义受众、核心概念、文案和视觉方向'),
      member('n-design', 'visual-designer', '视觉设计', '形成构图、风格、提示词和负面约束'),
      member('n-generate', 'image-producer', '生图执行', '调用可用图像能力生成候选图并记录参数；能力不可用时等待配置'),
    ],
    gates: [{
      id: 'image-selection', title: '候选图片人工选版', type: 'approval',
      description: '预览真实候选图，确认选版或提出定向修改意见',
      params: { requiresUserApproval: true, onReject: { action: 'rollback', targetNodeId: 'n-design', maxAttempts: 4 } },
    }],
    nodes: [
      agentNode('n-creative', 'creative-director', '创意策划', '输出核心创意概念、主文案和视觉 Brief'),
      agentNode('n-design', 'visual-designer', '视觉设计', '输出可执行的画面方案、提示词和选版标准'),
      agentNode('n-generate', 'image-producer', '生图执行', '生成真实候选图片、预览和参数记录'),
      gateNode('n-gate', 'image-selection', '预览候选图片并人工选版'), terminalNode(),
    ],
    edges: [
      { from: 'n-creative', to: 'n-design', label: '交接创意 Brief' },
      { from: 'n-design', to: 'n-generate', label: '交接生图方案' },
      { from: 'n-generate', to: 'n-gate', label: '提交候选图片' },
      { from: 'n-gate', to: TERMINAL, label: '确认最终选版' },
    ],
    parallelism: 1, joinStrategy: 'allSucceeded',
  },
})

const DAILY_OFFICE = buildPackage({
  id: 'official-daily-office', name: '日常办公',
  description: '把会议材料转成正式纪要、行动项和可发送的同步稿。',
  source: 'official', status: 'published', version: '2.0.0',
  goalTypes: ['office', 'meeting', 'follow-up'],
  inputs: [
    { id: 'materials', label: '会议转写、笔记或相关文档', required: true },
    { id: 'audience', label: '同步对象与发送渠道', required: false },
  ],
  outputs: [
    { id: 'minutes', label: '可追溯的正式纪要' },
    { id: 'actions', label: '负责人、截止日明确的行动项' },
    { id: 'message', label: '可直接审阅的同步稿' },
  ],
  agentRefs: [{ id: 'meeting-scribe' }, { id: 'action-owner' }, { id: 'office-partner' }],
  skillRefs: [{ id: 'writing-polish' }], executionBackends: ['local-team'],
  qualityGates: [{ id: 'office-send-review', label: '对外同步前确认' }],
  provenance: { kind: 'official-production', domain: 'office', reference: false },
  graph: {
    goal: '整理会议事实，形成可追踪行动项和可发送同步稿',
    members: [
      member('n-scribe', 'meeting-scribe', '会议纪要', '提取决议、分歧、待确认项和原文依据'),
      member('n-actions', 'action-owner', '行动项管理', '补齐事项、负责人、截止日、依赖和完成标准'),
      member('n-office', 'office-partner', '办公协作', '按对象与渠道整理可直接发送的同步稿'),
    ],
    gates: [{
      id: 'office-send-review', title: '对外同步前确认', type: 'approval',
      description: '确认事实、责任人、截止日与收件范围；流程本身不自动发送',
      params: { requiresUserApproval: true, onReject: { action: 'rollback', targetNodeId: 'n-actions', maxAttempts: 3 } },
    }],
    nodes: [
      agentNode('n-scribe', 'meeting-scribe', '会议纪要', '生成可追溯的正式会议纪要'),
      agentNode('n-actions', 'action-owner', '行动项管理', '形成可追踪行动项并标出缺失责任信息'),
      agentNode('n-office', 'office-partner', '办公协作', '生成适配目标渠道的同步稿和发送检查清单'),
      gateNode('n-gate', 'office-send-review', '对外同步前确认'), terminalNode(),
    ],
    edges: [
      { from: 'n-scribe', to: 'n-actions', label: '交接正式纪要' },
      { from: 'n-actions', to: 'n-office', label: '交接行动项' },
      { from: 'n-office', to: 'n-gate', label: '提交同步稿' },
      { from: 'n-gate', to: TERMINAL, label: '确认办公交付' },
    ],
    parallelism: 1, joinStrategy: 'allSucceeded',
  },
})

const OFFICIAL_WORKFLOWS = Object.freeze([PRODUCT_REQUIREMENT, ART_IMAGE_PRODUCTION, DAILY_OFFICE])
const LEGACY_DEMO_SEED_IDS = Object.freeze([
  'office-meeting-to-actions', 'engineering-delivery', 'visual-brief-to-export',
  'official-office-meeting-loop', 'official-engineering-team-delivery', 'official-visual-brief-review',
])

function listOfficialWorkflowPackages() {
  return OFFICIAL_WORKFLOWS.map(item => ({ ...item, graph: { ...item.graph } }))
}

function requiredExpertIds() {
  return [...new Set(OFFICIAL_WORKFLOWS.flatMap(pkg => (pkg.agentRefs || []).map(ref => ref.id).filter(Boolean)))]
}

function isLegacyDemoSeedId(id) {
  return LEGACY_DEMO_SEED_IDS.includes(String(id || '').trim())
}

module.exports = {
  TERMINAL, OFFICIAL_WORKFLOWS, LEGACY_DEMO_SEED_IDS,
  listOfficialWorkflowPackages, requiredExpertIds, isLegacyDemoSeedId,
}
