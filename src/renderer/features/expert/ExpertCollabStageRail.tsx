const STAGES = ['澄清', '确认计划', '执行', '验收', '完成']

export function expertCollabStage(status: string, draftHasGoal = false) {
  if (status === 'draft') return draftHasGoal ? 1 : 0
  if (status === 'review' || status === 'revising') return 3
  if (status === 'completed') return 4
  return 2
}

export function ExpertCollabStageRail({ active }: { active: number }) {
  return (
    <ol className="wb-expert-stage-rail" aria-label={`协作阶段：${STAGES[active]}`}>
      {STAGES.map((label, index) => (
        <li
          key={label}
          className={index < active ? 'is-done' : index === active ? 'is-active' : ''}
          aria-current={index === active ? 'step' : undefined}
          title={`${index + 1}. ${label}`}
        >
          <span>{index < active ? '✓' : index + 1}</span>
          <strong>{label}</strong>
        </li>
      ))}
    </ol>
  )
}
