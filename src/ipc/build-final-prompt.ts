'use strict'

const promptRouter = require('../lib/assistant-prompt-router')
const chatIntent = require('../lib/chat-intent')
const productKnowledge = require('../lib/product-knowledge')
const { buildSystemContent, buildChatMessages } = require('../lib/ai-assistant-context')

/**
 * Preview final chat prompt assembly IPC.
 */
function registerBuildFinalPromptIpc(ipcMain, deps) {
  const { loadSettings, readNote, KNOWLEDGE_DIR } = deps

  ipcMain.handle('build-final-prompt', (_e, payload = {}) => {
    const s = loadSettings()
    const promptMode = promptRouter.normalizeMode(payload.role || payload.agentId || 'general')
    const content = payload.content != null ? String(payload.content) : (readNote(payload.noteId)?.content || '')
    const theme = String(payload.category || '').trim()
    const slashRefs = productKnowledge.parseSlashTokens(content)
    const previewPrompt = String(payload.prompt || '')
    const previewTier = chatIntent.classifyIntent({
      prompt: previewPrompt,
      hasNoteContext: !!content.trim(),
      slashRefs,
      role: promptMode,
    })
    const scene = promptRouter.resolveScene({
      mode: promptMode,
      tier: previewTier,
      role: promptMode,
      hasNoteContext: !!content.trim(),
      industry: s.industry,
      prompt: previewPrompt,
    })
    const kbSnippet = productKnowledge.getContextSnippet(KNOWLEDGE_DIR)
    const skillCtx = productKnowledge.getSkillContext(KNOWLEDGE_DIR, { category: theme, slashRefs })
    const dynamic = [kbSnippet, skillCtx].filter(Boolean).join('\n\n')
    const systemContent = buildSystemContent({
      scenePrompt: promptRouter.buildScenePrompt({ scene, mode: promptMode }),
      userPrompt: promptRouter.buildUserPrompt(s, promptMode),
      skillPrompt: promptRouter.buildSkillPrompt(slashRefs),
      dynamicContext: dynamic,
    })
    const messages = buildChatMessages({
      systemContent, history: [],
      prompt: payload.prompt || '（此处为你稍后要发给助手的对话需求）',
      noteContext: content,
    })
    return { ok: true, systemContent, messages, skillRefs: slashRefs }
  })
}

module.exports = { registerBuildFinalPromptIpc }
