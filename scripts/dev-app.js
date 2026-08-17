#!/usr/bin/env node
'use strict'

/**
 * 日常开发入口：清残留 → Vite HMR → Electron --dev。
 * 不跑 renderer:build。启动前 chdir 到仓库真实路径（realpath），避免解析偏移。
 */
const fs = require('fs')
const http = require('http')
const path = require('path')
const { spawn } = require('child_process')
const { killKnowmeDev } = require('./kill-knowme')

const repoRoot = fs.realpathSync(path.join(__dirname, '..'))
process.chdir(repoRoot)

const VITE_URL = String(process.env.KNOWME_VITE_URL || 'http://127.0.0.1:5173').replace(/\/$/, '')
const children = []
let stopping = false

function log(msg) {
  console.log(`[dev-app] ${msg}`)
}

function spawnNode(relBin, args) {
  const child = spawn(process.execPath, [path.join(repoRoot, 'node_modules', relBin), ...args], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env,
  })
  children.push(child)
  return child
}

function waitFor(url, timeoutMs = 30000) {
  const started = Date.now()
  return new Promise((resolve, reject) => {
    const ping = () => {
      const req = http.get(url, (res) => {
        res.resume()
        resolve()
      })
      req.on('error', () => {
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`等待 Vite 超时：${url}`))
          return
        }
        setTimeout(ping, 250)
      })
    }
    ping()
  })
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function shutdown(code = 0) {
  if (stopping) return
  stopping = true
  for (const child of children) {
    if (!child.killed) child.kill()
  }
  process.exit(code)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

async function main() {
  log(`repo ${repoRoot}`)
  killKnowmeDev()
  await sleep(400)
  log('已清理旧 KnowMe / Electron / :5173')

  const vite = spawnNode('vite/bin/vite.js', [])
  vite.on('exit', (code) => {
    if (!stopping) {
      log(`Vite 退出 ${code}`)
      shutdown(code ? 1 : 0)
    }
  })

  await waitFor(`${VITE_URL}/workspace/`)
  log(`Vite 就绪 ${VITE_URL}`)

  const electron = spawnNode('electron/cli.js', ['.', '--dev'])
  electron.on('exit', (code) => {
    log(`Electron 退出 ${code == null ? '' : code}`)
    shutdown(0)
  })
}

main().catch((err) => {
  console.error(`[dev-app] ${err.message || err}`)
  shutdown(1)
})
