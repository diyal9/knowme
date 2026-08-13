'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const ui = require('../src/lib/skill-task-ui')

describe('skill-task-ui catalog fallback & precedence', () => {
  const legacyPresets = {
    general: [
      { id: 'meetingSummary', title: 'Legacy 会议', subtitle: 'legacy sub' },
      { id: 'todayPriority', title: 'Legacy 优先级', subtitle: 'legacy top3' },
    ],
  }

  it('dynamic task overrides legacy empty card with same id', () => {
    const map = ui.buildTaskMap([{
      id: 'meetingSummary',
      title: 'Dynamic 会议',
      subtitle: 'dynamic sub',
      modes: ['general'],
      surfaces: ['empty'],
      prompt: 'dynamic prompt',
      skillId: 'feishu-meeting-summary',
    }])
    const cards = ui.resolveEmptyStateCards('general', legacyPresets, map)
    assert.equal(cards.length, 2)
    assert.equal(cards[0].title, 'Dynamic 会议')
    assert.equal(cards[0].dynamic, true)
    assert.equal(cards[1].title, 'Legacy 优先级')
    assert.equal(cards[1].dynamic, false)
  })

  it('falls back to legacy presets when task map is empty', () => {
    const cards = ui.resolveEmptyStateCards('general', legacyPresets, new Map())
    assert.equal(cards.length, 2)
    assert.equal(cards[0].dynamic, false)
    assert.equal(cards[0].title, 'Legacy 会议')
  })

  it('pack empty cards prefer dynamic task over legacy scene', () => {
    const map = ui.buildTaskMap([{
      id: 'relatedChats',
      title: 'Dynamic 聊天',
      subtitle: 'dynamic @me',
      modes: ['general'],
      surfaces: ['empty'],
      prompt: 'analyze chats',
      ownerPackId: 'game-studio',
      skillId: 'feishu-related-chats',
    }])
    const cards = ui.resolvePackEmptyCards({
      packId: 'game-studio',
      scenes: [{ id: 'feishu-chats', title: 'Legacy 聊天', subtitle: 'legacy', prompt: 'legacy prompt' }],
    }, map)
    assert.equal(cards.length, 1)
    assert.equal(cards[0].dynamic, true)
    assert.equal(cards[0].title, 'Dynamic 聊天')
    assert.equal(cards[0].id, 'relatedChats')
  })

  it('appends Pack-owned general empty tasks without legacy scenes', () => {
    const map = ui.buildTaskMap([{
      id: 'todayPriority',
      title: '今日优先级',
      subtitle: '任务、日程与待回应',
      modes: ['general'],
      surfaces: ['empty', 'quick-menu'],
      prompt: 'analyze today',
      ownerPackId: 'game-studio',
      skillId: 'feishu-today-priority',
    }])

    const cards = ui.resolvePackEmptyCards({
      packId: 'game-studio',
      scenes: [{ id: 'feishu-chats', title: 'Legacy 聊天', prompt: 'legacy prompt' }],
    }, map)

    assert.equal(cards.length, 2)
    assert.equal(cards[1].id, 'todayPriority')
    assert.equal(cards[1].dynamic, true)
    assert.equal(cards[1].task.skillId, 'feishu-today-priority')
  })

  it('pack-owned writing task overrides writing legacy preset', () => {
    const writingPresets = {
      writing: [{
        id: 'writingOfficeDoc',
        title: 'Legacy 办公文档',
        subtitle: 'legacy writing',
        prompt: 'legacy prompt',
      }],
    }
    const map = ui.buildTaskMap([{
      id: 'writingOfficeDoc',
      title: 'Skill 办公文档',
      subtitle: 'skill writing',
      modes: ['writing'],
      surfaces: ['empty', 'quick-menu'],
      prompt: 'skill prompt',
      ownerPackId: 'game-studio',
      skillId: 'office-document',
    }])

    const cards = ui.resolveEmptyStateCards('writing', writingPresets, map)

    assert.equal(cards.length, 1)
    assert.equal(cards[0].title, 'Skill 办公文档')
    assert.equal(cards[0].dynamic, true)
    assert.equal(cards[0].task.skillId, 'office-document')
  })

  it('quick menu merges dynamic tasks by group and overrides same id', () => {
    const profiles = {
      general: [{
        key: 'office-core',
        label: '办公核心',
        icon: 'optimize',
        items: [
          { label: '会议总结', icon: 'check', prompt: 'legacy meeting prompt' },
          { label: '今日优先级', icon: 'list', prompt: 'legacy priority prompt' },
        ],
      }],
    }
    const promptToTask = new Map([
      ['legacy meeting prompt', 'meetingSummary'],
      ['legacy priority prompt', 'todayPriority'],
    ])
    const map = ui.buildTaskMap([{
      id: 'meetingSummary',
      title: 'Dynamic 会议总结',
      modes: ['general'],
      surfaces: ['quick-menu'],
      group: 'office-core',
      prompt: 'dynamic meeting',
      icon: 'check',
      skillId: 'feishu-meeting-summary',
    }])
    const sections = ui.mergeQuickMenuSections('general', profiles, map, promptToTask)
    assert.equal(sections[0].items.length, 2)
    assert.equal(sections[0].items[0].label, 'Dynamic 会议总结')
    assert.equal(sections[0].items[0].taskId, 'meetingSummary')
    assert.equal(sections[0].items[0].dynamic, true)
    assert.equal(sections[0].items[1].label, '今日优先级')
  })

  it('quick menu keeps steward entries untouched', () => {
    const profiles = {
      steward: [{
        key: 'knowledge-maintain',
        label: '知识维护',
        icon: 'bookOpen',
        items: [{ label: '整理本地 Wiki', icon: 'folder', steward: 'ingest' }],
      }],
    }
    const sections = ui.mergeQuickMenuSections('steward', profiles, new Map(), new Map())
    assert.equal(sections[0].items[0].steward, 'ingest')
  })

  it('caps Pack home recommendations and separates workflow intake', () => {
    const result = ui.partitionPackHomeCards([
      { id: 'docKbSuggest', title: '查文档' },
      { id: 'meetingSummary', title: '会议总结' },
      { id: 'relatedChats', title: '相关聊天' },
      { id: 'workflow-intake', sceneId: 'workflow-intake', title: '需求梳理' },
      { id: 'todayPriority', title: '今日优先级' },
      { id: 'extraSkill', title: '额外技能' },
    ], 4)

    assert.deepEqual(result.recommendations.map(card => card.id), [
      'docKbSuggest',
      'meetingSummary',
      'relatedChats',
      'todayPriority',
    ])
    assert.equal(result.workflow.id, 'workflow-intake')
    assert.deepEqual(result.overflow.map(card => card.id), ['extraSkill'])
  })

  it('flattens and filters quick commands by title, description and group', () => {
    const commands = ui.flattenQuickMenuSections([
      {
        key: 'office-core',
        label: '办公核心',
        items: [{ label: '会议总结', subtitle: '最近三天的会议', prompt: 'meeting' }],
      },
      {
        key: 'knowledge',
        label: '文档与沟通',
        items: [{ label: '查文档/知识库', description: '最近编辑与阅读', prompt: 'docs' }],
      },
    ])

    assert.equal(commands.length, 2)
    assert.equal(commands[0].groupLabel, '办公核心')
    assert.deepEqual(ui.filterQuickCommands(commands, '会议 最近').map(item => item.label), ['会议总结'])
    assert.deepEqual(ui.filterQuickCommands(commands, '文档与沟通').map(item => item.label), ['查文档/知识库'])
    assert.equal(ui.filterQuickCommands(commands, '不存在').length, 0)
  })

  it('keeps unmatched dynamic quick tasks in a more-skills section', () => {
    const map = ui.buildTaskMap([{
      id: 'workflowIntake',
      title: '需求梳理',
      subtitle: '启动工作流',
      modes: ['general'],
      surfaces: ['quick-menu'],
      group: 'workflow',
      prompt: 'intake',
    }])
    const sections = ui.mergeQuickMenuSections('general', {
      general: [{ key: 'office-core', label: '办公核心', items: [] }],
    }, map, new Map())

    assert.equal(sections.at(-1).key, 'more-skills')
    assert.equal(sections.at(-1).items[0].taskId, 'workflowIntake')
  })
})

