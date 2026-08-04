'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const path = require('node:path')
const sandbox = require('../src/lib/agent-sandbox')

describe('agent-sandbox permissions', () => {
  it('defaults to network/write/dangerous all false', () => {
    assert.deepEqual(sandbox.normalizeSandboxPermissions(null), {
      network: false,
      write: false,
      dangerous: false,
    })
    assert.deepEqual(sandbox.DEFAULT_SANDBOX_PERMISSIONS, {
      network: false,
      write: false,
      dangerous: false,
    })
  })

  it('maps legacy allowNetwork to permissions.network', () => {
    assert.equal(sandbox.normalizeSandboxPermissions(null, { allowNetwork: true }).network, true)
    assert.equal(sandbox.normalizeSandboxPermissions({ network: false }, { allowNetwork: true }).network, false)
  })

  it('checkSandboxPermission returns readable denial', () => {
    const r = sandbox.checkSandboxPermission({ network: false }, 'network')
    assert.equal(r.allowed, false)
    assert.equal(r.category, 'network')
    assert.match(r.reason, /network/)
  })
})

describe('agent-sandbox screenCommand', () => {
  it('rejects empty and oversized sources', () => {
    assert.equal(sandbox.screenCommand('').allowed, false)
    const big = 'a'.repeat(sandbox.MAX_SOURCE_CHARS + 1)
    const r = sandbox.screenCommand(big)
    assert.equal(r.allowed, false)
    assert.equal(r.category, 'too_large')
  })

  it('blocks destructive/system commands as dangerous', () => {
    for (const cmd of ['rm -rf /', 'del /s /q C:\\', 'shutdown /s', 'format c:', ':(){ :|:& };:', 'Remove-Item -Recurse -Force C:\\data']) {
      const r = sandbox.screenCommand(cmd)
      assert.equal(r.allowed, false, `expected blocked: ${cmd}`)
      assert.equal(r.category, 'dangerous', `expected dangerous: ${cmd}`)
    }
  })

  it('blocks network/egress commands unless network permission', () => {
    const blocked = sandbox.screenCommand('curl http://example.com')
    assert.equal(blocked.allowed, false)
    assert.equal(blocked.category, 'network')
    const allowed = sandbox.screenCommand('curl http://example.com', {
      permissions: { network: true, write: false, dangerous: false },
    })
    assert.equal(allowed.allowed, true)
  })

  it('blocks powershell iwr/irm aliases by default', () => {
    for (const cmd of ['iwr https://example.com', 'irm https://example.com', 'powershell Invoke-WebRequest https://x']) {
      const r = sandbox.screenCommand(cmd)
      assert.equal(r.allowed, false, cmd)
      assert.equal(r.category, 'network')
    }
  })

  it('blocks node -e/--eval regardless of network permission', () => {
    for (const cmd of [
      'node -e "fetch(\'https://example.com\')"',
      'node --eval "require(\'http\').get(\'https://example.com\')"',
      'node -p "fetch(\'https://example.com\')"',
    ]) {
      const r = sandbox.screenCommand(cmd, { mode: 'shell', workspaceRoot: '/tmp/box' })
      assert.equal(r.allowed, false, cmd)
      assert.equal(r.category, 'network')
    }
  })

  it('requires node script path inside workspace', () => {
    const ws = path.resolve('/tmp/knowme-sandbox')
    const outside = sandbox.screenCommand('node C:\\Users\\evil\\pwn.js', {
      mode: 'shell',
      workspaceRoot: ws,
    })
    assert.equal(outside.allowed, false)
    assert.equal(outside.category, 'write')
    const inside = sandbox.screenCommand('node script.js', {
      mode: 'shell',
      workspaceRoot: ws,
    })
    assert.equal(inside.allowed, true)
  })

  it('allows benign commands', () => {
    assert.equal(sandbox.screenCommand('echo hello').allowed, true)
    assert.equal(sandbox.screenCommand('print("hi")', { mode: 'python' }).allowed, true)
  })
})

