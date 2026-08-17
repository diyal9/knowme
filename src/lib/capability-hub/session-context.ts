/**
 * capability-hub/session-context — 会话工具面、上下文组装与 knowledge patch。
 * 不负责：IPC、能力 install/uninstall（见 lifecycle）。
 */
'use strict'

const { buildSkillTools } = require('../agent-skill-tools')
const {
  assembleCapabilityContext,
  getSessionCapabilityBindings,
} = require('../agent-context-assembly')
const { normalizeKnowledgeRefs } = require('../agent-sessions')
const {
  projectSessionKnowledge,
  resolveSessionRetrievalProviders,
  validateSessionContextPatch,
} = require('./map')

/**
 * 会话级 capability 绑定、工具构建与 DTO 投影。
 */
function createCapabilitySessionContext(deps) {
  const {
    getKnowledgeDir,
    getKnowledgeCatalog,
    resolveProviderById,
    getActiveProvider,
    capabilitiesRoot,
    buildInstallStoreMap,
    runSkillScriptInSandbox,
    skillRuntime,
    expertRuntime,
  } = deps

  function buildSkillToolsForSession(session, sandboxPermissions) {
    const bindings = getSessionCapabilityBindings(session, expertRuntime())
    return buildSkillTools({
      capabilitiesRoot: capabilitiesRoot(),
      knowledgeDir: getKnowledgeDir(),
      getInstallStore: buildInstallStoreMap,
      allowedSkillIds: bindings.allowedSkillIds,
      runScript: (ctx) => runSkillScriptInSandbox({
        ...ctx,
        permissions: sandboxPermissions || session?.run?.permissions || {},
      }),
    })
  }

  function filterConnectorsForSession(session, connectors) {
    const bindings = getSessionCapabilityBindings(session, expertRuntime())
    if (!Array.isArray(bindings.allowedConnectorIds)) return connectors
    const allow = new Set(bindings.allowedConnectorIds)
    return connectors.filter((c) => allow.has(c.id))
  }

  function assembleContextForSession(session, prompt, slashRefs, tier, legacySkillContext, options = {}) {
    return assembleCapabilityContext({
      session,
      prompt,
      slashRefs,
      tier,
      expertRuntime: expertRuntime(),
      skillRuntime: skillRuntime(),
      legacySkillContext,
      taskId: String(options.taskId || '').trim(),
    })
  }

  function sessionDto(session) {
    let expertName = ''
    let expert = null
    if (session.expertId) {
      const runtime = expertRuntime()
      const projection = runtime.getSessionPersona(session.id, session.expertId)
      if (projection.ok) {
        expertName = projection.persona?.name || session.expertId
        expert = {
          id: projection.expertId || session.expertId,
          name: expertName,
          description: projection.persona?.description || '',
          avatar: projection.persona?.avatar || '',
          soul: projection.persona?.soul || '',
          sop: projection.persona?.sop || '',
          agenticType: projection.persona?.agenticType || 'react',
          agenticConfig: projection.persona?.agenticConfig || {},
          bindings: projection.bindings || { skills: [], connectors: [] },
          readiness: projection.readiness || { state: 'ready', items: [], issues: [] },
          source: projection.source,
        }
      }
    }
    const catalog = getKnowledgeCatalog()
    const knowledge = projectSessionKnowledge(session, catalog)
    const taskRef = session?.taskRef?.id ? { id: String(session.taskRef.id) } : null
    return {
      ...session,
      expertName,
      expert,
      taskRef,
      knowledge,
    }
  }

  function updateSessionKnowledgeContext(session, patch = {}) {
    const validation = validateSessionContextPatch(patch)
    if (!validation.ok) return validation

    const next = {
      ...session,
      updatedAt: new Date().toISOString(),
    }
    if (patch.knowledgeRefs !== undefined) {
      next.knowledgeRefs = normalizeKnowledgeRefs(patch.knowledgeRefs)
    }

    const skillIds = patch.skills !== undefined
      ? patch.skills
      : (patch.bindings?.skills !== undefined ? patch.bindings.skills : undefined)
    const connectorIds = patch.connectors !== undefined
      ? patch.connectors
      : (patch.bindings?.connectors !== undefined ? patch.bindings.connectors : undefined)

    if (skillIds !== undefined || connectorIds !== undefined) {
      const runtime = expertRuntime()
      if (typeof runtime.updateSessionBindings !== 'function') {
        return { ok: false, error: 'Session 绑定覆盖暂不可用' }
      }
      const bindingPatch = {}
      if (skillIds !== undefined) bindingPatch.skills = skillIds
      if (connectorIds !== undefined) bindingPatch.connectors = connectorIds
      const bound = runtime.updateSessionBindings(session.id, bindingPatch)
      if (!bound.ok) return { ok: false, error: bound.message || '绑定更新失败', code: bound.code }
      next.expert = {
        ...(next.expert || {}),
        bindings: bound.bindings,
        readiness: bound.readiness,
      }
    }

    return { ok: true, session: next }
  }

  function resolveSessionRetrievalScope(session) {
    return resolveSessionRetrievalProviders(session, {
      resolveProviderById,
      getActiveProvider,
    })
  }

  return {
    buildSkillToolsForSession,
    filterConnectorsForSession,
    assembleContextForSession,
    sessionDto,
    updateSessionKnowledgeContext,
    resolveSessionRetrievalScope,
  }
}

module.exports = {
  createCapabilitySessionContext,
}
