'use strict'

function asList(value) {
  if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean)
  const text = String(value || '').trim()
  return text ? [text] : []
}

function extractTaskTrace({
  context = null,
  handoff = null,
  session = null,
  slug = '',
  workflow = '',
} = {}) {
  const meta = (context && context.meta) || {}
  const trace = (handoff && handoff.trace) || {}
  const requirement = (handoff && handoff.requirement) || {}
  return {
    sceneId: String(meta.sceneId || trace.sceneId || '').trim(),
    skillId: String(meta.skillId || trace.skillId || '').trim(),
    connectors: asList(meta.connectors || trace.connectors),
    knowledgeSources: asList(meta.sources || requirement.sources || trace.knowledgeSources),
    sessionId: String(session?.id || meta.sessionId || trace.sessionId || '').trim(),
    runId: String(session?.run?.id || meta.runId || trace.runId || slug || '').trim(),
    workflow: String(workflow || handoff?.workflow || meta.workflow || '').trim(),
    handoffFrom: String(meta.handoffFrom || trace.handoffFrom || '').trim(),
    sessionCompatMode: String(trace.sessionCompatMode || meta.sessionCompatMode || '').trim(),
  }
}

function traceRows(trace = {}) {
  const rows = []
  if (trace.sceneId) rows.push({ label: '场景', value: trace.sceneId })
  if (trace.skillId) rows.push({ label: 'Skill', value: trace.skillId })
  if (asList(trace.connectors).length) rows.push({ label: '连接器', value: asList(trace.connectors).join(' · ') })
  if (asList(trace.knowledgeSources).length) rows.push({ label: '知识来源', value: asList(trace.knowledgeSources).join(' · ') })
  if (trace.sessionId) rows.push({ label: 'Session', value: trace.sessionId })
  if (trace.runId) rows.push({ label: 'Run', value: trace.runId })
  if (trace.workflow) rows.push({ label: 'Workflow', value: trace.workflow })
  if (trace.handoffFrom) rows.push({ label: '交接来源', value: trace.handoffFrom })
  if (trace.sessionCompatMode) rows.push({ label: '兼容模式', value: trace.sessionCompatMode })
  return rows
}

function hasVisibleTrace(trace = {}) {
  return traceRows(trace).length > 0
}

module.exports = {
  extractTaskTrace,
  traceRows,
  hasVisibleTrace,
}
