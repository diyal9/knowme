'use strict'

const path = require('path')

/**
 * Product OKF knowledge bundle IPC (status / CRUD / import-export).
 * Does not include knowledge-os / steward / provider (separate domains).
 */
function registerProductKnowledgeIpc(ipcMain, deps) {
  const {
    shell,
    app,
    path: pathMod = path,
    KNOWLEDGE_DIR,
    productKnowledge,
    contextCache,
    showOpenDialogFor,
  } = deps

  ipcMain.handle('knowledge-status', () => {
    const lint = productKnowledge.lint(KNOWLEDGE_DIR)
    const categories = productKnowledge.listCategories(KNOWLEDGE_DIR)
    return {
      path: KNOWLEDGE_DIR,
      concepts: lint.concepts,
      ok: lint.ok,
      errors: lint.errors.length,
      categories,
      items: productKnowledge.listConcepts(KNOWLEDGE_DIR, 100),
    }
  })

  ipcMain.handle('knowledge-read-concept', (_e, conceptId) => {
    const c = productKnowledge.readConcept(KNOWLEDGE_DIR, conceptId)
    if (!c) return { ok: false, error: '概念不存在' }
    return {
      ok: true,
      title: c.title,
      type: c.type,
      body: c.body,
      rel: c.rel,
      frontmatter: c.frontmatter || {},
    }
  })

  ipcMain.handle('knowledge-write-concept', (_e, payload = {}) => {
    const id = payload.id || payload.conceptId
    if (!id) return { ok: false, error: '缺少概念 id' }
    const title = payload.title
    const body = payload.body
    if (body == null) return { ok: false, error: '缺少正文' }
    const res = productKnowledge.writeConcept(KNOWLEDGE_DIR, {
      id,
      title,
      body,
      frontmatter: payload.frontmatter || {},
    })
    contextCache.invalidate('skill:')
    contextCache.invalidate('kb:')
    return res
  })

  ipcMain.handle('knowledge-export', async (e, opts = {}) => {
    const { canceled, filePaths } = await showOpenDialogFor(e.sender, {
      title: '选择导出目标文件夹',
      defaultPath: app.getPath('documents'),
      properties: ['openDirectory', 'createDirectory'],
    })
    if (canceled || !filePaths?.length) return { ok: false, canceled: true }
    const stamp = new Date().toISOString().slice(0, 10)
    const partial = Array.isArray(opts.categories) && opts.categories.length
    const destName = partial
      ? `knowme-knowledge-${opts.categories.join('-')}-${stamp}`
      : `knowme-knowledge-${stamp}`
    const dest = pathMod.join(filePaths[0], destName.slice(0, 80))
    const result = productKnowledge.exportBundle(KNOWLEDGE_DIR, dest, {
      categories: opts.categories,
    })
    if (result.ok) shell.showItemInFolder(dest)
    return result
  })

  ipcMain.handle('knowledge-import', async (e) => {
    const { canceled, filePaths } = await showOpenDialogFor(e.sender, {
      title: '选择要导入的 OKF 知识包文件夹',
      properties: ['openDirectory'],
    })
    if (canceled || !filePaths?.length) return { ok: false, canceled: true }
    const result = productKnowledge.importBundle(KNOWLEDGE_DIR, filePaths[0])
    if (!result.ok) {
      const lintErr = result.lint?.errors
      const first = Array.isArray(lintErr) && lintErr[0]
        ? (lintErr[0].message || lintErr[0])
        : null
      result.error = first || result.error || '知识包校验失败，请确认文件夹含 index.md 与概念文件'
    } else {
      contextCache.invalidate('skill:')
      contextCache.invalidate('kb:')
      contextCache.invalidate('mem:')
    }
    return result
  })

  ipcMain.on('open-knowledge-dir', () => shell.openPath(KNOWLEDGE_DIR))
}

module.exports = { registerProductKnowledgeIpc }
