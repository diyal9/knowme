export function projectExpertTaskDiagnostics(raw: unknown) {
  const source = raw && typeof raw === 'object' ? raw as Record<string, any> : {}
  const info = source.contextInfo || {}
  const metrics = source.metrics || {}
  const surface = metrics.toolSurface || {}
  const round = metrics.roundContext || {}
  const count = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : null
  const names = Array.isArray(surface.loadedNames) ? surface.loadedNames.filter((name: unknown) => typeof name === 'string'
    && /^[a-z][a-z0-9_.-]{0,119}$/i.test(name) && !/^(?:sk-|Bearer|token|secret|password)/i.test(name)).slice(0, 32) : []
  const available = count(surface.available ?? info.toolRuntime?.toolCount)
  const loaded = count(surface.loaded)
  const usedTokens = count(round.usedTokens)
  const schemaTokens = count(round.schemaTokens ?? surface.schemaTokens)
  const inputBudget = count(round.inputBudget)
  const expansion = count(surface.expansion)
  if ([available, loaded, usedTokens, schemaTokens, inputBudget].every(value => value == null) && !names.length) return null
  return { available, loaded, loadedNames: names as string[], omitted: count(surface.omitted),
    usedTokens, schemaTokens, inputBudget, expansion,
    reason: info.toolRuntime?.enabled === false ? '当前执行策略未启用工具'
      : expansion != null && expansion > 0 ? '按执行反馈扩展工具选择，仍受任务授权范围限制'
        : '按任务需求、已发现工具与执行契约选择',
  }
}

export type ExpertTaskDiagnosticSnapshot = NonNullable<ReturnType<typeof projectExpertTaskDiagnostics>>
