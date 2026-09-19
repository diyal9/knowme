'use strict'

/**
 * Versioned, role-aware classification scaffold for Local Brain.
 * These nodes organize future cognition; they are not claims about what the
 * user already knows and are deliberately excluded from local retrieval.
 */

const TAXONOMY_VERSION = 1

const DEFAULT_OCCUPATION = Object.freeze({
  general: 'manager', software: 'product-manager', game: 'game-designer',
  sales: 'sales-representative', education: 'teacher', content: 'editor',
})

const ROLE_LABELS = Object.freeze({
  manager: '管理者', 'project-manager': '项目经理', operations: '综合运营', 'human-resources': '人力资源', finance: '财务', administration: '行政',
  'client-engineer': '客户端开发', 'server-engineer': '服务端开发', 'qa-engineer': '测试', 'product-manager': '产品', 'visual-designer': '视觉设计', 'product-operations': '产品运营', 'data-engineer': '数据工程 / 分析', 'ai-engineer': 'AI 工程 / 架构',
  'game-client': '游戏客户端开发', 'game-server': '游戏服务端开发', 'game-qa': '游戏测试', 'game-designer': '游戏策划', 'game-artist': '游戏美术', 'game-operations': '游戏运营', 'game-producer': '游戏制作人',
  'sales-representative': '销售', 'business-development': '商务拓展', 'solution-consultant': '售前 / 解决方案', 'account-manager': '客户成功 / 大客户经理', 'sales-operations': '销售运营',
  teacher: '教师 / 讲师', 'course-designer': '课程研发', 'academic-affairs': '教务', 'student-operations': '学员运营', 'enrollment-consultant': '招生顾问', 'training-manager': '培训管理',
  editor: '编辑', copywriter: '文案 / 写作者', 'visual-content-designer': '内容视觉设计', 'video-producer': '视频编导 / 制作', 'content-operations': '内容运营', 'community-operations': '社群 / 新媒体运营',
})

const BASE = Object.freeze({
  general: [
    ['goals', '目标与职责', ['目标', '职责', '优先级']], ['projects', '项目与计划', ['项目', '计划', '里程碑']],
    ['decisions', '决策与问题', ['决策', '问题', '风险']], ['process', '流程与制度', ['流程', '制度', '规范']],
    ['collaboration', '协作与关系', ['协作', '团队', '关系']], ['metrics', '数据与指标', ['数据', '指标', '分析']],
    ['resources', '资料与工具', ['资料', '工具', '模板']], ['growth', '复盘与成长', ['复盘', '经验', '成长']],
  ],
  software: [
    ['requirements', '产品与需求', ['产品', '需求', '用户', '场景']], ['architecture', '架构与方案', ['架构', '方案', '设计']],
    ['engineering', '工程与实现', ['工程', '实现', '代码', '开发']], ['quality', '质量与评测', ['测试', '质量', '评测', '用例']],
    ['delivery', '发布与运维', ['发布', '部署', '运维', '版本']], ['security', '安全与合规', ['安全', '合规', '权限']],
    ['collaboration', '项目与协作', ['项目', '协作', '计划', '依赖']], ['assets', '技术资产', ['资料', '工具', '规范', '资产']],
  ],
  game: [
    ['experience', '产品与玩法', ['玩法', '体验', '玩家', '产品']], ['systems', '系统与数值', ['系统', '数值', '规则']],
    ['content', '内容与关卡', ['内容', '关卡', '剧情']], ['engineering', '工程研发', ['工程', '开发', '客户端', '服务端']],
    ['art', '美术与音频', ['美术', '视觉', '音频', '资源']], ['quality', '质量与性能', ['测试', '质量', '性能']],
    ['operations', '运营与数据', ['运营', '活动', '数据', '商业化']], ['production', '版本与协作', ['版本', '项目', '协作', '计划']],
  ],
  sales: [
    ['customers', '客户与关系', ['客户', '关系', '联系人']], ['opportunities', '商机与需求', ['商机', '需求', '线索']],
    ['solutions', '方案与价值', ['方案', '价值', '产品']], ['negotiation', '谈判与合同', ['谈判', '合同', '条款']],
    ['pipeline', '跟进与流程', ['跟进', '流程', '漏斗']], ['forecast', '目标与预测', ['目标', '预测', '业绩']],
    ['market', '市场与竞品', ['市场', '竞品', '行业']], ['review', '复盘与方法', ['复盘', '方法', '经验']],
  ],
  education: [
    ['learners', '学员与目标', ['学员', '学生', '目标']], ['curriculum', '课程与内容', ['课程', '内容', '大纲']],
    ['teaching', '教学与活动', ['教学', '课堂', '活动']], ['assessment', '评估与反馈', ['评估', '作业', '反馈']],
    ['operations', '教务与运营', ['教务', '运营', '排课']], ['materials', '资料与工具', ['资料', '教材', '工具']],
    ['collaboration', '师生与协作', ['师生', '协作', '沟通']], ['growth', '研究与成长', ['研究', '复盘', '成长']],
  ],
  content: [
    ['audience', '受众与选题', ['受众', '选题', '用户']], ['research', '素材与研究', ['素材', '研究', '事实']],
    ['creation', '创作与编辑', ['创作', '写作', '编辑', '脚本']], ['visual', '视觉与制作', ['视觉', '设计', '视频', '制作']],
    ['distribution', '分发与渠道', ['分发', '渠道', '发布']], ['brand', '品牌与风格', ['品牌', '风格', '语气']],
    ['growth', '增长与数据', ['增长', '数据', '运营']], ['archive', '内容资产', ['资产', '资料', '模板']],
  ],
})

