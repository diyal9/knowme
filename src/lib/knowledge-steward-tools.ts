'use strict'

const knowledgeOs = require('./knowledge-os')
const knowledgeStewardStore = require('./knowledge-steward-store')

const KNOWLEDGE_STEWARD_TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'knowledge_list',
      description: '读取当前 LLM Wiki 条目和正式知识摘要，只读，不修改磁盘。',
      parameters: { type: 'object', properties: {} },
    },
    _knowme: { permission: 'knowledge.read', risk: 'read' },
  },
  {
    type: 'function',
    function: {
      name: 'knowledge_propose',
      description: '根据指定 Wiki 条目生成可审核的整理提案，不写入正式知识。',
      parameters: {
        type: 'object',
        properties: {
          paths: { type: 'array', items: { type: 'string' }, description: 'Wiki 相对路径列表' },
        },
        required: ['paths'],
      },
    },
    _knowme: { permission: 'knowledge.propose', risk: 'proposal' },
  },
  {
    type: 'function',
    function: {
      name: 'knowledge_review',
      description: '读取待审核知识提案，返回来源、目标和状态。',
      parameters: { type: 'object', properties: {} },
    },
    _knowme: { permission: 'knowledge.review', risk: 'read' },
  },
  {
    type: 'function',
    function: {
      name: 'knowledge_commit',
      description: '请求提交已审核知识提案；此工具只返回确认请求，必须由用户在审核区确认写入。',
      parameters: { type: 'object', properties: { proposalId: { type: 'string' } }, required: ['proposalId'] },
    },
    _knowme: { permission: 'knowledge.write', risk: 'write', requiresConfirmation: true },
  },
]

function buildKnowledgeStewardTools({ userData, sources } = {}) {
  return {
    definitions: KNOWLEDGE_STEWARD_TOOL_DEFINITIONS,
    handlers: {
      knowledge_list: async () => ({
        ok: true,
        ...knowledgeOs.listEntries(userData, { sources: Array.isArray(sources) ? sources : [] }),
      }),
      knowledge_propose: async args => {
        const paths = Array.isArray(args?.paths) ? args.paths : []
        if (!paths.length) return { ok: false, error: '必须明确指定 Wiki 条目路径' }
        const result = knowledgeOs.promoteToOkfDrafts(userData, { wikiPaths: paths }, { sources })
        return { ...result, permission: 'knowledge.propose', message: '提案已生成，等待用户在知识审核区确认' }
      },
      knowledge_review: async () => ({
        ok: true,
        proposals: knowledgeStewardStore.listProposals(userData).filter(item => item.status === 'draft'),
        permission: 'knowledge.review',
      }),
      knowledge_commit: async args => ({
        ok: false,
        code: 'confirmation_required',
        proposalId: String(args?.proposalId || ''),
        permission: 'knowledge.write',
        message: '写入必须由用户在知识审核区显式确认，Agent 不可直接提交。',
      }),
    },
  }
}

module.exports = {
  KNOWLEDGE_STEWARD_TOOL_DEFINITIONS,
  buildKnowledgeStewardTools,
}
