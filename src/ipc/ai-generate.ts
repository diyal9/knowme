'use strict'

/**
 * ai-generate IPC 壳：abort、stream、trace、失败收敛。
 * 生成编排在 executeAgentGenerate，本文件不组装工具/上下文。
 */

const { assertRequiredDeps } = require('../lib/ipc-assert-deps')
const { runAgentGenerate } = require('../lib/agent-generate-runner')
const { buildTemporalAnchorContext } = require('../lib/temporal-anchor')
const { mergeExtraTools } = require('../lib/merge-extra-tools')
const { normalizeAssistantOutput } = require('../lib/assistant-output-style')

// 保留 require，避免拆文件后主进程打包/依赖图漏边。
void buildTemporalAnchorContext
void mergeExtraTools
void normalizeAssistantOutput

/** 缺任一项则拒绝注册 IPC。 */
const AI_GENERATE_REQUIRED_DEPS = [
  'activeAgentRuns',
  'loadSettings',
  'saveSettings_',
  'ensureAgentSession',
  'saveAgentSessions',
  'loadAgentSessions',
  'buildFabricCtx',
  'ensureFabricSeeded',
  'ensureCapabilityHub',
  'ensureAgentTeamRuntime',
  'readNote',
  'buildEmbedFn',
  'normalizeChatEndpoint',
  'requestAgentCompletion',
  'buildMissingResourceHint',
  'getFeishuGroundingContext',
  'hasPriorFeishuFacts',
  'resolveActiveProvider',
  'KNOWLEDGE_DIR',
  'MEMORY_DIR',
  'agentRuntimePortFactories',
  'loadSourcesStore',
  'getActiveSourceRoot',
  'kosSourcesCtx',
  'workbenchDaemon',
  'buildActiveSourceFileTools',
  'agentRuntimeOutputBridges',
]

/** 注册 `ai-generate`；返回前必须从 activeAgentRuns 摘掉 AbortController。 */
function registerAiGenerateIpc(ipcMain, deps) {
  assertRequiredDeps(deps, AI_GENERATE_REQUIRED_DEPS, 'ai-generate')
  ipcMain.handle('ai-generate', async (e, payload = {}) => {
    const webContents = e.sender
    const controller = new AbortController()
    return runAgentGenerate(deps, payload, {
      controller,
      emit: event => {
        if (webContents.isDestroyed()) return
        webContents.send('ai-stream-event', event)
      },
    })
  })
}

module.exports = { registerAiGenerateIpc, AI_GENERATE_REQUIRED_DEPS }