function profileFor(input = {}) {
  const requestedIndustry = String(input.industry || 'general').trim().toLowerCase()
  const industry = BASE[requestedIndustry] ? requestedIndustry : 'general'
  const occupationId = String(input.occupationId || DEFAULT_OCCUPATION[industry]).trim().toLowerCase() || DEFAULT_OCCUPATION[industry]
  return { industry, occupationId, profileId: `${industry}:${occupationId}`, roleLabel: ROLE_LABELS[occupationId] || '当前岗位' }
}

function categoriesFor(profile) {
  const occupation = profile.occupationId
  if (/qa|test/.test(occupation)) return [
    ['strategy', '测试策略', ['策略', '风险', '范围']], ['cases', '用例与数据', ['用例', '数据', '场景']],
    ['defects', '缺陷与回归', ['缺陷', '回归', '问题']], ['automation', '自动化与工具', ['自动化', '工具', '脚本']],
    ['quality', '质量与验收', ['质量', '验收', '标准']], ['performance', '性能与兼容', ['性能', '兼容', '稳定性']],
    ['release', '版本与发布', ['版本', '发布', '上线']], ['collaboration', '协作与复盘', ['协作', '复盘', '项目']],
  ]
  if (/engineer|game-client|game-server/.test(occupation)) return BASE.software
  if (/product-manager|game-designer/.test(occupation)) return [
    ['users', '用户与场景', ['用户', '场景', '问题']], ['requirements', '需求与范围', ['需求', '范围', '优先级']],
    ['experience', '方案与体验', ['方案', '体验', '流程']], ['metrics', '指标与数据', ['指标', '数据', '分析']],
    ['decisions', '决策与取舍', ['决策', '取舍', '风险']], ['delivery', '版本与验收', ['版本', '验收', '发布']],
    ['collaboration', '协作与计划', ['协作', '计划', '项目']], ['research', '研究与沉淀', ['研究', '竞品', '资料']],
  ]
  if (/designer|artist/.test(occupation)) return [
    ['brief', '目标与需求', ['目标', '需求', '受众']], ['concept', '概念与方案', ['概念', '方案', '创意']],
    ['system', '视觉与规范', ['视觉', '规范', '组件']], ['assets', '素材与资产', ['素材', '资源', '资产']],
    ['states', '状态与适配', ['状态', '适配', '尺寸']], ['review', '评审与修改', ['评审', '反馈', '修改']],
    ['delivery', '交付与验收', ['交付', '验收', '版本']], ['inspiration', '灵感与研究', ['灵感', '研究', '趋势']],
  ]
  if (/operations|administration|academic-affairs/.test(occupation)) return [
    ['goals', '目标与节奏', ['目标', '节奏', '排期']], ['users', '对象与触达', ['用户', '学员', '触达']],
    ['activities', '活动与执行', ['活动', '执行', '任务']], ['process', '流程与机制', ['流程', '机制', '制度']],
    ['content', '内容与物料', ['内容', '物料', '文案']], ['metrics', '指标与数据', ['指标', '数据', '转化']],
    ['issues', '问题与风险', ['问题', '风险', '舆情']], ['review', '复盘与优化', ['复盘', '优化', '经验']],
  ]
  if (/manager|producer/.test(occupation)) return BASE.general
  return BASE[profile.industry] || BASE.general
}

function buildTaxonomy(store, input = {}) {
  const profile = profileFor(input)
  const evidenceId = `evidence:brain-taxonomy:${profile.profileId}:v${TAXONOMY_VERSION}`
  const rootId = `taxonomy:${profile.profileId}:root`
  const evidence = store.normalizeEvidence({
    id: evidenceId,
    type: 'local_file',
    title: `${profile.roleLabel} Brain 分类模板`,
    documentRef: `knowme://brain-taxonomy/${profile.profileId}`,
    snippet: '系统分类骨架只用于组织知识，不代表用户已经掌握其中内容。',
    persistence: 'local',
    contentHash: `brain-taxonomy-v${TAXONOMY_VERSION}:${profile.profileId}`,
  })
  const root = store.normalizeNode({
    id: rootId,
    kind: 'concept',
    label: `${profile.roleLabel}知识框架`,
    summary: '根据当前岗位初始化的 Brain 分类骨架；分类本身不计入已理解。',
    tags: ['brain-taxonomy', 'brain-taxonomy-root', `taxonomy-profile:${profile.profileId}`],
    authority: 5,
  })
  const nodes = [root]
  const claims = []
  categoriesFor(profile).forEach(([key, label, keywords], index, all) => {
    const node = store.normalizeNode({
      id: `taxonomy:${profile.profileId}:${key}`,
      kind: 'concept',
      label,
      summary: `${profile.roleLabel}的知识分类入口；会收纳后续确认的本地认知。`,
      tags: [
        'brain-taxonomy', 'brain-taxonomy-category', `taxonomy:${key}`, `taxonomy-order:${index}`,
        ...(index === all.length - 1 ? ['taxonomy-catchall'] : []),
        ...keywords.map(keyword => `taxonomy-keyword:${keyword}`),
      ],
      authority: 5,
    })
    nodes.push(node)
    claims.push(store.normalizeClaim({
      id: `claim:brain-taxonomy:${profile.profileId}:${key}`,
      subjectId: rootId,
      predicate: 'contains',
      objectNodeId: node.id,
      status: 'confirmed',
      confidence: 1,
      evidenceRefs: [evidenceId],
    }))
  })
  return { version: TAXONOMY_VERSION, ...profile, evidence, nodes, claims }
}

function isTaxonomyNode(node) {
  return Array.isArray(node?.tags) && node.tags.includes('brain-taxonomy')
}

module.exports = { TAXONOMY_VERSION, profileFor, categoriesFor, buildTaxonomy, isTaxonomyNode }
