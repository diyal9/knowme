'use strict'

function text(value, max = 4000) { return String(value == null ? '' : value).trim().slice(0, max) }
function unique(values, max = 32) { return [...new Set((Array.isArray(values) ? values : []).map(value => text(value, 240)).filter(Boolean))].slice(0, max) }

function routeWorkRelationship(input = {}) {
  const agentIds = unique(input.agentIds || (input.agentId ? [input.agentId] : []), 16)
  const explicitControls = Boolean(input.explicitWorkflow || input.hasHuman || input.hasAction || input.hasCondition || input.hasGate || input.fixedHandoff)
  const goal = text(input.goal || input.intent, 2000)
  const selectedContext = (Array.isArray(input.selectedContext) ? input.selectedContext : []).slice(0, 32).map((item, index) => ({
    id: text(item?.id, 120) || `context-${index + 1}`,
    title: text(item?.title || item?.name, 160) || `上下文 ${index + 1}`,
    type: text(item?.type, 40) || 'text',
    content: text(item?.content || item?.text, 8000),
    ref: text(item?.ref, 240),
  })).filter(item => item.content || item.ref)
  const envelope = { goal, materials: selectedContext, constraints: unique(input.constraints, 24), sourceSessionId: text(input.sessionId, 120), excluded: ['完整个人会话', '长期个人记忆', '个人凭据', '未授权绝对路径'] }
  if (agentIds.length >= 2 || explicitControls) {
    return { ok: true, relationship: 'workflow', requiresConfirmation: true, draft: { name: text(input.title || goal, 120) || '我的工作流草稿', source: 'personal', status: 'draft', goalTypes: unique(input.goalTypes, 16), inputs: selectedContext, agentRefs: agentIds.map(id => ({ id, version: 'latest' })), graph: input.graph || { goal, nodes: [], edges: [] } }, handoffPreview: envelope }
  }
  if (agentIds.length === 1 && (input.formalDelivery === true || input.deliverable || input.deadline)) {
    return { ok: true, relationship: 'expert-task', requiresConfirmation: true, brief: { expertId: agentIds[0], title: text(input.title || goal, 160), brief: { ...envelope, deliverables: Array.isArray(input.deliverables) ? input.deliverables.slice(0, 16) : [{ id: 'primary', title: text(input.deliverable || '任务成果', 160), type: 'document', required: true }], dueAt: text(input.deadline, 40) } }, handoffPreview: envelope }
  }
  return { ok: true, relationship: 'co-create', requiresConfirmation: false, sessionId: text(input.sessionId, 120), context: envelope }
}

function resultActions() {
  return [
{ id: 'continue-with-knowme', label: '继续由智能伙伴处理', confirmation: false },
    { id: 'add-to-knowledge', label: '加入知识库', confirmation: true },
    { id: 'adjust-personal-profile', label: '调整个人 Profile', confirmation: true },
    { id: 'feedback-agent', label: '反馈 Agent', confirmation: true },
    { id: 'propose-workflow-improvement', label: '生成工作流改进提案', confirmation: true },
  ]
}

module.exports = { routeWorkRelationship, resultActions }
