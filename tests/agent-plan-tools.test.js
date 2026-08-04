'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const { createSession } = require('../src/lib/agent-sessions')
const { buildPlanTools } = require('../src/lib/agent-plan-tools')

describe('agent-plan-tools', () => {
  it('update_plan replaces and upserts plan items on the session', async () => {
    let session = createSession('general', 1)
    const tools = buildPlanTools({
      getSession: () => session,
      setSession: (next) => { session = next },
    })
    const replace = await tools.handlers.update_plan({
      replace: [
        { id: 'p1', title: '读取文件', status: 'pending' },
        { id: 'p2', title: '写摘要', status: 'pending' },
      ],
    })
    assert.equal(replace.ok, true)
    assert.equal(session.run.plan.items.length, 2)
    const upsert = await tools.handlers.update_plan({
      set_status: { id: 'p1', status: 'done', evidence: '已读' },
    })
    assert.equal(upsert.ok, true)
    assert.equal(session.run.plan.items[0].status, 'done')
    assert.equal(upsert.meta.remaining, 1)
  })

  it('rejects empty update_plan args', async () => {
    let session = createSession('general', 1)
    const tools = buildPlanTools({
      getSession: () => session,
      setSession: (next) => { session = next },
    })
    const bad = await tools.handlers.update_plan({})
    assert.equal(bad.ok, false)
  })
})
