'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { createCapabilityHubService } = require('../src/lib/capability-hub-service')
const { createStore: createWorkflowStore } = require('../src/lib/workflow-package-store')

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content, 'utf8')
}

function createFixture(root) {
  for (const id of ['core-skill', 'entry-skill', 'unrelated-skill']) {
    write(path.join(root, '.cursor', 'skills', id, 'SKILL.md'), `---\nname: ${id}\ndescription: ${id}\n---\n# ${id}\n`)
  }
  write(path.join(root, '.cursor', 'agents', 'operator', 'AGENT.md'), `---
name: operator
description: Workflow operator
---
# Operator
Run the selected workflow.
`)
  write(path.join(root, '.cursor', 'agents', 'operator', 'agent.manifest.json'), JSON.stringify({
    id: 'operator', version: '1.0.0', skills: { required: ['core-skill'], optional: ['unrelated-skill'] },
  }, null, 2))
  write(path.join(root, '.cursor', 'workflows', 'index.json'), JSON.stringify({
    workflows: [{ id: 'selected-flow', path: 'selected-flow.json', catalog: { visibility: 'primary' } }],
  }, null, 2))
  write(path.join(root, '.cursor', 'workflows', 'selected-flow.json'), JSON.stringify({
    id: 'selected-flow',
    name: 'Selected flow',
    nodes: [
      { id: 'run', type: 'agent', agent: 'operator', next: 'done' },
      { id: 'done', type: 'terminal', status: 'completed' },
    ],
  }, null, 2))
}

describe('capability hub precise workflow import lifecycle', () => {
  it('plans, imports, and verifies only the selected dependency closure', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-hub-plan-repo-'))
    const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-hub-plan-user-'))
    try {
      createFixture(root)
      const workflowStore = createWorkflowStore({ userData })
      const hub = createCapabilityHubService({
        getUserData: () => userData,
        getWorkflowStore: () => workflowStore,
        bundledRoot: path.join(__dirname, '..', 'src', 'catalog'),
      })
      const preview = await hub.scanCursorRepositoryForHub({ path: root })
      assert.equal(preview.ok, true)
      const planned = await hub.planCursorRepositoryForHub({
        previewToken: preview.previewToken,
        workflowIds: ['selected-flow'],
        additionalSkillIds: ['entry-skill'],
        includeOptionalSkills: false,
        includeConnectors: false,
      })
      assert.equal(planned.ok, true)
      assert.deepEqual(planned.plan.skills.map(item => item.id).sort(), ['core-skill', 'entry-skill'])

      const imported = await hub.importCursorRepository({ planToken: planned.planToken, trustConfirmed: true })
      assert.equal(imported.complete, true)
      assert.deepEqual(Object.keys(imported.idMaps.skills).sort(), ['core-skill', 'entry-skill'])
      assert.deepEqual(Object.keys(imported.idMaps.experts), ['operator'])
      const workflowId = imported.idMaps.workflows['selected-flow']
      const verified = hub.verifyImportedWorkflow({ workflowId })
      assert.equal(verified.ok, true)
      assert.equal(verified.workflow.nodes, 2)
      assert.deepEqual(verified.experts.map(item => item.id), ['operator'])
      assert.equal(verified.skills.length, 2)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
      fs.rmSync(userData, { recursive: true, force: true })
    }
  })
})
