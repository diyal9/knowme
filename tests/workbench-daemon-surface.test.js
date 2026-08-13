'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const {
  curateDaemonPaths,
  daemonPathPresentation,
  daemonMaterialChecklist,
  daemonRunRecordView,
  compactDaemonCardTitle,
  compactDaemonCardSummary,
  daemonTaskCardView,
  filterDaemonRunRecords,
  searchDaemonRunRecords,
  formMeetsMinMaterialGate,
  resolveIngestRequirements,
  evaluateIngest,
  buildDaemonLaunchContextFromForm,
  formatDaemonPurposeTitle,
  resolveDaemonPurposeTitleLocal,
  DAEMON_PURPOSE_PREFIX,
} = require('../src/lib/workbench-daemon-surface')

describe('workbench daemon surface', () => {
  it('curates at most four primary paths and parks the rest under more', () => {
    const workflows = [
      { id: 'a', catalog: { visibility: 'primary', order: 10 } },
      { id: 'b', catalog: { visibility: 'primary', order: 20 } },
      { id: 'c', catalog: { visibility: 'primary', order: 30 } },
      { id: 'd', catalog: { visibility: 'primary', order: 40 } },
      { id: 'e', catalog: { visibility: 'primary', order: 50 } },
      { id: 'adv', catalog: { visibility: 'advanced', order: 5 } },
    ]
    const curated = curateDaemonPaths(workflows)
    assert.deepEqual(curated.primary.map(item => item.id), ['a', 'b', 'c', 'd'])
    assert.ok(curated.more.some(item => item.id === 'e'))
    assert.ok(curated.more.some(item => item.id === 'adv'))
  })

  it('backfills primary when catalog has no primary entries', () => {
    const curated = curateDaemonPaths([
      { id: 'x', catalog: { visibility: 'advanced', order: 2 } },
      { id: 'y', catalog: { visibility: 'advanced', order: 1 } },
    ])
    assert.equal(curated.primary.length, 2)
    assert.equal(curated.primary[0].id, 'y')
    assert.equal(curated.more.length, 0)
  })

  it('builds soft material checklist and hard-blocks offline or locked paths', () => {
    const offline = daemonMaterialChecklist({
      daemon: { online: false, hint: '离线' },
      workflow: { id: 'flow', name: '编码', locked: false },
      context: {},
    })
    assert.equal(offline.canStart, false)
    assert.ok(offline.hardBlockers.some(item => item.id === 'connection'))

    const soft = daemonMaterialChecklist({
      daemon: { online: true },
      workflow: { id: 'flow', name: '编码', locked: false },
      context: {},
    })
    assert.equal(soft.canStart, true)
    assert.ok(soft.warnings.some(item => item.id === 'prd'))

    const locked = daemonMaterialChecklist({
      daemon: { online: true },
      workflow: { id: 'flow', name: '编码', locked: true },
      context: { inputs: { prd: 'docs/PRD.md' } },
    })
    assert.equal(locked.canStart, false)
  })

  it('projects pipeline records with human titles and filter buckets', () => {
    const view = daemonRunRecordView({
      slug: 'rdpi-uat-producer-1',
      intent: '制作人验收冒烟',
      workflow: 'team-run',
      state: 'waiting',
    }, [{ id: 'team-run', name: '团队验收' }])
    assert.equal(view.title, '制作人验收冒烟')
    assert.equal(view.bucket, 'needs_you')
    assert.match(view.nextAction, /门禁|确认|澄清/)

    const records = [
      view,
      daemonRunRecordView({ slug: 'ok-1', intent: '已完成交付', state: 'done' }),
      daemonRunRecordView({ slug: 'run-1', intent: '编码中', state: 'running' }),
    ]
    assert.equal(filterDaemonRunRecords(records, 'needs_you').length, 1)
    assert.equal(filterDaemonRunRecords(records, 'done')[0].slug, 'ok-1')
    assert.equal(filterDaemonRunRecords(records, 'active')[0].slug, 'run-1')
  })

  it('treats idle + pending_clarifications as needs_you like WebUI 待处理', () => {
    const view = daemonRunRecordView({
      slug: 'rdpi-ff-zero-gift',
      intent: '零礼包',
      workflow: 'daemon-stage-impl',
      state: 'idle',
      pending_clarifications: [{ node: 'n3-proto', question: '请补充' }],
    })
    assert.equal(view.bucket, 'needs_you')
    assert.equal(view.statusLabel, '澄清')

    const completedWithHitl = daemonRunRecordView({
      slug: 'stale-job',
      state: 'completed',
      pending_clarifications: [{ node: 'n3-proto' }],
    })
    assert.equal(completedWithHitl.bucket, 'needs_you')
  })

  it('exposes outcome-oriented presentation for known path ids', () => {
    const presentation = daemonPathPresentation({
      id: 'doc-to-impl-plan',
      name: '文档到实施计划',
      summary: 'fallback',
    })
    assert.match(presentation.outcome, /实施计划/)
    assert.ok(presentation.stages.length >= 3)
  })

  it('hides technical catalog prose from surface outcome', () => {
    const presentation = daemonPathPresentation({
      id: 'feature-code-backend',
      name: '特性编码 (轻量后端)',
      summary: '需求澄清 -> Gate -> 后端 Plan。选型：写代码时选此流程',
    })
    assert.equal(presentation.outcome, '')
    assert.ok(presentation.stages.length >= 3)
  })

  it('builds task cards with relative time and tone', () => {
    const now = Date.parse('2026-08-12T00:00:00.000Z')
    const card = daemonTaskCardView({
      slug: 'rdpi-uat-producer-1',
      intent: '制作人验收冒烟',
      workflow: 'team-run',
      state: 'failed',
      updatedAt: '2026-07-31T00:00:00.000Z',
    }, [{ id: 'team-run', name: 'team-run' }], { now })
    assert.equal(card.tone, 'failed')
    assert.match(card.cardTitle, /制作人验收冒烟/)
    assert.equal(card.slug, 'rdpi-uat-producer-1')
    assert.match(card.relativeTime, /天前/)
  })

  it('compacts label + URL intent into a skim card title', () => {
    const intent = '需求文档：\nhttps://forever9.feishu.cn/wiki/DB8YwCuKtiRlXxx'
    const title = compactDaemonCardTitle(intent, { pathName: 'daemon-stage-impl', slug: 'rdpi-ff-zero-gift' })
    assert.equal(title, '需求文档')
    assert.doesNotMatch(title, /feishu|https?:\/\//i)

    const summary = compactDaemonCardSummary(intent, title)
    assert.match(summary, /forever9\.feishu\.cn/)
    assert.doesNotMatch(summary, /https?:\/\//)
    assert.notEqual(summary, title)

    const oneLineTitle = compactDaemonCardTitle(
      '需求文档：https://forever9.feishu.cn/wiki/DB8YwCuKtiRlXxx',
      { pathName: 'daemon-stage-impl', slug: 'rdpi-ff-zero-gift' },
    )
    assert.equal(oneLineTitle, '需求文档')

    const card = daemonTaskCardView({
      slug: 'rdpi-ff-zero-gift',
      intent,
      workflow: 'daemon-stage-impl',
      state: 'failed',
      updatedAt: '2026-07-15T00:00:00.000Z',
    }, [{ id: 'daemon-stage-impl', name: 'daemon-stage-impl' }], {
      now: Date.parse('2026-08-12T00:00:00.000Z'),
    })
    assert.equal(card.cardTitle, '需求文档')
    assert.match(card.cardSummary, /forever9\.feishu\.cn/)
    assert.match(card.cardMeta, /rdpi-ff-zero-gift/)
    assert.match(card.cardMeta, /daemon-stage-impl/)
    assert.match(card.intentTitle, /forever9\.feishu\.cn/)
  })

  it('searches daemon run records by intent or slug', () => {
    const records = [
      { title: '制作人验收', slug: 'rdpi-a', pathName: 'team-run' },
      { title: '前端实现', slug: 'rdpi-b', pathName: 'feature' },
    ]
    assert.equal(searchDaemonRunRecords(records, '制作人').length, 1)
    assert.equal(searchDaemonRunRecords(records, 'rdpi-b')[0].slug, 'rdpi-b')
  })

  it('enforces min intent or material gate', () => {
    const short = formMeetsMinMaterialGate({ intent: '太短了' })
    assert.equal(short.ok, false)
    const long = formMeetsMinMaterialGate({ intent: '这是一条足够长的业务目标描述用于通过门槛' })
    assert.equal(long.ok, true)
    const file = formMeetsMinMaterialGate({ intent: '', materials: [{ path: 'D:/a/PRD.md' }] })
    assert.equal(file.ok, true)
  })

  it('resolves ingest requirements with soft fallback and hard connection/path', () => {
    const reqs = resolveIngestRequirements({ id: 'doc-to-impl-plan', name: '文档到实施计划' }, null)
    assert.ok(reqs.some(item => item.id === 'connection' && item.hard))
    assert.ok(reqs.some(item => item.id === 'prd' && !item.hard))

    const hardSchema = resolveIngestRequirements(
      { id: 'x', catalog: { requiredInputs: [{ id: 'prd', label: '需求文档', hard: true }] } },
      null,
    )
    const evalBlocked = evaluateIngest(
      { intent: '这是一条足够长的业务目标描述用于通过门槛' },
      hardSchema,
      { daemon: { online: true }, workflow: { id: 'x', name: 'x' } },
    )
    assert.equal(evalBlocked.canSubmit, false)
    assert.ok(evalBlocked.hardBlockers.some(item => item.id === 'prd'))

    const soft = evaluateIngest(
      { intent: '这是一条足够长的业务目标描述用于通过门槛' },
      resolveIngestRequirements({ id: 'feature-code', name: '特性编码' }, null),
      { daemon: { online: true }, workflow: { id: 'feature-code', name: '特性编码' } },
    )
    assert.equal(soft.canSubmit, true)
  })

  it('hard-blocks compose when CLI executor preflight fails', () => {
    const { assessComposePreflight, evaluateIngest, resolveIngestRequirements } = require('../src/lib/workbench-daemon-surface')
    const workflow = { id: 'doc-to-plan', name: '文档到实施计划', tags: ['mvp'] }
    const preflight = assessComposePreflight({
      online: true,
      cursorApiKeyReady: false,
      executorReady: true,
    }, workflow)
    assert.equal(preflight.ok, false)
    assert.equal(preflight.code, 'cursor_api_key')

    const evaluation = evaluateIngest(
      { intent: '把需求文档整理成可执行实施计划并附验收标准' },
      resolveIngestRequirements(workflow, null),
      {
        daemon: { online: true, cursorApiKeyReady: false, executorReady: true },
        workflow,
        preflight,
      },
    )
    assert.equal(evaluation.canSubmit, false)
    assert.ok(evaluation.hardBlockers.some(item => item.id === 'executor'))
  })

  it('packs launch context from form intent and materials', () => {
    const packed = buildDaemonLaunchContextFromForm({
      intent: '把需求文档整理成可执行实施计划并附验收标准',
      materials: [{ path: 'D:/ws/docs/PRD.md' }, { path: 'D:/ws/ui/home.png' }],
    })
    assert.equal(packed.inputs.prd, 'D:/ws/docs/PRD.md')
    assert.ok(packed.inputs.resources.includes('D:/ws/ui/home.png'))
  })

  it('formats Daemon purpose title with stage prefix and compact fallback', () => {
    const intent = [
      '需求文档：',
      'https://example.feishu.cn/docx/ABCDEFG1234567890',
      '把登录鉴权改成 JWT 并补齐刷新令牌。',
    ].join('\n')
    const local = resolveDaemonPurposeTitleLocal(intent, { workflowName: '自动编码' })
    assert.ok(local)
    assert.ok(!/https?:\/\//i.test(local))
    assert.ok(local.length <= 24)
    const titled = formatDaemonPurposeTitle(local, { intent, workflowName: '自动编码' })
    assert.match(titled, new RegExp(`^${DAEMON_PURPOSE_PREFIX}`))
    assert.ok(!titled.includes('https://'))
    const empty = formatDaemonPurposeTitle('', { intent: '', workflowName: '自动编码' })
    assert.equal(empty, `${DAEMON_PURPOSE_PREFIX} 自动编码`)
  })
})
