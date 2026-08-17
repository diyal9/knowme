'use strict'

/**
 * agent-tools — 受限工具定义、参数校验、结果格式化与 allowlist 分发。
 *
 * 内置 search_knowledge；可通过 createToolSurface({ extraDefinitions, handlers })
 * 投影 Connector / MCP 工具。
 */

let logger = null
try { logger = require('./logger') } catch { /* logger optional */ }

const MAX_TOOL_RESULT_CHARS = 24000
const MAX_UI_PREVIEW_CHARS = 1200
const TRUNCATION_SUFFIX = '\n\n[结果已截断]'

// 投影预算需容纳完整 v1 内建工具面 + 已启用连接器工具；超限时按优先级裁剪并告警。
const EXTRA_TOOL_BUDGET = 64

// 预算不足时最先让位的工具：多 Agent 编排与子 Run 管理，单轮对话极少用到。
const DEFERRABLE_TOOLS = new Set([
  'delegate_to_expert',
  'spawn_sub_run',
  'await_sub_run',
  'get_sub_run_status',
  'cancel_sub_run',
  'send_run_message',
  'handoff_artifact',
])

const CONNECTOR_SOURCES = new Set(['feishu', 'mcp', 'connector', 'skill'])

const FABRIC_SEARCH_TOOL = {
  type: 'function',
  function: {
    name: 'fabric_search',
    description: 'Root-first Knowledge Fabric search: queries the root graph, routes to mounted libraries, merges results with authority weighting.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Non-empty search query.' },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  _knowme: {
    source: 'builtin',
    capability: 'knowledge-search',
    risk: 'read',
    sideEffects: false,
    requiresApproval: false,
    scope: 'content-source',
    timeoutMs: 30000,
    research: { kind: 'knowledge-search', scope: 'knowledge', label: '知识织网检索' },
  },
}

const KB_QUERY_TOOL = {
  type: 'function',
  function: {
    name: 'kb_query',
    description: 'Query a specific knowledge library collection by id.',
    parameters: {
      type: 'object',
      properties: {
        collection: { type: 'string', description: 'KB id or qmd collection id.' },
        query: { type: 'string', description: 'Search query.' },
      },
      required: ['collection', 'query'],
      additionalProperties: false,
    },
  },
  _knowme: { source: 'builtin', capability: 'knowledge-search', risk: 'read', sideEffects: false },
}

const KB_GET_TOOL = {
  type: 'function',
  function: {
    name: 'kb_get',
    description: 'Fetch full text for a knowledge anchor/ref.',
    parameters: {
      type: 'object',
      properties: {
        ref: { type: 'string', description: 'Anchor id, path, or external ref.' },
      },
      required: ['ref'],
      additionalProperties: false,
    },
  },
  _knowme: { source: 'builtin', capability: 'knowledge-search', risk: 'read', sideEffects: false },
}

const SEARCH_KNOWLEDGE_TOOL = {
  type: 'function',
  function: {
    name: 'search_knowledge',
    description: 'Search the active knowledge base (Fabric-aware root-first retrieval). Prefer when you need factual context from the user knowledge library.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Non-empty search query describing what to look up.',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  _knowme: {
    source: 'builtin',
    capability: 'knowledge-search',
    risk: 'read',
    sideEffects: false,
    requiresApproval: false,
    scope: 'content-source',
    timeoutMs: 30000,
    idempotencySupported: false,
    rollbackSupported: false,
    research: {
      kind: 'knowledge-search',
      scope: 'knowledge',
      label: '当前知识库检索',
    },
  },
}

const ALLOWED_TOOL_NAMES = new Set(['search_knowledge', 'fabric_search', 'kb_query', 'kb_get'])

const { parseToolArguments, truncateText, formatSearchHits, formatProviderResult, formatToolError, summarizeToolArgs, extraToolPriority, normalizeExtraDefinitions } = require('./agent-tools-format')

const { createToolSurface } = require('./agent-tools-surface')

const defaultSurface = createToolSurface({
  SEARCH_KNOWLEDGE_TOOL,
  FABRIC_SEARCH_TOOL,
  KB_QUERY_TOOL,
  KB_GET_TOOL,
  MAX_TOOL_RESULT_CHARS,
})

function getToolDefinitions() {
  return defaultSurface.getToolDefinitions()
}

function isAllowedTool(name) {
  return defaultSurface.isAllowedTool(name)
}

function validateToolCall(name, rawArgs) {
  return defaultSurface.validateToolCall(name, rawArgs)
}

function createToolExecutor(deps = {}) {
  return defaultSurface.createToolExecutor(deps)
}

async function dispatchToolCall(toolCall, deps = {}) {
  const { executeToolCall } = createToolExecutor(deps)
  return executeToolCall(toolCall)
}

module.exports = {
  SEARCH_KNOWLEDGE_TOOL,
  ALLOWED_TOOL_NAMES,
  MAX_TOOL_RESULT_CHARS,
  MAX_UI_PREVIEW_CHARS,
  TRUNCATION_SUFFIX,
  getToolDefinitions,
  isAllowedTool,
  validateToolCall,
  parseToolArguments,
  truncateText,
  formatSearchHits,
  formatProviderResult,
  formatToolError,
  summarizeToolArgs,
  createToolExecutor,
  dispatchToolCall,
  createToolSurface,
  normalizeExtraDefinitions,
  EXTRA_TOOL_BUDGET,
  DEFERRABLE_TOOLS,
}
