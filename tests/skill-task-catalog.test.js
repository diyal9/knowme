'use strict'
const { readPreload } = require('./helpers/current-src')

const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const os = require('os')
const {
  mergeSkillTaskCatalog,
  assertDisplaySafeTask,
  UNSAFE_DTO_KEYS,
  sceneToLegacyTaskId,
} = require('../src/lib/skill-task-catalog')
const { createCapabilityHubService } = require('../src/lib/capability-hub-service')
const { createCapabilityPackRuntime } = require('../src/lib/capability-pack-runtime')
const { createSkillRuntime } = require('../src/lib/skill-runtime')
const { SIDECAR_FILE } = require('../src/lib/capability-manifest-v2')

describe('skill-task-catalog merge', () => {
  it('prefers dynamic tasks over legacy scene fallback with same id', () => {
    const merged = mergeSkillTaskCatalog({
      skillTasksResult: {
        tasks: [{
          id: 'relatedChats',
          title: 'Dynamic 相关聊天',
          modes: ['general'],
          surfaces: ['empty', 'quick-menu'],
          prompt: 'dynamic prompt',
          skillId: 'feishu-related-chats',
          source: 'pack',
          ownerPackId: 'game-studio',
        }],
        issues: [],
        revision: 'abc',
      },
      emptyStateGroups: [{
        packId: 'game-studio',
        scenes: [{
          id: 'feishu-chats',
          title: 'Legacy 相关聊天',
          subtitle: 'legacy subtitle',
          prompt: 'legacy prompt',
        }],
      }],
    })

    assert.equal(merged.tasks.length, 1)
    assert.equal(merged.tasks[0].title, 'Dynamic 相关聊天')
    assert.equal(merged.tasks[0].prompt, 'dynamic prompt')
    assert.equal(merged.tasks[0].legacy, undefined)
  })

  it('generates legacy fallback DTO for scenes without dynamic task', () => {
    const merged = mergeSkillTaskCatalog({
      skillTasksResult: { tasks: [], issues: [], revision: 'empty' },
      emptyStateGroups: [{
        packId: 'game-studio',
        scenes: [{
          id: 'feishu-meeting',
          title: '会议总结',
          subtitle: '最近会议候选',
          prompt: '请为我做会议总结',
        }],
      }],
      packScenes: [{
        packId: 'game-studio',
        id: 'feishu-meeting',
        label: '会议总结',
        description: '最近会议候选',
        connectors: ['feishu'],
        legacyModes: [],
        emptyPrompt: '请为我做会议总结',
      }],
    })

    assert.equal(merged.tasks.length, 1)
    assert.equal(merged.tasks[0].id, 'meetingSummary')
    assert.equal(merged.tasks[0].title, '会议总结')
    assert.equal(merged.tasks[0].source, 'pack')
    assert.equal(merged.tasks[0].ownerPackId, 'game-studio')
    assert.equal(merged.tasks[0].legacy, true)
    assert.equal(merged.tasks[0].preflight?.type, 'connector-auth')
    assert.equal(merged.tasks[0].preflight?.connector, 'feishu')
  })

  it('legacy fallback DTO excludes dir/path/body/script fields', () => {
    const merged = mergeSkillTaskCatalog({
      skillTasksResult: { tasks: [], issues: [], revision: 'x' },
      emptyStateGroups: [{
        packId: 'example-minimal',
        scenes: [{ id: 'demo-scene', title: 'Demo', prompt: 'do demo' }],
      }],
    })
    for (const task of merged.tasks) {
      for (const key of UNSAFE_DTO_KEYS) {
        assert.ok(!(key in task), `unexpected unsafe key ${key}`)
      }
      assert.doesNotThrow(() => assertDisplaySafeTask(task))
    }
  })

  it('maps feishu-chats scene id to relatedChats task id', () => {
    assert.equal(sceneToLegacyTaskId('feishu-chats'), 'relatedChats')
    assert.equal(sceneToLegacyTaskId('custom-scene'), 'custom-scene')
  })

  it('disabled pack scenes are omitted when emptyStateGroups is empty', () => {
    const merged = mergeSkillTaskCatalog({
      skillTasksResult: { tasks: [], issues: [], revision: 'x' },
      emptyStateGroups: [],
    })
    assert.equal(merged.tasks.length, 0)
  })
})

