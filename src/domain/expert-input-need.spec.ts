import { describe, expect, it } from 'vitest'
import { describeExpertFailure, describeExpertInputNeed } from './expert-input-need'

describe('describeExpertFailure', () => {
  it('keeps the safe structured cause and omits stack frames', () => {
    expect(describeExpertFailure({ kind: 'retryable_failure', action: 'retry',
      detail: '连接超时（15s）：dashscope.aliyuncs.com 未返回数据\n    at request (private-path:1:2)',
    })).toMatchObject({ title: '本次执行未完成', detail: '连接超时（15s）：dashscope.aliyuncs.com 未返回数据' })
  })

  it.each([
    undefined, '', '   ', 'Authorization: Bearer private-token', 'api_key="private-key"',
    'password: private-password', 'secret=private-value', 'sk-private-key-value',
    'https://service.test/error?token=private', 'Traceback (most recent call last):\nprivate-path',
  ])('uses safe fallback for missing or diagnostic detail: %j', (detail) => {
    expect(describeExpertFailure({ kind: 'unknown', action: 'unknown', detail }).detail)
      .toBe('当前没有可展示的具体失败原因。')
  })
})

describe('describeExpertInputNeed', () => {
  it('migrates legacy file-tool capability prompts to workspace guidance', () => {
    expect(describeExpertInputNeed('', '', {
      kind: 'capability_unavailable', action: 'open_capability', item: 'write_file',
      title: '需要启用任务能力', detail: '联合工具面未提供必需工具：write_file',
    })).toMatchObject({
      kind: 'workspace', action: 'open_workspace', title: '需要可写的项目目录', item: 'write_file',
    })
  })

  it('does not describe a pending approval as missing user information', () => {
    expect(describeExpertInputNeed('', '', { kind: 'approval_required', action: 'provide_input' }))
      .toMatchObject({ action: 'review_approval', title: '等待操作审批', options: [] })
  })
  it.each([
    ['authorization_required', 'open_capability', '需要完成能力授权'],
    ['configuration_required', 'open_settings', '需要完成配置'],
    ['tool_failed', 'retry', '工具执行未完成'],
    ['missing_information', 'provide_input', '还需要一项信息'],
  ])('keeps the fallback title specific to %s', (kind, action, title) => {
    expect(describeExpertInputNeed('', '', { kind, action }).title).toBe(title)
  })
  it('keeps an uncertain operation separate from safe retry or missing materials', () => {
    const need = describeExpertInputNeed('工具调用失败，请重试', '', {
      kind: 'operation_status_unknown', action: 'retry', detail: '回包超时，操作可能已经生效。',
    })
    expect(need).toMatchObject({ kind: 'execution', action: 'provide_input', title: '需要核对操作结果' })
    expect(need.nextStep).toContain('不要直接重复执行')
    expect(need.composerPlaceholder).toContain('说明核对结果')
    expect(need.detail).toBe('回包超时，操作可能已经生效。')
  })

  it('treats a missing required read as an execution block, not missing user information', () => {
    expect(describeExpertInputNeed('缺少必需读取：公开网络搜索')).toMatchObject({
      kind: 'execution',
      title: '需要完成一次读取',
      item: '公开网络搜索',
      detail: '不需要补充资料。专家还没有完成「公开网络搜索」。',
    })
  })

  it('reroutes public search when an internal meeting task was classified incorrectly', () => {
    expect(describeExpertInputNeed('缺少必需读取：公开网络搜索', '分析我上周五的会议')).toMatchObject({
      kind: 'reroute',
      title: '执行路径需要调整',
      item: '公开网络搜索',
      alternative: '飞书会议内容',
      detail: '这项任务应读取你的飞书会议，不需要公开网络搜索。',
    })
  })

  it('hides internal grounding codes from the user', () => {
    const need = describeExpertInputNeed('missing_required_evidence: requiredEvidence')
    expect(need.kind).toBe('execution')
    expect(need.detail).not.toMatch(/requiredEvidence|missing_required_evidence/)
  })

  it('keeps a concrete material request as user input', () => {
    expect(describeExpertInputNeed('请补充需要分析的会议时间范围')).toMatchObject({
      kind: 'information',
      title: '还需要一项信息',
      item: '需要分析的会议时间范围',
    })
  })

  it('routes an unavailable connector to capability setup', () => {
    expect(describeExpertInputNeed('未授权连接器：飞书妙记')).toMatchObject({
      kind: 'capability',
      title: '需要启用能力',
      item: '飞书妙记',
    })
  })

  it('prefers a structured configuration block over ambiguous event copy', () => {
    expect(describeExpertInputNeed('请继续补充信息', '生成图片', {
      kind: 'configuration_required',
      action: 'open_settings',
      title: '需要配置模型',
      item: '模型 API',
      detail: '尚未配置可用的模型服务。',
    })).toMatchObject({
      kind: 'configuration',
      action: 'open_settings',
      title: '需要配置模型',
      item: '模型 API',
    })
  })

  it('keeps every preflight blocker for a single actionable conversation turn', () => {
    const need = describeExpertInputNeed('', '', {
      kind: 'capability_unavailable',
      action: 'open_capability',
      title: '需要启用任务能力',
      item: 'generate_image',
      detail: '生图能力当前不可用。',
      issues: [
        { id: 'generate_image', code: 'required_tool_unavailable', message: '生图能力当前不可用。' },
        { id: 'pango-image-mcp', code: 'connector_unavailable', message: '连接器未启用。' },
      ],
    })
    expect(need.issues).toEqual([
      { id: 'generate_image', code: 'required_tool_unavailable', detail: '生图能力当前不可用。' },
      { id: 'pango-image-mcp', code: 'connector_unavailable', detail: '连接器未启用。' },
    ])
  })

  it('preserves the exact question, choices and example for real user input', () => {
    expect(describeExpertInputNeed('', '', {
      kind: 'missing_information',
      action: 'provide_input',
      item: '图片比例',
      question: '这张图主要用于哪个位置？',
      options: ['应用图标', '横版封面'],
      example: '例如：应用图标，1:1。',
    })).toMatchObject({
      kind: 'information',
      action: 'provide_input',
      question: '这张图主要用于哪个位置？',
      options: ['应用图标', '横版封面'],
      example: '例如：应用图标，1:1。',
    })
  })
})
