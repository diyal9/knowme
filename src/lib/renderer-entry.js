'use strict'

/**
 * Resolve KNOWME_RENDERER mode for Electron BrowserWindow loading.
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {'legacy'|'vite'}
 */
function getRendererMode(env = process.env) {
  const raw = String(env.KNOWME_RENDERER || 'legacy').trim().toLowerCase()
  return raw === 'vite' ? 'vite' : 'legacy'
}

module.exports = { getRendererMode }
