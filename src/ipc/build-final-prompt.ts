'use strict'

const promptRouter = require('../lib/assistant-prompt-router')
const chatIntent = require('../lib/chat-intent')
const productKnowledge = require('../lib/product-knowledge')
const contextEngine = require('../lib/context-engine')
const { buildCoreContextBlocks } = require('../lib/knowme-system-prompt')
const { buildChatMessages } = require('../lib/ai-assistant-context')

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
    const locale = s.locale || 'zh-CN'
    const promptLayerPolicy = contextEngine.resolvePromptLayerPolicy({
      personalSession: true,
      tier: previewTier,
    })
    const userPrompt = promptRouter.buildUserPrompt(s, promptMode, {
      locale,
      includeUserPrompt: promptLayerPolicy.includeUserPrompt,
      includeWorkProfile: promptLayerPolicy.includeWorkProfile,
      agentPersonaScope: promptLayerPolicy.agentPersonaScope,
    })
    const skillPrompt = promptRouter.buildSkillPrompt(slashRefs, { locale })
    const policy = contextEngine.resolveContextPolicy({
      tier: previewTier,
      scene,
      locale,
      toolsEnabled: false,
      executionPolicy: 'no-tools',
    })
    const assembled = contextEngine.assembleContext({
      policy,
      blocks: [
        ...buildCoreContextBlocks({ tier: previewTier, toolsEnabled: false, locale }),
        {
          id: `scene.${scene}`,
          kind: 'scene_instruction',
          content: promptRouter.buildScenePrompt({ scene, mode: promptMode, locale }),
          sourceTrust: 'bundled',
          source: { type: 'assistant-prompt-router', id: scene, version: '2' },
        },
        userPrompt ? {
          id: 'preference.user-preview',
          kind: 'user_preference',
          content: userPrompt,
          sourceTrust: 'user',
          source: { type: 'settings', id: 'prompt-preview' },
        } : null,
        skillPrompt ? {
          id: 'skill.explicit-preview',
          kind: 'skill',
          explicit: true,
          content: [skillPrompt, skillCtx].filter(Boolean).join('\n\n'),
          sourceTrust: 'user',
          source: { type: 'skill-router', id: slashRefs.join(',') },
        } : null,
        kbSnippet ? {
          id: 'retrieval.preview',
          kind: 'retrieval',
          trust: 'untrusted',
          content: kbSnippet,
          sourceTrust: 'external',
          source: { type: 'knowledge-preview', id: 'active' },
        } : null,
      ].filter(Boolean),
      query: previewPrompt,
      budget: 8000,
    })
    const systemMessages = assembled.messages.filter(message => message.role === 'system')
    const dataMessages = assembled.messages.filter(message => message.role === 'user')
    const systemContent = systemMessages.map(message => message.content).join('\n\n')
    const messages = buildChatMessages({
      systemMessages, dataMessages, history: [],
      prompt: payload.prompt || '（此处为你稍后要发给助手的对话需求）',
      noteContext: content,
    })
    return { ok: true, systemContent, messages, skillRefs: slashRefs, contextManifest: assembled.manifest }
  })
}

module.exports = { registerBuildFinalPromptIpc }
