'use strict'

/**
 * Renderer entry mode. Default is Vite/React.
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {'legacy'|'vite'}
 */
function getRendererMode(env = process.env) {
  const raw = String(env.KNOWME_RENDERER || 'vite').trim().toLowerCase()
  return raw === 'legacy' ? 'legacy' : 'vite'
}

module.exports = { getRendererMode }
