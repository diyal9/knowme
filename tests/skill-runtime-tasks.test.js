'use strict'

const { describe, it, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const os = require('os')
const { createSkillRuntime } = require('../src/lib/skill-runtime')
const { SIDECAR_FILE } = require('../src/lib/capability-manifest-v2')

const TMP = path.join(os.tmpdir(), `knowme-skill-tasks-${Date.now()}`)

function writeSkill(root, id, frontmatter, body = '# Body', sidecar = null) {
  const dir = path.join(root, 'skills', id)
  fs.mkdirSync(dir, { recursive: true })
  const md = `---\n${frontmatter}\n---\n\n${body}\n`
  fs.writeFileSync(path.join(dir, 'SKILL.md'), md, 'utf8')
  if (sidecar) {
    fs.writeFileSync(path.join(dir, SIDECAR_FILE), JSON.stringify(sidecar, null, 2), 'utf8')
  }
  return dir
}

describe('skill-runtime listSkillTasks', () => {
  const capabilitiesRoot = path.join(TMP, 'capabilities')

  beforeEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true })
    fs.mkdirSync(capabilitiesRoot, { recursive: true })
  })

  afterEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true })
  })

  it('returns no tasks for standard skill without experience extension', () => {
    writeSkill(capabilitiesRoot, 'plain', 'name: Plain\ndescription: no sidecar tasks')
    const runtime = createSkillRuntime({ capabilitiesRoot, knowledgeDir: path.join(TMP, 'knowledge') })
    const result = runtime.listSkillTasks()
    assert.equal(result.tasks.length, 0)
    assert.ok(result.revision)
  })

  it('returns display-safe tasks from validated sidecar experience', () => {
    writeSkill(capabilitiesRoot, 'office', 'name: Office\ndescription: office skill', '# Body', {
      schemaVersion: 2,
      id: 'office',
      kind: 'skill',
      name: 'Office',
      version: '1.0.0',
      metadata: {
        knowme: {
          experience: {
            tasks: [{
              id: 'relatedChats',
              title: '相关聊天',
              modes: ['general'],
              surfaces: ['empty'],
              prompt: '分析聊天',
              requiredTools: ['feishu.related_chats'],
            }],
          },
        },
      },
    })
    const runtime = createSkillRuntime({ capabilitiesRoot, knowledgeDir: path.join(TMP, 'knowledge') })
    const result = runtime.listSkillTasks()
    assert.equal(result.tasks.length, 1)
    assert.equal(result.tasks[0].skillId, 'office')
    assert.equal(result.tasks[0].source, 'standard')
    assert.ok(!('dir' in result.tasks[0]))
    const grounding = runtime.loadSkillGroundingContract('office', { taskId: 'relatedChats' })
    assert.equal(grounding.ok, true)
    assert.deepEqual(grounding.contract.requiredTools, ['feishu.related_chats'])
  })

  it('scopes sidecar requiredTools to the activated task identity', () => {
    writeSkill(capabilitiesRoot, 'multi-task', 'name: Multi\ndescription: multi task skill', '# Body', {
      schemaVersion: 2,
      id: 'multi-task',
      kind: 'skill',
      name: 'Multi',
      version: '1.0.0',
      metadata: {
        knowme: {
          experience: {
            tasks: [
              {
                id: 'taskA',
                title: 'Task A',
                modes: ['general'],
                surfaces: ['empty'],
                prompt: 'A',
                requiredTools: ['alpha.read'],
              },
              {
                id: 'taskB',
                title: 'Task B',
                modes: ['general'],
                surfaces: ['empty'],
                prompt: 'B',
                requiredTools: ['beta.read'],
              },
            ],
          },
        },
      },
    })
    const runtime = createSkillRuntime({ capabilitiesRoot, knowledgeDir: path.join(TMP, 'knowledge') })

    assert.deepEqual(
      runtime.loadSkillGroundingContract('multi-task', { taskId: 'taskA' }).contract.requiredTools,
      ['alpha.read'],
    )
    assert.deepEqual(
      runtime.loadSkillGroundingContract('multi-task', { taskId: 'taskB' }).contract.requiredTools,
      ['beta.read'],
    )
    assert.deepEqual(runtime.loadSkillGroundingContract('multi-task').contract.requiredTools, [])
  })

  it('excludes disabled skills and dedupes managed over pack sources', () => {
    const managedDir = writeSkill(capabilitiesRoot, 'dup-task', 'name: Managed\ndescription: managed', '# Body', {
      schemaVersion: 2,
      id: 'dup-task',
      kind: 'skill',
      name: 'Managed',
      version: '1.0.0',
      metadata: {
        knowme: {
          experience: {
            tasks: [{
              id: 'sharedTask',
              title: 'Managed title',
              modes: ['general'],
              surfaces: ['empty'],
              prompt: 'managed prompt',
            }],
          },
        },
      },
    })

    const runtime = createSkillRuntime({
      capabilitiesRoot,
      knowledgeDir: path.join(TMP, 'knowledge'),
      getInstallStore: () => ({ skills: { 'dup-task': { enabled: true } } }),
      getPackSkillSources: () => ({
        sources: [{
          id: 'dup-task',
          source: 'pack',
          dir: managedDir,
          ownerPackId: 'game-studio',
          contentHash: 'packhash',
          capabilityManifest: {
            metadata: {
              knowme: {
                experience: {
                  tasks: [{
                    id: 'sharedTask',
                    title: 'Pack title',
                    modes: ['general'],
                    surfaces: ['empty'],
                    prompt: 'pack prompt',
                  }],
                },
              },
            },
          },
        }],
        issues: [{ code: 'duplicate_skill_id', message: 'dup-task from pack ignored' }],
      }),
    })

    const result = runtime.listSkillTasks()
    assert.equal(result.tasks.length, 1)
    assert.equal(result.tasks[0].title, 'Managed title')
    assert.equal(result.tasks[0].source, 'standard')
    assert.ok(result.issues.some((item) => item.code === 'duplicate_skill_id'))
  })

  it('does not register tasks when requiredTools use invalid identifiers', () => {
    writeSkill(capabilitiesRoot, 'bad-tools', 'name: Bad\ndescription: bad tools', '# Body', {
      schemaVersion: 2,
      id: 'bad-tools',
      kind: 'skill',
      name: 'Bad',
      version: '1.0.0',
      metadata: {
        knowme: {
          experience: {
            tasks: [{
              id: 'badToolTask',
              title: 'Bad tool task',
              modes: ['general'],
              surfaces: ['empty'],
              prompt: 'x',
              requiredTools: ['not a tool!!!'],
            }],
          },
        },
      },
    })
    const runtime = createSkillRuntime({ capabilitiesRoot, knowledgeDir: path.join(TMP, 'knowledge') })
    const result = runtime.listSkillTasks()
    assert.equal(result.tasks.length, 0)
  })

  it('replaces lower-priority duplicate task ids and emits a diagnostic', () => {
    const packRoot = path.join(TMP, 'pack-capabilities')
    const packDir = writeSkill(packRoot, 'a-pack', 'name: Pack\ndescription: pack source')
    const managedSidecar = {
      schemaVersion: 2,
      id: 'z-managed',
      kind: 'skill',
      name: 'Managed',
      version: '1.0.0',
      metadata: {
        knowme: {
          experience: {
            tasks: [{
              id: 'sharedTask',
              title: 'Managed title',
              modes: ['general'],
              surfaces: ['empty'],
              prompt: 'managed prompt',
            }],
          },
        },
      },
    }
    writeSkill(
      capabilitiesRoot,
      'z-managed',
      'name: Managed\ndescription: managed source',
      '# Managed',
      managedSidecar,
    )
    const runtime = createSkillRuntime({
      capabilitiesRoot,
      knowledgeDir: path.join(TMP, 'knowledge'),
      getPackSkillSources: () => ({
        sources: [{
          id: 'a-pack',
          source: 'pack',
          dir: packDir,
          ownerPackId: 'game-studio',
          contentHash: 'packhash',
          capabilityManifest: {
            metadata: {
              knowme: {
                experience: {
                  tasks: [{
                    id: 'sharedTask',
                    title: 'Pack title',
                    modes: ['general'],
                    surfaces: ['empty'],
                    prompt: 'pack prompt',
                  }],
                },
              },
            },
          },
        }],
        issues: [],
      }),
    })

    const result = runtime.listSkillTasks()

    assert.equal(result.tasks.filter(task => task.id === 'sharedTask').length, 1)
    assert.equal(result.tasks.find(task => task.id === 'sharedTask').title, 'Managed title')
    assert.ok(result.issues.some(issue => issue.code === 'duplicate_task_id'))
  })
})
