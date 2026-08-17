export function RunInputAgentsPreview({ agents }: { agents: string[] }) {
  if (!agents.length) return null
  return (
    <div className="wb-run-agents-preview" id="wbRunInputAgents" data-testid="run-input-agents">
      <span className="wb-run-agents-preview-label">参与专家</span>
      {agents.map((name) => (
        <span key={name} className="wb-run-agent">{name}</span>
      ))}
    </div>
  )
}
