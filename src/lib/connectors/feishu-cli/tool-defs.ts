/**
 * feishu-cli/tool-defs — 飞书连接器 OpenAI function tool 静态定义。
 * 不负责：运行时执行（见 core / 各工作流模块）。
 */
'use strict'

const FEISHU_READ_TOOL_DEFS = [
  {
    type: 'function',
    function: {
      name: 'feishu.meeting_candidates',
      description: 'Deterministic Feishu meeting workflow: list meetings the authorized user attended in the recent 3 natural days via vc +search (already identity-scoped), then hydrate each via vc +detail to get topic/time/minute_token. Returns candidates only; does not summarize bodies.',
      parameters: {
        type: 'object',
        properties: { days: { type: 'number', minimum: 1, maximum: 30 } },
        additionalProperties: false,
      },
    },
    _knowme: { source: 'feishu', tier: 'L1', requiresApproval: false },
  },
  {
    type: 'function',
    function: {
      name: 'feishu.meeting_read',
      description: 'Deterministic Feishu meeting workflow: read a selected meeting candidate body. Prefer minute_token (from meeting_candidates) to read the Smart Minutes summary/todo/chapter via minutes +detail; falls back to a docx token/url. Returns the body only if it contains meeting evidence.',
      parameters: {
        type: 'object',
        properties: {
          minute_token: { type: 'string' },
          doc_token: { type: 'string' },
          url: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
    _knowme: { source: 'feishu', tier: 'L1', requiresApproval: false },
  },
  {
    type: 'function',
    function: {
      name: 'feishu.related_chats',
      description: 'Deterministic Feishu IM workflow: summarize chats related to the authorized user for recent natural days (default 1 = today). Uses im +messages-search --is-at-me for @mentions, plus im +chat-list --types p2p,group --sort active_time for personal/group chat topics. Returns a readable digest; does not send messages or read docs.',
      parameters: {
        type: 'object',
        properties: { days: { type: 'number', minimum: 1, maximum: 30 } },
        additionalProperties: false,
      },
    },
    _knowme: { source: 'feishu', tier: 'L1', requiresApproval: false },
  },
  {
    type: 'function',
    function: {
      name: 'feishu.today_priority',
      description: 'Deterministic Feishu workflow for today priorities: pull today calendar agenda (calendar +agenda), incomplete tasks (task +get-my-tasks --complete=false), and optional today @me mentions as blocker signals. Returns a grounded fact digest so the agent can output Top-3 actions without asking three clarifying questions first. Read-only; does not create/update tasks or send messages.',
      parameters: {
        type: 'object',
        properties: {
          include_mentions: {
            type: 'boolean',
            description: 'Include today @me messages as blocker signals (default true). IM failure does not fail the whole workflow.',
          },
        },
        additionalProperties: false,
      },
    },
    _knowme: { source: 'feishu', tier: 'L1', requiresApproval: false },
  },
  {
    type: 'function',
    function: {
      name: 'feishu.doc_kb_suggest',
      description: 'Deterministic Feishu docs/knowledge workflow: list personal Drive root folders, visible wiki spaces, then suggest up to 5 possibly-needed docs (from local product memory keywords), 5 recently edited-by-me docs, and 5 recently opened-by-me docs. Returns a readable digest only; does not read document bodies.',
      parameters: {
        type: 'object',
        properties: {
          days: {
            type: 'number',
            minimum: 1,
            maximum: 90,
            description: 'Lookback window in days for edited/opened filters (default 30).',
          },
        },
        additionalProperties: false,
      },
    },
    _knowme: { source: 'feishu', tier: 'L1', requiresApproval: false },
  },
  {
    type: 'function',
    function: {
      name: 'feishu.search_docs',
      description: 'Search Feishu docs and wiki knowledge base by query (read-only).',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query'],
        additionalProperties: false,
      },
    },
    _knowme: { source: 'feishu', tier: 'L1', requiresApproval: false },
  },
  {
    type: 'function',
    function: {
      name: 'feishu.read_doc',
      description: 'Fetch a Feishu document by token or URL (read-only).',
      parameters: {
        type: 'object',
        properties: {
          doc_token: { type: 'string' },
          url: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
    _knowme: { source: 'feishu', tier: 'L1', requiresApproval: false },
  },
  {
    type: 'function',
    function: {
      name: 'feishu.query_bitable',
      description: 'Query Feishu Base / bitable data (read-only).',
      parameters: {
        type: 'object',
        properties: {
          app_token: { type: 'string' },
          table_id: { type: 'string' },
          data: { type: 'object' },
          filter: { type: 'string' },
          limit: { type: 'number' },
        },
        additionalProperties: false,
      },
    },
    _knowme: { source: 'feishu', tier: 'L1', requiresApproval: false },
  },
  {
    type: 'function',
    function: {
      name: 'feishu.list_wiki_spaces',
      description: 'List Feishu knowledge base spaces (read-only, user identity).',
      parameters: {
        type: 'object',
        properties: { page_all: { type: 'boolean' } },
        additionalProperties: false,
      },
    },
    _knowme: { source: 'feishu', tier: 'L1', requiresApproval: false },
  },
  {
    type: 'function',
    function: {
      name: 'feishu.list_wiki_nodes',
      description: 'List nodes in a Feishu knowledge base space (read-only).',
      parameters: {
        type: 'object',
        properties: {
          space_id: { type: 'string' },
          parent_node_token: { type: 'string' },
          page_all: { type: 'boolean' },
        },
        required: ['space_id'],
        additionalProperties: false,
      },
    },
    _knowme: { source: 'feishu', tier: 'L1', requiresApproval: false },
  },
  {
    type: 'function',
    function: {
      name: 'feishu.get_wiki_node',
      description: 'Get a Feishu knowledge base node by token or URL (read-only).',
      parameters: {
        type: 'object',
        properties: {
          node_token: { type: 'string' },
          url: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
    _knowme: { source: 'feishu', tier: 'L1', requiresApproval: false },
  },
]

const FEISHU_DRAFT_TOOL_DEFS = [
  {
    type: 'function',
    function: {
      name: 'feishu.draft_write_doc',
      description: 'Create an in-app draft for a Feishu doc. Does NOT write to Feishu until user approves.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          body: { type: 'string' },
        },
        required: ['body'],
        additionalProperties: false,
      },
    },
    _knowme: { source: 'feishu', tier: 'L2', requiresApproval: false },
  },
  {
    type: 'function',
    function: {
      name: 'feishu.draft_minute_permission',
      description: 'Create an in-app draft that asks the Smart Minutes owner for read (or edit) access. Use it when meeting_read fails with a per-minute ACL error. Does NOT contact Feishu until the user approves.',
      parameters: {
        type: 'object',
        properties: {
          minute_token: { type: 'string' },
          url: { type: 'string' },
          perm: { type: 'string', enum: ['view', 'edit'] },
        },
        additionalProperties: false,
      },
    },
    _knowme: { source: 'feishu', tier: 'L2', requiresApproval: false },
  },
  {
    type: 'function',
    function: {
      name: 'feishu.draft_send_message',
      description: 'Draft an IM message. Does NOT send until user approves.',
      parameters: {
        type: 'object',
        properties: { chat_id: { type: 'string' }, text: { type: 'string' }, idempotencyKey: { type: 'string' } },
        required: ['text'],
        additionalProperties: false,
      },
    },
    _knowme: { source: 'feishu', tier: 'L2', requiresApproval: true },
  },
  {
    type: 'function',
    function: {
      name: 'feishu.draft_create_task',
      description: 'Draft a Feishu task creation. Does NOT create until user approves.',
      parameters: {
        type: 'object',
        properties: { title: { type: 'string' }, description: { type: 'string' }, idempotencyKey: { type: 'string' } },
        required: ['title'],
        additionalProperties: false,
      },
    },
    _knowme: { source: 'feishu', tier: 'L2', requiresApproval: true },
  },
  {
    type: 'function',
    function: {
      name: 'feishu.draft_update_doc',
      description: 'Draft a doc update/append. Does NOT write until user approves.',
      parameters: {
        type: 'object',
        properties: { doc_token: { type: 'string' }, body: { type: 'string' }, idempotencyKey: { type: 'string' } },
        required: ['doc_token', 'body'],
        additionalProperties: false,
      },
    },
    _knowme: { source: 'feishu', tier: 'L2', requiresApproval: true },
  },
  {
    type: 'function',
    function: {
      name: 'feishu.draft_calendar_event',
      description: 'Draft a calendar event. Does NOT create until user approves.',
      parameters: {
        type: 'object',
        properties: { title: { type: 'string' }, start: { type: 'string' }, end: { type: 'string' } },
        required: ['title'],
        additionalProperties: false,
      },
    },
    _knowme: { source: 'feishu', tier: 'L2', requiresApproval: true },
  },
  {
    type: 'function',
    function: {
      name: 'feishu.draft_drive_upload',
      description: 'Draft a drive upload/move. Does NOT upload until user approves.',
      parameters: {
        type: 'object',
        properties: { file_path: { type: 'string' }, folder: { type: 'string' } },
        required: ['file_path'],
        additionalProperties: false,
      },
    },
    _knowme: { source: 'feishu', tier: 'L2', requiresApproval: true },
  },
  {
    type: 'function',
    function: {
      name: 'feishu.draft_wiki_node',
      description: 'Draft wiki node create/move. Does NOT write until user approves.',
      parameters: {
        type: 'object',
        properties: { space_id: { type: 'string' }, title: { type: 'string' }, parent: { type: 'string' } },
        required: ['space_id', 'title'],
        additionalProperties: false,
      },
    },
    _knowme: { source: 'feishu', tier: 'L2', requiresApproval: true },
  },
  {
    type: 'function',
    function: {
      name: 'feishu.draft_bitable_record',
      description: 'Draft bitable record create/update/delete. Does NOT write until user approves.',
      parameters: {
        type: 'object',
        properties: { app_token: { type: 'string' }, table_id: { type: 'string' }, fields: { type: 'object' } },
        required: ['app_token', 'table_id'],
        additionalProperties: false,
      },
    },
    _knowme: { source: 'feishu', tier: 'L2', requiresApproval: true },
  },
]

module.exports = {
  FEISHU_READ_TOOL_DEFS,
  FEISHU_DRAFT_TOOL_DEFS,
}
