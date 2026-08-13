/**
 * workbench-task-brief — 任务事实摘要，防止协作区编造外部审批链
 */
const { describe, it } = require('node:test')
const assert = require('node:assert')
const {
  LOCAL_APPROVER,
  buildWorkbenchTaskBrief,
  classifyWorkbenchPaths,
  workbenchGroundingRules,
  buildWorkbenchCitations,
  formatWorkbenchCitationsForPrompt,
} = require('../src/lib/workbench-task-brief')

describe('workbench-task-brief', () => {
  it('marks done tasks as completed instead of waiting for process', () => {
    const brief = buildWorkbenchTaskBrief({
      status: 'done',
      currentNode: '',
      agents: ['开发者'],
      artifacts: [{ path: 'docs/report.md' }],
    })
    assert.equal(brief.waitingKind, 'none')
    assert.equal(brief.currentNodeLabel, '已完成')
    assert.match(brief.factualBrief, /已完成/)
    assert.doesNotMatch(brief.factualBrief, /等待流程推进/)
    assert.doesNotMatch(brief.factualBrief, /财务|法务|运营/)
    assert.ok(brief.artifacts.includes('docs/report.md'))
    assert.match(brief.nextAction, /任务产物/)
  })

  it('does not treat task input paths as artifacts in next-step guidance', () => {
    const classified = classifyWorkbenchPaths(
      [{ path: 'ingest/brief.md' }, { path: 'docs/report.md' }],
      { root: 'ingest/', prd: 'ingest/brief.md' }
    )
    assert.deepEqual(classified.artifacts.map(item => item.path), ['docs/report.md'])
    assert.ok(classified.inputs.some(item => item.path === 'ingest/brief.md'))

    const brief = buildWorkbenchTaskBrief({
      status: 'done',
      artifacts: [{ path: 'ingest/brief.md' }],
      inputs: { root: 'ingest/', prd: 'ingest/brief.md' },
    })
    assert.deepEqual(brief.artifacts, [])
    assert.doesNotMatch(brief.nextAction, /ingest\/brief\.md/)
    assert.doesNotMatch(brief.factualBrief, /已有产物：ingest/)
    assert.match(brief.factualBrief, /任务输入：已配置启动输入/)
  })

  it('rewrites misleading waiting labels when status is done', () => {
    const brief = buildWorkbenchTaskBrief({
      status: 'done',
      currentNode: '等待流程推进',
    })
    assert.equal(brief.currentNodeLabel, '已完成')
  })

  it('attributes pending gates to the local developer operator', () => {
    const brief = buildWorkbenchTaskBrief({
      status: 'running',
      currentNode: 'developer-review',
      pendingGates: [{ node: 'developer-review', title: '开发者验收' }],
      agents: ['开发者'],
    })
    assert.equal(brief.waitingKind, 'gate')
    assert.equal(brief.approver, LOCAL_APPROVER)
    assert.match(brief.factualBrief, /本机操作者（开发者）/)
    assert.match(brief.factualBrief, /通过 \/ 修订 \/ 打回/)
    assert.doesNotMatch(brief.factualBrief, /等待财务|法务审批|运营审批/)
    assert.match(brief.nextAction, /左侧对话/)
    assert.match(brief.nextAction, /不要假设存在财务、法务/)
  })

  it('describes clarification waiting without inventing departments', () => {
    const brief = buildWorkbenchTaskBrief({
      status: 'waiting',
      pendingClarifications: [{ question: '活动预算是多少？' }],
    })
    assert.equal(brief.waitingKind, 'clarification')
    assert.match(brief.factualBrief, /活动预算是多少？/)
    assert.match(brief.nextAction, /左侧对话/)
    assert.doesNotMatch(brief.factualBrief, /财务审批|法务/)
  })

  it('keeps clarification waiting even when status looks completed', () => {
    const brief = buildWorkbenchTaskBrief({
      status: 'done',
      terminalKind: 'success',
      clarification: {
        node: 'n3-proto',
        question: '需求信息不足，请回答以下问题',
      },
    })
    assert.equal(brief.waitingKind, 'clarification')
    assert.equal(brief.tone, 'waiting')
    assert.match(brief.headline, /补充|等待/)
    assert.notEqual(brief.headline, '任务已完成')
  })

  it('does not treat bare daemon node ids as the clarification question', () => {
    const {
      resolveClarificationDisplay,
      clarificationQuestionFromFields,
      clarificationFileCandidates,
      extractPromptFromClarificationFile,
      extractQuestionsFromDaemonText,
      extractClarificationHintFromLogs,
      looksLikeClarificationMetaQuestion,
      shouldAutoSubmitDaemonClarification,
      normalizeClarificationQuestions,
    } = require('../src/lib/workbench-task-brief')
    assert.equal(clarificationQuestionFromFields({ node: 'n3-proto' }), '')
    assert.equal(clarificationQuestionFromFields({ node: 'n3-proto', question: 'n3-proto' }), '')
    const bare = resolveClarificationDisplay({ node: 'n3-proto' })
    assert.equal(bare.hasExplicitQuestion, false)
    assert.match(bare.title, /n3-proto/)
    assert.match(bare.detail, /过程日志|未给出具体问题/)
    const rich = resolveClarificationDisplay({
      node: 'n3-proto',
      question: '请补充原型仓库地址与分支',
    })
    assert.equal(rich.hasExplicitQuestion, true)
    assert.equal(rich.title, '请补充原型仓库地址与分支')

    // Daemon API 主字段是 questions[]
    const fromApi = resolveClarificationDisplay({
      node: 'n3-proto',
      questions: [
        '请修复 preToolUse hook 在 Git Bash 下的调用方式',
        '或将 plan 摘要内容粘贴到澄清答复中',
      ],
      question: 'answer file present',
    })
    assert.equal(fromApi.hasExplicitQuestion, true)
    assert.equal(fromApi.questions.length, 2)
    assert.equal(fromApi.title, '请补充以下信息')
    assert.match(fromApi.detail, /请修复 preToolUse/)
    assert.doesNotMatch(fromApi.detail, /answer file present/)
    assert.equal(
      clarificationQuestionFromFields({
        node: 'n3-proto',
        questions: ['活动预算是多少？'],
      }),
      '活动预算是多少？',
    )

    assert.equal(
      extractPromptFromClarificationFile('# Question\n请补充验收标准\n\n# Answer\n'),
      '# Question\n请补充验收标准',
    )
    const returnText = [
      'status: NEED_INPUT',
      'node_id: n3-proto',
      'questions:',
      '- 请修复 hook 调用方式？',
      '- 或粘贴 plan §A/§D 摘要',
      '',
    ].join('\n')
    assert.deepEqual(
      extractQuestionsFromDaemonText(returnText, 'n3-proto'),
      ['请修复 hook 调用方式？', '或粘贴 plan §A/§D 摘要'],
    )
    assert.match(
      extractPromptFromClarificationFile(returnText, 'n3-proto'),
      /请修复 hook/,
    )
    const answerOnly = [
      '# 澄清答复 — n3-proto',
      '',
      '## 答复',
      '需要我补充什么？',
      '',
    ].join('\n')
    assert.equal(extractPromptFromClarificationFile(answerOnly, 'n3-proto'), '')
    assert.deepEqual(extractQuestionsFromDaemonText(answerOnly, 'n3-proto'), [])

    const withOriginal = [
      '# 澄清答复 — n3-proto',
      '',
      '## 原始问题',
      '- 仓库地址是什么？',
      '',
      '## 答复',
      'https://example.com',
      '',
    ].join('\n')
    assert.equal(
      extractPromptFromClarificationFile(withOriginal, 'n3-proto'),
      '仓库地址是什么？',
    )

    assert.equal(
      extractClarificationHintFromLogs('[17:39:39] action[2]: need_input node=n3-proto\n', 'n3-proto'),
      '',
    )
    assert.equal(
      extractClarificationHintFromLogs(
        '[17:40:01] need_input n3-proto: answer file present\n',
        'n3-proto',
      ),
      '',
    )
    assert.equal(
      extractClarificationHintFromLogs(
        '[17:40:02] need_input n3-proto: answer already present\n',
        'n3-proto',
      ),
      '',
    )
    assert.equal(
      extractClarificationHintFromLogs(
        '[17:40:03] need_input n3-proto: question sent to open_id (timeout 14400s)\n',
        'n3-proto',
      ),
      '',
    )
    assert.equal(
      extractClarificationHintFromLogs(
        '[17:40:04] need_input n3-proto: awaiting .clarifications/n3-proto.md (timeout 14400s)\n',
        'n3-proto',
      ),
      '',
    )
    assert.equal(
      extractClarificationHintFromLogs(
        '[17:40:05] need_input n3-proto: TIMEOUT after 14400s\n',
        'n3-proto',
      ),
      '',
    )
    assert.equal(
      clarificationQuestionFromFields({ node: 'n3-proto', question: 'answer file present' }),
      '',
    )
    assert.equal(
      clarificationQuestionFromFields({ node: 'n3-proto', question: '需要我补充什么？' }),
      '',
    )
    const tech = resolveClarificationDisplay({ node: 'n3-proto', question: 'answer file present' })
    assert.equal(tech.hasExplicitQuestion, false)
    assert.match(tech.detail, /过程日志|未给出具体问题/)

    const candidates = clarificationFileCandidates('n3-proto', 'rdpi-ff-zero-gift')
    assert.ok(candidates[0].includes('.nine/.daemon-runtime/rdpi-ff-zero-gift/.dispatch/'))
    assert.ok(candidates.some(p => p.endsWith('.return.txt')))

    assert.equal(looksLikeClarificationMetaQuestion('需要我补充什么？'), true)
    assert.equal(looksLikeClarificationMetaQuestion('仓库地址是 https://example.com/a.git'), false)
    assert.equal(
      shouldAutoSubmitDaemonClarification('需要我补充什么？', { node: 'n3-proto', question: '请补充仓库地址' }),
      false,
    )
    assert.equal(
      shouldAutoSubmitDaemonClarification('仓库地址是 x', { node: 'n3-proto', question: '请补充仓库地址' }),
      true,
    )
    assert.equal(
      shouldAutoSubmitDaemonClarification('仓库地址是 x', { node: 'n3-proto' }),
      false,
    )
    assert.deepEqual(
      normalizeClarificationQuestions({
        node: 'n3-proto',
        questions: ['Q1', 'answer file present', 'n3-proto', 'Q1'],
      }),
      ['Q1'],
    )
  })

  it('derives user-facing tone and headline per state', () => {
    const done = buildWorkbenchTaskBrief({ status: 'done' })
    assert.equal(done.tone, 'done')
    assert.equal(done.headline, '任务已完成')

    const gate = buildWorkbenchTaskBrief({
      status: 'running',
      pendingGates: [{ node: 'developer-review', title: '开发者验收' }],
    })
    assert.equal(gate.tone, 'waiting')
    assert.match(gate.headline, /等待你确认/)

    const clarify = buildWorkbenchTaskBrief({
      status: 'waiting',
      pendingClarifications: [{ question: '预算多少？' }],
    })
    assert.equal(clarify.tone, 'waiting')
    assert.match(clarify.headline, /补充/)

    const running = buildWorkbenchTaskBrief({ status: 'running' })
    assert.equal(running.tone, 'running')
    assert.equal(running.headline, '正在执行')

    const failed = buildWorkbenchTaskBrief({ status: 'failed' })
    assert.equal(failed.tone, 'error')
    assert.match(failed.headline, /失败/)

    const cancelled = buildWorkbenchTaskBrief({ status: 'cancelled' })
    assert.equal(cancelled.tone, 'muted')
    assert.match(cancelled.headline, /取消/)
    assert.match(cancelled.nextAction, /重新启动/)

    const degraded = buildWorkbenchTaskBrief({ status: 'done', degraded: true })
    assert.equal(degraded.tone, 'muted')
    assert.match(degraded.headline, /流程详情暂不可用/)

    const failedTerminal = buildWorkbenchTaskBrief({
      status: 'done',
      terminalKind: 'failure',
      degraded: true,
    })
    assert.equal(failedTerminal.tone, 'error')
    assert.match(failedTerminal.headline, /失败/)
    assert.doesNotMatch(failedTerminal.waitingDetail, /没有待审批/)
  })

  it('exports grounding rules that forbid fabricated roles', () => {
    const rules = workbenchGroundingRules()
    assert.match(rules, /财务、法务、运营/)
    assert.match(rules, /本机操作者（开发者）/)
    assert.match(rules, /本地工作流\/知识库未提供/)
    assert.match(rules, /第一性原则/)
    assert.match(rules, /引用来源/)
    assert.match(rules, /零幻觉/)
  })

  it('builds workbench citations from task facts and artifacts', () => {
    const citations = buildWorkbenchCitations({
      slug: 'demo-task',
      factualBrief: '状态：等待澄清\n等待类型：澄清',
      waitingKind: 'clarification',
      waitingTitle: '请补充仓库地址',
      clarification: { node: 'n3-proto', question: '请补充仓库地址' },
      artifacts: [{ path: 'artifacts/report.md', name: 'report.md' }],
      workflowName: 'demo-flow',
    }, { attachmentName: 'notes.txt' })
    assert.ok(citations.some(c => c.kind === 'task-facts'))
    assert.ok(citations.some(c => c.kind === 'clarification'))
    assert.ok(citations.some(c => c.kind === 'artifact'))
    assert.ok(citations.some(c => c.kind === 'attachment'))
    const prompt = formatWorkbenchCitationsForPrompt(citations)
    assert.match(prompt, /本轮可用来源/)
    assert.match(prompt, /任务事实/)
    assert.equal(formatWorkbenchCitationsForPrompt([]), '本轮可用来源：无（仅可依据用户本轮消息；不足则说明未提供）')
  })
})
