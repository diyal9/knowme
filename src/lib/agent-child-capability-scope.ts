'use strict'

const { resolveAgentCapabilityScope, intersectScopeIds } = require('./agent-capability-scope')
const { buildRunGovernancePolicy } = require('./tool-surface-builder')

function resolveChildCapabilityState({ parentSession, childSession, expertRuntime, userData, parentPermissions, parentPolicy, noTools }) {
  if (!parentSession || !childSession) return null
  const parentScope = resolveAgentCapabilityScope({ session: parentSession, expertRuntime, userData,
    permissions: parentPermissions, executionPolicy: noTools ? 'no-tools' : undefined })
  const parentSnapshot = parentSession.expertId ? expertRuntime.getSessionPersona(parentSession.id, parentSession.expertId) : null
  const liveParentPolicy = buildRunGovernancePolicy({ session: parentSession, permissions: parentPermissions,
    expertSnapshot: parentSnapshot, capabilityScope: parentScope })
  const ceiling = {
    allowedSkillIds: parentScope.allowedSkillIds,
    allowedConnectorIds: intersectScopeIds([parentScope.allowedConnectorIds, parentPolicy?.allowedConnectorIds, liveParentPolicy.allowedConnectorIds]),
    allowedKnowledgeIds: parentScope.allowedKnowledgeIds,
    capabilities: {
      skills: { denylist: parentScope.deniedSkillIds },
      connectors: { denylist: parentScope.deniedConnectorIds },
      knowledge: { denylist: parentScope.deniedKnowledgeIds },
    },
    tools: {
      allowlist: intersectScopeIds([parentPolicy?.allowlist, parentPolicy?.expertToolNames, liveParentPolicy.allowlist, liveParentPolicy.expertToolNames]),
      denylist: [...new Set([...(parentPolicy?.denylist || []), ...liveParentPolicy.denylist])],
    },
  }
  const scope = resolveAgentCapabilityScope({ session: childSession, expertRuntime, userData,
    parentScope: ceiling, executionPolicy: parentScope.noTools ? 'no-tools' : undefined })
  const childSnapshot = childSession.expertId ? expertRuntime.getSessionPersona(childSession.id, childSession.expertId) : null
  const governancePolicy = buildRunGovernancePolicy({ session: childSession, expertSnapshot: childSnapshot,
    capabilityScope: scope, parentScope: ceiling })
  if (parentScope.noTools) governancePolicy.allowlist = []
  if (liveParentPolicy.orchestration.allowDelegate === false || parentPolicy?.orchestration?.allowDelegate === false) {
    governancePolicy.orchestration.allowDelegate = false
  }
  return { scope, parentScope, governancePolicy, ceiling }
}

module.exports = { resolveChildCapabilityState }