describe('agent-sandbox screenPythonImports', () => {
  const pyOpts = { mode: 'python' }

  for (const snippet of [
    'import urllib.request\nurllib.request.urlopen("https://example.com")',
    'import requests\nrequests.get("https://example.com")',
    'import socket\nsocket.create_connection(("example.com", 80))',
    'import http.client\nhttp.client.HTTPConnection("example.com")',
    'from aiohttp import ClientSession',
    '__import__("urllib.request")',
  ]) {
    it(`blocks network import: ${snippet.split('\n')[0]}`, () => {
      const r = sandbox.screenCommand(snippet, pyOpts)
      assert.equal(r.allowed, false, snippet)
      assert.equal(r.category, 'network')
    })
  }

  it('allows network imports when network permission granted', () => {
    const r = sandbox.screenCommand('import requests', {
      ...pyOpts,
      permissions: { network: true, write: false, dangerous: false },
    })
    assert.equal(r.allowed, true)
  })

  it('allows harmless python without network modules', () => {
    const r = sandbox.screenCommand('print(sum(range(10)))', pyOpts)
    assert.equal(r.allowed, true)
  })
})

describe('agent-sandbox formatRunResult', () => {
  it('marks success on exit code 0 and includes stdout', () => {
    const r = sandbox.formatRunResult('run:', { code: 0, stdout: '42', stderr: '' })
    assert.equal(r.ok, true)
    assert.match(r.text, /42/)
    assert.match(r.text, /退出码：0/)
  })

  it('marks failure on nonzero exit and surfaces stderr', () => {
    const r = sandbox.formatRunResult('run:', { code: 1, stdout: '', stderr: 'boom' })
    assert.equal(r.ok, false)
    assert.equal(r.code, 'sandbox_error')
    assert.match(r.text, /boom/)
  })

  it('marks timeout distinctly', () => {
    const r = sandbox.formatRunResult('run:', { timedOut: true, stdout: '', stderr: '' })
    assert.equal(r.ok, false)
    assert.equal(r.code, 'sandbox_timeout')
    assert.match(r.text, /超时/)
  })

  it('truncates very long output', () => {
    const r = sandbox.formatRunResult('run:', { code: 0, stdout: 'x'.repeat(sandbox.MAX_OUTPUT_CHARS + 500) })
    assert.equal(r.truncated, true)
    assert.match(r.text, /输出已截断/)
  })
})

