const { describe, it } = require('node:test')
const assert = require('node:assert')
const {
  normalizeEndpoint,
  validateSlug,
  normalizeWorkflowCatalog,
  normalizeWorkflow,
  normalizeAgentExpert,
  selectAgentExperts,
  partitionAgentExperts,
  createClient,
  buildAuthHeaders,
  buildSubmitContext,
} = require('../src/lib/workbench-daemon-client')

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('workbench daemon API client', () => {
  it('allows loopback HTTP and remote HTTPS endpoints', () => {
    assert.equal(normalizeEndpoint(), 'http://127.0.0.1:8010')
    assert.equal(normalizeEndpoint('http://localhost:9010/'), 'http://localhost:9010')
    assert.equal(normalizeEndpoint('https://daemon.example.com/'), 'https://daemon.example.com')
    assert.equal(normalizeEndpoint('https://127.0.0.1:8010'), 'https://127.0.0.1:8010')
    assert.throws(() => normalizeEndpoint('http://192.168.1.20:8010'), /必须使用 HTTPS/)
    assert.throws(() => normalizeEndpoint('http://user:pass@localhost:8010'), /必须使用 HTTPS/)
    assert.throws(() => normalizeEndpoint('http://localhost:8010/api'), /必须使用 HTTPS/)
  })

  it('validates task slugs before making requests', async () => {
    assert.equal(validateSlug('daily-summary-0724'), 'daily-summary-0724')
    assert.throws(() => validateSlug('../secret'), /任务标识/)
    assert.throws(() => validateSlug('Upper-Case'), /任务标识/)
    let createdSlug = ''
    const client = createClient({
      fetch: async (url, options = {}) => {
        if (url.endsWith('/api/tasks')) {
          createdSlug = options.body.get('slug')
          return jsonResponse({ ok: true, task: { slug: createdSlug } })
        }
        if (String(url).includes('/run')) {
          return jsonResponse({ ok: true, job: { state: 'queued' } })
        }
        return jsonResponse({}, 404)
      },
    })
    const result = await client.createAndRun({ workflow: 'demo', slug: '../secret', intent: 'test' })
    assert.equal(result.ok, true)
    assert.match(createdSlug, /^demo-\d{8}-\d{6}-[a-z0-9]+$/)
    assert.doesNotMatch(createdSlug, /\.\.|secret/)
  })

  it('loads a normalized online overview', async () => {
    const fetch = async url => {
      if (url.endsWith('/api/health')) return jsonResponse({ ok: true, hostname: 'local' })
      if (url.endsWith('/api/workflows')) {
        return jsonResponse({ workflows: [{ id: 'daily-brief', name: '每日简报' }] })
      }
      if (url.endsWith('/api/tasks')) {
        return jsonResponse({
          tasks: [{
            slug: 'daily-brief-1',
            workflow: 'daily-brief',
            document_title: '项目需求说明',
            source: { title: '需求文档' },
            job: { state: 'running' },
          }],
        })
      }
      return jsonResponse({ detail: 'not found' }, 404)
    }
    const result = await createClient({ fetch }).overview()
    assert.equal(result.ok, true)
    assert.equal(result.online, true)
    assert.equal(result.workflows[0].source, 'daemon')
    assert.equal(result.tasks[0].state, 'running')
    assert.equal(result.tasks[0].documentTitle, '项目需求说明')
    assert.equal(result.tasks[0].sourceTitle, '需求文档')
  })

  it('normalizes and sorts safe daemon Agent experts', async () => {
    const normalized = normalizeAgentExpert({
      id: 'f9-arch-fe',
      label_zh: '前端架构',
      label_en: 'Arch FE',
      description: '输出前端开发计划',
      model: 'gpt-5.6-sol-medium',
      card_line: '前端方案 → plan-fe',
      keywords_purpose: ['前端方案'],
      display_order: 2,
      exists: true,
      working_on: [{ slug: 'secret-task' }],
      asset_path: 'C:\\daemon\\agents\\f9-arch-fe',
    })
    assert.equal(normalized.title, '前端架构 · Arch FE')
    assert.equal(normalized.persona.role, '前端架构')
    assert.equal(normalized.display.summary, '前端方案 → plan-fe')
    assert.equal(normalized.model, 'gpt-5.6-sol-medium')
    assert.equal(normalized.source, 'daemon')
    assert.equal(normalized.origin, 'daemon')
    assert.equal(normalized.editable, false)
    assert.equal(normalized.path, '')
    assert.equal('working_on' in normalized, false)
    assert.equal('asset_path' in normalized, false)

    const fetch = async url => {
      if (url.endsWith('/api/health')) return jsonResponse({ ok: true })
      if (url.endsWith('/api/workflows')) return jsonResponse({ workflows: [] })
      if (url.endsWith('/api/tasks')) return jsonResponse({ tasks: [] })
      if (url.endsWith('/api/agents-team/overview')) {
        return jsonResponse({
          agents: [
            { id: 'later', label_zh: '后端编码', display_order: 4, exists: true },
            { id: 'first', label_zh: '需求负责人', display_order: 0, exists: true },
            { id: 'missing', label_zh: '不可用专家', display_order: 1, exists: false },
          ],
        })
      }
      return jsonResponse({ detail: 'not found' }, 404)
    }
    const overview = await createClient({ fetch }).overview()
    assert.equal(overview.agentCatalogAvailable, true)
    assert.deepEqual(overview.agents.map(agent => agent.id), ['first', 'later'])
  })

  it('falls back to repository experts when daemon Agent endpoint is unavailable', async () => {
    const fetch = async url => {
      if (url.endsWith('/api/health')) return jsonResponse({ ok: true })
      if (url.endsWith('/api/workflows')) return jsonResponse({ workflows: [{ id: 'demo' }] })
      if (url.endsWith('/api/tasks')) return jsonResponse({ tasks: [] })
      return jsonResponse({ detail: 'not found' }, 404)
    }
    const overview = await createClient({ fetch }).overview()
    assert.equal(overview.ok, true)
    assert.equal(overview.online, true)
    assert.equal(overview.agentCatalogAvailable, false)
    assert.equal(overview.workflows.length, 1)

    const local = [{ id: 'local-expert' }]
    assert.deepEqual(selectAgentExperts(local, overview), {
      agents: local,
      source: 'repository',
    })
    assert.deepEqual(selectAgentExperts(local, {
      agentCatalogAvailable: true,
      agents: [{ id: 'daemon-expert' }],
    }), {
      agents: [{ id: 'daemon-expert' }],
      source: 'daemon',
    })
  })

  it('partitions local editable Agents from fixed read-only Daemon Agents', () => {
    const result = partitionAgentExperts(
      [{ id: 'writer', name: '写作助手' }],
      { agents: [{ id: 'reviewer', title: '审核员', editable: true }] },
    )
    assert.deepEqual(result.localAgents, [{
      id: 'writer',
      name: '写作助手',
      source: 'local',
      origin: 'local',
      editable: true,
    }])
    assert.deepEqual(result.daemonAgents, [{
      id: 'reviewer',
      title: '审核员',
      editable: false,
      source: 'daemon',
      origin: 'daemon',
    }])
  })

  it('keeps daemon catalog metadata and fails closed for hidden entries', () => {
    assert.deepEqual(normalizeWorkflowCatalog(), {
      visibility: 'primary',
      category: 'general',
      order: 1000,
    })
    assert.deepEqual(normalizeWorkflow({
      id: 'primary-flow',
      agents: [{ id: 'planner' }, 'tester'],
      catalog: { visibility: 'primary', category: 'planning', order: 10 },
    }).catalog, {
      visibility: 'primary',
      category: 'planning',
      order: 10,
    })
    assert.deepEqual(normalizeWorkflow({ id: 'with-roster', agentIds: ['planner', 'tester'] }).agentIds, ['planner', 'tester'])
    assert.equal(normalizeWorkflow({ id: 'internal-flow', catalog: { visibility: 'internal' } }), null)
    assert.equal(normalizeWorkflow({ id: 'deprecated-flow', catalog: { visibility: 'deprecated' } }), null)
    assert.equal(normalizeWorkflow({ id: 'invalid-flow', catalog: { visibility: 'public' } }), null)
    assert.equal(normalizeWorkflow({ id: 'invalid-shape', catalog: 'primary' }), null)
  })

  it('returns only user-facing workflows while preserving daemon catalog order', async () => {
    const fetch = async url => {
      if (url.endsWith('/api/health')) return jsonResponse({ ok: true })
      if (url.endsWith('/api/workflows')) {
        return jsonResponse({
          workflows: [
            { id: 'legacy-flow', name: '旧流程' },
            { id: 'advanced-flow', catalog: { visibility: 'advanced', category: 'testing', order: 210 } },
            { id: 'internal-flow', catalog: { visibility: 'internal', category: 'internal', order: 900 } },
          ],
        })
      }
      if (url.endsWith('/api/tasks')) return jsonResponse({ tasks: [] })
      return jsonResponse({ detail: 'not found' }, 404)
    }
    const result = await createClient({ fetch }).overview()
    assert.deepEqual(result.workflows.map(workflow => workflow.id), ['legacy-flow', 'advanced-flow'])
    assert.equal(result.workflows[0].catalog.visibility, 'primary')
    assert.equal(result.workflows[0].catalog.order, 1000)
    assert.equal(result.workflows[1].catalog.visibility, 'advanced')
    assert.equal(result.workflows[1].catalog.order, 210)
  })

  it('loads workflow launch defaults and normalizes asset paths', async () => {
    const fetch = async url => {
      if (url.endsWith('/api/workflows/team-run/launch-context')) {
        return jsonResponse({
          defaults: {
            workspace: { projectId: 'group/project', ref: 'main' },
            inputs: { prd: './assets/mockup.png', resources: ['assets/'] },
          },
        })
      }
      return jsonResponse({ detail: 'not found' }, 404)
    }
    const result = await createClient({ fetch }).launchContext('team-run')
    assert.equal(result.ok, true)
    assert.equal(result.workflowId, 'team-run')
    assert.equal(result.context.inputs.prd, 'assets/mockup.png')
    assert.deepEqual(result.context.inputs.resources, ['assets/'])
  })

  it('treats missing launch defaults endpoint as non-blocking', async () => {
    const result = await createClient({
      fetch: async () => jsonResponse({ detail: 'not found' }, 404),
    }).launchContext('team-run')
    assert.equal(result.ok, false)
    assert.equal(result.code, 'unsupported')
  })

  it('returns a bounded offline result for timeout and invalid JSON', async () => {
    const timeoutFetch = (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
    })
    const timeout = await createClient({ fetch: timeoutFetch, timeoutMs: 5 }).overview()
    assert.equal(timeout.online, false)
    assert.equal(timeout.code, 'timeout')

    const invalid = await createClient({
      fetch: async () => new Response('not-json', { status: 200 }),
    }).overview()
    assert.equal(invalid.online, false)
    assert.equal(invalid.code, 'invalid_json')
  })

  it('creates then runs a real server task', async () => {
    const calls = []
    const fetch = async (url, options = {}) => {
      calls.push({ url, options })
      if (url.endsWith('/api/tasks')) {
        assert.equal(options.method, 'POST')
        assert.equal(options.body.get('workflow'), 'daily-brief')
        assert.equal(options.body.get('slug'), 'daily-brief-0724')
        return jsonResponse({ ok: true, task: { slug: 'daily-brief-0724' } })
      }
      if (url.endsWith('/api/tasks/daily-brief-0724/run')) {
        return jsonResponse({ ok: true, job: { state: 'queued' } })
      }
      return jsonResponse({}, 404)
    }
    const result = await createClient({ fetch }).createAndRun({
      workflow: 'daily-brief',
      slug: 'daily-brief-0724',
      intent: '整理今日信息',
    })
    assert.equal(result.ok, true)
    assert.equal(result.job.state, 'queued')
    assert.equal(calls.length, 2)
  })

  it('auto-generates a time-linked slug when missing', async () => {
    const { generateTaskSlug, createClient } = require('../src/lib/workbench-daemon-client')
    const fixed = new Date(2026, 7, 12, 9, 45, 30)
    const sample = generateTaskSlug('doc-to-plan', fixed)
    assert.match(sample, /^doc-to-plan-20260812-094530-[a-z0-9]+$/)

    let createdSlug = ''
    const fetch = async (url, options = {}) => {
      if (url.endsWith('/api/tasks')) {
        createdSlug = options.body.get('slug')
        return jsonResponse({ ok: true, task: { slug: createdSlug } })
      }
      if (url.includes('/run')) {
        return jsonResponse({ ok: true, job: { state: 'queued' } })
      }
      return jsonResponse({}, 404)
    }
    const result = await createClient({ fetch }).createAndRun({
      workflow: 'doc-to-plan',
      slug: '',
      intent: '把需求文档整理成实施计划，覆盖前后端与测试。',
    })
    assert.equal(result.ok, true)
    assert.match(createdSlug, /^doc-to-plan-\d{8}-\d{6}-[a-z0-9]+$/)
    assert.equal(result.slug, createdSlug)
  })

  it('submits versioned GitLab context and request id', async () => {
    const fetch = async (url, options = {}) => {
      if (url.endsWith('/api/tasks')) {
        assert.equal(options.body.get('protocol_version'), '1')
        assert.equal(options.body.get('request_id'), 'req-demo')
        assert.deepEqual(JSON.parse(options.body.get('context')), {
          protocolVersion: '1',
          workspace: { provider: 'gitlab', projectId: 'group/project', ref: 'main', commit: '' },
          inputs: { root: 'artifacts/inbox/demo', prd: 'PRD.md', resources: ['assets/'] },
          outputs: { root: 'artifacts/outputs/demo', mode: 'gitlab' },
        })
        return jsonResponse({ task: { slug: 'context-demo' } })
      }
      if (url.endsWith('/api/tasks/context-demo/run')) return jsonResponse({ job: { state: 'queued' } })
      return jsonResponse({}, 404)
    }
    const result = await createClient({ fetch }).createAndRun({
      workflow: 'team-run',
      slug: 'context-demo',
      intent: '执行 GitLab 任务',
      requestId: 'req-demo',
      context: {
        workspace: { projectId: 'group/project', ref: 'main' },
        inputs: { root: 'artifacts/inbox/demo', prd: './PRD.md', resources: 'assets/' },
        outputs: { root: 'artifacts/outputs/demo' },
      },
    })
    assert.equal(result.ok, true)
    assert.equal(result.contextSummary.includes('group/project'), true)
  })

  it('blocks absolute and traversal context paths before fetch', async () => {
    let calls = 0
    const client = createClient({ fetch: async () => { calls += 1; return jsonResponse({}) } })
    const result = await client.createAndRun({
      workflow: 'team-run',
      slug: 'context-invalid',
      intent: 'test',
      context: {
        workspace: { projectId: 'group/project', ref: 'main' },
        inputs: { root: 'C:\\secret', prd: 'PRD.md' },
        outputs: { root: 'artifacts/out' },
      },
    })
    assert.equal(result.ok, false)
    assert.equal(result.code, 'invalid_context_path')
    assert.equal(calls, 0)
  })

  it('submits meta-only context for script workflows', async () => {
    const context = buildSubmitContext({
      meta: { handoffFrom: 'game-requirement', sceneId: 'game-dev' },
    })
    assert.deepEqual(context, {
      protocolVersion: '1',
      meta: { handoffFrom: 'game-requirement', sceneId: 'game-dev' },
    })
  })

  it('ignores incomplete gitlab context when meta is present', () => {
    const context = buildSubmitContext({
      meta: { handoffFrom: 'game-requirement' },
      inputs: { prd: 'requirements/demo.md' },
    })
    assert.equal(context.meta.handoffFrom, 'game-requirement')
    assert.equal(context.workspace, undefined)
  })

  it('injects Authorization header when token configured', async () => {
    const fetch = async (_url, options = {}) => {
      assert.equal(options.headers.Authorization, 'Bearer wb_test_token')
      return jsonResponse({ ok: true, slug: 'daily-brief-0724', state: 'idle' })
    }
    await createClient({ fetch, token: 'wb_test_token' }).task('daily-brief-0724')
  })

  it('maps job.completed + pending clarifications to waiting non-terminal', async () => {
    const fetch = async () => jsonResponse({
      slug: 'rdpi-ff-zero-gift',
      job: { state: 'completed' },
      status: { state: 'idle', current_step: 'n3-proto' },
      pending_clarifications: [{ node: 'n3-proto', question: '请补充需求' }],
    })
    const result = await createClient({ fetch }).task('rdpi-ff-zero-gift')
    assert.equal(result.ok, true)
    assert.equal(result.state, 'waiting')
    assert.equal(result.terminal, false)
    assert.equal(result.hitlPending, true)
    assert.equal(result.pending_clarifications.length, 1)
  })

  it('normalizes remote artifact metadata without treating repo paths as local', async () => {
    const client = createClient({
      fetch: async () => jsonResponse({
        files: [{
          artifact_id: 'a-1',
          name: 'report.md',
          path: 'artifacts/outputs/report.md',
          download_url: 'https://daemon.example.com/api/artifacts/a-1',
        }],
      }),
    })
    const result = await client.artifacts('context-demo')
    assert.equal(result.ok, true)
    assert.equal(result.files[0].id, 'a-1')
    assert.equal(result.files[0].local, false)
    assert.match(result.files[0].downloadUrl, /^https:\/\//)
  })

  it('maps 403 auth failures to auth_required without leaking token', async () => {
    const fetch = async () => jsonResponse({ detail: '需要授权码登录' }, 403)
    const result = await createClient({ fetch, token: 'wb_secret' }).createAndRun({
      workflow: 'team-run',
      slug: 'team-run-demo',
      intent: 'demo',
    })
    assert.equal(result.ok, false)
    assert.equal(result.code, 'auth_required')
    assert.equal(JSON.stringify(result).includes('wb_secret'), false)
  })

  it('surfaces daemon detail.code instead of collapsing to http_error', async () => {
    const fetch = async () => jsonResponse({
      detail: { code: 'task_not_found', message: '任务不存在：missing-task' },
    }, 404)
    const result = await createClient({ fetch }).task('missing-task')
    assert.equal(result.ok, false)
    assert.equal(result.code, 'task_not_found')
    assert.equal(result.error, '任务不存在：missing-task')
  })

  it('keeps task_forbidden distinct from auth_required', async () => {
    const fetch = async () => jsonResponse({
      detail: { code: 'task_forbidden', message: '不是你的任务' },
    }, 403)
    const result = await createClient({ fetch, token: 'wb_secret' }).task('other-tenant-task')
    assert.equal(result.ok, false)
    assert.equal(result.code, 'task_forbidden')
    assert.equal(result.error, '不是你的任务')
  })

  it('maps unauthorized detail.code to auth_required', async () => {
    const fetch = async () => jsonResponse({
      detail: { code: 'unauthorized', message: '授权失败，请重新登录' },
    }, 401)
    const result = await createClient({ fetch }).createAndRun({
      workflow: 'team-run',
      slug: 'team-run-demo',
      intent: 'demo',
    })
    assert.equal(result.ok, false)
    assert.equal(result.code, 'auth_required')
    assert.match(result.error, /授权失败/)
  })

  it('buildAuthHeaders omits header when token empty', () => {
    assert.deepEqual(buildAuthHeaders(''), {})
    assert.deepEqual(buildAuthHeaders('abc'), { Authorization: 'Bearer abc' })
  })

  it('submits gate and clarification through fixed endpoints', async () => {
    const calls = []
    const fetch = async (url, options = {}) => {
      calls.push({ url, body: options.body && JSON.parse(options.body) })
      return jsonResponse({ ok: true })
    }
    const client = createClient({ fetch })
    assert.equal((await client.decide('daily-brief-0724', { node: 'review', decision: 'approve' })).ok, true)
    assert.equal((await client.clarify('daily-brief-0724', { node: 'brief', answer: '只看今天' })).ok, true)
    assert.match(calls[0].url, /\/gate$/)
    assert.deepEqual(calls[0].body, { node: 'review', decision: 'approve', comment: '' })
    assert.match(calls[1].url, /\/clarify$/)
  })

  it('cancels task through POST /cancel', async () => {
    const calls = []
    const fetch = async (url, options = {}) => {
      calls.push({ url, body: options.body && JSON.parse(options.body) })
      return jsonResponse({ ok: true })
    }
    const client = createClient({ fetch })
    const result = await client.cancel('daily-brief-0724', { reason: 'user_cancelled' })
    assert.equal(result.ok, true)
    assert.equal(result.slug, 'daily-brief-0724')
    assert.match(calls[0].url, /\/cancel$/)
    assert.deepEqual(calls[0].body, { reason: 'user_cancelled' })
  })

  it('browses task workspace tree and blob', async () => {
    const calls = []
    const fetch = async (url) => {
      calls.push(url)
      if (url.includes('/workspace/tree')) {
        return jsonResponse({ entries: [{ type: 'dir', name: 'server-src', path: 'server-src' }] })
      }
      if (url.includes('/workspace/blob')) {
        return jsonResponse({ content: 'package main', is_binary: false, size: 12 })
      }
      return jsonResponse({ detail: 'not found' }, 404)
    }
    const client = createClient({ fetch })
    const tree = await client.workspaceTree('team-run-demo', '')
    assert.equal(tree.ok, true)
    assert.equal(tree.entries[0].name, 'server-src')
    const blob = await client.workspaceBlob('team-run-demo', 'server-src/readme.md')
    assert.equal(blob.ok, true)
    assert.equal(blob.content, 'package main')
    assert.match(calls[0], /\/workspace\/tree\?path=/)
    assert.match(calls[1], /\/workspace\/blob\?path=/)
  })
})
