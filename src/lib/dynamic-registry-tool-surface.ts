'use strict'

const agentTools = require('./agent-tools')

/** Refresh projections, never create a second execution authority or registry. */
function createDynamicRegistryToolSurface(registry, ctx, options = {}) {
  let count = -1
  let current
  let projected
  const refresh = () => {
    const nextCount = registry.list().length
    if (!current || nextCount !== count) {
      projected = registry.projectToSurface(agentTools.parseToolArguments, ctx)
      current = agentTools.createToolSurface({ ...options, extraDefinitions: registry.getDefinitions(),
        handlers: projected.handlers, governancePolicy: ctx.governancePolicy, deps: ctx })
      count = nextCount
    }
    return current
  }
  const surface = {
    getToolDefinitions: () => refresh().getToolDefinitions(),
    getToolRecords: () => refresh().getToolRecords(),
    isAllowedTool: name => refresh().isAllowedTool(name),
    validateToolCall: (name, args) => refresh().validateToolCall(name, args),
    createToolExecutor: deps => ({
      executeToolCall: call => refresh().createToolExecutor(deps).executeToolCall(call),
      validateToolCall: (name, args) => refresh().validateToolCall(name, args),
      isAllowedTool: name => refresh().isAllowedTool(name),
    }),
    withGovernancePolicy: policy => createDynamicRegistryToolSurface(registry, { ...ctx, governancePolicy: policy }, options).surface,
    get extras() { return refresh().extras },
  }
  return { surface, get projected() { refresh(); return projected } }
}

module.exports = { createDynamicRegistryToolSurface }
