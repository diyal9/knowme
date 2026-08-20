export type OccupationDefinition = {
  id: string
  label: string
  responsibilities: string
  focus: string[]
  deliverables: string[]
}

export type RoleIndustryDefinition = {
  id: string
  label: string
  defaultOccupationId: string
  occupations: OccupationDefinition[]
}

export type OccupationDefaults = {
  id: string
  version: string
  source: 'builtin'
  industryId: string
  industryLabel: string
  occupationId: string
  occupationLabel: string
  aboutMe: string
  collaborationPreference: string
}

export const DEFAULT_ROLE_INDUSTRY = 'general'
export const ROLE_CONFIG_VERSION = 'builtin-2026.08'

function role(
  id: string,
  label: string,
  responsibilities: string,
  focus: string[],
  deliverables: string[]
): OccupationDefinition {
  return { id, label, responsibilities, focus, deliverables }
}

export const INDUSTRY_ROLE_CATALOG: RoleIndustryDefinition[] = [
  {
    id: 'general', label: '通用办公', defaultOccupationId: 'manager',
    occupations: [
      role('manager', '管理者', '目标拆解、团队协同、决策与复盘', ['优先级判断', '跨团队对齐', '风险与进度管理'], ['结论与决策点', '责任人和截止时间', '风险清单']),
      role('project-manager', '项目经理', '项目计划、范围、进度、风险和干系人沟通', ['里程碑推进', '依赖管理', '会议与行动项'], ['项目计划', '状态简报', '风险与行动项']),
      role('operations', '综合运营', '业务流程、数据跟踪、活动执行与复盘', ['运营目标拆解', '执行节奏', '数据复盘'], ['执行清单', '指标看板口径', '复盘结论']),
      role('human-resources', '人力资源', '招聘、组织协同、员工发展与制度沟通', ['岗位与人才匹配', '组织沟通', '制度落地'], ['招聘或培养计划', '沟通稿', '跟进清单']),
      role('finance', '财务', '预算、核算、经营分析与财务风险控制', ['数据准确性', '预算偏差', '合规风险'], ['测算表口径', '差异分析', '风险提示']),
      role('administration', '行政', '办公保障、供应商协调、制度执行与活动支持', ['事项排期', '资源协调', '执行留痕'], ['办理清单', '通知文本', '供应商跟进表']),
    ],
  },
  {
    id: 'software', label: '互联网 / 软件', defaultOccupationId: 'product-manager',
    occupations: [
      role('client-engineer', '客户端开发', '客户端架构、交互实现、性能优化与版本交付', ['状态与交互边界', '性能与兼容性', '发布风险'], ['技术方案', '改动范围', '验证与回滚清单']),
      role('server-engineer', '服务端开发', '服务设计、接口契约、数据一致性与稳定性保障', ['接口与数据模型', '容量和稳定性', '上下游影响'], ['接口方案', '异常与边界清单', '上线与监控方案']),
      role('qa-engineer', '测试', '测试策略、用例设计、缺陷跟踪与发布质量评估', ['需求可测性', '风险覆盖', '回归范围'], ['测试计划', '用例与数据', '质量结论']),
      role('product-manager', '产品', '用户问题、需求范围、方案设计、优先级与验收', ['问题定义', '范围与取舍', '验收标准'], ['需求说明', '流程与边界', '验收清单']),
      role('visual-designer', '美术 / 视觉设计', '视觉方案、设计规范、资源交付与体验一致性', ['视觉目标', '组件与状态', '资源规范'], ['设计说明', '状态清单', '交付与验收规范']),
      role('product-operations', '产品运营', '用户运营、活动策略、内容触达与数据复盘', ['目标人群', '活动链路', '转化与留存'], ['运营方案', '排期与物料清单', '指标复盘']),
      role('data-engineer', '数据工程 / 分析', '数据建模、指标口径、数据质量与分析洞察', ['指标定义', '数据链路', '结论可信度'], ['指标口径', '分析过程', '结论与建议']),
      role('ai-engineer', 'AI 工程 / 架构', '模型应用、Agent 架构、评测、成本与可靠性治理', ['任务与模型边界', '工具和上下文', '评测与成本'], ['架构方案', '评测集与指标', '风险和降级策略']),
    ],
  },
  {
    id: 'game', label: '游戏', defaultOccupationId: 'game-designer',
    occupations: [
      role('game-client', '客户端开发', '玩法表现、系统交互、性能优化与多端版本交付', ['玩法实现边界', '资源和性能', '版本兼容'], ['技术拆解', '联调清单', '版本验证方案']),
      role('game-server', '服务端开发', '游戏服务、战斗或活动逻辑、数据安全与稳定性', ['状态一致性', '活动配置', '容量和容灾'], ['服务方案', '协议与数据变更', '监控和回滚清单']),
      role('game-qa', '游戏测试', '玩法、功能、兼容性与版本质量验证', ['核心体验路径', '配置组合', '版本回归'], ['测试计划', '风险用例', '版本质量结论']),
      role('game-designer', '游戏策划', '玩法规则、系统设计、数值与版本需求验收', ['核心体验', '规则闭环', '数值和边界'], ['策划案', '规则与状态表', '验收标准']),
      role('game-artist', '游戏美术', '角色、场景、界面或特效的视觉设计与资源交付', ['风格一致性', '资源规格', '性能预算'], ['美术需求单', '资源清单', '验收与修改意见']),
      role('game-operations', '游戏运营', '版本活动、玩家沟通、商业化与数据复盘', ['活动节奏', '玩家反馈', '转化与留存'], ['活动方案', '公告与客服口径', '数据复盘']),
      role('game-producer', '制作人 / 项目管理', '版本目标、跨职能协同、资源取舍与交付风险', ['版本范围', '团队依赖', '质量和进度'], ['版本计划', '决策记录', '风险与行动项']),
    ],
  },
  {
    id: 'sales', label: '销售 / 商务', defaultOccupationId: 'sales-representative',
    occupations: [
      role('sales-representative', '销售', '客户开发、需求判断、商机推进与成交复盘', ['客户目标', '决策链', '下一步推进'], ['客户纪要', '跟进计划', '商机风险']),
      role('business-development', '商务拓展', '合作机会、伙伴关系、商务方案与谈判推进', ['合作价值', '权责边界', '谈判条件'], ['合作方案', '谈判清单', '里程碑计划']),
      role('solution-consultant', '售前 / 解决方案', '客户需求澄清、方案设计、演示与技术应答', ['业务场景', '方案匹配', '可交付边界'], ['需求澄清表', '解决方案', '演示与答疑材料']),
      role('account-manager', '客户成功 / 大客户经理', '客户关系、价值交付、续约与问题协调', ['客户健康度', '价值证明', '续约风险'], ['客户成功计划', '阶段回顾', '风险与升级事项']),
      role('sales-operations', '销售运营', '销售流程、数据口径、预测与团队效率支持', ['漏斗质量', '预测准确性', '流程效率'], ['销售看板', '预测说明', '流程改进清单']),
    ],
  },
  {
    id: 'education', label: '教育 / 培训', defaultOccupationId: 'teacher',
    occupations: [
      role('teacher', '教师 / 讲师', '教学设计、课堂交付、作业反馈与学习评估', ['学习目标', '教学节奏', '理解与反馈'], ['教案', '课堂材料', '反馈与评估']),
      role('course-designer', '课程研发', '课程体系、内容结构、教学活动与评估设计', ['能力目标', '内容递进', '评估有效性'], ['课程大纲', '单元设计', '评估方案']),
      role('academic-affairs', '教务', '排课、师生协调、教学资料与过程质量管理', ['排期冲突', '信息准确性', '过程留痕'], ['排课表', '通知与清单', '异常处理记录']),
      role('student-operations', '学员运营', '学员触达、学习跟进、社群维护与续学转化', ['学习活跃', '关键节点触达', '问题闭环'], ['运营节奏', '触达文案', '学员跟进表']),
      role('enrollment-consultant', '招生顾问', '需求判断、课程匹配、咨询跟进与报名转化', ['学员目标', '课程匹配', '异议处理'], ['咨询纪要', '跟进计划', '课程建议']),
      role('training-manager', '培训管理', '企业培训需求、项目交付、讲师协调与效果评估', ['业务需求', '培训落地', '效果验证'], ['培训方案', '项目排期', '效果复盘']),
    ],
  },
  {
    id: 'content', label: '内容 / 媒体', defaultOccupationId: 'editor',
    occupations: [
      role('editor', '编辑', '选题策划、内容组织、事实核验与审校发布', ['受众价值', '结构与事实', '发布质量'], ['选题卡', '编辑意见', '发布检查表']),
      role('copywriter', '文案 / 写作者', '内容构思、写作改稿、语气统一与成稿交付', ['表达目标', '读者路径', '语言准确性'], ['内容大纲', '可发布成稿', '修改说明']),
      role('visual-content-designer', '视觉设计', '内容视觉、版式、品牌一致性与素材交付', ['信息层级', '视觉一致性', '多渠道适配'], ['视觉方案', '尺寸与素材清单', '交付规范']),
      role('video-producer', '视频编导 / 制作', '选题脚本、拍摄组织、后期与发布交付', ['叙事节奏', '拍摄可行性', '成片质量'], ['脚本与分镜', '拍摄清单', '后期修改单']),
      role('content-operations', '内容运营', '内容策略、排期分发、增长与数据复盘', ['内容供给', '渠道分发', '增长指标'], ['内容日历', '分发计划', '数据复盘']),
      role('community-operations', '社群 / 新媒体运营', '用户互动、社群秩序、活动与舆情反馈', ['用户关系', '互动节奏', '风险响应'], ['社群计划', '运营话术', '问题与反馈清单']),
    ],
  },
]

