'use strict'

const { describe, it, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const os = require('os')

const agentTools = require('../src/lib/agent-tools')
const { buildSkillTools, validateSkillToolCall } = require('../src/lib/agent-skill-tools')

const TMP = path.join(os.tmpdir(), `knowme-agent-skill-tools-${Date.now()}`)

function writeSkill(root, id, body = '# Skill body') {
  const dir = path.join(root, 'skills', id)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(
    path.join(dir, 'SKILL.md'),
    `---\nname: ${id}\ndescription: ${id} description\n---\n\n${body}\n`,
    'utf8',
  )
  return dir
}

describe('agent-skill-tools', () => {
  const capabilitiesRoot = path.join(TMP, 'capabilities')

  beforeEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true })
    fs.mkdirSync(capabilitiesRoot, { recursive: true })
    writeSkill(capabilitiesRoot, 'demo', 'Demo instructions here.')
  })

  afterEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true })
  })

  it('exports four OpenAI function tool definitions', () => {
    const { definitions } = buildSkillTools({ capabilitiesRoot })
    assert.equal(definitions.length, 4)
    const names = definitions.map((d) => d.function.name)
    assert.deepEqual(names, [
      'list_skills',
      'load_skill',
      'read_skill_resource',
      'run_skill_script',
    ])
    assert.equal(definitions[0].type, 'function')
    assert.deepEqual(definitions[1].function.parameters.required, ['skill_id'])
  })

  it('validateSkillToolCall rejects unknown and invalid args', () => {
    const unknown = validateSkillToolCall('load_skills', '{}')
    assert.equal(unknown.ok, false)
    assert.equal(unknown.code, 'unknown_tool')

    const missing = validateSkillToolCall('load_skill', '{}')
    assert.equal(missing.ok, false)
    assert.equal(missing.code, 'invalid_args')

    const ok = validateSkillToolCall('load_skill', '{"skill_id":"demo"}')
    assert.equal(ok.ok, true)
    assert.equal(ok.args.skill_id, 'demo')
  })

  it('handlers execute through skill runtime', async () => {
    const skillDir = writeSkill(capabilitiesRoot, 'res')
    fs.mkdirSync(path.join(skillDir, 'references'), { recursive: true })
    fs.writeFileSync(path.join(skillDir, 'references', 'note.md'), 'ref text', 'utf8')
    fs.mkdirSync(path.join(skillDir, 'scripts'), { recursive: true })
    fs.writeFileSync(path.join(skillDir, 'scripts', 'run.js'), 'ok', 'utf8')

    const { handlers } = buildSkillTools({
      capabilitiesRoot,
      runScript: async () => ({ ok: true, text: 'script ok' }),
    })

    const listed = await handlers.list_skills({})
    assert.equal(listed.ok, true)
    assert.ok(listed.text.includes('demo'))

    const loaded = await handlers.load_skill({ skill_id: 'demo' })
    assert.equal(loaded.ok, true)
    assert.ok(loaded.text.includes('Demo instructions'))

    const resource = await handlers.read_skill_resource({
      skill_id: 'res',
      path: 'references/note.md',
    })
    assert.equal(resource.ok, true)
    assert.equal(resource.text, 'ref text')

    const script = await handlers.run_skill_script({
      skill_id: 'res',
      script: 'scripts/run.js',
      permissions: { write: true },
    })
    assert.equal(script.ok, true)
    assert.equal(script.text, 'script ok')
  })

  it('registers with agent tool surface allowlist', () => {
    const skillTools = buildSkillTools({ capabilitiesRoot })
    const surface = agentTools.createToolSurface({
      extraDefinitions: skillTools.definitions,
      handlers: skillTools.handlers,
    })
    assert.equal(surface.isAllowedTool('list_skills'), true)
    assert.equal(surface.isAllowedTool('load_skill'), true)
    const validation = surface.validateToolCall('load_skill', '{"skill_id":"demo"}')
    assert.equal(validation.ok, true)
  })
})
