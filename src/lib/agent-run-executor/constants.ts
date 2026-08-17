'use strict'

/** Agent run 恢复轮次、工具超时与编排类工具名匹配规则。 */

const MAX_RECOVERY_ROUNDS = 2
const TOOL_EXEC_TIMEOUT_MS = 45000
const ORCHESTRATION_TOOL_PATTERN = /^(delegate_to_expert|spawn_sub_run|await_sub_run|get_sub_run_status|cancel_sub_run|send_run_message|handoff_artifact)$/

module.exports = {
  MAX_RECOVERY_ROUNDS,
  TOOL_EXEC_TIMEOUT_MS,
  ORCHESTRATION_TOOL_PATTERN,
}
