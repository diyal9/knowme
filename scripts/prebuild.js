#!/usr/bin/env node
/**
 * Verify committed brand assets before electron-builder runs.
 */
const fs = require('fs')
const path = require('path')

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
console.log('prebuild: verified KM brand icons')
