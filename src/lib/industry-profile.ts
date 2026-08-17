/**
 * User industry profile: tone hints + deterministic goal examples.
 * Node: require('./lib/industry-profile')
 * Browser: <script src="lib/industry-profile.js"> → window.IndustryProfile
 */
;(function (root, factory) {
  const api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  if (root) root.IndustryProfile = api
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict'

  const DEFAULT_INDUSTRY = 'general'

  const INDUSTRIES = [
    {
      id: 'general',
      label: '通用办公',
      toneHint: '用语保持中性专业，避免垂直行业黑话；示例与建议用通用办公表述。',
      goalExamples: [
        '完成周报初稿并同步给负责人',
        '推进跨部门对齐会的议程与材料',
        '整理待办并标出今日必须完成的一项',
      ],
    },
    {
      id: 'software',
      label: '互联网/软件',
      toneHint: '偏向研发与产品协作口吻：缺陷、迭代、评审、接口与上线风险。',
      goalExamples: [
        '修复线上缺陷并完成回归验证',
        '推进本周迭代评审并确认验收标准',
        '同步接口变更给调用方',
      ],
    },
    {
      id: 'game',
      label: '游戏',
      toneHint: '偏向版本交付口吻：数值表、活动配置、版本风险与验收。',
      goalExamples: [
        '对齐版本数值表并确认改动范围',
        '推进活动配置验收',
        '整理版本风险清单并同步负责人',
      ],
    },
    {
      id: 'sales',
      label: '销售/商务',
      toneHint: '偏向商务推进口吻：客户进展、合同、复盘与行动项同步。',
      goalExamples: [
        '完成销售复盘初稿',
        '推进客户合同签署',
        '整理行动项并同步负责人',
      ],
    },
    {
      id: 'education',
      label: '教育/培训',
      toneHint: '偏向教学交付口吻：课件、学员跟进、课后反馈与排课。',
      goalExamples: [
        '完成今日课件提纲',
        '跟进学员作业反馈',
        '确认下周排课与教室安排',
      ],
    },
    {
      id: 'content',
      label: '内容/媒体',
      toneHint: '偏向内容生产口吻：选题、成稿、审校与发布排期。',
      goalExamples: [
        '完成选题大纲并确认发布点',
        '推进稿件一校并标注待补事实',
        '整理本周内容排期并同步编辑',
      ],
    },
  ]

  const BY_ID = Object.fromEntries(INDUSTRIES.map((item) => [item.id, item]))

  function normalizeIndustry(raw) {
    const id = String(raw == null ? '' : raw).trim().toLowerCase()
    return BY_ID[id] ? id : DEFAULT_INDUSTRY
  }

  function getIndustry(raw) {
    return BY_ID[normalizeIndustry(raw)]
  }

  function industryLabel(raw) {
    return getIndustry(raw).label
  }

  function formatIndustryProfileText(raw) {
    const item = getIndustry(raw)
    return `用户所属行业：${item.label}`
  }

  function getToneHint(raw) {
    return getIndustry(raw).toneHint
  }

  function getGoalExamples(raw) {
    return getIndustry(raw).goalExamples.slice(0, 3)
  }

  function formatEmptyTodayPriorityBody(raw) {
    const item = getIndustry(raw)
    const examples = getGoalExamples(item.id)
      .map((ex, index) => `${index + 1}. 「${ex}」`)
      .join('\n')
    return [
      '## 今日优先级',
      '当前没有可用的飞书事实（今日日程、未完成待办均为空）。',
      '',
      '请告诉我你今天最想推进的 **1 个真实工作目标**，我再帮你拆成今日 Top3。',
      '',
      `示例格式（仅作${item.label}场景占位，不是你的真实任务）：`,
      examples,
    ].join('\n')
  }

  function industryPromptBlock(raw) {
    const item = getIndustry(raw)
    return [
      '【行业偏好】',
      formatIndustryProfileText(item.id),
      `口吻倾向：${item.toneHint}`,
      '缺事实追问时，可用行业占位示例说明格式；禁止把示例写成用户真实任务或编造真实项目名。',
    ].join('\n')
  }

  return {
    DEFAULT_INDUSTRY,
    INDUSTRIES,
    normalizeIndustry,
    getIndustry,
    industryLabel,
    formatIndustryProfileText,
    getToneHint,
    getGoalExamples,
    formatEmptyTodayPriorityBody,
    industryPromptBlock,
  }
})
