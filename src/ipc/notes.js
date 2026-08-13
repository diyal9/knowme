'use strict'

/**
 * Notes IPC: CRUD + favorite/copy + batch/suggest classification.
 * Helpers (saveNote/readNote/chatCompletionOnce/…) stay in main via deps.
 */
function registerNotesIpc(ipcMain, deps) {
  const {
    noteId,
    noteVersions,
    noteDiff,
    noteClassify,
    readNote,
    saveNote,
    deleteNoteF,
    loadAllNotes,
    newNote,
    newVersion,
    duplicateNote,
    dialog,
    BrowserWindow,
    noteWins,
    delPending,
    resumeAfterNoteHide,
    clearLastClosedIf,
    updateTray,
    getListWin,
    notifyWorkspaceRefresh,
    productMemory,
    MEMORY_DIR,
    loadSettings,
    chatCompletionOnce,
  } = deps

  const refreshList = () => {
    const listWin = getListWin()
    if (listWin && !listWin.isDestroyed()) listWin.webContents.send('init-list', loadAllNotes())
  }

  // ── Cluster A: desktop note CRUD ───────────────────────────────────────────
  ipcMain.on('note-update', (_e, data) => {
    if (!data || !noteId.isSafeNoteId(data.id)) return
    const n = readNote(data.id); if (!n) return
    const patch = { ...data }
    delete patch.id
    Object.assign(n, patch)
    saveNote(n)
    updateTray()
    refreshList()
    notifyWorkspaceRefresh()
  })
  ipcMain.on('note-delete', (_e, id) => {
    const n = readNote(id)
    const title = (n?.project || '').trim()
    const preview = (n?.content?.split('\n')[0]?.trim() || '').substring(0, 40)
    const label = title || preview || '未命名便签'
    const parent = noteWins.get(id) || BrowserWindow.getFocusedWindow() || null
    // Windows 下按钮横向排列：明确区分「仅关闭」与「永久删除」
    const choice = dialog.showMessageBoxSync(parent, {
      type: 'warning',
      title: '删除便签？',
      message: `永久删除「${label}」？`,
      detail:
        '右上角最小化到托盘或 ✕ 关闭都不会删内容。\n' +
        '删除将从本机移除该便签，不可恢复。\n' +
        '建议先在「设置 → 系统配置」导出备份。',
      buttons: ['永久删除', '仅关闭窗口', '取消'],
      defaultId: 2,
      cancelId: 2,
      noLink: false,
    })
    if (choice === 1) {
      const w = noteWins.get(id)
      if (w && !w.isDestroyed()) w.hide()
      resumeAfterNoteHide(id)
      return
    }
    if (choice !== 0) return
    delPending.add(id); deleteNoteF(id)
    clearLastClosedIf(id)
    const w = noteWins.get(id)
    if (w && !w.isDestroyed()) w.close()
    else { noteWins.delete(id); delPending.delete(id) }
    updateTray()
    refreshList()
  })
  ipcMain.on('new-note',        newNote)
  ipcMain.on('new-version',     (_e, id) => newVersion(id))
  ipcMain.on('duplicate-note',  (_e, id) => duplicateNote(id))
  ipcMain.handle('get-note-versions', (_e, noteIdArg) => {
    const all = loadAllNotes()
    return noteVersions.getNoteVersions(noteIdArg, all, readNote).map(n => ({
      id: n.id, title: n.title || '', project: n.project, version: n.version,
      updatedAt: n.updatedAt, parentNoteId: n.parentNoteId,
    }))
  })
  ipcMain.handle('get-note-diff', (_e, idA, idB) => {
    const a = readNote(idA)
    const b = readNote(idB)
    if (!a || !b) return { ok: false, error: '卡片不存在' }
    const hunks = noteDiff.diffLines(a.content || '', b.content || '')
    return { ok: true, hunks, html: noteDiff.diffToHtml(hunks) }
  })
  ipcMain.handle('get-note', (_e, id) => readNote(id))

  // ── Cluster B: workspace note CRUD ─────────────────────────────────────────
  ipcMain.handle('workspace-new-note', (_e, payload = {}) => {
    const id = `n_${Date.now()}`
    const project = String(payload.project || payload.category || '').trim()
    const note = {
      id, content: '', title: '', project, version: '0.1', favorite: false, tags: [], copyCount: 0,
      category: project, okfTags: [], okfConceptId: null, parentNoteId: null,
      sections: null, editorMode: 'md', mdView: 'edit',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }
    saveNote(note)
    notifyWorkspaceRefresh()
    return { ok: true, note }
  })

  ipcMain.handle('workspace-new-version', (_e, noteIdArg) => {
    const orig = readNote(noteIdArg)
    if (!orig) return { ok: false, error: '原始笔记不存在' }
    const parts = (orig.version || '0.1').split('.').map(Number)
    parts[parts.length - 1] += 1
    const id = `n_${Date.now()}`
    const note = {
      ...orig, id, version: parts.join('.'), parentNoteId: orig.id,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }
    saveNote(note)
    notifyWorkspaceRefresh()
    return { ok: true, note }
  })

  ipcMain.handle('workspace-delete-note', (_e, noteIdArg) => {
    const n = readNote(noteIdArg)
    if (!n) return { ok: false, error: '文件不存在' }
    deleteNoteF(noteIdArg)
    clearLastClosedIf(noteIdArg)
    notifyWorkspaceRefresh()
    return { ok: true }
  })

  ipcMain.handle('workspace-duplicate-note', (_e, noteIdArg) => {
    const orig = readNote(noteIdArg)
    if (!orig) return { ok: false, error: '文件不存在' }
    const id = `n_${Date.now()}`
    const note = {
      ...orig, id, favorite: false, parentNoteId: null, copyCount: 0,
      title: orig.title ? `${orig.title} 副本` : (orig.project ? `${orig.project} 副本` : '未命名 副本'),
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }
    saveNote(note)
    notifyWorkspaceRefresh()
    return { ok: true, note }
  })

  // ── Cluster C: favorite / copy counters ────────────────────────────────────
  ipcMain.on('note-toggle-favorite', (_e, id) => {
    const n = readNote(id); if (!n) return
    n.favorite = !n.favorite; saveNote(n)
    productMemory.capture(MEMORY_DIR, {
      kind: 'telemetry',
      summary: `${n.favorite ? '收藏' : '取消收藏'}：${n.project || '未命名'}`,
      meta: { noteId: id, action: 'favorite' },
    })
    const w = noteWins.get(id)
    if (w && !w.isDestroyed()) w.webContents.send('favorite-changed', n.favorite)
    refreshList()
    updateTray()
  })

  ipcMain.on('note-increment-copy', (_e, id) => {
    const n = readNote(id); if (!n) return
    n.copyCount = (n.copyCount || 0) + 1; saveNote(n)
    productMemory.capture(MEMORY_DIR, {
      kind: 'telemetry',
      summary: `复制提示词：${(n.project || '未命名')} v${n.version || '0.1'}`,
      meta: { noteId: id, action: 'copy' },
    })
    refreshList()
  })

  // ── Cluster D: classify / suggest ──────────────────────────────────────────
  ipcMain.handle('notes-batch-classify', async (_e, opts = {}) => {
    const mode = opts.mode === 'ai' ? 'ai' : 'heuristic'
    const notes = loadAllNotes()
    const targets = notes.filter((n) => noteClassify.needsClassify(n))
    if (!targets.length) {
      return {
        ok: true, updated: 0, skipped: notes.length, failed: 0, mode, samples: [],
        message: '没有需要分类的旧数据',
      }
    }

    if (mode === 'heuristic') {
      const report = noteClassify.batchHeuristic(notes)
      const byId = new Map(notes.map((n) => [n.id, n]))
      for (const id of report.changedIds) {
        const n = byId.get(id)
        if (n) saveNote(n)
      }
      refreshList()
      productMemory.capture(MEMORY_DIR, {
        kind: 'telemetry',
        summary: `本地整理旧数据分类：更新 ${report.updated} 张`,
        meta: { action: 'batch-classify', mode, updated: report.updated },
      })
      return {
        ok: true,
        mode,
        updated: report.updated,
        skipped: report.skipped,
        failed: 0,
        samples: report.samples,
        message: `已整理 ${report.updated} 张（跳过 ${report.skipped}）`,
      }
    }

    const s = loadSettings()
    if (!s.apiKey || !s.apiEndpoint) {
      return { ok: false, error: '未配置 API Key，请改用「智能整理（本地）」或先配置 AI', mode }
    }
    let updated = 0
    let skipped = 0
    let failed = 0
    const samples = []
    for (const n of targets) {
      const beforeCat = (n.category || '').trim()
      const beforeTags = JSON.stringify(n.okfTags || [])
      const h = noteClassify.heuristicClassify(n)
      if (noteClassify.needsCategory(n) && h.category) n.category = h.category
      if (noteClassify.needsTags(n) && h.okfTags.length) n.okfTags = h.okfTags

      if ((noteClassify.needsCategory(n) || noteClassify.needsTags(n)) && (n.content || '').trim().length >= 20) {
        try {
          const result = await chatCompletionOnce(s, [
            {
              role: 'system',
              content: '根据提示词内容，建议一个 category（英文小写单词，如 coding/writing/review）和 1-3 个 okfTags（英文小写）。只输出 JSON：{"category":"...","okfTags":["..."]}',
            },
            {
              role: 'user',
              content: `项目名：${n.project || '未命名'}\n路径：${n.promptGroup || ''}\n\n${String(n.content || '').slice(0, 1500)}`,
            },
          ], 120)
          if (result.text) {
            const m = result.text.match(/\{[\s\S]*\}/)
            const parsed = JSON.parse(m ? m[0] : result.text)
            if (noteClassify.needsCategory(n) && parsed.category) {
              n.category = String(parsed.category).slice(0, 32)
            }
            if (noteClassify.needsTags(n) && Array.isArray(parsed.okfTags) && parsed.okfTags.length) {
              n.okfTags = parsed.okfTags.map((t) => String(t).slice(0, 24)).slice(0, 5)
            }
          }
        } catch {
          failed++
        }
      }

      const changed =
        (n.category || '').trim() !== beforeCat || JSON.stringify(n.okfTags || []) !== beforeTags
      if (changed) {
        if (!Array.isArray(n.tags) || !n.tags.length) n.tags = [...(n.okfTags || [])]
        saveNote(n)
        updated++
        if (samples.length < 8) {
          samples.push({ id: n.id, project: n.project || '', category: n.category, okfTags: n.okfTags })
        }
      } else {
        skipped++
      }
    }
    refreshList()
    return {
      ok: true,
      mode,
      updated,
      skipped,
      failed,
      samples,
      message: `AI 整理完成：更新 ${updated}，跳过 ${skipped}，失败 ${failed}`,
    }
  })

  ipcMain.handle('suggest-classification', async (_e, { content, project }) => {
    const text = (content || '').trim()
    if (text.length < 20) return { ok: false, error: '内容太短，无法建议分类' }
    const s = loadSettings()
    if (!s.apiKey || !s.apiEndpoint) {
      return { ok: false, error: '未配置 API Key，请手动设置分类', local: true }
    }
    const result = await chatCompletionOnce(s, [
      {
        role: 'system',
        content: '根据提示词内容，建议一个 category（英文小写单词，如 coding/writing/review）和 1-3 个 okfTags（英文小写）。只输出 JSON：{"category":"...","okfTags":["..."]}',
      },
      { role: 'user', content: `项目名：${project || '未命名'}\n\n${text.slice(0, 1500)}` },
    ], 120)
    if (result.error || !result.text) {
      return { ok: false, error: result.error || '建议失败', local: true }
    }
    try {
      const m = result.text.match(/\{[\s\S]*\}/)
      const parsed = JSON.parse(m ? m[0] : result.text)
      return {
        ok: true,
        category: String(parsed.category || '').slice(0, 32),
        okfTags: Array.isArray(parsed.okfTags) ? parsed.okfTags.map(t => String(t).slice(0, 24)).slice(0, 5) : [],
      }
    } catch {
      return { ok: false, error: '无法解析 AI 返回', local: true }
    }
  })
}

module.exports = { registerNotesIpc }
