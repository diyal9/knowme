'use strict'

/** 随产品发布、可直接运行的专业工作流。日常办公由智能伙伴按需调用 Skill 完成。 */
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

const ART_IMAGE_PRODUCTION = buildPackage({
  id: 'official-art-image-production', name: '美术生图',
  description: '从传播目标到候选图片、参数记录和人工选版的完整生图流程。',
  source: 'official', status: 'published', version: '2.2.0',
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
  agentRefs: [{ id: 'image-producer' }],
  skillRefs: [{ id: 'visual-brief-prompt' }, { id: 'writing-polish' }], executionBackends: ['local-team'],
  qualityGates: [{ id: 'image-selection', label: '候选图片人工选版' }],
  provenance: { kind: 'official-production', domain: 'visual', reference: false },
  graph: {
    goal: '形成创意与生图方案，执行真实生图并由用户完成选版',
    members: [
      member('n-creative', 'image-producer', '创意策划', '切换创意概念模式，定义受众、核心概念、文案和视觉方向'),
      member('n-design', 'image-producer', '视觉设计', '切换视觉方案模式，形成构图、风格、提示词、负面约束和标准生图交接包'),
      member('n-generate', 'image-producer', '生图执行', '消费上游标准生图交接包，调用可用图像能力生成候选图并记录参数；能力不可用时等待配置'),
    ],
    gates: [{
      id: 'image-selection', title: '候选图片人工选版', type: 'approval',
      description: '预览真实候选图，确认选版或提出定向修改意见',
      params: { requiresUserApproval: true, onReject: { action: 'rollback', targetNodeId: 'n-design', maxAttempts: 4 } },
    }],
    nodes: [
      agentNode('n-creative', 'image-producer', '创意策划', '按创意概念模式输出核心创意概念、主文案和视觉 Brief'),
      agentNode('n-design', 'image-producer', '视觉设计', '按视觉方案模式输出可执行画面方案和完整「生图交接包」；字段必须覆盖用途、主体、构图、风格、比例、正负向 Prompt、参数、验收与约束，末尾标记“可直接生成”'),
      agentNode('n-generate', 'image-producer', '生图执行', '读取上游「生图交接包」并作为最终 Brief，不重复澄清已覆盖字段；调用盘古生成真实候选图片、预览和参数记录'),
      gateNode('n-gate', 'image-selection', '预览候选图片并人工选版'), terminalNode(),
    ],
    edges: [
      { from: 'n-creative', to: 'n-design', label: '交接创意 Brief' },
      { from: 'n-design', to: 'n-generate', label: '交接标准生图包（可直接生成）' },
      { from: 'n-generate', to: 'n-gate', label: '提交候选图片' },
      { from: 'n-gate', to: TERMINAL, label: '确认最终选版' },
    ],
    parallelism: 1, joinStrategy: 'allSucceeded',
  },
})

const OFFICIAL_WORKFLOWS = Object.freeze([ART_IMAGE_PRODUCTION])
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
