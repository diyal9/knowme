import type { ExpertTaskDiagnosticSnapshot } from '../../../domain/expert-task-diagnostics'

export function ExpertTaskDiagnostics({ snapshot }: { snapshot: ExpertTaskDiagnosticSnapshot | null }) {
  if (!snapshot) return null
  const value = (number: number | null) => number == null ? '未记录' : String(number)
  return (
    <details className="wb-expert-diagnostics-card">
      <summary>执行诊断（最近一次记录）</summary>
      <dl>
        <div><dt>实际加载工具 / 可用工具</dt><dd>{value(snapshot.loaded)} / {value(snapshot.available)}</dd></div>
        <div><dt>未加载工具</dt><dd>{value(snapshot.omitted)}</dd></div>
        <div><dt>消息与工具总预算用量</dt><dd>{value(snapshot.usedTokens)} / {value(snapshot.inputBudget)} tokens</dd></div>
        <div><dt>工具定义占用</dt><dd>{value(snapshot.schemaTokens)} tokens</dd></div>
        <div><dt>选择原因</dt><dd>{snapshot.reason}</dd></div>
        {snapshot.loadedNames.length ? <div><dt>实际加载工具名称</dt><dd>{snapshot.loadedNames.join('、')}</dd></div> : null}
      </dl>
    </details>
  )
}
