#!/usr/bin/env node
'use strict'

/** 核对发行包观感：清残留后加载 dist/renderer，不启 Vite。 */
const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const { killKnowmeDev } = require('./kill-knowme')

const repoRoot = fs.realpathSync(path.join(__dirname, '..'))
process.chdir(repoRoot)
killKnowmeDev()

const electron = spawn(process.execPath, [path.join(repoRoot, 'node_modules', 'electron', 'cli.js'), '.'], {
  cwd: repoRoot,
  stdio: 'inherit',
  env: process.env,
})
electron.on('exit', (code) => process.exit(code || 0))
