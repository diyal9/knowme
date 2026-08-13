'use strict'

/**
 * 官方多 Agent 参考工作流目录（真可执行 Package，非 Demo 空壳）。
 * 供给管道经 collectSeeds / verticals 注入货架；启动走 local-team Agent Graph。
 */

const { normalizeWorkflowPackage } = require('./workflow-package')

const TERMINAL = 'n-terminal'

function member(id, agentPackageId, role, intent) {
  return {
    id,
    agentPackageId,
    expertId: agentPackageId,
    agentOrigin: 'local',
    role,
    intent,
  }
}

function agentNode(id, agentPackageId, role, intent) {
  return {
    id,
    type: 'agent',
    agentPackageId,
    agentOrigin: 'local',
    role,
    intent,
    name: role,
  }
}

function gateNode(id, gateRef, description) {
  return {
    id,
    type: 'gate',
    gateRef,
    description,
    name: description || gateRef,
  }
}

function terminalNode() {
  return { id: TERMINAL, type: 'terminal', status: 'completed', name: '完成' }
}

function buildPackage(raw) {
  const normalized = normalizeWorkflowPackage(raw)
  if (!normalized.ok) {
    throw new Error(`official workflow invalid: ${raw.id} · ${normalized.error || 'unknown'}`)
  }
  return normalized.package
}

/** 办公：纪要 → Gate → 待办编排 → 同步 */
const OFFICE_MEETING_LOOP = buildPackage({
  id: 'official-office-meeting-loop',
  name: '会议闭环',
  description: '把会议资料整理成可跟进的纪要与待办。',
  source: 'official',
  status: 'published',
  version: '1.0.0',
  goalTypes: ['office', 'meeting', 'minutes'],
  inputs: [{ id: 'meeting-materials', label: '会议资料或妙记', required: true }],
  outputs: [
    { id: 'minutes', label: '会议纪要' },
    { id: 'actions', label: '带负责人与截止日的待办' },
    { id: 'sync', label: '同步摘要' },
  ],
  agentRefs: [
    { id: 'meeting-scribe' },
    { id: 'action-owner' },
    { id: 'office-partner' },
  ],
  skillRefs: [{ id: 'writing-polish' }, { id: 'feishu-meeting-summary' }],
  executionBackends: ['local-team'],
  qualityGates: [{ id: 'owner-and-deadline', label: '待办必须包含负责人和截止时间' }],
  provenance: { kind: 'official-reference', domain: 'office', reference: true },
  graph: {
    template: '',
    goal: '整理会议资料，校验待办后同步到协作空间',
    members: [
      member('n-scribe', 'meeting-scribe', '纪要专家', '整理会议资料为纪要：决议、争议点与原文依据'),
      member('n-actions', 'action-owner', '待办编排', '从纪要提取待办，补齐负责人与截止日'),
      member('n-sync', 'office-partner', '办公同步', '生成可发送的同步摘要，必要时走飞书连接器'),
    ],
    gates: [{
      id: 'owner-and-deadline',
      title: '负责人与截止日校验',
      type: 'approval',
      description: '确认每条待办含负责人与截止时间后再进入编排与同步',
      params: {
        requiresUserApproval: true,
        onReject: { action: 'rollback', targetNodeId: 'n-scribe', maxAttempts: 2 },
      },
    }],
    nodes: [
      agentNode('n-scribe', 'meeting-scribe', '纪要专家', '整理会议资料为纪要：决议、争议点与原文依据'),
      gateNode('n-gate-owner', 'owner-and-deadline', '负责人与截止日校验'),
      agentNode('n-actions', 'action-owner', '待办编排', '从纪要提取待办，补齐负责人与截止日'),
      agentNode('n-sync', 'office-partner', '办公同步', '生成可发送的同步摘要，必要时走飞书连接器'),
      terminalNode(),
    ],
    edges: [
      { from: 'n-scribe', to: 'n-gate-owner', label: '交接纪要草案' },
      { from: 'n-gate-owner', to: 'n-actions', label: '通过校验' },
      { from: 'n-actions', to: 'n-sync', label: '交接待办清单' },
      { from: 'n-sync', to: TERMINAL, label: '同步完成' },
    ],
    parallelism: 1,
    joinStrategy: 'allSucceeded',
  },
})

