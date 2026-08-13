'use strict'

/**
 * Merge multiple { definitions, handlers } tool groups.
 * On name conflict, the first registered definition wins.
 * @param {...({ definitions?: any[], handlers?: Record<string, Function> }|null|undefined)} groups
 * @returns {{ definitions: any[], handlers: Record<string, Function> }|null}
 */
function mergeExtraTools(...groups) {
  const definitions = []
  const handlers = {}
  const seen = new Set()
  for (const group of groups) {
    if (!group || !Array.isArray(group.definitions)) continue
    for (const def of group.definitions) {
      const name = def?.function?.name
      if (!name || seen.has(name)) continue
      seen.add(name)
      definitions.push(def)
      const handler = group.handlers?.[name]
      if (typeof handler === 'function') handlers[name] = handler
    }
  }
  return definitions.length ? { definitions, handlers } : null
}

module.exports = { mergeExtraTools }
