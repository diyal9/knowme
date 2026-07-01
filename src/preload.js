const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  // 卡片生命周期
  initNote:        cb => ipcRenderer.on('init-note',        (_e, n) => cb(n)),
  pinChanged:      cb => ipcRenderer.on('pin-changed',      (_e, v) => cb(v)),
  favoriteChanged: cb => ipcRenderer.on('favorite-changed', (_e, v) => cb(v)),
  onCopy:          cb => ipcRenderer.on('cmd-copy',         () => cb()),
  onDelete:        cb => ipcRenderer.on('cmd-delete',       () => cb()),

  updateNote:     d  => ipcRenderer.send('note-update',          d),
  deleteNote:     id => ipcRenderer.send('note-delete',          id),
  hideNote:       id => ipcRenderer.send('note-hide',            id),
  togglePin:      id => ipcRenderer.send('note-pin-toggle',      id),
  toggleFavorite: id => ipcRenderer.send('note-toggle-favorite', id),
  incrementCopy:  id => ipcRenderer.send('note-increment-copy',  id),
  toggleExpand:   (id, aiOpen) => ipcRenderer.invoke('note-toggle-expand', id, !!aiOpen),
  setAiMode:      (id, aiOpen) => ipcRenderer.invoke('note-set-ai-mode', id, !!aiOpen),
  onLayoutChanged: cb => ipcRenderer.on('layout-changed', (_e, s) => cb(s)),
  newNote:        ()  => ipcRenderer.send('new-note'),
  newVersion:     id => ipcRenderer.send('new-version',          id),
  duplicateNote:  id => ipcRenderer.send('duplicate-note',       id),

  // 操作
  copyToClipboard: text => ipcRenderer.send('copy-to-clipboard', text),
  showContextMenu: id   => ipcRenderer.send('show-context-menu', id),

  // AI
  aiGenerate: p => ipcRenderer.invoke('ai-generate', p),
  aiSuggestTitle: p => ipcRenderer.invoke('ai-suggest-title', p),
  onAiStreamChunk: cb => {
    const fn = (_e, data) => cb(data)
    ipcRenderer.on('ai-stream-chunk', fn)
    return () => ipcRenderer.removeListener('ai-stream-chunk', fn)
  },

  // 设置
  initSettings: cb => ipcRenderer.on('init-settings', (_e, s) => cb(s)),
  saveSettings: s  => ipcRenderer.send('save-settings', s),
  getSettings:  ()  => ipcRenderer.sendSync('get-settings'),

  // 总览列表
  initList:  cb => ipcRenderer.on('init-list', (_e, notes) => cb(notes)),
  focusNote: id  => ipcRenderer.send('focus-note', id),
  closeList: ()  => ipcRenderer.send('close-list'),

  // 系统设置
  openDataDir:  ()  => ipcRenderer.send('open-data-dir'),
  openPromptSpace: () => ipcRenderer.send('open-prompt-space'),
  setAutostart: v   => ipcRenderer.send('set-autostart', v),
  getAutostart: ()  => ipcRenderer.sendSync('get-autostart'),
  importPromptSpace: () => ipcRenderer.invoke('import-prompt-space'),

  // 产品知识库 OKF + Memory（用户数据目录）
  knowledgeStatus: () => ipcRenderer.invoke('knowledge-status'),
  knowledgeExport: () => ipcRenderer.invoke('knowledge-export'),
  knowledgeImport: () => ipcRenderer.invoke('knowledge-import'),
  openKnowledgeDir: () => ipcRenderer.send('open-knowledge-dir'),
  memoryStatus: () => ipcRenderer.invoke('memory-status'),
  openMemoryDir: () => ipcRenderer.send('open-memory-dir'),
})