/** 研发：制作人 → Gate → 开发 → Gate → 测试 */
const ENGINEERING_TEAM_DELIVERY = buildPackage({
  id: 'official-engineering-team-delivery',
  name: '三角色协作交付',
  description: '按制作人、开发、测试三角色完成可验证交付。',
  source: 'official',
  status: 'published',
  version: '1.0.0',
  goalTypes: ['engineering', 'delivery', 'team'],
  inputs: [{ id: 'requirement', label: '需求目标与仓库上下文', required: true }],
  outputs: [
    { id: 'plan', label: '规划与验收标准' },
    { id: 'change', label: '实现说明' },
    { id: 'evidence', label: '测试与门禁证据' },
  ],
  agentRefs: [
    { id: 'producer' },
    { id: 'developer' },
    { id: 'tester' },
  ],
  skillRefs: [{ id: 'code-review' }],
  executionBackends: ['local-team'],
  qualityGates: [
    { id: 'producer-uat', label: '制作人规划验收' },
    { id: 'dev-self-test', label: '开发自测 / lint 门禁' },
  ],
  provenance: { kind: 'official-reference', domain: 'engineering', reference: true },
  graph: {
    template: '',
    goal: '按三角色协作完成可验证交付',
    members: [
      member('n-producer', 'producer', '制作人', '产出目标拆解、验收标准与风险假设'),
      member('n-developer', 'developer', '开发', '按验收标准给出实现方案、改动要点与自测清单'),
      member('n-tester', 'tester', '测试', '按验收标准输出 QA 用例、反模式检查与结论'),
    ],
    gates: [
      {
        id: 'producer-uat',
        title: '制作人规划验收',
        type: 'approval',
        description: '确认规划与验收标准后再进入开发',
        params: {
          requiresUserApproval: true,
          onReject: { action: 'rollback', targetNodeId: 'n-producer', maxAttempts: 2 },
        },
      },
      {
        id: 'dev-self-test',
        title: '开发自测门禁',
        type: 'approval',
        description: '确认自测与风险说明后再进入测试',
        params: {
          requiresUserApproval: true,
          onReject: { action: 'rollback', targetNodeId: 'n-developer', maxAttempts: 2 },
        },
      },
    ],
    nodes: [
      agentNode('n-producer', 'producer', '制作人', '产出目标拆解、验收标准与风险假设'),
      gateNode('n-gate-producer', 'producer-uat', '制作人规划验收'),
      agentNode('n-developer', 'developer', '开发', '按验收标准给出实现方案、改动要点与自测清单'),
      gateNode('n-gate-dev', 'dev-self-test', '开发自测门禁'),
      agentNode('n-tester', 'tester', '测试', '按验收标准输出 QA 用例、反模式检查与结论'),
      terminalNode(),
    ],
    edges: [
      { from: 'n-producer', to: 'n-gate-producer', label: '提交规划' },
      { from: 'n-gate-producer', to: 'n-developer', label: '规划通过' },
      { from: 'n-developer', to: 'n-gate-dev', label: '提交实现与自测' },
      { from: 'n-gate-dev', to: 'n-tester', label: '自测通过' },
      { from: 'n-tester', to: TERMINAL, label: 'QA 完成' },
    ],
    parallelism: 1,
    joinStrategy: 'allSucceeded',
  },
})

/** 视觉：文案 → 提示词 → 人工审阅 Gate → 终态 */
const VISUAL_BRIEF_REVIEW = buildPackage({
  id: 'official-visual-brief-review',
  name: 'Brief 出图审阅',
  description: '把视觉 Brief 变成可审阅的文案与出图提示词。',
  source: 'official',
  status: 'published',
  version: '1.0.0',
  goalTypes: ['visual', 'image', 'campaign'],
  inputs: [{ id: 'brief', label: '视觉 Brief 或一句话目标', required: true }],
  outputs: [
    { id: 'copy', label: '文案方向' },
    { id: 'prompt', label: '图像提示词' },
    { id: 'export-pack', label: '审阅通过的导出说明' },
  ],
  agentRefs: [
    { id: 'copywriter' },
    { id: 'visual-designer' },
  ],
  skillRefs: [{ id: 'writing-polish' }, { id: 'visual-brief-prompt' }],
  executionBackends: ['local-team'],
  qualityGates: [{ id: 'human-review', label: '导出前人工审阅' }],
  provenance: { kind: 'official-reference', domain: 'visual', reference: true },
  graph: {
    template: '',
    goal: '把视觉 Brief 转为文案与提示词，经人工审阅后给出导出说明',
    members: [
      member('n-copy', 'copywriter', '文案', '把 Brief 整理为受众、卖点与文案方向'),
      member('n-design', 'visual-designer', '视觉', '产出可迭代图像提示词与构图约束'),
    ],
    gates: [{
      id: 'human-review',
      title: '人工选版与导出审阅',
      type: 'approval',
      description: '确认文案/提示词/构图后再进入终态导出说明',
      params: {
        requiresUserApproval: true,
        onReject: { action: 'rollback', targetNodeId: 'n-copy', maxAttempts: 2 },
      },
    }],
    nodes: [
      agentNode('n-copy', 'copywriter', '文案', '把 Brief 整理为受众、卖点与文案方向'),
      agentNode('n-design', 'visual-designer', '视觉', '产出可迭代图像提示词与构图约束'),
      gateNode('n-gate-review', 'human-review', '人工选版与导出审阅'),
      terminalNode(),
    ],
    edges: [
      { from: 'n-copy', to: 'n-design', label: '交接文案方向' },
      { from: 'n-design', to: 'n-gate-review', label: '提交提示词' },
      { from: 'n-gate-review', to: TERMINAL, label: '审阅通过' },
    ],
    parallelism: 1,
    joinStrategy: 'allSucceeded',
  },
})

const OFFICIAL_WORKFLOWS = Object.freeze([
  OFFICE_MEETING_LOOP,
  ENGINEERING_TEAM_DELIVERY,
  VISUAL_BRIEF_REVIEW,
])

const LEGACY_DEMO_SEED_IDS = Object.freeze([
  'office-meeting-to-actions',
  'engineering-delivery',
  'visual-brief-to-export',
])

function listOfficialWorkflowPackages() {
  return OFFICIAL_WORKFLOWS.map(item => ({ ...item, graph: { ...item.graph } }))
}

function requiredExpertIds() {
  const ids = new Set()
  for (const pkg of OFFICIAL_WORKFLOWS) {
    for (const ref of pkg.agentRefs || []) {
      if (ref?.id) ids.add(ref.id)
    }
  }
  return [...ids]
}

function isLegacyDemoSeedId(id) {
  const key = String(id || '').trim()
  return LEGACY_DEMO_SEED_IDS.includes(key)
}

module.exports = {
  TERMINAL,
  OFFICIAL_WORKFLOWS,
  LEGACY_DEMO_SEED_IDS,
  listOfficialWorkflowPackages,
  requiredExpertIds,
  isLegacyDemoSeedId,
}
