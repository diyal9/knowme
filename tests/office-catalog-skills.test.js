'use strict'
const { currentPage, readPreload } = require('./helpers/current-src')

const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const { readMainIpcBundle } = require('./helpers/main-ipc-bundle')
const os = require('os')
const {
  validateAndNormalizeManifest,
  SIDECAR_FILE,
} = require('../src/lib/capability-manifest-v2')
const { validateExperienceExtension } = require('../src/lib/skill-experience')
const {
  parseSkillFrontmatter,
  parseSkillGroundingFromContent,
  createSkillRuntime,
} = require('../src/lib/skill-runtime')
const { createCapabilityPackRuntime } = require('../src/lib/capability-pack-runtime')
const { mergeSkillTaskCatalog } = require('../src/lib/skill-task-catalog')

const ROOT = path.join(__dirname, '..')
const CATALOG_SKILLS = path.join(ROOT, 'src', 'catalog', 'skills')

const OFFICE_SKILL_IDS = [
  'feishu-related-chats',
  'feishu-meeting-summary',
  'feishu-today-priority',
  'feishu-doc-kb',
  'office-requirement-doc',
  'office-document',
  'office-outline-draft',
  'office-document-finalize',
]

const EXPECTED_TASKS = {
  relatedChats: {
    skillId: 'feishu-related-chats',
    title: '分析跟我相关的聊天',
    preflightConnector: 'feishu',
    requiredTools: ['feishu.related_chats'],
    templateDays: 1,
    modes: ['general'],
  },
  meetingSummary: {
    skillId: 'feishu-meeting-summary',
    title: '会议总结',
    preflightConnector: 'feishu',
    requiredTools: ['feishu.meeting_candidates', 'feishu.meeting_read'],
    templateDays: 3,
    modes: ['general'],
  },
  todayPriority: {
    skillId: 'feishu-today-priority',
    title: '今日优先级',
    preflightConnector: 'feishu',
    requiredTools: ['feishu.today_priority'],
    templateDays: 1,
    modes: ['general'],
  },
  docKbSuggest: {
    skillId: 'feishu-doc-kb',
    title: '查文档/知识库',
    preflightConnector: 'feishu',
    requiredTools: ['feishu.doc_kb_suggest'],
    templateDays: 30,
    modes: ['general'],
  },
  writingRequirementsDoc: {
    skillId: 'office-requirement-doc',
    title: '写需求文档',
    preflightType: 'material',
    modes: ['writing'],
  },
  writingOfficeDoc: {
    skillId: 'office-document',
    title: '写办公文档',
    preflightType: 'material',
    modes: ['writing'],
  },
  writingOutlineDraft: {
    skillId: 'office-outline-draft',
    title: '按提纲成稿',
    preflightType: 'material',
    modes: ['writing'],
  },
  writingFinalize: {
    skillId: 'office-document-finalize',
    title: '排版定稿',
    preflightType: 'material',
    modes: ['writing'],
  },
}

function readOfficeSkill(id) {
  const dir = path.join(CATALOG_SKILLS, id)
  const skillMd = fs.readFileSync(path.join(dir, 'SKILL.md'), 'utf8')
  const sidecar = JSON.parse(fs.readFileSync(path.join(dir, SIDECAR_FILE), 'utf8'))
  return { dir, skillMd, sidecar }
}

