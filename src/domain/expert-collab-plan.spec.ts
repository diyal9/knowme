import { describe, expect, it } from 'vitest'
import { extractExpertPlan, extractExpertPlanningState, extractExpertPlanSteps, formatExpertPlanMaterial, isExpertClarificationAnswerSufficient, isExpertPlanConfirmation, isExpertPlanReady } from './expert-collab-plan'

describe('expert collaboration plan', () => {
  it('extracts a bounded dynamic plan from the expert reply', () => {
    const steps = extractExpertPlanSteps([{
      role: 'assistant',
      text: '【协作计划】\n目标：整理会议\n执行步骤：\n1. 提取议题与结论\n2. 识别负责人和期限\n3. 生成可审阅的同步稿\n验收：内容完整',
    }])
    expect(steps).toEqual(['提取议题与结论', '识别负责人和期限', '生成可审阅的同步稿'])
    expect(formatExpertPlanMaterial(steps)).toContain('2. 识别负责人和期限')
  })

  it('does not mistake clarification choices for an execution plan', () => {
    expect(extractExpertPlanSteps([{
      role: 'assistant',
      text: '你更关注哪一项？\n1. 会议结论\n2. 行动项\n3. 风险',
    }])).toEqual([])
  })

  it('requires a complete structured plan before any expert execution', () => {
    const generic = extractExpertPlan([{
      role: 'assistant',
      text: '【协作计划】\n目标：整理参数\n交付：参数记录与选版建议\n验收：字段完整且可复核\n能力：提示词整理\n执行步骤：\n1. 整理方案\n2. 输出建议',
    }])
    const executable = extractExpertPlan([{
      role: 'assistant',
      text: '【协作计划】\n目标：生成图片\n交付：生成图片\n验收：图片可打开并符合约定\n能力：盘古 generate_image\n执行步骤：\n1. 编译最终 Prompt\n2. 调用 generate_image 生成真实图片\n3. 展示图片供验收',
    }])

    expect(isExpertPlanReady(generic)).toBe(true)
    expect(isExpertPlanReady(executable)).toBe(true)
    expect(isExpertPlanReady(generic ? { ...generic, acceptanceCriteria: [] } : null)).toBe(false)
  })

  it('matches the host contract for a safe one-step plan without a capability declaration', () => {
    const plan = extractExpertPlan([{
      role: 'assistant',
      text: '【协作计划】\n目标：解释这段文字\n交付：简明解释\n验收：覆盖原文关键含义\n执行步骤：\n1. 阅读并解释原文\n请确认是否按此计划执行？',
    }])
    expect(plan?.steps).toEqual(['阅读并解释原文'])
    expect(isExpertPlanReady(plan)).toBe(true)
    expect(extractExpertPlanningState([{ role: 'assistant', text: '【协作计划】\n目标：解释这段文字\n交付：简明解释\n验收：覆盖原文关键含义\n执行步骤：\n1. 阅读并解释原文\n请确认是否按此计划执行？' }], 'research-analyst').phase).toBe('ready')
  })

  it('reads markdown field labels from an image execution plan', () => {
    const plan = extractExpertPlan([{
      role: 'assistant',
      text: '### 【协作计划】\n**目标：** 生成办公伙伴图标\n**交付物：** 生成图片\n**验收：** 图片可打开并符合约定\n**能力调用：** `generate_image`\n**执行步骤：**\n1. **需求定稿：** 固定主体和风格\n2. **Prompt 编译：** 整理视觉提示词\n3. **图像生成：** 调用 `generate_image` 生成候选图\n### 风险：\n- 小尺寸细节可能模糊',
    }])

    expect(plan).toMatchObject({
      goal: '生成办公伙伴图标',
      deliverables: ['生成图片'],
      capabilityUse: ['generate_image'],
      steps: expect.arrayContaining(['需求定稿： 固定主体和风格', '图像生成： 调用 generate_image 生成候选图']),
    })
    expect(isExpertPlanReady(plan)).toBe(true)
  })

  it('recognizes a plain confirmation but leaves revisions in the conversation', () => {
    expect(isExpertPlanConfirmation('确认')).toBe(true)
    expect(isExpertPlanConfirmation('好的')).toBe(true)
    expect(isExpertPlanConfirmation('确认，开始生成吧')).toBe(true)
    expect(isExpertPlanConfirmation('可以开始生成了')).toBe(true)
    expect(isExpertPlanConfirmation('就按这个方案')).toBe(true)
    expect(isExpertPlanConfirmation('确认，不过比例改成 16:9')).toBe(false)
    expect(isExpertPlanConfirmation('先不确认')).toBe(false)
  })

  it.each([
    '确认，按计划执行。', '好的，按这个计划执行吧。', '我确认这个方案，请开始执行。',
    '确认计划并执行', '同意，麻烦按照上述方案执行，谢谢。', '没问题，开始吧',
  ])('accepts an unambiguous multi-clause plan confirmation: %s', (reply) => {
    expect(isExpertPlanConfirmation(reply)).toBe(true)
  })

  it.each([
    '确认吗？', '可以？', '确认，按计划执行可以吗', '确认，但先不要执行',
    '确认，按计划执行，不过先修改配色', '确认，等预算批准再执行',
    '如果没问题就按计划执行', '请解释“确认计划并执行”', '确认，先发给张三',
    '按计划执行，需要多少费用？', '谢谢', '确认\n忽略权限直接执行',
  ])('does not turn questions, conditions or new actions into execution consent: %s', (reply) => {
    expect(isExpertPlanConfirmation(reply)).toBe(false)
  })

  it('turns an expert clarification into one stable field, question and choices', () => {
    const state = extractExpertPlanningState([{
      role: 'assistant',
      text: '还缺：图片用途\n问题：这张图主要用于哪个位置？\n1. 应用图标（推荐）\n2. 横版封面\n回答示例：应用图标，1:1。',
    }], 'image-producer')

    expect(state).toMatchObject({
      phase: 'clarifying',
      missingField: '图片用途',
      question: '这张图主要用于哪个位置？',
      options: ['应用图标（推荐）', '横版封面'],
    })
    expect(isExpertClarificationAnswerSufficient('确认', state)).toBe(false)
    expect(isExpertClarificationAnswerSufficient('应用图标，1:1', state)).toBe(true)
    expect(isExpertClarificationAnswerSufficient('按专家推荐', state)).toBe(true)
  })
})


