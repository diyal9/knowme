/**
 * feishu-cli — 飞书 lark-cli 连接器组合根；对外 require 路径不变。
 * 不负责：域内实现（见 feishu-cli/ 子模块）。
 */
'use strict'

const core = require('./feishu-cli/core')
const scopes = require('./feishu-cli/scopes')
const meetings = require('./feishu-cli/meetings')
const im = require('./feishu-cli/im')
const calendar = require('./feishu-cli/calendar')
const drive = require('./feishu-cli/drive')
const write = require('./feishu-cli/write')
const toolDefs = require('./feishu-cli/tool-defs')

module.exports = {
  READ_COMMANDS: core.READ_COMMANDS,
  WRITE_APPLY_COMMANDS: core.WRITE_APPLY_COMMANDS,
  isReadTool: core.isReadTool,
  isDraftTool: core.isDraftTool,
  isApplyTool: core.isApplyTool,
  buildReadArgs: core.buildReadArgs,
  runLarkCli: core.runLarkCli,
  sanitizeCliArgs: core.sanitizeCliArgs,
  executeFeishuRead: core.executeFeishuRead,
  executeMeetingCandidates: meetings.executeMeetingCandidates,
  executeMeetingRead: meetings.executeMeetingRead,
  executeRelatedChats: im.executeRelatedChats,
  executeTodayPriority: calendar.executeTodayPriority,
  executeDocKbSuggest: drive.executeDocKbSuggest,
  formatDocKbSuggest: drive.formatDocKbSuggest,
  extractMemoryKeywords: drive.extractMemoryKeywords,
  buildDriveSearchArgs: drive.buildDriveSearchArgs,
  buildDriveFilesListArgs: drive.buildDriveFilesListArgs,
  buildCalendarAgendaArgs: calendar.buildCalendarAgendaArgs,
  buildTaskMyTasksArgs: calendar.buildTaskMyTasksArgs,
  formatTodayPriority: calendar.formatTodayPriority,
  sanitizeImMessageText: im.sanitizeImMessageText,
  inferMentionTheme: im.inferMentionTheme,
  inferHandlingSuggestion: im.inferHandlingSuggestion,
  buildFeishuChatOpenUrl: im.buildFeishuChatOpenUrl,
  resolveCurrentUserIdentity: scopes.resolveCurrentUserIdentity,
  extractDocParticipants: meetings.extractDocParticipants,
  docContainsParticipant: meetings.docContainsParticipant,
  buildVcSearchArgs: meetings.buildVcSearchArgs,
  buildVcDetailArgs: meetings.buildVcDetailArgs,
  buildMinutesDetailArgs: meetings.buildMinutesDetailArgs,
  buildNoteDetailArgs: meetings.buildNoteDetailArgs,
  parseMeetingDisplayInfo: meetings.parseMeetingDisplayInfo,
  extractMinuteToken: meetings.extractMinuteToken,
  formatMinuteBodyForSummary: meetings.formatMinuteBodyForSummary,
  normalizeRelativeDateQuery: core.normalizeRelativeDateQuery,
  sanitizeCliQuery: core.sanitizeCliQuery,
  normalizeQueryArgForPlatform: core.normalizeQueryArgForPlatform,
  softenQueryForRetry: core.softenQueryForRetry,
  buildDraftWrite: write.buildDraftWrite,
  buildDraftMinutePermission: write.buildDraftMinutePermission,
  buildDraftSendMessage: write.buildDraftSendMessage,
  buildDraftCreateTask: write.buildDraftCreateTask,
  buildDraftUpdateDoc: write.buildDraftUpdateDoc,
  buildDraftCalendarEvent: write.buildDraftCalendarEvent,
  buildDraftDriveUpload: write.buildDraftDriveUpload,
  buildDraftWikiNode: write.buildDraftWikiNode,
  buildDraftBitableRecord: write.buildDraftBitableRecord,
  FEISHU_EXTENDED_DRAFT_BUILDERS: write.FEISHU_EXTENDED_DRAFT_BUILDERS,
  applyFeishuWrite: write.applyFeishuWrite,
  parseCliJsonOutput: core.parseCliJsonOutput,
  parseMissingScopeError: scopes.parseMissingScopeError,
  describeMissingScopes: scopes.describeMissingScopes,
  getGrantedUserScopes: scopes.getGrantedUserScopes,
  listFeishuUsers: write.listFeishuUsers,
  listFeishuChats: write.listFeishuChats,
  sendFeishuText: write.sendFeishuText,
  FEISHU_READ_TOOL_DEFS: toolDefs.FEISHU_READ_TOOL_DEFS,
  FEISHU_DRAFT_TOOL_DEFS: toolDefs.FEISHU_DRAFT_TOOL_DEFS,
  isTransientCliFailure: core.isTransientCliFailure,
  normalizeCliErrorMessage: core.normalizeCliErrorMessage,
  runLarkCliWithRetry: core.runLarkCliWithRetry,
}
