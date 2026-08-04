'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const workbenchAuth = require('../src/lib/workbench-auth')
const bootstrap = require('../src/lib/workbench-bootstrap')

function readJsonSafe(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function fromWorkflowConfig(root) {
  const file = path.join(root, '.nine', '.workflow-config.yaml')
  if (!fs.existsSync(file)) return ''
  const text = fs.readFileSync(file, 'utf8')
  const match = text.match(/^\s*key:\s*(wb_[^\s#]+)\s*$/m)
  return match ? match[1].trim() : ''
}

function resolveWorkbenchToken(options = {}) {
  const fromEnv = String(process.env.KNOWME_WORKBENCH_TOKEN || '').trim()
  if (fromEnv) return fromEnv

  const appData = process.env.APPDATA
    || path.join(os.homedir(), 'AppData', 'Roaming')
  const settingsFile = path.join(appData, 'KnowMe', 'settings.json')
  const settings = readJsonSafe(settingsFile)
  const fromSettings = workbenchAuth.resolveToken(settings || {})
  if (fromSettings) return fromSettings

  const workbenchRoot = options.workbenchRoot
    || bootstrap.resolveWorkbenchInstallPath(options.settings || {})
    || bootstrap.discoverWorkbenchInstall()
  if (!workbenchRoot) return ''
  return fromWorkflowConfig(workbenchRoot)
}

module.exports = {
  resolveWorkbenchToken,
}
