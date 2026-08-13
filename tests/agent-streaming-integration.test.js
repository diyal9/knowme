'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const { readMainIpcBundle } = require('./helpers/main-ipc-bundle')

describe('agent streaming tool timeline integration', () => {
  const root = path.join(__dirname, '..')
  const main = readMainIpcBundle()
  const preload = fs.readFileSync(path.join(root, 'src', 'preload.js'), 'utf8')
  const renderer = fs.readFileSync(path.join(root, 'src', 'workspace-agent.js'), 'utf8')
  const settings = fs.readFileSync(path.join(root, 'src', 'settings.html'), 'utf8')

  it('connects a run-scoped event channel across Electron boundaries', () => {
    assert.ok(main.includes("webContents.send('ai-stream-event'"), 'main emits structured events')
    assert.ok(preload.includes('onAiStreamEvent'), 'preload exposes event subscription')
    assert.ok(preload.includes("ipcRenderer.on('ai-stream-event'"), 'preload listens on the channel')
    assert.ok(renderer.includes('event.runId !== runId'), 'renderer scopes events to the active run')
  })

  it('updates streaming progress locally instead of rebuilding the chat log', () => {
    assert.match(renderer, /function refreshAssistantProgress\(index\)/, 'renderer has a local progress refresh path')
    assert.match(renderer, /data-execution-timeline="1"/, 'execution timeline has a stable local target')
    assert.match(renderer, /data-thinking-label/, 'thinking status has a stable local target')
    assert.match(renderer, /refreshAssistantProgress\(messageIdx\)\s*\n\s*return/, 'stage and tool events use the local path')
    assert.match(
      renderer,
      /chatHistory\.forEach\(\(msg, index\) => \{[\s\S]*?refreshAssistantProgress\(index\)[\s\S]*?updateComposerMeta\(\)/,
      'elapsed ticker avoids full chat rendering'
    )
  })

  it('uses bounded, tier-adaptive tool rounds and calls', () => {
    assert.ok(main.includes('llmUsage.adaptiveBudget(tier)'), 'rounds adapt to request tier')
    assert.ok(main.includes('let maxRounds = budget.maxRounds'), 'round budget derives from tier')
    assert.ok(main.includes('let maxToolCalls = budget.maxToolCalls'), 'tool budget derives from tier')
    assert.ok(main.includes('toolCallCount + calls.length > maxToolCalls'), 'budget is enforced before execution')
    assert.ok(main.includes('llmUsage.expandBudget'), 'plan-driven budget expansion is wired')
    assert.ok(main.includes('正在整理最终答复'), 'budget exhaustion converges to a final answer')
    assert.ok(main.includes('toolCallKey'), 'repeated tool calls are deduplicated')
  })

  it('grounds retrieval, file tools and real usage accounting', () => {
    assert.ok(main.includes("require('./lib/knowledge-rank')") || fs.readFileSync(path.join(root, 'src', 'lib', 'knowledge-os.js'), 'utf8').includes("require('./knowledge-rank')"), 'knowledge query uses hybrid ranking')
    assert.ok(main.includes('buildActiveSourceFileTools'), 'file tools bind to the active source')
    assert.ok(main.includes("require('./lib/agent-file-tools')"), 'main imports file tools')
    assert.ok(main.includes('extraTools'), 'file tools project into the connector surface')
    assert.ok(main.includes("require('./lib/llm-usage')"), 'main imports usage accounting')
    assert.ok(main.includes('llmUsage.accumulateUsage'), 'provider usage is accumulated per round')
    assert.ok(main.includes('reconcileUsage'), 'final metrics reconcile real vs estimated usage')
  })

  it('adds pluggable semantic rerank and cached grep index', () => {
    assert.ok(main.includes('buildEmbedFn'), 'main builds an optional embeddings function')
    assert.ok(main.includes('embed: embedFn'), 'retrieval passes an embed hook for rerank')
    assert.ok(main.includes('normalizeEmbeddingsEndpoint'), 'embeddings endpoint is derived from chat endpoint')
    assert.ok(main.includes('grepindex:'), 'grep uses a cached file index')
    assert.ok(main.includes('contextCache.readFileCached'), 'grep reads via the mtime file cache')
    assert.ok(main.includes('agentFileTools.grepFiles'), 'grep uses the pure grep helper')
  })

  it('adds a mtime-cached semantic_search tool over the active source', () => {
    assert.ok(main.includes("require('./lib/semantic-index')"), 'main imports the semantic index')
    assert.ok(main.includes('semanticIndexCache'), 'semantic index is cached per source root')
    assert.ok(main.includes('semanticIndex.buildEmbeddedIndex'), 'index is built from source chunks')
    assert.ok(main.includes('semantic_search'), 'semantic_search handler is projected')
    assert.ok(main.includes('const embedFn = buildEmbedFn(s)'), 'embed fn is built once per run')
    assert.ok(main.includes('buildActiveSourceFileTools(embedFn,'), 'semantic search is gated by embeddings')
    assert.ok(main.includes('embed.cacheKey'), 'semantic cache keys include endpoint/model profile')
  })

  it('adds P1 calibration and recent-file semantic weighting', () => {
    assert.ok(main.includes('llmUsage.calibrationKey'), 'calibration key is built per provider/model')
    assert.ok(main.includes('llmUsage.learnCalibration'), 'provider usage feeds online calibration')
    assert.ok(main.includes('llmUsage.applyCalibration'), 'runtime estimates apply calibrated factor')
    assert.ok(main.includes('buildRecentSourceFileWeights'), 'recent/active source files are weighted')
    assert.ok(main.includes('weight: recentWeights.get(n.path) || 1'), 'semantic chunks carry file weights')
    assert.ok(main.includes('llmUsage.importCalibrations'), 'calibration snapshot is loaded from settings')
    assert.ok(main.includes('llmUsage.exportCalibrations'), 'calibration snapshot is persisted')
  })

  it('adds semantic disk cache and retrieval observability', () => {
    assert.ok(main.includes('SEMANTIC_INDEX_CACHE_DIR'), 'semantic index disk cache dir exists')
    assert.ok(main.includes('loadSemanticIndexFromDisk'), 'semantic index can load from disk cache')
    assert.ok(main.includes('saveSemanticIndexToDisk'), 'semantic index can persist to disk cache')
    assert.ok(main.includes('semanticIndexBuildMs'), 'semantic build timing is tracked')
    assert.ok(main.includes('semanticQueryMs'), 'semantic query timing is tracked')
    assert.ok(main.includes('sectionUsage'), 'context info carries section allocations')
    assert.ok(!renderer.includes('来源配额'), 'composer no longer shows token quota breakdown text')
  })

  it('runs allowlisted tools in main and feeds role tool results back', () => {
    assert.ok(
      main.includes('toolSurface.getToolDefinitions()') || main.includes('agentTools.getToolDefinitions()'),
      'model receives allowlisted tool definitions'
    )
    assert.ok(main.includes('buildConnectorToolSurface'), 'connector/MCP tools project into Agent surface')
    assert.ok(main.includes('toolExecutor.executeToolCall'), 'main dispatches through safe executor')
    assert.match(main, /apiMessages\.push\(\{\s*role:\s*'tool'/, 'tool result continues model loop')
    assert.ok(main.includes("type: 'tool.started'"), 'started event emitted')
    assert.ok(main.includes("'tool.completed' : 'tool.failed'"), 'terminal tool event emitted')
  })

  it('falls back once when provider rejects tools', () => {
    assert.ok(main.includes('[400, 404, 422].includes(completion.status)'), 'explicit incompatibility statuses detected')
    assert.ok(main.includes('toolsEnabled = false'), 'tools disabled for fallback request')
    assert.ok(main.includes('当前模型不支持工具，已切换普通对话'), 'fallback remains visible')
  })

  it('does not expose raw provider reasoning in the UI', () => {
    assert.ok(main.includes('正在分析并规划回答'), 'generic analysis activity is shown')
    assert.ok(!renderer.includes('reasoning_content'), 'renderer never receives provider reasoning field')
    assert.ok(!renderer.includes('secret chain'), 'no raw reasoning fixture leaks into renderer')
  })

  it('routes Agent requests through model-aware context budgeting', () => {
    assert.ok(main.includes("require('./lib/llm-runtime')"), 'main imports LLM runtime')
    assert.ok(main.includes('getRequestPolicy'), 'main selects model-aware request policy')
    assert.ok(main.includes('getCacheControlPolicy'), 'main selects provider-aware cache control policy')
    assert.ok(main.includes('contextMessage: dynamicContext'), 'dynamic context is separated from stable base system')
    assert.ok(main.includes('fitSections'), 'dynamic context is budgeted by priority')
    assert.ok(main.includes('fitConversation'), 'messages are budgeted by whole turns before sending')
  })

  it('keeps today priority grounded only in the Feishu facts workflow', () => {
    assert.ok(main.includes('todayPriorityFactsOnly'), 'today priority has a facts-only context mode')
    assert.ok(main.includes('tier !== \'chat\' && !todayPriorityFactsOnly'), 'knowledge and memory context are excluded')
    assert.ok(main.includes('!todayPriorityFactsOnly && String(prompt || \'\').trim()'), 'generic retrieval is skipped')
  })

  it('supports cancellation, per-round rebudgeting and incremental stream data', () => {
    assert.ok(preload.includes('aiCancelRun'), 'preload exposes run cancellation')
    assert.ok(main.includes("ipcMain.handle('ai-cancel-run'"), 'main handles run cancellation')
    assert.ok(main.includes('new AbortController()'), 'each run owns an abort controller')
    assert.match(
      main,
      /if \(kernelResult\.cancelled\) \{[\s\S]*?cancelled: true,[\s\S]*?runId,[\s\S]*?\}/,
      'cancelled runs return an explicit IPC-safe projection',
    )
    assert.doesNotMatch(
      main,
      /if \(kernelResult\.cancelled\)[^{\n]*return \{\s*\.\.\.kernelResult/,
      'cancelled runs never expose internal executor ports over IPC',
    )
    assert.match(
      renderer,
      /if \(result\.cancelled\)[\s\S]*?settleCancelledAssistantText\(assistantRef\.message\)[\s\S]*?streaming = false/,
      'cancellation drops unstable content before rendering the stopped state',
    )
    assert.ok(renderer.includes("message.text = String(stable || '').trim() || '已停止生成'"), 'early cancellation remains readable')
    assert.ok(main.includes('applyCacheControlMessages'), 'cache-control tags are attached with provider gating')
    assert.ok(main.includes('tokensNow > policy.inputBudget'), 'tool rounds rebudget only when needed')
    assert.match(main, /onStreamChunk:\s*null/, 'kernel path avoids ai-stream-chunk dual emit')
    assert.ok(renderer.includes('event.version == null'), 'workspace ignores only legacy no-version events')
    assert.ok(renderer.includes('applyV2StreamEvent'), 'workspace maps v2 events through reducer')
  })

  it('wires provider model profiles to settings and the context meter', () => {
    const settingsIpc = fs.readFileSync(path.join(__dirname, '..', 'src', 'ipc', 'settings.js'), 'utf8')
    assert.ok(settings.includes('id="llmProvider"'), 'settings exposes provider selection')
    assert.ok(settings.includes('id="modelPreset"'), 'settings exposes model presets')
    assert.ok(settings.includes('llmProfile'), 'settings persists explicit profile')
    assert.ok(settingsIpc.includes("ipcMain.handle('llm-profile'"), 'settings ipc exposes public model profile')
    assert.ok(preload.includes('llmProfile'), 'preload exposes public model profile')
    assert.ok(renderer.includes('contextProfile'), 'renderer uses dynamic model capability')
  })

  it('adds a composer model picker and turn-compaction status', () => {
    const settingsIpc = fs.readFileSync(path.join(__dirname, '..', 'src', 'ipc', 'settings.js'), 'utf8')
    assert.ok(settingsIpc.includes("ipcMain.handle('llm-models'"), 'settings ipc lists the model catalog')
    assert.ok(settingsIpc.includes("ipcMain.handle('llm-set-model'"), 'settings ipc persists composer model switch')
    assert.ok(preload.includes('llmModels'), 'preload exposes model listing')
    assert.ok(preload.includes('llmSetModel'), 'preload exposes model switch')
    assert.ok(renderer.includes('pickModel'), 'renderer switches models from the composer')
    assert.ok(renderer.includes("aiModelMenu.classList.add('show')"), 'model menu uses show class')
    assert.ok(renderer.includes('toggleContextPanel'), 'renderer opens context usage panel')
    assert.ok(renderer.includes('lastContextInfo'), 'renderer tracks compaction context info')
    assert.ok(renderer.includes('renderModelUsage'), 'renderer shows the compaction status pill')
    assert.ok(renderer.includes('omittedTurns'), 'renderer surfaces omitted turn counts')
    assert.ok(renderer.includes('aiModelUsage.hidden = !compacted'), 'model button hides routine token usage')
    assert.ok(renderer.includes("aiModelUsage.textContent = compacted ? '已压缩' : ''"), 'only compaction status is shown')
    assert.ok(renderer.includes('localContextTokens = tokens'), 'renderer keeps the current local token estimate')
    assert.ok(renderer.includes('formatTokenCount(modelLimit)'), 'model menu item shows max token limit')
    assert.ok(renderer.includes('Context Usage'), 'model menu renders context usage side panel')
    assert.ok(main.includes('contextInfo'), 'main emits context compaction info')
    assert.ok(main.includes('omittedTurns'), 'main reports omitted turns')
  })
})
