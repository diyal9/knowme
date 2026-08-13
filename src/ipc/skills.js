'use strict'

/**
 * Skill picker IPC: list-skills + create-skill.
 */
function registerSkillsIpc(ipcMain, deps) {
  const {
    productKnowledge,
    KNOWLEDGE_DIR,
    ensureCapabilityHub,
    contextCache,
  } = deps

  ipcMain.handle('list-skills', () => {
    try {
      const legacy = productKnowledge.listSkills(KNOWLEDGE_DIR)
      const hub = ensureCapabilityHub()
      const stdItems = hub.skillRuntime().listSlashPickerItems({ includeLegacy: true })
      const bySlash = new Map()
      for (const item of stdItems) {
        const slash = String(item.slash || item.id || '').trim()
        if (!slash) continue
        bySlash.set(slash, {
          id: item.id,
          title: item.name || item.id,
          slash,
          description: item.description || '',
          source: item.source,
          legacy: item.legacy === true,
        })
      }
      for (const item of legacy) {
        const slash = String(item.slash || '').trim()
        if (!slash || bySlash.has(slash)) continue
        bySlash.set(slash, item)
      }
      return { ok: true, skills: [...bySlash.values()] }
    } catch (e) {
      return { ok: false, error: e.message || String(e), skills: [] }
    }
  })

  ipcMain.handle('create-skill', (_e, payload = {}) => {
    try {
      const result = productKnowledge.createSkill(KNOWLEDGE_DIR, payload)
      if (result?.ok) {
        contextCache.invalidate('skill:')
        contextCache.invalidate('kb:')
      }
      return result
    } catch (e) {
      return { ok: false, error: e.message || String(e) }
    }
  })
}

module.exports = { registerSkillsIpc }
