const { describe, it } = require('node:test')
const assert = require('node:assert')
const {
  classifyWritingTask,
  buildWritingPromptContext,
  shouldCreateWritingArtifact,
  buildWritingArtifact,
} = require('../src/lib/writing-workflow')

describe('writing workflow', () => {
  it('classifies requirement-doc shortcuts and builds humanizer guidance', () => {
    const task = classifyWritingTask(
      '请作为需求文档搭档',
      '写需求文档',
      { title: '写需求文档' },
    )
    assert.equal(task?.id, 'requirements_doc')
    const prompt = buildWritingPromptContext({
      prompt: '请作为需求文档搭档',
      displayPrompt: '写需求文档',
      context: '背景：重构写作办公搭档',
      grounding: { title: '写需求文档' },
    })
    assert.match(prompt, /Humanizer-zh/)
    assert.match(prompt, /验收标准/)
    assert.match(prompt, /最多 3 个关键缺口/)
  })

  it('classifies polish rewrite and injects active source grounding hints', () => {
    const task = classifyWritingTask('请润色改写这段内容', '润色改写', { title: '润色改写' })
    assert.equal(task?.id, 'polish_rewrite')
    const prompt = buildWritingPromptContext({
      prompt: '请润色改写这段内容',
      displayPrompt: '润色改写',
      context: '原始段落',
      grounding: { title: '润色改写' },
      activeSource: {
        type: 'web',
        displayName: '示例网页',
        pageUrl: 'https://example.com/article',
      },
    })
    assert.match(prompt, /活跃内容源/)
    assert.match(prompt, /示例网页/)
    assert.match(prompt, /read_file/)
    assert.match(prompt, /不得把检索片段写成既定事实/)
  })

  it('creates review artifacts for long structured writing outputs', () => {
    const task = classifyWritingTask('', '按提纲成稿', { title: '按提纲成稿' })
    const text = [
      '# 项目周报',
      '',
      '## 本周进展',
      '- 完成入口重构',
      '- 接入审阅流',
      '',
      '## 风险',
      '1. 去 AI 味强度仍需按文体微调',
      '',
      '## 下周计划',
      '- 完成飞书草稿确认',
      '- 补齐测试',
      '',
      '## 待确认',
      '请产品确认默认输出模版',
    ].join('\n')
    assert.equal(shouldCreateWritingArtifact(text.repeat(4), task), true)
    const art = buildWritingArtifact(text, task)
    assert.equal(art.type, 'text')
    assert.equal(art.status, 'draft')
    assert.equal(art.meta.workspaceAction, 'writing_review')
    assert.equal(art.meta.allowFeishuDraft, true)
  })
})