describe('skill-task hub + ipc contract', () => {
  const root = path.join(__dirname, '..')
  const preload = readPreload()
  const hubService = fs.readFileSync(path.join(root, 'src', 'lib', 'capability-hub-service.ts'), 'utf8')

  it('preload exposes skillTaskList and knowme.skill.tasks', () => {
    assert.ok(preload.includes("ipcRenderer.invoke('skill-task-list')"), 'window.api.skillTaskList')
    assert.ok(preload.includes("capInvoke('skill-task-list')"), 'knowme.skill.tasks')
    assert.ok(preload.includes('skillTaskList:'), 'flat api alias')
  })

  it('hub registers skill-task-list IPC channel', () => {
    assert.ok(hubService.includes("'skill-task-list'"))
    assert.ok(hubService.includes('listSkillTasks'))
  })

  it('hub listSkillTasks merges runtime tasks with pack legacy scenes', async () => {
    const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-skill-task-hub-'))
    const capabilitiesRoot = path.join(userData, 'capabilities')
    fs.mkdirSync(path.join(capabilitiesRoot, 'skills'), { recursive: true })

    const packRt = createCapabilityPackRuntime({
      userData,
      trustedCatalogRoot: path.join(root, 'src', 'catalog'),
      getOccupiedSkillIds: () => [],
    })
    packRt.installPack('game-studio', 'bundled')
    packRt.installPack('office-partner', 'bundled')

    const hub = createCapabilityHubService({
      getUserData: () => userData,
      getKnowledgeDir: () => path.join(userData, 'knowledge'),
      getConnectorsApi: () => null,
      bundledRoot: path.join(root, 'src', 'catalog'),
      getPackSkillSources: () => packRt.listSkillSources(),
      getPackEmptyStateGroups: () => packRt.listEmptyStateGroups(),
      getPackScenesForUi: () => packRt.listScenesForUi(),
    })

    const catalog = await hub.listSkillTasks()
    assert.ok(Array.isArray(catalog.tasks))
    assert.ok(catalog.revision)
    assert.ok(catalog.tasks.some((task) => task.id === 'relatedChats' || task.id === 'meetingSummary'))

    for (const task of catalog.tasks) {
      for (const key of UNSAFE_DTO_KEYS) assert.ok(!(key in task))
    }

    fs.rmSync(userData, { recursive: true, force: true })
  })

  it('hub listCapabilities merges pack-owned skills without duplicate ids', async () => {
    const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-skill-hub-pack-'))
    const packRt = createCapabilityPackRuntime({
      userData,
      trustedCatalogRoot: path.join(root, 'src', 'catalog'),
      getOccupiedSkillIds: () => [],
    })
    packRt.installPack('game-studio', 'bundled')
    const packSources = packRt.listSkillSources()

    const hub = createCapabilityHubService({
      getUserData: () => userData,
      getKnowledgeDir: () => path.join(userData, 'knowledge'),
      getConnectorsApi: () => null,
      bundledRoot: path.join(root, 'src', 'catalog'),
      getPackSkillSources: () => packSources,
      getPackEmptyStateGroups: () => packRt.listEmptyStateGroups(),
      getPackScenesForUi: () => packRt.listScenesForUi(),
    })

    const listed = await hub.listCapabilities({ kind: 'skill' })
    const ids = listed.items.map((item) => item.id)
    assert.equal(new Set(ids).size, ids.length, 'duplicate hub skill ids')

    const owned = listed.items.filter((item) => item.packOwned || item.source === 'pack')
    assert.ok(owned.length >= 1)
    for (const item of owned) {
      assert.ok(item.ownerPackId)
      assert.ok(item.provenance)
      assert.equal(item.uninstallBlocked, true)
    }

    const blocked = await hub.uninstallCapability({ id: owned[0].id })
    assert.equal(blocked.code, 'pack_owned_skill')

    fs.rmSync(userData, { recursive: true, force: true })
  })

  it('disabled pack hides pack skill tasks from merged catalog', async () => {
    const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-skill-task-disabled-'))
    const capabilitiesRoot = path.join(userData, 'capabilities')
    const skillDir = path.join(capabilitiesRoot, 'skills', 'task-skill')
    fs.mkdirSync(skillDir, { recursive: true })
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '---\nname: Task Skill\ndescription: task\n---\n', 'utf8')
    fs.writeFileSync(path.join(skillDir, SIDECAR_FILE), JSON.stringify({
      schemaVersion: 2,
      id: 'task-skill',
      kind: 'skill',
      name: 'Task Skill',
      version: '1.0.0',
      metadata: {
        knowme: {
          experience: {
            tasks: [{
              id: 'taskOnly',
              title: 'Only Dynamic',
              modes: ['general'],
              surfaces: ['empty'],
              prompt: 'run task',
            }],
          },
        },
      },
    }, null, 2), 'utf8')

    const runtime = createSkillRuntime({
      capabilitiesRoot,
      knowledgeDir: path.join(userData, 'knowledge'),
      getInstallStore: () => ({ skills: {} }),
      getPackSkillSources: () => ({ sources: [], issues: [] }),
    })
    const enabled = runtime.listSkillTasks()
    assert.ok(enabled.tasks.some((task) => task.id === 'taskOnly'))

    const disabled = createSkillRuntime({
      capabilitiesRoot,
      knowledgeDir: path.join(userData, 'knowledge'),
      getInstallStore: () => ({ skills: { 'task-skill': { enabled: false } } }),
      getPackSkillSources: () => ({ sources: [], issues: [] }),
    }).listSkillTasks()
    assert.equal(disabled.tasks.length, 0)

    fs.rmSync(userData, { recursive: true, force: true })
  })
})