describe('agent-sandbox buildSandboxTools', () => {
  function stubDeps() {
    const written = []
    const ensured = []
    return {
      written,
      ensured,
      ensureDir: (dir) => ensured.push(dir),
      writeFile: (file, content) => written.push({ file, content }),
    }
  }

  it('exposes run_python and run_shell definitions', () => {
    const { definitions } = sandbox.buildSandboxTools({ workdir: '/tmp/x' })
    assert.deepEqual(definitions.map(d => d.function.name), ['run_python', 'run_shell'])
  })

  it('returns normalized permissions on build', () => {
    const { permissions } = sandbox.buildSandboxTools({
      workdir: '/tmp/x',
      permissions: { network: true },
    })
    assert.equal(permissions.network, true)
    assert.equal(permissions.write, false)
    assert.equal(permissions.dangerous, false)
  })

  it('executes python via injected runProcess with -I isolation flag', async () => {
    const deps = stubDeps()
    let seenArgs = null
    const { handlers } = sandbox.buildSandboxTools({
      workdir: '/tmp/box',
      ensureDir: deps.ensureDir,
      writeFile: deps.writeFile,
      runProcess: (opts) => { seenArgs = opts; return Promise.resolve({ code: 0, stdout: 'ok', stderr: '' }) },
    })
    const r = await handlers.run_python({ code: 'print("ok")' })
    assert.equal(r.ok, true)
    assert.match(r.text, /ok/)
    assert.equal(deps.ensured[0], '/tmp/box')
    assert.equal(deps.written.length, 1)
    assert.match(deps.written[0].file, /script_.*\.py$/)
    assert.equal(seenArgs.cwd, '/tmp/box')
    assert.deepEqual(seenArgs.args, ['-I', deps.written[0].file])
  })

  it('blocks python urllib before spawning', async () => {
    let spawned = false
    const { handlers } = sandbox.buildSandboxTools({
      workdir: '/tmp/box',
      ensureDir: () => {},
      runProcess: () => { spawned = true; return Promise.resolve({ code: 0 }) },
    })
    const r = await handlers.run_python({ code: 'import urllib.request' })
    assert.equal(r.ok, false)
    assert.equal(r.code, 'network')
    assert.equal(spawned, false)
  })

  it('blocks node -e fetch before spawning run_shell', async () => {
    let spawned = false
    const { handlers } = sandbox.buildSandboxTools({
      workdir: '/tmp/box',
      ensureDir: () => {},
      runProcess: () => { spawned = true; return Promise.resolve({ code: 0 }) },
    })
    const r = await handlers.run_shell({ command: 'node -e "fetch(\'https://example.com\')"' })
    assert.equal(r.ok, false)
    assert.equal(r.code, 'network')
    assert.equal(spawned, false)
  })

  it('blocks dangerous run_shell before spawning and flags approval', async () => {
    let spawned = false
    const { handlers } = sandbox.buildSandboxTools({
      workdir: '/tmp/box',
      ensureDir: () => {},
      runProcess: () => { spawned = true; return Promise.resolve({ code: 0 }) },
    })
    const r = await handlers.run_shell({ command: 'rm -rf /' })
    assert.equal(r.ok, false)
    assert.equal(r.code, 'blocked_dangerous')
    assert.equal(r.requiresApproval, true)
    assert.equal(spawned, false)
  })

  it('reports missing python runtime clearly', async () => {
    const { handlers } = sandbox.buildSandboxTools({
      workdir: '/tmp/box',
      ensureDir: () => {},
      writeFile: () => {},
      runProcess: () => Promise.resolve({ code: -1, stdout: '', stderr: 'spawn python ENOENT' }),
    })
    const r = await handlers.run_python({ code: 'print(1)' })
    assert.equal(r.ok, false)
    assert.equal(r.code, 'python_unavailable')
  })

  it('tags blocked network tools with needsPermission for UI upgrade', async () => {
    const { handlers } = sandbox.buildSandboxTools({ workdir: '/tmp/box', ensureDir: () => {} })
    const r = await handlers.run_shell({ command: 'curl http://example.com' })
    assert.equal(r.ok, false)
    assert.equal(r.needsPermission, 'network')
    assert.equal(sandbox.parseSandboxPermissionNeed(r), 'network')
  })

  it('maps blocked_dangerous to dangerous permission upgrade', () => {
    assert.equal(sandbox.parseSandboxPermissionNeed({ code: 'blocked_dangerous' }), 'dangerous')
    assert.equal(sandbox.permissionUpgradeLabel('write'), 'write（写入）')
  })
})

describe('agent-sandbox path helpers', () => {
  it('extractNodeScriptPath skips eval flags', () => {
    assert.equal(sandbox.extractNodeScriptPath('node -e "1"'), null)
    assert.equal(sandbox.extractNodeScriptPath('node script.js'), 'script.js')
    assert.equal(sandbox.extractNodeScriptPath('node --require dotenv script.js'), 'script.js')
  })

  it('isPathInsideWorkspace resolves relative paths against workspace', () => {
    const ws = path.resolve('/tmp/ws')
    assert.equal(sandbox.isPathInsideWorkspace('a.js', ws), true)
    assert.equal(sandbox.isPathInsideWorkspace('/etc/passwd', ws), false)
  })
})