describe('office catalog skills (tasks 5.1–5.3)', () => {
  for (const id of OFFICE_SKILL_IDS) {
    it(`parses standard ${id} SKILL.md + sidecar`, () => {
      const { skillMd, sidecar } = readOfficeSkill(id)
      const fm = parseSkillFrontmatter(skillMd)
      assert.equal(fm.ok, true, `${id} frontmatter`)
      assert.equal(fm.frontmatter.name, id)
      assert.ok(String(fm.frontmatter.description || '').trim())
      assert.ok(String(fm.frontmatter.slash || '').startsWith('/'))
      assert.ok(fm.body.length > 50)

      assert.equal(sidecar.schemaVersion, 2)
      assert.equal(sidecar.kind, 'skill')
      assert.equal(sidecar.version, '1.0.0')
      assert.equal(sidecar.id, id)

      const normalized = validateAndNormalizeManifest(sidecar)
      assert.equal(normalized.ok, true, `${id} manifest: ${JSON.stringify(normalized.issues)}`)
      assert.equal(normalized.warnings?.length || 0, 0, `${id} manifest warnings`)

      const tasks = normalized.manifest.metadata.knowme.experience.tasks
      assert.equal(tasks.length, 1)
      const exp = validateExperienceExtension(
        { tasks: sidecar.metadata.knowme.experience.tasks },
        { skillId: id },
      )
      assert.equal(exp.issues.length, 0, `${id} experience: ${JSON.stringify(exp.issues)}`)
    })
  }

  it('feishu skills declare grounding requiredTools matching host registry', () => {
    const feishuIds = OFFICE_SKILL_IDS.filter((id) => id.startsWith('feishu-'))
    for (const id of feishuIds) {
      const { skillMd } = readOfficeSkill(id)
      const grounding = parseSkillGroundingFromContent(skillMd)
      assert.equal(grounding.ok, true, id)
      assert.ok(grounding.contract.requiredTools.length >= 1)
    }
    const meeting = parseSkillGroundingFromContent(readOfficeSkill('feishu-meeting-summary').skillMd)
    assert.deepEqual(meeting.contract.requiredTools.sort(), ['feishu.meeting_candidates', 'feishu.meeting_read'].sort())
  })

  it('writing skills have no requiredTools in sidecar or frontmatter', () => {
    const writingIds = OFFICE_SKILL_IDS.filter((id) => id.startsWith('office-'))
    for (const id of writingIds) {
      const { skillMd, sidecar } = readOfficeSkill(id)
      const task = sidecar.metadata.knowme.experience.tasks[0]
      assert.ok(!task.requiredTools?.length, `${id} sidecar requiredTools`)
      const grounding = parseSkillGroundingFromContent(skillMd)
      assert.equal(grounding.contract.requiredTools.length, 0, `${id} frontmatter requiredTools`)
    }
  })

  it('experience tasks match legacy titles, preflight and requiredTools', () => {
    for (const [taskId, expected] of Object.entries(EXPECTED_TASKS)) {
      const { sidecar } = readOfficeSkill(expected.skillId)
      const task = sidecar.metadata.knowme.experience.tasks[0]
      assert.equal(task.id, taskId)
      assert.equal(task.title, expected.title)
      assert.deepEqual(task.modes, expected.modes)
      assert.ok(task.surfaces.includes('empty'))
      assert.ok(task.surfaces.includes('quick-menu'))

      if (expected.preflightConnector) {
        assert.equal(task.preflight.type, 'connector-auth')
        assert.equal(task.preflight.connector, expected.preflightConnector)
        assert.match(task.preflight.message, /设置 → 连接器/)
      }
      if (expected.preflightType === 'material') {
        assert.equal(task.preflight.type, 'material')
        assert.ok(task.preflight.message.length > 10)
      }
      if (expected.requiredTools) {
        assert.deepEqual(task.requiredTools, expected.requiredTools)
        assert.deepEqual(sidecar.permissions?.tools?.sort(), expected.requiredTools.sort())
      }
      if (expected.templateDays != null) {
        assert.equal(task.templateVars.days, expected.templateDays)
      }
    }
  })

  it('feishu sidecars require feishu connector dependency', () => {
    for (const id of OFFICE_SKILL_IDS.filter((x) => x.startsWith('feishu-'))) {
      const { sidecar } = readOfficeSkill(id)
      const dep = sidecar.dependencies.find((d) => d.id === 'feishu')
      assert.ok(dep)
      assert.equal(dep.kind, 'connector')
      assert.equal(dep.required, true)
    }
  })
})

