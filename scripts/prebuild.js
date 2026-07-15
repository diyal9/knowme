#!/usr/bin/env node
/**
 * Ensure build assets exist before electron-builder runs.
 */
const fs = require('fs')
const path = require('path')
const { createAppIconPng, createAppIcoBuffer } = require('../src/lib/app-icon')

const assetsDir = path.join(__dirname, '..', 'src', 'assets')
const iconPng = path.join(assetsDir, 'icon.png')
const iconIco = path.join(assetsDir, 'icon.ico')

fs.mkdirSync(assetsDir, { recursive: true })
fs.writeFileSync(iconPng, createAppIconPng(512))
fs.writeFileSync(iconIco, createAppIcoBuffer())
console.log('prebuild: wrote', iconPng)
console.log('prebuild: wrote', iconIco)