describe('skill-task-ui preflight & activation', () => {
  it('maps connector-auth preflight to legacy feishu spec', () => {
    const spec = ui.preflightToLegacySpec({
      type: 'connector-auth',
      connector: 'feishu',
      message: '请先授权飞书',
    })
    assert.equal(spec.need, 'feishuAuth')
    assert.equal(spec.ask, '请先授权飞书')
  })

  it('maps material preflight', () => {
    const spec = ui.preflightToLegacySpec({
      type: 'material',
      message: '请粘贴材料',
    })
    assert.equal(spec.need, 'material')
    assert.equal(spec.ask, '请粘贴材料')
  })

  it('blocks dynamic activation when requiredTools present but skillId missing', () => {
    assert.equal(ui.canActivateDynamicTask({
      prompt: 'do thing',
      requiredTools: ['feishu.related_chats'],
    }), false)
    assert.equal(ui.canActivateDynamicTask({
      prompt: 'do thing',
      requiredTools: ['feishu.related_chats'],
      skillId: 'feishu-related-chats',
    }), true)
  })
})

describe('skill-task-ui bounded days & skill refs', () => {
  const fixedNow = new Date(2026, 7, 6, 15, 30, 0)

  it('expands days template var with bounded 1..30 range', () => {
    const out = ui.expandBoundedDateVars('请分析聊天', { days: 3 }, fixedNow)
    assert.match(out, /近 3 天/)
    assert.match(out, /2026-08-04/)
    assert.match(out, /2026-08-06/)
    assert.doesNotMatch(out, /\$\{/)
  })

  it('clamps days above 30', () => {
    const out = ui.expandBoundedDateVars('task', { days: 99 }, fixedNow)
    assert.match(out, /近 30 天/)
  })

  it('buildDynamicTaskPrompt uses task prompt without legacy enrichOfficeShortcut', () => {
    const out = ui.buildDynamicTaskPrompt({
      prompt: '短任务 prompt',
      templateVars: { days: 1 },
    }, fixedNow)
    assert.ok(out.startsWith('短任务 prompt'))
    assert.match(out, /近 1 天/)
    assert.doesNotMatch(out, /feishu\.meeting_candidates/)
  })

  it('mergeSkillRefs dedupes explicit refs and slash refs from prompt', () => {
    const refs = ui.mergeSkillRefs(['Feishu-Related-Chats', 'feishu-doc-kb'], '继续 /feishu-related-chats 分析')
    assert.deepEqual(refs, ['feishu-related-chats', 'feishu-doc-kb'])
  })

  it('display prompt path does not require slash in user-visible label', () => {
    const agent = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace-agent.js'), 'utf8')
    assert.ok(agent.includes('displayPrompt'), 'runAI uses displayPrompt for user bubble')
    assert.ok(agent.includes('skillRefs'), 'explicit skillRefs passed to main')
    assert.ok(agent.includes('runDynamicTask'), 'dynamic tasks bypass enrichOfficeShortcutPrompt')
    assert.ok(agent.includes('taskId: task.id'), 'dynamic task identity is forwarded separately')
    assert.ok(agent.includes('taskId: explicitTaskId'), 'task identity reaches main IPC payload')
  })
})

describe('skill-task-ui workspace wiring', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace.html'), 'utf8')
  const agent = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace-agent.js'), 'utf8')

  it('loads skill-task-ui script before workspace-agent', () => {
    const uiIdx = html.indexOf('lib/skill-task-ui.js')
    const agentIdx = html.indexOf('workspace-agent.js')
    assert.ok(uiIdx >= 0 && agentIdx > uiIdx)
  })

  it('refreshSkillTaskCatalog uses knowme.skill.tasks or api.skillTaskList', () => {
    assert.ok(agent.includes('refreshSkillTaskCatalog'))
    assert.ok(agent.includes('knowme?.skill?.tasks') || agent.includes('window.knowme?.skill?.tasks'))
    assert.ok(agent.includes('skillTaskList'))
  })

  it('renders Pack empty groups only for general sessions', () => {
    assert.match(agent, /activeSession\?\.agentId === 'general'[\s\S]{0,100}renderPackEmptyStateHtml/)
  })
})