describe('office-partner pack skill references (task 5.4)', () => {
  const officePack = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'packs', 'office-partner', 'pack.json'), 'utf8'))
  const officeScenes = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'packs', 'office-partner', 'scenes.json'), 'utf8'))
  const gamePack = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'packs', 'game-studio', 'pack.json'), 'utf8'))
  const gameScenes = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'packs', 'game-studio', 'scenes.json'), 'utf8'))

  it('office-partner pack.json lists office/feishu skills with bundled catalogRoot', () => {
    assert.equal(officePack.skills.length, 10)
    assert.equal(officePack.bundledCapabilities.catalogRoot, '../../catalog')
    for (const id of OFFICE_SKILL_IDS) {
      assert.ok(officePack.skills.includes(id), `missing ${id}`)
    }
    assert.ok(officePack.skills.includes('writing-polish'))
  })

  it('game-studio pack.json lists game skills plus code-review and knowledge-steward', () => {
    assert.equal(gamePack.skills.length, 6)
    assert.ok(gamePack.skills.includes('code-review'))
    assert.ok(gamePack.skills.includes('knowledge-steward'))
  })

  it('office scenes reference migrated skillIds without changing labels', () => {
    const docs = officeScenes.scenes.find((s) => s.id === 'feishu-docs')
    const meeting = officeScenes.scenes.find((s) => s.id === 'feishu-meeting')
    const chats = officeScenes.scenes.find((s) => s.id === 'feishu-chats')
    const priority = officeScenes.scenes.find((s) => s.id === 'feishu-today-priority')

    assert.equal(docs.skillId, 'feishu-doc-kb')
    assert.equal(docs.label, '查文档/知识库')
    assert.equal(meeting.skillId, 'feishu-meeting-summary')
    assert.equal(meeting.label, '会议总结')
    assert.equal(chats.skillId, 'feishu-related-chats')
    assert.equal(chats.label, '相关聊天')
    assert.equal(priority.skillId, 'feishu-today-priority')
    assert.equal(priority.label, '今日优先级')
  })

  it('game scenes keep workflow intake on game-requirement-doc', () => {
    const intake = gameScenes.scenes.find((s) => s.id === 'workflow-intake')
    assert.equal(intake.skillId, 'game-requirement-doc')
    assert.equal(intake.defaultWorkflow, 'game-dev-delivery')
    assert.ok(intake.emptyPrompt.includes('intake'))
  })

  it('pack runtime resolves all office-partner catalog skills', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-office-pack-12-'))
    const rt = createCapabilityPackRuntime({
      userData: tmpDir,
      trustedCatalogRoot: path.join(ROOT, 'src', 'catalog'),
      getOccupiedSkillIds: () => [],
    })
    const installed = rt.installPack('office-partner', 'bundled')
    assert.equal(installed.ok, true, installed.error || installed.code)

    const payload = rt.listSkillSources()
    assert.equal(payload.sources.length, officePack.skills.length)
    for (const id of officePack.skills) {
      assert.ok(payload.sources.some((src) => src.id === id), `missing source ${id}`)
      assert.equal(payload.sources.find((src) => src.id === id).ownerPackId, 'office-partner')
    }

    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('skill runtime emits 8 office dynamic tasks from pack sources', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-office-runtime-tasks-'))
    const packRt = createCapabilityPackRuntime({
      userData: tmpDir,
      trustedCatalogRoot: path.join(ROOT, 'src', 'catalog'),
      getOccupiedSkillIds: () => [],
    })
    packRt.installPack('game-studio', 'bundled')
    packRt.installPack('office-partner', 'bundled')

    const runtime = createSkillRuntime({
      capabilitiesRoot: path.join(tmpDir, 'capabilities'),
      knowledgeDir: path.join(tmpDir, 'knowledge'),
      getInstallStore: () => ({ skills: {} }),
      getPackSkillSources: () => packRt.listSkillSources(),
    })

    const result = runtime.listSkillTasks()
    const officeTaskIds = Object.keys(EXPECTED_TASKS)
    for (const taskId of officeTaskIds) {
      const task = result.tasks.find((t) => t.id === taskId)
      assert.ok(task, `missing dynamic task ${taskId}`)
      assert.equal(task.title, EXPECTED_TASKS[taskId].title)
      assert.equal(task.skillId, EXPECTED_TASKS[taskId].skillId)
      assert.equal(task.source, 'pack')
      assert.equal(task.ownerPackId, 'office-partner')
      assert.equal(task.legacy, undefined)
    }

    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
})

describe('dynamic task priority + host enforcement (task 5.5)', () => {
  it('dynamic tasks override legacy scene fallback for same task id', () => {
    const merged = mergeSkillTaskCatalog({
      skillTasksResult: {
        tasks: [{
          id: 'relatedChats',
          title: '分析跟我相关的聊天',
          subtitle: '今天：私聊/群聊主题与 @我',
          modes: ['general'],
          surfaces: ['empty', 'quick-menu'],
          prompt: '请分析跟我相关的聊天。',
          skillId: 'feishu-related-chats',
          source: 'pack',
          ownerPackId: 'office-partner',
        }],
        issues: [],
        revision: 'dyn',
      },
      emptyStateGroups: [{
        packId: 'game-studio',
        scenes: [{
          id: 'feishu-chats',
          title: '相关聊天',
          subtitle: 'legacy subtitle',
          prompt: 'legacy long prompt from scene',
        }],
      }],
    })
    assert.equal(merged.tasks.length, 1)
    assert.equal(merged.tasks[0].title, '分析跟我相关的聊天')
    assert.equal(merged.tasks[0].prompt, '请分析跟我相关的聊天。')
    assert.notEqual(merged.tasks[0].legacy, true)
  })

  it.skip('host OAuth, Registry and grounding logic remain in main process (static)', () => {
    const main = readMainIpcBundle()
    const agentTools = fs.readFileSync(path.join(ROOT, 'src', 'lib', 'agent-tools.ts'), 'utf8')
    const grounding = fs.readFileSync(path.join(ROOT, 'src', 'lib', 'feishu-grounding.ts'), 'utf8')
    const agent = currentPage('workspace-agent.js')

    assert.ok(main.includes('FEISHU_FACT_TOOLS'))
    assert.ok(main.includes('todayPriorityFactsOnly'))
    assert.ok(agentTools.includes('feishu.related_chats'))
    assert.ok(agentTools.includes('feishu.meeting_candidates'))
    assert.ok(grounding.includes('hasRelatedChats'))
    assert.ok(agent.includes('feishuUserAuthReady'))
    assert.ok(agent.includes('skillRefs'))
    assert.ok(agent.includes('refreshSkillTaskCatalog'))
  })
})
