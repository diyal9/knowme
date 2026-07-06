#!/usr/bin/env node
/**
 * Ensure build assets exist before electron-builder runs.
 */
const fs = require('fs')
const path = require('path')
const { createAppIconPng } = require('../src/lib/app-icon')

const assetsDir = path.join(__dirname, '..', 'src', 'assets')
const iconPng = path.join(assetsDir, 'icon.png')

fs.mkdirSync(assetsDir, { recursive: true })
fs.writeFileSync(iconPng, createAppIconPng(512))
console.log('prebuild: wrote', iconPng)
