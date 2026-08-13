#!/usr/bin/env node
/**
 * Verify committed brand assets before electron-builder runs.
 * Build Vite renderer (React/TS) when tooling is available.
 */
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const assetsDir = path.join(__dirname, '..', 'src', 'assets')
const iconPng = path.join(assetsDir, 'icon.png')
const trayIconPng = path.join(assetsDir, 'tray-icon.png')
const iconIco = path.join(assetsDir, 'icon.ico')

function requireAsset(file, signature) {
  if (!fs.existsSync(file)) throw new Error(`Missing brand asset: ${file}`)
  const data = fs.readFileSync(file)
  if (data.length < signature.length || !data.subarray(0, signature.length).equals(signature)) {
    throw new Error(`Invalid brand asset: ${file}`)
  }
}

requireAsset(iconPng, Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
requireAsset(trayIconPng, Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
requireAsset(iconIco, Buffer.from([0, 0, 1, 0]))
console.log('prebuild: verified KnowMe connected brand icons')

const viteBin = path.join(__dirname, '..', 'node_modules', 'vite', 'bin', 'vite.js')
if (fs.existsSync(viteBin)) {
  const r = spawnSync(process.execPath, [viteBin, 'build'], {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
  })
  if (r.status !== 0) {
    throw new Error('prebuild: vite renderer build failed')
  }
  console.log('prebuild: vite renderer built')
} else {
  console.log('prebuild: vite not installed; skip renderer build (legacy-only package)')
}
