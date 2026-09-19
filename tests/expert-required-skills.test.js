const { it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { createStore } = require('../src/lib/workbench-task-store')
const { createExpertTaskRuntime } = require('../src/lib/expert-task-runtime')
const { createSkillRuntime } = require('../src/lib/skill-runtime')
const { assembleCapabilityContext } = require('../src/lib/agent-context-assembly')
const executionProfile = require('../src/lib/expert-execution-profile')
const agentRun = require('../src/lib/agent-run')

const methodIds = ['business-metrics-analysis', 'business-cause-analysis', 'business-insight-report']
const catalogRoot = path.join(__dirname, '../src/catalog')

it('fact checking remains a read-only route of the retained research analyst', () => {
  const { parseExpertFrontmatter } = require('../src/lib/expert-runtime')
  const dir = path.join(catalogRoot, 'experts/research-analyst')
  const canonical = JSON.parse(fs.readFileSync(path.join(dir, 'capability.manifest.json'), 'utf8'))
  const legacy = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'))
  const source = fs.readFileSync(path.join(dir, 'EXPERT.md'), 'utf8')
  const expert = parseExpertFrontmatter(source)
  assert.ok(expert.skills.includes('evidence-verification'))
  assert.deepEqual(legacy.skills, expert.skills)
  assert.ok(canonical.dependencies.some(dep => dep.kind === 'skill' && dep.id === 'evidence-verification'))
  assert.equal(legacy.version, canonical.version)
  assert.equal(source.match(/^version:\s*(\S+)/m)?.[1], canonical.version)
  const route = canonical.metadata.knowme.execution.routes.find(item => item.id === 'provided-fact-check')
  assert.equal(route.skillId, 'evidence-verification')
  assert.equal(executionProfile.declaredDeliverables({ capabilityManifest: canonical }).length, 1)
  assert.deepEqual(route.toolAllowlist, [])
  for (const key of ['write', 'externalWrite']) assert.equal(canonical.permissions[key], false)
  const skills = createSkillRuntime({ capabilitiesRoot: catalogRoot })
  const method = skills.loadSkillL1('evidence-verification')
  assert.equal(method.ok, true)
  assert.equal(method.truncated, false)
  const assembled = assembleCapabilityContext({ session: {}, prompt: '核查给定来源', tier: 'assist',
    slashRefs: ['evidence-verification'], skillRuntime: skills,
    expertRuntime: { getSessionPersona: () => ({ ok: true, persona: { name: expert.name }, bindings: { skills: expert.skills, connectors: [] } }) },
  })
  assert.ok(assembled.skillL1Block.includes(method.body))
})

for (const mode of ['required', 'optional', 'unbound']) it(`passes only declared required methods to real L1 assembly (${mode})`, async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-required-methods-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const store = createStore(path.join(dir, 'tasks.json'))
  const session = { id: 'method-session', expertId: 'generic-expert', messages: [], run: agentRun.createEmptyRun() }
  const bindings = { skills: mode === 'unbound' ? [] : methodIds, connectors: [] }
  const snapshot = { bindings, capabilityManifest: {} }
  const skills = createSkillRuntime({ capabilitiesRoot: catalogRoot })
  const created = store.create({ expertId: 'generic-expert', status: 'starting', goal: '根据给定材料分析',
    execRef: { kind: 'session', id: session.id },
    brief: { goal: '根据给定材料分析', deliverables: [{ id: 'primary', title: '分析结论', type: 'answer',
      requiredSkills: mode === 'optional' ? [] : methodIds }] },
  })
  let generated = 0
  const runtime = createExpertTaskRuntime({
    getWorkbenchTaskStore: () => store,
    loadSettings: () => ({ apiKey: 'fixture', apiEndpoint: 'https://example.test' }),
    normalizeChatEndpoint: value => value,
    ensureCapabilityHub: () => ({ skillRuntime: () => skills,
      expertRuntime: () => ({ readSessionSnapshot: () => snapshot }) }),
    ensureAgentSession: () => ({ session, sessions: [session] }),
    saveAgentSessions: () => {}, agentRun,
    runAgentGenerate: async (_deps, payload) => {
      generated++
      assert.deepEqual(payload.skillRefs, mode === 'optional' ? [] : methodIds)
      const context = assembleCapabilityContext({ session, prompt: payload.prompt, tier: 'assist',
        slashRefs: payload.skillRefs, skillRuntime: skills,
        expertRuntime: { getSessionPersona: () => ({ ok: true, persona: { name: '测试专家' }, bindings }) },
      })
      if (mode === 'required') {
        for (const id of methodIds) {
          const loaded = skills.loadSkillL1(id)
          assert.equal(loaded.ok, true)
          assert.equal(loaded.truncated, false)
          assert.ok(context.skillL1Block.includes(loaded.body), `${id}: full method absent`)
        }
        assert.ok(context.contextBlocks.some(block => block.id === 'skill.explicit-content' && block.explicit))
      } else assert.equal(context.skillL1Block, '')
      return { text: '仅用于验证方法装配接线，不代表专业分析验收。' }
    },
  })
  const result = await runtime.execute(created.task.id)
  assert.equal(generated, mode === 'unbound' ? 0 : 1, JSON.stringify(result.task.attention || result.task.events?.at(-1)))
  assert.equal(result.task.status, mode === 'unbound' ? 'needs_input' : 'review', JSON.stringify(result.task.attention || result.task.events?.at(-1)))
})

it('business insight remains a coherent route of the retained data analyst', () => {
  const capabilityManifest = JSON.parse(fs.readFileSync(path.join(catalogRoot, 'experts/data-analyst/capability.manifest.json'), 'utf8'))
  const snapshot = { capabilityManifest }
  const deliverables = executionProfile.declaredDeliverables(snapshot)
  assert.equal(deliverables.length, 1)
  assert.equal(deliverables[0].type, 'answer')
  const route = capabilityManifest.metadata.knowme.execution.routes.find(item => item.id === 'business-insight')
  assert.deepEqual(route.requiredSkills, methodIds)
  assert.deepEqual(capabilityManifest.permissions.tools.allowlist, ['calculate'])
  assert.equal(capabilityManifest.permissions.network, false)
  assert.equal(capabilityManifest.permissions.write, false)
  assert.equal(capabilityManifest.permissions.externalWrite, false)
})

it('route-required Skills are part of the retained expert install closure', () => {
  const expertIds = [
    'product-manager',
    'image-producer',
    'data-analyst',
    'office-partner',
    'research-analyst',
    'software-engineer',
  ]
  for (const expertId of expertIds) {
    const manifest = JSON.parse(fs.readFileSync(
      path.join(catalogRoot, `experts/${expertId}/capability.manifest.json`),
      'utf8',
    ))
    const dependencies = new Map((manifest.dependencies || [])
      .filter(item => item?.kind === 'skill')
      .map(item => [item.id, item]))
    const routeSkills = new Set((manifest.metadata?.knowme?.execution?.routes || [])
      .flatMap(route => [
        ...(Array.isArray(route.requiredSkills) ? route.requiredSkills : []),
        route.skillId,
      ])
      .filter(skillId => typeof skillId === 'string' && skillId.trim())
      .map(skillId => skillId.trim()))
    for (const skillId of routeSkills) {
      assert.equal(
        dependencies.get(skillId)?.required,
        true,
        `${expertId}: route Skill ${skillId} must be installed with the expert`,
      )
    }
  }
})
