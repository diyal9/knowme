#!/usr/bin/env node
'use strict'

/**
 * Real Electron cold-restart regression for canonical assistant messages.
 * The test uses an isolated userData directory and never touches the user's
 * profile. It intentionally checks the same sharded session store that the
 * main process opens after a cold launch.
 */
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn } = require('node:child_process')
const { _electron: electron } = require('playwright')
require('./register-ts')
const agentSessions = require('../src/lib/agent-sessions')
const { createAgentSessionStore } = require('../src/lib/agent-session-store')

const repoRoot = path.resolve(__dirname, '..')
const viteBin = path.join(repoRoot, 'node_modules', 'vite', 'bin', 'vite.js')
const electronBin = require('electron')
const viteUrl = 'http://127.0.0.1:5173'
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-electron-cold-restart-'))

function waitForHttp(url, timeoutMs = 30_000) {
  const started = Date.now()
  return new Promise((resolve, reject) => {
    const probe = () => {
      require('node:http').get(url, response => {
        response.resume()
        resolve()
      }).on('error', () => {
        if (Date.now() - started > timeoutMs) reject(new Error(`Vite 启动超时：${url}`))
        else setTimeout(probe, 200)
      })
    }
    probe()
  })
}

function launchVite() {
  return spawn(process.execPath, [viteBin, '--host', '127.0.0.1', '--port', '5173'], {
    cwd: repoRoot,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
}

async function launchElectron() {
  return electron.launch({
    executablePath: electronBin,
    args: [repoRoot, '--dev'],
    cwd: repoRoot,
    env: {
      ...process.env,
      KNOWME_TEST_SEAM: '1',
      KNOWME_TEST_USER_DATA_DIR: userData,
      KNOWME_VITE_URL: viteUrl,
    },
  })
}

function writeCanonicalSession() {
  const session = agentSessions.createSession('personal')
  session.id = 'session_cold_restart'
  session.title = '冷启动回归'
  session.messages = [
    { id: 'msg_user_1', role: 'user', text: '测试问题', createdAt: new Date().toISOString() },
    { id: 'msg_assistant_1', role: 'assistant', text: '唯一规范回答', createdAt: new Date().toISOString(), runId: 'run_cold_restart' },
  ]
  const store = createAgentSessionStore({
    legacyFile: path.join(userData, 'agent-sessions.json'),
    rootDir: path.join(userData, 'agent-sessions'),
    taskFile: path.join(userData, 'workbench-tasks.json'),
    agentSessions,
  })
  store.save([session], { openSessionIds: [session.id], activeSessionId: session.id })
  return store.paths
}

function readAfterRestart() {
  const store = createAgentSessionStore({
    legacyFile: path.join(userData, 'agent-sessions.json'),
    rootDir: path.join(userData, 'agent-sessions'),
    taskFile: path.join(userData, 'workbench-tasks.json'),
    agentSessions,
  })
  const loaded = store.load()
  const messages = loaded.sessions.flatMap(session => session.messages || [])
    .filter(message => message.role === 'assistant' && message.text === '唯一规范回答')
  return { sessionCount: loaded.sessions.length, answerCount: messages.length, answerIds: messages.map(message => message.id) }
}

async function main() {
  const vite = launchVite()
  let first = null
  let second = null
  try {
    await waitForHttp(`${viteUrl}/workspace/`)
    first = await launchElectron()
    await first.firstWindow()
    writeCanonicalSession()
    await first.close()
    first = null

    second = await launchElectron()
    const secondWindow = await second.firstWindow()
    await secondWindow.getByText('唯一规范回答', { exact: true }).waitFor({ state: 'visible', timeout: 15_000 })
    const renderedAnswerCount = await secondWindow.getByText('唯一规范回答', { exact: true }).count()
    if (renderedAnswerCount !== 1) {
      throw new Error(`冷启动页面重复渲染：${renderedAnswerCount}`)
    }
    const result = readAfterRestart()
    if (result.sessionCount !== 1 || result.answerCount !== 1) {
      throw new Error(`冷启动恢复异常：${JSON.stringify(result)}`)
    }
    console.log(JSON.stringify({ ok: true, renderedAnswerCount, ...result, userData }, null, 2))
  } finally {
    if (first) await first.close().catch(() => {})
    if (second) await second.close().catch(() => {})
    vite.kill()
    fs.rmSync(userData, { recursive: true, force: true })
  }
}

main().catch(error => {
  console.error(JSON.stringify({ ok: false, message: String(error?.stack || error) }, null, 2))
  process.exitCode = 1
})
