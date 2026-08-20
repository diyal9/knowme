'use strict'

/**
 * Agent 完成协议的唯一规范化与验收入口。
 * UI、Launcher、远程后端都只能提交事实；是否完成由这里判定。
 */

function strings(values, max = 64) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map(value => String(value || '').trim())
    .filter(Boolean))].slice(0, max)
}

function objects(values, max = 32) {
  return (Array.isArray(values) ? values : [])
    .filter(value => value && typeof value === 'object')
    .slice(0, max)
    .map(value => ({ ...value }))
}

function normalizeExecutionContract(raw = {}) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const minArtifacts = Math.max(0, Math.min(32, Math.floor(Number(
    source.minArtifacts ?? source.minimumArtifacts ?? 0,
  ) || 0)))
  return {
    requiredTools: strings(source.requiredTools),
    requiredEvidence: objects(source.requiredEvidence),
    completionConditions: objects(source.completionConditions),
    requiredArtifacts: objects(source.requiredArtifacts),
    minArtifacts,
  }
}

function mergeExecutionContracts(sources = []) {
  const normalized = (Array.isArray(sources) ? sources : [sources])
    .map(normalizeExecutionContract)
  return {
    requiredTools: strings(normalized.flatMap(item => item.requiredTools)),
    requiredEvidence: normalized.flatMap(item => item.requiredEvidence).slice(0, 32),
    completionConditions: normalized.flatMap(item => item.completionConditions).slice(0, 32),
    requiredArtifacts: normalized.flatMap(item => item.requiredArtifacts).slice(0, 32),
    minArtifacts: Math.max(0, ...normalized.map(item => item.minArtifacts)),
  }
}

function hasRules(contract) {
  const value = normalizeExecutionContract(contract)
  return Boolean(value.requiredTools.length
    || value.requiredEvidence.length
    || value.completionConditions.length
    || value.requiredArtifacts.length
    || value.minArtifacts)
}

function successfulToolCalls(result = {}) {
  const executionEvidence = result.executionEvidence && typeof result.executionEvidence === 'object'
    ? result.executionEvidence
    : result
  return (Array.isArray(executionEvidence.toolCalls) ? executionEvidence.toolCalls : [])
    .filter(call => call?.status === 'ok')
}

function evidenceEntries(result = {}) {
  const executionEvidence = result.executionEvidence && typeof result.executionEvidence === 'object'
    ? result.executionEvidence
    : result
  return Array.isArray(executionEvidence.evidence) ? executionEvidence.evidence : []
}

function artifactEntries(result = {}) {
  const values = [
    ...(Array.isArray(result.artifactRefs) ? result.artifactRefs : []),
    ...(Array.isArray(result.artifacts) ? result.artifacts : []),
  ]
  const seen = new Set()
  return values.filter((item) => {
    const key = typeof item === 'string' ? item : String(item?.id || item?.ref || JSON.stringify(item))
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function validateExecutionCompletion(contractInput, result = {}) {
  const contract = normalizeExecutionContract(contractInput)
  if (!hasRules(contract)) return { ok: true, contract, violations: [] }
  const calls = successfulToolCalls(result)
  const evidence = evidenceEntries(result)
  const artifacts = artifactEntries(result)
  const violations = []
  const missingTools = contract.requiredTools.filter(name => !calls.some(call => call?.name === name))
  if (missingTools.length) {
    violations.push({
      code: 'missing_required_tools',
      message: `缺少成功的必需工具调用：${missingTools.join('、')}`,
      missingTools,
    })
  }
  const unmetEvidence = contract.requiredEvidence.filter(rule => !evidence.some((entry) => {
    if (entry?.status !== 'ok') return false
    if (rule.tool && entry?.provenance?.tool !== rule.tool) return false
    if (rule.kind && rule.kind !== 'tool_result' && entry?.provenance?.kind !== rule.kind) return false
    if (rule.kind === 'tool_result' && !entry?.provenance?.tool) return false
    if (rule.forbidTruncated && ['truncated', 'empty'].includes(entry?.status)) return false
    if (rule.minChars != null && String(entry?.digest || '').length < Number(rule.minChars)) return false
    return true
  }))
  if (unmetEvidence.length) {
    violations.push({ code: 'missing_required_evidence', message: '必需执行证据尚未满足', unmet: unmetEvidence })
  }
  const unmetConditions = contract.completionConditions.filter((condition) => {
    if (condition.type === 'tool_success') return !calls.some(call => call?.name === condition.tool)
    if (condition.type === 'evidence_present') {
      return !evidence.some(entry => entry?.status === 'ok'
        && (!condition.kind || entry?.provenance?.kind === condition.kind))
    }
    if (condition.type === 'artifact_present') return artifacts.length === 0
    return false
  })
  if (unmetConditions.length) {
    violations.push({ code: 'completion_unmet', message: 'Agent 完成条件尚未满足', unmet: unmetConditions })
  }
  if (artifacts.length < contract.minArtifacts) {
    violations.push({
      code: 'missing_required_artifacts',
      message: `交付物不足：需要 ${contract.minArtifacts} 项，实际 ${artifacts.length} 项`,
      expected: contract.minArtifacts,
      actual: artifacts.length,
    })
  }
  const missingArtifacts = contract.requiredArtifacts.filter(rule => !artifacts.some((artifact) => {
    if (!rule.type) return true
    return String(artifact?.type || artifact?.kind || '') === String(rule.type)
  }))
  if (missingArtifacts.length) {
    violations.push({ code: 'required_artifact_unmet', message: '缺少约定类型的交付物', unmet: missingArtifacts })
  }
  return { ok: violations.length === 0, contract, violations }
}

function enforceExecutionTerminal(contract, terminal = {}) {
  const assessed = validateExecutionCompletion(contract, terminal)
  if (assessed.ok) return { ...terminal, executionContractVerified: true }
  const existing = terminal.executionEvidence && typeof terminal.executionEvidence === 'object'
    ? terminal.executionEvidence
    : {}
  const message = assessed.violations[0]?.message || 'Agent 未完成声明的真实执行'
  return {
    ...terminal,
    ok: false,
    terminal: 'ERROR',
    status: 'failed',
    code: 'execution_contract_unmet',
    error: message,
    stopReason: message,
    executionContractVerified: false,
    executionEvidence: {
      ...existing,
      gateStatus: 'blocked',
      verificationPassed: false,
      violations: [...(existing.violations || []), ...assessed.violations],
    },
  }
}

module.exports = {
  normalizeExecutionContract,
  mergeExecutionContracts,
  hasRules,
  validateExecutionCompletion,
  enforceExecutionTerminal,
}
