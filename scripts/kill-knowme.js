#!/usr/bin/env node
'use strict'

/**
 * 清掉开发占用：KnowMe.exe / electron.exe / Vite 5173。
 * 用 execFile 调 taskkill，避免 Git Bash 把 /F 吃成路径。
 */
const { execFileSync } = require('child_process')

function taskkillImage(image) {
  try {
    execFileSync('taskkill', ['/F', '/IM', image, '/T'], { stdio: 'ignore', windowsHide: true })
  } catch { /* 进程不存在 */ }
}

function parseListeningPids(netstatOut, port) {
  const local = new RegExp(`:${Number(port)}(?:\\s|$)`)
  const pids = new Set()
  for (const line of String(netstatOut || '').split(/\r?\n/)) {
    if (!/LISTENING/i.test(line) || !local.test(line)) continue
    const pid = Number(line.trim().split(/\s+/).pop())
    if (Number.isInteger(pid) && pid > 0) pids.add(pid)
  }
  return [...pids]
}

function pidsOnPort(port) {
  if (process.platform !== 'win32') return []
  try {
    const out = execFileSync('netstat', ['-ano'], { encoding: 'utf8', windowsHide: true })
    return parseListeningPids(out, port)
  } catch {
    return []
  }
}

function killPids(pids) {
  for (const pid of pids) {
    try {
      execFileSync('taskkill', ['/F', '/PID', String(pid), '/T'], { stdio: 'ignore', windowsHide: true })
    } catch { /* 已退出 */ }
  }
}

function killKnowmeDev(opts = {}) {
  const port = Number(opts.port || process.env.KNOWME_VITE_PORT || 5173)
  taskkillImage('KnowMe.exe')
  taskkillImage('electron.exe')
  killPids(pidsOnPort(port))
}

if (require.main === module) killKnowmeDev()

module.exports = { killKnowmeDev, parseListeningPids, pidsOnPort, taskkillImage }
