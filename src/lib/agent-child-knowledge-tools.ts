'use strict'

const { resolveAgentKnowledgePolicy } = require('./agent-generate-prepare')

/** Each child owns its provider/policy closure; never reuse a broader parent query. */
function buildChildKnowledgeTools({ libs, deps, prepared, getSession, getState }) {
  const currentScope = () => {
    const session = getSession()
    const state = getState()
    if (!session || !state || state.scope.noTools) return null
    const scopedSession = {
      ...session,
      knowledgeRefs: Array.isArray(state.scope.allowedKnowledgeIds)
        ? state.scope.allowedKnowledgeIds.map(id => ({ id })) : session.knowledgeRefs,
      run: { ...session.run, permissions: {
        ...session.run?.permissions,
        allowedKnowledgeIds: state.scope.allowedKnowledgeIds,
        knowledge: { ...session.run?.permissions?.knowledge, denylist: state.scope.deniedKnowledgeIds },
      } },
    }
    const retrievalScope = deps.ensureCapabilityHub().resolveSessionRetrievalScope(scopedSession)
    return {
      retrievalScope,
      knowledgePolicy: resolveAgentKnowledgePolicy(scopedSession, deps.getAgentProfileStore, retrievalScope.providers || []),
      projectId: scopedSession.projectId || null,
    }
  }
  const initial = currentScope()
  if (!initial) {
    const denied = async () => ({ ok: false, code: 'knowledge_scope_denied', error: '子任务当前没有知识访问授权。' })
    return { queryKnowledge: denied, kbQueryTool: denied, kbGetTool: denied }
  }
  return libs.createKnowledgeTools({
    app: libs.app, fabricRetrieval: libs.fabricRetrieval, knowledgeProvider: deps.knowledgeProvider,
    ...initial, embedFn: prepared.embedFn, ensureFabricSeeded: deps.ensureFabricSeeded,
    buildFabricCtx: deps.buildFabricCtx, getCurrentScope: currentScope,
  })
}

module.exports = { buildChildKnowledgeTools }
