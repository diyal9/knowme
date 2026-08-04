const { describe, it } = require('node:test')
const assert = require('node:assert')
const {
  normalizeEndpoint,
  validateSlug,
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
    let calls = 0
    const client = createClient({ fetch: async () => { calls += 1; return jsonResponse({}) } })
    const result = await client.createAndRun({ workflow: 'demo', slug: '../secret', intent: 'test' })
    assert.equal(result.ok, false)
    assert.equal(result.code, 'invalid_slug')
    assert.equal(calls, 0)
  })

  it('loads a normalized online overview', async () => {
    const fetch = async url => {
      if (url.endsWith('/api/health')) return jsonResponse({ ok: true, hostname: 'local' })
      if (url.endsWith('/api/workflows')) {
        return jsonResponse({ workflows: [{ id: 'daily-brief', name: '每日简报' }] })
      }
      if (url.endsWith('/api/tasks')) {
        return jsonResponse({ tasks: [{ slug: 'daily-brief-1', workflow: 'daily-brief', job: { state: 'running' } }] })
      }
      return jsonResponse({ detail: 'not found' }, 404)
    }
    const result = await createClient({ fetch }).overview()
    assert.equal(result.ok, true)
    assert.equal(result.online, true)
    assert.equal(result.workflows[0].source, 'daemon')
    assert.equal(result.tasks[0].state, 'running')
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
})