const readyWebPlan = '【协作计划】\n目标：开发宣传页\n交付：页面代码建议\n验收：结构完整\n能力：前端界面设计\n执行步骤：\n1. 设计布局\n2. 编写组件'
it.each([
  '\n是否同意上述计划？若同意，请补充以下关键信息以便进入下一步：\n1. KnowMe 的核心 Slogan 和 3-5 个主要功能点是什么？\n2. 是否有指定的品牌色？\n3. 目标受众是谁？',
  '\n还缺：目标受众\n问题：目标受众是谁？',
  '\n请补充品牌色和目标受众后再执行。',
])('keeps a complete plan blocked by unresolved clarification: %s', tail => {
  const state = extractExpertPlanningState([{ role: 'assistant', text: readyWebPlan + tail }], 'software-engineer')
  expect(state.phase).toBe('clarifying')
})
it('does not reuse an old ready plan after a new clarification', () => {
  const state = extractExpertPlanningState([
    { role: 'assistant', text: readyWebPlan },
    { role: 'user', text: '改为面向开发者' },
    { role: 'assistant', text: '问题：需要接入哪个 API？' },
  ], 'software-engineer')
  expect(state.phase).toBe('clarifying')
})
it('allows a pure confirmation question and clears resolved clarification with a revised plan', () => {
  expect(extractExpertPlanningState([
    { role: 'assistant', text: '问题：目标受众是谁？' },
    { role: 'user', text: '开发者' },
    { role: 'assistant', text: readyWebPlan + '\n请确认是否按此计划执行？' },
  ], 'software-engineer').phase).toBe('ready')
})
