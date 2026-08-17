'use strict'

const { Menu } = require('electron')

function buildTrayTemplate({ createWorkspaceWindow, openSettings, requestAppQuit }) {
  return [
    { label: '显示工作台', click: () => { createWorkspaceWindow() } },
    { type: 'separator' },
    { label: '设置…', click: () => openSettings() },
    { type: 'separator' },
    { label: '退出', click: requestAppQuit },
  ]
}

function applyTrayMenu(tray, deps) {
  if (!tray) return
  tray.setContextMenu(Menu.buildFromTemplate(buildTrayTemplate(deps)))
}

module.exports = { buildTrayTemplate, applyTrayMenu }