const BY_ID = Object.fromEntries(INDUSTRY_ROLE_CATALOG.map((item) => [item.id, item]))

export function normalizeRoleIndustry(raw: unknown) {
  const id = String(raw == null ? '' : raw).trim().toLowerCase()
  return BY_ID[id] ? id : DEFAULT_ROLE_INDUSTRY
}

export function getRoleIndustry(raw: unknown): RoleIndustryDefinition {
  return BY_ID[normalizeRoleIndustry(raw)]
}

export function getOccupations(industryRaw: unknown) {
  return getRoleIndustry(industryRaw).occupations.map((item) => ({ ...item }))
}

export function normalizeOccupation(industryRaw: unknown, occupationRaw: unknown) {
  const industry = getRoleIndustry(industryRaw)
  const id = String(occupationRaw == null ? '' : occupationRaw).trim().toLowerCase()
  return industry.occupations.some((item) => item.id === id) ? id : industry.defaultOccupationId
}

export function getOccupation(industryRaw: unknown, occupationRaw: unknown) {
  const industry = getRoleIndustry(industryRaw)
  const id = normalizeOccupation(industry.id, occupationRaw)
  return industry.occupations.find((item) => item.id === id) || industry.occupations[0]
}

export function getOccupationDefaults(industryRaw: unknown, occupationRaw: unknown): OccupationDefaults {
  const industry = getRoleIndustry(industryRaw)
  const occupation = getOccupation(industry.id, occupationRaw)
  return {
    id: `${industry.id}:${occupation.id}`,
    version: ROLE_CONFIG_VERSION,
    source: 'builtin',
    industryId: industry.id,
    industryLabel: industry.label,
    occupationId: occupation.id,
    occupationLabel: occupation.label,
    aboutMe: `我在${industry.label}领域从事${occupation.label}工作，主要负责${occupation.responsibilities}。`,
    collaborationPreference: [
      `你是面向${occupation.label}岗位的专业办公助手。`,
      `优先协助我处理：${occupation.focus.join('、')}。`,
      `默认输出：${occupation.deliverables.join('、')}。`,
      '先给结论和下一步，再补充依据、边界与风险；缺少事实时明确指出并询问，不把岗位模板当成我的真实项目事实。',
    ].join('\n'),
  }
}
