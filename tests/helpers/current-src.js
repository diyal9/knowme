'use strict'

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..', '..')
const SRC = path.join(ROOT, 'src')

function walkFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    if (fs.statSync(p).isDirectory()) walkFiles(p, acc)
    else acc.push(p)
  }
  return acc
}

function readMany(files) {
  return files
    .filter((f) => fs.existsSync(f))
    .map((f) => fs.readFileSync(f, 'utf8'))
    .join('\n')
}

function rendererTree() {
  return walkFiles(path.join(SRC, 'renderer'))
    .filter((f) => /\.(tsx|ts|css|html)$/.test(f))
    .sort()
}

function libFile(name) {
  return path.join(SRC, 'lib', name)
}

/** Map retired golden-page names onto current runtime sources. */
function currentPage(name) {
  const n = String(name || '').replace(/\\/g, '/')
  if (n === 'workbench.js') {
    return readMany([
      libFile('workbench-studio-model.ts'),
      libFile('workbench-studio-canvas.ts'),
      path.join(SRC, 'domain', 'studio.ts'),
      path.join(SRC, 'renderer', 'features', 'workbench', 'StudioSurface.tsx'),
      path.join(SRC, 'renderer', 'features', 'workbench', 'ShelfSurface.tsx'),
      path.join(SRC, 'renderer', 'features', 'workbench', 'RunSurface.tsx'),
      path.join(SRC, 'renderer', 'features', 'workbench', 'ManageSurface.tsx'),
    ])
  }
  if (n === 'settings.html') {
    return readMany([
      path.join(SRC, 'renderer', 'features', 'settings', 'SettingsSurface.tsx'),
      path.join(SRC, 'renderer', 'settings', 'main.tsx'),
    ])
  }
  if (n === 'memory.html') {
    return readMany([path.join(SRC, 'renderer', 'memory', 'main.tsx')])
  }
  if (n === 'log-viewer.html' || n === 'log-viewer.js') {
    return readMany([path.join(SRC, 'renderer', 'log-viewer', 'main.tsx')])
  }
  if (n.startsWith('capability-hub')) {
    return readMany([
      path.join(SRC, 'renderer', 'features', 'capability-hub', 'CapabilityHubSurface.tsx'),
      path.join(SRC, 'renderer', 'app', 'SideRail.tsx'),
    ])
  }
  if (n === 'note.html' || n === 'list.html' || n.startsWith('editor-pane')) {
    return ''
  }
  return readMany(rendererTree())
}

function readPreload() {
  return readMany([
    path.join(SRC, 'preload.js'),
    path.join(SRC, 'preload', 'index.ts'),
    path.join(SRC, 'preload', 'api-core.ts'),
    path.join(SRC, 'preload', 'api-extended.ts'),
  ])
}

module.exports = { currentPage, readPreload, rendererTree, ROOT, SRC }
